const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:4173';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors=[];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/script.js*', async route => {
      const response=await route.fetch();
      await route.fulfill({response,body:await response.text()+`;window.locationProbe={focus:focusLocation,point(id){const p=markerHitTargets.find(m=>m.userData.locationId===id).getWorldPosition(new THREE.Vector3()).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};}};`});
    });
    await page.goto(base);
    await page.locator('#loading-screen').waitFor({ state:'hidden' });
    assert.equal(await page.title(),'Towski.dev');
    for(const [id,title] of [['gainesville','Gainesville, Florida'],['nashville','Nashville, Tennessee']]){
      await page.evaluate(id=>locationProbe.focus(id),id);
      await page.getByRole('button',{name:'Close location details'}).click();
      const point=await page.evaluate(id=>locationProbe.point(id),id);
      await page.mouse.move(point.x,point.y);
      await page.waitForURL(`**/#${id}`);
      assert.equal(await page.title(),`${title} | Towski.dev`);
      if(id==='gainesville') await page.mouse.wheel(0,20);
      else {
        await page.mouse.down();
        await page.mouse.move(point.x+80,point.y+20,{steps:4});
        await page.mouse.up();
      }
      await page.waitForFunction(()=>!location.hash);
      await page.mouse.move(20,20);
      await page.waitForFunction(()=>!location.hash);
      assert.equal(await page.title(),'Towski.dev');
    }
    await page.getByRole('button',{name:/Tokyo, Japan/}).click();
    await page.getByRole('button',{name:'Explore',exact:true}).click();
    await page.locator('#app.is-in-room:not(.is-travelling)').waitFor({timeout:60000});
    assert.equal(await page.evaluate(()=>location.hash),'#tokyo');
    assert.equal(await page.title(),'Tokyo, Japan | Towski.dev');
    await page.getByRole('button',{name:'Diary · Japanese Blog',exact:true}).focus();
    await page.keyboard.press('Enter');
    await page.locator('#diary-reader[data-phase="reading"]').waitFor();
    assert.equal(await page.evaluate(()=>location.hash),'#tokyo/diary/table-of-contents');
    assert.equal(await page.title(),'Table of Contents | Diary | Tokyo, Japan | Towski.dev');
    await page.keyboard.press('ArrowRight');
    await page.waitForURL('**/#tokyo/diary/intermediate-japanese/blog-entry-8-21-2026');
    assert.match(await page.title(),/初めまして.*Diary.*Towski\.dev/);
    await page.evaluate(()=>history.back());
    await page.getByRole('heading',{name:'目次',exact:true}).waitFor();
    await page.getByRole('button',{name:'Put diary back',exact:true}).click();
    assert.equal(await page.evaluate(()=>location.hash),'#tokyo');
    await page.getByRole('button',{name:'Books · Japanese Books',exact:true}).focus();
    await page.keyboard.press('Enter');
    await page.locator('#book-reader[data-phase="reading"]').waitFor();
    assert.equal(await page.evaluate(()=>location.hash),'#tokyo/books/akai-sakana-to-kodomo');
    assert.match(await page.title(),/Books.*Tokyo, Japan.*Towski\.dev/);
    await page.getByRole('button',{name:'Put books back',exact:true}).click();
    assert.equal(await page.evaluate(()=>location.hash),'#tokyo');
    await page.getByRole('button',{name:'Door · Return to globe',exact:true}).focus();
    await page.keyboard.press('Enter');
    await page.locator('#app:not(.is-in-room):not(.is-travelling)').waitFor();
    assert.equal(await page.evaluate(()=>location.hash),'');
    assert.equal(await page.title(),'Towski.dev');
    await page.goto(`${base}/#tokyo/diary/table-of-contents`);
    await page.locator('#diary-reader[data-phase="reading"]').waitFor({timeout:60000});
    await page.getByRole('heading',{name:'目次',exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: map hover URLs, titles, Tokyo/reader routes, diary contents, Back, exit and fresh contents link');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
