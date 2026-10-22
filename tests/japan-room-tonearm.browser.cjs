const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--mute-audio'] });
  try {
    const page = await browser.newPage();
    await page.route('**/record-arm-check', route => route.fulfill({ contentType: 'text/html', body:
      '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"}}</script>' }));
    await page.goto(`${process.env.TEST_URL || 'http://127.0.0.1:4173'}/record-arm-check`);
    const result = await page.evaluate(async () => {
      const THREE = await import('three');
      const buffer = await fetch('assets/JapanRoom.glb').then(r => r.arrayBuffer());
      const header = new DataView(buffer), jsonLength = header.getUint32(12, true);
      const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
      const binaryOffset = 28 + jsonLength;
      const node = gltf.nodes.find(n => n.name === 'Cylinder.005');
      const root = new THREE.Group(); root.name = 'Cylinder005'; root.position.fromArray(node.translation); root.userData = node.extras;
      for (const [i, primitive] of gltf.meshes[node.mesh].primitives.entries()) {
        const geometry = new THREE.BufferGeometry();
        for (const [name, accessorIndex] of [...Object.entries(primitive.attributes), ['index', primitive.indices]]) {
          const accessor = gltf.accessors[accessorIndex], view = gltf.bufferViews[accessor.bufferView];
          const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
          const ArrayType = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[accessor.componentType];
          const array = new ArrayType(buffer, binaryOffset + (view.byteOffset || 0) + (accessor.byteOffset || 0), accessor.count * size);
          const attribute = new THREE.BufferAttribute(array, size);
          if (name === 'index') geometry.setIndex(attribute);
          else geometry.setAttribute({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv' }[name] || name, attribute);
        }
        const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()); mesh.name = `Authored tonearm ${i}`; root.add(mesh);
      }
      const sourceIndices = root.children.reduce((n, mesh) => n + mesh.geometry.index.count, 0);
      const scene = new THREE.Scene(); scene.add(root);
      const response = await fetch('record-player.js');
      const control = response.ok ? (await import('../record-player.js')).createRecordPlayer(scene) : null;
      const point = new THREE.Vector3(.107555, -.030383, -.076219);
      const stylus = () => {
        scene.updateMatrixWorld(true);
        const pickup = scene.getObjectByName('Record player pitch pivot')?.children[0] || root.children[0];
        return pickup.localToWorld(point.clone()).toArray();
      };
      const radius = p => Math.hypot(p[0] - 3.042554855, p[2] - 5.451008797);
      const parked = stylus(), state = root.userData.recordArm;
      if (!state) return { parkedRadius: radius(parked), configured: false };
      const totalIndices = [];
      root.traverse(o => { if (o.isMesh) totalIndices.push(o.geometry.index.count); });
      const fixed = root.children.find(o => o.isMesh);
      const fixedBefore = fixed.localToWorld(new THREE.Vector3()).toArray();
      control.update(.1, true, false);
      const lifted = { point: stylus(), yaw: state.yaw, contact: state.contact, phase: state.phase };
      control.update(.4, true, false);
      const swinging = { point: stylus(), yaw: state.yaw, pitch: state.pitch, contact: state.contact };
      control.update(.75, true, false);
      const playing = { point: stylus(), radius: radius(stylus()), contact: state.contact, phase: state.phase };
      control.update(.1, false, false);
      const returning = { point: stylus(), contact: state.contact, yaw: state.yaw };
      control.update(.2, false, false);
      const beforeReverse = stylus(); control.update(0, true, false); const afterReverse = stylus();
      control.update(2, true, false);
      control.update(2, false, false);
      const returned = { point: stylus(), phase: state.phase, contact: state.contact };
      control.update(0, true, true);
      const reduced = { point: stylus(), phase: state.phase, contact: state.contact };
      control.reset();
      return { configured: true, sourceIndices, splitIndices: totalIndices.reduce((a, b) => a + b, 0), parked, parkedRadius: radius(parked),
        parkedYaw: state.parkedYaw, lifted, swinging, playing, returning, beforeReverse, afterReverse, returned, reduced,
        reset: { point: stylus(), phase: state.phase }, fixedBefore, fixedAfter: fixed.localToWorld(new THREE.Vector3()).toArray() };
    });
    assert.ok(result.parkedRadius > .26, 'The idle stylus must park beside the vinyl instead of over a groove');
    assert.ok(result.configured, 'Configure the authored arm components');
    assert.equal(result.splitIndices, result.sourceIndices, 'Preserve every authored triangle exactly once');
    assert.ok(result.lifted.point[1] > result.parked[1] + .005, 'Lift before swinging');
    assert.equal(result.lifted.yaw, result.parkedYaw, 'Keep yaw fixed while lifting');
    assert.equal(result.lifted.contact, false);
    assert.ok(result.swinging.yaw < result.parkedYaw && result.swinging.pitch > .1, 'Sweep above the platter');
    assert.ok(result.playing.radius > .202 && result.playing.radius < .217, 'Land on the outer groove');
    assert.ok(Math.abs(result.playing.point[1] - .933644) < .001, 'Lower the stylus gently to the vinyl surface');
    assert.equal(result.playing.contact, true);
    assert.equal(result.playing.phase, 'playing');
    assert.ok(result.returning.point[1] > result.playing.point[1] + .005, 'Lift before returning');
    assert.equal(result.returning.contact, false);
    assert.deepEqual(result.beforeReverse, result.afterReverse, 'Rapid reversal must preserve the current pose');
    assert.deepEqual(result.returned.point, result.parked, 'Return to the same rest');
    assert.equal(result.returned.phase, 'parked');
    assert.equal(result.reduced.phase, 'playing');
    assert.equal(result.reduced.contact, true);
    assert.deepEqual(result.reset.point, result.parked);
    assert.equal(result.reset.phase, 'parked');
    assert.deepEqual(result.fixedBefore, result.fixedAfter, 'Keep the fixed turntable base anchored');
    console.log('PASS: authored tonearm parks outside vinyl, lifts/sweeps/lowers to outer groove, reverses safely, preserves triangles and fixed base, respects reduced motion and reset');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
