const assert=require('node:assert/strict'),{chromium}=require('playwright'),{PNG}=require('pngjs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport});
  await page.route('**/script.js*',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:await s.text()+';window.reader=()=>diaryReader;window.room=()=>japanRoom;'});});
  await page.goto('http://127.0.0.1:4173/');await page.locator('#loading-screen').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Tokyo, Japan/}).click();await page.getByRole('button',{name:'Explore',exact:true}).click();await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
  await page.getByRole('button',{name:'Diary · Japanese Blog'}).focus();await page.keyboard.press('Enter');await page.locator('#diary-reader[data-phase="reading"]').waitFor();
  await page.evaluate(async()=>{reader().close(true);await reader().open({entryId:'blog-entry-9-11-2026',categoryId:'intermediate-japanese'},false);window.step=reader().update;reader().update=()=>{};});
  await page.evaluate(()=>{for(let i=0;i<40;i++)step(.05,false);});
  const samples=[];let nativeFrame,htmlFrame,landingBounds;
  for(let frame=0;frame<22;frame++){
   await page.evaluate(()=>step(1/60,false));
   // Manual stepping changes HTML immediately; wait for the capped 30fps
   // WebGL draw too, including on displays with faster animation frames.
   await page.evaluate(()=>new Promise(r=>{const start=performance.now();const painted=()=>performance.now()-start>=40?r():requestAnimationFrame(painted);requestAnimationFrame(painted);}));
   const bounds=await page.locator('.diary-viewport').boundingBox(),point={x:Math.round(bounds.x+bounds.width*.83),y:Math.round(bounds.y+bounds.height*.82)};
   const png=PNG.sync.read(await page.screenshot({clip:{x:point.x-2,y:point.y-2,width:5,height:5}})),rgb=[0,0,0];
   for(let i=0;i<png.data.length;i+=4)for(let c=0;c<3;c++)rgb[c]+=png.data[i+c]/25;
   samples.push(rgb);
   if(frame===15){nativeFrame=PNG.sync.read(await page.screenshot());landingBounds=bounds;}
   if(frame===17)htmlFrame=PNG.sync.read(await page.screenshot());
  }
  const settled=samples.at(-1),deltas=samples.map(rgb=>rgb.reduce((s,v,i)=>s+Math.abs(v-settled[i]),0)/3),max=Math.max(...deltas);
  console.log(viewport.width,'landing paper color deviation',max.toFixed(2));
  assert.ok(max<5,'The opaque paper must never fade through to the room or flash during arrival (RGB deviation '+max+')');
  let difference=0,count=0;
  for(let y=Math.ceil(landingBounds.y+35);y<landingBounds.y+landingBounds.height-35;y+=2)for(let x=Math.ceil(landingBounds.x+35);x<landingBounds.x+landingBounds.width-35;x+=2){
   const i=(y*nativeFrame.width+x)*4;
   for(let c=0;c<3;c++){difference+=Math.abs(nativeFrame.data[i+c]-htmlFrame.data[i+c]);count++;}
  }
  console.log(viewport.width,'printed landing difference',(difference/count).toFixed(2));
  assert.ok(difference/count<5,'The final animated print must line up with the readable text and photographs');
  let rimDifference=0,rimCount=0;
  for(let y=Math.max(0,Math.ceil(landingBounds.y-12));y<Math.min(nativeFrame.height,landingBounds.y+landingBounds.height+12);y++)for(let x=Math.max(0,Math.ceil(landingBounds.x-12));x<Math.min(nativeFrame.width,landingBounds.x+landingBounds.width+12);x++){
   if(x>=landingBounds.x&&x<=landingBounds.x+landingBounds.width&&y>=landingBounds.y&&y<=landingBounds.y+landingBounds.height)continue;
   const i=(y*nativeFrame.width+x)*4;for(let c=0;c<3;c++){rimDifference+=Math.abs(nativeFrame.data[i+c]-htmlFrame.data[i+c]);rimCount++;}
  }
  console.log(viewport.width,'cover rim landing difference',(rimDifference/rimCount).toFixed(2));
  assert.ok(rimDifference/rimCount<2,'The animated case overhang must dissolve before the readable spread takes over');
  assert.equal(await page.locator('#diary-reader').getAttribute('data-phase'),'reading');
  await page.screenshot({path:`/tmp/diary-handoff-${viewport.width}.png`});
  await page.close();
 }
 console.log('PASS: opaque, flash-free arrival through every landing frame on desktop and mobile');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
