const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const navigate=async hash=>{await page.evaluate(hash=>{location.hash=hash;},hash);};
    await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');
    await page.locator('#loading-screen').waitFor({state:'hidden'});
    await page.getByRole('button',{name:/Tokyo, Japan/}).click();
    await page.getByRole('button',{name:'Explore',exact:true}).click();
    await page.locator('#app.is-travelling').waitFor({timeout:60000});
    await navigate('#nashville');
    await page.waitForFunction(()=>document.title.startsWith('Nashville'));
    await navigate('#tokyo/diary/table-of-contents');
    await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:30000});
    assert.equal(await page.evaluate(()=>location.hash),'#tokyo/diary/table-of-contents','A new contents link cancels the deferred location during arrival');
    await page.getByRole('button',{name:'Put diary back',exact:true}).click();
    await page.locator('#diary-reader').waitFor({state:'hidden'});
    await navigate('#gainesville');
    await page.locator('#app.is-travelling').waitFor();
    await navigate('#tokyo/books/yaseuma');
    await page.locator('#book-reader[data-phase="reading"][data-book="yaseuma"]').waitFor({timeout:30000});
    assert.equal(await page.evaluate(()=>location.hash),'#tokyo/books/yaseuma','A new book link cancels the deferred location during departure');
    await page.getByRole('button',{name:'Put books back',exact:true}).click();
    await page.locator('#book-reader').waitFor({state:'hidden'});
    await navigate('#nashville');
    await page.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor({timeout:15000});
    await page.getByRole('heading',{name:'Music',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>location.hash),'#nashville');
    assert.deepEqual(errors,[]);
    console.log('PASS: latest URLs win during arrival/departure, and location links leave the room correctly');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
