// A stalled optional asset must never trap a visitor at “Preparing room…”.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const file of ['manifest.json', '9.webp', 'cloud-volume.bin.gz']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.route(`**/assets/tokyo-flight/${file}*`, () => {});
      await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
      await page.locator('#loading-screen').waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
      await page.getByRole('button', { name: 'Explore', exact: true }).click();
      await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 20000 });
      assert.equal(await page.locator('#city-flight').getAttribute('data-ready'), file === '9.webp' ? 'true' : null);
      assert.equal(await page.getByRole('button', { name: 'Books · Japanese Books' }).isEnabled(), true);
      await page.close();
      console.log(`PASS: stalled ${file} opens the room with available imagery or the globe fallback`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
