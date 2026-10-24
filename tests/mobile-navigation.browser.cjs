const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
(async () => {
  const browser = await (process.env.TEST_BROWSER === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
  try {
    const page = await browser.newPage({ viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const panel = page.locator('#location-panel'), drawer = page.locator('#content-drawer');
    const cdp = process.env.TEST_BROWSER === 'webkit' ? null : await page.context().newCDPSession(page);
    const swipe = async (surface, downward) => {
      const box = await surface.boundingBox(), x = box.x + box.width / 2;
      const from = box.y + box.height * (downward ? .25 : .8), to = box.y + box.height * (downward ? .8 : .25);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: from }] });
      for (let i = 1; i <= 12; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: from + (to - from) * i / 12 }] });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const settled = selector => page.waitForFunction(selector => getComputedStyle(document.querySelector(selector)).opacity === '1', selector);
    const atTop = async (surface, heading) => {
      assert.equal(await surface.evaluate(el => el.scrollTop), 0, 'Newly selected content must start at the top');
      const bounds = await surface.boundingBox(), title = await heading.boundingBox();
      assert.ok(title.y >= bounds.y && title.y + title.height <= bounds.y + bounds.height, 'The heading is visible after navigation');
      assert.ok(bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= page.viewportSize().width + 1 && bounds.y + bounds.height <= page.viewportSize().height + 1, 'The panel fits the viewport');
    };
    const nativeTouch = async surface => surface.evaluate(el => {
      const box = el.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
      const dispatch = (type, touches) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'touches', { value: touches });
        el.dispatchEvent(event); return event;
      };
      dispatch('touchstart', [{ clientX: x, clientY: y }]);
      const event = dispatch('touchmove', [{ clientX: x, clientY: y - 30 }]);
      dispatch('touchcancel', []);
      return !event.defaultPrevented;
    });
    const cases = [
      { width: 667, height: 375, font: 16, motion: 'no-preference' },
      { width: 320, height: 568, font: 16, motion: 'no-preference' },
      { width: 393, height: 663, font: 16, motion: 'reduce' },
      { width: 393, height: 663, font: 20, motion: 'no-preference' },
    ];
    for (const size of cases) {
      await page.emulateMedia({ reducedMotion: size.motion });
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.evaluate(font => { document.documentElement.style.fontSize = font + 'px'; }, size.font);
      await page.getByRole('button', { name: /Nashville, Tennessee/ }).tap();
      await settled('#location-panel');
      await panel.evaluate(el => { el.scrollTop = el.scrollHeight; });
      assert.ok(await panel.evaluate(el => el.scrollTop > 0), 'Use genuinely overflowing Nashville content');
      await page.getByRole('button', { name: /Gainesville, Florida/ }).tap();
      await settled('#location-panel');
      await atTop(panel, page.getByRole('heading', { name: 'Education', exact: true }));
      if (cdp && size.width === 667) {
        await panel.evaluate(el => { el.scrollTop = el.scrollHeight; });
        const before = await panel.evaluate(el => el.scrollTop);
        await swipe(panel, true);
        await page.waitForFunction(before => document.querySelector('#location-panel').scrollTop < before, before);
        for (let i = 0; i < 3 && await panel.evaluate(el => el.scrollTop > 0); i++) await swipe(panel, true);
        await page.waitForFunction(() => document.querySelector('#location-panel').scrollTop === 0);
        await atTop(panel, page.getByRole('heading', { name: 'Education', exact: true }));
      }
      await page.getByRole('button', { name: /Nashville, Tennessee/ }).tap();
      await settled('#location-panel');
      await atTop(panel, page.getByRole('heading', { name: 'Music', exact: true }));
      await panel.evaluate(el => { el.scrollTop = el.scrollHeight; });
      assert.equal(await nativeTouch(panel), true, 'Touch scrolling remains native even at a panel boundary');
      await page.getByRole('button', { name: 'Music Reviews', exact: true }).tap();
      await settled('#content-drawer');
      await drawer.evaluate(el => { el.scrollTop = el.scrollHeight; });
      assert.equal(await nativeTouch(drawer), true, 'Touch scrolling remains native at a drawer boundary');
      const review = page.locator('.music-review').first();
      await review.locator('summary').tap();
      await page.waitForFunction(() => document.querySelector('#content-drawer').classList.contains('has-expanded-entry'));
      await drawer.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const closeReview = page.getByRole('button', { name: 'Close portfolio drawer', exact: true });
      const closeBounds = await closeReview.boundingBox();
      assert.ok(closeBounds.y >= 0 && closeBounds.y + closeBounds.height <= size.height, 'Expanded music reviews retain a visible close control after scrolling');
      await closeReview.tap();
      await settled('#location-panel');
      await page.getByRole('button', { name: /Gainesville, Florida/ }).tap();
      await settled('#location-panel');
      await atTop(panel, page.getByRole('heading', { name: 'Education', exact: true }));
      for (const category of ['Games', 'General', 'Competition']) {
        const projects = page.getByRole('button', { name: 'Projects', exact: true });
        if (await projects.getAttribute('aria-expanded') !== 'true') await projects.tap();
        await page.getByRole('button', { name: category, exact: true }).tap();
        await settled('#content-drawer');
        await atTop(drawer, page.locator('#drawer-title'));
        if (category === 'General') await page.waitForFunction(() => document.activeElement === document.querySelector('#close-drawer'));
        await drawer.evaluate(el => { el.scrollTop = el.scrollHeight; });
        await page.getByRole('button', { name: 'Close portfolio drawer', exact: true }).tap();
        await settled('#location-panel');
        await page.waitForFunction(() => !document.activeElement?.closest('[aria-hidden="true"]'), null, { timeout: 3000 });
        const focus = await page.evaluate(() => ({ label: document.activeElement?.outerHTML, hidden: !!document.activeElement?.closest('[aria-hidden="true"]') }));
        assert.equal(focus.hidden, false, `Closing a drawer must restore focus to visible controls: ${focus.label}`);
      }
      await page.getByRole('button', { name: 'Close location details', exact: true }).tap();
      await page.getByRole('button', { name: /Gainesville, Florida/ }).tap();
      await settled('#location-panel');
      await atTop(panel, page.getByRole('heading', { name: 'Education', exact: true }));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Navigation must not create horizontal overflow');
      console.log('PASS mobile navigation:', size);
    }
    await page.screenshot({ path: '/private/tmp/towski-mobile-navigation.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
