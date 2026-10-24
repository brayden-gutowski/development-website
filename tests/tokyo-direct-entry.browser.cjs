const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:4173';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const requests = [], errors = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + ';window.exitPending=()=>roomIsLoading;window.canvasDiary=()=>activateRoomObject("diary");window.globeOrientation=()=>state.currentQuaternion.toArray();' });
    });
    await page.goto(`${base}/#Tokyo`);
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 30000 });
    assert.equal(await page.title(), 'Tokyo, Japan | Towski.dev');
    assert.equal(requests.some(url => /earth-|stars-\d|tokyo-flight|cloud-volume/.test(url)), false,
      'A shared Tokyo link must open the room without downloading the globe or flight');
    let releaseGlobe, globeRequested;
    const heldGlobe = new Promise(resolve => { releaseGlobe = resolve; });
    const startedGlobe = new Promise(resolve => { globeRequested = resolve; });
    await page.route('**/assets/earth-4096.webp', async route => {
      globeRequested(); await heldGlobe; await route.continue();
    });
    await page.getByRole('button', { name: 'Door · Return to globe', exact: true }).focus();
    await page.keyboard.press('Enter');
    await startedGlobe;
    await page.evaluate(() => window.canvasDiary());
    assert.equal(await page.locator('#diary-reader').isVisible(), false,
      'Canvas object actions must wait while the door prepares departure');
    await page.evaluate(() => { location.hash = '#tokyo/diary/table-of-contents'; });
    await page.locator('#diary-reader[data-phase="reading"]').waitFor();
    releaseGlobe();
    await page.waitForFunction(() => !window.exitPending());
    assert.equal(await page.locator('#app.is-in-room:not(.is-travelling)').count(), 1,
      'A newer diary link cancels departure while the globe downloads');
    await page.getByRole('button', { name: 'Put diary back', exact: true }).click();
    await page.locator('#diary-reader').waitFor({ state: 'hidden' });
    // Leaving must lazily load a usable globe, then allow normal travel back in.
    await page.getByRole('button', { name: 'Door · Return to globe', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor({ timeout: 30000 });
    const orientation = await page.evaluate(() => window.globeOrientation());
    await page.mouse.move(700, 500);
    await page.mouse.wheel(0, -100);
    const afterZoom = await page.evaluate(() => window.globeOrientation());
    assert.ok(Math.abs(orientation.reduce((sum, value, i) => sum + value * afterZoom[i], 0)) > .999,
      'The first zoom after direct entry must retain the Tokyo orientation');
    await page.getByRole('button', { name: /Nashville, Tennessee/ }).click();
    await page.getByRole('button', { name: 'Music Reviews', exact: true }).waitFor();
    assert.equal(requests.some(url => /earth-/.test(url)), true);
    await page.route('**/room-furniture.webp*', route => route.abort());
    await page.goto(`${base}/#tokyo`);
    await page.reload();
    await page.locator('.room-load-error').waitFor({ timeout: 60000 });
    assert.equal(await page.locator('#app.is-static-fallback').count(), 0,
      'A room download failure must keep the globe and Explore retry available');
    await page.unroute('**/room-furniture.webp*');
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 30000 });
    assert.deepEqual(errors, []);
    console.log('PASS: #Tokyo opens directly; the globe loads on exit and remains usable');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
