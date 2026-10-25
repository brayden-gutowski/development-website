const assert = require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/script.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+';window.gainesvilleTest=()=>({room:activeRoom(),location:roomLocationId,travel:tokyoVisit});'});});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');
  await page.locator('#loading-screen').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Gainesville, Florida/}).click();
  await page.getByRole('button',{name:'Explore',exact:true}).click({timeout:4000});
  await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
  assert.equal(await page.evaluate(()=>gainesvilleTest().location),'gainesville');
  assert.equal(await page.locator('#room-hud [data-room-action]:visible').count(),3);
  const points=await page.evaluate(async()=>{
   const T=await import('three'),{room}=gainesvilleTest();room.scene.updateMatrixWorld(true);room.camera.updateMatrixWorld(true);
   const points={};
   for(const [name,action] of [['Computer','computer'],['Screen','computer'],['ExitSign','door']]){
    const o=room.scene.getObjectByName(name);if(!o)throw Error('Missing '+name);
    const p=new T.Box3().setFromObject(o).getCenter(new T.Vector3()).project(room.camera);
    if(Math.abs(p.x)>1||Math.abs(p.y)>1)throw Error(name+' outside view');
    if(room.pick(p.x,p.y)!==action)throw Error(name+' not pickable');
    points[name]={x:(p.x+1)*720,y:(1-p.y)*450};
   }
   const actions=new Set();room.scene.traverse(o=>{if(o.userData.roomAction)actions.add(o.userData.roomAction)});
   if([...actions].sort().join(',')!=='computer,door,lamp')throw Error('Unexpected actions');
   room.highlight(null);if(room.outline.selectedObjects.length)throw Error('Desktop idle outlines should be empty');
   return points;
  });
  const base=await page.evaluate(()=>gainesvilleTest().room.camera.position.toArray());
  await page.screenshot({path:'/tmp/gainesville-room-desktop.png'});
  await page.mouse.click(points.Screen.x,points.Screen.y);
  await page.waitForFunction(base=>gainesvilleTest().room.computerFocused && Math.hypot(...gainesvilleTest().room.camera.position.toArray().map((v,i)=>v-base[i]))>1,base);
  const close=await page.evaluate(()=>gainesvilleTest().room.camera.position.toArray());
  assert.ok(Math.hypot(...close.map((v,i)=>v-base[i]))>1,'Camera moves to computer');
  await page.screenshot({path:'/tmp/gainesville-computer-desktop.png'});
  await page.mouse.click(35,35);
  await page.waitForFunction(base=>!gainesvilleTest().room.computerFocused && Math.hypot(...gainesvilleTest().room.camera.position.toArray().map((v,i)=>v-base[i]))<.001,base);
  assert.ok(await page.evaluate(base=>gainesvilleTest().room.camera.position.distanceTo({x:base[0],y:base[1],z:base[2]})<.001,base));
  await page.getByRole('button',{name:'Exit sign · Return to globe'}).focus();
  await page.keyboard.press('Enter');
  await page.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor({timeout:20000});
  assert.deepEqual(errors,[]);
  console.log('PASS: Gainesville entry, three room actions, computer zoom/outside return, and globe exit');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
