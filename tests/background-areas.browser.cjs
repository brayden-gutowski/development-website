const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    const failedRequests = [];
    page.on('requestfailed', request => failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
    page.on('request', request => requests.push({ url: request.url(), at: Date.now() }));
    let releaseGlobe, releaseRoom, flightManifestAttempts=0;
    await page.route('**/tokyo-flight/manifest.json*', route => ++flightManifestAttempts===1 ? route.abort() : route.continue());
    const globe = new Promise(resolve => { releaseGlobe = resolve; });
    const room = new Promise(resolve => { releaseRoom = resolve; });
    await page.route(/assets\/earth-(?:2048|4096)\.webp/, async route => { await globe; await route.continue(); });
    await page.route('**/GainesvilleRoom.glb*', async route => { await room; await route.continue(); });
    await page.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + `
        window.retryFlight=()=>loadCityFlight('tokyo',{activate:false});
        window.backgroundProbe=()=>({location:roomLocationId,visible:roomIsVisible,selected:state.selectedId,
          quaternion:state.currentQuaternion.toArray(), zoom:state.zoomProgress, camera:activeRoom()?.camera.position.toArray()});
        new MutationObserver(()=>{if(ui.loading.classList.contains('is-complete'))window.foregroundReadyAt ||= Date.now();})
          .observe(ui.loading,{attributes:true,attributeFilter:['class']});
      ` });
    });
    await page.goto(`${base}/#tokyo`);
    try { await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 60000 }); }
    catch (error) { console.log('Foreground startup:', await page.locator('#loading-screen').innerText(), { failedRequests, errors }); throw error; }
    await page.getByRole('button', { name: 'Door · Return to globe', exact: true }).focus();
    const baseline = await page.evaluate(() => ({ state: backgroundProbe(), focus: document.activeElement.outerHTML, title: document.title, url: location.href }));
    const globeNotice = page.locator('.area-load[data-area="globe"]');
    await globeNotice.waitFor({ timeout: 15000 });
    try { await page.waitForFunction(() => /\d+ of \d+ assets/.test(document.querySelector('.area-load[data-area="globe"] .area-load__detail')?.textContent), null, {timeout: 15000}); }
    catch (error) { console.log({ notices: await page.locator('#area-loads').textContent(), failedRequests, requests: requests.filter(r => /earth-/.test(r.url)), errors }); throw error; }
    assert.equal(await page.locator('.area-load[data-area="gainesville"]').getAttribute('data-state'), 'waiting');
    assert.equal(requests.some(r => /GainesvilleRoom\.glb/.test(r.url)), false, 'Only one background area downloads at a time');
    const during = await page.evaluate(() => ({ state: backgroundProbe(), focus: document.activeElement.outerHTML, title: document.title, url: location.href, readyAt: foregroundReadyAt }));
    assert.ok(requests.filter(r => /earth-(?:2048|4096)/.test(r.url)).every(r => r.at >= during.readyAt));
    assert.deepEqual(during.state, baseline.state);
    assert.equal(during.focus, baseline.focus);
    assert.equal(during.title, baseline.title);
    assert.equal(during.url, baseline.url);
    assert.equal(await page.locator('#loading-screen').isVisible(), false);
    assert.equal(await page.locator('#area-load-announcement').getAttribute('aria-live'), 'polite');
    releaseGlobe();
    const other = page.locator('.area-load[data-area="gainesville"]');
    await page.waitForFunction(() => document.querySelector('.area-load[data-area="gainesville"]')?.dataset.state === 'loading', null, { timeout: 60000 });
    await globeNotice.waitFor({ state: 'detached', timeout: 10000 });
    await page.screenshot({ path: '/private/tmp/towski-background-areas.png' });
    const top = await other.evaluate(el => el.getBoundingClientRect().top);
    assert.ok(top < 30, 'The next notice moves into the vacated top-left slot');
    assert.deepEqual(await page.evaluate(() => backgroundProbe()), baseline.state, 'Constructing the background globe preserves the active room camera and navigation');
    const preserved = await page.evaluate(() => { const state = backgroundProbe(); return { location: state.location, selected: state.selected, visible: state.visible, focus: document.activeElement.outerHTML }; });
    assert.deepEqual(preserved, { location: 'tokyo', selected: 'tokyo', visible: true, focus: baseline.focus });
    await page.setViewportSize({ width: 320, height: 568 });
    assert.ok(await other.evaluate(el => el.getBoundingClientRect().right <= innerWidth));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await other.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    releaseRoom();
    await other.waitFor({ state: 'detached', timeout: 60000 });
    assert.equal(requests.filter(r => /GainesvilleRoom\.glb/.test(r.url)).length, 1);
    assert.equal(await page.evaluate(async()=>!!await retryFlight()),true,'Optional flight imagery retries after a failed background download');
    assert.equal(flightManifestAttempts,2,'A null flight result must not remain cached');
    assert.deepEqual(errors, []);
    await page.close();

    const gainesville = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    gainesville.on('pageerror', error => errors.push(error.message));
    let failGlobe = true, releaseTokyo;
    const tokyo = new Promise(resolve => { releaseTokyo = resolve; });
    await gainesville.route(/assets\/earth-(?:2048|4096)\.webp/, route => failGlobe ? route.abort() : route.continue());
    await gainesville.route('**/JapanRoom.glb*', async route => { await tokyo; await route.continue(); });
    await gainesville.goto(`${base}/#gainesville`);
    await gainesville.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 60000 });
    await gainesville.locator('.area-load[data-area="globe"][data-state="error"]').waitFor({ timeout: 15000 });
    assert.match(await gainesville.locator('.area-load[data-area="globe"] .area-load__detail').textContent(), /retry/);
    assert.equal(await gainesville.locator('#app.is-in-room:not(.is-travelling)').count(), 1, 'Background failure leaves Gainesville usable');
    failGlobe = false;
    await gainesville.getByRole('button', { name: 'Exit sign · Return to globe', exact: true }).focus();
    await gainesville.keyboard.press('Enter');
    await gainesville.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor({ timeout: 30000 });
    releaseTokyo();
    await gainesville.locator('#area-loads:empty').waitFor({ state: 'attached', timeout: 60000 });
    assert.equal(await gainesville.locator('#app.is-static-fallback').count(), 0, 'A failed background globe can retry through foreground navigation');
    await gainesville.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await gainesville.getByRole('button', { name: 'Explore', exact: true }).click();
    await gainesville.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 15000 });
    assert.deepEqual(errors, []);
    console.log('PASS: sequential background areas, genuine progress, queue dismissal, stable room/focus/URL, mobile/reduced motion and failure recovery');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
