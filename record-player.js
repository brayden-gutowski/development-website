import * as THREE from 'three';

// Cylinder.005 contains the entire authored pickup, including its fixed foot.
// Separate connected islands at glTF material seams; retain every original
// vertex attribute and triangle instead of adding replacement turntable parts.
export function createRecordPlayer(scene,labelTexture) {
  const arm = scene.getObjectByName('Cylinder005') || scene.getObjectByName('Cylinder.005');
  if (!arm) return null;
  const disc=scene.getObjectByName('Vinyl');
  if(disc&&labelTexture){
    labelTexture.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.MeshStandardMaterial({name:'Pressed vinyl label',map:labelTexture,roughness:.74,metalness:0,side:THREE.DoubleSide});
    disc.traverse(object=>{
      if(!object.isMesh||!/^PlasticMoldLeather006|^PlasticDamaged001/.test(object.material.name))return;
      // Reuse the authored circular faces. Planar UVs crop the supplied square
      // to their circular boundary, with one continuous image across the ring.
      const positions=object.geometry.attributes.position,uv=new Float32Array(positions.count*2);
      for(let i=0;i<positions.count;i++){
        uv[i*2]=.5+positions.getX(i)/.157;
        uv[i*2+1]=.5-positions.getZ(i)/.157;
      }
      object.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
      object.material=label;
    });
  }
  const meshes = [];
  arm.traverse(object => { if (object.isMesh) meshes.push(object); });
  const parents = [], points = [], seams = new Map(), sources = [];
  const find = i => {
    while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; }
    return i;
  };
  const join = (a, b) => { parents[find(a)] = find(b); };
  for (const mesh of meshes) {
    const offset = parents.length, position = mesh.geometry.attributes.position;
    sources.push({ mesh, offset });
    for (let i = 0; i < position.count; i++) {
      const point = [position.getX(i), position.getY(i), position.getZ(i)], id = parents.length;
      parents.push(id); points.push(point);
      const key = point.map(value => Math.round(value * 1e5)).join(',');
      if (seams.has(key)) join(id, seams.get(key)); else seams.set(key, id);
    }
    const index = mesh.geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      join(offset + index.getX(i), offset + index.getX(i + 1));
      join(offset + index.getX(i), offset + index.getX(i + 2));
    }
  }
  const bounds = new Map();
  points.forEach((point, i) => {
    const id = find(i), bound = bounds.get(id) || { maxX: -Infinity, maxY: -Infinity };
    bound.maxX = Math.max(bound.maxX, point[0]); bound.maxY = Math.max(bound.maxY, point[1]); bounds.set(id, bound);
  });
  const roles = new Map([...bounds].map(([id, b]) => [id,
    b.maxY < -.025 && b.maxX < .04 ? 'fixed' : b.maxX < 0 ? 'gimbal' : 'pickup']));
  // Measured from the original circular foot and the gimbal's horizontal axle.
  const foot = new THREE.Vector3(-.033177, 0, .028443);
  const axle = new THREE.Vector3(-.0249335, -.003205, .015835);
  const yaw = new THREE.Group(), pitch = new THREE.Group();
  yaw.name = 'Record player yaw pivot'; yaw.position.copy(foot); arm.add(yaw);
  pitch.name = 'Record player pitch pivot'; pitch.position.copy(axle).sub(foot); yaw.add(pitch);
  for (const { mesh, offset } of sources) {
    const original = mesh.geometry, index = original.index, triangles = { fixed: [], gimbal: [], pickup: [] };
    for (let i = 0; i < index.count; i += 3) {
      triangles[roles.get(find(offset + index.getX(i)))].push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    }
    for (const role of ['gimbal', 'pickup']) {
      if (!triangles[role].length) continue;
      const part = mesh.clone(false);
      part.name = `${mesh.name} ${role}`;
      part.geometry = original.clone(); part.geometry.setIndex(triangles[role]);
      part.position.sub(role === 'pickup' ? axle : foot);
      (role === 'pickup' ? pitch : yaw).add(part);
    }
    if (triangles.fixed.length) { mesh.geometry = original.clone(); mesh.geometry.setIndex(triangles.fixed); }
    else mesh.removeFromParent();
    original.dispose();
  }
  const parkedYaw = Math.atan2(.107555 - foot.x, -(-.076219 - foot.z));
  const playingYaw = .30, innerYaw = -.22, contactPitch = .0034, liftedPitch = .15;
  const liftAxis = new THREE.Vector3(.092054, 0, .1324885).normalize();
  const state = arm.userData.recordArm = {
    phase: 'parked', contact: false, requestedPlaying: false, yaw: parkedYaw, pitch: 0,
    parkedYaw, playingYaw, progress:0, pivot: foot.toArray(), axle: axle.toArray(),
    vinylRadius: .222626, outerGrooveRadius: .210,
  };
  let trackingYaw=playingYaw;
  let stages = [], stage = 0, elapsed = 0, fromYaw = parkedYaw, fromPitch = 0;
  const apply = () => {
    yaw.rotation.y = state.yaw;
    pitch.quaternion.setFromAxisAngle(liftAxis, state.pitch);
  };
  function settle(playing) {
    stages = []; stage = 0; elapsed = 0;
    state.requestedPlaying = playing; state.contact = playing;
    state.phase = playing ? 'playing' : 'parked';
    state.yaw = playing ? trackingYaw : parkedYaw; state.pitch = playing ? contactPitch : 0;
    apply();
  }
  function start(playing) {
    state.requestedPlaying = playing; state.contact = false;
    fromYaw = state.yaw; fromPitch = state.pitch; elapsed = 0; stage = 0;
    const targetYaw = playing ? trackingYaw : parkedYaw;
    stages = [
      { phase: 'lifting', duration: .20, yaw: state.yaw, pitch: liftedPitch },
      { phase: 'swinging', duration: .70, yaw: targetYaw, pitch: liftedPitch },
      { phase: 'lowering', duration: .35, yaw: targetYaw, pitch: playing ? contactPitch : 0 },
    ];
    state.phase = 'lifting';
  }
  settle(false);
  return {
    state,
    get contact() { return state.contact; },
    update(dt, playing, reducedMotion = false, progress = 0) {
      state.progress=THREE.MathUtils.clamp(Number.isFinite(progress)?progress:0,0,1);
      // The authored arm's available sweep approaches the inner reachable
      // groove without stretching the tube or detaching its fixed pivot.
      trackingYaw=THREE.MathUtils.lerp(playingYaw,innerYaw,state.progress);
      // Clockwise from above, at the standard 33⅓ RPM.
      if(disc&&playing&&!reducedMotion)disc.rotation.y=THREE.MathUtils.euclideanModulo(disc.rotation.y-Math.max(0,dt)*Math.PI*2*(33+1/3)/60,Math.PI*2);
      if (reducedMotion) {
        if (stages.length || playing !== state.requestedPlaying || playing&&state.yaw!==trackingYaw) settle(playing);
        return;
      }
      if (playing !== state.requestedPlaying) start(playing);
      if (!stages.length) { if(playing&&state.yaw!==trackingYaw){state.yaw=trackingYaw;apply();}return; }
      let remaining = Math.max(0, dt);
      while (stage < stages.length) {
        const target = stages[stage], step = Math.min(remaining, target.duration - elapsed);
        elapsed += step; remaining -= step;
        const t = Math.min(1, elapsed / target.duration), eased = t * t * (3 - 2 * t);
        state.yaw = THREE.MathUtils.lerp(fromYaw, target.yaw, eased);
        state.pitch = THREE.MathUtils.lerp(fromPitch, target.pitch, eased);
        state.phase = target.phase;
        if (elapsed < target.duration - 1e-8) break;
        fromYaw = target.yaw; fromPitch = target.pitch; elapsed = 0; stage++;
      }
      if (stages.length && stage === stages.length) settle(playing); else apply();
    },
    reset() { state.progress=0;trackingYaw=playingYaw;settle(false); },
  };
}
