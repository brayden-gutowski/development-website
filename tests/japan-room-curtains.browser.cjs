const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && /Shader|WebGL/.test(m.text())) errors.push(m.text()); });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 60000 });
    const clip = { x: 245, y: 280, width: 55, height: 170 };
    const open = PNG.sync.read(await page.screenshot({ clip }));
    await page.mouse.click(150, 300);
    const control = page.getByRole('button', { name: 'Curtains · Open curtains' });
    await control.waitFor({ timeout: 3000 });
    assert.equal(await control.getAttribute('aria-pressed'), 'true');
    await page.mouse.move(20, 870);
    const closed = PNG.sync.read(await page.screenshot({ clip }));
    let covered = 0;
    for (let i = 0; i < open.data.length; i += 4) {
      if (Math.max(...[0, 1, 2].map(c => Math.abs(closed.data[i+c] - open.data[i+c]))) > 25) covered++;
    }
    assert.ok(covered > clip.width * clip.height * .65, 'Closing must physically cover the formerly visible city');
    await page.screenshot({ path: '/tmp/tokyo-curtains-closed.png' });
    await page.mouse.click(400, 300);
    await page.getByRole('button', { name: 'Curtains · Close curtains' }).waitFor();
    await page.mouse.move(20, 870);
    const reopened = PNG.sync.read(await page.screenshot({ clip }));
    let restored = 0;
    for (let i = 0; i < open.data.length; i += 4) {
      if ([0, 1, 2].every(c => Math.abs(reopened.data[i+c] - open.data[i+c]) < 5)) restored++;
    }
    assert.ok(restored > clip.width * clip.height * .95, 'Reopening must restore the outdoor view');
    await page.getByRole('button', { name: 'Curtains · Close curtains' }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.getByRole('button', { name: 'Curtains · Open curtains' }).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Curtains · Close curtains' }).waitFor();
    const motion = await page.evaluate(async () => {
      const { createJapanRoom } = await import('/japan-room.js');
      const room = await createJapanRoom(); room.setVisible(true, false);
      const cloth = room.scene.getObjectByName('Curtain').geometry.attributes.position;
      const rest = cloth.array.slice();
      const zs = Array.from({ length: cloth.count }, (_, i) => rest[i * 3 + 2]);
      const middle = (Math.min(...zs) + Math.max(...zs)) / 2;
      const separation = () => {
        let left = -Infinity, right = Infinity;
        for (let i = 0; i < cloth.count; i++) {
          if (zs[i] < middle) left = Math.max(left, cloth.getZ(i));
          else right = Math.min(right, cloth.getZ(i));
        }
        return right - left;
      };
      let minimumGap = Infinity;
      const displacement = () => Math.sqrt(cloth.array.reduce((sum, p, i) => sum + (p - rest[i]) ** 2, 0) / rest.length);
      const originalSun = room.scene.getObjectByName('Window sunlight').intensity;
      room.toggleCurtains(); room.update(.05, false);
      const early = displacement();
      for (let i = 0; i < 150; i++) { room.update(.02, false); minimumGap = Math.min(minimumGap, separation()); }
      const closed = displacement();
      const closedGap = separation();
      const dimmed = room.scene.getObjectByName('Window sunlight').intensity / originalSun;
      room.toggleCurtains();
      for (let i = 0; i < 150; i++) room.update(.02, false);
      const reopened = displacement();
      const restoredSun = room.scene.getObjectByName('Window sunlight').intensity / originalSun;
      room.dispose(); return { early, closed, reopened, dimmed, restoredSun, minimumGap, closedGap };
    });
    assert.ok(motion.early > 0 && motion.early < motion.closed * .5, 'Normal motion should draw the curtains gradually');
    assert.ok(motion.reopened < .02 && motion.dimmed < .3 && motion.restoredSun > .98, 'Reopening restores shape and daylight');
    assert.ok(motion.minimumGap >= .003, 'The two fabric panels must never interpenetrate while closing or breathing');
    assert.ok(motion.closedGap < .025, 'Closed hems must meet closely instead of leaving an open slit');
    assert.deepEqual(errors, []);
    console.log('PASS: click either curtain to cover/restore the view, reversible geometry, keyboard control and reduced motion');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
