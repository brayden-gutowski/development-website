import * as THREE from 'three';

export function createGainesvilleLamp(scene, meshes) {
  const name = mesh => mesh.name.replace(/[._\s]/g, '');
  const bulb = meshes.find(mesh => name(mesh).startsWith('LightBulb008GeoLOD0'));
  const shade = meshes.find(mesh => /^Cone0*1$/.test(name(mesh)));
  const cord = meshes.find(mesh => /^Cylinder0*4$/.test(name(mesh)));
  const parts = [bulb, shade, cord].filter(Boolean);
  scene.updateMatrixWorld(true);
  const originals = parts.map(mesh => ({
    mesh, parent: mesh.parent, position: mesh.position.clone(),
    quaternion: mesh.quaternion.clone(), scale: mesh.scale.clone(), matrix: mesh.matrix.clone(),
  }));
  const bulbCenter = bulb ? new THREE.Box3().setFromObject(bulb).getCenter(new THREE.Vector3())
    : new THREE.Vector3(-.433, 2.433, 1.133);
  // The exported cord extends through the ceiling; its top is not the suspension point.
  const suspension = cord ? new THREE.Box3().setFromObject(cord).getCenter(new THREE.Vector3()) : bulbCenter.clone();
  const ray = new THREE.Raycaster(new THREE.Vector3(suspension.x, bulbCenter.y, suspension.z), new THREE.Vector3(0, 1, 0));
  const architecture = meshes.filter(mesh => {
    for (let owner = mesh; owner; owner = owner.parent) if (name(owner) === 'Cube') return true;
    return false;
  });
  const ceiling = ray.intersectObjects(architecture, false)[0];
  const pivot = new THREE.Group();
  pivot.name = 'Original lamp suspension';
  pivot.position.set(suspension.x, ceiling?.point.y ?? 3.3865, suspension.z);
  scene.add(pivot);
  const localBulbCenter = bulb ? bulb.worldToLocal(bulbCenter.clone()) : bulbCenter.clone();
  const position = new THREE.Vector3();
  const frequency = Math.PI * 2 / 1.7, damping = .45;
  const dampedFrequency = Math.sqrt(frequency * frequency - damping * damping);
  let flickerTime = 0, sinceClick = 0, velocity = 0, active = false, angle = 0, intensity = 1;

  function reset() {
    for (const original of originals) {
      const {mesh, parent} = original;
      if (mesh.parent !== parent) parent.add(mesh);
      mesh.position.copy(original.position);
      mesh.quaternion.copy(original.quaternion);
      mesh.scale.copy(original.scale);
      mesh.matrix.copy(original.matrix);
    }
    pivot.rotation.set(0, 0, 0);
    flickerTime = 0; sinceClick = 0; velocity = 0; active = false; angle = 0; intensity = 1;
    scene.updateMatrixWorld(true);
  }

  function pulse(time, center, halfWidth) {
    const phase = Math.abs(time - center) / halfWidth;
    return phase < 1 ? (1 + Math.cos(Math.PI * phase)) / 2 : 0;
  }

  return {
    meshes: parts,
    pivot,
    trigger() {
      if (!parts.length) return;
      if (!active) {
        scene.updateMatrixWorld(true);
        for (const part of parts) pivot.attach(part);
        flickerTime = 0;
      } else if (sinceClick >= .3) flickerTime = 0;
      // Push in the current direction, with a bounded pendulum energy budget.
      const direction = Math.sign(velocity) || -Math.sign(angle) || 1;
      const speedLimit = frequency * Math.sqrt(Math.max(0, .12 * .12 - angle * angle));
      velocity = direction * Math.min(Math.abs(velocity) + .085, speedLimit);
      sinceClick = 0;
      active = true;
    },
    update(dt, reducedMotion = false) {
      if (!active) return;
      dt = Math.max(0, Number.isFinite(dt) ? dt : 0);
      flickerTime += dt;
      sinceClick += dt;
      if (reducedMotion) { angle = 0; velocity = 0; }
      else {
        // Exact damped-oscillator step keeps impulses consistent across frame rates.
        const decay = Math.exp(-damping * dt), cosine = Math.cos(dampedFrequency * dt);
        const sine = Math.sin(dampedFrequency * dt) / dampedFrequency;
        const nextAngle = decay * (angle * cosine + (velocity + damping * angle) * sine);
        velocity = decay * (velocity * cosine - (damping * velocity + frequency * frequency * angle) * sine);
        angle = nextAngle;
      }
      intensity = reducedMotion ? 1 - .2 * pulse(flickerTime, .4, .4)
        : 1 - .35 * pulse(flickerTime, .2, .18) - .22 * pulse(flickerTime, .62, .13);
      if (sinceClick >= 1 && Math.hypot(angle, velocity / frequency) < .00015) { reset(); return; }
      pivot.rotation.z = angle;
      pivot.updateMatrixWorld(true);
    },
    reset,
    get state() { return {active, angle, intensity}; },
    get position() {
      if (bulb) { bulb.updateWorldMatrix(true, false); return position.copy(localBulbCenter).applyMatrix4(bulb.matrixWorld); }
      return position.copy(bulbCenter);
    },
  };
}
