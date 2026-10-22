const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.clock.setSystemTime(new Date('2026-10-18T12:00:00Z'));
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && /Shader|WebGL/.test(m.text())) errors.push(m.text()); });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
  await page.locator('#loading-screen').waitFor({state:'hidden'});
    const result = await page.evaluate(async () => {
      const T = await import('three');
      const { createJapanRoom } = await import('/japan-room.js');
      const room = await createJapanRoom(); room.resize(1440, 900); room.setVisible(true, false);
      room.scene.updateMatrixWorld(true);
      const initial = room.camera.position.clone();
      room.point(.8, .4); room.update(3, false); room.scene.updateMatrixWorld(true);
      const movement = initial.distanceTo(room.camera.position);
      if (movement < .005 || movement > .08) throw new Error('Bounded camera translation must create natural window parallax');
      const exterior = room.scene.getObjectByName('Tokyo exterior');
      if (!exterior) throw new Error('Window needs a coherent distant Tokyo view');
      const horizon = exterior.getObjectByName('Tokyo apartment view');
      if (room.camera.far < room.camera.position.distanceTo(horizon.position)+50) throw new Error('The actual horizon must remain inside the room camera far plane');
      if (exterior.children.length !== 1) throw new Error('Do not invent foreground buildings or props');
      // Compare translational parallax at two physical distances, holding orientation fixed.
      const a = new T.Vector3(7, 1.7, 7), b = new T.Vector3(170, 1.7, 150);
      const project = p => p.clone().project(room.camera);
      const pa = project(a), pb = project(b);
      room.camera.position.add(new T.Vector3(.02, 0, 0)); room.camera.updateMatrixWorld(true);
      const nearShift = pa.distanceTo(project(a)), farShift = pb.distanceTo(project(b));
      if (nearShift < farShift * 4) throw new Error('Near exterior must move more than distant skyline');
      room.reset(); room.update(1, true); room.scene.updateMatrixWorld(true);
      if (initial.distanceTo(room.camera.position) > .00001) throw new Error('Reduced motion must keep camera stationary');
      if (room.scene.getObjectByName('Room lived-in details') || room.scene.getObjectByName('Warm desk lamp')) throw new Error('Use only the authored room props');
      if (['Left_speaker_lead','Record_player_lead'].some(name => room.scene.getObjectByName(name))) throw new Error('Generated cable props must also be removed');
      if (!room.scene.getObjectByName('Cube006_4')?.visible) throw new Error('Restore the authored door hardware');
      const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js');
      const source = await new GLTFLoader().loadAsync('/assets/JapanRoom.glb?v=20261018-optimized-25');
      let verifiedCorners=0;
      for (const name of ['Cube002','Cube011']) {
        const before = source.scene.getObjectByName(name).geometry.toNonIndexed();
        const after = room.scene.getObjectByName(name).geometry;
        for (const attribute of (name==='Cube002'?['uv']:['position','normal','uv'])) {
          const a=before.attributes[attribute].array,b=after.attributes[attribute].array;
          if (a.length!==b.length || a.some((v,i)=>v!==b[i])) throw new Error('Lighting UV update changed source '+attribute+' on '+name);
        }
        verifiedCorners += after.attributes.position.count;
        before.dispose();
      }
      const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setSize(720,450);
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
      const target = new T.WebGLRenderTarget(720,450); renderer.setRenderTarget(target);
      renderer.render(room.scene, room.camera);
      const draws = renderer.info.render.calls;
      renderer.dispose(); target.dispose(); room.dispose();
      return { movement, nearShift, farShift, verifiedCorners, draws };
    });
    assert.ok(result.draws < 160, 'Exterior detail must use batched geometry');
    assert.deepEqual(errors, []);
    console.log('PASS: coherent exterior, camera parallax/reduced motion, preserved UV0 and shelf geometry, measured desk construction and bounded draw calls', result);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
