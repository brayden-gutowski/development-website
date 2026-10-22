const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const { PNG } = require('pngjs');
(async () => {
  const browser = await (process.env.TEST_BROWSER === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 660 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + ';window.mobileRoom = () => japanRoom;' });
    });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 60000 });
    const frame = PNG.sync.read(await page.screenshot({ path: '/tmp/mobile-room-render-verified.png' }));
    let chromaStep = 0;
    for (let x = Math.round(frame.width * .25); x < frame.width * .75; x++) {
      for (let y = Math.round(frame.height * .08); y < frame.height * .23; y++) {
        const a = (y * frame.width + x) * 4, b = a + frame.width * 4;
        for (const c of [1, 2]) chromaStep = Math.max(chromaStep, Math.abs((frame.data[a+c]-frame.data[a])-(frame.data[b+c]-frame.data[b])));
      }
    }
    assert.ok(chromaStep <= 6, `Ceiling illumination must have a smooth color gradient rather than colored contour bands: ${chromaStep}`);
    const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() => mobileRoom().windowLight.visible = false);
    await paint();
    const sun = PNG.sync.read(await page.screenshot());
    await page.evaluate(() => mobileRoom().scene.getObjectByName('Window sunlight').intensity = 0);
    await paint();
    const shade = PNG.sync.read(await page.screenshot());
    let directLight = 0, samples = 0;
    for (let y = Math.round(frame.height * .89); y < frame.height * .92; y++) {
      for (let x = Math.round(frame.width * .25); x < frame.width * .75; x++) {
        const i = (y * frame.width + x) * 4;
        for (const c of [0, 1, 2]) { directLight += Math.abs(sun.data[i+c] - shade.data[i+c]); samples++; }
      }
    }
    directLight /= samples;
    assert.ok(directLight < 2, `The foreground floor is blocked from window sunlight; the shadow map must cover it instead of leaving a bright rectangle: ${directLight}`);
    assert.deepEqual(errors, []);
    console.log('PASS: smooth mobile ceiling illumination', { chromaStep });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
