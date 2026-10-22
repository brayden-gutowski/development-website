const assert=require('node:assert/strict'),{chromium}=require('playwright'),{PNG}=require('pngjs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.route('**/script.js*',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:await s.text()+';window.reader=()=>diaryReader;window.room=()=>japanRoom;'});});
 await page.goto('http://127.0.0.1:4173/#blog/intermediate-japanese/blog-entry-9-11-2026');await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:60000});await page.evaluate(()=>reader().close(true));
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
 const coverPoint=()=>page.evaluate(async()=>{const T=await import('three'),r=room(),source=r.scene.getObjectByName('Cube010'),held=r.scene.getObjectByName('Diary in hand');let point;
  if(!held||held.visible){const bounds=new T.Box3().setFromObject(source);point=bounds.getCenter(new T.Vector3());point.y=bounds.max.y;}
  else{const mesh=r.scene.getObjectByName('Blender diary binding').getObjectByName('Front_board');mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox;point=b.getCenter(new T.Vector3());point.z=b.max.z;point.applyMatrix4(mesh.matrixWorld);}
  point.project(r.camera);return {x:Math.round((point.x+1)*innerWidth/2),y:Math.round((1-point.y)*innerHeight/2)};
 });
 const color=async()=>{const point=await coverPoint(),png=PNG.sync.read(await page.screenshot({clip:{x:point.x-4,y:point.y-4,width:8,height:8}})),rgb=[0,0,0];for(let i=0;i<png.data.length;i+=4)for(let c=0;c<3;c++)rgb[c]+=png.data[i+c]/64;return rgb;};
 const resting=await color();
 await page.evaluate(async()=>{await reader().open(null,false);window.step=reader().update;reader().update=()=>{};});
 const samples=[];
 for(let frame=0;frame<18;frame++){
  await page.evaluate(()=>step(.02,false));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));samples.push(await color());
 }
 const deltas=samples.map(rgb=>rgb.reduce((sum,v,i)=>sum+Math.abs(v-resting[i]),0)/3),max=Math.max(...deltas);
 console.log('Initial pickup cover RGB deviations:',deltas.map(n=>Number(n.toFixed(2))));
 assert.ok(max<10,'The cover must retain its opaque resting appearance on every initial pickup frame; peak RGB change '+max);
 await page.screenshot({path:'/tmp/diary-initial-pickup-fixed.png'});
 console.log('PASS: no translucent yellow-page flash during the initial pickup swap');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
