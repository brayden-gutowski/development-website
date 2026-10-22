import * as THREE from "three";
import { applyRoomFinish } from './room-finish.js?v=20261020-memory-1';
import { loadDiaryAnimation, createDiaryBinding } from './diary-animation.js?v=13';
import { createReviewBindings } from './book-reader.js?v=14';
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import { OutlinePass } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/OutlinePass.js";
import { SSAOPass } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/SSAOPass.js";
import { FullScreenQuad } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/Pass.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/OBJLoader.js";
import { createRecordPlayer } from './record-player.js?v=2';
import { createTokyoExterior } from './tokyo-exterior.js?v=20261020-memory-1';

// Interaction metadata is exported from the separate Blender copy; materials
// and the default camera belong to the authored scene.
function ambientSky() {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 32;
  const ctx = canvas.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, 32);
  sky.addColorStop(0, "#b7cbe0");
  sky.addColorStop(.5, "#eee9df");
  sky.addColorStop(1, "#625a50");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 64, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

function disposeScene(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.isInstancedMesh) object.dispose();
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [object.material, object.customDepthMaterial].flat()) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
    object.shadow?.dispose();
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

async function windowBackdrop() {
  const posterURL = 'assets/tokyo-window-evening.jpg?v=20261018-golden-2';
  const videoURL = 'assets/tokyo-window-evening.mp4?v=20261018-golden-2';
  const poster = await new THREE.TextureLoader().loadAsync(posterURL);
  poster.colorSpace = THREE.SRGBColorSpace;
  const video = document.createElement('video');
  video.id = 'tokyo-window-video';
  video.muted = video.defaultMuted = true;
  video.loop = video.playsInline = true;
  video.playbackRate = video.defaultPlaybackRate = 1;
  video.preload = 'auto'; video.hidden = true;
  video.poster = posterURL; video.dataset.phase = 'golden-hour';
  document.body.append(video);
  let sourceURL;
  const releaseSource = () => {
    video.pause(); video.removeAttribute('src'); video.load();
    if (sourceURL) { URL.revokeObjectURL(sourceURL); sourceURL = null; }
  };
  const ready = await new Promise(resolve => {
    const controller = new AbortController();
    let settled = false;
    const finish = loaded => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout); video.onloadeddata = video.onerror = null;
      if (!loaded) { controller.abort(); releaseSource(); }
      resolve(loaded);
    };
    const timeout = setTimeout(() => finish(false),10000);
    video.onloadeddata = () => finish(true); video.onerror = () => finish(false);
    // Native media preload may stop after its first buffered range. Own the
    // complete clip before decode so entering the room never starts a download.
    (async () => {
      try {
        const response = await fetch(videoURL, { signal: controller.signal });
        if (!response.ok) throw new Error('Window video unavailable');
        const clip = await response.blob();
        if (controller.signal.aborted) return;
        sourceURL = URL.createObjectURL(clip);
        video.src = sourceURL; video.load();
      } catch { finish(false); }
    })();
  });
  video.dataset.status = ready ? 'ready' : 'fallback';
  const texture = ready ? new THREE.VideoTexture(video) : poster;
  if (ready) poster.dispose();
  texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  return { video, texture, ready, disposeVideo() { releaseSource(); video.remove(); } };
}

async function loadJoineryData(url, type) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Joinery lighting coordinates unavailable');
  return response[type]();
}

async function loadPoster() {
  const texture = await new THREE.TextureLoader().loadAsync('assets/SBR.webp');
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  try {
    const poster = await new OBJLoader().loadAsync('assets/SBRPoster.obj');
    poster.name = 'Steel Ball Run poster';
    poster.position.z -= .012;
    poster.traverse(object => {
      if (!object.isMesh) return;
      object.material.dispose();
      // The OBJ was wound toward the wall. Shadow normal bias uses vertex
      // normals, so viewing its back face made the paper shadow itself.
      // Reverse the faces while keeping every authored position and UV intact.
      const geometry=object.geometry,indices=[];
      for(let i=0;i<geometry.attributes.position.count;i+=3)indices.push(i,i+2,i+1);
      geometry.setIndex(indices);
      const normals=geometry.attributes.normal;
      for(let i=0;i<normals.count;i++)normals.setXYZ(i,-normals.getX(i),-normals.getY(i),-normals.getZ(i));
      normals.needsUpdate=true;
      // The authored paper already has a fine grid. Lift only its corner
      // vertices a few millimetres, retaining the original UV crop and mesh.
      const paperPositions=geometry.attributes.position,uv0=geometry.attributes.uv;
      for(let i=0;i<paperPositions.count;i++){
        const lift=Math.pow(Math.abs(uv0.getX(i)-.5)*2,12)*Math.pow(Math.abs(uv0.getY(i)-.5)*2,12);
        paperPositions.setZ(i,paperPositions.getZ(i)-.0035*lift);
      }
      paperPositions.needsUpdate=true;geometry.computeVertexNormals();
      object.material = new THREE.MeshPhysicalMaterial({
        name: 'Satin printed poster', map: texture, color: 0xffffff,
        metalness: 0, roughness: .58, ior: 1.45, specularIntensity: .35,
        clearcoat: .045, clearcoatRoughness: .4, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      });
      object.castShadow = object.receiveShadow = true;
      object.userData.roomRole = 'poster';
    });
    return poster;
  } catch (error) { texture.dispose(); throw error; }
}

