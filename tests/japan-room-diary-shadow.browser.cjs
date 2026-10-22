const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.route('**/script.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`
   window.diaryRoom=()=>japanRoom;
   window.shadowSample=()=>{
    const target=japanRoom.scene.getObjectByName('Window sunlight').shadow.map;
    const pixels=new Uint8Array(target.width*target.height*4);renderer.readRenderTargetPixels(target,0,0,target.width,target.height,pixels);
    let hash=2166136261;for(let i=0;i<pixels.length;i+=4)hash=Math.imul(hash^pixels[i],16777619);
    return hash;
   };`});});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');await page.locator('#loading-screen').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Tokyo, Japan/}).click();await page.getByRole('button',{name:'Explore',exact:true}).click();
  await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
  const bake=await page.evaluate(async()=>{
   const T=await import('three'),room=window.diaryRoom(),source=room.scene.getObjectByName('Cube010');
   const center=new T.Box3().setFromObject(source).getCenter(new T.Vector3());center.y+=.3;
   const hit=new T.Raycaster(center,new T.Vector3(0,-1,0)).intersectObject(room.scene.getObjectByName('Cube002'))[0];
   if(!hit?.uv1)throw new Error('Find the actual desk lightmap beneath the diary');
   const average=async src=>{const image=new Image();image.src=src;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const x=Math.floor(hit.uv1.x*c.width),y=Math.floor(hit.uv1.y*c.height),p=ctx.getImageData(x-3,y-3,7,7).data;let n=0;for(let i=0;i<p.length;i+=4)n+=(p[i]+p[i+1]+p[i+2])*p[i+3];return n/(p.length/4);};
   return {old:await average('/assets/room-joinery.png'),live:await average('/assets/room-joinery-dynamic.png'),camera:room.camera.matrixWorld.elements.slice()};
  });
  console.log('Desk indirect illumination below the diary:',bake);
  assert.ok(bake.live>bake.old*1.1,'Remove the baked book occlusion from its former desk position');
  const resting=await page.evaluate(()=>window.shadowSample());
  await page.getByRole('button',{name:'Diary · Japanese Blog'}).focus();await page.keyboard.press('Enter');
  await page.locator('#diary-reader[data-phase="flying"]').waitFor();await page.waitForTimeout(650);
  const moving=await page.evaluate(()=>window.shadowSample());assert.notEqual(moving,resting,'Live sunlight shadow must update during pickup');
  await page.screenshot({path:'/tmp/diary-moving-shadow.png'});
  await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:15000});
  const physical=await page.evaluate(()=>{
   const room=window.diaryRoom(),rig=room.scene.getObjectByName('Blender diary binding'),casters=[],unclosed=[];
   rig.traverse(o=>{if(!o.isMesh)return;casters.push(o.castShadow);
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry,p=g.attributes.position,edges=new Map();
    const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
    for(let i=0;i<p.count;i+=3){const v=[key(i),key(i+1),key(i+2)];for(let e=0;e<3;e++){const pair=[v[e],v[(e+1)%3]].sort().join('|');edges.set(pair,(edges.get(pair)||0)+1);}}
    unclosed.push([...edges.values()].filter(n=>n!==2).length);if(g!==o.geometry)g.dispose();
   });
   return {physical:rig.parent===room.scene,visible:rig.visible,printedFaces:rig.userData.printedFaces,casters,unclosed,camera:room.camera.matrixWorld.elements.slice(),shadow:window.shadowSample()};
  });
  assert.ok(physical.physical&&physical.visible&&physical.printedFaces&&physical.casters.every(Boolean),'The open diary remains a physical caster in the room, with printed faces and solid edges');
  assert.ok(physical.unclosed.every(n=>n===0),'All book solids must be closed manifold surfaces');
  assert.deepEqual(physical.camera,bake.camera,'Picking up the diary keeps the room camera unchanged');
  assert.notEqual(physical.shadow,resting);
  await page.keyboard.press('Escape');await page.locator('#diary-reader').waitFor({state:'hidden'});
  assert.ok(await page.evaluate(()=>{const binding=window.diaryRoom().diaryBinding;return binding.object.visible&&binding.object.userData.frontAngle<.001;}),'The same physical caster returns closed to the desk');
  console.log('PASS: unoccluded desk bake, changing pickup shadow, physical open-book caster, unchanged room camera and caster cleanup');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
