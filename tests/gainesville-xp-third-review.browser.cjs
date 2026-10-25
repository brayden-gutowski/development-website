const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {chromium}=require('playwright');
const script=readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8');
const recycledEntries=Function('return '+script.match(/recycledEntries:(\[[\s\S]+?\]),\n\s+onExit/)[1])();
const origin=process.env.TEST_URL||'http://127.0.0.1:4173';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/xp-third-review-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/xp-desktop.css"><body style="margin:0;background:#17191e"><main id="app"></main><script type="module">
   import {createXPDesktop} from '/xp-desktop.js';
   const categories=[{id:'general',label:'General',entries:[{title:'Project One',meta:'JavaScript',description:'Project email contents',href:'https://example.com/project'}]},{id:'games',label:'Game Development',entries:[]}];
   window.xp=createXPDesktop({categories,recycledEntries:${JSON.stringify(recycledEntries)},getRoom:()=>({getScreenRect:()=>({x:100,y:80,width:1024,height:768}),setDisplayState:()=>{}}),onExit:()=>xp.close(true)});
   await xp.prepare();xp.open();window.ready=true;
  </script>`}));
  await page.goto(origin+'/xp-third-review-fixture');await page.waitForFunction(()=>window.ready);
  await page.evaluate(()=>xp.update(2.6,false));assert.equal(await page.locator('#xp-computer').getAttribute('data-phase'),'welcome');
  assert.equal(await page.locator('.xp-welcome').evaluate(el=>getComputedStyle(el).cursor),'none');
  await page.evaluate(()=>xp.update(1.1,false));
  const root=page.locator('#xp-computer');if(!mobile)assert.deepEqual(await page.locator('.xp-desktop').evaluate(el=>[el.clientWidth,el.clientHeight]),[1024,768]);
  assert.equal(await page.locator('.xp-screen').evaluate(el=>getComputedStyle(el,'::after').opacity),mobile?'0.18':'0.6');
  await page.getByRole('button',{name:'Start',exact:true}).click();
  if(!mobile){const mailItem=page.locator('.xp-start-programs').getByRole('button',{name:'Outlook Express',exact:true});await mailItem.focus();await page.keyboard.press('ArrowDown');await page.locator('.xp-start-programs').getByRole('button',{name:'Internet Explorer',exact:true}).hover();assert.equal(await mailItem.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');}
  await page.locator('.xp-start-programs').getByRole('button',{name:'Internet Explorer',exact:true}).click();
  const explorer=page.locator('[data-xp-window="collection-links"]');assert.equal(await explorer.getAttribute('aria-label'),'Project websites');assert.equal(await explorer.locator('.xp-titlebar>span').innerText(),'Project websites');assert.equal(await page.getByRole('button',{name:'Switch to Project websites',exact:true}).count(),1);assert.equal(await explorer.locator('.xp-status').innerText(),'1 object');
  await explorer.getByRole('button',{name:'Close Project websites',exact:true}).click();
  const recycleIcon=page.locator('.xp-desktop-icons').getByRole('button',{name:'Recycle Bin',exact:true});if(mobile)await recycleIcon.tap();else await recycleIcon.dblclick();
  const recycle=page.locator('[data-xp-window="folder-recycle"]');assert.equal(await recycle.locator('.xp-explorer-workspace').count(),1);assert.equal(await recycle.locator('.xp-status').innerText(),'1 object');assert.equal(await recycle.locator('.xp-file').count(),1);assert.equal(await recycle.getByRole('button',{name:/Restore|Delete|Empty|Make a new folder/}).count(),0);
  await page.waitForFunction(()=>[...document.querySelectorAll('.xp-titlebar img,.xp-tasks img')].every(img=>img.complete&&img.naturalWidth>0));
  await page.screenshot({path:mobile?'/tmp/gainesville-xp-third-review-recycle-shell-mobile.png':'/tmp/gainesville-xp-third-review-recycle-shell.png'});
  const file=recycle.getByRole('button',{name:"Miner's Tycoon.txt",exact:true});if(mobile)await file.tap();else await file.dblclick();
  const note=page.locator('.xp-notepad');assert.equal(await note.locator('pre').innerText(),[recycledEntries[0].title,recycledEntries[0].meta,recycledEntries[0].description,'Game link: '+recycledEntries[0].href].join('\n\n'));
  assert.equal(await note.locator('pre').evaluate(el=>getComputedStyle(el).whiteSpace),'pre-wrap');assert.ok(await note.locator('pre').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.equal(await note.locator('a').count(),0,'Original XP Notepad is plain text');
  const picture=page.locator('.xp-picture');assert.equal(await picture.count(),1);await page.waitForFunction(()=>document.querySelector('.xp-picture-viewport img')?.naturalWidth>0);assert.ok((await picture.locator('.xp-picture-viewport img').getAttribute('src')).endsWith('assets/miners-tycoon.png'));
  assert.equal(await note.evaluate(el=>el.classList.contains('is-active')),true);assert.equal(await picture.evaluate(el=>el.classList.contains('is-active')),false);const inactiveBar=await picture.locator('.xp-titlebar').evaluate(el=>getComputedStyle(el).backgroundImage);await picture.getByRole('button',{name:'Zoom in',exact:true}).focus();assert.equal(await picture.evaluate(el=>el.classList.contains('is-active')),true);assert.notEqual(await picture.locator('.xp-titlebar').evaluate(el=>getComputedStyle(el).backgroundImage),inactiveBar);
  await page.screenshot({path:mobile?'/tmp/gainesville-xp-third-review-recycle-mobile.png':'/tmp/gainesville-xp-third-review-recycle.png'});
  for(const window of [picture,note,recycle])await window.locator('.xp-close').click();
  await page.getByRole('button',{name:'Start',exact:true}).click();await page.locator('.xp-start-programs').getByRole('button',{name:'Outlook Express',exact:true}).click();
  const outlook=page.getByRole('dialog',{name:'Outlook Express',exact:true});assert.deepEqual(await outlook.locator('.xp-menubar>span').allTextContents(),['File','Edit','View','Tools','Message','Help']);assert.equal(await outlook.getByRole('complementary',{name:'Mail folders'}).count(),1);assert.equal(await outlook.locator('.xp-mail-row').count(),1);assert.deepEqual(await outlook.locator('.xp-mail-headers dt').allTextContents(),['From:','To:','Subject:','Date:']);assert.match(await outlook.locator('.xp-mail-message').innerText(),/Project email contents/);assert.equal(await outlook.locator('.xp-mail-toolbar button').count(),7);
  await outlook.getByRole('button',{name:'Sent Items',exact:true}).click();assert.equal(await outlook.locator('.xp-status').innerText(),'0 messages');await outlook.getByRole('button',{name:'Inbox',exact:true}).click();assert.equal(await outlook.locator('.xp-status').innerText(),'1 message');await page.screenshot({path:mobile?'/tmp/gainesville-xp-third-review-mail-mobile.png':'/tmp/gainesville-xp-third-review-mail.png'});
  await page.getByRole('button',{name:'Start',exact:true}).click();await page.getByRole('button',{name:'Turn off computer',exact:true}).click();const standby=page.getByRole('button',{name:'Stand By',exact:true});assert.ok((await standby.locator('img').getAttribute('src')).endsWith('original-standby-native.png'));assert.deepEqual(await standby.locator('img').evaluate(el=>[el.naturalWidth,el.naturalHeight,parseFloat(getComputedStyle(el).width)]),[32,32,32]);
  if(!mobile)await page.screenshot({path:'/tmp/gainesville-xp-third-review-power.png'});await page.getByRole('button',{name:'Turn Off',exact:true}).click();assert.equal(await page.locator('.xp-boot').evaluate(el=>getComputedStyle(el).cursor),'none');assert.equal(await root.getAttribute('data-phase'),'shutdown');await page.evaluate(()=>xp.update(1.1,false));assert.equal(await root.isVisible(),false);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: third XP review desktop/mobile: Explorer titles/counts, read-only Recycle Bin project, original separate image, mail folders/list/headers/menus, cursor transitions, native yellow Stand By, Start hover, title focus and further 20% CRT texture reduction');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
