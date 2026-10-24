const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const nativeFrame = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => nativeFrame(time => {
        if (window.slowFrames) setTimeout(() => callback(performance.now()), window.slowFrames);
        else callback(time);
      });
    });
    await page.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + `;window.renderProbe=()=>({ratio:renderer.getPixelRatio(),width:glassTarget.width,height:glassTarget.height,depthWidth:japanRoom.windowLight.uniforms.tDepth.value.image.width,outlineWidth:japanRoom.outline.renderTargetMaskBuffer.width});` });
    });
    await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4173') + '/#tokyo');
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 60000 });
    const initial = await page.evaluate(() => window.renderProbe());
    assert.ok(initial.width * initial.height <= 2100000, 'High-DPI desktops must stay within a 1080p rendering budget');
    await page.evaluate(() => { window.slowFrames = 40; });
    await page.waitForFunction(ratio => window.renderProbe().ratio < ratio * .9, initial.ratio, { timeout: 15000 });
    const adapted = await page.evaluate(() => window.renderProbe());
    assert.equal(adapted.depthWidth, adapted.width, 'Depth effects must resize with the scene');
    assert.equal(adapted.outlineWidth, adapted.width, 'Clickable outlines must resize with the scene');
    await page.evaluate(() => { window.slowFrames = 1100; });
    await page.waitForFunction(ratio => window.renderProbe().ratio < ratio * .9, adapted.ratio, { timeout: 20000 });
    await page.evaluate(() => { window.slowFrames = false; });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForFunction(() => window.renderProbe().width <= 1280 * 1.3);
    await page.getByRole('button', { name: 'Diary · Japanese Blog', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.locator('#diary-reader[data-phase="reading"]').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: bounded high-DPI rendering adapts to slow frames, keeps depth/contours aligned, and preserves the reader', { initial, adapted });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
