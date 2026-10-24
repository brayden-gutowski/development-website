const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + ';window.videoRoom = () => japanRoom;' });
    });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await page.waitForFunction(() => document.querySelector('#tokyo-window-video')?.dataset.status === 'ready');
    const source = await page.locator('#tokyo-window-video').evaluate(video => video.currentSrc);
    assert.match(source, /^blob:/, 'Startup must own the complete clip before decoding so playback cannot request later ranges');
    assert.equal(await page.evaluate(async source => (await fetch(source)).ok, source), true, 'The complete preloaded clip remains available while its room exists');
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 30000 });
    const video = page.locator('#tokyo-window-video');
    const initial = await video.evaluate(v => ({ time: v.currentTime, frames: v.getVideoPlaybackQuality().totalVideoFrames, paused: v.paused, muted: v.muted, loop: v.loop, inline: v.playsInline, width: v.videoWidth }));
    assert.equal(initial.paused, false);
    assert.ok(initial.muted && initial.loop && initial.inline);
    assert.equal(await video.evaluate(v=>v.playbackRate),1,'Keep native motion timing');
    assert.equal(initial.width, 2560);
    await page.waitForFunction(start => {
      const v = document.querySelector('#tokyo-window-video');
      return v.currentTime > start.time + .6 && v.getVideoPlaybackQuality().totalVideoFrames > start.frames + 10;
    }, initial);
    const frameA = await page.screenshot({ clip: { x: 250, y: 190, width: 60, height: 270 } });
    const videoTime = await video.evaluate(v => v.currentTime);
    await page.waitForFunction(time => document.querySelector('#tokyo-window-video').currentTime > time + .8, videoTime);
    const frameB = await page.screenshot({ clip: { x: 250, y: 190, width: 60, height: 270 } });
    assert.notDeepEqual(frameA, frameB, 'Actual window pixels must change during playback');
    await page.screenshot({ path: '/tmp/japan-room-video.png' });
    // Exercise the actual media loop, rather than waiting for the entire clip.
    await video.evaluate(v => { v.currentTime = v.duration - .2; });
    await page.waitForFunction(() => { const v = document.querySelector('#tokyo-window-video'); return v.currentTime < 2 && !v.paused; });
    await page.getByRole('button', { name: 'Door · Return to globe' }).focus();
    await page.keyboard.press('Enter');
    await page.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor({ timeout: 10000 });
    assert.equal(await video.evaluate(v => v.paused), true, 'Pause decoding on the globe');
    assert.equal(await page.evaluate(async source => {
      window.videoRoom().dispose();
      try { await fetch(source); return false; } catch { return true; }
    }, source), true, 'Disposing the room must revoke its complete video source');
    assert.deepEqual(errors, []);
    await page.close();
    const reduced = await browser.newContext({ reducedMotion: 'reduce' });
    const quiet = await reduced.newPage();
    await quiet.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await quiet.locator('#loading-screen').waitFor({ state: 'hidden' });
    await quiet.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await quiet.getByRole('button', { name: 'Explore', exact: true }).click();
    await quiet.locator('#app.is-in-room:not(.is-travelling)').waitFor();
    assert.equal(await quiet.locator('#tokyo-window-video').evaluate(v => v.paused && v.readyState >= 2), true);
    await reduced.close();
    const fallback = await browser.newContext({ reducedMotion: 'reduce' });
    const offline = await fallback.newPage();
    await offline.route('**/assets/tokyo-window-*.mp4*', route => route.fulfill({ status: 503, body: '' }));
    await offline.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await offline.locator('#loading-screen').waitFor({ state: 'hidden' });
    await offline.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await offline.getByRole('button', { name: 'Explore', exact: true }).click();
    await offline.locator('#app.is-in-room:not(.is-travelling)').waitFor();
    assert.equal(await offline.locator('#tokyo-window-video').getAttribute('data-status'), 'fallback');
    await fallback.close();
    console.log('PASS: muted inline HD video playback, decoded moving frames, looping, exit pause, reduced motion and poster fallback');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