async function loadBakedLight(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Room lighting unavailable');
  // RGBM alpha is a data multiplier; never premultiply it into RGB.
  const image = await createImageBitmap(await response.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const texture = new THREE.Texture(image);
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

function createSoundtrack() {
  const audio = new Audio("assets/scorsese-port-london.mp3");
  audio.id = "tokyo-record-track";
  audio.preload = "none";
  audio.volume = .65;
  audio.hidden = true;
  audio.dataset.phase = "stopped";
  document.body.append(audio);
  let context, runout, surface, surfaceGain, musicGain, leadInTimer;
  let playing = false;
  let playbackToken = 0;

  function startSurface() {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 7.3), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let noise = 0, tick = 0;
    for (let i = 0; i < samples.length; i++) {
      noise = noise * .86 + (Math.random() * 2 - 1) * .14;
      if (Math.random() < 15 / context.sampleRate) tick = (Math.random() * 2 - 1) * .12;
      tick *= .89;
      // Soft groove noise and irregular little dust ticks, with a seamless loop.
      samples[i] = (noise * .026 + tick) * Math.min(1, i / 600, (samples.length - 1 - i) / 600);
    }
    surface = context.createBufferSource();
    surface.buffer = buffer; surface.loop = true;
    surfaceGain = context.createGain();
    surfaceGain.gain.setValueAtTime(0, context.currentTime);
    surfaceGain.gain.linearRampToValueAtTime(.85, context.currentTime + .08);
    surface.connect(surfaceGain).connect(context.destination);
    surface.start();
  }

  function stopSurface() {
    if (surface) { surface.stop(); surface.disconnect(); surface = null; }
    surfaceGain?.disconnect(); surfaceGain = null;
  }

  function finishRecord() {
    stopSurface();
    const token = playbackToken;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 2.2), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let surfaceNoise = 0;
    for (let i = 0; i < samples.length; i++) {
      const t = i / context.sampleRate;
      surfaceNoise = surfaceNoise * .85 + (Math.random() * 2 - 1) * .15;
      // Let the runout groove linger before the pickup clicks off.
      if (t < 1.8) samples[i] = surfaceNoise * .028 * Math.min(1, t / .04, (1.8 - t) / .2);
      for (const tick of [.08, .4, .72, 1.04, 1.36, 1.68]) {
        const age = t - tick;
        if (age >= 0 && age < .025) samples[i] += (Math.random() * 2 - 1) * .05 * Math.exp(-age * 260);
      }
      const click = t - 1.98;
      if (click >= 0) samples[i] += ((Math.random() * 2 - 1) * .09 + Math.sin(click * 2 * Math.PI * 900) * .1) * Math.exp(-click * 100);
    }
    runout = context.createBufferSource();
    runout.buffer = buffer;
    runout.connect(context.destination);
    audio.dataset.phase = "runout";
    runout.onended = () => {
      if (token !== playbackToken) return;
      playback.stop();
      playback.onended?.();
    };
    runout.start();
  }

  const playback = {
    get playing() { return playing; },
    get progress() { return Number.isFinite(audio.duration)&&audio.duration>0?THREE.MathUtils.clamp(audio.currentTime/audio.duration,0,1):0; },
    onended: null,
    async toggle() {
      if (playing) { this.stop(false); return false; }
      if (!context) {
        context = new (window.AudioContext || window.webkitAudioContext)();
        musicGain = context.createGain();
        context.createMediaElementSource(audio).connect(musicGain).connect(context.destination);
      }
      const token = ++playbackToken;
      playing = true;
      try {
        musicGain.gain.cancelScheduledValues(context.currentTime);
        musicGain.gain.setValueAtTime(0, context.currentTime);
        const resuming = context.resume();
        if (audio.ended || audio.currentTime >= audio.duration - .05) audio.currentTime = 0;
        const songPosition = audio.currentTime;
        // Start both within the click gesture, including browsers that require
        // a direct gesture for HTML audio as well as AudioContext.resume().
        const results = await Promise.allSettled([resuming, audio.play()]);
        if (token !== playbackToken) {
          if (!playing) { audio.pause(); context.suspend(); }
          return playing;
        }
        const failure = results.find(result => result.status === "rejected");
        if (failure) throw failure.reason;
        audio.pause(); audio.currentTime = songPosition;
        startSurface();
        audio.dataset.phase = "lead-in";
        leadInTimer = setTimeout(async () => {
          leadInTimer = null;
          if (token !== playbackToken) return;
          try {
            await audio.play();
            if (token !== playbackToken) return;
            audio.dataset.phase = "song";
            const now = context.currentTime;
            musicGain.gain.setValueAtTime(0, now);
            musicGain.gain.linearRampToValueAtTime(1, now + .12);
            surfaceGain.gain.cancelScheduledValues(now);
            surfaceGain.gain.setValueAtTime(.85, now);
            surfaceGain.gain.linearRampToValueAtTime(.3, now + 1.3);
          } catch (error) {
            if (token !== playbackToken) return;
            this.stop(); this.onended?.(); console.warn('Record playback unavailable', error);
          }
        }, 2500);
        return true;
      } catch (error) {
        if (token !== playbackToken) return playing;
        this.stop();
        throw error;
      }
    },
    stop(rewind = true) {
      playbackToken++;
      playing = false;
      clearTimeout(leadInTimer); leadInTimer = null;
      stopSurface();
      audio.pause();
      if (rewind) audio.currentTime = 0;
      audio.dataset.phase = rewind ? "stopped" : "paused";
      if (runout) {
        runout.onended = null;
        runout.stop(); runout.disconnect(); runout = null;
      }
      context?.suspend();
    },
    dispose() {
      this.stop();
      context?.close();
      audio.removeAttribute('src'); audio.load(); audio.remove();
    },
  };
  audio.addEventListener("ended", () => { if (playing && audio.ended) finishRecord(); });
  return playback;
}

