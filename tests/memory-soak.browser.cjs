const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: process.env.SOAK_FLIGHTS ? 'no-preference' : 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + `;
        window.leakAudit = {
          ready: () => backgroundAreasStarted && areaLoads.size === 0 && !roomIsLoading,
          settled: area => !roomIsLoading && (area === 'globe' ? !tokyoVisit && !roomIsVisible : roomIsVisible && roomLocationId === area && tokyoVisit?.direction === 'room'),
          enter: async area => { focusLocation(area); await exploreTokyo(area); }, leave: leaveTokyo,
          computer: activateRoomObject, drawer: openDrawer,
          closeReaders: () => { diaryReader?.close(true); bookReader?.close(true); },
          snapshot: () => ({ gpu: {...renderer.info.memory}, programs: renderer.info.programs.length,
            measures: performance.getEntriesByType('measure').map(({name}) => name),
            windows: document.querySelectorAll('.xp-window').length,
            rooms: {tokyo:japanRoom.texturesSuspended,gainesville:gainesvilleRoom.texturesSuspended} })
        };` });
    });
    await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4173') + '/#gainesville');
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 60000 });
    await page.waitForFunction(() => leakAudit.ready(), null, { timeout: 120000 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    async function settled(area) { await page.waitForFunction(area => leakAudit.settled(area), area, { timeout: 30000 }); }
    async function snapshot(cycle) {
      await cdp.send('HeapProfiler.collectGarbage');
      const { metrics } = await cdp.send('Performance.getMetrics');
      return { cycle, ...await page.evaluate(() => leakAudit.snapshot()), ...await cdp.send('Memory.getDOMCounters'),
        heapBytes: metrics.find(metric => metric.name === 'JSHeapUsedSize').value };
    }
    const samples = [];
    const cycles = Number(process.env.SOAK_CYCLES || 10);
    for (let i = 0; i < cycles; i++) {
      await page.evaluate(() => leakAudit.computer('computer'));
      await page.locator('#xp-computer[data-phase="desktop"]').waitFor();
      await page.locator('[data-xp-folder="general"]').dblclick();
      await page.getByRole('button', { name: 'Towski.dev.txt', exact: true }).dblclick();
      await page.getByRole('button', { name: 'Close Towski.dev.txt - Notepad', exact: true }).click();
      await page.evaluate(() => leakAudit.computer(null));
      await page.locator('#xp-computer.is-passive').waitFor();
      await page.evaluate(() => leakAudit.computer('computer'));
      assert.equal(await page.locator('#xp-computer').getAttribute('data-phase'), 'desktop');
      await page.evaluate(() => leakAudit.leave()); await settled('globe');
      assert.equal(await page.locator('.xp-window').count(), 0);
      await page.evaluate(() => leakAudit.enter('tokyo')); await settled('tokyo');
      await page.evaluate(() => leakAudit.drawer('japanese-blog'));
      await page.locator('#diary-reader[data-phase="reading"]').waitFor();
      await page.keyboard.press('ArrowRight');
      await page.evaluate(() => leakAudit.closeReaders());
      await page.evaluate(() => leakAudit.drawer('japanese-book-reviews'));
      await page.locator('#book-reader[data-phase="reading"]').waitFor();
      await page.keyboard.press('ArrowRight');
      await page.evaluate(() => leakAudit.closeReaders());
      await page.evaluate(() => leakAudit.leave()); await settled('globe');
      await page.evaluate(() => leakAudit.enter('gainesville')); await settled('gainesville');
      samples.push(await snapshot(i + 1));
      console.log('Memory cycle', i + 1, JSON.stringify(samples.at(-1)));
    }
    const baseline = samples[1], tail = samples.slice(2);
    assert.deepEqual(errors, []);
    for (const sample of tail) {
      assert.equal(sample.windows, 0);
      assert.deepEqual(sample.rooms, { tokyo: true, gainesville: false });
      assert.ok(sample.gpu.textures <= baseline.gpu.textures + 1, 'GPU textures remain bounded');
      assert.ok(sample.gpu.geometries <= baseline.gpu.geometries + 1, 'GPU geometries remain bounded');
      assert.ok(sample.programs <= baseline.programs + 1, 'Shader programs remain bounded');
      assert.ok(sample.nodes <= baseline.nodes + 15, 'DOM nodes remain bounded');
      assert.ok(sample.jsEventListeners <= baseline.jsEventListeners + 10, 'Event listeners remain bounded');
      assert.ok(sample.heapBytes <= baseline.heapBytes + 2 * 1024 * 1024, 'Collected JS heap remains within 2 MiB of warmed baseline');
      for (const name of new Set(sample.measures)) assert.equal(sample.measures.filter(item => item === name).length, 1, name + ' timing entries must not accumulate');
    }
    if (process.env.MEMORY_REPORT) writeFileSync(process.env.MEMORY_REPORT, JSON.stringify({ cycles, samples, errors }, null, 2) + '\n');
    console.log('PASS: repeated XP, diary, books, globe and room visits retain bounded heap, DOM, listeners, GPU resources and diagnostics');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
