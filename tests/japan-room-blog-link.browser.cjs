const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const initial='#blog/intermediate-japanese/blog-entry-8-21-2026';
const latest='#blog/intermediate-japanese/blog-entry-10-2-2026';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const reducedMotion of ['no-preference','reduce']){
   const page=await browser.newPage({viewport:{width:reducedMotion==='reduce'?390:1440,height:900},reducedMotion});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    window.bookOutsideRoom=false;
    new MutationObserver(()=>{const diary=document.querySelector('#diary-reader');if(diary&&!diary.hidden&&!document.querySelector('#app.is-in-room:not(.is-travelling)'))window.bookOutsideRoom=true;}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
   });
   if(reducedMotion==='no-preference')await page.route('**/JapanRoom.glb*',async route=>{await new Promise(resolve=>setTimeout(resolve,1200));await route.continue();});
   await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+initial);
   if(reducedMotion==='no-preference'){
    const start=await Promise.race([
     page.waitForRequest('**/JapanRoom.glb*',{timeout:15000}).then(()=>'room'),
     page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:15000}).then(()=>'book'),
    ]);
    assert.equal(start,'room','A blog URL must load the room before showing the book');
    await page.evaluate(hash=>{location.hash=hash;},latest);
   }
   await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:60000});
   assert.equal(await page.locator('#app.is-in-room:not(.is-travelling)').count(),1,'A blog link must load the actual Tokyo room before opening the diary');
   assert.equal(await page.evaluate(()=>window.bookOutsideRoom),false,'Do not flash a diary over the globe or during arrival');
   const title=reducedMotion==='reduce'?'初めまして':'にゃんこ大戦争';
   await page.getByRole('heading',{name:title,exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>location.hash),(reducedMotion==='reduce'?initial:latest).replace('#blog/','#tokyo/diary/'));
   await page.screenshot({path:`/tmp/blog-link-${reducedMotion}.png`});
   if(reducedMotion==='no-preference'){
    await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>!document.querySelector('.diary-turn').hidden);
    await page.evaluate(hash=>{location.hash=hash;},initial);
    await page.getByRole('heading',{name:'初めまして',exact:true}).waitFor();await page.waitForTimeout(1000);
    assert.equal(await page.locator('.diary-spread .diary-title').textContent(),'初めまして','An old turn must not overwrite a newly linked entry');
    await page.evaluate(()=>history.back());await page.getByRole('heading',{name:'にゃんこ大戦争',exact:true}).waitFor();
   }else{
    await page.getByRole('button',{name:'Left page'}).click();
    await page.evaluate(hash=>{location.hash=hash;},latest);
    await page.getByRole('heading',{name:'にゃんこ大戦争',exact:true}).waitFor();
    assert.equal(await page.locator('#diary-reader').evaluate(e=>e.dataset.pageSide==='left'),false,'A linked entry opens to its writing even if the previous phone view showed photographs');
   }
   await page.evaluate(hash=>{location.hash=hash;},initial);
   await page.getByRole('heading',{name:'初めまして',exact:true}).waitFor();
   assert.equal(await page.locator('#app.is-in-room:not(.is-travelling)').count(),1,'In-room blog links retain the room');
   if(reducedMotion==='no-preference'){
    await page.keyboard.press('Escape');await page.locator('#diary-reader').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Door · Return to globe'}).focus();await page.keyboard.press('Enter');
    await page.locator('#app.is-travelling').waitFor();await page.evaluate(hash=>{location.hash=hash;},latest);
    await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:30000});
    await page.getByRole('heading',{name:'にゃんこ大戦争',exact:true}).waitFor();
    assert.equal(await page.locator('#app.is-in-room:not(.is-travelling)').count(),1,'A link opened during departure must return to the room before showing the book');
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: blog URLs auto-enter the room, open the linked entry, accept retargeting during load and respect reduced motion');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
