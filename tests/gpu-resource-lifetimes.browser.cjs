const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.route('**/__gpu-lifetimes', route => route.fulfill({ contentType: 'text/html', body: '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"}}</script><div id="city-flight"></div>' }));
    await page.goto(base + '/__gpu-lifetimes');
    const flight = await page.evaluate(async () => {
      const THREE = await import('three');
      const { createTokyoFlight } = await import('/tokyo-flight.js');
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      const nativeFetch = fetch, nativeBitmap = createImageBitmap, decoded = [];
      window.fetch = (url, options) => String(url).startsWith('lifetime-atlases/')
        ? Promise.resolve(new Response(String(url).includes('manifest') ? JSON.stringify([{ zoom: 4, x: 1, y: 1, grid: 1, count: 16 }]) : blob))
        : nativeFetch(url, options);
      window.createImageBitmap = async (...args) => { const image = await nativeBitmap(...args); decoded.push(image); return image; };
      const renderer = new THREE.WebGLRenderer(), earthGroup = new THREE.Group();
      renderer.compileAsync = async () => { throw new Error('injected compile failure'); };
      let error;
      try { await createTokyoFlight({ renderer, earthGroup, radius: 1, location: { lat: 35, lon: 139 }, assetDirectory: 'lifetime-atlases' }); }
      catch (failure) { error = failure.message; }
      const result = { error, textures: renderer.info.memory.textures, closed: decoded.every(image => image.width === 0), groups: earthGroup.children.length };
      window.fetch = nativeFetch; window.createImageBitmap = nativeBitmap; renderer.dispose(); return result;
    });
    assert.deepEqual(flight, { error: 'injected compile failure', textures: 0, closed: true, groups: 0 }, 'Flight compile failures must release uploaded atlases and bitmaps');

    const cloudUpload = await page.evaluate(async () => {
      const THREE = await import('three');
      const { createTokyoClouds } = await import('/tokyo-clouds.js');
      const renderer = new THREE.WebGLRenderer(), init = renderer.initTexture.bind(renderer);
      renderer.initTexture = texture => {
        init(texture);
        if (texture.isDataTexture) throw new Error('injected cloud upload failure');
      };
      let error;
      try { await createTokyoClouds({ renderer, radius: 1, latitude: 0, longitude: 0 }); }
      catch (failure) { error = failure.message; }
      const textures = renderer.info.memory.textures; renderer.dispose(); return { error, textures };
    });
    assert.deepEqual(cloudUpload, { error: 'injected cloud upload failure', textures: 0 }, 'Failed cloud upload must release textures allocated before its result can be owned by the flight');

    const construction = await page.evaluate(async () => {
      const THREE = await import('three');
      const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js');
      const { createGainesvilleRoom } = await import('/gainesville-room.js');
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
      const bitmap = await createImageBitmap(canvas), texture = new THREE.Texture(bitmap);
      const model = new THREE.Group(); model.add(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ map: texture })));
      const nativeModel = GLTFLoader.prototype.loadAsync, nativeTexture = THREE.TextureLoader.prototype.loadAsync;
      const sibling = new THREE.Texture(); let siblingReleased = false;
      sibling.addEventListener('dispose', () => { siblingReleased = true; });
      GLTFLoader.prototype.loadAsync = async () => ({ scene: model });
      THREE.TextureLoader.prototype.loadAsync = async url => {
        if (url.includes('architecture')) throw new Error('injected texture failure');
        await new Promise(resolve => setTimeout(resolve, 20)); return sibling;
      };
      let error;
      try { await createGainesvilleRoom(); } catch (failure) { error = failure.message; }
      await new Promise(resolve => setTimeout(resolve, 30));
      const result = { error, closed: bitmap.width === 0, siblingReleased };
      GLTFLoader.prototype.loadAsync = nativeModel; THREE.TextureLoader.prototype.loadAsync = nativeTexture;
      bitmap.close(); return result;
    });
    assert.deepEqual(construction, { error: 'injected texture failure', closed: true, siblingReleased: true }, 'Failed room construction must close model bitmaps and late sibling resources');

    const failedJapanResidency = await page.evaluate(async () => {
      const THREE = await import('three');
      const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js');
      const { createJapanRoom } = await import('/japan-room.js');
      const original = GLTFLoader.prototype.loadAsync, bitmaps = new Set();
      GLTFLoader.prototype.loadAsync = async function (...args) {
        const model = await original.apply(this, args);
        for (const texture of model.parser.associations.keys()) if (texture.isTexture && texture.image instanceof ImageBitmap) bitmaps.add(texture.image);
        const dependency = model.parser.getDependency.bind(model.parser);
        model.parser.getDependency = (type, index) => type === 'bufferView'
          ? Promise.reject(new Error('injected residency failure')) : dependency(type, index);
        return model;
      };
      let error;
      try { await createJapanRoom(); } catch (failure) { error = failure.message; }
      GLTFLoader.prototype.loadAsync = original;
      return { error, decoded: bitmaps.size, closed: [...bitmaps].every(image => image.width === 0), media: document.querySelectorAll('#tokyo-window-video,#tokyo-record-track').length };
    });
    assert.equal(failedJapanResidency.error, 'injected residency failure');
    assert.ok(failedJapanResidency.decoded > 0 && failedJapanResidency.closed && failedJapanResidency.media === 0, 'Residency setup failure must close bitmaps and remove constructed media: '+JSON.stringify(failedJapanResidency));

    const repeatedPreparation = await page.evaluate(async () => {
      const THREE = await import('three');
      const { createGainesvilleRoom } = await import('/gainesville-room.js');
      const renderer = new THREE.WebGLRenderer(); renderer.setSize(8, 8);
      const room = await createGainesvilleRoom(); room.resize(8, 8);
      await room.prepare(renderer);
      // Capture initially renders without an environment. Warm its shader once
      // before measuring the subsequent steady-size environment replacements.
      await room.prepare(renderer);
      const counts = [renderer.info.memory.textures];
      for (let i=0;i<4;i++) { await room.prepare(renderer); counts.push(renderer.info.memory.textures); }
      room.dispose(); renderer.dispose(); return { first: counts.at(-2), next: counts.at(-1), counts };
    });
    assert.equal(repeatedPreparation.next, repeatedPreparation.first, 'Replacing a prepared environment must release its previous GPU target: '+JSON.stringify(repeatedPreparation));

    const preparation = await page.evaluate(async () => {
      const THREE = await import('three');
      const { createJapanRoom } = await import('/japan-room.js');
      const room = await createJapanRoom();
      const renderer = new THREE.WebGLRenderer(); renderer.setSize(8, 8); room.resize(8, 8);
      const nativeRAF = requestAnimationFrame; let release, renders = 0;
      window.requestAnimationFrame = callback => { release = callback; return 1; };
      const nativeRender = renderer.render.bind(renderer);
      renderer.render = (...args) => { renders++; return nativeRender(...args); };
      const pending = room.prepare(renderer);
      const beforeDispose = renders;
      room.dispose();
      while (release) { const callback = release; release = null; callback(performance.now()); await Promise.resolve(); }
      await pending;
      let rejectedTextures = false;
      try { await room.prepareTextures(); } catch { rejectedTextures = true; }
      const result = { rendersAfterDispose: renders - beforeDispose, environment: room.scene.environment };
      window.requestAnimationFrame = nativeRAF; renderer.dispose();
      return { rendersAfterDispose: result.rendersAfterDispose, environment: result.environment?.isTexture || false, rejectedTextures };
    });
    assert.deepEqual(preparation, { rendersAfterDispose: 0, environment: false, rejectedTextures: true }, 'Disposal during room preparation must stop later GPU work and environment publication');
    console.log('PASS: failed flight compilation, failed room construction/residency, repeated environment capture and disposal during asynchronous room preparation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
