const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/script.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`;window.departureProbe=()=>({ready:backgroundAreasStarted&&areaLoads.size===0,pending:roomIsLoading,visible:roomIsVisible,pixels:cityFlight?.group.children.filter(o=>o.material?.map?.image?.width).length||0});`});});
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+'/#tokyo');await page.locator('#loading-screen').waitFor({state:'hidden'});await page.waitForFunction(()=>departureProbe().ready,null,{timeout:120000});
 await page.evaluate(()=>{const native=createImageBitmap.bind(window);window.decodeStarted=false;let release;const held=new Promise(r=>release=r);window.releaseDeparture=release;window.createImageBitmap=async(...args)=>{decodeStarted=true;await held;return native(...args);};});
 await page.getByRole('button',{name:'Door · Return to globe',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>decodeStarted&&departureProbe().pending);
 await page.evaluate(()=>{location.hash='#tokyo/diary/table-of-contents';});await page.locator('#diary-reader[data-phase="reading"]').waitFor();await page.evaluate(()=>releaseDeparture());
 await page.waitForFunction(()=>!departureProbe().pending);assert.deepEqual(await page.evaluate(()=>({visible:departureProbe().visible,pixels:departureProbe().pixels})),{visible:true,pixels:0},'Canceling departure keeps the room visible and releases restored aerial pixels');assert.equal(await page.locator('#app.is-travelling').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: canceled departure releases late decoded flight pixels while current room remains usable');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
