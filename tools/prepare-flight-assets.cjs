// Offline imagery/cloud preparation. Run against the local server with Playwright.
// Sources and modifications: assets/tokyo-flight/credit.md.
const fs = require('node:fs/promises');
const path = require('node:path');
const { gzipSync } = require('node:zlib');
const { chromium } = require('playwright');
(async () => {
  const directory = path.join(__dirname, '../assets/tokyo-flight');
  await fs.mkdir(directory, { recursive: true });
  const previous = process.argv.includes('--regional-only')
    ? JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8')) : null;
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4173');
    const manifest = [];
    for (let zoom = 4; zoom <= 18; zoom++) {
      if (previous && (zoom <= 8 || zoom >= 14)) {
        manifest.push(previous.find(layer => layer.zoom === zoom));
        continue;
      }
      const layer = await page.evaluate(async zoom => {
        const count = 2 ** zoom, grid = zoom === 4 ? 9 : 5;
        const latitude = 35.6762 * Math.PI / 180;
        const x = Math.floor((139.6503 + 180) / 360 * count) - Math.floor(grid / 2);
        const y = Math.floor((1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2 * count) - Math.floor(grid / 2);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = grid * 256;
        const context = canvas.getContext('2d');
        let next = 0;
        const missing = [];
        async function image(url, optional = false) {
          const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
          if (optional && response.status === 404) return null;
          if (!response.ok) throw new Error(`${response.status}: ${url}`);
          return createImageBitmap(await response.blob(), { colorSpaceConversion: 'none' });
        }
        async function tile(dx, dy) {
          const tx = ((x + dx) % count + count) % count, ty = y + dy;
          if (ty < 0 || ty >= count) return;
          const work = document.createElement('canvas'); work.width = work.height = 256;
          const ctx = work.getContext('2d', { willReadFrequently: true });
          let mask;
          let allSea = false;
          if (zoom >= 9 && zoom <= 13) {
            const elevation = await image(`https://cyberjapandata.gsi.go.jp/xyz/dem_png/${zoom}/${tx}/${ty}.png`, true);
            mask = new Uint8Array(256 * 256);
            if (elevation) {
              ctx.drawImage(elevation, 0, 0); elevation.close();
              const data = ctx.getImageData(0, 0, 256, 256).data;
              for (let p = 0; p < mask.length; p++) mask[p] = data[p * 4] === 128 && data[p * 4 + 1] === 0 && data[p * 4 + 2] === 0 ? 1 : 0;
            } else mask.fill(1); // GSI omits elevation tiles containing only sea.
            allSea = mask.every(value => value === 1);
          }
          if (!allSea) {
            const url = zoom <= 8
              ? `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/${zoom}/${ty}/${tx}.jpeg`
              : `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${zoom}/${tx}/${ty}.jpg`;
            const photo = await image(url); ctx.drawImage(photo, 0, 0); photo.close();
          } else ctx.clearRect(0, 0, 256, 256);
          if (mask) {
            const photo = ctx.getImageData(0, 0, 256, 256);
            for (let p = 0; p < mask.length; p++) if (mask[p]) {
              const u = (tx + p % 256 / 256) / count, v = (ty + Math.floor(p / 256) / 256) / count;
              const shade = .96 + .04 * Math.sin(u * 170) * Math.cos(v * 190);
              photo.data.set([14 * shade, 35 * shade, 53 * shade, 255], p * 4);
            }
            ctx.putImageData(photo, 0, 0);
          }
          context.drawImage(work, dx * 256, dy * 256);
        }
        async function worker() {
          while (next < grid * grid) {
            const index = next++, dx = index % grid, dy = Math.floor(index / grid);
            for (let attempt = 0; attempt < 3; attempt++) {
              try { await tile(dx, dy); break; }
              catch (error) { if (attempt === 2) missing.push({ dx, dy, error: String(error) }); }
            }
          }
        }
        await Promise.all(Array.from({ length: 4 }, worker));
        if (missing.length) throw new Error(JSON.stringify(missing));
        return { zoom, x, y, grid, count, data: canvas.toDataURL('image/webp', .91).split(',')[1] };
      }, zoom);
      await fs.writeFile(path.join(directory, `${zoom}.webp`), Buffer.from(layer.data, 'base64'));
      delete layer.data; manifest.push(layer);
      console.log('Prepared atlas', zoom);
    }
    await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
    const cloud = await page.evaluate(async () => {
      const { cloudVolume } = await import('/tools/cloud-volume.mjs');
      const { data, shadowData } = cloudVolume(9);
      const bytes = new Uint8Array(data.length + shadowData.length);
      bytes.set(data); bytes.set(shadowData, data.length);
      let result = '';
      for (let i = 0; i < bytes.length; i += 32768) result += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return btoa(result);
    });
    await fs.writeFile(path.join(directory, 'cloud-volume.bin.gz'), gzipSync(Buffer.from(cloud, 'base64')));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
