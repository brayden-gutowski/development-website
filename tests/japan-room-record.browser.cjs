const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--mute-audio'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const NativeContext = window.AudioContext;
      window.AudioContext = class extends NativeContext {
        constructor(...args) { super(...args); window.recordContext = this; }
        createMediaElementSource(audio) {
          const source = super.createMediaElementSource(audio);
          const connect = source.connect.bind(source);
          source.connect = node => { window.recordMusicInput = node; return connect(node); };
          return source;
        }
        createBufferSource() {
          const source = super.createBufferSource();
          (window.recordSurfaceSources ||= []).push(source);
          return source;
        }
      };
    });
    const activate = async name => { await page.getByRole('button', { name }).focus(); await page.keyboard.press('Enter'); };
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: /Tokyo, Japan/ }).click();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({ timeout: 30000 });
    assert.equal(await page.locator('#tokyo-record-track').count(), 1, 'Use the supplied song as the record track');
    const track = page.locator('#tokyo-record-track');
    await track.evaluate(a => { a.volume = 0; }); // Test silently on the shared computer.
    await activate('Record player · Play music');
    // AudioParam.value reflects the graph after its first rendering quantum.
    await page.waitForFunction(() => document.querySelector('#tokyo-record-track').dataset.phase === 'lead-in' && window.recordMusicInput?.gain?.value === 0);
    const lead = await page.evaluate(() => {
      const surface = window.recordSurfaceSources?.find(s => s.loop);
      const samples = surface?.buffer.getChannelData(0);
      return {
        mutedSong: window.recordMusicInput?.gain?.value === 0,
        gain: window.recordMusicInput?.gain?.value,
        context: window.recordContext?.state,
        pausedSong: document.querySelector('#tokyo-record-track').paused,
        surfaceRMS: samples && Math.sqrt(samples.reduce((sum, s) => sum + s*s, 0) / samples.length),
      };
    });
    console.log('Vinyl lead-in state',lead);
    assert.ok(lead.mutedSong && lead.pausedSong, 'Crackle should precede the song without skipping its opening');
    assert.ok(lead.surfaceRMS > .001 && lead.surfaceRMS < .03, 'Generate a quiet, audible vinyl surface bed');
    await page.waitForTimeout(1700);
    assert.equal(await track.evaluate(a => a.paused && a.dataset.phase === 'lead-in'), true, 'Let the vinyl crackle linger before starting the song');
    await page.waitForFunction(() => { const a = document.querySelector('#tokyo-record-track'); return !a.paused && a.currentTime > .25; });
    assert.equal(await page.evaluate(() => window.recordMusicInput.gain.value), 1, 'Fade in the full song after the lead-in');
    const info = await track.evaluate(a => ({ src: a.currentSrc, duration: a.duration, time: a.currentTime }));
    assert.ok(info.src.includes('scorsese-port-london.mp3'));
    assert.ok(info.duration > 120 && info.duration < 145);
    await activate('Record player · Pause music');
    assert.equal(await track.evaluate(a => a.paused), true);
    await page.waitForFunction(() => window.recordContext.state === 'suspended');
    const pausedAt = await track.evaluate(a => a.currentTime);
    // Cancelling during needle lead-in must not start the song later.
    await activate('Record player · Play music');
    await page.waitForFunction(() => document.querySelector('#tokyo-record-track').dataset.phase === 'lead-in');
    await activate('Record player · Pause music');
    await page.waitForTimeout(2700);
    assert.equal(await track.evaluate(a => a.paused && a.dataset.phase === 'paused'), true);
    await activate('Record player · Play music');
    await page.waitForFunction(time => document.querySelector('#tokyo-record-track').currentTime > time + .1, pausedAt);
    // Fully buffer the supplied file for accelerated seeking: the Python
    // preview server does not implement HTTP range requests for streamed MP3s.
    await track.evaluate(async a => {
      if (!a.src.startsWith('blob:')) {
        const blob = await fetch(a.currentSrc).then(r => r.blob());
        a.src = URL.createObjectURL(blob);
        await a.play();
      }
      a.currentTime = a.duration - .2;
    });
    await page.waitForFunction(() => document.querySelector('#tokyo-record-track').dataset.phase === 'runout');
    assert.equal(await page.getByRole('button', { name: 'Record player · Pause music' }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Record player · Play music' }).waitFor();
    assert.equal(await track.evaluate(a => a.paused && a.currentTime < .1), true);
    await activate('Record player · Play music');
    // Ignore the brief muted play used to unlock audio inside the gesture.
    await page.waitForFunction(() => { const a=document.querySelector('#tokyo-record-track'); return a.dataset.phase==='song'&&!a.paused; });
    await track.evaluate(a => { a.currentTime = a.duration - .2; });
    await page.waitForFunction(() => document.querySelector('#tokyo-record-track').dataset.phase === 'runout');
    await activate('Door · Return to globe');
    await page.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor();
    assert.equal(await track.evaluate(a => a.paused && a.dataset.phase === 'stopped'), true);
    assert.deepEqual(errors, []);
    console.log('PASS: vinyl lead-in and song bed, lead-in cancellation, MP3 pause/resume, natural runout/click, reset and exit cancellation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
