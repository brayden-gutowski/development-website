const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 for(const mobile of [false,true]){
  const p=await b.newPage(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}:{viewport:{width:1440,height:900}}),errors=[],requests=[],requestTimes=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{requests.push(r.url());requestTimes.push({url:r.url(),at:Date.now()});});
  await p.route('**/script.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+';window.testRoom=()=>activeRoom();window.testFlight=()=>({cityFlight,state,roomLocationId});new MutationObserver(()=>{if(ui.loading.classList.contains("is-complete"))window.foregroundReadyAt ||=Date.now();}).observe(ui.loading,{attributes:true,attributeFilter:["class"]});'});});
  await p.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+(mobile?'/#gainesville':''));
  await p.locator('#loading-screen').waitFor({state:'hidden'});
  if(!mobile){
   await p.getByRole('button',{name:/Gainesville, Florida/}).click();await p.getByRole('button',{name:'Explore',exact:true}).click();
   await p.locator('#app.is-travelling').waitFor({timeout:60000});
   await p.waitForFunction(()=>+document.querySelector('#city-flight').dataset.zoom>14);
   assert.ok(requests.some(u=>/gainesville-flight\/16.webp/.test(u)));
   assert.ok(!requests.some(u=>/tokyo-flight\/\d+.webp/.test(u)),'Gainesville uses its own imagery');
  }else {const readyAt=await p.evaluate(()=>foregroundReadyAt);assert.ok(requestTimes.filter(r=>/earth-|JapanRoom|tokyo-window/.test(r.url)).every(r=>r.at>=readyAt),'Direct Gainesville entry prioritizes foreground readiness before background media');}
  await p.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
  const points=await p.evaluate(async()=>{const T=await import('three'),r=testRoom();r.scene.updateMatrixWorld(true);r.camera.updateMatrixWorld(true);const points={};for(const name of ['Screen','ExitSign']){const c=new T.Box3().setFromObject(r.scene.getObjectByName(name)).getCenter(new T.Vector3()).project(r.camera);if(Math.abs(c.x)>.9||Math.abs(c.y)>.9)throw Error(name+' needs room around it');points[name]={x:(c.x+1)*innerWidth/2,y:(1-c.y)*innerHeight/2};}return points;});
  await p.screenshot({path:mobile?'/tmp/gainesville-room-mobile.png':'/tmp/gainesville-arrival.png'});
  const click=async point=>{if(mobile)await p.touchscreen.tap(point.x,point.y);else await p.mouse.click(point.x,point.y);};
  const base=await p.evaluate(()=>testRoom().camera.position.toArray());
  await click(points.Screen);await p.waitForFunction(()=>testRoom().computerFocused);
  await p.waitForFunction(()=>testRoom().camera.position.z> -1.2);
  await p.screenshot({path:mobile?'/tmp/gainesville-computer-mobile.png':'/tmp/gainesville-computer-flight.png'});
  if(mobile)await p.touchscreen.tap(3,3);else await click({x:20,y:20});await p.waitForFunction(base=>!testRoom().computerFocused&&testRoom().camera.position.distanceTo({x:base[0],y:base[1],z:base[2]})<.02,base);
  await p.mouse.move(0,0);await p.evaluate(()=>testRoom().point(0,0));await p.waitForTimeout(500);
  await click(points.ExitSign);await p.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor({timeout:30000});
  assert.equal(await p.evaluate(()=>testFlight().roomLocationId),'gainesville');
  assert.deepEqual(errors,[]);
  await p.close();
 }
 console.log('PASS: Gainesville aerial arrival, desktop/mobile object clicks, smooth computer return, direct entry and globe departure');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
