// Removing the startup readiness await must fail before the visitor can Explore.
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
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 60000 });
    const startup = await page.evaluate(() => window.startupComplete);
    console.log('Cold startup:', { ...startup, programs: startup.programs.length });
    assert.equal(startup.ready, true, 'The room must finish GPU preparation before the loading screen completes');
    assert.equal(startup.readersHidden, true, 'Prepared reader pages stay hidden on the globe');
    assert.equal(startup.videoPaused, true, 'Preloading must not play the hidden room video');
    assert.equal(startup.audioPaused, true, 'Preloading must not play room audio');
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
    assert.deepEqual(newPrograms, [], 'Explore must reuse shaders already prepared during startup');
    assert.deepEqual(newRequests, [], 'Explore must reuse assets already downloaded during startup');
    assert.ok(arrival.exploreToTravelMs < 100, 'A prepared Explore click must start travel within 100ms');
    assert.deepEqual(errors, []);
    await page.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    let startedDownload;
    const downloadStarted = new Promise(resolve => { startedDownload = resolve; });
    await mobile.route('**/JapanRoom.glb*', async route => {
      startedDownload();
      await new Promise(resolve => setTimeout(resolve, 600));
      await route.continue();
    });
    await mobile.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + ';window.preloadRoomAspect = () => japanRoom?.camera.aspect;' });
    });
    await mobile.goto((process.env.TEST_URL || 'http://127.0.0.1:4173') + '/#book-review/yaseuma');
    await downloadStarted;
    assert.equal(await mobile.locator('#loading-screen').evaluate(element => element.classList.contains('is-complete')), false, 'A slow room download must keep the startup loading screen visible');
    await mobile.setViewportSize({ width: 430, height: 932 });
    await mobile.locator('#book-reader[data-phase="reading"][data-book="yaseuma"]').waitFor({ timeout: 60000 });
    assert.equal(await mobile.evaluate(() => window.preloadRoomAspect()), 430 / 932, 'A viewport change during startup must reach the prepared room camera');
    assert.equal(await mobile.locator('#app.is-in-room:not(.is-travelling)').count(), 1, 'A reduced-motion direct link must open its review in the prepared room');
    console.log('PASS: cold startup prepares the room without later downloads/shaders; mobile resize and direct links remain functional');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
