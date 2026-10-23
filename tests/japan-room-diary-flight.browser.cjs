const assert=require('node:assert/strict');
const{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
 const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/script.js*',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:await s.text()+';window.reader=()=>diaryReader;window.room=()=>japanRoom;'});});
 await page.goto('http://127.0.0.1:4173/#blog/intermediate-japanese/blog-entry-9-11-2026');
 await page.locator('#diary-reader[data-phase="flying"]').waitFor({timeout:60000});
 await page.evaluate(()=>{const r=window.reader();window.advance=r.update;r.update=()=>{};for(let i=0;i<16;i++)window.advance(.05,false);});
 const mid=await page.evaluate(()=>{const root=document.querySelector('#diary-reader');return {open:Number(root.style.getPropertyValue('--diary-open')),meshes:window.room().scene.getObjectByName('Blender diary binding').userData.meshes};});
 assert.ok(mid.open>0&&mid.open<1,'The diary must open during pickup');assert.ok(mid.meshes>=7,'The Blender book must contain solid covers, bound page blocks and leaves');
 await page.screenshot({path:`/tmp/diary-flight-mid-${viewport.width}.png`});
 const arrival=await page.evaluate(()=>{let before,after;const root=document.querySelector('#diary-reader'),right=()=>document.querySelector('.diary-spread .diary-page--right').getBoundingClientRect().toJSON();for(let i=0;i<220&&root.dataset.phase==='flying';i++){before=right();window.advance(.01,false);after=right();}return {before,after};});
 for(const edge of ['left','right','top','bottom'])assert.ok(Math.abs(arrival.before[edge]-arrival.after[edge])<.15,'The fully open flight pose must settle into reading without a snap');
 assert.equal(await page.locator('#diary-reader').getAttribute('data-phase'),'reading');
 const button=page.locator('.diary-spread .diary-contents'),left=await page.locator('.diary-spread .diary-page--left').boundingBox(),b=await button.boundingBox();
 assert.ok(b.x>left.x&&b.x<left.x+left.width*.3&&b.y<left.y+60,'Contents belongs at the upper left of the left page');
 assert.equal(await page.locator('.diary-page-controls .diary-contents').count(),0);
 if(viewport.width<700){await page.getByRole('button',{name:'Left page'}).click();await page.waitForTimeout(400);await button.click();await page.locator('.diary-turn').waitFor({state:'hidden'});await page.keyboard.press('ArrowRight');await page.locator('.diary-turn').waitFor({state:'hidden'});}
 assert.equal(await page.locator('.diary-book').evaluate(e=>getComputedStyle(e,'::after').content),'none','A rectangular page block must not bleed above the curved top edge');
 await page.screenshot({path:`/tmp/diary-flight-reading-${viewport.width}.png`});
 await page.keyboard.press('Escape');await page.evaluate(()=>{for(let i=0;i<10;i++)window.advance(.05,false);});
 const returning=await page.evaluate(()=>({phase:document.querySelector('#diary-reader').dataset.phase,open:Number(document.querySelector('#diary-reader').style.getPropertyValue('--diary-open')),native:!!window.room().scene.getObjectByName('Blender diary binding')}));
 assert.equal(returning.phase,'returning');assert.ok(returning.open>0&&returning.open<1,'Close the book while it returns to the desk');assert.ok(returning.native);
 await page.screenshot({path:`/tmp/diary-flight-return-${viewport.width}.png`});
 await page.evaluate(()=>{for(let i=0;i<50;i++)window.advance(.05,false);});await page.locator('#diary-reader').waitFor({state:'hidden'});assert.deepEqual(errors,[]);
 await page.close();}
 console.log('PASS: printed diary opens and closes in flight, left-page Contents, no rectangular top-edge lines');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
