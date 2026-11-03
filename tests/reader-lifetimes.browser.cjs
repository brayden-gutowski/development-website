const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/script.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    await page.evaluate(async () => {
      document.querySelector('#loading-screen').remove();
      const THREE = await import('three');
      const { createBookReader } = await import('/book-reader.js');
      const { createDiaryReader } = await import('/diary-reader.js');
      const entry = { id: 'first', title: '読み物', image: 'assets/BookCover.webp', imageAlt: 'Cover', dateTime: '2026-10-23', date: '2026 / 10 / 23', rating: 4, body: ['日本語の文章。'], glossary: [['本', 'book']] };
      const entries = [entry, { ...entry, id: 'second' }];
      function makeRoom() {
        const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28);
        scene.add(camera);
        function binding() {
          const object = new THREE.Object3D(); scene.add(object);
          return { object, edges: { paper: [190, 187, 175] }, duration: .1,
            rest: { position: new THREE.Vector3(0, 0, -1), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1) },
            sample(progress) { object.userData.frontAngle = progress * Math.PI; return { progress, arc: 0, rotation: progress, bank: 0 }; },
            place(matrix) { object.matrix.copy(matrix); }, restore() {}, appearance() {} };
        }
        return { scene, camera, diaryBinding: binding(), reviewBooks: entries.map(binding), holdView() {}, highlight() {} };
      }
      window.makeReaderRoom = makeRoom;
      window.readerRooms = { books: makeRoom(), diary: makeRoom() };
      window.readerWeakRefs = {
        preparedBookScene: new WeakRef(readerRooms.books.scene),
        closedDiaryScene: new WeakRef(readerRooms.diary.scene),
      };
      window.testBook = createBookReader({ entries, getRoom: () => readerRooms.books, onBook() {}, onClose() {} });
      window.testDiary = createDiaryReader({ categories: [{ id: 'test', entries }], getRoom: () => readerRooms.diary, onPage() {}, onClose() {} });
      // Background print preparation must not keep a failed room warmup alive.
      await testBook.prepare();
      readerRooms.books = null;

      const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
      readerWeakRefs.diaryTrigger = new WeakRef(trigger);
      await testDiary.open(null, false);
      for (let i = 0; i < 3; i++) testDiary.update(.05, false);
      document.querySelector('.diary-next').click();
      const turn = document.querySelector('.diary-turn-front');
      readerWeakRefs.canceledTurn = new WeakRef(turn);
      testDiary.close(true); trigger.remove(); readerRooms.diary = null;
    });
    const cdp = await page.context().newCDPSession(page);
    async function retained() {
      await cdp.send('HeapProfiler.collectGarbage');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      await cdp.send('HeapProfiler.collectGarbage');
      return page.evaluate(() => Object.fromEntries(Object.entries(readerWeakRefs).map(([name, ref]) => [name, Boolean(ref.deref())])));
    }
    const preparedAndDiary = await retained();

    await page.evaluate(async () => {
      // A reader that has already opened must also release its per-open binding.
      readerRooms.books = makeReaderRoom();
      readerWeakRefs.closedBookScene = new WeakRef(readerRooms.books.scene);
      const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
      readerWeakRefs.bookTrigger = new WeakRef(trigger);
      await testBook.open(null, true);
      readerWeakRefs.replacedReviewPage = new WeakRef(document.querySelector('.review-page--right'));
      document.querySelector('.review-next').click();
      testBook.close(true); trigger.remove(); readerRooms.books = null;
    });
    const afterClose = await retained();
    assert.deepEqual(preparedAndDiary, { preparedBookScene: false, closedDiaryScene: false, diaryTrigger: false, canceledTurn: false }, 'Closed readers release discarded room scenes, restored focus and canceled page clones');
    assert.equal(afterClose.closedBookScene, false, 'Closing books releases the previous room bindings');
    assert.equal(afterClose.bookTrigger, false, 'Closing books releases the restored focus node');
    assert.equal(afterClose.replacedReviewPage, false, 'Switching books releases replaced DOM pages');
    assert.deepEqual(errors, []);
    console.log('PASS: prepared and closed readers release discarded rooms, focus nodes and replaced page clones');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
