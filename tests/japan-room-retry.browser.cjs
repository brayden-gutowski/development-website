const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.windowVideoSources = [];
      const create = URL.createObjectURL.bind(URL);
      URL.createObjectURL = blob => {
        const source = create(blob);
        if (blob.type === 'video/mp4') window.windowVideoSources.push(source);
        return source;
      };
    });
    await page.route('**/room-furniture.png*', route => route.abort());
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    assert.match(await page.locator('#load-status').textContent(), /unavailable.*retry/i, 'A failed startup preload must report the failure instead of claiming the room is ready');
    await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('.room-load-error').waitFor({ timeout: 30000 });
    assert.equal(await page.locator('#tokyo-window-video').count(), 0, 'A failed lighting download must release the prepared video');
    assert.equal(await page.locator('#tokyo-record-track').count(), 0);
    assert.equal(await page.evaluate(async () => {
      const revoked = await Promise.all(window.windowVideoSources.map(async source => {
        try { await fetch(source); return false; } catch { return true; }
      }));
      return revoked.length > 0 && revoked.every(Boolean);
    }), true, 'Failed room construction must revoke every fully downloaded video source');
    await page.unroute('**/room-furniture.png*');
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 30000 });
    assert.equal(await page.locator('#tokyo-window-video').count(), 1);
    assert.equal(await page.locator('#tokyo-record-track').count(), 1);
    assert.deepEqual(errors, []);
    console.log('PASS: failed lighting load releases media, retry creates one working room');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
