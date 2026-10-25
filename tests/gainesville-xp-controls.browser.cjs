const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const mobile of [false,true]){
  const p=await browser.newPage(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}:{viewport:{width:1440,height:1000}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.xpAudioStarts=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){window.xpAudioStarts.push({duration:this.buffer?.duration,state:this.context.state});return start.apply(this,args);};});
  await p.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+'/#gainesville');await p.locator('#loading-screen').waitFor({state:'hidden'});
  await p.getByRole('button',{name:'Computer · Look closer'}).focus();await p.keyboard.press('Enter');
  const root=p.locator('#xp-computer');await root.waitFor();
  assert.equal(await root.getAttribute('data-phase'),'boot','Show a real boot phase before the desktop');
  if(!mobile)await p.screenshot({path:'/tmp/gainesville-xp-boot.png'});
  await p.locator('#xp-computer[data-phase="desktop"]').waitFor({timeout:15000});
  assert.ok(await p.evaluate(()=>xpAudioStarts.some(x=>x.duration>2&&x.state==='running')),'The original startup sound starts in an unlocked audio context');
  if(!mobile){assert.ok(await p.locator('.xp-screen').evaluate(el=>el.getBoundingClientRect().height/innerHeight>.72),'The zoomed screen should occupy most of the viewport height');}
  else assert.ok(await root.evaluate(el=>el.classList.contains('is-expanded')),'Phone desktop opens at readable scale');
  if(mobile)await p.locator('[data-xp-folder="general"]').tap();else await p.locator('[data-xp-folder="general"]').dblclick();
  const folder=p.getByRole('dialog',{name:'General',exact:true});await folder.waitFor();
  await folder.getByRole('button',{name:'Maximize General',exact:true}).click();
  await folder.getByRole('button',{name:'Restore General',exact:true}).click();
  await folder.getByRole('button',{name:'Minimize General',exact:true}).click();assert.equal(await folder.isVisible(),false);
  await p.getByRole('button',{name:'Switch to General',exact:true}).click();assert.equal(await folder.isVisible(),true);
  if(mobile)await p.getByRole('button',{name:'Towski.dev.txt',exact:true}).tap();else await p.getByRole('button',{name:'Towski.dev.txt',exact:true}).dblclick();
  const note=p.getByRole('dialog',{name:'Towski.dev.txt - Notepad',exact:true});assert.match(await note.innerText(),/museum of my life/);
  assert.equal(await p.locator('#room-hud').evaluate(el=>el.inert),true,'Background room controls are inert while using XP');
  if(mobile){
    const height=await note.evaluate(el=>el.getBoundingClientRect().height);
    await p.setViewportSize({width:844,height:390});await p.waitForTimeout(150);
    await p.setViewportSize({width:390,height:844});await p.waitForTimeout(150);
    assert.ok(Math.abs(await note.evaluate(el=>el.getBoundingClientRect().height)-height)<2,'Window dimensions recover after rotating the phone');
  }
  await note.getByRole('button',{name:'Maximize Towski.dev.txt - Notepad',exact:true}).click();
  assert.ok(await note.locator('pre').evaluate(el=>el.clientWidth>200&&parseFloat(getComputedStyle(el).fontSize)>=12),'Readable selectable project text');
  await note.getByRole('button',{name:'Close Towski.dev.txt - Notepad',exact:true}).click();
  await folder.getByRole('button',{name:'Close General',exact:true}).click();
  if(mobile)await p.locator('[data-xp-folder="competition"]').tap();else await p.locator('[data-xp-folder="competition"]').dblclick();if(mobile)await p.getByRole('button',{name:'SteadyForum.txt',exact:true}).tap();else await p.getByRole('button',{name:'SteadyForum.txt',exact:true}).dblclick();
  await p.waitForFunction(()=>[...document.querySelectorAll('.xp-picture .xp-window-body img')].every(i=>i.complete&&i.naturalWidth>0)).catch(async error=>{console.error(await p.locator('.xp-picture .xp-window-body img').evaluateAll(images=>images.map(i=>({src:i.src,complete:i.complete,width:i.naturalWidth}))));throw error;});
  assert.equal(await p.locator('.xp-picture').count(),1);
  if(mobile)await p.screenshot({path:'/tmp/gainesville-xp-mobile.png'});
  await p.getByRole('button',{name:'Computer volume: on'}).click();
  await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('#xp-computer').classList.contains('is-passive'));assert.equal(await root.evaluate(el=>el.inert),true);
  assert.deepEqual(errors,[]);await p.close();
 }
 console.log('PASS: normal/reduced-motion boot, original audio playback, closer zoom, window controls, desktop and readable mobile projects');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
