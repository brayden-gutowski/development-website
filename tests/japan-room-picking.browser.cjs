const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');
  await page.locator('#loading-screen').waitFor({state:'hidden'});
  const results=await page.evaluate(async()=>{
   const THREE=await import('three'); const {createJapanRoom}=await import('/japan-room.js');
   const room=await createJapanRoom();room.resize(1440,900);room.scene.updateMatrixWorld(true);room.camera.updateMatrixWorld(true);
   const targets=[];room.scene.traverse(o=>{if(o.isMesh && !o.isInstancedMesh && o.name!=='Tokyo apartment view'){let visible=true;o.traverseAncestors(p=>{if(!p.visible)visible=false;});if(o.visible&&visible)targets.push(o)}});
   const ray=new THREE.Raycaster(),center=new THREE.Vector2(); const results=[];
   const exact=(x,y)=>{ray.setFromCamera(center.set(x,y),room.camera);return ray.intersectObjects(targets,false)[0]?.object.userData.roomAction||null;};
   for(const action of ['books','diary','music','door']){
    const mesh=targets.find(o=>o.userData.roomAction===action);const p=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()).project(room.camera);
    const direction=action==='door'?-1:1;let edge;
    // The books now occupy several clusters. Find the outer silhouette of
    // the complete action, not a gap between two legitimately clickable books.
    for(let px=direction>0?1439:0;px>=0 && px<1440;px-=direction){
     const x=px*2/1440-1;
     if(exact(x,p.y)===action){edge=x;break;}
    }
    if(edge===undefined)throw new Error('No visible edge for '+action);
    results.push({action,near:room.pick(edge+direction*5*2/1440,p.y),far:room.pick(edge+direction*26*2/1440,p.y)});
   }
   room.dispose();return results;
  });
  for(const r of results){assert.equal(r.near,r.action,'Allow a small margin just outside '+r.action);assert.notEqual(r.far,r.action,'Keep distant clicks outside '+r.action);}
  console.log('PASS: object hit forgiveness stays small and bounded',results);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
