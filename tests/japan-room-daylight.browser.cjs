const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  await page.clock.setSystemTime(new Date('2026-10-18T03:00:00Z'));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Shader|WebGL/.test(m.text()))errors.push(m.text())});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');
  await page.locator('#loading-screen').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Tokyo, Japan/}).click();await page.getByRole('button',{name:'Explore',exact:true}).click();
  await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
  const state=()=>page.locator('#tokyo-window-video').evaluate(v=>({phase:v.dataset.phase,src:v.currentSrc,rate:v.playbackRate,paused:v.paused,ready:v.readyState}));
  const first=await state();assert.equal(first.phase,'golden-hour','Room time is fixed just before twilight');assert.equal(first.rate,1,'Video must play at its native pace');assert.ok(first.ready>=2&&first.paused);
  await page.clock.setSystemTime(new Date('2026-10-18T12:00:00Z'));
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.deepEqual(await state(),first,'Changing actual Tokyo time must not switch the room view');
  await page.screenshot({path:'/tmp/japan-room-golden-hour.png'});
  assert.deepEqual(errors,[]);console.log('PASS: permanently warm pre-twilight room, stable viewpoint, native video rate and reduced motion');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
