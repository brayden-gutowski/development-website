const assert=require('node:assert/strict'),{chromium}=require('playwright');
// The continuous binding has no source-to-replacement material handoff.
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/script.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+';window.room=()=>japanRoom;window.reader=()=>diaryReader;'});});
 await page.goto('http://127.0.0.1:4173/#blog/intermediate-japanese/blog-entry-9-11-2026');await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:60000});await page.evaluate(()=>reader().close(true));
 const snapshot=()=>page.evaluate(()=>{
  const b=room().diaryBinding;
  return b.meshes.flatMap(mesh=>(Array.isArray(mesh.material)?mesh.material:[mesh.material]).filter(m=>m.name!=='Printed diary pages').map(m=>({uuid:m.uuid,color:m.color.toArray(),map:m.map?.uuid,roughness:m.roughness,opacity:m.opacity,lit:m.isMeshStandardMaterial})));
 });
 const original=await snapshot();assert.ok(original.every(m=>m.lit&&m.opacity===1),'Covers and rims use opaque physical materials');
 await page.evaluate(async()=>{await reader().open(null,false);window.step=reader().update;reader().update=()=>{};});
 for(let frame=0;frame<50;frame++){
  await page.evaluate(()=>step(.05,false));assert.deepEqual(await snapshot(),original,'Pickup preserves the actual cover and lining albedo, texture and roughness while lighting changes naturally');
 }
 await page.screenshot({path:'/tmp/diary-consistent-cover-color.png'});
 await page.evaluate(()=>{reader().close();for(let frame=0;frame<50;frame++)step(.05,false);});
 assert.deepEqual(await snapshot(),original,'Returning preserves the same physical materials');assert.deepEqual(errors,[]);
 console.log('PASS: unchanged opaque cover, lining and rim materials through pickup, reading and return');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
