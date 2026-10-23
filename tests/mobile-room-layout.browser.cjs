const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
(async () => {
  const browser = await (process.env.TEST_BROWSER === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
  try {
    for (const [width, height] of [[393, 660], [390, 844], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4173') + '/#book-review/yaseuma');
      await page.locator('#book-reader[data-phase="reading"]').waitFor({ timeout: 60000 });
      for (const selector of ['.review-page--right', '.review-navigation', '.review-close', '#book-reader .reader-page-sides']) {
        const b = await page.locator(selector).boundingBox();
        assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height, `${width}×${height}: ${selector} must fit: ${JSON.stringify(b)}`);
      }
      const copy = page.locator('.review-copy');
      assert.ok(await copy.evaluate(e => e.clientHeight >= 70 && parseFloat(getComputedStyle(e).fontSize) >= 11.5), 'Keep readable review text and a usable scrolling area');
      for (const selector of ['.review-copy', '.review-page--left']) {
        const side=selector.endsWith('--left')?'Left page':'Right page';
        await page.getByRole('button', { name: side, exact: true }).click();
        await page.waitForFunction(selector=>document.querySelector(selector).getBoundingClientRect().left>=0,selector);
        const scroller = page.locator(selector);
        const bounds=await scroller.boundingBox();
        assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width, `${selector} fits its selected side`);
        if (await scroller.evaluate(e => e.scrollHeight > e.clientHeight + 1)) {
          assert.equal(await scroller.getAttribute('tabindex'), '0', 'Overflowing pages must be keyboard-focusable in Safari');
          await scroller.focus();
          await page.keyboard.press('PageDown');
          await page.waitForFunction(selector => document.querySelector(selector).scrollTop > 0, selector);
        }
      }
      await page.getByRole('button', { name: 'Put books back', exact: true }).focus();
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => document.activeElement.closest('#book-reader') && !document.activeElement.closest('[inert]')), 'The dialog focus trap stays on the selected page and shared controls');
      await page.getByRole('button', { name: 'Right page', exact: true }).click();
      await page.getByRole('button', { name: 'Next book', exact: true }).click();
      await page.locator('#book-reader[data-phase="reading"][data-book="maru-megane-ryoubo-san"]').waitFor();
      await page.screenshot({ path: `/tmp/mobile-book-${width}-verified.png` });
      await page.getByRole('button', { name: 'Put books back', exact: true }).click();
      await page.locator('#book-reader').waitFor({ state: 'hidden' });
      await page.close();
    }
    console.log('PASS: both phone book pages, readable scrolling text, navigation and close fit 320–393px screens');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