export async function createJapanRoom({bookCovers=[]}={}) {
  const loaded = await Promise.allSettled([
    new GLTFLoader().loadAsync("assets/JapanRoom.glb?v=20261018-optimized-25"),
    windowBackdrop(),
    loadBakedLight("assets/room-memory-architecture.png?v=1"),
    loadBakedLight("assets/room-furniture.png?v=20261018-optimized-25"),
    loadPoster(),
    loadBakedLight('assets/room-joinery-memory.png?v=1'),
    loadJoineryData('assets/room-joinery-uv.json?v=20261018-golden-2','json'),
    loadJoineryData('assets/room-joinery-uv.bin?v=20261018-golden-2','arrayBuffer'),
    new THREE.TextureLoader().loadAsync('assets/record-label.png'),
    loadDiaryAnimation(),
    ...bookCovers.map(entry=>new THREE.TextureLoader().loadAsync(entry.image)),
  ]);
  let failure = loaded.find(result => result.status === 'rejected');
  if (!failure) {
    try {
      const source = loaded[0].value.scene, layouts = loaded[6].value.meshes, coordinates = loaded[7].value;
      for (const [name, layout] of Object.entries(layouts)) {
        const mesh = source.getObjectByName(name.replaceAll('.',''));
        if (!mesh?.isMesh || mesh.geometry.index?.count !== layout.count || !Number.isInteger(layout.offset) || layout.offset < 0
            || layout.offset % 4 || layout.count*8 + layout.offset > coordinates.byteLength) {
          throw new Error('Joinery geometry changed; rebake its lighting');
        }
      }
    } catch (reason) { failure = {reason}; }
  }
  if (failure) {
    for (const result of loaded) {
      if (result.status !== 'fulfilled') continue;
      const value = result.value;
      if (value.scene) disposeScene(value.scene);
      if (value.isObject3D) disposeScene(value);
      if (value.isTexture) value.dispose();
      if (value.video) {
        value.disposeVideo();
        value.texture.dispose();
      }
    }
    throw failure.reason;
  }
  const [gltf, backdrop, architectureLight, furnitureLight, poster, joineryLight, joineryLayout, joineryUV, labelTexture, diaryAsset,...bookTextures] = loaded.map(result => result.value);
  // Older web exports included generated cables; keep only user-authored props.
  for (const name of ['Left_speaker_lead', 'Record_player_lead']) {
    const generated = gltf.scene.getObjectByName(name);
    if (generated) {
      generated.removeFromParent();
      generated.traverse(object => object.geometry?.dispose());
    }
  }
  const lightmaps = { 'room-indirect.hdr': architectureLight, 'room-furniture.hdr': furnitureLight, 'room-joinery.hdr': joineryLight };
  const joineryMeshes = Object.fromEntries(Object.entries(joineryLayout.meshes).map(([name, layout]) => [name.replaceAll('.',''), layout]));
  for (const texture of Object.values(lightmaps)) {
    texture.flipY = false;
    texture.channel = 1;
    texture.colorSpace = THREE.NoColorSpace;
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdce3e9);
  scene.environment = ambientSky();
  scene.environmentIntensity = .16;
  scene.fog = new THREE.FogExp2(0xcbd2d8, .027);
  scene.add(gltf.scene, poster);
  // Keep the authored light position and falloff for warm interior fill.
  // Window shadows and contact shading provide depth without another full-room
  // cubemap shadow lookup on every fragment during the transition.
  gltf.scene.traverse(object => {
    if (!object.isLight) return;
    object.intensity *= .18;
    object.color.set(0xffedda);
    object.userData.roomDayIntensity = object.intensity;
  });
  const skyFill = new THREE.HemisphereLight(0xb9cce9, 0x89725b, .42);
  scene.add(skyFill);
  // The HDR lightmap supplies actual Cycles bounce instead of an unshadowed
  // point light washing every surface with the same amber fill.
  // Window sky bounce is already present in the Cycles atlas. An unshadowed
  // RectAreaLight also lit sealed desk/cabinet surfaces through their walls.
  const sunIntensity = 2.6;
  const sunlight = new THREE.DirectionalLight(0xffc58c, sunIntensity);
  sunlight.name = "Window sunlight";
  const windowCenter = new THREE.Vector3(4.65, 2.05, 4.6);
  const sunDirection = new THREE.Vector3(-1, -.24, .7).normalize();
  sunlight.position.copy(windowCenter).addScaledVector(sunDirection, -6);
  sunlight.target.position.copy(windowCenter).addScaledVector(sunDirection, 3);
  scene.add(sunlight, sunlight.target);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 0.1, far: 18 });
  sunlight.shadow.normalBias = 0.012;
  sunlight.shadow.bias = -.00015;
  sunlight.shadow.radius = 6;
  sunlight.shadow.autoUpdate = false;
  sunlight.shadow.needsUpdate = true;
  const targets = [];
  const actionMeshes = {};
  const glassMeshes = [];
  const cloth = [];
  const fabricDaylight = { value: 1 };
  const curtainDaylight = { value: 1 };
  const litMaterials = new WeakMap();
  const shadedMaterials = new WeakSet();
  const useBakedLight = material => {
    material.lightMapIntensity = Math.PI * .8;
    material.onBeforeCompile = shader => {
      shader.uniforms.roomCurtainDaylight = curtainDaylight;
      shader.fragmentShader = 'uniform float roomCurtainDaylight;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>',
        THREE.ShaderChunk.lights_fragment_maps.replace('vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;',
          'vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapTexel.a * 32.0 * lightMapIntensity * vec3(1.025,1.0,.96) * roomCurtainDaylight;'));
    };
    material.customProgramCacheKey = () => 'room-rgbm-light-v1';
  };
  const recordPlayer=createRecordPlayer(gltf.scene,labelTexture);
  let recordShadowYaw=recordPlayer?.state.yaw||0;
  gltf.scene.traverse(object => {
    for (const key of ["roomAction", "roomRole", "roomLightmap", "roomBevel", "roomMaterialUV"]) {
      object.userData[key] ||= object.parent?.userData[key];
    }
    if (!object.isMesh) return;
    const joinery = joineryMeshes[object.name];
    if (joinery) {
      if (object.geometry.index?.count !== joinery.count) throw new Error('Joinery source geometry changed; rebake its lighting');
      const original = object.geometry;
      object.geometry = original.toNonIndexed(); original.dispose();
      object.geometry.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(joineryUV,joinery.offset,joinery.count*2),2));
      object.userData.roomLightmap = 'room-joinery.hdr';
    }
    object.castShadow = object.receiveShadow = true;
    if (object.userData.roomLightmap && object.geometry.attributes.uv1) {
      const lit = material => {
        if (!litMaterials.has(material)) litMaterials.set(material, new Map());
        const variants = litMaterials.get(material);
        const map = object.userData.roomLightmap;
        if (!variants.has(map)) {
          const copy = material.clone();
          copy.lightMap = lightmaps[map];
          // Cycles' color-free diffuse bake is outgoing radiance. Three's
          // Lambert BRDF divides lightmap irradiance by PI, so convert here.
          useBakedLight(copy);
          variants.set(map, copy);
        }
        return variants.get(map);
      };
      object.material = Array.isArray(object.material) ? object.material.map(lit) : lit(object.material);
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => {
      for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap"]) {
        if (material[key]) material[key].anisotropy = 8;
      }
      if (!shadedMaterials.has(material)) {
        const name = material.name;
        if (/Wood|Veneer/.test(name)) {
          material.roughness = /PaintedWhite/.test(name) ? .5 : /SmoothDeltaBlack/.test(name) ? .54 : .62;
          material.normalScale.multiplyScalar(/PaintedWhite/.test(name) ? .08 : .14);
          material.envMapIntensity = .9;
        } else if (/Plaster|Stucco/.test(name)) {
          material.roughness = .95;
          material.normalScale.multiplyScalar(.07);
        } else if (/BlackVinyl|PlasticMold|RibbedPlastic/.test(name)) {
          material.roughness = .3;
        } else if (/Metal/.test(name)) {
          material.roughness = .38;
        } else if (/Airmesh|Velour|Velvet|Paper/.test(name)) {
          material.roughness = .94;
        }
        if (/Wood|Veneer|Plaster|Stucco|Stone|Fabric|Plastic|Rubber|Paper/.test(name)) material.metalness = 0;
        const roughnessFloor = material.transmission > 0 ? .015 : /PaintedWhite/.test(name) ? .42 : /Wood|Veneer/.test(name) ? .44
          : /Plaster|Stucco|Paper|Airmesh|Velour|Velvet/.test(name) ? .86 : .22;
        const compile = material.onBeforeCompile;
        material.onBeforeCompile = shader => {
          compile(shader);
          shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            roughnessFactor = max(roughnessFactor, ${roughnessFloor});`);
        };
        material.customProgramCacheKey = () => `room-surface-${roughnessFloor}-${!!material.lightMap}`;
        if (/BlackVinyl/.test(name) || name === 'Material.002') {
          material.roughness = .34; material.metalness = .14;
          const surfaceCompile = material.onBeforeCompile;
          material.onBeforeCompile = shader => {
            surfaceCompile(shader);
            shader.vertexShader = `varying vec3 vRecordPosition;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
              vRecordPosition = (modelMatrix * vec4(transformed,1.0)).xyz;`);
            shader.fragmentShader = `varying vec3 vRecordPosition;\n${shader.fragmentShader}`.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
              vec2 radial = vRecordPosition.xz - vec2(3.0425,5.451);
              float radius = length(radial);
              float band = smoothstep(.075,.085,radius) * (1.0-smoothstep(.211,.22,radius));
              float antialias = 1.0-smoothstep(.00025,.0015,fwidth(radius));
              float grooves = sin(radius * 9666.4389) * band * antialias;
              normal = normalize(normal + mat3(viewMatrix) * vec3(radial.x/max(radius,.0001),0.0,radial.y/max(radius,.0001)) * grooves * .035);`);
          };
          material.customProgramCacheKey = () => 'room-vinyl-microgrooves-v1';
        }
        if (/Plaster|Stucco/.test(name)) {
          const surfaceCompile = material.onBeforeCompile;
          material.onBeforeCompile = shader => {
            surfaceCompile(shader);
            shader.vertexShader = `varying vec3 vRoomSurfacePosition;\nvarying vec3 vRoomSurfaceNormal;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
              vRoomSurfacePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
              vRoomSurfaceNormal = normalize(mat3(modelMatrix) * normal);`);
            shader.fragmentShader = `varying vec3 vRoomSurfacePosition;\nvarying vec3 vRoomSurfaceNormal;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
              vec3 p = vRoomSurfacePosition;
              float wall = 1.0 - smoothstep(.2, .6, abs(vRoomSurfaceNormal.y));
              float corner = exp(-length(vec2(p.x - 4.65, p.z - 6.08)) * 5.0);
              float skirting = exp(-abs(p.y - .32) * 6.0);
              float sill = exp(-abs(p.x - 4.65) * 8.0) * exp(-abs(p.y - 1.05) * 6.0);
              sill *= smoothstep(3.4, 3.65, p.z) * (1.0 - smoothstep(5.55, 5.8, p.z));
              float wear = wall * clamp(corner * .11 + skirting * .045 + sill * .07, 0.0, .16);
              // Painted plaster carries restrained variation, revealed by grazing light.
              diffuseColor.rgb = mix(vec3(.62, .615, .60), diffuseColor.rgb, .23);
              diffuseColor.rgb *= 1.0 - wear * (.9 + .1 * sin(p.z * 27.0 + sin(p.y * 5.0)));`);
          };
          material.customProgramCacheKey = () => 'room-architectural-plaster-v2';
        }
        shadedMaterials.add(material);
      }
      // A flat window needs reflection, not screen-space refraction. The
      // latter blurred the skyline and allocated an extra full-screen pass.
      if (material.transmission > 0) {
        material.transmission = 0;
        material.metalness = 1;
        material.color.set(0xffffff);
        material.roughness = .015;
        material.transparent = true;
        material.forceSinglePass = true;
        material.depthWrite = false;
        const glassCompile = material.onBeforeCompile;
        material.onBeforeCompile = shader => {
          glassCompile(shader);
          shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
            gl_FragColor.a = .04 + .96 * pow(1.0 - clamp(dot(normal, geometryViewDir), 0.0, 1.0), 5.0);`);
        };
        material.customProgramCacheKey = () => 'room-flat-glass-fresnel-v1';
        object.castShadow = false;
        glassMeshes.push(object);
      }
      if (object.name === "Curtain" || object.parent?.name === "Curtain") {
        object.userData.roomAction = 'curtains';
        object.geometry.computeBoundingBox();
        const bounds = object.geometry.boundingBox;
        const positions = object.geometry.attributes.position;
        const center = (bounds.min.z + bounds.max.z) / 2;
        const sides = new Int8Array(positions.count), uv = object.geometry.attributes.uv;
        const panels = new Map([-1,1].map(side=>[side,{min:Infinity,max:-Infinity,covariance:0}]));
        for(let i=0;i<positions.count;i++){
          const z=positions.getZ(i),side=z<center?-1:1,panel=panels.get(side);sides[i]=side;
          panel.min=Math.min(panel.min,z);panel.max=Math.max(panel.max,z);
          panel.covariance+=(uv.getX(i)-.5)*z;
        }
        const base=new Float32Array(positions.array.length),closed=base.slice();
        // Keep the authored UV grid and faces, but make each fabric column
        // ordered across the rail. The old simulated mesh doubled back through
        // itself; stretching world Z could never unfold those intersections.
        for(let i=0;i<positions.count;i++){
          const side=sides[i],panel=panels.get(side),u=uv.getX(i),v=uv.getY(i),p=i*3;
          const across=(side<0?panel.covariance>0:panel.covariance<0)?u:1-u;
          const fromOuter=across+.022*Math.sin(across*Math.PI*2)*v*v;
          const outer=side<0?panel.min:panel.max,inner=side<0?panel.max:panel.min;
          const fold=positions.getX(i)-(bounds.min.x+bounds.max.x)/2;
          const depth=(bounds.min.x+bounds.max.x)/2;
          const drop=Math.max(0,Math.min(1,(bounds.max.y-positions.getY(i))/(bounds.max.y-bounds.min.y)));
          const hem=drop**6*(.008*Math.sin(across*17+side*1.7)+.005*Math.sin(across*31-side));
          const belly=Math.sin(drop*Math.PI*.85)*(.010*Math.sin(across*6+side)+.006*side);
          base[p]=depth+fold*(.84+.08*Math.sin(across*7+side)*drop)+belly;
          closed[p]=depth+fold*.65+belly*.6;
          base[p+1]=closed[p+1]=positions.getY(i)+hem;
          base[p+2]=THREE.MathUtils.lerp(outer,inner,fromOuter);
          closed[p+2]=THREE.MathUtils.lerp(outer,center+side*.003,fromOuter);
        }
        positions.array.set(base);positions.needsUpdate=true;object.geometry.computeBoundingBox();object.geometry.computeVertexNormals();
        cloth.push({ object, base, closed, sides, center, min: bounds.min.y, height: bounds.max.y - bounds.min.y });
        // Thin fabric transmits some daylight; glTF has no Cycles subsurface model.
        material.side = THREE.DoubleSide;
        // Overlapping cloth folds need ordinary opaque depth testing. Sorted
        // alpha blending made the back folds show through as bright tears.
        material.transparent = false;
        material.opacity = 1;
        material.alphaMap = null;
        material.alphaTest = 0;
        material.depthWrite = true;
        // Linen scatters light through fibers; refraction made overlapping
        // folds sample one another and crawl when the camera moved.
        material.transmission = 0;
        material.thickness = .012;
        material.ior = 1.25;
        material.roughness = .94;
        material.normalScale.multiplyScalar(.12);
        if (material.isMeshPhysicalMaterial) {
          material.sheen = .3;
          material.sheenColor.set(0xfff2df);
          material.sheenRoughness = .85;
        }
        material.onBeforeCompile = shader => {
          shader.uniforms.roomSunDirection = { value: sunDirection };
          shader.uniforms.roomFabricDaylight = fabricDaylight;
          shader.uniforms.roomFabricColor = { value: sunlight.color };
          shader.uniforms.clothBounds = { value: new THREE.Vector2(bounds.min.y, bounds.max.y - bounds.min.y) };
          shader.vertexShader = `varying float vClothHeight;\nuniform vec2 clothBounds;\n${shader.vertexShader}`.replace(
            "#include <begin_vertex>", "#include <begin_vertex>\nvClothHeight = (position.y - clothBounds.x) / clothBounds.y;",
          );
          // Thin linen diffuses a nearby bulb through its fibers. Keep the
          // directional window shadows, but suppress hard point self-shadowing
          // that aliases between overlapping folds. It still casts on the room.
          shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>',
            '#undef RE_Direct_RectArea\n'+THREE.ShaderChunk.lights_fragment_begin.replace(/getPointShadow\([^)]*\)/g, '1.0'));
          shader.fragmentShader = `varying float vClothHeight;\nuniform vec3 roomSunDirection;\nuniform vec3 roomFabricColor;\nuniform float roomFabricDaylight;\n${shader.fragmentShader}`.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
             float hem = (1.0 - smoothstep(.008, .022, vClothHeight)) + smoothstep(.967, .985, vClothHeight);
             diffuseColor.rgb *= 1.0 - hem * .09;`,
          ).replace(
            "#include <lights_fragment_end>",
            `#include <lights_fragment_end>
             vec3 fabricLight = transformDirection(-roomSunDirection, viewMatrix);
             float fabricBacklight = pow(max(0.0, -dot(normal, fabricLight)), 1.5);
             reflectedLight.indirectDiffuse += diffuseColor.rgb * roomFabricColor * fabricBacklight * .78 * roomFabricDaylight;`,
          );
        };
        material.customProgramCacheKey = () => "room-thin-fabric-v5";
        const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
        depth.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
            float weave = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
            if (weave < .72) discard;`);
        };
        depth.customProgramCacheKey = () => 'room-linen-shadow-v1';
        object.customDepthMaterial = depth;
      }
    });
    const action = object.userData.roomAction;
    if (action) (actionMeshes[action] ||= []).push(object);
    targets.push(object);
  });

  const supports=applyRoomFinish(gltf.scene);
  if(supports)targets.push(supports);

  // One personal detail, using the same supplied artwork as the playing LP.
  // The sleeve rests on the measured shelf floor and leans just clear of its back.
  const sleeveGeometry=new THREE.BoxGeometry(.315,.315,.0035);
  const sleeveIndices=Array.from(sleeveGeometry.index.array);
  sleeveGeometry.setIndex([...sleeveIndices.slice(0,24),...sleeveIndices.slice(30),...sleeveIndices.slice(24,30)]);
  sleeveGeometry.clearGroups();sleeveGeometry.addGroup(0,30,0);sleeveGeometry.addGroup(30,6,1);
  const sleeve=new THREE.Mesh(sleeveGeometry,[
    new THREE.MeshStandardMaterial({name:'Record sleeve cardboard',color:0x665a43,roughness:.91}),
    new THREE.MeshStandardMaterial({name:'Printed record sleeve',map:labelTexture,roughness:.86}),
  ]);
  sleeve.name='Record sleeve';sleeve.userData.roomRole='personal-detail';
  sleeve.position.set(1.60,.3741,5.583);sleeve.rotation.set(.18,Math.PI,0);
  sleeve.castShadow=sleeve.receiveShadow=true;scene.add(sleeve);targets.push(sleeve);

  // Reuse the wall's indirect illumination at the paper's physical location.
  // OBJ material UV0 (including the authored crop) remains untouched.
  gltf.scene.updateMatrixWorld(true); poster.updateMatrixWorld(true);
  const wallMeshes = targets.filter(object => object.userData.roomLightmap === 'room-indirect.hdr');
  const posterRay = new THREE.Raycaster(); posterRay.far = .3;
  poster.traverse(object => {
    if (!object.isMesh) return;
    const position = object.geometry.attributes.position;
    const uv = new Float32Array(position.count * 2);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), bary = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      posterRay.set(p.add(new THREE.Vector3(0, 0, -.025)), new THREE.Vector3(0, 0, 1));
      const hit = posterRay.intersectObjects(wallMeshes, false)[0];
      if (!hit) continue;
      const geometry = hit.object.geometry, lightUV = geometry.attributes.uv1;
      const local = hit.point.clone().applyMatrix4(hit.object.matrixWorld.clone().invert());
      THREE.Triangle.getBarycoord(local, a.fromBufferAttribute(geometry.attributes.position, hit.face.a), b.fromBufferAttribute(geometry.attributes.position, hit.face.b), c.fromBufferAttribute(geometry.attributes.position, hit.face.c), bary);
      uv[i * 2] = lightUV.getX(hit.face.a) * bary.x + lightUV.getX(hit.face.b) * bary.y + lightUV.getX(hit.face.c) * bary.z;
      uv[i * 2 + 1] = lightUV.getY(hit.face.a) * bary.x + lightUV.getY(hit.face.b) * bary.y + lightUV.getY(hit.face.c) * bary.z;
    }
    object.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
    object.material.lightMap = architectureLight;
    useBakedLight(object.material);
    object.userData.roomLightmap = 'room-indirect.hdr';
    targets.push(object);
  });

  gltf.scene.updateMatrixWorld(true);
  const camera = gltf.scene.getObjectByProperty("isCamera", true)
    || new THREE.PerspectiveCamera(50, 16 / 9, 0.02, 150);
  if (!gltf.cameras.length) {
    camera.position.set(-0.25, 1.68, 1.85);
    camera.lookAt(2.6, 1.27, 5.35);
  }
  scene.attach(camera);
  // A small leftward step and a wider lens keep the room's proportions intact.
  camera.position.add(new THREE.Vector3(-.18, .015, .18).applyQuaternion(camera.quaternion));
  camera.fov *= 1.12;
  camera.far = 650;
  camera.updateMatrixWorld(true);
  const oldDiaryCord=gltf.scene.getObjectByName('Cylinder006');if(oldDiaryCord)oldDiaryCord.visible=false;
  const diaryBinding=createDiaryBinding(diaryAsset,{scene,camera},gltf.scene.getObjectByName('Cube010'));
  for(let i=targets.length-1;i>=0;i--)if(targets[i].userData.roomAction==='diary')targets.splice(i,1);
  targets.push(...diaryBinding.meshes);actionMeshes.diary=diaryBinding.meshes;
  const reviewBooks=bookCovers.length?createReviewBindings(diaryAsset,{scene,camera},gltf.scene,bookCovers,bookTextures):[];
  if(reviewBooks.length){
    for(let i=targets.length-1;i>=0;i--)if(targets[i].userData.roomAction==='books')targets.splice(i,1);
    actionMeshes.books=reviewBooks.flatMap(b=>b.meshes);targets.push(...actionMeshes.books);
  }
  const authoredAspect = camera.aspect;
  const atmosphereTime = { value: 0 };
  const exterior = createTokyoExterior(backdrop.texture,camera,atmosphereTime);
  scene.add(exterior.group);
  const cityView = exterior.horizon;
  glassMeshes.push(cityView);

  // One small draw of dust motes within the same window-light volume.
  const dustGeometry = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(64 * 3);
  const random = i => THREE.MathUtils.euclideanModulo(Math.sin(i * 127.1 + 311.7) * 43758.5453, 1);
  for (let i = 0; i < 64; i++) {
    const travel = random(i * 3) * 4.8;
    dustPositions[i * 3] = 4.65 + sunDirection.x * travel;
    dustPositions[i * 3 + 1] = 1.25 + random(i * 3 + 1) * 1.6 + sunDirection.y * travel;
    dustPositions[i * 3 + 2] = 4.15 + random(i * 3 + 2) * .85 + sunDirection.z * travel;
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.ShaderMaterial({
    uniforms: { time: atmosphereTime, pixelRatio: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float time, pixelRatio; varying float brightness;
      void main() {
        vec3 p = position;
        p.x += sin(time * .17 + position.z * 3.0) * .045;
        p.y += sin(time * .12 + position.x * 4.0) * .065;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp(5.0 / max(-view.z, .5), .8, 2.4) * pixelRatio;
        brightness = .1 + .12 * (.5 + .5 * sin(position.x * 7.0 + time * .25));
      }`,
    fragmentShader: `varying float brightness;
      void main() {
        float d = length(gl_PointCoord - .5) * 2.0;
        gl_FragColor = vec4(1.0, .81, .56, (1.0 - smoothstep(.1, 1.0, d)) * brightness);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.name = 'Sunlit dust'; dust.frustumCulled = false;
  scene.add(dust); glassMeshes.push(dust);

  // Half-resolution contact shading adds depth without reducing scene detail.
  const occlusion = new SSAOPass(scene, camera, 720, 450, 16);
  // Folded double-sided linen must also occlude atmosphere from its back
  // faces; a front-only normal pass let fog integrate through the curtains.
  occlusion.normalMaterial.side = THREE.DoubleSide;
  occlusion.kernelRadius = .085;
  occlusion.minDistance = .0002;
  occlusion.maxDistance = .018;
  occlusion.copyMaterial.fragmentShader = `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec3 ao = texture2D(tDiffuse, vUv).rgb;
      gl_FragColor = vec4(mix(vec3(1.0), ao, .35), 1.0);
    }`;
  // Atmosphere needs actual opaque silhouettes at display resolution; the
  // lower-resolution AO buffer can miss narrow shelf/desk edges during motion.
  const atmosphereDepth=new THREE.WebGLRenderTarget(1,1,{depthTexture:new THREE.DepthTexture(1,1,THREE.UnsignedIntType)});
  const opaqueDepth=new THREE.MeshDepthMaterial({side:THREE.DoubleSide});
  opaqueDepth.colorWrite=false;
  const windowLight = new THREE.ShaderMaterial({
    name: "Window light shafts",
    uniforms: {
      tDepth: { value: atmosphereDepth.depthTexture },
      inverseProjection: { value: new THREE.Matrix4() },
      cameraWorld: { value: new THREE.Matrix4() },
      eye: { value: new THREE.Vector3() },
      sunDirection: { value: sunDirection },
      lightColor: { value: sunlight.color },
      strength: { value: .16 },
      time: atmosphereTime,
      sunShadow: { value: null },
      sunShadowMatrix: { value: sunlight.shadow.matrix },
      daylight: curtainDaylight,
    },
    transparent: true,
    depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tDepth;
      uniform mat4 inverseProjection, cameraWorld;
      uniform vec3 eye, sunDirection, lightColor;
      uniform float strength, time, daylight;
      uniform sampler2D sunShadow;
      uniform mat4 sunShadowMatrix;
      #include <packing>
      float sunVisibility(vec3 p) {
        vec4 shadow = sunShadowMatrix * vec4(p,1.0);
        vec3 coord = shadow.xyz / shadow.w;
        if(any(lessThan(coord,vec3(0.0)))||any(greaterThan(coord,vec3(1.0))))return 0.0;
        // View-ray integration softens the occlusion across multiple samples;
        // a separate PCF kernel at every step multiplied the full-screen cost.
        float depth=unpackRGBAToDepth(texture2D(sunShadow,coord.xy));
        return step(coord.z-.0005,depth);
      }
      float windowAperture(vec3 p) {
        float travel=(p.x-4.65)/sunDirection.x;
        vec3 portal=p-sunDirection*travel;
        return smoothstep(4.02,4.15,portal.z)*(1.0-smoothstep(5.0,5.15,portal.z))
          *smoothstep(1.1,1.22,portal.y)*(1.0-smoothstep(2.94,3.05,portal.y))*step(0.0,travel);
      }
      float fogBanks(vec3 q) {
        float eddy=.5+.25*sin(q.x+.7*sin(q.z))*sin(q.y-.6*cos(q.x))
          +.18*sin(q.z*1.7+q.x*.6+sin(q.y));
        return smoothstep(.46,.78,eddy);
      }
      void main() {
        float depth = texture2D(tDepth, vUv).r;
        vec4 viewPoint = inverseProjection * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec3 endPoint = (cameraWorld * vec4(viewPoint.xyz / viewPoint.w, 1.0)).xyz;
        vec3 ray = endPoint - eye;
        float lengthInRoom = min(length(ray), 12.0);
        ray = normalize(ray);
        // Intersect the sheared window volume to separate sunlit shafts
        // from the quieter ambient mist elsewhere in the room.
        vec2 slope = sunDirection.yz / sunDirection.x;
        vec3 origin = vec3(eye.x, eye.yz - slope * (eye.x - 4.65));
        vec3 direction = vec3(ray.x, ray.yz - slope * ray.x);
        vec3 inverseRay = 1.0 / (direction + vec3(.000001));
        vec3 a = (vec3(.1, 1.1, 4.02) - origin) * inverseRay;
        vec3 b = (vec3(4.65, 3.05, 5.15) - origin) * inverseRay;
        vec3 lo = min(a, b), hi = max(a, b);
        float start = max(0.0, max(lo.x, max(lo.y, lo.z)));
        float end = min(lengthInRoom, min(hi.x, min(hi.y, hi.z)));
        float light = 0.0;
        // A depth-clipped scattering volume projected through the window opening.
        // The depth buffer stops the shafts at furniture, curtains and walls.
        for (int i = 0; i < 8; i++) {
          vec3 p = eye + ray * mix(start, end, (float(i) + .5) / 8.0);
          float travel = (p.x - 4.65) / sunDirection.x;
          vec3 portal = p - sunDirection * travel;
          float aperture = smoothstep(4.02, 4.15, portal.z) * (1.0 - smoothstep(5.0, 5.15, portal.z));
          aperture *= smoothstep(1.1, 1.22, portal.y) * (1.0 - smoothstep(2.94, 3.05, portal.y));
          float air = exp(-max(travel, 0.0) * .26) * step(0.0, travel) * step(0.08, p.y);
          vec3 q=(p-vec3(time*.032,0.0,time*.019))*vec3(1.7,2.3,1.45);
          light += aperture * air * sunVisibility(p) * (.18+.82*fogBanks(q)) * max(end - start, 0.0) / 8.0;
        }
        // Depth-clipped banks of illuminated fog. Broad overlapping eddies
        // drift through the room, with pastel light carried by the mist itself.
        float mist = 0.0;
        vec3 scattered = vec3(0.0);
        for (int i = 0; i < 10; i++) {
          vec3 p = eye + ray * (float(i) + .5) / 10.0 * lengthInRoom;
          vec3 q = (p - vec3(time * .032, 0.0, time * .019)) * vec3(1.7, 2.3, 1.45);
          float banks = fogBanks(q);
          float layer = .72 + .14 * sin(q.x * .55 + q.z * .4);
          float height = exp(-pow((p.y - layer) / .5, 2.0))
            + .24 * exp(-pow((p.y - 1.45) / .48, 2.0));
          float inside = smoothstep(.05,.35,p.x) * (1.0-smoothstep(4.4,4.7,p.x))
            * smoothstep(.1,.4,p.z) * (1.0-smoothstep(5.9,6.2,p.z));
          vec3 windowOffset=(p-vec3(4.5,1.7,4.6))*vec3(.85,.65,1.25);
          float nearWindow=exp(-dot(windowOffset,windowOffset)*.75);
          float lit=windowAperture(p)*sunVisibility(p)*daylight;
          // Restore the low pastel banks. Dense upper window fog washed over
          // the curtain folds and made otherwise opaque linen look transparent.
          float lowDensity=(.012+.24*banks)*height*.55*(.8+.2*nearWindow);
          float windowDensity=nearWindow*(.02+.09*banks)*(.25+.75*lit);
          float lowLayer=1.0-smoothstep(1.05,1.6,p.y);
          float density=(lowDensity+windowDensity)*lowLayer*inside*lengthInRoom/10.0;
          float hue = .5 + .5 * sin(p.x * 1.1 + p.z * .7 + time * .13);
          vec3 pastel = mix(vec3(.82,.48,.65), vec3(.48,.55,.87), hue);
          pastel = mix(pastel, vec3(.48,.81,.73), .5 + .5 * sin(p.z * 1.2 - p.x * .6 - time * .09));
          vec3 warm=lightColor*.58+vec3(.30,.29,.28);
          vec3 ambient=mix(vec3(.39,.43,.53),warm,clamp(.25+lit*.75,0.0,1.0));
          vec3 illumination=mix(ambient,pastel,.5)*mix(.6,1.0,daylight);
          scattered += illumination * density;
          mist += density;
        }
        float fogAlpha = 1.0 - exp(-mist);
        // The shaft needs its own optical depth above the low pastel banks;
        // otherwise zero ambient mist makes the window beam transparent too.
        float alpha = 1.0 - exp(-mist - light * strength * .25);
        vec3 airColor = scattered / max(mist, .0001);
        // Filter premultiplied scattering. Dividing by tiny alpha creates
        // overbright colors that clip into bands in unsigned-byte buffers.
        gl_FragColor = vec4(airColor * fogAlpha + lightColor * light * strength, alpha);
      }`,
  });
  const atmosphereTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
  windowLight.blending=THREE.NoBlending;
  const atmosphereComposite=new THREE.ShaderMaterial({
    uniforms:{fog:{value:atmosphereTarget.texture},depth:{value:atmosphereDepth.depthTexture},size:{value:new THREE.Vector2(1,1)},range:{value:new THREE.Vector2(camera.near,camera.far)}},
    transparent:true,premultipliedAlpha:true,depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D fog,depth;uniform vec2 size,range;varying vec2 vUv;
      float distanceAt(vec2 uv){float z=texture2D(depth,uv).r;return range.x*range.y/(range.y-(range.y-range.x)*z);}
      void main(){
        vec2 grid=vUv*size-.5,base=floor(grid),f=fract(grid);
        float surface=distanceAt(vUv),sum=0.;vec4 color=vec4(0.);
        for(int i=0;i<4;i++){
          vec2 corner=vec2(mod(float(i),2.),floor(float(i)/2.));
          vec2 uv=(base+corner+.5)/size;
          vec2 blend=mix(1.-f,f,corner);
          float weight=blend.x*blend.y*exp(-abs(distanceAt(uv)-surface)*30.);
          color+=texture2D(fog,uv)*weight;sum+=weight;
        }
        gl_FragColor=sum>.0001?color/sum:vec4(0.);
      }`,
  });
  for(const material of [occlusion.copyMaterial,atmosphereComposite]){
    material.stencilWrite=true;material.stencilRef=1;
    material.stencilFunc=THREE.NotEqualStencilFunc;material.stencilWriteMask=0;
  }
  const shaftQuad = new FullScreenQuad(windowLight);
  const atmosphereQuad=new FullScreenQuad(atmosphereComposite);
  // Quarter-resolution separable diffusion avoids the discrete ghost outlines
  // produced by a ring of full-resolution highlight samples.
  const bloomX=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
  const bloomY=bloomX.clone();
  const diffusion=new THREE.ShaderMaterial({
    uniforms:{image:{value:null},stepUV:{value:new THREE.Vector2()},extract:{value:1}},
    depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D image;uniform vec2 stepUV;uniform float extract;varying vec2 vUv;
      void main(){vec3 sum=vec3(0.);float weights=0.;
        for(int i=-4;i<=4;i++){
          float weight=exp(-.125*float(i*i));
          vec4 pixel=texture2D(image,clamp(vUv+stepUV*float(i),0.,1.));
          float bright=smoothstep(.42,.98,dot(pixel.rgb,vec3(.2126,.7152,.0722)))*step(.5,pixel.a);
          sum+=pixel.rgb*mix(1.,bright,extract)*weight;weights+=weight;
        }gl_FragColor=vec4(sum/weights,1.);
      }`,
  });
  const diffusionQuad=new FullScreenQuad(diffusion);
  const outline = new OutlinePass(new THREE.Vector2(innerWidth, innerHeight), scene, camera);
  outline.renderTargetDepthBuffer.texture.type = THREE.UnsignedByteType;
  outline.visibleEdgeColor.set(0xffffff);
  outline.hiddenEdgeColor.set(0x000000);
  outline.edgeStrength = 8;
  outline.edgeGlow = 0;
  outline.edgeThickness = 4;
  outline.downSampleRatio = 3;
  // Use OutlinePass's occlusion-aware selection mask, then draw an opaque
  // contour around the union of selected meshes. No additive blur or bloom.
  outline.overlayMaterial.blending = THREE.NormalBlending;
  outline.overlayMaterial.uniforms.strokeTexel = { value: new THREE.Vector2() };
  outline.overlayMaterial.fragmentShader = `
    varying vec2 vUv;
    uniform sampler2D maskTexture, edgeTexture1;
    uniform vec2 strokeTexel;
    void main() {
      vec4 mask = texture2D(maskTexture, vUv);
      if ((1.0 - mask.r) * (1.0 - mask.g) > .5) discard;
      if (mask.r > .5 && texture2D(edgeTexture1, vUv).r < .0001) discard;
      float contour = 0.0;
      for (int i = 0; i < 16; i++) {
        float angle = float(i) * 6.28318530718 / 16.0;
        vec4 neighbor = texture2D(maskTexture, vUv + vec2(cos(angle), sin(angle)) * strokeTexel * 4.0);
        contour = max(contour, (1.0 - neighbor.r) * (1.0 - neighbor.g));
      }
      float coverage = smoothstep(.2, .8, contour);
      if (coverage <= 0.0) discard;
      gl_FragColor = vec4(vec3(8.0), coverage);
    }`;
  // A filled mask keeps recessed door panels out of the hover contour. It is
  // present only during OutlinePass, never in the room, its shadows or its AO.
  const doorBounds=new THREE.Box3();
  for(const mesh of actionMeshes.door||[])doorBounds.expandByObject(mesh);
  const doorSize=doorBounds.getSize(new THREE.Vector3());
  const doorNormal=['x','y','z'].sort((a,b)=>doorSize[a]-doorSize[b])[0];doorSize[doorNormal]+=.003;
  const doorOutline=new THREE.Mesh(new THREE.BoxGeometry(doorSize.x,doorSize.y,doorSize.z),new THREE.MeshBasicMaterial());
  doorOutline.name='Door outer highlight mask';doorOutline.position.copy(doorBounds.getCenter(new THREE.Vector3()));doorOutline.visible=false;scene.add(doorOutline);
  const drawOutline=outline.render.bind(outline);
  outline.render=(...args)=>{doorOutline.visible=highlighted==='door';try{drawOutline(...args);}finally{doorOutline.visible=false;}};
  const basePosition = camera.position.clone();
  const cameraRight = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const baseRotation = camera.quaternion.clone();
  const baseFov = camera.fov;
  const look = new THREE.Vector2();
  const pointer = new THREE.Vector2();
  let viewHeld = false;
  const pickPoint = new THREE.Vector2();
  let viewportWidth = innerWidth, viewportHeight = innerHeight;
  const raycaster = new THREE.Raycaster();
  let highlighted = null;
  const soundtrack = createSoundtrack();
  let roomVisible = false;
  let stillView = false;
  let clothTime = 0;
  let curtainTarget = 0, curtainProgress = 0;
  let prepared = false;
  let environmentTarget;
  let environmentDirty = true;
  let preparationPromise;
  function syncVideoPlayback() {
    if (backdrop.ready && roomVisible && !stillView && !document.hidden) {
      backdrop.video.play().catch(() => {});
    } else backdrop.video.pause();
  }
  document.addEventListener('visibilitychange', syncVideoPlayback);
  // The room is a fixed late-afternoon memory, independent of the real clock.
  fabricDaylight.value = .82;
  sunlight.intensity = sunIntensity; sunlight.color.set(0xffc58c);
  skyFill.intensity = .42;
  scene.fog.color.set(0xe3d9d0); scene.fog.density = .025;
  scene.background.set(0xb9c5d0);
  function highlight(action) {
    highlighted = action;
    outline.selectedObjects = action==='door'?[...actionMeshes.door,doorOutline]:actionMeshes[action] || [];
  }
  return {
    scene, camera, soundtrack, highlight, outline, windowLight, diaryBinding, reviewBooks, bloomTexture:bloomY.texture,
    toggleCurtains() { curtainTarget = 1 - curtainTarget; return curtainTarget === 1; },
    prepare(renderer) {
      if (preparationPromise) return preparationPromise;
      if (prepared && !environmentDirty) return Promise.resolve();
      environmentDirty = false;
      if (!renderer.extensions.has('EXT_color_buffer_float')) {
        // SSAO also owns half-float buffers. Keep the entire effects chain
        // renderable on the same devices as the main unsigned-byte buffer.
        const passTargets = [...Object.values(occlusion), ...Object.values(outline)].filter(value => value?.isWebGLRenderTarget);
        for (const target of [atmosphereTarget, bloomX, bloomY, ...passTargets]) {
          target.texture.type = THREE.UnsignedByteType;
          target.dispose();
        }
        // PMREM internally requires half-float attachments. Baked bounce and
        // the existing sky fill provide diffuse illumination on these devices.
        scene.environment?.dispose();
        scene.environment = null;
        prepared = true;
        return Promise.resolve();
      }
      preparationPromise = (async () => {
        const capture = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
        const probe = new THREE.CubeCamera(.1, 650, capture);
        probe.position.set(2.7, 1.5, 3.8);
        probe.coordinateSystem = renderer.coordinateSystem;
        probe.updateCoordinateSystem();
        probe.updateMatrixWorld(true);
        const glass = glassMeshes.filter(object => !exterior.group.children.includes(object));
        const pmrem = new THREE.PMREMGenerator(renderer);
        try {
          capture.texture.generateMipmaps = false;
          for (let face = 0; face < 6; face++) {
            const target = renderer.getRenderTarget();
            const visible = glass.map(object => object.visible);
            glass.forEach(object => { object.visible = false; });
            try {
              if (face === 5) capture.texture.generateMipmaps = true;
              renderer.setRenderTarget(capture, face);
              renderer.render(scene, probe.children[face]);
            } finally {
              glass.forEach((object, i) => { object.visible = visible[i]; });
              renderer.setRenderTarget(target);
            }
            await new Promise(requestAnimationFrame);
          }
          const previousEnvironment = environmentTarget;
          environmentTarget = pmrem.fromCubemap(capture.texture);
          if (previousEnvironment) previousEnvironment.dispose(); else scene.environment.dispose();
          scene.environment = environmentTarget.texture;
          scene.environmentIntensity = .58;
          prepared = true;
        } finally { pmrem.dispose(); capture.dispose(); }
      })().finally(() => { preparationPromise = null; });
      return preparationPromise;
    },
    dispose() {
      document.removeEventListener('visibilitychange', syncVideoPlayback);
      soundtrack.dispose();
      backdrop.disposeVideo();
      outline.dispose(); doorOutline.geometry.dispose(); doorOutline.material.dispose(); occlusion.dispose(); shaftQuad.dispose(); windowLight.dispose();
      atmosphereQuad.dispose();atmosphereComposite.dispose();atmosphereTarget.dispose();
      atmosphereDepth.dispose();opaqueDepth.dispose();
      diffusionQuad.dispose();diffusion.dispose();bloomX.dispose();bloomY.dispose();
      disposeScene(scene);
      architectureLight.dispose(); furnitureLight.dispose(); joineryLight.dispose();
      if (environmentTarget) environmentTarget.dispose(); else scene.environment?.dispose();
    },
    setVisible(visible, reducedMotion) {
      roomVisible = visible;
      stillView = reducedMotion;
      syncVideoPlayback();
    },
    shade(renderer, target) {
      if (environmentDirty && !preparationPromise) this.prepare(renderer).catch(console.error);
      const depthExcluded = glassMeshes;
      const visible = depthExcluded.map(object => object.visible);
      depthExcluded.forEach(object => { object.visible = false; });
      const override=scene.overrideMaterial,background=scene.background;
      const depthAutoClear=renderer.autoClear;
      try{
        scene.overrideMaterial=opaqueDepth;scene.background=null;
        renderer.setRenderTarget(atmosphereDepth);renderer.clear();
        renderer.autoClear=false;renderer.render(scene,camera);
      }finally{
        scene.overrideMaterial=override;scene.background=background;renderer.autoClear=depthAutoClear;
      }
      occlusion.render(renderer, target, target);
      depthExcluded.forEach((object, i) => { object.visible = visible[i]; });
      windowLight.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
      windowLight.uniforms.cameraWorld.value.copy(camera.matrixWorld);
      windowLight.uniforms.eye.value.setFromMatrixPosition(camera.matrixWorld);
      windowLight.uniforms.sunShadow.value=sunlight.shadow.map?.texture;
      const autoClear = renderer.autoClear;
      const clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
      renderer.setRenderTarget(atmosphereTarget);renderer.setClearColor(0,0);renderer.clear();
      renderer.autoClear = false;
      shaftQuad.render(renderer);
      renderer.setClearColor(clearColor,clearAlpha);renderer.setRenderTarget(target);
      atmosphereQuad.render(renderer);
      renderer.autoClear = autoClear;
      diffusion.uniforms.image.value=target.texture;
      diffusion.uniforms.stepUV.value.set(1.5/bloomX.width,0);diffusion.uniforms.extract.value=1;
      renderer.setRenderTarget(bloomX);diffusionQuad.render(renderer);
      diffusion.uniforms.image.value=bloomX.texture;
      diffusion.uniforms.stepUV.value.set(0,1.5/bloomX.height);diffusion.uniforms.extract.value=0;
      renderer.setRenderTarget(bloomY);diffusionQuad.render(renderer);
      renderer.setRenderTarget(target);
    },
    resize(width, height) {
      const depthRatio=Math.min(devicePixelRatio||1,1.75);
      atmosphereDepth.setSize(Math.round(width*depthRatio),Math.round(height*depthRatio));
      atmosphereTarget.setSize(Math.max(1,Math.round(width/2)),Math.max(1,Math.round(height/2)));
      atmosphereComposite.uniforms.size.value.set(atmosphereTarget.width,atmosphereTarget.height);
      bloomX.setSize(Math.max(1,Math.round(width/4)),Math.max(1,Math.round(height/4)));
      bloomY.setSize(bloomX.width,bloomX.height);
      viewportWidth = width; viewportHeight = height;
      camera.aspect = width / height;
      // Preserve the full room on narrow displays instead of cropping the interactable objects.
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) / Math.min(1, camera.aspect / authoredAspect)));
      camera.updateProjectionMatrix();
      const pixelRatio = Math.min(devicePixelRatio || 1, 1.75);
      dustMaterial.uniforms.pixelRatio.value = pixelRatio;
      outline.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio));
      outline.overlayMaterial.uniforms.strokeTexel.value.set(1 / width, 1 / height);
      const aoScale = Math.min(.7, 720 / width);
      occlusion.setSize(Math.round(width * aoScale), Math.round(height * aoScale));
    },
    point(x, y) { pointer.set(x, y); },
    holdView(held) { viewHeld = held; },
    pick(x, y) {
      const cast = (px, py) => {
        raycaster.setFromCamera(pickPoint.set(px, py), camera);
        return raycaster.intersectObjects(targets, false)[0]?.object.userData.roomAction || null;
      };
      let action = cast(x, y);
      // A ten-CSS-pixel margin, with the same occlusion rules as a direct hit.
      // Try the nearest ring first so adjacent objects keep predictable targets.
      for (const radius of [5, 10]) {
        if (action) break;
        for (let i = 0; i < 8 && !action; i++) {
          const angle = i * Math.PI / 4;
          action = cast(x + Math.cos(angle) * radius * 2 / viewportWidth,
            y + Math.sin(angle) * radius * 2 / viewportHeight);
        }
      }
      if (action !== highlighted) highlight(action);
      return action;
    },
    update(dt, reducedMotion) {
      if (stillView !== reducedMotion) { stillView = reducedMotion; syncVideoPlayback(); }
      const blend = reducedMotion ? 1 : 1 - Math.exp(-3 * dt);
      const target = reducedMotion ? new THREE.Vector2() : pointer;
      if (!viewHeld) look.lerp(target, blend);
      const offset = new THREE.Quaternion().setFromEuler(new THREE.Euler(look.y * 0.028, -look.x * 0.045, 0, "YXZ"));
      if (!viewHeld) {
        camera.quaternion.copy(baseRotation).multiply(offset);
        camera.position.copy(basePosition).addScaledVector(cameraRight, look.x * .024);
      }
      const beforeCurtains = curtainProgress;
      if (roomVisible) {
        curtainProgress = reducedMotion ? curtainTarget : THREE.MathUtils.damp(curtainProgress, curtainTarget, 5, Math.min(dt, .1));
        if (Math.abs(curtainProgress - curtainTarget) < .001) curtainProgress = curtainTarget;
      }
      const curtainsMoving = beforeCurtains !== curtainProgress;
      if (!reducedMotion && roomVisible) {
        clothTime += dt;
        atmosphereTime.value += Math.min(dt, .1);
      }
      if ((!reducedMotion && roomVisible) || curtainsMoving) {
        for (const { object, base, closed, sides, center, min, height } of cloth) {
          const positions = object.geometry.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            const p = i * 3;
            const free = Math.pow(1 - (base[p + 1] - min) / height, 2);
            const wave = Math.sin(clothTime * .65 + base[p + 2] * 2.1);
            positions.array[p] = THREE.MathUtils.lerp(base[p], closed[p], curtainProgress) + (reducedMotion ? 0 : free * wave * .003);
            const z = THREE.MathUtils.lerp(base[p + 2], closed[p + 2], curtainProgress)
              + (reducedMotion ? 0 : free * Math.sin(clothTime * .43 + base[p + 2]) * .0015);
            // Resolve panel contact after the breeze as well as during travel.
            positions.array[p + 2] = sides[i] < 0 ? Math.min(z, center - .003) : Math.max(z, center + .003);
          }
          positions.needsUpdate = true;
          object.geometry.computeVertexNormals();
        }
      }
      if (curtainsMoving) {
        sunlight.intensity = sunIntensity * (1 - curtainProgress * .92);
        sunlight.shadow.needsUpdate = true;
        fabricDaylight.value = .82 * (1 - curtainProgress * .65);
        curtainDaylight.value = 1 - curtainProgress * .55;
        skyFill.intensity = .42 * (1 - curtainProgress * .5);
        windowLight.uniforms.strength.value = .16 * (1 - curtainProgress) ** 2;
        dust.visible = curtainProgress < .98;
      }
      const armMoving=recordPlayer&&(recordPlayer.state.requestedPlaying!==soundtrack.playing
        || !['parked','playing'].includes(recordPlayer.state.phase));
      recordPlayer?.update(dt,soundtrack.playing,reducedMotion,soundtrack.progress);
      // The song advances very slowly; refresh its moving shadow only after
      // a visible change, while retaining every frame of the pickup motion.
      if(armMoving||recordPlayer&&Math.abs(recordPlayer.state.yaw-recordShadowYaw)>.0005){
        sunlight.shadow.needsUpdate=true;recordShadowYaw=recordPlayer.state.yaw;
      }
    },
    reset() { pointer.set(0, 0); look.set(0, 0); highlight(null); soundtrack.stop(); recordPlayer?.reset(); sunlight.shadow.needsUpdate=true; camera.quaternion.copy(baseRotation); camera.position.copy(basePosition); },
  };
}
