const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => {
      window.loadingTasks = [];
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.loadingTasks.push({ start: entry.startTime, ms: entry.duration });
      }).observe({ type: 'longtask', buffered: true });
    });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const start = await page.evaluate(() => performance.now());
    await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 30000 });
    const result = await page.evaluate(start => ({
      visitMs: Math.round(performance.now() - start),
      longestTask: Math.round(Math.max(0, ...window.loadingTasks.filter(t => t.start >= start).map(t => t.ms))),
      stages: performance.getEntriesByType('measure').map(e => ({ name: e.name, ms: Math.round(e.duration), ...e.detail })),
      externalTiles: performance.getEntriesByType('resource').filter(r => /cyberjapan|earthdata|maps.eox/.test(r.name)).length,
      roomBytes: performance.getEntriesByType('resource').filter(r => /JapanRoom|room-|SBR/.test(r.name)).reduce((sum, r) => sum + r.encodedBodySize, 0),
    }), start);
    console.log(result);
    assert.ok(result.visitMs < 9000, 'Cold preparation plus the 4.8-second flight should finish within nine seconds locally');
    assert.ok(result.longestTask < 200, 'Preparation must not freeze the page for 200ms or longer');
    assert.equal(result.externalTiles, 0, 'Visits should use prepared local imagery');
    assert.ok(result.roomBytes < 18000000, 'The room payload should be substantially smaller than the original 50MB');
    assert.equal(result.stages.find(stage => stage.name === 'room-render').newPrograms, 0, 'Compile for the actual room render buffer before its first draw');
    console.log('PASS: smaller local assets, bounded cold-load time, and no first-draw shader compilation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
