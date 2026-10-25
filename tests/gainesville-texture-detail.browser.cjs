const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 if(process.env.GAINESVILLE_DETAIL_GLB)await p.route('**/assets/GainesvilleRoom.glb*',r=>r.fulfill({path:process.env.GAINESVILLE_DETAIL_GLB,contentType:'model/gltf-binary'}));
 await p.route('**/script.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+';window.textureRoom=()=>activeRoom();'});});
 await p.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+'/#gainesville');await p.locator('#loading-screen').waitFor({state:'hidden'});
 const walls=await p.evaluate(()=>{const result=new Map();textureRoom().scene.traverse(o=>{for(const m of [o.material].flat().filter(Boolean))if(/BrickWallOld|PlasterStucco/.test(m.name))result.set(m.name,{name:m.name,size:[m.map.image.width,m.map.image.height],normal:[m.normalMap.image.width,m.normalMap.image.height],repeat:m.map.repeat.toArray(),offset:m.map.offset.toArray(),anisotropy:m.map.anisotropy,lightRepeat:m.lightMap.repeat.toArray(),lightChannel:m.lightMap.channel});});return [...result.values()];});
 assert.equal(walls.length,2);
 for(const wall of walls){assert.deepEqual(wall.size,[2048,2048]);assert.deepEqual(wall.normal,[2048,2048]);assert.ok(wall.anisotropy>=8);assert.deepEqual(wall.lightRepeat,[1,1],'Material tiling must not distort the lightmap');assert.equal(wall.lightChannel,1);const scale=wall.name.includes('Brick')?9.18:3;assert.ok(wall.repeat.every(v=>Math.abs(v-scale)<.0001),'Keep the original Blender brick/plaster scale');}
 await p.screenshot({path:'/tmp/gainesville-sharp-wall-textures.png'});assert.deepEqual(errors,[]);
 console.log('PASS: wall tiles retain2048px color/normal detail, original Blender repeats, anisotropic filtering and separate lighting UVs');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
