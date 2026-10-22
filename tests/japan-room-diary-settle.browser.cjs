const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');await page.locator('#loading-screen').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Tokyo, Japan/}).click();await page.getByRole('button',{name:'Explore',exact:true}).click();
  await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
  await page.getByRole('button',{name:'Diary · Japanese Blog'}).focus();await page.keyboard.press('Enter');
  await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:15000});
  for(const direction of ['forward','backward']){
   await page.keyboard.press(direction==='forward'?'ArrowRight':'ArrowLeft');
   await page.waitForFunction(()=>!document.querySelector('.diary-turn').hidden);
   await page.locator('.diary-turn').evaluate(async e=>{
    const a=e.getAnimations()[0];a.pause();await a.ready;a.currentTime=899.999;await new Promise(requestAnimationFrame);
    window.revealedDiaryPage=document.querySelector('.diary-spread').querySelector(e.dataset.direction==='forward'?'.diary-page--right':'.diary-page--left');
    window.landingDiaryPage=e.querySelector('.diary-turn-back .diary-page');
   });
   const bounds=await page.locator('.diary-spread').boundingBox();
   const before=PNG.sync.read(await page.screenshot({path:`/tmp/diary-settle-${direction}-before.png`}));
   await page.locator('.diary-turn').evaluate(e=>e.getAnimations()[0].finish());
   await page.locator('.diary-turn').waitFor({state:'hidden'});
   const after=PNG.sync.read(await page.screenshot({path:`/tmp/diary-settle-${direction}-after.png`}));
   let delta=0,count=0,changed=0;
   const start=bounds.x+(direction==='forward'?0:bounds.width/2);
   for(let y=Math.ceil(bounds.y+45);y<bounds.y+bounds.height-45;y++)for(let x=Math.ceil(start+35);x<start+bounds.width/2-35;x++){
    const i=(y*before.width+x)*4;let d=0;for(let c=0;c<3;c++)d+=Math.abs(before.data[i+c]-after.data[i+c]);
    delta+=d/3;count++;if(d>24)changed++;
   }
   console.log(direction,'landing delta:',{mean:delta/count,changed:changed/count});
   assert.ok(delta/count<1.5&&changed/count<.025,'The final turning face must match the settled page without a shading/content flash');
   assert.equal(await page.evaluate(()=>window.revealedDiaryPage.isConnected),true,'Keep the already-revealed destination page in place');
   assert.equal(await page.evaluate(()=>window.landingDiaryPage.parentElement===document.querySelector('.diary-spread')),true,'Settle the loaded turning face directly into the book');
  }
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('.diary-book').style.width==='724px');
  await page.keyboard.press('ArrowRight');await page.locator('.diary-turn').waitFor({state:'hidden'});
  await page.getByRole('heading',{name:'初めまして',exact:true}).waitFor();
  await page.getByRole('button',{name:'Show diary photographs'}).click();await page.waitForTimeout(400);
  await page.keyboard.press('ArrowRight');await page.locator('.diary-turn').waitFor({state:'hidden'});
  assert.equal(await page.locator('#diary-reader').evaluate(e=>e.classList.contains('is-photo-side')),true,'Finishing a turn must retain the phone photo view instead of starting a second pan');
  console.log('PASS: forward/backward final frames match their settled pages and retain loaded page surfaces');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
