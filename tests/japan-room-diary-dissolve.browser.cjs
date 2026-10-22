const assert=require('node:assert/strict'),{chromium}=require('playwright');
// The obsolete two-book dissolve was replaced by one persistent opaque binding.
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await page.route('**/script.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+';window.room=()=>japanRoom;window.reader=()=>diaryReader;'});});
 await page.goto('http://127.0.0.1:4173/#blog/intermediate-japanese/blog-entry-9-11-2026');await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:60000});
 const result=await page.evaluate(async()=>{
  const r=reader();r.close(true);window.step=r.update;r.update=()=>{};await r.open(null,false);
  const uuid=room().diaryBinding.object.uuid,samples=[];
  for(let i=0;i<150&&document.querySelector('#diary-reader').dataset.phase!=='reading';i++){
   step(.02,false);const binding=room().diaryBinding;
   samples.push({same:binding.object.uuid===uuid,visible:binding.object.visible,opaque:binding.meshes.every(mesh=>(Array.isArray(mesh.material)?mesh.material:[mesh.material]).every(m=>m.opacity===1&&!m.transparent)),presence:Number(document.querySelector('#diary-reader').style.getPropertyValue('--diary-presence'))});
  }
  return {samples,duplicate:!!room().scene.getObjectByName('Diary in hand'),phase:document.querySelector('#diary-reader').dataset.phase};
 });
 assert.ok(result.samples.length>20&&result.samples.every(s=>s.same&&s.visible&&s.opaque),'A single opaque physical binding remains visible throughout pickup');
 assert.equal(result.duplicate,false);assert.equal(result.phase,'reading');assert.ok(result.samples.some(s=>s.presence>0&&s.presence<1),'Readable HTML fades over the printed physical pages near arrival');
 console.log('PASS: continuous opaque pickup and gradual readable-page arrival');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
