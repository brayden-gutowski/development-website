// Real-time test: do not use a mocked browser clock or take screenshots mid-flight.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 845, height: 767 }, deviceScaleFactor: 2 });
    await page.addInitScript(() => {
      window.flightFrames = []; window.flightPhases = [];
      const sample = now => {
        if (document.querySelector('#app')?.classList.contains('is-travelling')) {
          window.flightFrames.push(now);
          window.flightPhases.push({ room: document.querySelector('#app').classList.contains('is-in-room'), cover: +document.querySelector('#room-transition').style.getPropertyValue('--cover') });
        }
        if (window.departureStartedAt && document.querySelector('#app')?.classList.contains('is-travelling')) {
          if (window.departureWhiteAt === null && +document.querySelector('#room-transition').style.getPropertyValue('--cover') >= .99) window.departureWhiteAt = now;
          if (window.departureGlobeAt === null && !document.querySelector('#app').classList.contains('is-in-room')) window.departureGlobeAt = now;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 30000 });
    async function checkFrames(direction) {
      const stats = await page.evaluate(() => {
        const frames = window.flightFrames;
        const intervals = frames.slice(1).map((time, index) => time - frames[index]).sort((a, b) => a - b);
        return { slowFrames: frames.slice(1).flatMap((time, i) => time - frames[i] > 42 ? [{ at: +(time - frames[0]).toFixed(1), ms: +(time - frames[i]).toFixed(1), ...window.flightPhases[i + 1] }] : []), fps: 1000 * (frames.length - 1) / (frames.at(-1) - frames[0]), p95: intervals[Math.floor(intervals.length * .95)], longest: Math.max(...intervals) };
      });
      console.log(`${direction}: ${stats.fps.toFixed(1)}fps; p95 ${stats.p95.toFixed(1)}ms; longest ${stats.longest.toFixed(1)}ms`);
      if (stats.slowFrames.length) console.log('Slow frames:', stats.slowFrames);
      assert.ok(stats.fps >= 24, `${direction} averages below 24fps`);
      assert.ok(stats.longest <= 1000 / 24 + 1, `${direction} has a frame below 24fps`);
    }
    await checkFrames('Arrival');
    assert.equal(await page.locator('#city-flight').getAttribute('data-ready'), 'true');
    await page.getByRole('button', { name: 'Curtains · Close curtains' }).focus();
    await page.evaluate(() => {
      window.curtainFrames = [];
      const start = performance.now();
      const sample = now => {
        window.curtainFrames.push(now);
        if (now - start < 1800) requestAnimationFrame(sample);
        else window.curtainFramesDone = true;
      };
      requestAnimationFrame(sample);
    });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.curtainFramesDone);
    const curtainPacing = await page.evaluate(() => {
      const f = window.curtainFrames;
      const gaps = f.slice(1).map((time, i) => time - f[i]).sort((a,b) => a-b);
      return { fps: 1000 * (f.length - 1) / (f.at(-1) - f[0]), p95: gaps[Math.floor(gaps.length * .95)] };
    });
    console.log('Curtain motion:', curtainPacing);
    assert.ok(curtainPacing.fps >= 24 && curtainPacing.p95 < 43, 'Curtain deformation and live shadows must remain smooth');
    await page.evaluate(() => { window.flightFrames = []; window.flightPhases = []; window.departureStartedAt = performance.now(); window.departureWhiteAt = null; window.departureGlobeAt = null; });
    await page.getByRole('button', { name: 'Door · Return to globe' }).focus();
    await page.keyboard.press('Enter');
    await page.locator('#app:not(.is-travelling):not(.is-in-room)').waitFor({ timeout: 10000 });
    await checkFrames('Departure');
    const departure = await page.evaluate(() => ({ whiteAfter: window.departureWhiteAt - window.departureStartedAt, globeAfter: window.departureGlobeAt - window.departureStartedAt }));
    assert.ok(departure.whiteAfter >= 900, 'Room departure must ease into white for about a second');
    assert.ok(departure.globeAfter >= 1100, 'Keep the room visible through the longer white fade');
    console.log('Departure room fade:', departure);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
