const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');

(async()=>{
  const browser=await (process.env.TEST_BROWSER==='webkit'?webkit.launch({headless:true}):chromium.launch({channel:'chrome',headless:true}));
  try{
    const page=await browser.newPage({viewport:{width:393,height:780},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({state:'hidden'});
    const results=await page.evaluate(async()=>{
      const T=await import('three'),{createJapanRoom}=await import('/japan-room.js');
      const room=await createJapanRoom();room.resize(393,780);room.setVisible(true,false);
      if(!room.outline.renderTargetDepthBuffer.depthTexture)throw new Error('Use native depth for mobile contour visibility');
      const renderer=new T.WebGLRenderer();renderer.setSize(393,780);renderer.setPixelRatio(1.75);
      const w=room.outline.renderTargetMaskBuffer.width,h=room.outline.renderTargetMaskBuffer.height;
      const target=new T.WebGLRenderTarget(w,h),mask=new Uint8Array(w*h*4),reference=new Uint8Array(mask.length);
      const all=room.outline.selectedObjects.slice(),results=[];
      for(const phase of ['open','closed']){
        if(phase==='closed'){room.toggleCurtains();for(let i=0;i<120;i++)room.update(1/60,false);}
        for(const action of ['curtains','music']){
          const selected=all.filter(object=>object.userData.roomAction===action);
          room.outline.selectedObjects=selected;
          renderer.setRenderTarget(null);renderer.render(room.scene,room.camera);
          room.outline.render(renderer,null,null,0,false);
          renderer.readRenderTargetPixels(room.outline.renderTargetMaskBuffer,0,0,w,h,mask);
          // Independently draw visible geometry, avoiding the contour's depth shader.
          const saved=[],materials=[];
          room.scene.traverse(object=>{
            if(!object.isMesh)return;
            const original=object.material,chosen=selected.includes(object);
            const replacement=[original].flat().map(material=>new T.MeshBasicMaterial({
              fog:false,color:chosen?0xffffff:0,side:material.side,depthWrite:material.depthWrite,
              transparent:material.transparent,opacity:material.transparent&&!chosen?0:1,
            }));
            saved.push([object,original]);materials.push(...replacement);
            object.material=Array.isArray(original)?replacement:replacement[0];
          });
          const background=room.scene.background;room.scene.background=new T.Color(0);
          renderer.setRenderTarget(target);renderer.render(room.scene,room.camera);
          renderer.readRenderTargetPixels(target,0,0,w,h,reference);
          room.scene.background=background;saved.forEach(([o,m])=>o.material=m);materials.forEach(m=>m.dispose());
          let mismatch=0,visible=0;
          for(let i=0;i<mask.length;i+=4){
            const actual=mask[i]<128&&mask[i+1]<128,expected=reference[i]>128;
            if(actual)visible++;if(actual!==expected)mismatch++;
          }
          results.push({phase,action,mismatch,visible});
        }
      }
      target.dispose();room.dispose();renderer.dispose();return results;
    });
    for(const result of results)assert.ok(result.mismatch<25,`Contour must follow visible animated geometry: ${JSON.stringify(result)}`);
    console.log('PASS: native mobile depth masks match the curtain and record geometry',results);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
