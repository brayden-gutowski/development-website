const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
(async () => {
  const browser = await (process.env.TEST_BROWSER === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 663 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/?outline-motion', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"}}</script><body style="margin:0"></body>' }));
    await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4173') + '/?outline-motion');
    await page.evaluate(async () => {
      const T = await import('three'), { createJapanRoom } = await import('/japan-room.js');
      const room = await createJapanRoom(); room.setVisible(true, false);
      const renderer = new T.WebGLRenderer(); document.body.append(renderer.domElement);
      const gl = renderer.getContext(), source = gl.shaderSource.bind(gl);
      // Stress shader-readable depth at half-float precision independently of
      // accurate hardware depth, exposing fragile cross-pass comparisons.
      gl.shaderSource = (shader, text) => source(shader, text.replaceAll('gl_FragCoord.z', '(floor(gl_FragCoord.z * 2048.0 + 0.5) / 2048.0)'));
      document.querySelector('#tokyo-record-track').volume = 0;
      const play = document.createElement('button'); play.textContent = 'Play test record';
      play.onclick = () => { window.recordStarted = room.soundtrack.toggle(); }; document.body.append(play);
      window.outlineMotion = { T, room, renderer };
    });
    await page.getByRole('button', { name: 'Play test record', exact: true }).tap();
    assert.equal(await page.evaluate(() => window.recordStarted), true);
    const results = await page.evaluate(() => {
      const { T, room, renderer } = window.outlineMotion;
      const all = room.outline.selectedObjects.slice(), results = [];
      const arm = room.scene.getObjectByName('Cylinder005') || room.scene.getObjectByName('Cylinder.005');
      for (const ratio of [1.75, .96]) {
        renderer.setPixelRatio(ratio); renderer.setSize(393, 663); room.resize(393, 663, ratio);
        const target = room.outline.renderTargetMaskBuffer, w = target.width, h = target.height;
        const reference = new T.WebGLRenderTarget(w, h), actual = new Uint8Array(w * h * 4), expected = new Uint8Array(actual.length);
        const saved = [], materials = [];
        room.scene.traverse(object => {
          if (!object.isMesh) return;
          const original = object.material;
          const next = [original].flat().map(material => new T.MeshBasicMaterial({ fog: false, side: material.side, depthWrite: material.depthWrite, transparent: material.transparent, opacity: material.transparent ? 0 : 1 }));
          saved.push({ object, original, next }); materials.push(...next);
        });
        for (const action of ['music', 'curtains']) {
          const selected = all.filter(object => object.userData.roomAction === action);
          room.outline.selectedObjects = selected;
          if (action === 'curtains') room.toggleCurtains();
          let maxMismatch = 0, minVisible = Infinity, maxVisible = 0;
          const phases = new Set();
          for (let frame = 0; frame < 16; frame++) {
            room.point(Math.sin(frame / 6) * .45, Math.cos(frame / 8) * .3);
            for (let step = 0; step < 4; step++) room.update(1 / 30, false);
            if (action === 'music') phases.add(arm.userData.recordArm.phase);
            renderer.setRenderTarget(null); renderer.render(room.scene, room.camera);
            const backgroundBefore = room.scene.background, shadowsBefore = renderer.shadowMap.autoUpdate;
            room.outline.render(renderer, null, null, 0, false);
            if (renderer.getRenderTarget() !== null || room.scene.background !== backgroundBefore || renderer.shadowMap.autoUpdate !== shadowsBefore || saved.some(entry => entry.object.material !== entry.original)) {
              throw new Error('The contour pass must restore the room and renderer state');
            }
            renderer.readRenderTargetPixels(target, 0, 0, w, h, actual);
            // Independent visible-geometry reference, with ordinary hardware
            // depth tests and no outline shader or shader-readable depth.
            for (const entry of saved) {
              entry.next.forEach((material, i) => {
                const chosen = selected.includes(entry.object);
                material.color.set(chosen ? 0xffffff : 0);
                material.opacity = chosen || ![entry.original].flat()[i].transparent ? 1 : 0;
              });
              entry.object.material = Array.isArray(entry.original) ? entry.next : entry.next[0];
            }
            const background = room.scene.background; room.scene.background = new T.Color(0);
            renderer.setRenderTarget(reference); renderer.render(room.scene, room.camera);
            renderer.readRenderTargetPixels(reference, 0, 0, w, h, expected);
            room.scene.background = background; saved.forEach(entry => { entry.object.material = entry.original; });
            let mismatch = 0, visible = 0;
            for (let i = 0; i < actual.length; i += 4) {
              const shown = actual[i] < 128 && actual[i + 1] < 128;
              visible += shown; mismatch += shown !== (expected[i] > 128);
            }
            maxMismatch = Math.max(maxMismatch, mismatch); minVisible = Math.min(minVisible, visible); maxVisible = Math.max(maxVisible, visible);
          }
          results.push({ ratio, action, maxMismatch, minVisible, maxVisible, phases: [...phases] });
        }
        materials.forEach(material => material.dispose()); reference.dispose();
      }
      room.dispose(); renderer.dispose(); return results;
    });
    for (const result of results) {
      assert.ok(result.minVisible > 100, `Moving outlines must remain visible: ${JSON.stringify(result)}`);
      assert.ok(result.maxMismatch < 30, `Mobile outlines must follow visible moving geometry despite depth precision: ${JSON.stringify(result)}`);
    }
    assert.ok(results.find(result => result.action === 'music').phases.includes('swinging'), 'Exercise the actual moving record-player pickup');
    assert.deepEqual(errors, []);
    console.log('PASS: moving curtains and record player retain correct contours at full/reduced resolution with mobile depth precision', results);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
