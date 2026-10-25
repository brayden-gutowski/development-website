const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource:'))errors.push(m.text());});
 await page.route('**/script.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+';window.surfaceProbe=()=>({room:activeRoom(),renderer,glassTarget});'});});
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+'/#gainesville');await page.locator('#loading-screen').waitFor({state:'hidden'});await page.mouse.move(0,0);
 const state=await page.evaluate(async()=>{
  const T=await import('three'),{room,renderer,glassTarget}=surfaceProbe(),gl=renderer.getContext();
  const programs=renderer.info.programs.map(p=>({linked:gl.getProgramParameter(p.program,gl.LINK_STATUS),fragment:gl.getShaderSource(p.fragmentShader)}));
  const snapshot=()=>({target:renderer.getRenderTarget()?.uuid||null,autoClear:renderer.autoClear,override:room.scene.overrideMaterial?.uuid||null,background:room.scene.background?.getHex(),exposure:renderer.toneMappingExposure,viewport:renderer.getViewport(new T.Vector4()).toArray(),scissor:renderer.getScissor(new T.Vector4()).toArray(),scissorTest:renderer.getScissorTest()});
  const before=snapshot();room.shade(renderer,glassTarget);const after=snapshot();
  const render=renderer.render;let threw=false;renderer.render=()=>{throw Error('render failure');};try{room.shade(renderer,glassTarget);}catch{threw=true;}finally{renderer.render=render;}
  return {linked:programs.every(p=>p.linked),floor:programs.some(p=>p.fragment.includes('float floorLight=')),glass:programs.some(p=>p.fragment.includes('float lampReflection=')),before,after,failure:snapshot(),threw,error:gl.getError(),rect:room.getScreenRect()};
 });
 assert.ok(state.linked&&state.floor&&state.glass,'Surface and glass shaders compile and link on the actual GPU');
 assert.deepEqual(state.after,state.before);assert.deepEqual(state.failure,state.before,'Even an interrupted background render restores shared renderer state');assert.ok(state.threw);assert.equal(state.error,0);
 const image=PNG.sync.read(await page.screenshot({path:'/tmp/gainesville-third-review-surfaces.png'})),r=state.rect,values=[];
 for(let y=Math.floor(r.y+r.height*.25);y<r.y+r.height*.75;y++)for(let x=Math.floor(r.x+r.width*.2);x<r.x+r.width*.8;x++){const i=(y*image.width+x)*4;values.push(.2126*image.data[i]+.7152*image.data[i+1]+.0722*image.data[i+2]);}
 const mean=values.reduce((s,v)=>s+v,0)/values.length,variation=Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/values.length);
 console.log({glassLuminance:mean,glassVariation:variation});
 assert.ok(mean>1.5&&mean<18,'Powered-off glass retains faint reflection without looking illuminated');assert.ok(variation>.04,'The unpowered glass retains faint surface reflection variation');
 assert.deepEqual(errors,[]);console.log('PASS: refined surfaces/glass compile, off-glass reflections, and shared renderer recovery; glass luminance',mean.toFixed(2));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
