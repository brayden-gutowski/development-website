const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + ';window.coverRoom=()=>japanRoom;window.coverReader=()=>bookReader;' });
    });
    await page.goto('http://127.0.0.1:4173/#book-review/akai-sakana-to-kodomo');
    await page.locator('#book-reader[data-phase="reading"]').waitFor({ timeout: 60000 });
    const faces = await page.evaluate(() => coverRoom().reviewBooks.flatMap(book => ['Front_board', 'Back_board'].map(name => {
      const mesh = book.object.getObjectByName(name), g = mesh.geometry;
      const normal = g.attributes.normal, outerSign = name === 'Front_board' ? 1 : -1;
      const result = { book: book.object.name, board: name, inside: 0, outside: 0, artworkInside: 0, missingArtworkOutside: 0 };
      for (const group of g.groups) {
        const material = mesh.material[group.materialIndex];
        for (let i = group.start; i < group.start + group.count; i += 3) {
          const z = [0, 1, 2].map(j => normal.getZ(g.index.getX(i + j)) * outerSign);
          if (z.every(n => n < -.9)) { result.inside++; if (material.map === book.cover) result.artworkInside++; }
          if (z.every(n => n > .9)) { result.outside++; if (material.map !== book.cover) result.missingArtworkOutside++; }
        }
      }
      return result;
    })));
    for (const face of faces) {
      assert.ok(face.inside > 0 && face.outside > 0, 'Check both physical board faces');
      assert.equal(face.artworkInside, 0, `Exterior artwork must not appear inside ${face.book} ${face.board}`);
      assert.equal(face.missingArtworkOutside, 0, `Preserve the exterior cover of ${face.book} ${face.board}`);
    }
    await page.evaluate(async () => {
      const reader = coverReader(); reader.close(true);
      window.stepCover = reader.update; reader.update = () => {};
      await reader.open({ entryId: 'akai-sakana-to-kodomo' }, false);
      for (let i = 0; i < 28; i++) stepCover(.05, false);
    });
    await page.screenshot({ path: '/tmp/towski-review/book-inner-lining.png' });
    console.log('PASS: all six novel boards keep artwork outside and lining inside', faces);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
