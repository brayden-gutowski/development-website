// Isolated Chrome snapshot: process RSS is a repeatable comparison, not a per-tab OS memory guarantee.
const {chromium}=require('playwright');const {execFileSync}=require('node:child_process');const {writeFileSync}=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/script.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`;window.flightMemoryProbe=async()=>Promise.all([...cityFlightPromises].map(async([city,promise])=>{const flight=await promise;const atlas=flight?.group.children.filter(o=>o.name.startsWith(city+'-aerial-'))||[];return {city,atlases:atlas.length,resident:atlas.filter(o=>o.material.map.image?.width).length};}));window.memoryProbe=()=>({ready:backgroundAreasStarted&&areaLoads.size===0,gpu:renderer.info.memory,programs:renderer.info.programs.length,area:roomLocationId,models:{tokyo:japanRoom?.texturesSuspended,gainesville:gainesvilleRoom?.texturesSuspended},flights:[...cityFlightPromises.keys()]});`});});
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+(process.env.MEMORY_ROUTE||'/#gainesville'));await page.locator('#loading-screen').waitFor({state:'hidden',timeout:60000});
 await page.waitForFunction(()=>memoryProbe().ready,null,{timeout:120000});await page.waitForTimeout(1500);
 const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');await cdp.send('Performance.enable');const {metrics}=await cdp.send('Performance.getMetrics');
 const sys=await browser.newBrowserCDPSession();const {processInfo}=await sys.send('SystemInfo.getProcessInfo');
 const processes=processInfo.map(p=>{let rssKiB=0;try{rssKiB=Number(execFileSync('ps',['-o','rss=','-p',String(p.id)],{encoding:'utf8'}).trim());}catch{}return{type:p.type,pid:p.id,rssMiB:Math.round(rssKiB/1024*10)/10};});
 const report={viewport:'1440x900',route:page.url(),probe:await page.evaluate(()=>memoryProbe()),jsHeapMiB:Math.round(metrics.find(m=>m.name==='JSHeapUsedSize').value/1048576*10)/10,processes,totalProcessRssMiB:Math.round(processes.reduce((sum,p)=>sum+p.rssMiB,0)*10)/10,errors};
 report.flightResidency=await page.evaluate(()=>flightMemoryProbe());
 if(process.env.MEMORY_REPORT)writeFileSync(process.env.MEMORY_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(process.env.MEMORY_SCREENSHOT)await page.screenshot({path:process.env.MEMORY_SCREENSHOT});
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
