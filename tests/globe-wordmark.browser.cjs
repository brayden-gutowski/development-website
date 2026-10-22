const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({state:'hidden'});
    await page.getByRole('button',{name:/Gainesville, Florida/}).click();
    // Wait for the location camera to settle before starting the return.
    await page.evaluate(() => new Promise(resolve => { const end=performance.now()+1100; const frame=now=>now>=end?resolve():requestAnimationFrame(frame); requestAnimationFrame(frame); }));
    await page.getByRole('button',{name:'Close location details'}).click();
    const paths = await page.evaluate(() => new Promise(resolve => {
      const paths=[];let frames=0;
      function frame(){frames++;if(frames===4||frames===16)paths.push(document.querySelector('#wordmark-path').getAttribute('d'));if(frames===16)resolve(paths);else requestAnimationFrame(frame);}
      requestAnimationFrame(frame);
    }));
    assert.notEqual(paths[0],paths[1],'The wordmark curve must follow the camera return after closing a location');
    console.log('PASS: cached wordmark geometry follows camera motion');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
