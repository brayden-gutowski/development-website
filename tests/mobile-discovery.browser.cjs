const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requests.push({url:r.url(),at:Date.now()}));
    await page.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + `;window.touchRoom = () => japanRoom;window.touchBackgroundStarted=()=>backgroundAreasStarted;new MutationObserver(()=>{if(ui.loading.classList.contains('is-complete'))window.touchForegroundReadyAt ||=Date.now();}).observe(ui.loading,{attributes:true,attributeFilter:['class']});` });
    });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.waitForFunction(()=>touchBackgroundStarted());
    const foregroundReadyAt=await page.evaluate(()=>touchForegroundReadyAt);
    assert.ok(requests.filter(({url})=>/JapanRoom|diary-reader|book-reader|tokyo-flight|tokyo-window/.test(url)).every(({at})=>at>=foregroundReadyAt), 'Background Tokyo preparation starts after the globe becomes usable');
    await page.mouse.move(5,5);
    await page.locator('[data-location="tokyo"]').blur();
    assert.equal(await page.locator('[data-location="tokyo"]').evaluate(e => getComputedStyle(e).outlineStyle), 'none', 'Persistent outlines belong only to the room props');
    assert.equal(await page.locator('.wordmark').evaluate(e => getComputedStyle(e).outlineStyle), 'none', 'The home wordmark must not have a permanent border');
    await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 60000 });
    const selected = () => page.evaluate(() => [...new Set(touchRoom().outline.selectedObjects.map(o => o.userData.roomAction).filter(Boolean))].sort());
    const actions = ['books', 'curtains', 'diary', 'door', 'music'];
    assert.deepEqual(await selected(), actions, 'All five actions need persistent outlines without hover');
    await page.evaluate(() => { touchRoom().highlight('books'); touchRoom().highlight(null); });
    assert.deepEqual(await selected(), actions, 'Clearing hover must retain mobile discovery');
    await page.screenshot({ path: '/tmp/towski-mobile-outlines.png' });
    await page.getByRole('button', { name: 'Books · Japanese Books', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.locator('#book-reader[data-phase="reading"]').waitFor();
    await page.getByRole('button', { name: 'Left page', exact: true }).waitFor();
    assert.deepEqual(await selected(), [], 'Room outlines yield to the active reader');
    await page.screenshot({ path: '/tmp/towski-mobile-book-right.png' });
    await page.getByRole('button', { name: 'Left page', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.review-page--left').getBoundingClientRect().left >= 0);
    await page.screenshot({ path: '/tmp/towski-mobile-book-left.png' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('.review-book-surface').dispatchEvent('pointerdown', { pointerId: 8, button: 0, clientX: 100, clientY: 400 });
    await page.locator('.review-book-surface').dispatchEvent('pointerup', { pointerId: 8, button: 0, clientX: 220, clientY: 400 });
    await page.locator('#book-reader[data-phase="reading"][data-book="maru-megane-ryoubo-san"]').waitFor();
    await page.waitForFunction(() => {
      const root=document.querySelector('#book-reader'),rect=root.querySelector('.review-page--left').getBoundingClientRect();
      return root.dataset.pageSide==='left' && rect.left>=0 && rect.right<=innerWidth;
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Put books back', exact: true }).click();
    assert.deepEqual(await selected(), actions, 'Discovery returns when the book closes');
    assert.deepEqual(errors, []);
    console.log('PASS: foreground-first background Tokyo preparation, only five room contours, and reader suppression');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
