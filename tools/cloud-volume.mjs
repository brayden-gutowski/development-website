// Offline cloud density/light bake; no browser visit should run this work.
export function cloudVolume(seed) {
  const size = 128;
  const noise = new Float32Array(32 ** 3);
  let random = seed;
  const features = new Float32Array(8 ** 3 * 3);
  for (let i = 0; i < features.length; i++) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    features[i] = random / 4294967296;
  }
  // Cellular billows give each cloud rounded, eroded lobes at several scales.
  for (let z = 0; z < 32; z++) {
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const px = x / 4, py = y / 4, pz = z / 4;
        const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
        let nearest = 3;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const feature = (((ix + dx) & 7) + ((iy + dy) & 7) * 8 + ((iz + dz) & 7) * 64) * 3;
              const ox = ix + dx + features[feature] - px, oy = iy + dy + features[feature + 1] - py, oz = iz + dz + features[feature + 2] - pz;
              nearest = Math.min(nearest, ox * ox + oy * oy + oz * oz);
            }
          }
        }
        noise[x + y * 32 + z * 1024] = Math.max(0, 1 - Math.sqrt(nearest) / .95);
      }
    }
  }
  const mix = (a, b, t) => a + (b - a) * t;
  function sample(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let tx = x - ix, ty = y - iy, tz = z - iz;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty); tz = tz * tz * (3 - 2 * tz);
    const at = (dx, dy, dz) => noise[((ix + dx) & 31) + ((iy + dy) & 31) * 32 + ((iz + dz) & 31) * 1024];
    return mix(mix(mix(at(0, 0, 0), at(1, 0, 0), tx), mix(at(0, 1, 0), at(1, 1, 0), tx), ty),
      mix(mix(at(0, 0, 1), at(1, 0, 1), tx), mix(at(0, 1, 1), at(1, 1, 1), tx), ty), tz);
  }
  const density = new Float32Array(size ** 3);
  const fade = value => {
    const t = Math.max(0, Math.min(1, (Math.abs(value) - .55) / .45));
    return 1 - t * t * (3 - 2 * t);
  };
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const px = x / (size - 1) * 2 - 1, py = y / (size - 1) * 2 - 1, pz = z / (size - 1) * 2 - 1;
        // Broad weather patterns connect the banks; smaller 3D billows erode
        // their edges into wisps and leave openings all the way to the city.
        const weather = sample(x / 11, y / 11, 4) * .7 + sample(x / 23, y / 23, 10) * .3;
        const billows = sample(x / 3, y / 3, z / 8) * .65 + sample(x / .9, y / .9, z / 3) * .35;
        density[x + y * size + z * size * size] = Math.max(0, Math.min(1,
          (weather * .85 + billows * .55 - .53 - pz * pz * .26) * 4.5)) * fade(Math.hypot(px, py)) * fade(pz);
      }
    }
  }
  const data = new Uint8Array(size ** 3 * 2);
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = x + y * size + z * size * size;
        let shadow = 0;
        let facing = 1;
        if (density[index] > 0) {
          const at = (dx, dy, dz) => density[Math.max(0, Math.min(size - 1, x + dx)) + Math.max(0, Math.min(size - 1, y + dy)) * size + Math.max(0, Math.min(size - 1, z + dz)) * size * size];
          const nx = at(-1, 0, 0) - at(1, 0, 0), ny = at(0, -1, 0) - at(0, 1, 0), nz = at(0, 0, -1) - at(0, 0, 1);
          facing = Math.max(0, (-.9 * nx + .2 * ny + .35 * nz) / Math.max(.0001, Math.hypot(nx, ny, nz)));
          for (let step = 1; step <= 14; step++) {
            const sx = x - step * 3, sy = y + step, sz = z + step;
            if (sx < 0 || sy >= size || sz >= size) break;
            shadow += density[sx + sy * size + sz * size * size];
          }
        }
        data[index * 2] = Math.round(density[index] * 255);
        data[index * 2 + 1] = Math.round(Math.min(1, (.24 + .76 * facing) * Math.exp(-shadow * .42)) * 255);
      }
    }
  }
  const shadowData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let thickness = 0;
      for (let z = 0; z < size; z++) thickness += density[x + y * size + z * size * size];
      shadowData[(x + y * size) * 4 + 3] = Math.round((1 - Math.exp(-thickness / size * 3.5)) * 60);
    }
  }
  return { data, shadowData };
}
