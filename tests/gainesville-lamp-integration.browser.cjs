const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {join}=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const mobile of [false,true]){
  const page=await browser.newPage(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}:{viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.lampAudioStarts=0;const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){lampAudioStarts++;return start.apply(this,args);};});
  if(process.env.GAINESVILLE_DRAFT_DIR){
   await page.route('**/assets/GainesvilleRoom.glb*',r=>r.fulfill({path:join(process.env.GAINESVILLE_DRAFT_DIR,'GainesvilleRoom.glb'),contentType:'model/gltf-binary'}));
   for(const prefix of ['light','practical'])for(const part of ['architecture','furniture'])await page.route('**/assets/gainesville-'+prefix+'-'+part+'.webp*',r=>r.fulfill({path:join(process.env.GAINESVILLE_DRAFT_DIR,'gainesville-'+prefix+'-'+part+'.webp'),contentType:'image/webp'}));
  }
  await page.route('**/script.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+';window.lampReview=()=>({room:activeRoom(),desktop:xpDesktop,exposure:renderer.toneMappingExposure});'});});
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+'/#gainesville');await page.locator('#loading-screen').waitFor({state:'hidden'});
  assert.equal(await page.locator('#room-hud [data-room-action]:visible').count(),3);
  const original=await page.evaluate(async()=>{const T=await import('three'),r=lampReview().room;const shade=r.scene.getObjectByName('Cone001');r.scene.updateMatrixWorld(true);const point=new T.Box3().setFromObject(shade).getCenter(new T.Vector3()).project(r.camera);return{point:{x:(point.x+1)*innerWidth/2,y:(1-point.y)*innerHeight/2},world:shade.matrixWorld.toArray(),exposure:lampReview().exposure};});
  if(mobile)await page.touchscreen.tap(original.point.x,original.point.y);else await page.mouse.click(original.point.x,original.point.y);
  await page.waitForFunction(()=>lampReview().room.lampState.active);
  await page.waitForFunction(()=>lampReview().room.lampState.intensity<.98);
  if(!mobile)await page.waitForFunction(()=>Math.abs(lampReview().room.lampState.angle)>.001);
  else assert.equal(await page.evaluate(()=>lampReview().room.lampState.angle),0,'Reduced motion keeps the lamp still');
  await page.waitForFunction(()=>!lampReview().room.lampState.active,{},{timeout:20000});
  assert.equal(await page.evaluate(()=>lampAudioStarts),0,'The light flickers and swings silently');
  const restored=await page.evaluate(()=>{const r=lampReview().room;r.scene.updateMatrixWorld(true);return r.scene.getObjectByName('Cone001').matrixWorld.toArray();});
  assert.ok(restored.every((value,i)=>Math.abs(value-original.world[i])<1e-10),'Swing restores the original model pose');
  await page.getByRole('button',{name:'Computer · Look closer'}).focus();await page.keyboard.press('Enter');await page.locator('#xp-computer[data-phase="desktop"]').waitFor({timeout:20000});await page.waitForTimeout(600);
  const desktop=await page.evaluate(()=>lampReview().room.displayState);
  const general=page.locator('[data-xp-folder="general"]');if(mobile)await general.tap();else await general.dblclick();
  const file=page.getByRole('button',{name:'Towski.dev.txt',exact:true});if(mobile)await file.tap();else await file.dblclick();
  await page.getByRole('button',{name:'Maximize Towski.dev.txt - Notepad',exact:true}).click();await page.waitForTimeout(700);
  const white=await page.evaluate(()=>lampReview().room.displayState);assert.ok(white.brightness>desktop.brightness+.3&&white.spill>desktop.spill*1.5,'Visible white windows brighten the physical room spill');
  if(!mobile)await page.screenshot({path:'/tmp/gainesville-reviewed-white-screen.png'});
  await page.evaluate(()=>lampReview().desktop.close(true));const start=await page.evaluate(()=>lampReview().room.displayState.spill);assert.ok(start>0,'Power-off begins a fade instead of cutting illumination');
  await page.waitForFunction(()=>lampReview().room.displayState.spill<.03);assert.equal(await page.evaluate(()=>lampReview().exposure),original.exposure,'Exposure stays constant across room, desktop, white window and off');
  if(!mobile)await page.screenshot({path:'/tmp/gainesville-reviewed-off-screen.png'});
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: desktop/touch lamp click, gentle flicker and swing, reduced motion, exact rest pose, visible-content lighting, smooth off fade and constant exposure');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
