const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 667, height: 375 }, reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:4173/#book-review/akai-sakana-to-kodomo');
    await page.locator('#book-reader[data-phase="reading"]').waitFor({ timeout: 60000 });
    assert.ok(await page.locator('.review-copy').evaluate(e => e.clientHeight >= 70), 'Keep a usable reading area below the compact heading');
    for (const selector of ['.review-navigation', '.review-close', '.review-page--right', '.review-floating-cover:not([hidden])']) {
      for (const element of await page.locator(selector).all()) {
        const bounds = await element.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 667 && bounds.y + bounds.height <= 375, `${selector} stays within a short landscape screen: ${JSON.stringify(bounds)}`);
      }
    }
    await page.getByRole('button', { name: 'Next book', exact: true }).click();
    await page.locator('#book-reader[data-phase="reading"][data-book="yaseuma"]').waitFor();
    await page.screenshot({ path: '/tmp/towski-review/book-landscape.png' });
    assert.ok(await page.locator('.review-vocabulary').evaluate(e => e.getBoundingClientRect().bottom < e.closest('.review-page').getBoundingClientRect().bottom - 10), 'Vocabulary stays inside the short page');
    await page.getByRole('button', { name: 'Put books back', exact: true }).click();
    await page.locator('#book-reader').waitFor({ state: 'hidden' });
    console.log('PASS: landscape paper, navigation, waiting covers and close control remain visible and usable');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
