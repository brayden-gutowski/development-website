const isBitmap = image => typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap;

export function disposeRoomScene(root, extraTextures = []) {
  const geometries = new Set(), materials = new Set(), textures = new Set([...extraTextures].filter(value => value?.isTexture));
  root.traverse(object => {
    if (object.isInstancedMesh) object.dispose();
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [object.material, object.customDepthMaterial].flat()) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      for (const uniform of Object.values(material.uniforms || {})) if (uniform.value?.isTexture) textures.add(uniform.value);
    }
    object.shadow?.dispose();
  });
  const images = new Set();
  textures.forEach(texture => {
    if (isBitmap(texture.image)) { images.add(texture.image); texture.image = null; }
    texture.dispose();
  });
  images.forEach(image => image.close());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

// This separate closure retains only embedded image Blobs and texture Sources,
// never the GLTF result, parser, dependency cache or its complete binary buffer.
function textureResidency(records, decodeOptions) {
  let suspended = false, generation = 0, preparing = null, disposed = false;
  return {
    get suspended() { return suspended; },
    suspend() {
      generation++;
      preparing = null;
      suspended = true;
      const images = new Set();
      for (const record of records) {
        for (const source of record.sources) {
          if (!isBitmap(source.data)) continue;
          images.add(source.data);
          record.restoreSources.add(source);
          source.data = null;
        }
        for (const texture of record.textures) {
          if (record.restoreSources.has(texture.source)) texture.dispose();
        }
      }
      for (const image of images) image.close();
    },
    dispose() {
      disposed = true;
      this.suspend();
      records.length = 0;
    },
    prepare() {
      if (disposed) return Promise.reject(new Error('Model textures have been disposed'));
      if (!suspended) return Promise.resolve();
      if (preparing) return preparing;
      const requestedGeneration = generation;
      const needed = records.filter(record => [...record.restoreSources].some(source => source.data === null));
      const pending = Promise.allSettled(needed.map(record => createImageBitmap(record.blob, decodeOptions))).then(results => {
        const failure = results.find(result => result.status === 'rejected');
        if (requestedGeneration !== generation || failure) {
          for (const result of results) if (result.status === 'fulfilled') result.value.close();
          if (failure && requestedGeneration === generation) throw failure.reason;
          return;
        }
        for (const [index, record] of needed.entries()) {
          const image = results[index].value;
          let restored = false;
          for (const source of record.restoreSources) {
            // A caller may have replaced a suspended model map with a canvas.
            if (source.data !== null) continue;
            source.data = image;
            restored = true;
          }
          if (!restored) image.close();
          for (const texture of record.textures) {
            if (record.restoreSources.has(texture.source) && texture.source.data === image) texture.needsUpdate = true;
          }
          record.restoreSources.clear();
        }
        suspended = false;
      }).finally(() => {
        if (preparing === pending) preparing = null;
      });
      preparing = pending;
      return pending;
    },
  };
}

export async function createModelTextureResidency(gltf, model = gltf.scene) {
  const parser = gltf.parser;
  const byImage = new Map(), bySource = new Map();
  const options = { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' };
  if (parser?.textureLoader?.options?.imageOrientation) options.imageOrientation = parser.textureLoader.options.imageOrientation;
  for (const [texture, reference] of parser?.associations || []) {
    if (!texture.isTexture || reference?.textures === undefined || !isBitmap(texture.image)) continue;
    const definition = parser.json.textures[reference.textures];
    const candidates = [definition.extensions?.EXT_texture_webp?.source, definition.extensions?.EXT_texture_avif?.source, definition.source]
      .filter(index => index !== undefined).map(index => parser.json.images[index]);
    const image = candidates.find(image => image.mimeType === texture.userData.mimeType) || candidates[0];
    // External HTML images, compressed GPU textures and application canvases
    // keep their existing lifetime; only embedded native ImageBitmaps belong here.
    if (image?.bufferView === undefined) continue;
    let record = byImage.get(texture.image);
    if (!record) {
      record = { imageDefinition: image, textures: new Set(), sources: new Set(), restoreSources: new Set() };
      byImage.set(texture.image, record);
    }
    record.textures.add(texture); record.sources.add(texture.source); bySource.set(texture.source, record);
  }
  const addVariant = texture => {
    if (!texture?.isTexture || !isBitmap(texture.image)) return;
    const record = bySource.get(texture.source) || byImage.get(texture.image);
    if (record) { record.textures.add(texture); record.sources.add(texture.source); }
  };
  model?.traverse(object => {
    for (const material of [object.material].flat().filter(Boolean)) {
      for (const value of Object.values(material)) addVariant(value);
      for (const uniform of Object.values(material.uniforms || {})) addVariant(uniform.value);
    }
  });
  const records = [...byImage.values()];
  try {
    await Promise.all(records.map(async record => {
      const image = record.imageDefinition;
      const buffer = await parser.getDependency('bufferView', image.bufferView);
      record.blob = new Blob([buffer], { type: image.mimeType });
      delete record.imageDefinition;
    }));
  } catch (error) {
    textureResidency(records, options).dispose();
    delete gltf.parser;
    throw error;
  }
  delete gltf.parser;
  return textureResidency(records, options);
}
