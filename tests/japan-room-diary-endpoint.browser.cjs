const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.route('**/script.js*',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:await s.text()+';window.reader=()=>diaryReader;window.room=()=>japanRoom;window.gpu=()=>renderer;'});});
 await page.goto('http://127.0.0.1:4173/');await page.locator('#loading-screen').waitFor({state:'hidden'});await page.getByRole('button',{name:/Tokyo, Japan/}).click();await page.getByRole('button',{name:'Explore',exact:true}).click();await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
 await page.getByRole('button',{name:'Diary · Japanese Blog'}).focus();await page.keyboard.press('Enter');await page.locator('#diary-reader[data-phase="reading"]').waitFor();
 const settled=await page.evaluate(()=>({
  ...room().scene.getObjectByName('Blender diary binding').userData,
  backing:room().diaryBinding.object.visible?1:0,
 }));
 console.log('Fully open binding:',settled);
 assert.ok(Math.abs(settled.frontAngle-Math.PI)<.0001,'A fully open cover must remain open when Blender changes quaternion sign at 180 degrees');
 assert.ok(Math.abs(settled.pagesAngle-Math.PI)<.0001,'The page block must also remain fully open at the endpoint');
 assert.ok(settled.backing>.9999,'Keep the physical leather binding visible through arrival');
 await page.keyboard.press('ArrowRight');await page.locator('.diary-turn').waitFor({state:'hidden'});await page.keyboard.press('Escape');await page.locator('#diary-reader').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>room().scene.getObjectByName('Blender diary binding')===room().diaryBinding.object&&room().diaryBinding.object.visible),true,'Returning the diary restores the persistent physical binding');
 console.log('PASS: sign-invariant book endpoint, solid leather backing, page turns and cleanup');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
