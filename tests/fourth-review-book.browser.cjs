const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:4173';

// A fourth report must create its own binding and stay selectable without
// colliding with the other waiting covers, including on short phone screens.
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 667, height: 375 }]) {
      const page = await browser.newPage({ viewport, reducedMotion: viewport.width === 1440 ? 'no-preference' : 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error' && /room could not load/.test(message.text())) errors.push(message.text());
      });
      await page.route('**/script.js*', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + ';window.reviewRoom = () => japanRoom;' });
      });
      await page.goto(base + '/#tokyo/books/tsumikko');
      const reader = page.locator('#book-reader[data-phase="reading"][data-book="tsumikko"]');
      try { await reader.waitFor({ timeout: 30000 }); }
      catch (error) { assert.fail(`Fourth report could not open: ${errors.join('\n') || error.message}`); }
      assert.equal(await page.evaluate(() => reviewRoom().reviewBooks.length), 4);
      assert.equal(await reader.locator('.review-count').innerText(), '4 / 4');
      assert.equal(await reader.locator('.review-stars').getAttribute('aria-label'), '4 out of 5 stars');
      assert.match(await reader.locator('.review-copy').innerText(), /来週、つみっこを作ろうと思います。/);
      assert.equal(await reader.locator('.review-vocabulary .diary-word').count(), 7);
      assert.ok(await reader.locator('.review-cover-art img').evaluate(image => image.complete && image.naturalWidth === 881));
      const covers = reader.locator('.review-floating-cover:not([hidden])');
      assert.equal(await covers.count(), 3);
      const bounds = [];
      for (const cover of await covers.all()) {
        const box = await cover.boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, 'Every waiting cover fits the viewport');
        for (const other of bounds) assert.ok(box.x + box.width <= other.x || other.x + other.width <= box.x || box.y + box.height <= other.y || other.y + other.height <= box.y, 'Waiting covers do not overlap');
        bounds.push(box);
      }
      await reader.getByRole('button', { name: 'Next book', exact: true }).click();
      await page.locator('#book-reader[data-phase="reading"][data-book="akai-sakana-to-kodomo"]').waitFor();
      const fourthCover = await page.getByRole('button', { name: 'Open つみっこ', exact: true }).boundingBox();
      await page.mouse.click(fourthCover.x + fourthCover.width / 2, fourthCover.y + fourthCover.height / 2);
      await reader.waitFor();
      await page.screenshot({ path: `/tmp/fourth-review-${viewport.width}.png` });
      await reader.getByRole('button', { name: 'Put books back', exact: true }).click();
      await page.locator('#book-reader').waitFor({ state: 'hidden' });
      assert.ok(await page.evaluate(() => reviewRoom().reviewBooks.every(book => book.object.visible && book.object.userData.frontAngle < .01)));
      if (viewport.width === 1440) await page.screenshot({ path: '/tmp/fourth-review-shelf.png' });
      assert.deepEqual(errors, []);
      await page.close();
    }
    const music = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await music.goto(base + '/#nashville');
    await music.locator('#loading-screen').waitFor({ state: 'hidden' });
    await music.getByRole('button', { name: 'Music Reviews', exact: true }).click();
    const album = music.locator('[data-music-review="goblin-food"]');
    await album.locator('summary').click();
    await album.locator('.music-review__description').waitFor({ state: 'visible' });
    assert.equal(await album.locator('.music-review__rating').innerText(), '9.5/10');
    await album.locator('img').evaluate(image => image.decode());
    assert.equal(await album.locator('img').evaluate(image => image.naturalWidth), 447);
    assert.match(await album.locator('.music-review__description').innerText(), /it might just be my favorite album of the year\.$/);
    await music.screenshot({ path: '/tmp/goblin-food-review.png' });
    await music.close();
    console.log('PASS: fourth binding, direct link, cover, rating, vocabulary, navigation, viewport fit and shelf return');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
