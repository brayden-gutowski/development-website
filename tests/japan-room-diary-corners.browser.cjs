const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.route('**/script.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+';window.room=()=>japanRoom;'});});
 await page.goto('http://127.0.0.1:4173/#blog/intermediate-japanese/blog-entry-9-11-2026');
 await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:60000});
 const errors=await page.evaluate(()=>{
  const p=room().diaryBinding.object.getObjectByName('Right_page_block').geometry.attributes.position,points=[];
  for(let i=0;i<p.count;i++)points.push([p.getX(i)/.265,.5-p.getY(i)/.403]);
  // Match both rounded SVG corners, including the tangent into the fore edge.
  const errors=[];
  for(const top of [true,false])for(const t of [.25,.5,.75,1]){
   const q=1-t,x=q*q*.965+2*q*t*.995+t*t*.995;
   const y=top?q*q*.015+2*q*t*.016+t*t*.045:q*q*.986+2*q*t*.985+t*t*.955;
   errors.push(Math.min(...points.map(([px,py])=>Math.hypot(px-x,py-y))));
  }
  return errors;
 });
 console.log('Rounded mesh/reader corner distances:',errors);
 assert.ok(Math.max(...errors)<.00001,'The physical page corners must follow the readable rounded outline, including its vertical tangent');
 await page.screenshot({path:'/tmp/diary-corners-final.png'});
 console.log('PASS: physical page corners follow the reader silhouette');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
