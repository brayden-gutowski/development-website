const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.route('**/script.js*',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:await s.text()+';window.room=()=>japanRoom;'});});
 await page.goto('http://127.0.0.1:4173/#blog/intermediate-japanese/blog-entry-9-11-2026');await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:60000});
 const dimensions=await page.evaluate(()=>{const rig=room().scene.getObjectByName('Blender diary binding'),spine=rig.getObjectByName('Flexible_case_spine').geometry,page=rig.getObjectByName('Right_page_block').geometry;spine.computeBoundingBox();const p=page.attributes.position,inner=[];for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))<.000001)inner.push(p.getY(i));return{spineTop:spine.boundingBox.max.y,spineBottom:spine.boundingBox.min.y,pageTop:Math.max(...inner),pageBottom:Math.min(...inner)};});
 console.log('Binding and inner-page height:',dimensions);
 assert.ok(dimensions.spineTop<dimensions.pageTop&&dimensions.spineBottom>dimensions.pageBottom,'The case spine must tuck below both inner page edges, without a brown tab above or below the opened diary');
 console.log('PASS: recessed, closed-solid spine stays inside the curved page silhouette');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
