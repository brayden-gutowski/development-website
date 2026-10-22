import * as THREE from 'three';

export function applyRoomFinish(scene) {
  const materials = new Set();
  scene.traverse(object => {
    if (!object.isMesh) return;
    for (const material of [object.material].flat()) {
      if (!/SmoothDeltaBlack|BarnwoodDeltaBlack/.test(material.name) || materials.has(material)) continue;
      materials.add(material);
      // The ORM green channel is around .48. Multiplying it by .54 before
      // the room's .44 floor erased almost all of the authored satin grain.
      material.roughness = 1;
      material.metalness = 0;
      material.normalScale.set(.22,Math.sign(material.normalScale.y||1)*.22);
      material.envMapIntensity = 1.1;
      const compile = material.onBeforeCompile;
      const cacheKey = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        compile.call(material, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          // Preserve the original longitudinal grain and its contrast. This
          // is dark stained wood reflectance, so it still needs incident light.
          diffuseColor.rgb = max(diffuseColor.rgb * 3.2, vec3(.028, .026, .023));`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor * .92, .34, .73);`);
      };
      material.customProgramCacheKey = () => `${cacheKey}-charcoal-grain-v2`;
      material.needsUpdate = true;
    }
  });

  const desk = scene.getObjectByName('Cube002'), wall = scene.getObjectByName('Cube');
  if (!desk || !wall) return;
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0);
  ray.set(new THREE.Vector3(2.85, .6, 5.72), up);
  const originalUnderside = ray.intersectObject(desk, false)[0];
  if (originalUnderside) {
    const bounds = new THREE.Box3().setFromObject(desk);
    const floor = bounds.min.y, top = bounds.max.y, underside = originalUnderside.point.y;
    const newUnderside = top - (top - underside) * .45;
    const legScale = (newUnderside - floor) / (underside - floor);
    const inverseWorld = desk.matrixWorld.clone().invert();
    const normalToWorld = new THREE.Matrix3().getNormalMatrix(desk.matrixWorld);
    const normalToLocal = new THREE.Matrix3().getNormalMatrix(inverseWorld);
    const positions = desk.geometry.attributes.position, normals = desk.geometry.attributes.normal;
    const point = new THREE.Vector3(), normal = new THREE.Vector3();
    // A continuous, increasing remap keeps floor contacts and the working top
    // fixed. Legs extend to the thinner slab; the authored triangle/UV order
    // and weighted bevel normals survive, including the baked UV1 sidecar.
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(desk.matrixWorld);
      const upper = point.y >= underside - .000001, scale = upper ? .45 : legScale;
      point.y = upper ? top - (top - point.y) * .45 : floor + (point.y - floor) * legScale;
      point.applyMatrix4(inverseWorld);
      positions.setXYZ(i, point.x, point.y, point.z);
      normal.fromBufferAttribute(normals, i).applyNormalMatrix(normalToWorld);
      normal.y /= scale;
      normal.applyNormalMatrix(normalToLocal);
      normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
    positions.needsUpdate = normals.needsUpdate = true;
    desk.geometry.computeBoundingBox(); desk.geometry.computeBoundingSphere();
  }
  const matrices = [];
  // Raycast the revised underside, including the return by the side wall.
  for (const [x, z, yaw] of [[2.85, 5.72, Math.PI / 2], [3.78, 5.72, Math.PI / 2], [4.24, 4.4, Math.PI]]) {
    ray.set(new THREE.Vector3(x, .6, z), up);
    const underside = ray.intersectObject(desk, false)[0];
    if (!underside) continue;
    const rotation = new THREE.Quaternion().setFromAxisAngle(up, yaw);
    const back = new THREE.Vector3(-1, 0, 0).applyQuaternion(rotation);
    ray.set(new THREE.Vector3(x, underside.point.y - .12, z), back);
    const mounting = ray.intersectObject(wall, true)[0];
    if (!mounting || mounting.distance > .4) continue;
    const position = mounting.point.clone();
    position.y = underside.point.y;
    position.add(new THREE.Vector3(0, 0, -.014).applyQuaternion(rotation));
    scene.worldToLocal(position);
    matrices.push(new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(1, 1, 1)));
  }
  if (!matrices.length) return;
  // A closed extruded steel frame, with a triangular opening and 1mm edge
  // breaks. Existing wood already has authored 5mm bevels; leave UV1 intact.
  const profile = new THREE.Shape();
  profile.moveTo(0, 0); profile.lineTo(.53, 0); profile.lineTo(.53, -.025);
  profile.lineTo(.025, -.28); profile.lineTo(0, -.28); profile.closePath();
  const opening = new THREE.Path();
  opening.moveTo(.025, -.025); opening.lineTo(.475, -.025); opening.lineTo(.025, -.245); opening.closePath();
  profile.holes.push(opening);
  const geometry = new THREE.ExtrudeGeometry(profile, { depth: .028, steps: 1, bevelEnabled: true, bevelThickness: .001, bevelSize: .001, bevelSegments: 1, curveSegments: 1 });
  const material = new THREE.MeshStandardMaterial({ name: 'Satin steel desk brackets', color: 0x383936, metalness: .55, roughness: .6 });
  const brackets = new THREE.InstancedMesh(geometry, material, matrices.length);
  brackets.name = 'Desk wall brackets';
  brackets.userData.roomRole = 'construction';
  matrices.forEach((matrix, index) => brackets.setMatrixAt(index, matrix));
  brackets.castShadow = brackets.receiveShadow = true;
  scene.add(brackets);
  return brackets;
}
