const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.route('**/tokyo-flight.js*', route => route.fulfill({ contentType: 'text/javascript', body: `
      import * as THREE from 'three';
      export async function createTokyoFlight({earthGroup}) {
        const group = new THREE.Group(); group.name = 'failed-flight-test'; earthGroup.add(group);
        return {group, dispose(){window.flightDisposals++;group.removeFromParent();}, suspend(){}};
      }` }));
    await page.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('setTimeout(preloadOtherAreas, 1000);', '') + `;
        window.flightDisposals=0;
        window.failFlight=async()=>{
          const compile=renderer.compileAsync;
          renderer.compileAsync=async()=>{throw new Error('Injected flight shader preparation failure');};
          try { await loadCityFlight('tokyo',{activate:false}); }
          finally { renderer.compileAsync=compile; }
          return {disposals:flightDisposals,groups:earthGroup.children.filter(o=>o.name==='failed-flight-test').length,retryable:!cityFlightPromises.has('tokyo')};
        };` });
    });
    await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4173') + '/');
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 60000 });
    assert.deepEqual(await page.evaluate(() => failFlight()), { disposals: 1, groups: 0, retryable: true });
    assert.deepEqual(await page.evaluate(() => failFlight()), { disposals: 2, groups: 0, retryable: true });
    console.log('PASS: failed flight shader warmup disposes the created flight before a retry');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
