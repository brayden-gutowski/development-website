const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() + ';window.polish = () => ({ state, room: japanRoom, travel: tokyoVisit });' });
    });
    await page.goto('http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => polish().state.reducedMotion), true, 'A live Reduce Motion change must reach the animation loop');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 60000 }).catch(async error => {
      console.log(await page.evaluate(() => ({ app: document.querySelector('#app').className, state: polish().state, travel: polish().travel, message: document.querySelector('.room-load-error')?.textContent })), errors);
      throw error;
    });
    assert.equal(await page.locator('#tokyo-window-video').evaluate(v => v.paused), false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => polish().state.reducedMotion), true, 'A live Reduce Motion change must reach the animation loop');
    assert.equal(await page.locator('#tokyo-window-video').evaluate(v => v.paused), true, 'A live Reduce Motion change pauses the skyline');
    const frozenAt = await page.evaluate(() => polish().room.windowLight.uniforms.time.value);
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(() => polish().room.windowLight.uniforms.time.value), frozenAt, 'Live Reduce Motion freezes the mist');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => !document.querySelector('#tokyo-window-video').paused);
    await page.waitForFunction(t => polish().room.windowLight.uniforms.time.value > t, frozenAt);
    assert.deepEqual(errors, []);
    await page.close();

    const fallback = await browser.newPage({ viewport: { width: 960, height: 720 }, reducedMotion: 'reduce' });
    const fallbackErrors = [];
    fallback.on('pageerror', error => fallbackErrors.push(error.message));
    fallback.on('console', message => {
      if (message.type() === 'error' && /framebuffer|WebGL|Shader/i.test(message.text())) fallbackErrors.push(message.text());
    });
    await fallback.addInitScript(() => {
      const getExtension = WebGL2RenderingContext.prototype.getExtension;
      WebGL2RenderingContext.prototype.getExtension = function (name) {
        return /EXT_color_buffer_(half_)?float/.test(name) ? null : getExtension.call(this, name);
      };
    });
    await fallback.route('**/script.js*', async route => {
      const response = await route.fetch();
      const probe = `
        window.targetTypes = new Set();
        const setTarget = renderer.setRenderTarget;
        renderer.setRenderTarget = function(target, ...args) {
          if (target) window.targetTypes.add(target.texture.type);
          return setTarget.call(this, target, ...args);
        };
        window.polish = () => ({ room: japanRoom, dispose: () => { cancelAnimationFrame(frameId); japanRoom.dispose(); } });`;
      const source = await response.text();
      await route.fulfill({ response, body: source + probe });
    });
    await fallback.goto('http://127.0.0.1:4173');
    await fallback.locator('#loading-screen').waitFor({ state: 'hidden' });
    await fallback.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await fallback.getByRole('button', { name: 'Explore', exact: true }).click();
    await fallback.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 60000 });
    assert.ok(await fallback.evaluate(async () => {
      const T = await import('three');
      return targetTypes.size > 0 && !targetTypes.has(T.HalfFloatType) && !targetTypes.has(T.FloatType);
    }), 'Every rendered target honors the no-float device fallback');
    assert.deepEqual(fallbackErrors, []);
    await fallback.screenshot({ path: '/tmp/towski-review/room-byte-fallback.png' });
    await fallback.evaluate(() => polish().dispose());
    console.log('PASS: live motion preferences freeze/resume media and mist; all fallback render targets are supported');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
