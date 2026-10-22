const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.route('**/assets/tokyo-window-*.mp4*', r => r.fulfill({ status: 503, body: '' }));
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    // Finish startup before loading the isolated geometry fixture.
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const result = await page.evaluate(async () => {
      const T = await import('three');
      const { createJapanRoom } = await import('/japan-room.js');
      const room = await createJapanRoom();
      room.resize(640, 400); room.setVisible(true, false);
      const exterior = room.scene.getObjectByName('Tokyo exterior');
      const scene = new T.Scene(); scene.add(exterior);
      const renderer = new T.WebGLRenderer(); renderer.setSize(640, 400);
      const target = new T.WebGLRenderTarget(640, 400);
      const frame = () => {
        renderer.setRenderTarget(target); renderer.render(scene, room.camera);
        const pixels = new Uint8Array(640 * 400 * 4);
        renderer.readRenderTargetPixels(target, 0, 0, 640, 400, pixels); return pixels;
      };
      const difference = (a, b) => {
        let sum = 0;
        for (let i = 0; i < a.length; i++) if (i % 4 !== 3) sum += Math.abs(a[i] - b[i]);
        return sum / (640 * 400 * 3);
      };
      const first = frame();
      for (let i = 0; i < 300; i++) room.update(.1, false);
      const moving = frame();
      for (let i = 0; i < 300; i++) room.update(.1, true);
      const frozen = frame();
      room.setVisible(false, false);
      for (let i = 0; i < 300; i++) room.update(.1, false);
      const hidden = frame();
      const result = { moving: difference(first, moving), reducedMotion: difference(moving, frozen), hidden: difference(frozen, hidden) };
      room.scene.add(exterior); room.dispose(); target.dispose(); renderer.dispose();
      return result;
    });
    assert.ok(result.moving > .05 && result.moving < 8, 'Outdoor fog should visibly drift very gently over a stationary photograph');
    assert.equal(result.reducedMotion, 0, 'Reduced motion freezes outdoor fog');
    assert.equal(result.hidden, 0, 'Leaving the room stops outdoor fog animation');
    console.log('PASS: gentle moving outdoor fog, frozen with reduced motion and outside the room', result);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
