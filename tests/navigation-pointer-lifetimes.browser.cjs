const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({reducedMotion:'reduce'});
    await page.route('**/script.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({response,body:(await response.text()).replace('setTimeout(preloadOtherAreas, 1000);','')+`;
        window.testPointerCompletion=()=>{
          const originalVisit=tokyoVisit, originalVisible=roomIsVisible;
          const up=type=>onPointerUp({type,pointerId:state.pointerId,clientX:0,clientY:0});
          const remaining=[];
          for(const direction of ['in','out','room']){
            tokyoVisit={direction};roomIsVisible=direction==='room';
            for(let id=1;id<=8;id++){
              state.activePointers.set(id,new THREE.Vector2());state.pointerId=id;
              up(id%2?'pointerup':'pointercancel');
            }
            remaining.push(state.activePointers.size);
          }
          tokyoVisit=originalVisit;roomIsVisible=originalVisible;
          return remaining;
        };`});
    });
    await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+'/');
    await page.locator('#loading-screen').waitFor({state:'hidden',timeout:60000});
    assert.deepEqual(await page.evaluate(()=>testPointerCompletion()),[0,0,0], 'Pointer completion releases tracked input even when travel or room handling returns early');
    console.log('PASS: pointer release/cancel cannot accumulate input records during room travel');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
