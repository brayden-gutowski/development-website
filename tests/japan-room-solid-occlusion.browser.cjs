const assert=require('node:assert/strict'),{chromium}=require('playwright'),{PNG}=require('pngjs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce',deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Shader|WebGL/.test(m.text()))errors.push(m.text());});
 await page.route('**/script.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+';window.room=()=>japanRoom;window.engine=()=>renderer;'});});
 await page.goto('http://127.0.0.1:4173/');await page.locator('#loading-screen').waitFor({state:'hidden'});await page.getByRole('button',{name:/Tokyo, Japan/}).click();await page.getByRole('button',{name:'Explore',exact:true}).click();await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
 const paint=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
 await page.evaluate(()=>room().windowLight.visible=false);await paint();
 const lit=PNG.sync.read(await page.screenshot());await page.evaluate(()=>{room().scene.getObjectByName('Window sunlight').intensity=0;});await paint();const shaded=PNG.sync.read(await page.screenshot());
 // The desktop blocks the window at this cavity floor. Direct sun must not
 // add a bright patch; only the unchanged baked bounce/ambient light remains.
 let difference=0,count=0;for(let y=797;y<817;y++)for(let x=170;x<190;x++){
  const i=(y*2*lit.width+x*2)*4;for(let c=0;c<3;c++){difference+=Math.abs(lit.data[i+c]-shaded.data[i+c]);count++;}
 }
 assert.ok(difference/count<2,'The blocked cavity floor must not receive direct window light');
 assert.equal(await page.evaluate(()=>!!room().scene.getObjectByName('Broad window sky')),false,'Do not reintroduce an unshadowed window fill through solid furniture');
 await page.evaluate(async()=>{
  const T=await import('three'),{FullScreenQuad}=await import('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/Pass.js'),r=room();
  window.depthTestT=T;window.depthReadTarget=new T.WebGLRenderTarget(1,1,{type:T.FloatType});
  window.depthReadMaterial=new T.ShaderMaterial({uniforms:{depth:{value:r.windowLight.uniforms.tDepth.value},point:{value:new T.Vector2()}},vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D depth;uniform vec2 point;void main(){gl_FragColor=vec4(texture2D(depth,point).rrr,1.);}'});
  window.depthReadQuad=new FullScreenQuad(depthReadMaterial);
  const metersPerPixel=4*Math.tan(T.MathUtils.degToRad(r.camera.fov/2))/innerHeight;
  window.depthBar=new T.Mesh(new T.BoxGeometry(metersPerPixel*.7,metersPerPixel*90,.004),new T.MeshBasicMaterial({color:0x000000}));depthBar.quaternion.copy(r.camera.quaternion);r.scene.add(depthBar);
  r.scene.getObjectByName('Window sunlight').intensity=2.6;r.windowLight.visible=true;
 });
 const measurements=[];
 for(const x of [490.5,491.5,493.5,496.5,499.5,503.5]){
  const uv=await page.evaluate(x=>{const T=depthTestT,r=room(),texture=r.windowLight.uniforms.tDepth.value,width=texture.image.width,height=texture.image.height;const u=(Math.floor(x/innerWidth*width)+.5)/width,v=(Math.floor(.48*height)+.5)/height;const p=new T.Vector3(u*2-1,v*2-1,0).unproject(r.camera).sub(r.camera.position);p.multiplyScalar(2/-p.clone().applyQuaternion(r.camera.quaternion.clone().invert()).z);depthBar.position.copy(r.camera.position).add(p);depthReadMaterial.uniforms.point.value.set(u,v);return[u,v];},x);
  await paint();measurements.push(await page.evaluate(([u,v])=>{const T=depthTestT,r=room(),renderer=engine(),previous=renderer.getRenderTarget();renderer.setRenderTarget(depthReadTarget);depthReadQuad.render(renderer);const out=new Float32Array(4);renderer.readRenderTargetPixels(depthReadTarget,0,0,1,1,out);renderer.setRenderTarget(previous);const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(u*2-1,v*2-1),r.camera);const hit=ray.intersectObject(depthBar)[0];const point=new T.Vector3(u*2-1,v*2-1,out[0]*2-1).unproject(r.camera);return{mesh:hit?.distance,depth:point.distanceTo(r.camera.position)};},uv));
 }
 assert.ok(measurements.every(m=>m.mesh&&Math.abs(m.mesh-m.depth)<.003),'Even moving subpixel-width solids must stop the fog at their front surface');
 await page.evaluate(()=>{room().scene.remove(depthBar);depthBar.geometry.dispose();depthBar.material.dispose();depthReadTarget.dispose();depthReadMaterial.dispose();});await paint();await page.screenshot({path:'/tmp/room-solid-occlusion-verified.png'});
 assert.deepEqual(errors,[]);console.log('PASS: blocked cavity lighting and moving thin-object fog occlusion',{directLightDifference:difference/count,measurements});
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
