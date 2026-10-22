// Avoid magnifying the orbit texture or skipping over available city detail.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    const samples = await page.evaluate(async () => {
      const THREE = await import('three');
      const { createTokyoFlight } = await import('/tokyo-flight.js');
      const renderer = new THREE.WebGLRenderer();
      const earthGroup = new THREE.Group();
      const daylight = { value: 0 };
      const flight = await createTokyoFlight({ renderer, earthGroup, radius: 1.72, location: { lat: 35.6762, lon: 139.6503 }, globeLighting: {
        nightMap: { value: new THREE.Texture() },
        sunDirection: { value: new THREE.Vector3(0, 0, -1) },
        daylight,
      } });
      flight.setProgress(3.8);
      if (daylight.value !== 0) throw new Error('The imagery handoff must begin with the original globe lighting');
      flight.setProgress(5.8);
      const middleLighting = daylight.value;
      if (Math.abs(middleLighting - .5) > .0001) throw new Error('Light should change gradually through the regional approach');
      flight.setProgress(7.8);
      if (daylight.value !== 1) throw new Error('Settle the lighting before the city approach');
      flight.setProgress(5.8);
      if (daylight.value !== middleLighting) throw new Error('Reverse the same lighting curve during departure');
      flight.setOpacity(0);
      if (daylight.value !== 0) throw new Error('Restore the normal globe lighting after the trip');
      flight.setOpacity(1);
      const layers = earthGroup.getObjectByName('tokyo-aerial-imagery').children.filter(mesh => mesh.name.startsWith('tokyo-aerial-'));
      return [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(zoom => {
        flight.setProgress(zoom);
        const detail = layers.filter(mesh => mesh.visible && mesh.material.opacity >= .5).at(-1);
        return { zoom, level: detail ? +detail.name.split('-').at(-1) : null, width: detail?.material.map.image.width, draws: layers.filter(mesh => mesh.visible).length };
      });
    });
    for (const sample of samples) {
      assert.ok(sample.level >= sample.zoom, `At zoom ${sample.zoom}, the incoming imagery is still too coarse: ${JSON.stringify(sample)}`);
      assert.ok(sample.width >= 1280, 'Prepare enough surrounding imagery for the viewport');
      assert.ok(sample.draws <= 5, 'Keep only the useful overlapping detail layers on screen');
    }
    await page.route('**/assets/tokyo-flight/9.webp*', route => route.abort());
    await page.reload();
    const fallback = await page.evaluate(async () => {
      const THREE = await import('three');
      const { createTokyoFlight } = await import('/tokyo-flight.js');
      const renderer = new THREE.WebGLRenderer();
      const earthGroup = new THREE.Group();
      await createTokyoFlight({ renderer, earthGroup, radius: 1.72, location: { lat: 35.6762, lon: 139.6503 } });
      return { missing: !earthGroup.getObjectByName('tokyo-aerial-9'), next: !!earthGroup.getObjectByName('tokyo-aerial-10') };
    });
    assert.ok(fallback.missing && fallback.next, 'An unavailable local atlas must not hide the remaining detail layers');
    console.log('PASS: continuous imagery detail, shared lighting, and local atlas fallback', samples);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
