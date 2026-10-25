const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/script.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+';window.proportionRoom=()=>activeRoom();'});});
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+'/#gainesville');await page.locator('#loading-screen').waitFor({state:'hidden'});
 const result=await page.evaluate(async()=>{const T=await import('three'),room=proportionRoom();room.scene.updateMatrixWorld(true);const body=new T.Box3().setFromObject(room.scene.getObjectByName('Computer')),glass=new T.Box3().setFromObject(room.scene.getObjectByName('Screen')),size=body.getSize(new T.Vector3()),display=glass.getSize(new T.Vector3());return{aspect:display.x/display.y,height:size.y,depth:size.z,borders:[glass.min.x-body.min.x,body.max.x-glass.max.x,glass.min.y-body.min.y,body.max.y-glass.max.y]};});
 assert.ok(Math.abs(result.aspect-4/3)<.0001,'The original glass must have a true 4:3 aspect ratio');
 assert.ok(Math.max(...result.borders)-Math.min(...result.borders)<.00002,'All four bezel borders must be even');
 assert.ok(Math.abs(result.height-.62565386)<.00002,'Original case height stays intact');
 assert.ok(Math.abs(result.depth-.5904665)<.00002,'Original tapered casing depth stays intact');
 await page.screenshot({path:'/tmp/gainesville-proportions-room.png'});
 await page.getByRole('button',{name:'Computer · Look closer'}).focus();await page.keyboard.press('Enter');await page.locator('#xp-computer[data-phase="desktop"]').waitFor({timeout:20000});
 const rect=await page.evaluate(()=>proportionRoom().getScreenRect());assert.ok(Math.abs(rect.width/rect.height-4/3)<.0001,'XP aligns with the widened original glass');
 await page.screenshot({path:'/tmp/gainesville-proportions-computer.png'});assert.deepEqual(errors,[]);
 console.log('PASS: original CRT has 4:3 glass, even borders, preserved height/depth, aligned XP and no browser errors');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
