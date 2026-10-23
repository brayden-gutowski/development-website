const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 try {
  for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
   const page=await browser.newPage({viewport,reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');
   await page.locator('#loading-screen').waitFor({state:'hidden'});
   await page.getByRole('button',{name:/Tokyo, Japan/}).click();
   await page.getByRole('button',{name:'Explore',exact:true}).click();
   await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
   await page.getByRole('button',{name:'Diary · Japanese Blog'}).focus();await page.keyboard.press('Enter');
   const diary=page.getByRole('dialog',{name:'Japanese diary'});
   await diary.waitFor({timeout:10000});
   await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:15000});
   assert.equal(await page.locator('#content-drawer.is-open').count(),0,'The diary must replace the glass drawer');
   await diary.getByRole('button',{name:'初めまして',exact:true}).click();
   assert.equal(await page.evaluate(()=>Boolean(document.activeElement.closest('#diary-reader'))),true,'Choosing a contents entry keeps focus in the diary');
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>Boolean(document.activeElement.closest('#diary-reader'))),true,'Keyboard focus stays inside the open diary');
   await page.locator('.diary-copy').getByText('こんにちはみなさん。',{exact:true}).waitFor();
   assert.ok(await page.locator('.diary-photo img').count()>0,'Photographs belong on the left page');
   assert.equal(await page.locator('.diary-copy').evaluate(e=>e.scrollHeight<=e.clientHeight+2),true,'Writing must fit its page');
   assert.ok((await page.locator('.diary-copy').evaluate(e=>getComputedStyle(e).fontFamily)).includes('Klee'),'Use neat handwritten Japanese');
   assert.equal(await page.evaluate(()=>document.fonts.check('20px "Klee One"')),true,'The actual local handwriting font must load');
   await page.screenshot({path:`/tmp/tokyo-diary-${viewport.width}.png`});
   const first=await page.locator('.diary-copy').textContent();
   await diary.getByRole('button',{name:'Next diary page'}).click();
   await page.waitForFunction(text=>document.querySelector('.diary-copy').textContent!==text,first);
   if(viewport.width<700)await page.getByRole('button',{name:'Left page'}).click();
   await diary.getByRole('button',{name:'Diary contents',exact:true}).click();
   await diary.getByRole('heading',{name:'目次',exact:true}).waitFor();
   await page.keyboard.press('Escape');
   await diary.waitFor({state:'hidden'});
   assert.equal(await page.locator('#app').evaluate(e=>e.classList.contains('is-in-room')),true,'Closing returns the diary to the room');
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS: physical diary reader, contents, photos, paginated handwritten text, navigation and room return on desktop/mobile');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
