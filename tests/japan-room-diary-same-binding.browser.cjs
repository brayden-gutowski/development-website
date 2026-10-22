const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.route('**/script.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+';window.reader=()=>diaryReader;window.room=()=>japanRoom;'});});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173/');
  await page.locator('#loading-screen').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Tokyo, Japan/}).click();
  await page.getByRole('button',{name:'Explore',exact:true}).click();
  await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
  const snapshot=()=>page.evaluate(()=>{
   const binding=room().diaryBinding;if(!binding)return null;
   const object=binding.object;object.updateMatrixWorld(true);
   return {uuid:object.uuid,visible:object.visible,parent:object.parent.uuid,frontAngle:object.userData.frontAngle,
    matrix:object.matrix.elements.slice(),sourceHidden:!room().scene.getObjectByName('Cube010').visible,
    meshes:binding.meshes.map(mesh=>({uuid:mesh.uuid,geometry:mesh.geometry.uuid,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>({uuid:m.uuid,opacity:m.opacity,transparent:m.transparent})),cast:mesh.castShadow,receive:mesh.receiveShadow})),
    temporaryLift:!!room().scene.getObjectByName('Diary in hand')};
  });
  const resting=await snapshot();assert.ok(resting,'The animated binding must already exist on the desk before first pickup');
  assert.ok(resting.visible&&resting.sourceHidden&&!resting.temporaryLift);
  await page.getByRole('button',{name:'Diary · Japanese Blog',exact:true}).focus();await page.keyboard.press('Enter');
  await page.locator('#diary-reader[data-phase="flying"]').waitFor();
  await page.evaluate(()=>{window.step=reader().update;reader().update=()=>{};});
  const identity=state=>({uuid:state.uuid,parent:state.parent,meshes:state.meshes});
  for(const frames of [9,15,30]){
   await page.evaluate(n=>{for(let i=0;i<n;i++)step(.05,false);},frames);
   const current=await snapshot();assert.deepEqual(identity(current),identity(resting),'Pickup must preserve actual meshes, geometries and opaque materials');assert.ok(current.visible&&!current.temporaryLift);
  }
  await page.locator('#diary-reader[data-phase="reading"]').waitFor();
  const reading=await snapshot();assert.ok(Math.abs(reading.frontAngle-Math.PI)<.00001,'The 180-degree quaternion pose must remain fully open');
  await page.evaluate(()=>reader().close());
  await page.evaluate(()=>{for(let i=0;i<50;i++)step(.05,false);});
  await page.locator('#diary-reader').waitFor({state:'hidden'});
  const restored=await snapshot();assert.deepEqual(identity(restored),identity(resting));assert.ok(restored.visible&&restored.sourceHidden);
  assert.ok(restored.matrix.every((value,i)=>Math.abs(value-resting.matrix[i])<1e-8),'The exact binding must return to its original desk transform');
  assert.ok(restored.meshes.length>=7&&restored.meshes.every(mesh=>mesh.cast&&mesh.receive&&mesh.materials.every(m=>m.opacity===1&&!m.transparent)));
  console.log('PASS: one opaque, shadow-casting animated binding at rest, in flight, reading and restored');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
