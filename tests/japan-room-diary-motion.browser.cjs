const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/script.js*',async route=>{
   const response=await route.fetch();
   await route.fulfill({response,body:await response.text()+`
    window.diaryEntries = JAPANESE_BLOG_CATEGORIES.flatMap(c=>c.entries);
    window.diaryPose = () => ['Blender diary binding','Cylinder006'].map(name=>{
     const o=japanRoom.scene.getObjectByName(name); o.updateWorldMatrix(true,false);
     return {name,parent:o.parent.name,position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),world:o.matrixWorld.elements.slice(),visible:o.visible};
    });`});
  });
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');
  await page.locator('#loading-screen').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Tokyo, Japan/}).click();
  await page.getByRole('button',{name:'Explore',exact:true}).click();
  await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
  const pose=await page.evaluate(()=>window.diaryPose());
  const open=async()=>{await page.getByRole('button',{name:'Diary · Japanese Blog'}).focus();await page.keyboard.press('Enter');};
  await open();
  await page.locator('#diary-reader[data-phase="flying"]').waitFor();
  await page.waitForTimeout(700);
  const flying=await page.evaluate(()=>window.diaryPose());
  assert.equal(flying[0].parent,pose[0].parent,'The persistent diary keeps its scene parent throughout pickup');
  assert.deepEqual(flying[1],pose[1],'The pen stays on the desk');
  assert.ok(Math.hypot(...flying[0].world.slice(12,15).map((v,i)=>v-pose[0].world[i+12]))>.3,'The actual diary must travel toward the camera');
  await page.screenshot({path:'/tmp/tokyo-diary-flight.png'});
  assert.ok(await page.locator('#diary-reader').evaluate(e=>Number(e.style.getPropertyValue('--diary-open'))>0),'The book opens during flight');
  await page.waitForTimeout(420);
  await page.screenshot({path:'/tmp/tokyo-diary-opening.png'});
  await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:15000});
  await page.screenshot({path:'/tmp/tokyo-diary-contents.png'});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.locator('#diary-reader').waitFor({state:'hidden'});
  assert.deepEqual(await page.evaluate(()=>window.diaryPose()),pose,'Closing must restore exact source parents, transforms and visibility');
  assert.equal(await page.getByRole('button',{name:'Diary · Japanese Blog'}).evaluate(e=>e===document.activeElement),true);
  await open();await page.waitForTimeout(350);await page.keyboard.press('Escape');
  await page.locator('#diary-reader').waitFor({state:'hidden'});
  assert.deepEqual(await page.evaluate(()=>window.diaryPose()),pose,'Cancelling mid-flight must also restore exact authored transforms');
  assert.deepEqual(errors,[]);
  console.log('PASS: actual diary flight, opening, exact restoration, repeated close and interrupted return');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
