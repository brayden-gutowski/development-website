const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {PNG}=require('pngjs');

(async()=>{
  const browser=await (process.env.TEST_BROWSER==='webkit'?webkit.launch({headless:true}):chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']}));
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&message.text().includes('THREE.WebGLProgram'))errors.push(message.text());});
    page.on('request',request=>requests.push(request.url()));
    await page.route('**/script.js*',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:await response.text()+';window.spinRoom=()=>japanRoom;'});
    });
    await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+'/#tokyo');
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
    const video=page.locator('#tokyo-window-video'),track=page.locator('#tokyo-record-track');
    const source=await video.evaluate(v=>v.currentSrc);
    assert.match(source,/^blob:/,'The whole city clip must be buffered before playback');
    await track.evaluate(a=>{a.volume=0;});
    await page.mouse.move(10,880);
    const pixels=async name=>PNG.sync.read(await page.screenshot({path:`/tmp/spin-city-${name}.png`})).data;
    const baseline=await pixels('normal');
    const play=async()=>{await page.locator('[data-room-action="music"]').focus();await page.keyboard.press('Enter');};
    await play();
    await page.waitForFunction(()=>document.querySelector('#tokyo-record-track').dataset.phase==='lead-in');
    assert.equal(await page.evaluate(()=>spinRoom().exterior.blend),0,'Keep ordinary lighting during the needle lead-in');
    await page.waitForFunction(()=>spinRoom().exterior.blend===1);
    assert.equal(await page.locator('#spin-window-video').count(),0,'Keep the apartment/city footage instead of replacing it with a desert clip');
    assert.ok(!requests.some(url=>/spin-(monument|mojave)-window/.test(url)),'The effect must not download a separate short video');
    assert.equal(await video.evaluate(v=>v.currentSrc),source);
    assert.equal(await video.evaluate(v=>v.paused),true,'Reduced motion freezes the city footage and dust');
    await page.locator('[data-room-action="music"]').blur();
    await page.mouse.move(10,880);
    const warm=await pixels('western');
    await page.screenshot({path:'/tmp/spin-city-detail.png',clip:{x:0,y:0,width:610,height:680}});
    const luminance=(a,i)=>a[i]*.2126+a[i+1]*.7152+a[i+2]*.0722;
    const edgesA=[],edgesB=[];let changed=0;
    for(let y=170;y<460;y++)for(let x=235;x<300;x++){
      const i=(y*1440+x)*4;
      if(Math.abs(warm[i]-baseline[i])+Math.abs(warm[i+1]-baseline[i+1])+Math.abs(warm[i+2]-baseline[i+2])>30)changed++;
      edgesA.push(luminance(baseline,i+4)-luminance(baseline,i));
      edgesB.push(luminance(warm,i+4)-luminance(warm,i));
    }
    const mean=a=>a.reduce((s,n)=>s+n,0)/a.length,ma=mean(edgesA),mb=mean(edgesB);
    let covariance=0,va=0,vb=0;
    for(let i=0;i<edgesA.length;i++){const a=edgesA[i]-ma,b=edgesB[i]-mb;covariance+=a*b;va+=a*a;vb+=b*b;}
    const correlation=covariance/Math.sqrt(va*vb);
    assert.ok(correlation>.9,`Buildings and streets must keep their shape during the lighting change: ${correlation}`);
    assert.ok(changed>1500,'Western sunlight and dust must visibly change the city atmosphere');
    await page.locator('[data-room-action="music"]').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>spinRoom().exterior.blend===0);
    const restored=await pixels('restored');let remaining=0;
    for(let y=170;y<460;y++)for(let x=235;x<300;x++){
      const i=(y*1440+x)*4;
      if(Math.abs(restored[i]-baseline[i])+Math.abs(restored[i+1]-baseline[i+1])+Math.abs(restored[i+2]-baseline[i+2])>30)remaining++;
    }
    assert.equal(remaining,0,'Pausing restores the original city lighting');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await play();
    await page.waitForFunction(()=>spinRoom().exterior.blend===1);
    assert.equal(await video.evaluate(v=>v.paused),false,'The city must keep moving while SPIN is playing');
    // Actual accelerated playback exercises all 305 seconds and about eleven city loops.
    // Buffer audio because the local preview server does not implement Range requests.
    const originalSong=await track.evaluate(async audio=>{
      const original=audio.currentSrc,blob=await (await fetch(original)).blob(),source=URL.createObjectURL(blob);
      await new Promise(resolve=>{audio.addEventListener('loadedmetadata',resolve,{once:true});audio.src=source;audio.load();});
      audio.playbackRate=16;await audio.play();
      audio.addEventListener('ended',()=>URL.revokeObjectURL(source),{once:true});
      return original;
    });
    await video.evaluate(v=>{
      v.currentTime=0;v.playbackRate=16;
      window.spinCityLoops=0;let previous=0;
      v.addEventListener('timeupdate',()=>{if(v.currentTime<previous)window.spinCityLoops++;previous=v.currentTime;});
    });
    for(const second of [60,120,180,240,300]){
      await page.waitForFunction(second=>document.querySelector('#tokyo-record-track').currentTime>=second,second);
      assert.equal(await page.evaluate(()=>spinRoom().exterior.blend),1,`Keep the atmosphere active at song second ${second}`);
      assert.equal(await video.evaluate(v=>v.paused),false,`Keep city motion at song second ${second}`);
    }
    await page.waitForFunction(()=>document.querySelector('#tokyo-record-track').dataset.phase==='runout');
    await page.waitForFunction(()=>spinRoom().exterior.blend===0);
    const loops=await page.evaluate(()=>window.spinCityLoops);
    assert.ok(loops>=5,`The fully buffered city must loop throughout the song: ${loops}`);
    await page.waitForFunction(()=>!spinRoom().soundtrack.playing);
    await track.evaluate((a,source)=>{a.src=source;a.playbackRate=1;a.load();},originalSong);
    await video.evaluate(v=>{v.playbackRate=1;});
    await play();await page.waitForFunction(()=>spinRoom().exterior.blend===1);
    await page.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.evaluate(()=>spinRoom().exterior.blend),0);
    assert.equal(await video.evaluate(v=>v.paused),true);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await play();await page.waitForFunction(()=>spinRoom().exterior.blend===1);
    await page.getByRole('button',{name:'Door · Return to globe',exact:true}).focus();await page.keyboard.press('Enter');
    await page.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor();
    assert.equal(await page.evaluate(()=>spinRoom().exterior.blend),0);
    assert.equal(await video.evaluate(v=>v.paused),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: city preserved, Western lighting, reduced motion, full 305-second track, repeated video loops, pause/end/hidden/exit restoration',{changed,correlation,remaining,loops});
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
