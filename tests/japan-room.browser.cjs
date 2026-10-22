// Run with Playwright available: node tests/japan-room.browser.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    const imageryTiles = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() === 200 && /\/tokyo-flight\/1[5-8]\.webp/.test(response.url())) imageryTiles.push(response.url());
    });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      window.flightDurations = [];
      let startedAt;
      new MutationObserver(() => {
        const travelling = document.querySelector('#app').classList.contains('is-travelling');
        if (travelling && startedAt === undefined) startedAt = performance.now();
        if (!travelling && startedAt !== undefined) {
          window.flightDurations.push(performance.now() - startedAt);
          startedAt = undefined;
        }
      }).observe(document.querySelector('#app'), { attributes: true, attributeFilter: ['class'] });
    });
    await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await page.getByRole('button', { name: 'Explore', exact: true }).click({ timeout: 3000 });
    await page.waitForFunction(() => +document.querySelector('#city-flight').dataset.zoom >= 15, {}, { timeout: 30000 }).catch(async error => {
      console.log('Arrival diagnostics:', await page.evaluate(() => ({
        app: document.querySelector('#app').className,
        flight: { ...document.querySelector('#city-flight').dataset },
        status: document.querySelector('#room-transition').getAttribute('aria-label'),
      })), { errors, imageryTiles });
      throw error;
    });
    await page.screenshot({ path: '/tmp/tokyo-city-arrival-test.png' });
    await page.locator('#app.is-in-room').waitFor({ timeout: 30000 });
    await page.locator('#room-transition').waitFor({ state: 'hidden' });
    assert.ok(imageryTiles.some(url => /tokyo-flight\/1[5-8]\.webp/.test(url)), 'Flight loaded real Tokyo city imagery');
    // Exercise real GLB geometry, including occlusion and grouped white highlights.
    const sceneChecks = await page.evaluate(async () => {
      const { createJapanRoom } = await import('/japan-room.js');
      const THREE = await import('three');
      const room = await createJapanRoom();
      const transmission = Math.exp(-Math.pow(room.scene.fog.density * 4, 2));
      const distantTransmission = Math.exp(-Math.pow(room.scene.fog.density * 12, 2));
      if (transmission <= .95 || distantTransmission >= .95) throw new Error('Keep nearby furniture clear while retaining subtle depth haze');
      room.resize(1440, 900);
      room.scene.updateMatrixWorld(true);
      room.camera.updateMatrixWorld(true);
      const visible = new Set();
      const points = {};
      room.scene.traverse(object => {
        if (!object.visible || !object.isMesh || !object.userData.roomAction) return;
        for (let parent=object.parent;parent;parent=parent.parent) if(!parent.visible)return;
        const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).project(room.camera);
        if (Math.abs(center.x) < 1 && Math.abs(center.y) < 1 && room.pick(center.x, center.y) === object.userData.roomAction) {
          if ([object.material].flat().some(material=>(material.emissive?.getHex()||0)!==0)) throw new Error('Hover must preserve the object surface color');
          if (!room.outline.selectedObjects.includes(object)) throw new Error('Hovered object has no contour');
          visible.add(object.userData.roomAction);
          points[object.userData.roomAction] ||= { x: (center.x + 1) * 720, y: (1 - center.y) * 450 };
        }
      });
      const speakers = [];
      room.scene.traverse(object => { if (object.isMesh && object.userData.roomRole === 'speaker') speakers.push(object); });
      if (!speakers.length) throw new Error('The updated room should include its authored speakers');
      room.highlight('music');
      if (speakers.some(speaker => speaker.userData.roomAction || room.outline.selectedObjects.includes(speaker))) throw new Error('Speakers must not be part of the record-player interaction');
      const framingOffset = room.camera.position.distanceTo(new THREE.Vector3(-1.1826536655, 1.6793675423, -.1891032755));
      if (framingOffset < .1 || framingOffset > .4 || room.camera.fov < 24) throw new Error('Keep the authored view with a modest leftward/backward framing adjustment');
      const texturedSurfaces = [];
      room.scene.traverse(object => { if (object.isMesh && object.material.map) texturedSurfaces.push(object); });
      if (texturedSurfaces.length < 15) throw new Error('Preserve the authored room materials and texture maps');
      room.highlight(null);
      const base = room.camera.quaternion.clone();
      const baseDirection = room.camera.getWorldDirection(new THREE.Vector3());
      room.point(0, 1); room.update(2, false);
      if (room.camera.getWorldDirection(new THREE.Vector3()).y <= baseDirection.y) throw new Error('Moving the pointer upward must look upward');
      room.reset();
      room.point(1, 1); room.update(2, false);
      const angle = base.angleTo(room.camera.quaternion);
      room.update(2, true);
      const reducedAngle = base.angleTo(room.camera.quaternion);
      // Leaving the room must cancel audio even while browser resume is pending.
      const resume = AudioContext.prototype.resume;
      let releaseResume;
      AudioContext.prototype.resume = function () {
        return new Promise(resolve => { releaseResume = () => resume.call(this).then(resolve); });
      };
      let resumedAfterStop;
      try {
        const pendingPlayback = room.soundtrack.toggle();
        room.soundtrack.stop();
        await releaseResume(); await pendingPlayback;
        resumedAfterStop = room.soundtrack.playing;
      } finally { AudioContext.prototype.resume = resume; room.soundtrack.stop(); }
      room.reset();
      return { visible: [...visible].sort(), points, angle, reducedAngle, resumedAfterStop };
    });
    assert.ok(['books', 'diary', 'door', 'music'].every(action=>sceneChecks.visible.includes(action)));
    assert.ok(sceneChecks.angle > 0 && sceneChecks.angle < 0.06, 'Camera stays within a few degrees');
    assert.ok(sceneChecks.reducedAngle < 0.00001, 'Reduced motion disables parallax');
    assert.equal(sceneChecks.resumedAfterStop, false, 'Stopping cancels a pending audio start');
    await page.mouse.click(sceneChecks.points.books.x, sceneChecks.points.books.y);
    await page.locator('#book-reader[data-phase="reading"]').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#book-reader').waitFor({state:'hidden'});
    await page.getByRole('button', { name: 'Diary · Japanese Blog' }).focus();
    await page.keyboard.press('Enter');
    await page.locator('#diary-reader[data-phase="reading"]').waitFor({ timeout: 15000 });
    await page.getByRole('dialog', { name: 'Japanese diary' }).getByRole('heading', { name: '目次', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#diary-reader').waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('button', { name: 'Diary · Japanese Blog' }).evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Books · Japanese Books' }).focus();
    await page.keyboard.press('Enter');
    await page.locator('#book-reader[data-phase="reading"]').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#book-reader').waitFor({state:'hidden'});
    const music = page.getByRole('button', { name: 'Record player · Play music' });
    await music.focus(); await page.keyboard.press('Enter');
    assert.equal(await page.getByRole('button', { name: 'Record player · Pause music' }).getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: process.env.ROOM_SCREENSHOT || '/tmp/japan-room-desktop.png' });
    await page.mouse.click(sceneChecks.points.door.x, sceneChecks.points.door.y);
    await page.waitForFunction(() => {
      const flight = document.querySelector('#city-flight');
      return +flight.dataset.zoom < 15 && +flight.dataset.zoom > 12 && +flight.style.opacity > 0.9;
    }, {}, { timeout: 20000 });
    await page.screenshot({ path: '/tmp/tokyo-city-departure-test.png' });
    await page.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor({ timeout: 20000 });
    assert.equal(await page.locator('#room-hud').isVisible(), false);
    const durations = await page.evaluate(() => window.flightDurations);
    assert.equal(durations.length, 2);
    durations.forEach(duration => assert.ok(duration >= 3000 && duration <= 5000, `Flight must last 3–5 seconds, got ${duration} ms`));
    await page.getByRole('button', { name: /Nashville, Tennessee/ }).click();
    await page.getByRole('button', { name: 'Music Reviews', exact: true }).click();
    assert.equal(await page.locator('#drawer-title').textContent(), 'Music Reviews');
    assert.deepEqual(errors, []);
    await page.close();
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const touchPage = await mobile.newPage();
    touchPage.on('pageerror', error => errors.push(error.message));
    await touchPage.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await touchPage.locator('#loading-screen').waitFor({ state: 'hidden' });
    await touchPage.getByRole('button', { name: /Tokyo, Japan/ }).tap();
    await touchPage.getByRole('button', { name: 'Explore', exact: true }).tap();
    await touchPage.locator('#app.is-in-room:not(.is-travelling)').waitFor();
    await touchPage.screenshot({ path: '/tmp/japan-room-mobile.png' });
    const touchPoints = await touchPage.evaluate(async () => {
      const { createJapanRoom } = await import('/japan-room.js');
      const THREE = await import('three');
      const room = await createJapanRoom(); room.resize(390, 844); room.scene.updateMatrixWorld(true);
      const points = {};
      room.scene.traverse(o => {
        if (!o.isMesh || !o.userData.roomAction) return;
        const p = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(room.camera);
        if (Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && room.pick(p.x, p.y) === o.userData.roomAction) points[o.userData.roomAction] ||= { x: (p.x + 1) * 195, y: (1 - p.y) * 422 };
      }); return points;
    });
    await touchPage.touchscreen.tap(touchPoints.books.x, touchPoints.books.y);
    await touchPage.locator('#book-reader[data-phase="reading"]').waitFor();
    await touchPage.getByRole('button', { name: 'Put books back' }).tap();
    await touchPage.locator('#book-reader').waitFor({state:'hidden'});
    await touchPage.touchscreen.tap(touchPoints.door.x, touchPoints.door.y);
    await touchPage.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor();
    assert.deepEqual(errors, []);
    await mobile.close();
    console.log('PASS: live Tokyo aerial arrival/departure, desktop/touch room actions, contours without material changes, excluded speaker, camera limits, reduced motion, audio cancellation, focus, and globe drawers');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
