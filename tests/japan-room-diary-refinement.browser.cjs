const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/script.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`;window.blogEntries=JAPANESE_BLOG_CATEGORIES.flatMap(c=>c.entries);window.liveRoom=()=>japanRoom;`});});
   await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');
   await page.locator('#loading-screen').waitFor({state:'hidden'});
   await page.getByRole('button',{name:/Tokyo, Japan/}).click();await page.getByRole('button',{name:'Explore',exact:true}).click();
   await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
   await page.getByRole('button',{name:'Diary · Japanese Blog'}).focus();await page.keyboard.press('Enter');
   await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:15000});
   assert.equal(await page.locator('.diary-identity').isVisible(),false,'Remove the floating title');
   assert.equal(await page.locator('#diary-reader').evaluate(e=>getComputedStyle(e).backgroundImage),'none','Keep the room undimmed');
   const entries=await page.evaluate(()=>window.blogEntries.slice().sort((a,b)=>a.dateTime.localeCompare(b.dateTime)));
   await page.getByRole('button',{name:entries[0].title,exact:true}).click();
   await page.locator('.diary-turn').waitFor({state:'hidden'});
   for(const [i,entry] of entries.entries()){
    const content=await page.locator('.diary-spread').evaluate(e=>({
     body:[...e.querySelectorAll('.diary-copy > p')].map(p=>p.textContent).join(''),
     words:[...e.querySelectorAll('.diary-page--left .diary-word')].map(w=>[...w.children].map(c=>c.textContent)),
     images:[...e.querySelectorAll('.diary-page--left img')].map(img=>({loaded:img.complete&&img.naturalWidth>0,src:img.getAttribute('src')})),
     font:parseFloat(getComputedStyle(e.querySelector('.diary-copy')).fontSize),
     fits:e.querySelector('.diary-copy').scrollHeight<=e.querySelector('.diary-copy').clientHeight+2,
     lines:getComputedStyle(e.querySelector('.diary-copy')).backgroundImage,
     wordsBelow:e.querySelector('.diary-vocabulary').offsetTop>=e.querySelector('.diary-album').offsetTop+e.querySelector('.diary-album').offsetHeight-1,
    }));
    assert.equal(content.body,entry.body.join(''),'Each complete blog fits on one right page');assert.ok(content.fits);
    const imageCount=entry.media.length>2&&entry.glossary.length<=8?3:2;
    assert.deepEqual(content.words,entry.glossary);assert.equal(content.images.length,imageCount);assert.ok(content.images.every(i=>i.loaded));assert.ok(content.wordsBelow);
    assert.ok(content.font<19);assert.match(content.lines,/repeating-linear-gradient/);
    await page.screenshot({path:`/tmp/diary-refined-${viewport.width}-${i}.png`});
    if(viewport.width<700&&i===0){
     await page.getByRole('button',{name:'Left page'}).click();
     await page.waitForTimeout(400);await page.screenshot({path:'/tmp/diary-refined-mobile-photos.png'});
     await page.getByRole('button',{name:'Right page'}).click();await page.waitForTimeout(400);
    }
    if(i<entries.length-1){
     await page.keyboard.press('d');
     await page.waitForFunction(()=>!document.querySelector('.diary-turn').hidden);
     assert.ok(await page.locator('.diary-turn-front .diary-copy').textContent());
     const nextEntry=entries[i+1],nextImages=nextEntry.media.length>2&&nextEntry.glossary.length<=8?3:2;
     assert.equal(await page.locator('.diary-turn-back img').count(),nextImages,'Destination photos must already be on the back of the turning sheet');
     assert.equal(await page.locator('.diary-spread .diary-title').textContent(),entries[i+1].title,'The destination writing is present under the turning sheet from the start');
     if(viewport.width>700&&i===0){
      await page.locator('.diary-turn').evaluate(async e=>{const a=e.getAnimations()[0];a.pause();await a.ready;a.currentTime=550;await new Promise(requestAnimationFrame);});
      assert.match(await page.locator('.diary-turn').evaluate(e=>getComputedStyle(e).transform),/^matrix3d/,'The actual leaf must rotate through 3D');
      await page.screenshot({path:'/tmp/diary-refined-turn.png'});
      await page.locator('.diary-turn').evaluate(e=>e.getAnimations()[0].play());
     }
     await page.locator('.diary-turn').waitFor({state:'hidden'});
     assert.equal(await page.locator('.diary-turn').evaluate(e=>e.getAnimations().length),0,'Completed turns release their animation instead of accumulating frozen sheets');
    }
   }
   await page.keyboard.press('a');await page.locator('.diary-turn').waitFor({state:'hidden'});
   await page.getByRole('heading',{name:entries[1].title,exact:true}).waitFor();
   const box=await page.locator('.diary-viewport').boundingBox();
   await page.mouse.move(box.x+box.width*.8,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.2,box.y+box.height*.5,{steps:12});await page.mouse.up();
   await page.locator('.diary-turn').waitFor({state:'hidden'});await page.getByRole('heading',{name:entries[2].title,exact:true}).waitFor();
   await page.mouse.click(3,3);await page.locator('#diary-reader').waitFor({state:'hidden'});
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: undimmed room, complete lined blog pages, fitted decoded pictures, bottom-left vocabulary, preloaded two-sided turns, A/D, drag and outside dismissal');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
