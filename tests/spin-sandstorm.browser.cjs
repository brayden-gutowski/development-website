const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {PNG}=require('pngjs');

(async()=>{
  const browser=await (process.env.TEST_BROWSER==='webkit'?webkit.launch({headless:true}):chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']}));
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&message.text().includes('THREE.WebGLProgram'))errors.push(message.text());});
    await page.route('**/script.js*',async route=>{
      const response=await route.fetch();await route.fulfill({response,body:await response.text()+';window.stormRoom=()=>japanRoom;'});
    });
    await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+'/#tokyo');
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('#tokyo-record-track').evaluate(a=>{a.volume=0;});
    await page.locator('[data-room-action="music"]').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>stormRoom().exterior.blend===1);
    await page.locator('[data-room-action="music"]').blur();await page.mouse.move(10,880);
    await page.evaluate(()=>{
      const room=stormRoom();room.point(0,0);room.update(0,true);room.holdView(true);
      return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    });
    // Hold the actual footage still so only the weather supplies outdoor motion.
    await page.locator('#tokyo-window-video').evaluate(v=>v.pause());
    const shot=async name=>PNG.sync.read(await page.screenshot({path:`/tmp/spin-sandstorm-${name}.png`})).data;
    const changes=(a,b,rect)=>{
      let count=0;
      for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++){
        const i=(y*1440+x)*4;
        if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>36)count++;
      }
      return count;
    };
    const windowRect={x:235,y:170,width:65,height:290},wallRect={x:900,y:80,width:150,height:180};
    const a=await shot('a');await page.waitForTimeout(180);const b=await shot('b');
    const flyingSand=changes(a,b,windowRect),inside=changes(a,b,wallRect);
    assert.ok(flyingSand>200,`A sandstorm needs visibly fast flying sand, not just slow haze: ${flyingSand}`);
    assert.ok(inside<20,`Outdoor sand must not draw over apartment walls: ${inside}`);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.waitForFunction(()=>document.querySelector('#tokyo-window-video').paused);
    const frozenA=await shot('reduced');await page.waitForTimeout(180);const frozenB=await shot('reduced-b');
    assert.equal(changes(frozenA,frozenB,windowRect),0,'Reduced motion freezes the flying sand');
    await page.locator('[data-room-action="music"]').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>stormRoom().exterior.blend===0);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.locator('#tokyo-window-video').evaluate(v=>v.pause());
    const clearA=await shot('clear');await page.waitForTimeout(180);const clearB=await shot('clear-b');
    const cleared=changes(clearA,clearB,windowRect);
    assert.ok(cleared<50,`Stopping the song clears the fast windblown particles: ${cleared}`);
    assert.deepEqual(errors,[]);
    console.log('PASS: fast outdoor sand, indoor occlusion, reduced-motion freeze and song-stop clearing',{flyingSand,inside,cleared});
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
