const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.clock.setSystemTime(new Date('2026-10-18T03:00:00Z'));
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && /Shader|WebGL/.test(m.text())) errors.push(m.text()); });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const result = await page.evaluate(async () => {
      const THREE = await import('three');
      const { createJapanRoom } = await import('/japan-room.js');
      const room = await createJapanRoom();
      room.resize(1440, 900);
      room.scene.updateMatrixWorld(true);
      const curtain = room.scene.getObjectByName('Curtain');
      const thickness = new THREE.Box3().setFromObject(curtain).getSize(new THREE.Vector3()).x;
      const fabric = [];
      curtain.traverse(o => { if (o.isMesh) fabric.push(o.material); });
      if (fabric.some(m => m.transmission > 0)) throw new Error('Linen must scatter light without glass-like refraction feedback');
      if (fabric.some(m => m.transparent || !m.depthWrite)) throw new Error('Curtain folds must use opaque fabric depth, not sorted alpha blending');
      if (room.scene.fog.density < .02 || room.scene.fog.density > .04) throw new Error('Haze must stay subtle enough for clear photographic foreground contrast');
      if (!room.scene.getObjectByName('Tokyo apartment view')) throw new Error('Use the photographic Tokyo apartment backdrop');
      if (thickness < .1) throw new Error(`Curtain lost its simulated folds (${thickness}m thickness)`);
      const authoredWalls = [];
      room.scene.traverse(o => { if (o.isMesh)for(const material of [o.material].flat())if(material.name.startsWith('Poliigon_Plaster'))authoredWalls.push(material); });
      if (!authoredWalls.some(m => m.userData.poliigon_props?.scale === 3 && m.map?.name.endsWith('-color') && m.normalMap?.name.endsWith('-normal') && m.map.image.width >= 2048)) throw new Error('Preserve the authored 3x wall mapping in baked shader inputs');
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(1440, 900);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      const target = new THREE.WebGLRenderTarget(1440, 900);
      renderer.setRenderTarget(target);
      renderer.render(room.scene, room.camera);
      const before = new Uint8Array(1440 * 900 * 4);
      renderer.readRenderTargetPixels(target, 0, 0, 1440, 900, before);
      room.shade(renderer, target);
      const after = new Uint8Array(before.length);
      renderer.readRenderTargetPixels(target, 0, 0, 1440, 900, after);
      let contactPixels = 0;
      for (let i=0; i<before.length; i+=4) if (before[i] - after[i] > 3) contactPixels++;
      // Sample the plaster between the window and bookcase, away from the
      // bright window. Warmth should come through in the rendered materials.
      let wallRed = 0, wallBlue = 0;
      for (let y = 500; y < 700; y++) for (let x = 460; x < 700; x++) {
        const i = (y * 1440 + x) * 4;
        wallRed += after[i]; wallBlue += after[i + 2];
      }
      const light = room.scene.getObjectByName('Window sunlight');
      const beam = room.windowLight;
      document.querySelector('canvas').replaceWith(renderer.domElement);
      // Display the same postprocessed target used for the contact-shading check.
      const { FullScreenQuad } = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/Pass.js');
      const quad = new FullScreenQuad(new THREE.MeshBasicMaterial({ map: target.texture, toneMapped: false }));
      renderer.setRenderTarget(null); quad.render(renderer);
      return { thickness, contactPixels, wallWarmth: wallRed / wallBlue, sunlight: !!light?.castShadow && light.position.x > 4.7, beam: !!beam?.isShaderMaterial };
    });
    await page.screenshot({ path: '/tmp/japan-room-lighting.png' });
    assert.ok(result.contactPixels > 1000, 'Contact shadows should add visible depth');
    assert.ok(result.wallWarmth > .8 && result.wallWarmth < 1.4, 'Plaster should keep a natural daylight balance without a strong amber or blue cast');
    assert.equal(result.sunlight, true, 'Sunlight must enter from outside the window');
    assert.equal(result.beam, true, 'Window light should scatter softly through the room');
    assert.deepEqual(errors, []);
    console.log('PASS: folded curtains, window sunlight and shader shafts, rendered contact shadows', result);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
