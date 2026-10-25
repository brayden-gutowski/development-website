const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://xp.test/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<div id="app"></div>' });
      if (path.endsWith('.wav')) return route.fulfill({ body: Buffer.from([0]) });
      try { return route.fulfill({ contentType: path.endsWith('.js') ? 'text/javascript' : 'image/png', body: readFileSync(new URL('..' + path, 'file://' + __dirname + '/')) }); }
      catch { return route.fulfill({ status: 404, body: '' }); }
    });
    await page.goto('http://xp.test/');
    await page.evaluate(async () => {
      const { createXPDesktop } = await import('/xp-desktop.js');
      window.makeDesktop = () => createXPDesktop({
        getRoom: () => ({ getScreenRect: () => ({ x: 0, y: 0, width: 1024, height: 768 }) }),
        categories: [{ id: 'general', label: 'General', entries: [{ title: 'Test project', description: 'Details', image: 'assets/xp/bliss.png' }] }],
        onExit() {},
      });
      window.desktop = makeDesktop(); desktop.open(); desktop.update(5, true);
      HTMLElement.prototype.setPointerCapture = function () {};
    });
    const cdp = await page.context().newCDPSession(page);
    const dragReleased = [];
    for (const clear of [false, true]) {
      await page.evaluate(clear => {
        document.querySelector('[data-xp-folder="general"]').click();
        const win = document.querySelector('.xp-window');
        window.closedWindow = new WeakRef(win);
        win.querySelector('.xp-titlebar').dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 1 }));
        if (clear) { document.querySelector('.xp-start-logoff').click(); desktop.update(2, true); }
        else win.querySelector('.xp-close').click();
      }, clear);
      await cdp.send('HeapProfiler.collectGarbage');
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await cdp.send('HeapProfiler.collectGarbage');
      dragReleased.push(await page.evaluate(() => !closedWindow.deref()));
    }

    await page.evaluate(() => {
      desktop.close(true); desktop.open(); desktop.update(5, true);
      window.closedApplications = [];
      for (let visit = 0; visit < 4; visit++) {
        document.querySelector('[data-xp-folder="general"]').click();
        document.querySelector('.xp-file').click();
        for (const label of ['Control Panel', 'My Music', 'Outlook Express', 'Run…']) {
          document.querySelector('.xp-start-menu [aria-label="' + label + '"]').click();
        }
        for (const win of document.querySelectorAll('.xp-window')) {
          closedApplications.push(new WeakRef(win)); win.querySelector('.xp-close').click();
        }
      }
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await cdp.send('HeapProfiler.collectGarbage');
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await cdp.send('HeapProfiler.collectGarbage');
    assert.equal(await page.evaluate(() => closedApplications.every(ref => !ref.deref())), true,
      'Repeated folders, Notepad, picture viewers, mail and utilities are collected after close');

    const sessionsCleared = await page.evaluate(() => {
      desktop.close(true); desktop.open(); desktop.update(5, true);
      document.querySelector('[data-xp-folder="general"]').click();
      [...document.querySelectorAll('button')].find(button => button.textContent === 'Make a new folder').click();
      const input = document.querySelector('[aria-label="Name"]'); input.value = 'Temporary folder'; input.form.requestSubmit();
      const created = [...document.querySelectorAll('.xp-file')].some(item => item.textContent === 'Temporary folder');
      desktop.defocus(); desktop.open();
      const preserved = [...document.querySelectorAll('.xp-file')].some(item => item.textContent === 'Temporary folder');
      desktop.close(true); desktop.open(); desktop.update(5, true);
      document.querySelector('[data-xp-folder="general"]').click();
      return { created, preserved, cleared: ![...document.querySelectorAll('.xp-file')].some(item => item.textContent === 'Temporary folder') };
    });
    await page.evaluate(async () => {
      desktop.dispose();
      const NativeContext = window.AudioContext;
      window.contexts = []; window.buffers = []; window.pendingDecodes = [];
      window.AudioContext = class extends NativeContext {
        constructor() { super(); contexts.push(this); }
        decodeAudioData() {
          const buffer = this.createBuffer(1, 44100, 44100); buffers.push(new WeakRef(buffer));
          return new Promise(resolve => pendingDecodes.push(() => resolve(buffer)));
        }
      };
      window.desktop = makeDesktop();
      window.preparing = [desktop.prepare(), desktop.prepare()];
    });
    await page.waitForFunction(() => pendingDecodes.length >= 5);
    const contextsCreated = await page.evaluate(() => contexts.length);
    await page.evaluate(async () => {
      desktop.dispose();
      for (const resolve of pendingDecodes.splice(0)) resolve();
      await Promise.all(preparing); window.preparing = null;
    });
    await cdp.send('HeapProfiler.collectGarbage');
    const buffersReleased = await page.evaluate(() => buffers.every(ref => !ref.deref()));
    assert.deepEqual({ dragReleased, sessionsCleared, contextsCreated, buffersReleased }, {
      dragReleased: [true, true], sessionsCleared: { created: true, preserved: true, cleared: true }, contextsCreated: 1, buffersReleased: true,
    });
    assert.deepEqual(errors, []);
    console.log('PASS: XP closed windows, session folders, repeated prepare, and late audio decode release their owned resources');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
