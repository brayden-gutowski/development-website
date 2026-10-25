const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Shader Error|VALIDATE_STATUS|GL_INVALID/.test(m.text()))errors.push(m.text());});
 await page.route('**/script.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+';window.fourthRoom=()=>({room:activeRoom(),xp:xpDesktop,exposure:renderer.toneMappingExposure});'});});
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173')+'/#gainesville');await page.locator('#loading-screen').waitFor({state:'hidden'});const exposure=await page.evaluate(()=>fourthRoom().exposure);
 async function focusComputer(){await page.getByRole('button',{name:'Computer · Look closer',exact:true}).focus();await page.keyboard.press('Enter');}
 await focusComputer();await page.locator('#xp-computer[data-phase="desktop"]').waitFor();await page.waitForFunction(()=>fourthRoom().room.displayState.spill>.1);
 await page.keyboard.press('Escape');await page.locator('#xp-computer.is-passive').waitFor();await page.waitForFunction(()=>!fourthRoom().room.computerFocused);
 assert.equal(await page.locator('#xp-computer').evaluate(el=>el.inert),true);assert.equal(await page.evaluate(()=>fourthRoom().room.displayState.powered),true,'Zooming out preserves desktop illumination');
 assert.ok(await page.locator('.xp-screen').evaluate(el=>el.getBoundingClientRect().width<innerWidth*.5),'Passive desktop maps back onto the original physical glass');
 const hit=await page.locator('.xp-screen').evaluate(el=>{const r=el.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#xp-computer');});assert.equal(hit,false,'Passive desktop does not intercept room pointer input');
 await page.screenshot({path:'/tmp/gainesville-fourth-powered-wide.png'});await focusComputer();assert.equal(await page.locator('#xp-computer').getAttribute('data-phase'),'desktop','Refocusing resumes instead of rebooting');
 await page.getByRole('button',{name:'Start',exact:true}).click();await page.getByRole('button',{name:'Turn off computer',exact:true}).click();await page.getByRole('button',{name:'Turn Off',exact:true}).click();await page.locator('#xp-computer').waitFor({state:'hidden'});await page.waitForFunction(()=>!fourthRoom().room.displayState.powered&&fourthRoom().room.displayState.spill<.03);
 assert.equal(await page.evaluate(()=>fourthRoom().exposure),exposure,'View adaptation never changes global exposure');assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/gainesville-fourth-powered-off.png'});
 console.log('PASS: powered wide-room CRT, passive pointer/focus behavior, immediate resume, true shutdown and constant global exposure');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
