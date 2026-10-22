const assert=require('node:assert/strict'),{chromium}=require('playwright'),{PNG}=require('pngjs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage({viewport:{width:1920,height:1200}});
 await page.route('**/script.js*',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:await s.text()+';window.reader=()=>diaryReader;window.room=()=>japanRoom;'});});
 await page.goto('http://127.0.0.1:4173/#blog/intermediate-japanese/blog-entry-9-11-2026');await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:60000});await page.evaluate(()=>reader().close(true));
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
 const points=async native=>page.evaluate(async native=>{
  const T=await import('three'),r=room(),result={};
  for(const [kind,name]of Object.entries(native?{leather:'Flexible_case_spine',paper:'Right_page_block'}:{leather:'Cube015',paper:'Cube015_1'})){
   const mesh=r.scene.getObjectByName(native?'Blender diary binding':'Cube010').getObjectByName(name),g=mesh.geometry,p=g.attributes.position,idx=g.index,eye=r.camera.getWorldPosition(new T.Vector3()),samples=[];
   for(let i=0;i<(idx?.count||p.count);i+=3){
    const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld)),normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])),center=v[0].clone().add(v[1]).add(v[2]).divideScalar(3);
    if(Math.abs(normal.clone().normalize().y)>.4)continue;
    const weight=normal.dot(eye.clone().sub(center).normalize());if(weight<=0)continue;
    center.project(r.camera);samples.push({x:Math.round((center.x+1)*innerWidth/2),y:Math.round((1-center.y)*innerHeight/2),weight});
   }result[kind]=samples.sort((a,b)=>b.weight-a.weight).slice(0,20);
  }return result;
 },native);
 const colors=(png,samples)=>Object.fromEntries(Object.entries(samples).map(([kind,points])=>{const weight=points.reduce((sum,p)=>sum+p.weight,0),rgb=[0,0,0];for(const p of points){const offset=(p.y*png.width+p.x)*4;for(let c=0;c<3;c++)rgb[c]+=png.data[offset+c]*p.weight/weight;}return[kind,rgb];}));
 // The persistent binding is the visible book at rest as well as in flight.
 const beforePoints=await points(true),before=colors(PNG.sync.read(await page.screenshot()),beforePoints);
 await page.evaluate(async()=>{await reader().open(null,false);window.step=reader().update;reader().update=()=>{};for(let i=0;i<6;i++)step(.05,false);});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const afterPoints=await points(true),after=colors(PNG.sync.read(await page.screenshot({path:'/tmp/diary-edge-color-fixed.png'})),afterPoints);
 for(const kind of ['leather','paper']){const delta=before[kind].reduce((sum,v,i)=>sum+Math.abs(v-after[kind][i]),0)/3;console.log(kind,{before:before[kind],after:after[kind],delta});assert.ok(delta<15,'Pickup must preserve the visible '+kind+' rim color instead of replacing its lighting/tint');}
 console.log('PASS: leather rims retain their darker room lighting and paper edges retain their neutral color');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
