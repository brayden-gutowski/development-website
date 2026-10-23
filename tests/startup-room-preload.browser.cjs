// A slow Tokyo download must not block the globe; Explore still waits for preparation.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await page.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + `
        window.preloadProbe = () => ({
          ready: !!japanRoom && !!window.preloadRoomReady,
          programs: renderer?.info.programs.map(program => program.id) || [],
          roomDraws: window.preloadRoomDraws || 0,
          videoPaused: document.querySelector('#tokyo-window-video')?.paused,
          audioPaused: document.querySelector('#tokyo-record-track')?.paused,
          readersHidden: diaryReader && bookReader && document.querySelector('#diary-reader').hidden && document.querySelector('#book-reader').hidden,
        });
        const preloadLoadRoom = loadJapanRoom;
        loadJapanRoom = (...args) => preloadLoadRoom(...args).then(room => {
          window.preloadRoomReady = true;
          if (!room.scene.userData.preloadObserved) {
            room.scene.userData.preloadObserved = true;
            const before = room.scene.onBeforeRender;
            room.scene.onBeforeRender = (...args) => { window.preloadRoomDraws = (window.preloadRoomDraws || 0) + 1; before.apply(room.scene, args); };
          }
          return room;
        });
        new MutationObserver(() => {
          if (!window.startupComplete && ui.loading.classList.contains('is-complete')) {
            window.startupComplete = { ...window.preloadProbe(), ms: performance.now() };
          }
        }).observe(ui.loading, { attributes: true, attributeFilter: ['class'] });
      ` });
    });
    let releaseRoom;
    const roomDownload = new Promise(resolve => { releaseRoom = resolve; });
    await page.route('**/JapanRoom.glb*', async route => {
      await roomDownload;
      await route.continue();
    });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 15000 });
    const startup = await page.evaluate(() => window.startupComplete);
    console.log('Cold startup:', { ...startup, programs: startup.programs.length });
    assert.equal(startup.ready, false, 'The globe must become usable while Tokyo is still downloading');
    await page.getByRole('button', { name: /Nashville, Tennessee/ }).click();
    await page.getByRole('button', { name: 'Music Reviews', exact: true }).waitFor();
    await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
    releaseRoom();
    await page.waitForFunction(() => window.preloadProbe().ready, null, { timeout: 60000 });
    const prepared = await page.evaluate(() => window.preloadProbe());
    assert.equal(prepared.readersHidden, true, 'Prepared reader pages stay hidden on the globe');
    assert.equal(prepared.videoPaused, true, 'Preloading must not play the hidden room video');
    assert.equal(prepared.audioPaused, true, 'Preloading must not play room audio');

    const requestCount = requests.length;
    const idle = await page.evaluate(() => window.preloadProbe());
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.preloadProbe().roomDraws), idle.roomDraws, 'A ready room must stop rendering while the globe is idle');
    const start = await page.evaluate(() => performance.now());
    await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await page.evaluate(() => {
      document.querySelector('[data-explore]').addEventListener('click', () => {
        window.preloadExploreAt = performance.now();
      }, { capture: true, once: true });
      const app = document.querySelector('#app');
      new MutationObserver((_, observer) => {
        if (app.classList.contains('is-travelling')) {
          window.preloadTravelAt = performance.now();
          observer.disconnect();
        }
      }).observe(app, { attributes: true, attributeFilter: ['class'] });
    });
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 30000 });
    const arrival = await page.evaluate(start => ({
      ...window.preloadProbe(), ms: performance.now() - start,
      exploreToTravelMs: window.preloadTravelAt - window.preloadExploreAt,
      stages: performance.getEntriesByType('measure').map(entry => ({ name: entry.name, ms: Math.round(entry.duration), ...entry.detail })),
      bytes: performance.getEntriesByType('resource').reduce((sum, entry) => sum + entry.encodedBodySize, 0),
    }), start);
    const newPrograms = arrival.programs.filter(id => !idle.programs.includes(id));
    const newRequests = requests.slice(requestCount);
    console.log('Prepared arrival:', { ms: arrival.ms, exploreToTravelMs: arrival.exploreToTravelMs, newPrograms, newRequests, stages: arrival.stages, bytes: arrival.bytes });
    assert.deepEqual(newPrograms, [], 'Explore must reuse shaders already prepared after Tokyo selection');
    // Chrome may revalidate the tab icon after a History API URL change.
    const newSceneRequests = newRequests.filter(url => !url.includes('/assets/towski-dev-logo.png'));
    assert.deepEqual(newSceneRequests, [], 'Explore must reuse prepared scene and media assets');
    assert.ok(arrival.exploreToTravelMs < 100, 'A prepared Explore click must start travel within 100ms');
    assert.deepEqual(errors, []);
    await page.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    let startedDownload;
    const downloadStarted = new Promise(resolve => { startedDownload = resolve; });
    let releaseMobileRoom;
    const mobileRoomDownload = new Promise(resolve => { releaseMobileRoom = resolve; });
    await mobile.route('**/JapanRoom.glb*', async route => {
      startedDownload();
      await mobileRoomDownload;
      await route.continue();
    });
    await mobile.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + ';window.preloadRoomAspect = () => japanRoom?.camera.aspect;' });
    });
    await mobile.goto((process.env.TEST_URL || 'http://127.0.0.1:4173') + '/#book-review/yaseuma');
    await downloadStarted;
    await mobile.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 15000 });
    await mobile.setViewportSize({ width: 430, height: 932 });
    releaseMobileRoom();
    await mobile.locator('#book-reader[data-phase="reading"][data-book="yaseuma"]').waitFor({ timeout: 60000 });
    assert.equal(await mobile.evaluate(() => window.preloadRoomAspect()), 430 / 932, 'A viewport change during startup must reach the prepared room camera');
    assert.equal(await mobile.locator('#app.is-in-room:not(.is-travelling)').count(), 1, 'A reduced-motion direct link must open its review in the prepared room');
    console.log('PASS: a stalled room cannot block the globe; background preparation, Explore, mobile resize and direct links remain functional');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
