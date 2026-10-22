const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

// Catches lost authored texture response, detached supports, and accidental UV rebakes.
(async () => {
  assert.ok(fs.existsSync(path.join(__dirname, '../room-finish.js')), 'Furniture finish helper is required');
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.route('**/finish-review', route => route.fulfill({ contentType: 'text/html', body: '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"}}</script>' }));
    await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4173') + '/finish-review');
    const result = await page.evaluate(async () => {
      const T = await import('three');
      const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js');
      const { applyRoomFinish } = await import('/room-finish.js');
      const { scene } = await new GLTFLoader().loadAsync('/assets/JapanRoom.glb');
      const source = ['Cube002', 'Cube011'].map(name => {
        const mesh = scene.getObjectByName(name);
        return { mesh, geometry: mesh.geometry, attributes: ['position', 'normal', 'uv', 'uv1'].filter(key => mesh.geometry.attributes[key]).map(key => [key, mesh.geometry.attributes[key].array.slice()]) };
      });
      for (const material of new Set(source.map(s => s.mesh.material))) {
        material.lightMap = new T.Texture(); material.lightMapIntensity = .8;
      }
      const originalDeskBounds = new T.Box3().setFromObject(source[0].mesh);
      const originalIndex = source[0].geometry.index.array.slice();
      applyRoomFinish(scene);
      for (const { mesh, geometry, attributes } of source) {
        if (mesh.geometry !== geometry) throw new Error('Source joinery topology changed');
        for (const [key, before] of attributes) {
          if (mesh.name === 'Cube002' && /position|normal/.test(key)) continue;
          if (before.some((v, i) => v !== geometry.attributes[key].array[i])) throw new Error('Source ' + key + ' changed');
        }
        const m = mesh.material;
        if (!m.map || !m.normalMap || !m.roughnessMap || m.metalness !== 0) throw new Error('Preserve authored wood maps and dielectric response');
        if (Math.abs(m.lightMapIntensity - .8) > .00001) throw new Error('Preserve the supplied baked illumination without strengthening reflections');
        // ORM green runs .447–.514: it must retain a visible range above the .44 room floor.
        const lo = Math.max(.44, m.roughness * 114 / 255), hi = Math.max(.44, m.roughness * 131 / 255);
        if (hi - lo < .04) throw new Error('Room roughness floor flattened the authored wood again');
      }
      const brackets = scene.getObjectByName('Desk wall brackets');
      if (!brackets?.isInstancedMesh || brackets.count > 3) throw new Error('Use a single bounded construction draw');
      scene.updateMatrixWorld(true);
      const desk = scene.getObjectByName('Cube002'), wall = scene.getObjectByName('Cube');
      const ray = new T.Raycaster(), matrix = new T.Matrix4(), point = new T.Vector3();
      const deskBounds = new T.Box3().setFromObject(desk);
      if (Math.abs(deskBounds.max.y - originalDeskBounds.max.y) > .000001 || Math.abs(deskBounds.min.y - originalDeskBounds.min.y) > .000001) throw new Error('Thinner slab must retain top and floor contacts');
      ray.set(new T.Vector3(2.85, .6, 5.72), new T.Vector3(0, 1, 0));
      const thickness = deskBounds.max.y - ray.intersectObject(desk, false)[0].point.y;
      if (Math.abs(thickness - .06584) > .001) throw new Error('Desk slab must be about 65mm thick');
      if (originalIndex.some((v, i) => v !== desk.geometry.index.array[i])) throw new Error('Deformation reordered joinery triangles');
      const normals = desk.geometry.attributes.normal, positionsAfter = desk.geometry.attributes.position;
      const oldPositions = source[0].attributes.find(([key]) => key === 'position')[1];
      const oldNormals = source[0].attributes.find(([key]) => key === 'normal')[1];
      const lowerNormalScale = (originalDeskBounds.max.y - (originalDeskBounds.max.y - .725468636) * .45 - originalDeskBounds.min.y) / (.725468636 - originalDeskBounds.min.y);
      for (let i = 0; i < normals.count; i++) {
        const length = Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i));
        if (!Number.isFinite(length) || Math.abs(length - 1) > .00001 || !Number.isFinite(positionsAfter.getY(i))) throw new Error('Deformed desk requires finite normalized normals');
        const derivative = oldPositions[i * 3 + 1] >= .725467636 ? .45 : lowerNormalScale;
        const expected = new T.Vector3(oldNormals[i * 3], oldNormals[i * 3 + 1] / derivative, oldNormals[i * 3 + 2]).normalize();
        if (expected.distanceTo(new T.Vector3().fromBufferAttribute(normals, i)) > .00001) throw new Error('Preserve weighted bevel normals through inverse vertical scale');
      }
      for (let i = 0; i < brackets.count; i++) {
        brackets.getMatrixAt(i, matrix);
        point.set(.25, 0, .014).applyMatrix4(matrix).applyMatrix4(brackets.matrixWorld);
        ray.set(point.clone().add(new T.Vector3(0, -.02, 0)), new T.Vector3(0, 1, 0));
        const underside = ray.intersectObject(desk, false)[0];
        if (!underside || Math.abs(underside.point.y - point.y) > .004) throw new Error('Bracket arm is detached from desk underside');
        point.set(0, -.12, .014).applyMatrix4(matrix).applyMatrix4(brackets.matrixWorld);
        const back = new T.Vector3(-1, 0, 0).transformDirection(matrix);
        ray.set(point.clone().addScaledVector(back, -.02), back);
        const mounting = ray.intersectObject(wall, true)[0];
        if (!mounting || mounting.distance > .025) throw new Error('Bracket back is detached from room wall');
      }
      // Welding positional seams must leave exactly two triangles at each closed edge.
      const positions = brackets.geometry.attributes.position, edges = new Map();
      const key = i => [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => Math.round(v * 1e6)).join(',');
      for (let i = 0; i < positions.count; i += 3) for (const [a, b] of [[i, i + 1], [i + 1, i + 2], [i + 2, i]]) {
        const pair = [key(a), key(b)].sort().join('/');
        edges.set(pair, (edges.get(pair) || 0) + 1);
      }
      if ([...edges.values()].some(count => count !== 2)) throw new Error('Construction geometry has open or nonmanifold edges');
      return { brackets: brackets.count, thickness, woodRoughness: source[0].mesh.material.roughness, sourceCorners: source.reduce((sum, s) => sum + s.geometry.attributes.position.count, 0) };
    });
    console.log('PASS: mapped charcoal finish, thinner slab, source UV/topology preserved, closed wall-mounted construction', result);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
