const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    // Finish startup before loading the isolated geometry fixture.
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const counts = await page.evaluate(async () => {
      const THREE = await import('three');
      const { createJapanRoom } = await import('/japan-room.js');
      const room = await createJapanRoom();
      const transmission = Math.exp(-Math.pow(room.scene.fog.density * 4, 2));
      const distantTransmission = Math.exp(-Math.pow(room.scene.fog.density * 12, 2));
      if (transmission <= .95 || distantTransmission >= .95) throw new Error('Keep nearby furniture clear while retaining subtle depth haze');
      room.resize(1440, 900);
      const renderer = new THREE.WebGLRenderer();
      renderer.setSize(1440, 900);
      const target = new THREE.WebGLRenderTarget(1440, 900);
      const baseline = new Uint8Array(1440 * 900 * 4);
      const highlighted = new Uint8Array(baseline.length);
      const counts = {};
      for (const action of ['books', 'door', 'diary', 'music']) {
        renderer.setRenderTarget(target);
        renderer.render(room.scene, room.camera);
        renderer.readRenderTargetPixels(target, 0, 0, 1440, 900, baseline);
        room.highlight(action);
        room.outline.render(renderer, target, target, 0, false);
        renderer.readRenderTargetPixels(target, 0, 0, 1440, 900, highlighted);
        let whiteEdges = 0, changedPixels = 0;
        for (let i = 0; i < baseline.length; i += 4) {
          if (highlighted[i] - baseline[i] > 30) changedPixels++;
          if (highlighted[i] > 245 && highlighted[i + 1] > 245 && highlighted[i + 2] > 245 && highlighted[i] - baseline[i] > 30) whiteEdges++;
        }
        counts[action] = { whiteEdges, solidFraction: whiteEdges / changedPixels };
        room.highlight(null);
      }
      room.outline.dispose(); target.dispose(); renderer.dispose();
      return counts;
    });
    console.log('Rendered white outline pixels:', counts);
    for (const [action, count] of Object.entries(counts)) assert.ok(count.whiteEdges > 100, `${action} must visibly render a bold white contour`);
    for (const [action, count] of Object.entries(counts)) assert.ok(count.solidFraction > .7, `${action} should have a solid contour with no broad glow`);
    await page.close();
    // Test the displayed result too: postprocessing must not echo the contour.
    const live = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await live.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await live.locator('#loading-screen').waitFor({ state: 'hidden' });
    await live.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await live.getByRole('button', { name: 'Explore', exact: true }).click();
    await live.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 60000 });
    await live.mouse.move(30, 870);
    const before = PNG.sync.read(await live.screenshot());
    await live.getByRole('button', { name: 'Books · Japanese Books' }).focus();
    const after = PNG.sync.read(await live.screenshot({ path: '/tmp/tokyo-outline-composited.png' }));
    let changed = 0, solid = 0;
    for (let i = 0; i < before.data.length; i += 4) {
      if (Math.max(...[0, 1, 2].map(c => after.data[i+c] - before.data[i+c])) <= 12) continue;
      changed++;
      if ([0, 1, 2].every(c => after.data[i+c] >= 245)) solid++;
    }
    console.log('Displayed outline:', { changed, solid, solidFraction: solid / changed });
    assert.ok(solid > 100 && solid / changed > .7, 'Display one solid contour without offset copies from the dream glow');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
