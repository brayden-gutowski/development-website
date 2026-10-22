import * as THREE from "three";
import { createTokyoClouds } from "./tokyo-clouds.js?v=20261018-optimized-25";

// A small, prepared imagery pyramid on the actual globe. The camera never
// changes renderers, projections, or coordinate systems during the flight.
const LEVELS = Array.from({ length: 15 }, (_, index) => index + 4);

function smooth(min, max, value) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

export async function createTokyoFlight({ renderer, earthGroup, radius, location, globeLighting }) {
  const container = document.querySelector("#city-flight");
  const latitude = THREE.MathUtils.degToRad(location.lat);
  // Atlases are prepared once offline; visiting Tokyo never downloads or
  // assembles hundreds of third-party map tiles on the UI thread.
  let prepared = [];
  try {
    const response = await fetch('assets/tokyo-flight/manifest.json?v=20261018-optimized-25', { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error('Flight manifest unavailable');
    const layers = await response.json();
    const loaded = await Promise.allSettled(layers.map(async layer => {
      const response = await fetch(`assets/tokyo-flight/${layer.zoom}.webp?v=20261018-optimized-25`, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) throw new Error('Flight atlas unavailable');
      const image = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
      const texture = new THREE.Texture(image);
      texture.flipY = false;
      texture.needsUpdate = true;
      return { ...layer, texture };
    }));
    prepared = loaded.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  } catch { /* The existing globe provides a complete fallback. */ }
  if (!prepared.length) {
    delete container.dataset.ready;
    return null;
  }

  const group = new THREE.Group();
  group.name = "tokyo-aerial-imagery";
  const materials = [];
  for (const [index, layer] of prepared.entries()) {
    const texture = layer.texture;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    renderer.initTexture(texture);
    const segments = layer.zoom <= 6 ? 128 : 40;
    const geometry = new THREE.PlaneGeometry(1, 1, segments, segments);
    const uv = geometry.attributes.uv;
    const positions = geometry.attributes.position;
    const globeUv = new Float32Array(positions.count * 2);
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const tileX = layer.x + uv.getX(vertex) * layer.grid;
      const tileY = layer.y + (1 - uv.getY(vertex)) * layer.grid;
      const lon = tileX / layer.count * Math.PI * 2 - Math.PI;
      const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / layer.count)));
      globeUv[vertex * 2] = (lon + Math.PI) / (Math.PI * 2);
      globeUv[vertex * 2 + 1] = lat / Math.PI + .5;
      const r = radius + 0.0000001 * (index + 1);
      positions.setXYZ(vertex, r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), -r * Math.cos(lat) * Math.sin(lon));
    }
    geometry.setAttribute("globeUv", new THREE.BufferAttribute(globeUv, 2));
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    material.onBeforeCompile = shader => {
      if (globeLighting) {
        shader.uniforms.uGlobeNightMap = globeLighting.nightMap;
        shader.uniforms.uGlobeSunDirection = globeLighting.sunDirection;
        shader.uniforms.uFlightDaylight = globeLighting.daylight;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>
            attribute vec2 globeUv;
            varying vec2 vGlobeUv;
            varying vec3 vGlobeNormal;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vGlobeUv = globeUv;
            vGlobeNormal = normalize(mat3(modelMatrix) * position);`);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
            uniform sampler2D uGlobeNightMap;
            uniform vec3 uGlobeSunDirection;
            uniform float uFlightDaylight;
            varying vec2 vGlobeUv;
            varying vec3 vGlobeNormal;`)
          .replace('#include <opaque_fragment>', `
            if (uFlightDaylight < 0.9999) {
              float sunFacing = dot(normalize(vGlobeNormal), normalize(uGlobeSunDirection));
              float night = 1.0 - smoothstep(-0.18, 0.12, sunFacing);
              vec3 nightColor = texture2D(uGlobeNightMap, vGlobeUv).rgb * 1.12;
              vec3 litSurface = outgoingLight * (0.08 + max(0.0, sunFacing) * 0.9);
              outgoingLight = mix(mix(litSurface, nightColor, night), outgoingLight, uFlightDaylight);
            }
            #include <opaque_fragment>`);
      }
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        float border = min(min(vMapUv.x, 1.0 - vMapUv.x), min(vMapUv.y, 1.0 - vMapUv.y));
        diffuseColor.a *= smoothstep(0.0, 0.12, border);
      `);
    };
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `tokyo-aerial-${layer.zoom}`;
    mesh.renderOrder = 10 + index;
    mesh.frustumCulled = false;
    group.add(mesh);
    materials.push({ material, mesh, zoom: layer.zoom });
    // Let focus/panel animations draw between texture uploads.
    await new Promise(requestAnimationFrame);
  }
  let clouds;
  try {
    clouds = await createTokyoClouds({ renderer, radius, latitude, longitude: THREE.MathUtils.degToRad(location.lon) });
  } catch (error) {
    group.traverse(object => {
      object.geometry?.dispose();
      if (object.material) {
        object.material.map?.image?.close?.();
        object.material.map?.dispose();
        object.material.dispose();
      }
    });
    throw error;
  }
  group.add(clouds.group, clouds.shadows);
  earthGroup.add(group);
  // Compile and upload before the timed animation, never on its first frame.
  await renderer.compileAsync(group, new THREE.PerspectiveCamera());
  group.visible = false;
  // Imagery attribution remains in the Towski.dev project drawer and assets credits.
  container.replaceChildren();
  if (prepared.length) container.dataset.ready = "true";
  container.dataset.zoom = "1.2";
  return {
    cloudHeight: .00024,
    update: clouds.update,
    setProgress(zoom) {
      clouds.setZoom(zoom);
      // The real globe and every detail layer share this gradual lighting
      // change, so detail arrives without switching from night to bright day.
      if (globeLighting) globeLighting.daylight.value = prepared.length ? THREE.MathUtils.smootherstep(zoom, 3.8, 7.8) : 0;
      const detailZoom = zoom + Math.log2(renderer.getPixelRatio()) * smooth(5, 7, zoom);
      const frameSpan = Math.hypot(innerWidth, innerHeight);
      const base = Math.max(0, materials.findLastIndex(layer => layer.zoom <= detailZoom
        && layer.material.map.image.width * 2 ** (zoom - layer.zoom) * .6 >= frameSpan));
      materials.forEach(({ material, mesh, zoom: level }, index) => {
        // Bring detail in before its predecessor is enlarged. Keep one broad
        // parent beneath the feathered edges; older full-screen layers add cost.
        const start = level === LEVELS[0] ? 3.5 : level - .85;
        material.opacity = smooth(start, level === LEVELS[0] ? 5 : level, detailZoom);
        mesh.visible = material.opacity > 0 && index >= base;
      });
      container.dataset.zoom = Math.max(1.2, Math.min(17.4, zoom)).toFixed(2);
    },
    setOpacity(opacity) {
      group.visible = opacity > 0;
      if (!opacity && globeLighting) globeLighting.daylight.value = 0;
      container.style.opacity = opacity;
      container.style.visibility = opacity > 0 ? "visible" : "hidden";
    },
    resize() {},
  };
}
