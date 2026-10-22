const assert=require('node:assert/strict'),{chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  await page.route('**/script.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+';window.reviewReader=()=>bookReader;window.room=()=>japanRoom;'});});
  await page.goto('http://127.0.0.1:4173/#book-review/akai-sakana-to-kodomo');
  await page.locator('#book-reader[data-phase="reading"]').waitFor({timeout:60000});
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:667,height:375}]){
   await page.evaluate(()=>reviewReader().close(true));await page.setViewportSize(viewport);
   await page.waitForFunction(()=>Math.abs(room().camera.aspect-innerWidth/innerHeight)<.000001);
   const result=await page.evaluate(async()=>{
    const T=await import('three'),{OBB}=await import('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/math/OBB.js');
    const reader=reviewReader(),update=reader.update,books=room().reviewBooks,root=document.querySelector('#book-reader');reader.update=()=>{};
    const collisions=[],pacing=[],stalls=[],slots=[],ids=['akai-sakana-to-kodomo','yaseuma','maru-megane-ryoubo-san'];let frame=0,phase='';
    books.forEach(book=>book.meshes.forEach(mesh=>mesh.geometry.computeBoundingBox()));
    function centers(){return books.map(book=>new T.Box3().setFromObject(book.object.getObjectByName('Back_board')).getCenter(new T.Vector3()));}
    function sample(){
     const solids=books.map(book=>book.meshes.filter(mesh=>mesh.visible).map(mesh=>{
      const bounds=mesh.geometry.boundingBox.clone();
      if(mesh.morphTargetInfluences){bounds.makeEmpty();const vertex=new T.Vector3();for(let v=0;v<mesh.geometry.attributes.position.count;v++)bounds.expandByPoint(mesh.getVertexPosition(v,vertex));}
      const obb=new OBB().fromBox3(bounds).applyMatrix4(mesh.matrixWorld);
      // OBB.applyMatrix4 assumes its center is already in the rotated frame.
      obb.center.copy(bounds.getCenter(new T.Vector3()).applyMatrix4(mesh.matrixWorld));return obb;
     }));
     for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(solids[i].some(a=>solids[j].some(b=>a.intersectsOBB(b))))collisions.push({phase,frame,i,j});
     frame++;
    }
    function animate(name){
     phase=name;const tracks=[centers()];sample();
     for(let n=0;n<600&&!['closed','reading'].includes(root.dataset.phase);n++){update(1/120,false);sample();tracks.push(centers());}
     if(!['closed','reading'].includes(root.dataset.phase))throw new Error('Animation failed to settle');
     for(let i=0;i<3;i++){
      const distances=tracks.slice(1).map((positions,n)=>positions[i].distanceTo(tracks[n][i]));
      const moving=distances.filter(d=>d>1e-9),peak=Math.max(...distances);
      if(peak>.001)pacing.push({phase,i,start:moving[0]/peak,end:moving.at(-1)/peak});
      for(let n=24;n<distances.length-42;n+=12){
       if(distances.slice(n,n+18).reduce((sum,d)=>sum+d,0)<.00001)stalls.push({phase,i,frame:n});
      }
     }
    }
    const launchStart=books.map(book=>({position:new T.Vector3().setFromMatrixPosition(book.object.matrix),rotation:book.object.getObjectByName('Back_board').getWorldQuaternion(new T.Quaternion())}));
    await reader.open(null,false);for(let n=0;n<120;n++)update(1/120,false);
    const launch=books.map((book,i)=>({distance:new T.Vector3().setFromMatrixPosition(book.object.matrix).distanceTo(launchStart[i].position),turn:book.object.getObjectByName('Back_board').getWorldQuaternion(new T.Quaternion()).angleTo(launchStart[i].rotation)}));reader.close(true);
    for(let initial=0;initial<3;initial++){
     await reader.open({entryId:ids[initial]},false);animate(`pickup-${initial}`);
     let active=initial;
     for(const target of [0,1,2,0,2,1]){
      if(active===target)continue;
      const third=3-active-target,selector=root.querySelector(`[data-book-index="${third}"]`),before=['left','top','width','height'].map(key=>selector.style[key]).join(',');
      root.querySelector(`[data-book-index="${target}"]`).click();slots.push(before===['left','top','width','height'].map(key=>selector.style[key]).join(','));animate(`swap-${active}-${target}`);active=target;
     }
     reader.close();animate(`return-${initial}`);
    }
    reader.update=update;return {launch,collisions:collisions.slice(0,8),collisionPhases:Object.fromEntries([...new Set(collisions.map(c=>c.phase))].map(name=>[name,collisions.filter(c=>c.phase===name).length])),total:collisions.length,frames:frame,pacing,stalls:stalls.slice(0,6),totalStalls:stalls.length,stableSlots:slots.every(Boolean)};
   });
   console.log(`${viewport.width}px book motion`,JSON.stringify({...result,pacing:{maxStart:Math.max(...result.pacing.map(p=>p.start)),maxEnd:Math.max(...result.pacing.map(p=>p.end))}}));
   assert.ok(result.launch.every(book=>book.distance>.15&&book.turn>.25),'Every book is already travelling and turning toward the reader in the first second');
   assert.equal(result.total,0,'Conservative bounds of separate books never intersect during pickup, every exchange, or return');
   assert.equal(result.totalStalls,0,'Every book stays in motion throughout each transition, without checkpoint holds');
   assert.ok(result.stableSlots,'The uninvolved floating book keeps its slot');
   assert.ok(result.pacing.every(p=>p.start<.08&&p.end<.08),'Every travelling book eases into and out of its path');
   assert.ok(await page.evaluate(async()=>{
    const T=await import('three');return room().reviewBooks.every(book=>{
     const spine=new T.Box3().setFromObject(book.object.getObjectByName('Flexible_case_spine'),true);
     return book.meshes.filter(mesh=>mesh.material.name==='Printed diary pages').every(mesh=>{
      const paper=new T.Box3().setFromObject(mesh,true);return paper.min.y>=spine.min.y&&paper.max.y<=spine.max.y;
     });
    });
   }),'Closed paper edges stay inside the spine at both ends');
  }
  await page.evaluate(async()=>{
   const reader=reviewReader();window.manualReviewUpdate=reader.update;reader.update=()=>{};await reader.open(null,false);
   for(let i=0;i<30;i++)manualReviewUpdate(.05,false);
  });
  await page.setViewportSize({width:1100,height:800});
  const resizeJump=await page.evaluate(()=>{
   const before=room().reviewBooks.map(b=>b.object.matrix.elements.slice());reviewReader().resize();manualReviewUpdate(.000001,false);
   return Math.max(...room().reviewBooks.flatMap((b,i)=>b.object.matrix.elements.map((n,j)=>Math.abs(n-before[i][j]))));
  });
  assert.ok(resizeJump<.001,'Resizing mid-flight retargets from the existing pose without a jump');
  const interruption=await page.evaluate(async()=>{
   const reader=reviewReader(),root=document.querySelector('#book-reader');
   for(let i=0;i<100;i++)manualReviewUpdate(.05,false);
   reader.close();for(let i=0;i<15;i++)manualReviewUpdate(.05,false);
   const before=room().reviewBooks.map(b=>b.object.matrix.elements.slice());await reader.open({entryId:'yaseuma'},false);
   const reopenJump=Math.max(...room().reviewBooks.flatMap((b,i)=>b.object.matrix.elements.map((n,j)=>Math.abs(n-before[i][j]))));
   for(let i=0;i<150;i++)manualReviewUpdate(.05,false);
   const reopened=root.dataset.phase==='reading'&&root.dataset.book==='yaseuma';reader.close(true);await reader.open(null,false);
   for(let i=0;i<15;i++)manualReviewUpdate(.05,false);
   reader.close();const queued=root.dataset.phase==='flying';for(let i=0;i<160;i++)manualReviewUpdate(.05,false);
   reader.update=manualReviewUpdate;return {reopenJump,reopened,queued,closed:!reader.isOpen};
  });
  assert.equal(interruption.reopenJump,0,'A reopen request never teleports returning books');assert.ok(interruption.reopened);
  assert.ok(interruption.queued&&interruption.closed,'Closing during pickup completes a safe return');
  console.log('PASS: collision clearance, stable waiting slots and eased endpoints on desktop and mobile');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
