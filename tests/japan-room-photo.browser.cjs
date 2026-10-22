const assert = require('node:assert/strict');
const { chromium } = require('playwright');
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
    assert.equal(await page.locator('#room-hint').textContent(), 'Hover over objects to explore');
    assert.equal(await page.locator('.room-hud__heading').count(), 0);
    const controls = await page.locator('.room-hud__actions').boundingBox();
    assert.ok(controls.width <= 1 && controls.height <= 1, 'No visible bottom navigation');
    const checks = await page.evaluate(async () => {
      const { createJapanRoom } = await import('/japan-room.js');
      const room = await createJapanRoom();
      room.resize(1440, 900); room.scene.updateMatrixWorld(true);
      room.setVisible(true, false);
      const THREE = await import('three');
      const visible = new Set(), points = {};
      let lightmapped = 0, moving = 0;
      let sourceUVs = 0, posterVertices = 0;
      room.scene.traverse(o => {
        if (!o.isMesh) return;
        if (o.material.lightMap && o.geometry.attributes.uv1) lightmapped++;
        if (o.userData.roomMaterialUV === 'UVMap') sourceUVs++;
        for (const material of [o.material].flat()) for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
          if (material[key] && material[key].channel !== 0) throw new Error('Material texture must use original UV0: ' + o.name);
        }
        if (o.userData.roomRole === 'poster') {
          const uv = o.geometry.attributes.uv;
          const wallUV = o.geometry.attributes.uv1;
          if (o.material.roughness < .4 || o.material.metalness !== 0 || !o.material.lightMap) throw new Error('Poster should use lit satin paper');
          for (let i = 0; i < uv.count; i++) {
            if (uv.getX(i) < .059 || uv.getX(i) > .941) throw new Error('Preserve the poster crop from its OBJ UVs');
            if (wallUV.getX(i) > 0 && wallUV.getY(i) > 0) posterVertices++;
          }
        }
        if (o.name === 'Curtain' || o.parent?.name === 'Curtain') {
          const before = new Float32Array(o.geometry.attributes.position.array);
          room.update(2, false);
          const after = o.geometry.attributes.position.array;
          if (after.some((v, i) => Math.abs(v - before[i]) > .0001)) moving++;
          const frozen = new Float32Array(after);
          room.update(2, true); room.update(2, true);
          if (after.some((v, i) => v !== frozen[i])) throw new Error('Reduced motion must freeze the curtains');
        }
      });
      room.reset(); room.setVisible(false, true); room.camera.updateMatrixWorld(true);
      room.scene.traverse(o => {
        if (!o.isMesh || !o.userData.roomAction) return;
        const p = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(room.camera);
        if (Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && room.pick(p.x, p.y) === o.userData.roomAction) {
          visible.add(o.userData.roomAction);
          points[o.userData.roomAction] ||= { x: (p.x + 1) * 720, y: (1 - p.y) * 450 };
        }
      });
      return { lightmapped, moving, sourceUVs, posterVertices, visible: [...visible].sort(), points, fov: room.camera.fov, fog: room.scene.fog.density };
    });
    assert.ok(checks.lightmapped >= 10, 'Cycles indirect lighting must reach room surfaces');
    assert.ok(checks.sourceUVs >= 15, 'Export must explicitly preserve the original material UV set');
    assert.ok(checks.posterVertices > 100, 'Poster should inherit local wall illumination without changing its image UVs');
    assert.ok(checks.moving > 0, 'Curtains should breathe gently');
    assert.ok(checks.fov > 24 && checks.fov < 32, 'Slightly wider room framing without changing the authored camera aspect');
    assert.ok(checks.fog < .05, 'Keep foreground contrast instead of a brown veil');
    assert.ok(['books', 'diary', 'door', 'music'].every(action=>checks.visible.includes(action)));
    await page.mouse.move(20, 890);
    await page.screenshot({ path: process.env.ROOM_SCREENSHOT || '/tmp/japan-room-photo.png' });
    await page.mouse.click(checks.points.books.x, checks.points.books.y);
    await page.locator('#book-reader[data-phase="reading"]').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#book-reader').waitFor({state:'hidden'});
    await page.keyboard.press('Escape');
    await page.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: minimal room UI, Cycles lightmaps, curtain motion/reduced motion, framing, object clicks, Escape exit', checks);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
