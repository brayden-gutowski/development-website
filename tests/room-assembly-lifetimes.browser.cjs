const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/__room-assembly-lifetimes', route => route.fulfill({
      contentType: 'text/html',
      body: '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"}}</script>',
    }));
    await page.goto(base + '/__room-assembly-lifetimes');
    const assembly = await page.evaluate(async () => {
      const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js');
      const { createJapanRoom } = await import('/japan-room.js');
      const nativeLoad = GLTFLoader.prototype.loadAsync;
      const nativeCreateURL = URL.createObjectURL, nativeRevokeURL = URL.revokeObjectURL;
      const bitmaps = new Set(), urls = new Set();
      URL.createObjectURL = blob => { const url = nativeCreateURL(blob); urls.add(url); return url; };
      URL.revokeObjectURL = url => { urls.delete(url); nativeRevokeURL(url); };
      GLTFLoader.prototype.loadAsync = async function (...args) {
        const model = await nativeLoad.apply(this, args);
        if (String(args[0]).includes('JapanRoom.glb')) {
          for (const texture of model.parser.associations.keys()) {
            if (texture.isTexture && texture.image instanceof ImageBitmap) bitmaps.add(texture.image);
          }
          // A valid download can still have incompatible authored room content.
          model.scene.getObjectByName('Cube007').name = 'Missing review book';
        }
        return model;
      };
      let error;
      try {
        await createJapanRoom({ bookCovers: [{ id: 'assembly-failure', image: 'assets/kroi-spin-cover.png' }] });
      } catch (failure) { error = failure.message; }
      const result = {
        error, decoded: bitmaps.size, unclosed: [...bitmaps].filter(image => image.width > 0).length,
        media: document.querySelectorAll('#tokyo-window-video,#tokyo-record-track').length,
        objectURLs: urls.size,
      };
      GLTFLoader.prototype.loadAsync = nativeLoad;
      URL.createObjectURL = nativeCreateURL; URL.revokeObjectURL = nativeRevokeURL;
      for (const image of bitmaps) image.close();
      for (const media of document.querySelectorAll('#tokyo-window-video,#tokyo-record-track')) {
        media.pause(); media.removeAttribute('src'); media.load(); media.remove();
      }
      for (const url of urls) nativeRevokeURL(url);
      return result;
    });
    const disposal = await page.evaluate(async () => {
      const THREE = await import('three');
      const { createGainesvilleRoom } = await import('/gainesville-room.js');
      const room = await createGainesvilleRoom(), renderer = new THREE.WebGLRenderer();
      const textures = Array.from({ length: 3 }, () => {
        const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
        texture.needsUpdate = true; renderer.initTexture(texture); return texture;
      });
      // Scene-owned resources use all three disposal paths already supported by
      // disposeRoomScene: shader uniforms, custom depth materials and instances.
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShaderMaterial({
        uniforms: { ownedTexture: { value: textures[0] } },
      }));
      mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ map: textures[1] });
      const instances = new THREE.InstancedMesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial(), 1);
      instances.morphTexture = textures[2];
      room.scene.add(mesh, instances);
      const before = renderer.info.memory.textures;
      room.dispose();
      const after = renderer.info.memory.textures;
      for (const texture of textures) texture.dispose();
      mesh.customDepthMaterial.dispose(); instances.dispose(); renderer.dispose();
      return { before, after };
    });
    console.log('Room assembly/disposal lifetime evidence:', { assembly, disposal });
    assert.equal(assembly.error, 'Review book is missing from the room');
    assert.ok(assembly.decoded > 0, 'The assembly fixture must load native model bitmaps');
    assert.equal(assembly.unclosed, 0, 'Synchronous room assembly failure must close loaded model bitmaps');
    assert.equal(assembly.media, 0, 'Synchronous room assembly failure must remove its media elements');
    assert.equal(assembly.objectURLs, 0, 'Synchronous room assembly failure must revoke owned media blob URLs');
    assert.deepEqual(disposal, { before: 3, after: 0 }, 'Room disposal must release every scene-owned GPU texture');
    console.log('PASS: failed Tokyo assembly releases native images/media and Gainesville disposal covers scene-owned resources');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
