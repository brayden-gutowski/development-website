const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/script.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.evaluate(async () => {
      document.querySelector('#loading-screen').remove();
      const { createBookReader } = await import('/book-reader.js');
      const { createDiaryReader } = await import('/diary-reader.js');
      const entry = { id: 'sample', title: '読み物', image: 'assets/BookCover.webp', imageAlt: 'Cover', dateTime: '2026-10-23', date: '2026 / 10 / 23', rating: 4, body: ['日本語の文章。'.repeat(80)], glossary: [['本', 'book']], media: [{ src: 'assets/BookCover.webp', label: 'Photo' }] };
      window.testBook = createBookReader({ entries: [entry, { ...entry, id: 'second' }], getRoom: () => null, onBook() {}, onClose() {} });
      window.testDiary = createDiaryReader({ categories: [{ id: 'test', entries: [entry] }], getRoom: () => null, onPage() {}, onClose() {} });
      await testBook.open(null, true);
    });
    const fit = async selector => {
      await page.waitForFunction(selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
      }, selector);
      const bounds = await page.locator(selector).boundingBox();
      const viewport = page.viewportSize();
      assert.ok(bounds && bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, `${selector} fits ${JSON.stringify(viewport)}: ${JSON.stringify(bounds)}`);
    };
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.waitForFunction(width => innerWidth === width, viewport.width);
      await page.evaluate(() => testBook.resize());
      await fit('#book-reader .review-page--right');
      await page.getByRole('button', { name: 'Left page', exact: true }).click();
      await fit('#book-reader .review-page--left');
      assert.equal(await page.locator('#book-reader .review-page--right').evaluate(e => e.inert), true);
      await page.getByRole('button', { name: 'Right page', exact: true }).click();
      await page.getByRole('button', { name: 'Next book', exact: true }).click();
      assert.equal(await page.locator('#book-reader').getAttribute('data-book'), viewport.width === 320 ? 'sample' : 'second');
    }
    await page.getByRole('button', { name: 'Put books back', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => testDiary.open({ entryId: 'sample', categoryId: 'test' }, true));
    assert.ok(await page.locator('.diary-book').evaluate(e => parseFloat(getComputedStyle(e).transitionDuration) <= .001), 'Mobile page slides honor reduced motion');
    await fit('#diary-reader .diary-page--right');
    await page.getByRole('button', { name: 'Left page', exact: true }).click();
    await page.waitForTimeout(400);
    await fit('#diary-reader .diary-page--left');
    assert.equal(await page.locator('#diary-reader .diary-page--right').evaluate(e => e.inert), true);
    await page.getByRole('button', { name: 'Right page', exact: true }).click();
    await page.getByRole('button', { name: 'Put diary back', exact: true }).click();
    assert.equal(await page.locator('#diary-reader').isHidden(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: mobile readers fit a page with accessible left/right navigation on small phones and landscape');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
