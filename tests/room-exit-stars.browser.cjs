const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const area of ['gainesville','tokyo']) for (const reduced of [false,true]) {
      const page = await browser.newPage({viewport:{width:1280,height:800},reducedMotion:reduced?'reduce':'no-preference'});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/script.js*',async route=>{
        const response=await route.fetch();
        await route.fulfill({response,body:await response.text()+`;
          window.starExitReady=()=>backgroundAreasStarted&&areaLoads.size===0;
          window.startStarExitProbe=()=>{
            window.starExitFrames=[];
            const before=scene.onBeforeRender;
            scene.onBeforeRender=function(...args){
              before.apply(this,args);
              if(!roomIsVisible)starExitFrames.push({phase:tokyoVisit?.direction||'globe',
                alignment:skySphere.quaternion.angleTo(earthGroup.quaternion),
                foreground:travelStars.visible||earthStar.visible,
                rotation:skySphere.quaternion.toArray(),cover:+roomTransition.style.getPropertyValue('--cover')});
            };
          };`});
      });
      await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+'/#'+area);
      await page.locator('#loading-screen').waitFor({state:'hidden',timeout:60000});
      await page.waitForFunction(()=>starExitReady(),null,{timeout:120000});
      await page.evaluate(()=>startStarExitProbe());
      await page.getByRole('button',{name:area==='tokyo'?'Door · Return to globe':'Exit sign · Return to globe',exact:true}).focus();
      await page.keyboard.press('Enter');
      await page.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor({timeout:30000});
      await page.waitForFunction(()=>starExitFrames.filter(frame=>frame.phase==='globe').length>=8);
      const frames=await page.evaluate(()=>starExitFrames),travel=frames.filter(frame=>frame.phase==='out'),globe=frames.filter(frame=>frame.phase==='globe');
      console.log(area,reduced?'reduced':'normal',{travelFrames:travel.length,maxTravelError:Math.max(...travel.map(f=>f.alignment)),firstGlobeError:globe[0]?.alignment,foregroundDuringTravel:travel.some(f=>f.foreground)});
      assert.ok(travel.length>0,'Sample actual departure renders');
      assert.ok(travel.every(frame=>frame.alignment<1e-5),'Visible departure sky stays aligned with the globe');
      assert.ok(travel.every(frame=>!frame.foreground),'Orbit return cannot expose stale close-up travel stars or the distant Earth point');
      assert.ok(globe.every(frame=>frame.alignment<1e-5),'Sky does not rotate to catch up after the room exit');
      assert.deepEqual(errors,[]);
      await page.screenshot({path:'/tmp/'+area+'-exit-stars-'+(reduced?'reduced':'normal')+'.png'});
      await page.close();
    }
    console.log('PASS: both room exits keep sky alignment and foreground stars consistent through normal/reduced-motion globe handoff');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
