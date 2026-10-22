const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/script.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`;window.currentDiary=()=>diaryReader;window.currentRoom=()=>japanRoom;`});});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');await page.locator('#loading-screen').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Tokyo, Japan/}).click();await page.getByRole('button',{name:'Explore',exact:true}).click();
  await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
  await page.getByRole('button',{name:'Diary · Japanese Blog'}).focus();await page.keyboard.press('Enter');
  await page.locator('#diary-reader[data-phase="flying"]').waitFor();
  await page.evaluate(()=>{const reader=window.currentDiary();window.savedDiaryUpdate=reader.update;reader.update=()=>{};for(let i=0;i<19;i++)window.savedDiaryUpdate(.05,false);});
  assert.equal(await page.locator('.diary-book').evaluate(e=>getComputedStyle(e).visibility),'visible','Printed pages remain visible in flight');
  assert.equal(await page.locator('.diary-spread .diary-page--left img').count(),0,'The contents spread has a blank left endpaper');
  assert.deepEqual(await page.locator('.diary-spread .diary-toc-title').allTextContents(),['初めまして','ジョジョのきみょうなぼうけんパートランキング','にゃんこ大戦争']);
  const hinge=await page.evaluate(()=>{const rig=window.currentRoom().scene.getObjectByName('Blender diary binding');return {open:Number(document.querySelector('#diary-reader').style.getPropertyValue('--diary-open')),animation:rig.userData.animation,cover:rig.userData.frontAngle,pages:rig.userData.pagesAngle,print:rig.userData.printedReady};});
  assert.ok(hinge.open>0&&hinge.open<1&&hinge.cover>hinge.pages&&hinge.print&&hinge.animation==='Diary_Pickup_Open','The Blender cover leads printed bound pages during pickup');
  await page.screenshot({path:'/tmp/diary-printed-opening.png'});
  await page.evaluate(()=>{window.currentDiary().update=window.savedDiaryUpdate;});
  await page.locator('#diary-reader[data-phase="reading"]').waitFor();await page.screenshot({path:'/tmp/diary-chronological-contents.png'});
  for(const title of ['初めまして','ジョジョのきみょうなぼうけんパートランキング']){
   await page.getByRole('button',{name:title,exact:true}).click();await page.locator('.diary-turn').waitFor({state:'hidden'});
   assert.equal(await page.locator('.diary-spread .diary-photo img').count(),3,'Use spare album space for a third existing picture');
   assert.equal(await page.locator('.diary-spread .diary-page--left').evaluate(e=>e.scrollHeight<=e.clientHeight+2),true);
   await page.screenshot({path:`/tmp/diary-three-photos-${title==='初めまして'?'intro':'jojo'}.png`});
   await page.getByRole('button',{name:'Diary contents',exact:true}).click();await page.locator('.diary-turn').waitFor({state:'hidden'});
  }
  await page.keyboard.press('Escape');await page.locator('#diary-reader').waitFor({state:'hidden'});assert.deepEqual(errors,[]);
  console.log('PASS: printed contents throughout opening, no dark blank rig, chronological navigation, blank contents endpaper and fitted third pictures');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
