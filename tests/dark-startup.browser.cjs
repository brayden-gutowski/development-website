const assert=require('node:assert/strict');const {chromium}=require('playwright');const {PNG}=require('pngjs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const route of ['/#gainesville','/#tokyo','/']){
  const page=await browser.newPage({viewport:{width:900,height:620},colorScheme:'light'});let release;const held=new Promise(r=>release=r);
  try{
   await page.route('**/style.css*',async r=>{await held;if(!page.isClosed())await r.continue();});
   await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+route,{waitUntil:'commit'});
   await page.waitForFunction(()=>!!document.querySelector('link[rel="stylesheet"]'),null,{polling:50,timeout:5000});
   const early=await page.evaluate(()=>({background:document.documentElement.style.backgroundColor,scheme:document.querySelector('meta[name="color-scheme"]')?.content,critical:[...document.querySelectorAll('head style')].some(s=>s.textContent.includes('#loading-screen'))}));
   assert.equal(early.background,'rgb(2, 4, 6)','The canvas must be dark before external CSS arrives');assert.equal(early.scheme,'dark');assert.equal(early.critical,true);
   release();await page.locator('#loading-screen').waitFor({state:'hidden',timeout:60000});assert.equal(await page.locator('#app.is-static-fallback').count(),0);
   if(route==='/#gainesville'){
    const image=PNG.sync.read(await page.screenshot());let bright=0,total=0;for(let i=0;i<image.data.length;i+=4){total++;if(image.data[i]>220&&image.data[i+1]>220&&image.data[i+2]>220)bright++;}assert.ok(bright/total<.02,'The first ready Gainesville frame is dark, without a white reveal');
   }
  }finally{release?.();await page.close();}
 }
 console.log('PASS: critical dark canvas before CSS and ready-scene reveal for Gainesville, Tokyo and globe');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
