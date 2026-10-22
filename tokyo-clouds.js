import * as THREE from 'three';

const vertexShader = `
  precision highp float;
  in vec3 position;
  uniform mat4 modelMatrix, modelViewMatrix, projectionMatrix;
  uniform vec3 cameraPosition;
  out vec3 rayOrigin;
  out vec3 rayDirection;
  void main() {
    rayOrigin = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    rayDirection = position - rayOrigin;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  precision highp sampler3D;
  uniform sampler3D cloudMap;
  uniform float opacity;
  in vec3 rayOrigin;
  in vec3 rayDirection;
  out vec4 fragColor;
  void main() {
    vec3 direction = normalize(rayDirection);
    vec3 inverseDirection = 1.0 / direction;
    vec3 a = (-0.5 - rayOrigin) * inverseDirection;
    vec3 b = (0.5 - rayOrigin) * inverseDirection;
    vec3 nearBounds = min(a, b), farBounds = max(a, b);
    float near = max(max(nearBounds.x, nearBounds.y), nearBounds.z);
    float far = min(min(farBounds.x, farBounds.y), farBounds.z);
    near = max(near, 0.0);
    if (near >= far) discard;
    float stride = (far - near) / 40.0;
    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 point = rayOrigin + direction * (near + stride * jitter);
    vec4 cloud = vec4(0.0);
    for (int step = 0; step < 40; step++) {
      vec2 field = texture(cloudMap, point + 0.5).rg;
      float alpha = 1.0 - exp(-field.r * stride * 9.5);
      vec3 light = mix(vec3(0.48, 0.56, 0.65), vec3(1.32, 1.30, 1.25), field.g);
      cloud.rgb += (1.0 - cloud.a) * alpha * light;
      cloud.a += (1.0 - cloud.a) * alpha;
      if (cloud.a > 0.985) break;
      point += direction * stride;
    }
    if (cloud.a < 0.005) discard;
    fragColor = vec4(cloud.rgb / cloud.a, cloud.a * opacity);
  }
`;

export async function createTokyoClouds({ renderer, radius, latitude, longitude }) {
  const group = new THREE.Group();
  group.name = 'tokyo-city-clouds';
  const normal = new THREE.Vector3(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), -Math.cos(latitude) * Math.sin(longitude));
  group.position.copy(normal).multiplyScalar(radius + .00024);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  const shadows = new THREE.Group();
  shadows.name = 'tokyo-cloud-shadows';
  shadows.position.copy(group.position);
  shadows.quaternion.copy(group.quaternion);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  const response = await fetch('assets/tokyo-flight/cloud-volume.bin.gz', { signal: AbortSignal.timeout(2500) });
  if (!response.ok) throw new Error('Cloud volume unavailable');
  const bytes = new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const size = 128;
  const texture = new THREE.Data3DTexture(bytes.subarray(0, size ** 3 * 2), size, size, size);
  texture.format = THREE.RGFormat;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  const shadow = new THREE.DataTexture(bytes.subarray(size ** 3 * 2), size, size);
  shadow.minFilter = shadow.magFilter = THREE.LinearFilter;
  shadow.needsUpdate = true;
  renderer.initTexture(texture);
  renderer.initTexture(shadow);
  const cloud = new THREE.Mesh(geometry, new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { cloudMap: { value: texture }, opacity: { value: 0 } },
    vertexShader, fragmentShader,
    side: THREE.BackSide, transparent: true, depthWrite: false,
  }));
  cloud.name = 'tokyo-cloud-bank';
  cloud.scale.set(.03, .025, .00030);
  cloud.renderOrder = 100;
  group.add(cloud);
  const groundShadow = new THREE.Mesh(shadowGeometry, new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, depthTest: false }));
  groundShadow.position.set(.0003, -.0001, -.00024 + .0000007);
  groundShadow.scale.set(cloud.scale.x, cloud.scale.y, 1);
  groundShadow.renderOrder = 90;
  shadows.add(groundShadow);
  return {
    group, shadows,
    setZoom(zoom) {
      // Reveal only once the footprint is wider than the city view. Reversing
      // this same distance curve hides its perimeter during the pullback.
      const opacity = THREE.MathUtils.smoothstep(zoom, 10.5, 12.5);
      cloud.material.uniforms.opacity.value = opacity;
      groundShadow.material.opacity = opacity;
      group.visible = shadows.visible = opacity > 0;
    },
    update(seconds) {
      cloud.position.x = Math.sin(seconds * .012) * .00006;
      cloud.position.y = Math.sin(seconds * .009) * .000035;
      groundShadow.position.x = cloud.position.x + .0003;
      groundShadow.position.y = cloud.position.y - .0001;
    },
  };
}
