const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/script.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    const asset = await page.evaluate(async () => {
      const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js');
      const original = GLTFLoader.prototype.loadAsync;
      let loads = 0;
      GLTFLoader.prototype.loadAsync = async function (...args) {
        loads++;
        const value = await original.apply(this, args);
        const buffer = await value.parser.getDependency('buffer', 0);
        window.diaryCacheRefs = { parser: new WeakRef(value.parser), buffer: new WeakRef(buffer) };
        window.diaryBufferBytes = buffer.byteLength;
        return value;
      };
      try {
        const { loadDiaryAnimation } = await import('/diary-animation.js');
        const first = await loadDiaryAnimation(), second = await loadDiaryAnimation();
        let meshes = 0; first.scene.traverse(object => { if (object.isMesh) meshes++; });
        return { cached: first === second, loads, meshes, clip: first.animations[0]?.name, bufferBytes: diaryBufferBytes };
      } finally { GLTFLoader.prototype.loadAsync = original; }
    });
    assert.equal(asset.cached, true); assert.equal(asset.loads, 1);
    assert.equal(asset.meshes, 7); assert.equal(asset.clip, 'Diary_Pickup_Open');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.collectGarbage');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    await cdp.send('HeapProfiler.collectGarbage');
    const retained = await page.evaluate(() => Object.fromEntries(Object.entries(diaryCacheRefs).map(([name, ref]) => [name, Boolean(ref.deref())])));
    assert.deepEqual(retained, { parser: false, buffer: false }, 'The cached animation retains its scene and clips, without the loader parser or duplicate GLB buffer');
    console.log('PASS: shared diary scene/clip cache releases its parser and', asset.bufferBytes, 'bytes of duplicate GLB data');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
