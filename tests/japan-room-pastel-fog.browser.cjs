const assert=require('node:assert/strict'),{chromium}=require('playwright'),{PNG}=require('pngjs');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Shader|WebGL/.test(m.text()))errors.push(m.text());});
 await page.route('**/script.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+';window.room=()=>japanRoom;'});});
 await page.goto('http://127.0.0.1:4173/');await page.locator('#loading-screen').waitFor({state:'hidden'});
 await page.getByRole('button',{name:/Tokyo, Japan/}).click();await page.getByRole('button',{name:'Explore',exact:true}).click();await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
 await page.mouse.move(700,450);
 const paint=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.evaluate(()=>room().windowLight.uniforms.time.value=0);await paint();const first=PNG.sync.read(await page.screenshot({path:'/tmp/pastel-fog-0.png'}));
 await page.evaluate(()=>{const u=room().windowLight.uniforms.strength;window.savedBeamStrength=u.value;u.value=0;});await paint();const withoutBeam=PNG.sync.read(await page.screenshot());
 await page.evaluate(()=>room().windowLight.uniforms.strength.value=window.savedBeamStrength);await paint();
 let beamPixels=0,beamPeak=0;
 for(let y=150;y<800;y++)for(let x=80;x<1160;x++){
  const i=(y*first.width+x)*4,d=Math.max(...[0,1,2].map(c=>first.data[i+c]-withoutBeam.data[i+c]));
  beamPeak=Math.max(beamPeak,d);if(d>3)beamPixels++;
 }
 console.log('Window beam visibility',{beamPixels,beamPeak});
 assert.ok(beamPixels>10000&&beamPeak>15,'The shadowed window beam must remain clearly visible independently of the pastel fog');
 await page.evaluate(()=>room().windowLight.uniforms.time.value=12);await paint();const later=PNG.sync.read(await page.screenshot({path:'/tmp/pastel-fog-12.png'}));
 await page.evaluate(()=>room().windowLight.visible=false);await paint();const clear=PNG.sync.read(await page.screenshot());
 await page.evaluate(()=>room().windowLight.visible=true);await paint();
 const stats={difference:0,count:0,color:0,visibility:0};
 for(let y=530;y<810;y++)for(let x=350;x<1120;x++){
  const i=(y*first.width+x)*4;stats.difference+=(Math.abs(first.data[i]-later.data[i])+Math.abs(first.data[i+1]-later.data[i+1])+Math.abs(first.data[i+2]-later.data[i+2]))/3;
  stats.visibility+=(Math.abs(first.data[i]-clear.data[i])+Math.abs(first.data[i+1]-clear.data[i+1])+Math.abs(first.data[i+2]-clear.data[i+2]))/3;
  stats.color+=Math.max(first.data[i],first.data[i+1],first.data[i+2])-Math.min(first.data[i],first.data[i+1],first.data[i+2]);stats.count++;
 }
 stats.difference/=stats.count;stats.color/=stats.count;stats.visibility/=stats.count;
 const windowStats={visibility:0,movement:0,count:0};
 for(let y=250;y<600;y++)for(let x=100;x<820;x++){
  const i=(y*first.width+x)*4;
  for(let c=0;c<3;c++){
   windowStats.visibility+=Math.abs(first.data[i+c]-clear.data[i+c]);
   windowStats.movement+=Math.abs(first.data[i+c]-later.data[i+c]);
   windowStats.count++;
  }
 }
 windowStats.visibility/=windowStats.count;windowStats.movement/=windowStats.count;
 console.log('Atmosphere measurements',stats,windowStats);
 // Keep the restored lower green/pink atmosphere, without bringing back
 // the upper rectangular wash that hid the right curtain's folds.
 assert.ok(stats.visibility>25&&stats.visibility<65,'The lower pastel fog must remain clearly visible');
 assert.ok(stats.visibility>windowStats.visibility*2,'Keep the colored banks low rather than replacing them with upper-window fog');
 assert.ok(stats.difference>3,'Lower pastel banks must visibly drift');
 assert.ok(stats.color>6,'Keep the green and pink pastel coloring');
 let curtainWash=0,curtainSamples=0;const foldContrast=[0,0,0];
 for(let y=180;y<420;y++)for(let x=330;x<420;x++){
  const i=(y*first.width+x)*4;
  for(let c=0;c<3;c++){
   curtainWash+=Math.max(0,first.data[i+c]-clear.data[i+c],later.data[i+c]-clear.data[i+c]);
   for(const [k,frame] of [first,later,clear].entries())foldContrast[k]+=Math.abs(frame.data[i+c]-frame.data[i+8*4+c]);
   curtainSamples++;
  }
 }
 curtainWash/=curtainSamples;
 console.log('Curtain fold contrast',{foldContrast,curtainWash});
 assert.ok(Math.min(foldContrast[0],foldContrast[1])/foldContrast[2]>.8,'Keep the contrast between the curtain folds throughout fog movement');
 assert.ok(curtainWash<10,'Upper fog must not wash out the opaque curtain folds');
 console.log('Curtain fog wash',curtainWash);
 await page.evaluate(async()=>{const T=await import('three'),u=room().windowLight.uniforms.sunShadowMatrix;window.savedFogShadow=u.value;u.value=new T.Matrix4().set(0,0,0,.5,0,0,0,.5,0,0,0,0,0,0,0,1);});
 await paint();const unshadowed=PNG.sync.read(await page.screenshot());
 let shadowDifference=0,shadowPixels=0;
 for(let y=180;y<800;y++)for(let x=180;x<1160;x++){const i=(y*later.width+x)*4,d=Math.max(...[0,1,2].map(c=>Math.abs(later.data[i+c]-unshadowed.data[i+c])));shadowDifference=Math.max(shadowDifference,d);if(d>2)shadowPixels++;}
 await page.evaluate(()=>room().windowLight.uniforms.sunShadowMatrix.value=window.savedFogShadow);await paint();
 assert.ok(shadowDifference>5&&shadowPixels>20,'The actual room shadow map must visibly occlude atmospheric light');
 console.log('Atmospheric shadow response',{shadowDifference,shadowPixels});
 const frozen=await page.evaluate(()=>{const r=room(),t=r.windowLight.uniforms.time.value;r.setVisible(true,true);for(let i=0;i<20;i++)r.update(.05,true);return t===r.windowLight.uniforms.time.value;});
 assert.ok(frozen,'Reduced motion freezes atmospheric drift');
 assert.deepEqual(errors,[]);console.log('PASS: visible pastel fog, slow movement, reduced motion and clean shaders',stats);
 if(process.env.CAPTURE_FOG){for(let frame=0;frame<17;frame++){await page.evaluate(t=>room().windowLight.uniforms.time.value=t,frame*.5);await paint();await page.screenshot({path:`/tmp/pastel-fog-frame-${String(frame).padStart(2,'0')}.png`});}}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
