const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const reducedMotion of ['no-preference','reduce']){
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');await page.locator('#loading-screen').waitFor({state:'hidden'});
  await page.evaluate(()=>{window.wordmarkFrames=[];new MutationObserver(()=>wordmarkFrames.push({name:document.querySelector('.wordmark__name').textContent,glitch:document.querySelector('.wordmark').classList.contains('is-glitching')})).observe(document.querySelector('.wordmark'),{subtree:true,childList:true,attributes:true,attributeFilter:['class']});});
  await page.getByRole('button',{name:/Tokyo, Japan/}).click();
  if(reducedMotion==='no-preference'){
   await page.locator('.wordmark.is-glitching').waitFor({timeout:3000});
   assert.equal(await page.locator('.wordmark svg').evaluate(el=>getComputedStyle(el).animationName),'wordmark-glitch-shift');
  }
  await page.waitForFunction(()=>document.querySelector('.wordmark__name').textContent==='ブライデン・グトウスキ'&&!document.querySelector('.wordmark').classList.contains('is-glitching'));
  assert.equal(await page.locator('.wordmark title').textContent(),'ブライデン・グトウスキ.dev');
  assert.equal(await page.evaluate(()=>wordmarkFrames.some(f=>f.glitch&&/[ヲ7#?▓]/.test(f.name))),reducedMotion==='no-preference','Scramble visible only with motion enabled');
  if(reducedMotion==='no-preference'){
   await page.getByRole('button',{name:/Nashville, Tennessee/}).click();await page.locator('.wordmark.is-glitching').waitFor();
   await page.getByRole('button',{name:/Tokyo, Japan/}).click();
   await page.waitForFunction(()=>document.querySelector('.wordmark__name').textContent==='ブライデン・グトウスキ'&&!document.querySelector('.wordmark').classList.contains('is-glitching'));
   await page.getByRole('button',{name:/Gainesville, Florida/}).click();
   await page.waitForFunction(()=>document.querySelector('.wordmark__name').textContent==='BRAYDEN GUTOWSKI'&&!document.querySelector('.wordmark').classList.contains('is-glitching'));
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: original Tokyo wordmark scramble, jitter, rapid location changes and reduced motion');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
