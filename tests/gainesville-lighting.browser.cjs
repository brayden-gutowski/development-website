const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await p.route('**/script.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+';window.lightingRoom=()=>activeRoom();'});});
 await p.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+'/#gainesville');await p.locator('#loading-screen').waitFor({state:'hidden'});
 const surface=await p.evaluate(async()=>{const T=await import('three'),r=lightingRoom(),box=new T.Box3().setFromObject(r.scene.getObjectByName('Computer'));const p=new T.Vector3(box.max.x+.4,box.min.y+.005,(box.min.z+box.max.z)/2).project(r.camera);return {x:(p.x+1)/2,y:(1-p.y)/2};});
 const png=PNG.sync.read(await p.screenshot({path:'/tmp/gainesville-lighting.png'}));
 function luminance(x0,y0,x1,y1){let sum=0,n=0;for(let y=Math.floor(y0*png.height);y<y1*png.height;y++)for(let x=Math.floor(x0*png.width);x<x1*png.width;x++){const i=(y*png.width+x)*4;sum+=.2126*png.data[i]+.7152*png.data[i+1]+.0722*png.data[i+2];n++;}return sum/n;}
 const wall=luminance(.12,.28,.32,.46),desk=luminance(surface.x-.01,surface.y-.002,surface.x+.01,surface.y+.002);console.log({wall,desk});
 assert.ok(wall<30,'The weak architectural fill must preserve the room’s dark mood');
 assert.ok(desk>40 && desk>wall*3,'The soft pool of light must keep the desk legible against the dark room');
 const materials=await p.evaluate(()=>{const r=lightingRoom();return{screen:r.scene.getObjectByName('Screen').material.emissive.getHex(),baked:r.scene.children.some(o=>o.userData.roomLightingSource==='blender')};});
 assert.ok(materials.baked,'Lighting must come from the Blender source');
 assert.equal(materials.screen,0,'The source CRT is reflective dark glass, not a green light');
 await p.getByRole('button',{name:'Computer · Look closer'}).focus();await p.keyboard.press('Enter');
 await p.waitForFunction(()=>lightingRoom().computerFocused);
 await p.screenshot({path:'/tmp/gainesville-lighting-computer.png'});
 console.log('PASS: dark Blender-style room contrast and unlit CRT glass');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
