const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
  assert.ok((await fetch(base + '/room-texture-residency.js')).ok, 'The model texture residency helper must be available');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage(), errors = [], downloads = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/assets\/(GainesvilleRoom|JapanRoom)\.glb/.test(request.url())) downloads.push(request.url()); });
    await page.route('**/__model-texture-memory-harness', route => route.fulfill({ contentType: 'text/html', body: '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"}}</script>' }));
    await page.goto(base + '/__model-texture-memory-harness');
    const result = await page.evaluate(async () => {
      const THREE = await import('three');
      const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js');
      const { createModelTextureResidency } = await import('/room-texture-residency.js');
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const renderer = new THREE.WebGLRenderer(); renderer.setSize(8, 8);
      const target = new THREE.WebGLRenderTarget(8, 8), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 2);
      camera.position.z = 1;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ toneMapped: false }));
      const surface = new THREE.Scene(); surface.add(plane);
      const snapshot = texture => {
        plane.material.map = texture; plane.material.needsUpdate = true;
        renderer.setRenderTarget(target); renderer.render(surface, camera);
        const pixels = new Uint8Array(8 * 8 * 4); renderer.readRenderTargetPixels(target, 0, 0, 8, 8, pixels);
        renderer.setRenderTarget(null); return [...pixels];
      };
      const state = texture => JSON.stringify([texture.uuid, texture.source.uuid, texture.colorSpace, texture.flipY,
        texture.wrapS, texture.wrapT, texture.magFilter, texture.minFilter, texture.anisotropy, texture.channel,
        texture.offset.toArray(), texture.repeat.toArray(), texture.rotation, texture.matrix.toArray()]);
      const texturesOf = model => {
        const textures = new Set();
        model.traverse(object => { for (const material of [object.material].flat().filter(Boolean))
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); });
        return [...textures];
      };
      const closeCounts = new WeakMap(), nativeClose = ImageBitmap.prototype.close;
      ImageBitmap.prototype.close = function () { closeCounts.set(this, (closeCounts.get(this) || 0) + 1); return nativeClose.call(this); };
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
      const context = canvas.getContext('2d');
      for (const [x, y, color] of [[0, 0, '#f00'], [4, 0, '#0f0'], [0, 4, '#00f'], [4, 4, '#fff']]) {
        context.fillStyle = color; context.fillRect(x, y, 4, 4);
      }
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      // A real embedded glTF with two samplers, TEXCOORD_1 and a UV transform.
      const positions = new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,-1,0, 1,1,0, -1,1,0]);
      const uv = new Float32Array([0,0, 1,0, 1,1, 0,0, 1,1, 0,1]);
      const image = new Uint8Array(await blob.arrayBuffer()), binary = new Uint8Array(positions.byteLength + uv.byteLength + image.byteLength);
      binary.set(new Uint8Array(positions.buffer)); binary.set(new Uint8Array(uv.buffer), positions.byteLength); binary.set(image, positions.byteLength + uv.byteLength);
      const definition = { asset: { version: '2.0' }, buffers: [{ byteLength: binary.length }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }, { buffer: 0, byteOffset: positions.byteLength, byteLength: uv.byteLength }, { buffer: 0, byteOffset: positions.byteLength + uv.byteLength, byteLength: image.length }],
        accessors: [{ bufferView: 0, componentType: 5126, count: 6, type: 'VEC3', min: [-1,-1,0], max: [1,1,0] }, { bufferView: 1, componentType: 5126, count: 6, type: 'VEC2' }],
        images: [{ bufferView: 2, mimeType: 'image/png' }], samplers: [{ magFilter: 9728, minFilter: 9728 }, { magFilter: 9728, minFilter: 9728, wrapS: 33071 }],
        textures: [{ source: 0, sampler: 0 }, { source: 0, sampler: 1 }],
        materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }, { pbrMetallicRoughness: { baseColorTexture: { index: 1, texCoord: 1, extensions: { KHR_texture_transform: { offset: [.25, .125], scale: [.5, .75] } } } } }],
        meshes: [{ primitives: [0, 1].map(material => ({ attributes: { POSITION: 0, TEXCOORD_0: 1, TEXCOORD_1: 1 }, material })) }],
        nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0, extensionsUsed: ['KHR_texture_transform'] };
      const encoded = new TextEncoder().encode(JSON.stringify(definition)), jsonLength = Math.ceil(encoded.length / 4) * 4, binaryLength = Math.ceil(binary.length / 4) * 4;
      const glb = new ArrayBuffer(28 + jsonLength + binaryLength), header = new DataView(glb), bytes = new Uint8Array(glb);
      header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, glb.byteLength, true);
      header.setUint32(12, jsonLength, true); header.setUint32(16, 0x4e4f534a, true); bytes.fill(32, 20, 20 + jsonLength); bytes.set(encoded, 20);
      header.setUint32(20 + jsonLength, binaryLength, true); header.setUint32(24 + jsonLength, 0x004e4942, true); bytes.set(binary, 28 + jsonLength);
      const gltf = await new GLTFLoader().parseAsync(glb, '');
      const tracked = texturesOf(gltf.scene), originalMap = tracked[0];
      const variant = originalMap.clone(); variant.offset.set(.125, .25); variant.updateMatrix();
      const independentSource = new THREE.Texture(originalMap.image); independentSource.colorSpace = THREE.SRGBColorSpace; independentSource.needsUpdate = true;
      for (const map of [variant, independentSource]) gltf.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map })));
      tracked.push(variant, independentSource);
      check(!gltf.parser.associations.has(variant) && !gltf.parser.associations.has(independentSource), 'Fixture variants must exercise Source and image identity matching');
      const htmlImage = new Image(); htmlImage.src = URL.createObjectURL(blob); await htmlImage.decode(); URL.revokeObjectURL(htmlImage.src);
      const externalBitmap = await createImageBitmap(blob);
      const external = [new THREE.CanvasTexture(canvas), new THREE.Texture(htmlImage), new THREE.Texture(externalBitmap), new THREE.DataTexture(new Uint8Array([1,2,3,255]), 1, 1)];
      for (const map of external) { map.needsUpdate = true; renderer.initTexture(map); gltf.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({ map }))); }
      for (const map of tracked) renderer.initTexture(map);
      const initialImages = [...new Set(tracked.map(map => map.image))], before = tracked.map(snapshot), initialStates = tracked.map(state);
      const corners = [0, 7, 7 * 8, 8 * 8 - 1].map(index => before[0].slice(index * 4, index * 4 + 3));
      check(JSON.stringify(corners) === JSON.stringify([[255,0,0],[0,255,0],[0,0,255],[255,255,255]]), 'GLTF image orientation must match the native unflipped upload');
      const residency = await createModelTextureResidency(gltf);
      check(!gltf.parser && !residency.suspended, 'The controller must detach parser backing without suspending an active model');
      const residentCount = renderer.info.memory.textures;
      residency.suspend();
      check(residency.suspended && tracked.every(map => map.image === null), 'All embedded Source variants must release their pixels');
      check(initialImages.every(image => image.width === 0 && closeCounts.get(image) === 1), 'Shared ImageBitmaps must close once');
      check(external[0].image === canvas && external[1].image === htmlImage && external[2].image === externalBitmap && externalBitmap.width === 8, 'Canvas, HTML and external bitmap textures must remain intact');
      check(renderer.info.memory.textures < residentCount, 'Suspension must release real GPU allocations');
      await Promise.all([residency.prepare(), residency.prepare()]);
      for (const map of tracked) renderer.initTexture(map);
      check(!residency.suspended && tracked.every(map => map.image.width === 8 && map.image.height === 8), 'Preparation must restore every Source at full resolution');
      check(JSON.stringify(tracked.map(state)) === JSON.stringify(initialStates), 'Sampler, transform, color space and material texture identities must remain stable');
      const restoredPixels = tracked.map(snapshot);
      check(JSON.stringify(restoredPixels) === JSON.stringify(before), 'Restored GPU surfaces must be pixel-identical');
      check(renderer.info.memory.textures === residentCount, 'Repeated visits must not duplicate GPU textures');
      // Hold real bitmap decodes to exercise a canceled generation and a newer visit.
      residency.suspend();
      const nativeBitmap = window.createImageBitmap, releases = [], decoded = [];
      window.createImageBitmap = async (...args) => { const image = await nativeBitmap(...args); decoded.push(image); return new Promise(resolve => releases.push(() => resolve(image))); };
      const oldPreparation = residency.prepare();
      while (releases.length < 1) await new Promise(requestAnimationFrame);
      residency.suspend();
      const newPreparation = residency.prepare(), sharedPreparation = residency.prepare();
      while (releases.length < 2) await new Promise(requestAnimationFrame);
      releases[0](); await oldPreparation;
      check(decoded[0].width === 0 && tracked.every(map => map.image === null) && residency.suspended, 'A canceled decode must close without replacing a newer pending visit');
      releases[1](); await Promise.all([newPreparation, sharedPreparation]);
      check(decoded.length === 2 && !residency.suspended && tracked.every(map => map.image.width === 8), 'Concurrent prepare calls must share the newest generation');
      window.createImageBitmap = nativeBitmap;
      residency.suspend();
      for (const map of external) map.dispose(); externalBitmap.close();
      const models = [];
      // Exercise the actual authored room maps, including the 2048px walls.
      for (const name of ['GainesvilleRoom', 'JapanRoom']) {
        const model = await new GLTFLoader().loadAsync('/assets/' + name + '.glb');
        const maps = texturesOf(model.scene), dimensions = maps.map(map => [map.image.width, map.image.height]);
        const map = maps.find(map => /BrickWall.*color|PlasterStucco.*color/.test(map.name)) || maps.find(map => map.colorSpace === THREE.SRGBColorSpace);
        const pixels = snapshot(map), originalMaterials = [];
        model.scene.traverse(object => { if (object.material) originalMaterials.push(object.material); });
        const memory = await createModelTextureResidency(model);
        memory.suspend(); check(maps.every(map => map.image === null), name + ' must release every embedded map');
        await memory.prepare();
        check(JSON.stringify(maps.map(map => [map.image.width, map.image.height])) === JSON.stringify(dimensions), name + ' must restore original resolutions');
        check(JSON.stringify(snapshot(map)) === JSON.stringify(pixels), name + ' restored wall surface must match');
        const afterMaterials = []; model.scene.traverse(object => { if (object.material) afterMaterials.push(object.material); });
        check(afterMaterials.every((material, index) => material === originalMaterials[index]), name + ' material references must stay stable');
        memory.suspend(); models.push({ name, textures: maps.length });
        model.scene.traverse(object => { object.geometry?.dispose(); for (const material of [object.material].flat().filter(Boolean)) material.dispose(); });
      }
      const remaining = renderer.info.memory.textures;
      target.dispose(); plane.geometry.dispose(); plane.material.dispose(); renderer.dispose();
      ImageBitmap.prototype.close = nativeClose;
      return { corners, models, remaining };
    });
    assert.deepEqual(errors, []);
    assert.equal(downloads.length, 2, 'Room textures must resume from compressed embedded blobs without HTTP redownloads');
    assert.ok(result.models.every(model => model.textures > 30));
    assert.equal(result.remaining, 1, 'Only the sampling render target may remain after suspended texture disposal');
    console.log('PASS: model bitmap/GPU suspension, exact wall/sampler/UV restoration, cached room revisits, shared variants and canceled decodes', result);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
