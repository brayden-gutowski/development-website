const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage();
 await page.route('**/index.html',route=>route.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"}}</script>'}));
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+'/index.html');
 const result=await page.evaluate(async()=>{
  const T=await import('three');const {createGainesvilleLamp}=await import('./gainesville-lamp.js');
  const scene=new T.Scene(),originalParent=new T.Group();scene.add(originalParent);
  const mesh=(name,x,y,z,sx,sy,sz)=>{const m=new T.Mesh(new T.BoxGeometry(sx,sy,sz),new T.MeshBasicMaterial());m.name=name;m.position.set(x,y,z);originalParent.add(m);return m;};
  const bulb=mesh('LightBulb008_Geo_LOD0001',-.433,2.43,1.13,.05,.1,.05);
  const shade=mesh('Cone001',-.433,2.45,1.13,.25,.1,.25),cord=mesh('Cylinder004',-.433,3.85,1.13,.017,2.72,.017),leg=mesh('Cylinder003',-.4,1,1,.1,1,.1);
  const ceiling=mesh('Cube_1',0,3.5,0,10,.2,10),architecture=new T.Group();architecture.name='Cube';originalParent.add(architecture);architecture.attach(ceiling);scene.updateMatrixWorld(true);
  const originals=[bulb,shade,cord,leg].map(m=>({m,parent:m.parent,matrix:m.matrixWorld.clone(),position:m.position.clone(),quaternion:m.quaternion.clone(),scale:m.scale.clone()}));
  const lamp=createGainesvilleLamp(scene,[bulb,shade,cord,leg,ceiling]);
  const atRest=originals.every(({m,matrix,parent})=>m.parent===parent&&m.matrixWorld.equals(matrix));
  lamp.trigger();lamp.update(.2,false);const first={...lamp.state},moved=lamp.position.distanceTo(new T.Vector3(-.433,2.43,1.13));
  let low=1,maxAngle=0,left=false,right=false;for(let i=0;i<1200;i++){lamp.update(1/60,false);const s=lamp.state;low=Math.min(low,s.intensity);maxAngle=Math.max(maxAngle,Math.abs(s.angle));left||=s.angle<-.001;right||=s.angle>.001;}
  const settled={...lamp.state},restored=originals.every(({m,parent,position,quaternion,scale})=>m.parent===parent&&m.position.equals(position)&&m.quaternion.equals(quaternion)&&m.scale.equals(scale));
  lamp.trigger();lamp.update(.2,false);const before=lamp.state,pose=bulb.matrixWorld.clone(),parent=bulb.parent;
  lamp.trigger();const after=lamp.state;lamp.update(0,false);
  const continuous=before.angle===after.angle&&before.intensity===lamp.state.intensity&&bulb.parent===parent&&bulb.matrixWorld.equals(pose);
  let repeatedPeak=0;for(let i=0;i<180;i++){lamp.update(1/120,false);repeatedPeak=Math.max(repeatedPeak,Math.abs(lamp.state.angle));}
  function cadence(hz){lamp.reset();lamp.trigger();for(let click=0;click<3;click++){for(let i=0;i<hz/5;i++)lamp.update(1/hz,false);lamp.trigger();}for(let i=0;i<hz/2;i++)lamp.update(1/hz,false);return lamp.state.angle;}
  const frameDifference=Math.abs(cadence(30)-cadence(120));
  lamp.reset();let boundedPeak=0;for(let i=0;i<120;i++){lamp.trigger();for(let j=0;j<4;j++){lamp.update(1/120,false);boundedPeak=Math.max(boundedPeak,Math.abs(lamp.state.angle));}}
  for(let i=0;i<2400;i++)lamp.update(1/120,false);const eventuallySettled=lamp.state;
  lamp.trigger();lamp.update(.3,true);const reduced={...lamp.state};lamp.trigger();lamp.update(.1,true);const reducedRepeated={...lamp.state};lamp.reset();
  return {continuous,repeatedPeak,frameDifference,boundedPeak,eventuallySettled,reducedRepeated,names:lamp.meshes.map(m=>m.name),atRest,first,moved,low,maxAngle,left,right,settled,restored,reduced,reset:lamp.state,pivotY:lamp.pivot.position.y,legParent:leg.parent===originalParent};
 });
 assert.ok(result.continuous,'Another click adds momentum without resetting angle, dim phase, world pose, or parenting');
 assert.ok(result.repeatedPeak>result.maxAngle*1.5,'Quick repeated clicks build a larger swing than one click');
 assert.ok(result.frameDifference<1e-10,'Momentum accumulation and decay are independent of frame cadence');
 assert.ok(result.boundedPeak<=.12&&result.boundedPeak>.06,'Many rapid impulses remain bounded while building energy');
 assert.deepEqual(result.eventuallySettled,{active:false,angle:0,intensity:1});assert.equal(result.reducedRepeated.angle,0);
 assert.equal(result.names.length,3,'Only original cord, shade, and bulb are interactive');
 assert.ok(result.atRest&&result.restored&&result.legParent,'Original poses, parents, and unrelated furniture must survive interaction');
 assert.ok(result.moved>.001&&result.first.active&&result.left&&result.right,'The lamp swings in both directions');
 assert.ok(result.maxAngle<=.025&&result.low>=.55&&result.low<.95,'Swing and dimming remain gentle');
 assert.deepEqual(result.settled,{active:false,angle:0,intensity:1});assert.deepEqual(result.reset,{active:false,angle:0,intensity:1});
 assert.ok(Math.abs(result.pivotY-3.4)<1e-6,'The pivot follows the real ceiling instead of the long cord tip');
 assert.equal(result.reduced.angle,0);assert.ok(result.reduced.intensity<1,'Reduced motion retains one soft dim');
 const actual=await page.evaluate(async()=>{
  const T=await import('three'),{GLTFLoader}=await import('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js'),{createGainesvilleLamp}=await import('./gainesville-lamp.js');
  const {scene:model}=await new GLTFLoader().loadAsync('assets/GainesvilleRoom.glb'),scene=new T.Scene();scene.add(model);const meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const geometry=meshes.map(m=>[m.geometry,m.geometry.attributes.position.count]);const lamp=createGainesvilleLamp(scene,meshes);const original=lamp.position.clone();lamp.trigger();lamp.update(.2,false);const moved=lamp.position.distanceTo(original);lamp.reset();
  return {names:lamp.meshes.map(m=>m.name),pivotY:lamp.pivot.position.y,moved,resetDistance:lamp.position.distanceTo(original),unchanged:meshes.every((m,i)=>m.geometry===geometry[i][0]&&m.geometry.attributes.position.count===geometry[i][1]),count:meshes.length};
 });
 assert.equal(actual.names.length,3,'The exported GLTF names identify all three original lamp parts');assert.ok(actual.count>=13&&actual.unchanged);
 assert.ok(Math.abs(actual.pivotY-3.3865)<.002,'The original architecture supplies the true ceiling height');assert.ok(actual.moved>.001);assert.ok(actual.resetDistance<1e-12);
 console.log('PASS: original lamp accumulates bounded momentum without pose jumps, respects frame cadence/reduced motion, and restores source transforms');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
