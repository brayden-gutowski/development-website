const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/__flight-memory-harness', route => route.fulfill({ contentType: 'text/html', body: '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"}}</script><div id="city-flight"></div>' }));
    await page.goto('http://127.0.0.1:4173/__flight-memory-harness');
    const result = await page.evaluate(async () => {
      const THREE = await import('three');
      const { createTokyoFlight } = await import('/tokyo-flight.js');
      const renderer = new THREE.WebGLRenderer(), earthGroup = new THREE.Group();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
      canvas.getContext('2d').fillRect(0, 0, 8, 8);
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      const nativeFetch = window.fetch, nativeBitmap = window.createImageBitmap;
      let downloads = 0, decodes = 0, releaseDecode;
      const decodedImages = [];
      window.fetch = (url, options) => {
        if (String(url).startsWith('memory-atlases/')) {
          downloads++;
          return Promise.resolve(String(url).includes('manifest')
            ? new Response(JSON.stringify([{ zoom: 4, x: 10, y: 2, grid: 9, count: 16 }, { zoom: 5, x: 26, y: 10, grid: 5, count: 32 }, { zoom: 6, x: 54, y: 23, grid: 5, count: 64 }]))
            : new Response(String(url).includes('/6.webp') ? new Blob(['invalid image']) : blob));
        }
        return nativeFetch(url, options);
      };
      window.createImageBitmap = async (...args) => {
        decodes++;
        const image = await nativeBitmap(...args);
        decodedImages.push(image);
        if (releaseDecode === 'hold') await new Promise(resolve => { releaseDecode = resolve; });
        return image;
      };
      const flight = await createTokyoFlight({ renderer, earthGroup, radius: 1, location: { id: 'tokyo', lat: 35.68, lon: 139.69 }, assetDirectory: 'memory-atlases' });
      const maps = flight.group.children.filter(mesh => mesh.name.startsWith('tokyo-aerial-')).map(mesh => mesh.material.map);
      const residentTextures = renderer.info.memory.textures, images = maps.map(map => map.image);
      flight.suspend();
      const suspended = { textures: renderer.info.memory.textures, closed: images.every(image => image.width === 0), released: maps.every(map => !map.image), hidden: !flight.group.visible };
      await Promise.all([flight.prepare(), flight.prepare()]);
      const revisited = { textures: renderer.info.memory.textures, valid: maps.every(map => map.image.width === 8), downloads, decodes, groups: earthGroup.children.length };
      flight.setOpacity(1); flight.setProgress(5);
      const progress = { visible: flight.group.visible, zoom: document.querySelector('#city-flight').dataset.zoom };
      flight.suspend();
      const sharedContainer = document.querySelector('#city-flight'); sharedContainer.style.opacity = '1'; sharedContainer.style.visibility = 'visible';
      flight.suspend();
      const inactive = sharedContainer.style.opacity === '1' && sharedContainer.style.visibility === 'visible';
      releaseDecode = 'hold';
      const previousDecodes = decodes;
      const pending = flight.prepare();
      while (typeof releaseDecode !== 'function') await new Promise(requestAnimationFrame);
      const concurrentDecodes = decodes - previousDecodes;
      flight.suspend(); releaseDecode(); await pending;
      const interrupted = { textures: renderer.info.memory.textures, released: maps.every(map => !map.image), hidden: !flight.group.visible };
      await flight.prepare();
      flight.dispose();
      const disposed = { groups: earthGroup.children.length, textures: renderer.info.memory.textures, closed: decodedImages.every(image => image.width === 0) };
      renderer.dispose();
      return { residentTextures, suspended, revisited, progress, inactive, concurrentDecodes, interrupted, disposed };
    });
    assert.deepEqual(errors, []);
    assert.equal(result.suspended.textures, result.residentTextures - 2, 'Suspension must release both atlas GPU textures');
    assert.ok(result.suspended.closed && result.suspended.released && result.suspended.hidden, 'Suspension closes decoded pixels and hides imagery');
    assert.deepEqual(result.revisited, { textures: result.residentTextures, valid: true, downloads: 4, decodes: 5, groups: 1 }, 'Unavailable atlases fall back while concurrent preparation reuses cached downloads and creates no duplicate group');
    assert.deepEqual(result.progress, { visible: true, zoom: '5.00' });
    assert.ok(result.inactive, 'Suspending an inactive city must not hide another city’s flight container');
    assert.equal(result.concurrentDecodes, 2, 'Cached atlas decoding starts concurrently even while one image is delayed');
    assert.deepEqual(result.interrupted, { textures: result.residentTextures - 2, released: true, hidden: true }, 'A late decode must not repopulate a suspended flight');
    assert.deepEqual(result.disposed, { groups: 0, textures: 0, closed: true }, 'Disposal releases atlas and cloud resources, including canceled decoded pixels');
    console.log('PASS: flight atlas memory releases, cached full-resolution revisits, shared preparation, interrupted decoding and cleanup');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
