const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let releaseModel, releasePages;
    const model = new Promise(resolve => { releaseModel = resolve; });
    const pages = new Promise(resolve => { releasePages = resolve; });
    await page.route('**/JapanRoom.glb*', async route => { await model; await route.continue(); });
    await page.route('**/KleeOne-Regular.woff2', async route => { await pages; await route.continue(); });
    await page.addInitScript(() => {
      window.loadingValues = []; window.loadingMessages = [];
      new MutationObserver(() => {
        const bar = document.querySelector('.progress-track[role="progressbar"]');
        if (bar) window.loadingValues.push(Number(bar.getAttribute('aria-valuenow')));
        const message = document.querySelector('#load-status')?.textContent;
        if (message) window.loadingMessages.push(message);
      }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-valuenow'] });
    });
    await page.goto(`${base}/#Tokyo`);
    const progress = page.getByRole('progressbar', { name: 'Scene loading progress' });
    await progress.waitFor({ timeout: 15000 });
    assert.equal(await page.locator('#load-status').evaluate(el => el.closest('[aria-busy="true"]') === null), true,
      'Loading announcements must not be deferred by a busy ancestor');
    await page.waitForFunction(() => /[1-9]\d* of \d+ assets ready/.test(document.querySelector('#load-detail')?.textContent), null, { timeout: 30000 });
    assert.equal(await page.locator('#loading-screen').getAttribute('data-stage'), 'download');
    const pending = Number(await progress.getAttribute('aria-valuenow'));
    assert.ok(pending > 8 && pending < 70, 'Asset completions advance the download stage before the large model finishes');
    const shimmer = () => page.locator('.progress-track').evaluate(el => {
      const style = getComputedStyle(el, '::after'); return { transform: style.transform, animation: style.animationName };
    });
    const first = await shimmer();
    await page.waitForTimeout(250);
    assert.notEqual((await shimmer()).transform, first.transform, 'A held download must still look active');
    await page.screenshot({ path: '/private/tmp/towski-loader-download.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal((await shimmer()).animation, 'none', 'Reduced motion disables the moving highlight while loading');
    await page.setViewportSize({ width: 320, height: 568 });
    assert.ok(await page.locator('.loading-screen__content').evaluate(el => el.getBoundingClientRect().right <= innerWidth));
    await page.screenshot({ path: '/private/tmp/towski-loader-mobile.png' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1280, height: 800 });
    releaseModel();
    await page.waitForFunction(() => document.querySelector('#loading-screen')?.dataset.stage === 'prepare', null, { timeout: 30000 });
    assert.match(await page.locator('#load-status').textContent(), /books and diary/i);
    assert.ok(Number(await progress.getAttribute('aria-valuenow')) < 100, 'Reader preparation must finish before progress reaches 100');
    releasePages();
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 60000 });
    const result = await page.evaluate(() => ({ values: loadingValues, messages: [...new Set(loadingMessages)] }));
    assert.ok(result.values.every((n, i, values) => !i || n >= values[i - 1]), 'Displayed progress must never move backward');
    assert.equal(result.values.at(-1), 100);
    assert.ok(result.messages.some(text => /lighting/i.test(text)), 'The loader reports preparation after downloads');
    assert.equal(await page.locator('#app.is-in-room:not(.is-travelling)').count(), 1);
    await page.unrouteAll();
    await page.reload();
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 30000 });
    assert.equal(await page.locator('#app.is-in-room:not(.is-travelling)').count(), 1, 'Fast repeat startup also completes');
    assert.deepEqual(errors, []);
    console.log('PASS: real asset/stage progress, visible activity during stalls, monotonic completion, fast startup, phone layout and reduced motion');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
