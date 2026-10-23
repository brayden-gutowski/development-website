const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});try{const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/script.js*',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:await s.text()+';window.room=()=>japanRoom;'});});
 await page.goto('http://127.0.0.1:4173/');await page.locator('#loading-screen').waitFor({state:'hidden'});await page.getByRole('button',{name:/Tokyo, Japan/}).click();await page.getByRole('button',{name:'Explore',exact:true}).click();await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
 const result=await page.evaluate(async()=>{
  const r=room(),vinyl=r.scene.getObjectByName('Vinyl'),labels=[];
  vinyl.traverse(o=>{if(o.isMesh&&o.material.map?.image?.src?.includes('kroi-spin-cover'))labels.push(o);});
  const a=document.querySelector('#tokyo-record-track');a.volume=0;
  window.tick=r.update.bind(r);r.update=()=>{};await r.soundtrack.toggle();
  for(let i=0;i<30;i++)tick(.05,false);
  const arm=r.scene.getObjectByName('Cylinder005').userData.recordArm;
  const first=arm.yaw,angle=vinyl.rotation.y;tick(.5,false);const spun=(angle-vinyl.rotation.y+Math.PI*2)%(Math.PI*2);
  if(!Number.isFinite(a.duration))await new Promise(resolve=>a.addEventListener('loadedmetadata',resolve,{once:true}));
  // Blob playback permits seeking with the local preview server's non-range responses.
  const blob=await fetch(a.currentSrc).then(r=>r.blob());a.src=URL.createObjectURL(blob);await a.play();a.pause();
  const yaws=[],radii=[];
  for(const p of [0,.25,.5,.75,.98]){
   a.currentTime=a.duration*p;tick(.05,false);yaws.push(arm.yaw);r.scene.updateMatrixWorld(true);
   const point=r.scene.getObjectByName('Record player pitch pivot').children[0].localToWorld(vinyl.position.clone().set(.107555,-.030383,-.076219));
   const center=vinyl.getWorldPosition(vinyl.position.clone());radii.push(Math.hypot(point.x-center.x,point.z-center.z));
  }
  r.soundtrack.stop(false);for(let i=0;i<30;i++)tick(.05,false);const pausedAngle=vinyl.rotation.y;tick(1,false);const paused=vinyl.rotation.y===pausedAngle,parked=arm.phase;
  await r.soundtrack.toggle();for(let i=0;i<30;i++)tick(.05,false);const resumed=arm.yaw;r.soundtrack.stop();
  const sleeve=r.scene.getObjectByName('Record sleeve');
  return{labels:labels.length,sleeveUsesCover:sleeve.material.some(m=>m.map?.image?.src?.includes('kroi-spin-cover')),vertexCount:labels.map(o=>o.geometry.attributes.position.count),first,spun,yaws,radii,paused,parked,resumed,progress:r.soundtrack.progress,errors:[]};
 });
 console.log(result);assert.equal(result.labels,2,'Map the uploaded image across the existing circular label faces');assert.ok(result.sleeveUsesCover,'Use the supplied SPIN cover on the sleeve too');assert.ok(Math.abs(result.spun-Math.PI*2*33.333333/60*.5)<.01,'Rotate the whole disc at 33⅓ RPM');
 assert.ok(result.yaws.every((v,i)=>i===0||v<result.yaws[i-1]),'Track the stylus progressively toward the middle as the song advances');assert.ok(result.first-result.yaws.at(-1)>.4,'Make the full playback arc visible');assert.ok(result.radii.every((v,i)=>i===0||v<result.radii[i-1]),'The actual stylus must approach the record center without lifting off the disc');assert.ok(result.radii.at(-1)<result.radii[0]-.045);assert.ok(result.paused);assert.equal(result.parked,'parked');assert.ok(Math.abs(result.resumed-result.yaws.at(-1))<.002,'Resume at the groove matching the retained song position');assert.deepEqual(errors,[]);
 console.log('PASS: circular uploaded label, visible disc spin, playback-driven inward tracking and parked pause');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
