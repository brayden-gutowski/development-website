const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    // Read the real scene's marker materials without adding production test APIs.
    await page.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + `
        window.readTravelFrame = () => ({
          phase: tokyoVisit?.direction || 'globe',
          marker: Math.max(0, ...earthGroup.children.filter(o => o.name.startsWith('marker-'))
            .map(o => o.visible ? o.getObjectByName('signal-dot').material.opacity : 0)),
          camera: camera.position.toArray(), scale: earthGroup.scale.x,
        });` });
    });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await page.getByRole('button', { name: 'Explore', exact: true }).waitFor();
    await page.evaluate(() => {
      window.tripFrames = [];
      const sample = now => {
        const frame = window.readTravelFrame?.();
        if (frame) {
          const travelling = document.querySelector('#app').classList.contains('is-travelling');
          const text = [...document.querySelectorAll('#room-transition p, #room-transition strong, .city-flight__credit, #room-hint')]
            .filter(e => { const s = getComputedStyle(e); return e.getBoundingClientRect().height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > .01; })
            .map(e => e.textContent.trim());
          window.tripFrames.push({ ...frame, now, travelling, text });
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Door · Return to globe' }).focus(); await page.keyboard.press('Enter');
    await page.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor({ timeout: 15000 });
    await page.waitForTimeout(200);
    const frames = await page.evaluate(() => window.tripFrames);
    const travelText = frames.filter(f => f.travelling && f.text.length);
    const out = frames.filter(f => f.phase === 'out');
    const firstGlobe = frames.find(f => f.phase === 'globe' && f.now > out[0].now);
    const departure = [...out, firstGlobe];
    const maxMarkerJump = Math.max(...departure.slice(1).map((f,i) => Math.abs(f.marker - departure[i].marker)));
    const fadingMarkers = out.filter(f => f.marker > .01 && f.marker < .5).length;
    console.log({ travelText: travelText.slice(0, 2), maxMarkerJump, fadingMarkers });
    assert.equal(travelText.length, 0, 'Show no captions, credits or room hints during either zoom transition');
    assert.ok(fadingMarkers > 8 && maxMarkerJump < .1, 'Planet markers must fade in before departure finishes, without a pop at the handoff');
    const last = out.at(-1);
    assert.ok(Math.hypot(...last.camera.map((v,i) => v - firstGlobe.camera[i])) < .01 && Math.abs(last.scale - firstGlobe.scale) < .005, 'Camera and planet scale must remain continuous when normal rendering resumes');
    console.log('PASS: caption-free transitions, continuous camera handoff and gradual planet marker return');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
