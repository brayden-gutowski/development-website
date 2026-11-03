const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type.startsWith('webgl') ? null : getContext.call(this, type, ...args);
      };
    });
    await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4173') + '/#tokyo/books/tsumikko');
    await page.locator('#app.is-static-fallback').waitFor();
    await page.locator('#book-reader[data-phase="reading"][data-book="tsumikko"]').waitFor();
    assert.equal(await page.locator('.review-count').innerText(), '4 / 4');
    await page.getByRole('button', { name: 'Next book', exact: true }).click();
    await page.locator('#book-reader[data-book="akai-sakana-to-kodomo"]').waitFor();
    await page.getByRole('button', { name: 'Put books back', exact: true }).click();
    await page.evaluate(() => { location.hash = '#tokyo/diary/table-of-contents'; });
    await page.locator('#diary-reader[data-phase="reading"]').waitFor();
    assert.ok(await page.locator('.diary-toc-entry').count() > 0);
    await page.locator('.diary-toc-entry').first().click();
    assert.ok((await page.locator('.diary-copy').innerText()).length > 20);
    await page.getByRole('button', { name: 'Put diary back', exact: true }).click();
    await page.getByRole('button', { name: /Nashville, Tennessee/ }).click();
    await page.getByRole('button', { name: 'Music Reviews', exact: true }).click();
    await page.locator('[data-music-review="goblin-food"]').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: canonical book/diary readers and music remain usable without WebGL');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
