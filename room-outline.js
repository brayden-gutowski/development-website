import * as THREE from 'three';
import { FullScreenQuad } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/Pass.js';

// One shared depth buffer decides which geometry is visible. Sampling and
// comparing depth in a second shader can split moving contours on mobile GPUs.
export function createRoomOutline(scene, camera) {
  const mask = new THREE.WebGLRenderTarget(1, 1);
  mask.texture.name = 'Room interaction mask';
  mask.texture.generateMipmaps = false;
  const selectedMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, fog: false, toneMapped: false });
  const occluderMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false, toneMapped: false });
  const overlayMaterial = new THREE.ShaderMaterial({
    uniforms: { maskTexture: { value: mask.texture }, strokeTexel: { value: new THREE.Vector2() } },
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D maskTexture;
      uniform vec2 strokeTexel;
      void main() {
        vec4 mask = texture2D(maskTexture, vUv);
        if ((1.0 - mask.r) * (1.0 - mask.g) > .5) discard;
        float contour = 0.0;
        for (int i = 0; i < 16; i++) {
          float angle = float(i) * 6.28318530718 / 16.0;
          vec4 neighbor = texture2D(maskTexture, vUv + vec2(cos(angle), sin(angle)) * strokeTexel * 4.0);
          contour = max(contour, (1.0 - neighbor.r) * (1.0 - neighbor.g));
        }
        float coverage = smoothstep(.2, .8, contour);
        if (coverage <= 0.0) discard;
        gl_FragColor = vec4(vec3(8.0), coverage);
      }`,
  });
  const quad = new FullScreenQuad(overlayMaterial);
  const clearColor = new THREE.Color();
  const outline = {
    selectedObjects: [], renderTargetMaskBuffer: mask, overlayMaterial,
    setSize(width, height) { mask.setSize(width, height); },
    render(renderer, _writeBuffer, readBuffer = renderer.getRenderTarget()) {
      if (!outline.selectedObjects.length) return;
      const selected = new Set();
      for (const object of outline.selectedObjects) object.traverse(child => { if (child.isMesh) selected.add(child); });
      const originals = [];
      const background = scene.background, override = scene.overrideMaterial;
      const previousTarget = renderer.getRenderTarget(), autoClear = renderer.autoClear;
      const alpha = renderer.getClearAlpha(), shadowUpdate = renderer.shadowMap.autoUpdate;
      renderer.getClearColor(clearColor);
      try {
        scene.background = null; scene.overrideMaterial = null;
        scene.traverse(object => {
          if (!object.isMesh && !object.isPoints && !object.isLine && !object.isSprite) return;
          originals.push([object, object.material, object.visible]);
          if (!object.isMesh || !selected.has(object) && [object.material].flat().every(material => material.transparent || !material.depthWrite)) {
            object.visible = false;
          } else object.material = selected.has(object) ? selectedMaterial : occluderMaterial;
        });
        renderer.shadowMap.autoUpdate = false;
        renderer.autoClear = false;
        renderer.setClearColor(0xffffff, 1);
        renderer.setRenderTarget(mask);
        renderer.clear(true, true, false);
        renderer.render(scene, camera);
      } finally {
        for (const [object, material, visible] of originals) { object.material = material; object.visible = visible; }
        scene.background = background; scene.overrideMaterial = override;
        renderer.shadowMap.autoUpdate = shadowUpdate;
        renderer.setClearColor(clearColor, alpha);
        renderer.autoClear = autoClear;
        renderer.setRenderTarget(previousTarget);
      }
      try {
        renderer.autoClear = false;
        renderer.setRenderTarget(readBuffer);
        quad.render(renderer);
      } finally { renderer.autoClear = autoClear; renderer.setRenderTarget(previousTarget); }
    },
    dispose() { mask.dispose(); selectedMaterial.dispose(); occluderMaterial.dispose(); overlayMaterial.dispose(); quad.dispose(); },
  };
  return outline;
}
