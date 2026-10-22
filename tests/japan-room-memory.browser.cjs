const assert=require('node:assert/strict'),{chromium}=require('playwright'),{PNG}=require('pngjs');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Shader|WebGL/.test(m.text()))errors.push(m.text());});
 await page.route('**/script.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+';window.room=()=>japanRoom;'});});
 await page.goto('http://127.0.0.1:4173/#blog/intermediate-japanese/blog-entry-9-11-2026');
 await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:60000});await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>[1,2,3].some(i=>room().scene.getObjectByName('Shelf reading stack '+i))||[1,2].some(i=>room().scene.getObjectByName('Desk record jacket '+i))),false,'The additional book stack and desk jackets must be removed');
 const png=PNG.sync.read(await page.screenshot({path:'/tmp/room-memory-verified.png'}));
 let shelf=0,count=0;for(let y=580;y<680;y++)for(let x=880;x<1050;x++){const i=(y*png.width+x)*4;shelf+=(png.data[i]+png.data[i+1]+png.data[i+2])/3;count++;}
 shelf/=count;assert.ok(shelf>35&&shelf<190,'Shelf interiors remain readable through visible pastel mist');
 assert.deepEqual(errors,[]);console.log('PASS: extra props removed, readable shelving and clean render','shelf mean',shelf.toFixed(1));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
