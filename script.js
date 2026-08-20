import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";

const DEFAULT_DOCUMENT_TITLE = document.title;

const CONFIG = {
  globeRadius: 1.72,
  markerAltitude: 0.028,
  maxGlobeScale: 0.82,
  cameraRestZ: 6.65,
  cameraFocusZ: 4.55,
  initialGlobeScale: 0.0014,
  scrollProgressRate: 0.00085,
  maxPixelRatio: 1.75,
  dragSpeed: 0.0046,
  focusDuration: 1100,
  travelStarCount: 12,
  travelStarEndProgress: 0.7,
};

const LOCATIONS = {
  gainesville: {
    id: "gainesville",
    kicker: "Gainesville, Florida",
    heading: "Education",
    subheading: "University of Florida",
    detail: "Major in Computer Science",
    lat: 29.6516,
    lon: -82.3248,
    description: "I'm currently a player and the market coordinator for UF Valorant Esports.  I'm also a part of the DevLUp game development club at UF.",
    actions: [
      { label: "Game Development", drawerId: "game-development" },
      { label: "Coding projects", drawerId: "coding-projects" },
    ],
  },
  tokyo: {
    id: "tokyo",
    kicker: "Tokyo, Japan",
    heading: "Languages",
    subheading: "Japanese at an N5 level; Proficient in English",
    detail: "Minor in Japanese Literature",
    lat: 35.6762,
    lon: 139.6503,
    description: "I have been learning Japanese for roughly a year, and have taken 2 courses for Japanese, placing me at around an N5 level.  I'm currently taking a third course, meaning I'm studying toward an N4 level.",
    actions: [
      { label: "Japanese Blog", drawerId: "japanese-blog" },
    ],
  },
};

const DRAWERS = {
  "game-development": {
    kicker: "Florida / Game Development",
    title: "Game Development",
    entries: [
      {
        title: "Arcade Adventures",
        meta: "Roblox Studio; Lua",
        description: "Arcade Adventures was my first, and currently my only, game I have released.  The game was produced within Roblox Studio using Lua, and broadened my views of game development in ways that someone who hasn't developed a game might not understand.  This project taught me how to use Blender extensively, and I plan on releasing the full game sometime in 2026.",
        image: "assets/ArcadeAdventuresWeb.webp",
        imageAlt: "Arcade Adventures game thumbnail showing players at arcade cabinets",
        href: "https://www.roblox.com/games/96313690258281/Arcade-Adventures",
        linkLabel: "Open on Roblox",
      },
    ],
  },
  "coding-projects": {
    kicker: "Florida / Coding Projects",
    title: "Coding Projects",
    entries: [
      {
        title: "Towski.dev",
        meta: "Javascript; HTML",
        description: "This website is a museum of my life I plan to update monthly or yearly for a long time. I hope that one day I've travelled the world and this globe is filled with different areas to look at.  In the meantime I have information on my Japanese and coding journey.\n\nThank you for looking at my world.",
        attribution: {
          prefix: "Earth and star textures by ",
          sourceLabel: "Solar System Scope",
          sourceHref: "https://www.solarsystemscope.com/textures/",
          middle: ", for web use under ",
          licenseLabel: "CC BY 4.0",
          licenseHref: "https://creativecommons.org/licenses/by/4.0/",
        },
      },
      {
        title: "AREDL Discord Bot",
        meta: "REST API; Java",
        description: "This discord bot was my biggest dive into using APIs to automate a previously manual task.  This bot searched through the All Rated Extreme Demon List API in order to rank individual members within a discord server.  I implemented features like sorting via hardest level, total points, or extreme demon count for quality of life for users using a cached hash map of the leaderboard.",
      },
    ],
  },
  "japanese-blog": {
    kicker: "Japan / Japanese Blog",
    title: "日本語ブログ",
    description: "",
    supportsBlog: true,
  },
};

// Add future Japanese blog categories and entries here before publishing the site.
const JAPANESE_BLOG_CATEGORIES = [
  {
    id: "intermediate-japanese",
    name: "中級日本語",
    entries: [
      {
        id: "blog-entry-8-21-2026",
        title: "近日公開",
        body: "",
        media: [
        ],
      },
    ],
  },
];

function readBlogRoute() {
  const match = window.location.hash.match(/^#blog\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  try {
    return {
      categoryId: decodeURIComponent(match[1]),
      entryId: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

function findBlogEntry(categoryId, entryId) {
  const category = JAPANESE_BLOG_CATEGORIES.find((item) => item.id === categoryId);
  const entry = category?.entries?.find((item) => item.id === entryId);
  return category && entry ? { category, entry } : null;
}

function writeBlogRoute(categoryId, entryId, { replace = false } = {}) {
  const route = `#blog/${encodeURIComponent(categoryId)}/${encodeURIComponent(entryId)}`;
  const match = findBlogEntry(categoryId, entryId);
  window.history[replace ? "replaceState" : "pushState"](null, "", route);
  document.title = match ? `${match.entry.title} | ${DEFAULT_DOCUMENT_TITLE}` : DEFAULT_DOCUMENT_TITLE;
}

function clearBlogRoute({ replace = true } = {}) {
  if (!readBlogRoute()) return;
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history[replace ? "replaceState" : "pushState"](null, "", cleanUrl);
  document.title = DEFAULT_DOCUMENT_TITLE;
}

const ui = {
  app: document.querySelector("#app"),
  stage: document.querySelector("#globe-stage"),
  canvas: document.querySelector("#globe-canvas"),
  fallback: document.querySelector("#canvas-fallback"),
  loading: document.querySelector("#loading-screen"),
  progress: document.querySelector("#load-progress"),
  loadStatus: document.querySelector("#load-status"),
  guide: document.querySelector("#interaction-guide"),
  panel: document.querySelector("#location-panel"),
  panelClose: document.querySelector("#close-panel"),
  kicker: document.querySelector("#location-kicker"),
  heading: document.querySelector("#location-heading"),
  subheading: document.querySelector("#location-subheading"),
  detail: document.querySelector("#location-detail"),
  description: document.querySelector("#location-description"),
  actions: document.querySelector("#location-actions"),
  locationLinks: [...document.querySelectorAll("[data-location]")],
  wordmark: document.querySelector(".wordmark"),
  wordmarkPath: document.querySelector("#wordmark-path"),
  wordmarkSuffixes: [...document.querySelectorAll(".wordmark__suffix")],
  drawer: document.querySelector("#content-drawer"),
  drawerClose: document.querySelector("#close-drawer"),
  drawerKicker: document.querySelector("#drawer-kicker"),
  drawerTitle: document.querySelector("#drawer-title"),
  drawerDescription: document.querySelector("#drawer-description"),
  drawerContent: document.querySelector("#drawer-content"),
};

const state = {
  selectedId: null,
  dragging: false,
  dragged: false,
  pointerId: null,
  previousPointer: new THREE.Vector2(),
  pointerNdc: new THREE.Vector2(),
  currentQuaternion: new THREE.Quaternion(),
  targetQuaternion: new THREE.Quaternion(),
  focusStartQuaternion: new THREE.Quaternion(),
  focusStartedAt: 0,
  focusActive: false,
  drawerId: null,
  zoomProgress: 0,
  zoomCurrentProgress: 0,
  globeCurrentScale: CONFIG.initialGlobeScale,
  globeTargetScale: CONFIG.initialGlobeScale,
  cameraTargetZ: CONFIG.cameraRestZ,
  cameraCurrentZ: CONFIG.cameraRestZ,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
};

let renderer;
let scene;
let camera;
let earthGroup;
let skySphere;
let travelStarGroup;
let travelStars;
let earthStar;
let raycaster;
let markerHitTargets = [];
let frameId;

function setLoadProgress(percent, message) {
  ui.progress.style.width = `${Math.max(4, Math.min(100, percent))}%`;
  ui.loadStatus.textContent = message;
}

function closeLoadingScreen() {
  setLoadProgress(100, "Ready");
  window.setTimeout(() => ui.loading.classList.add("is-complete"), 280);
}

function showFallback(message) {
  cancelAnimationFrame(frameId);
  ui.fallback.hidden = false;
  ui.fallback.querySelector("p").textContent = message;
  ui.loading.classList.add("is-complete");
}

function chooseEarthTexture() {
  const isCompact = window.innerWidth <= 800 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  return isCompact ? "assets/earth-2048.webp" : "assets/earth-4096.webp";
}

function chooseStarTexture() {
  const isCompact = window.innerWidth <= 800 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  if (isCompact) return "assets/stars-2560.webp";
  if (navigator.deviceMemory && navigator.deviceMemory <= 6) return "assets/stars-4096.webp";
  return "assets/stars-8192.webp";
}

function getRestCameraZ() {
  if (!camera || camera.aspect >= 0.9) return CONFIG.cameraRestZ;
  const halfVerticalFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const mobileWidthFill = 0.86;
  return Math.max(
    CONFIG.cameraRestZ,
    CONFIG.globeRadius / (Math.tan(halfVerticalFov) * camera.aspect * mobileWidthFill),
  );
}

function getFocusCameraZ() {
  const restZ = getRestCameraZ();
  return camera?.aspect < 0.9 ? restZ * 0.66 : CONFIG.cameraFocusZ;
}

function globeScaleFromProgress(progress) {
  const eased = Math.pow(THREE.MathUtils.clamp(progress, 0, 1), 1.6);
  return THREE.MathUtils.lerp(CONFIG.initialGlobeScale, CONFIG.maxGlobeScale, eased);
}

function createStarSpriteTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 30);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.18, "rgba(238, 246, 255, 0.92)");
  gradient.addColorStop(0.5, "rgba(195, 218, 238, 0.26)");
  gradient.addColorStop(1, "rgba(150, 188, 220, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTravelStars() {
  const positions = [];
  const paths = [];
  let seed = 4729;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let index = 0; index < CONFIG.travelStarCount; index += 1) {
    const angle = random() * Math.PI * 2;
    const startZ = THREE.MathUtils.lerp(-10, 1.2, random());
    const distanceFromRestCamera = CONFIG.cameraRestZ - startZ;
    const angularRadius = THREE.MathUtils.lerp(0.09, 0.5, Math.sqrt(random()));
    const baseX = Math.cos(angle) * angularRadius * distanceFromRestCamera;
    const baseY = Math.sin(angle) * angularRadius * distanceFromRestCamera;
    const passAt = THREE.MathUtils.lerp(0.43, 0.68, random());
    positions.push(baseX, baseY, startZ);
    paths.push({ baseX, baseY, startZ, distanceFromRestCamera, passAt });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.userData.paths = paths;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSprite: { value: createStarSpriteTexture() },
      uColor: { value: new THREE.Color(0xe8f6ff) },
      uOpacity: { value: 0.92 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio) },
      uPointScale: { value: 72 },
    },
    vertexShader: `
      uniform float uPixelRatio;
      uniform float uPointScale;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float cssPointSize = clamp(uPointScale / max(1.0, -viewPosition.z), 2.35, 12.0);
        gl_PointSize = cssPointSize * uPixelRatio;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uSprite;
      uniform vec3 uColor;
      uniform float uOpacity;

      void main() {
        vec4 sprite = texture2D(uSprite, gl_PointCoord);
        if (sprite.a < 0.01) discard;
        gl_FragColor = vec4(uColor, sprite.a * uOpacity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = "travel-stars";
  stars.frustumCulled = false;
  return stars;
}

function updateTravelStars(progress) {
  const positions = travelStars.geometry.attributes.position;
  const paths = travelStars.geometry.userData.paths;
  const endZ = camera.position.z + 0.8;

  travelStars.visible = progress < CONFIG.travelStarEndProgress;

  for (let index = 0; index < positions.count; index += 1) {
    const offset = index * 3;
    const path = paths[index];

    if (progress >= path.passAt) {
      positions.array[offset] = 0;
      positions.array[offset + 1] = 0;
      positions.array[offset + 2] = camera.position.z + 1;
      continue;
    }

    const pathProgress = THREE.MathUtils.clamp(progress / path.passAt, 0, 1);
    const rotatedStart = new THREE.Vector3(path.baseX, path.baseY, path.startZ)
      .applyQuaternion(skySphere.quaternion);
    positions.array[offset] = rotatedStart.x;
    positions.array[offset + 1] = rotatedStart.y;
    positions.array[offset + 2] = THREE.MathUtils.lerp(rotatedStart.z, endZ, pathProgress);
  }

  positions.needsUpdate = true;
  travelStars.material.uniforms.uPointScale.value = 66 + progress * 14;
  travelStars.material.uniforms.uOpacity.value = 0.92;
}

function createEarthStar() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.08], 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.05,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.92,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const point = new THREE.Points(geometry, material);
  point.name = "earth-as-star";
  return point;
}

function latLonToVector3(lat, lon, radius) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function createMarker(location, index) {
  const marker = new THREE.Group();
  marker.name = `marker-${location.id}`;
  marker.userData = { locationId: location.id, phase: index * Math.PI * 0.78 };

  const position = latLonToVector3(
    location.lat,
    location.lon,
    CONFIG.globeRadius + CONFIG.markerAltitude,
  );
  marker.position.copy(position);
  marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize());

  const dotMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    toneMapped: false,
  });
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.035, 32), dotMaterial);
  dot.position.z = 0.007;
  dot.name = "signal-dot";
  marker.add(dot);

  const hitTarget = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 16, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  hitTarget.userData.locationId = location.id;
  marker.add(hitTarget);
  markerHitTargets.push(hitTarget);

  earthGroup.add(marker);
}

function setupScene(earthTexture, normalTexture, roughnessTexture, heightTexture, starsTexture) {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  const initialCameraZ = getRestCameraZ();
  camera.position.set(0, 0, initialCameraZ);
  state.cameraCurrentZ = initialCameraZ;
  state.cameraTargetZ = initialCameraZ;

  renderer = new THREE.WebGLRenderer({
    canvas: ui.canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;

  raycaster = new THREE.Raycaster();
  travelStars = createTravelStars();
  travelStarGroup = new THREE.Group();
  travelStarGroup.name = "travel-star-system";
  travelStarGroup.add(travelStars);
  earthStar = createEarthStar();
  scene.add(travelStarGroup, earthStar);
  earthGroup = new THREE.Group();
  earthGroup.name = "earth-system";
  earthGroup.scale.setScalar(CONFIG.initialGlobeScale);
  scene.add(earthGroup);

  earthTexture.colorSpace = THREE.SRGBColorSpace;
  starsTexture.colorSpace = THREE.SRGBColorSpace;
  starsTexture.wrapS = THREE.RepeatWrapping;
  starsTexture.wrapT = THREE.ClampToEdgeWrapping;
  starsTexture.repeat.set(1, 1);
  starsTexture.offset.set(0, 0);
  earthTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  normalTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  roughnessTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  heightTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  starsTexture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());

  skySphere = new THREE.Mesh(
    new THREE.SphereGeometry(42, 96, 64),
    new THREE.MeshBasicMaterial({
      map: starsTexture,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  skySphere.name = "rotating-star-sphere";
  skySphere.renderOrder = -10;
  scene.add(skySphere);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.globeRadius, 192, 128),
    new THREE.MeshStandardMaterial({
      map: earthTexture,
      normalMap: normalTexture,
      normalScale: new THREE.Vector2(0.72, 0.72),
      roughness: 0.96,
      roughnessMap: roughnessTexture,
      metalness: 0,
      displacementMap: heightTexture,
      displacementScale: 0.018,
      displacementBias: -0.002,
    }),
  );
  earth.name = "earth";
  earthGroup.add(earth);

  scene.add(new THREE.HemisphereLight(0xb9d4df, 0x071015, 1.22));
  const sunlight = new THREE.DirectionalLight(0xffffff, 2.25);
  sunlight.position.set(-3.7, 2.1, 4.5);
  scene.add(sunlight);
  Object.values(LOCATIONS).forEach(createMarker);

  const initialTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, -0.42, -0.05));
  earthGroup.quaternion.copy(initialTilt);
  state.currentQuaternion.copy(initialTilt);
  state.targetQuaternion.copy(initialTilt);
}

function resize() {
  if (!renderer || !camera) return;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  state.cameraTargetZ = state.selectedId ? getFocusCameraZ() : getRestCameraZ();
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  if (travelStars) travelStars.material.uniforms.uPixelRatio.value = pixelRatio;
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function updateFocus(now) {
  if (!state.focusActive) return;
  const duration = state.reducedMotion ? 1 : CONFIG.focusDuration;
  const progress = Math.min(1, (now - state.focusStartedAt) / duration);
  const eased = easeInOutCubic(progress);
  state.currentQuaternion.slerpQuaternions(state.focusStartQuaternion, state.targetQuaternion, eased);
  if (progress === 1) state.focusActive = false;
}

function updateMarkers(now) {
  const cameraDirection = camera.position.clone().normalize();
  earthGroup.children.forEach((child) => {
    if (!child.name.startsWith("marker-")) return;
    const worldPosition = new THREE.Vector3();
    child.getWorldPosition(worldPosition);
    const frontness = worldPosition.clone().normalize().dot(cameraDirection);
    const visible = frontness > 0.14;
    child.visible = visible;
    if (!visible) return;

    const phase = child.userData.phase;
    const cycle = (Math.sin(now * 0.0032 + phase) + 1) / 2;
    const dot = child.getObjectByName("signal-dot");
    dot.scale.setScalar(0.82 + cycle * 0.24);
    dot.material.opacity = 0.18 + cycle * 0.82;
  });
}

function updateWordmarkCurve() {
  const rawProgress = THREE.MathUtils.clamp((state.zoomCurrentProgress - 0.42) / 0.58, 0, 1);
  const curveProgress = rawProgress * rawProgress * (3 - 2 * rawProgress);
  if (curveProgress < 0.001) {
    ui.wordmarkPath.setAttribute("d", "M 150 92 L 1050 92");
    return;
  }

  const svg = ui.wordmarkPath.ownerSVGElement;
  const svgBounds = svg.getBoundingClientRect();
  const canvasBounds = ui.canvas.getBoundingClientRect();
  if (!svgBounds.width || !canvasBounds.width || !canvasBounds.height) return;

  const centerNdc = new THREE.Vector3(0, 0, 0).project(camera);
  const topNdc = new THREE.Vector3(0, CONFIG.globeRadius * state.globeCurrentScale, 0).project(camera);
  const centerScreenX = canvasBounds.left + ((centerNdc.x + 1) * 0.5 * canvasBounds.width);
  const centerScreenY = canvasBounds.top + ((1 - centerNdc.y) * 0.5 * canvasBounds.height);
  const topScreenY = canvasBounds.top + ((1 - topNdc.y) * 0.5 * canvasBounds.height);
  const earthRadiusPx = Math.abs(centerScreenY - topScreenY);
  const svgScale = svgBounds.width / 1200;
  const centerX = (centerScreenX - svgBounds.left) / svgScale;
  const centerY = (centerScreenY - svgBounds.top) / svgScale;
  const titleGapPx = THREE.MathUtils.clamp(svgBounds.width * 0.026, 20, 32);
  const halfAngle = THREE.MathUtils.degToRad(63);
  const radiusForEarth = (earthRadiusPx + titleGapPx) / svgScale;
  const maximumRadius = (Math.min(centerX, 1200 - centerX) - 54) / Math.sin(halfAngle);
  const targetRadius = Math.min(Math.max(365, radiusForEarth), maximumRadius);
  const targetHalfChord = targetRadius * Math.sin(halfAngle);
  const targetEdgeY = centerY - targetRadius * Math.cos(halfAngle);
  const targetSagitta = targetRadius * (1 - Math.cos(halfAngle));

  const leftX = THREE.MathUtils.lerp(150, centerX - targetHalfChord, curveProgress);
  const rightX = THREE.MathUtils.lerp(1050, centerX + targetHalfChord, curveProgress);
  const edgeY = THREE.MathUtils.lerp(92, targetEdgeY, curveProgress);
  const sagitta = targetSagitta * curveProgress;
  const halfChord = (rightX - leftX) / 2;
  const radius = (halfChord * halfChord + sagitta * sagitta) / (2 * sagitta);
  ui.wordmarkPath.setAttribute(
    "d",
    `M ${leftX.toFixed(2)} ${edgeY.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${rightX.toFixed(2)} ${edgeY.toFixed(2)}`,
  );
}

function updateZoomInterface() {
  const progress = THREE.MathUtils.smoothstep(state.zoomCurrentProgress, 0, 1);
  const wordmarkScale = THREE.MathUtils.lerp(1.1, 0.96, progress);
  const wordmarkY = THREE.MathUtils.lerp(28, -8, progress);
  const accentGlowFade = 1 - THREE.MathUtils.smoothstep(state.zoomCurrentProgress, 0.26, 0.78);
  const suffixPresence = 1 - THREE.MathUtils.smoothstep(state.zoomCurrentProgress, 0.24, 0.58);
  const suffixFontSize = 0.52 * suffixPresence;
  const suffixGap = 0.18 * suffixPresence;
  ui.wordmark.style.setProperty("--wordmark-scale", wordmarkScale.toFixed(3));
  ui.wordmark.style.setProperty("--wordmark-y", `${wordmarkY.toFixed(1)}px`);
  ui.wordmark.style.setProperty("--accent-glow-opacity", (accentGlowFade * 0.82).toFixed(3));
  ui.wordmarkSuffixes.forEach((suffix) => {
    const opacity = suffix.classList.contains("wordmark__accent-color")
      ? suffixPresence * accentGlowFade * 0.82
      : suffixPresence;
    suffix.style.fontSize = `${suffixFontSize.toFixed(3)}em`;
    suffix.style.opacity = opacity.toFixed(3);
    suffix.setAttribute("dx", `${suffixGap.toFixed(3)}em`);
  });

  const guideVisible = state.zoomCurrentProgress <= 0.2 && !state.selectedId;
  ui.guide.classList.toggle("is-hidden", !guideVisible);
  ui.guide.setAttribute("aria-hidden", String(!guideVisible));
}

function animate(now = 0) {
  frameId = requestAnimationFrame(animate);
  updateFocus(now);
  earthGroup.quaternion.copy(state.currentQuaternion);
  state.zoomCurrentProgress += (state.zoomProgress - state.zoomCurrentProgress) * (state.reducedMotion ? 1 : 0.075);
  state.globeCurrentScale += (state.globeTargetScale - state.globeCurrentScale) * (state.reducedMotion ? 1 : 0.075);
  earthGroup.scale.setScalar(state.globeCurrentScale);
  earthStar.material.opacity = Math.max(0, 0.92 * (1 - state.zoomCurrentProgress / 0.085));
  earthStar.visible = earthStar.material.opacity > 0.01;
  updateZoomInterface();
  updateWordmarkCurve();
  state.cameraCurrentZ += (state.cameraTargetZ - state.cameraCurrentZ) * (state.reducedMotion ? 1 : 0.075);
  camera.position.z = state.cameraCurrentZ;
  skySphere.position.copy(camera.position);
  skySphere.quaternion.slerp(state.currentQuaternion, state.reducedMotion ? 1 : 0.024);
  updateTravelStars(state.zoomCurrentProgress);
  updateMarkers(now);
  renderer.render(scene, camera);
}

function rotateFromDelta(deltaX, deltaY) {
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * CONFIG.dragSpeed);
  const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * CONFIG.dragSpeed);
  state.currentQuaternion.premultiply(yaw).premultiply(pitch).normalize();
  state.targetQuaternion.copy(state.currentQuaternion);
  state.focusActive = false;
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  state.dragging = true;
  state.dragged = false;
  state.pointerId = event.pointerId;
  state.previousPointer.set(event.clientX, event.clientY);
  ui.stage.setPointerCapture(event.pointerId);
  ui.stage.classList.add("is-dragging");
}

function onPointerMove(event) {
  if (!state.dragging || event.pointerId !== state.pointerId) return;
  const deltaX = event.clientX - state.previousPointer.x;
  const deltaY = event.clientY - state.previousPointer.y;
  if (Math.abs(deltaX) + Math.abs(deltaY) > 2) {
    state.dragged = true;
    if (state.selectedId) closePanel();
  }
  rotateFromDelta(deltaX, deltaY);
  state.previousPointer.set(event.clientX, event.clientY);
}

function onPointerUp(event) {
  if (event.pointerId !== state.pointerId) return;
  state.dragging = false;
  ui.stage.classList.remove("is-dragging");
  if (ui.stage.hasPointerCapture(event.pointerId)) ui.stage.releasePointerCapture(event.pointerId);
  if (!state.dragged) selectMarkerAtPointer(event);
}

function onWheel(event) {
  event.preventDefault();
  if (state.selectedId) {
    closePanel();
    state.zoomProgress = 1;
  }
  state.zoomProgress = THREE.MathUtils.clamp(
    state.zoomProgress - event.deltaY * CONFIG.scrollProgressRate,
    0,
    1,
  );
  state.globeTargetScale = globeScaleFromProgress(state.zoomProgress);
}

function selectMarkerAtPointer(event) {
  const bounds = ui.canvas.getBoundingClientRect();
  state.pointerNdc.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(state.pointerNdc, camera);
  const visibleTargets = markerHitTargets.filter((target) => target.parent.visible);
  const intersection = raycaster.intersectObjects(visibleTargets, false)[0];
  if (intersection) focusLocation(intersection.object.userData.locationId);
}

function focusLocation(locationId, { preserveBlogUrl = false } = {}) {
  const location = LOCATIONS[locationId];
  if (!location) return;
  closeDrawer({ preserveBlogUrl });

  const localDirection = latLonToVector3(location.lat, location.lon, 1).normalize();
  const frontDirection = new THREE.Vector3(0, 0, 1);
  state.focusStartQuaternion.copy(state.currentQuaternion);
  state.targetQuaternion.setFromUnitVectors(localDirection, frontDirection);
  state.focusStartedAt = performance.now();
  state.focusActive = true;
  state.zoomProgress = 1;
  state.globeTargetScale = CONFIG.maxGlobeScale;
  state.cameraTargetZ = getFocusCameraZ();
  state.selectedId = locationId;

  ui.kicker.textContent = location.kicker;
  ui.heading.textContent = location.heading;
  ui.subheading.textContent = location.subheading;
  ui.detail.textContent = location.detail;
  ui.description.textContent = location.description;
  ui.actions.replaceChildren(...location.actions.map((action) => {
    const button = document.createElement("button");
    button.className = "text-button";
    button.type = "button";
    button.textContent = action.label;
    button.dataset.drawer = action.drawerId;
    return button;
  }));
  ui.panel.classList.add("is-open");
  ui.panel.setAttribute("aria-hidden", "false");
  ui.locationLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.location === locationId));

  window.setTimeout(() => ui.panelClose.focus({ preventScroll: true }), state.reducedMotion ? 0 : 430);
}

function renderPrivateBlog() {
  const activeRoute = readBlogRoute();
  const categories = JAPANESE_BLOG_CATEGORIES.map((category, categoryIndex) => {
    const categoryEntries = category.entries || [];
    const categoryDetails = document.createElement("details");
    categoryDetails.className = "blog-category";
    categoryDetails.open = categoryIndex === 0 || activeRoute?.categoryId === category.id;

    const categorySummary = document.createElement("summary");
    const categoryName = document.createElement("span");
    categoryName.textContent = category.name;
    categorySummary.append(categoryName);

    const entriesContainer = document.createElement("div");
    entriesContainer.className = "blog-category__entries";
    if (!categoryEntries.length) {
      const empty = document.createElement("p");
      empty.className = "blog-category__empty";
      empty.textContent = "No entries in this category yet.";
      entriesContainer.append(empty);
    } else {
      categoryEntries.forEach((entry) => {
        const entryDetails = document.createElement("details");
        entryDetails.className = `blog-entry${entry.media?.length ? " blog-entry--media" : ""}`;
        entryDetails.dataset.blogCategory = category.id;
        entryDetails.dataset.blogEntry = entry.id;
        const entrySummary = document.createElement("summary");
        const entryTitle = document.createElement("span");
        entryTitle.textContent = entry.title;
        entrySummary.append(entryTitle);

        const content = document.createElement("div");
        content.className = "blog-entry__content";
        const body = document.createElement("p");
        body.className = "blog-entry__body";
        body.textContent = entry.body;
        content.append(body);

        if (entry.media?.length) {
          const gallery = document.createElement("div");
          gallery.className = "blog-entry__gallery";
          entry.media.forEach((media) => {
            const frame = document.createElement("figure");
            frame.className = `blog-entry__image blog-entry__image--${media.size}`;
            const image = document.createElement("img");
            image.src = media.src;
            image.alt = media.label;
            image.loading = "lazy";
            image.decoding = "async";
            frame.append(image);
            gallery.append(frame);
          });
          content.append(gallery);
        }

        entryDetails.append(entrySummary, content);
        entryDetails.addEventListener("toggle", () => {
          if (entryDetails.open) {
            ui.drawerContent.querySelectorAll(".blog-entry[open]").forEach((openEntry) => {
              if (openEntry !== entryDetails) openEntry.open = false;
            });
            const currentRoute = readBlogRoute();
            const isCurrentRoute = currentRoute?.categoryId === category.id && currentRoute.entryId === entry.id;
            writeBlogRoute(category.id, entry.id, { replace: isCurrentRoute });
          } else {
            const currentRoute = readBlogRoute();
            if (currentRoute?.categoryId === category.id && currentRoute.entryId === entry.id) {
              clearBlogRoute();
            }
          }
          ui.drawer.classList.toggle(
            "has-expanded-entry",
            Boolean(ui.drawerContent.querySelector(".blog-entry[open]")),
          );
        });
        entryDetails.open = activeRoute?.categoryId === category.id && activeRoute.entryId === entry.id;
        entriesContainer.append(entryDetails);
      });
    }

    categoryDetails.append(categorySummary, entriesContainer);
    return categoryDetails;
  });
  ui.drawerContent.replaceChildren(...categories);
  const openEntry = ui.drawerContent.querySelector(".blog-entry[open]");
  ui.drawer.classList.toggle("has-expanded-entry", Boolean(openEntry));
  if (openEntry) {
    window.requestAnimationFrame(() => openEntry.scrollIntoView({ block: "nearest" }));
  }
}

function renderDrawerContent(drawerId) {
  const drawer = DRAWERS[drawerId];
  if (!drawer) return;
  if (drawer.supportsBlog) {
    renderPrivateBlog();
    return;
  }

  if (drawer.entries?.length) {
    const cards = drawer.entries.map((entry) => {
      const card = document.createElement(entry.href ? "a" : "article");
      card.className = `project-card${entry.href ? " project-card--linked" : ""}`;
      if (entry.href) {
        card.href = entry.href;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        card.setAttribute("aria-label", `${entry.title}, ${entry.meta}. Opens in a new tab.`);
      }

      if (entry.image) {
        const image = document.createElement("img");
        image.className = "project-card__image";
        image.src = entry.image;
        image.alt = entry.imageAlt || "";
        image.loading = "lazy";
        image.decoding = "async";
        card.append(image);
      }

      const content = document.createElement("div");
      content.className = "project-card__content";
      const title = document.createElement("h3");
      title.textContent = entry.title;
      const meta = document.createElement("p");
      meta.className = "project-card__meta";
      meta.textContent = entry.meta;
      const description = document.createElement("p");
      description.className = "project-card__description";
      description.textContent = entry.description;
      content.append(title, meta, description);

      if (entry.attribution) {
        const attribution = document.createElement("p");
        attribution.className = "project-card__attribution";

        const sourceLink = document.createElement("a");
        sourceLink.href = entry.attribution.sourceHref;
        sourceLink.target = "_blank";
        sourceLink.rel = "noopener noreferrer";
        sourceLink.textContent = entry.attribution.sourceLabel;

        const licenseLink = document.createElement("a");
        licenseLink.href = entry.attribution.licenseHref;
        licenseLink.target = "_blank";
        licenseLink.rel = "noopener noreferrer";
        licenseLink.textContent = entry.attribution.licenseLabel;

        attribution.append(
          document.createTextNode(entry.attribution.prefix),
          sourceLink,
          document.createTextNode(entry.attribution.middle),
          licenseLink,
          document.createTextNode("."),
        );
        content.append(attribution);
      }

      if (entry.linkLabel) {
        const linkLabel = document.createElement("span");
        linkLabel.className = "project-card__link-label";
        linkLabel.textContent = `${entry.linkLabel} ↗`;
        content.append(linkLabel);
      }

      card.append(content);
      return card;
    });
    ui.drawerContent.replaceChildren(...cards);
    return;
  }

  const empty = document.createElement("div");
  empty.className = "drawer-empty";
  const title = document.createElement("p");
  title.className = "drawer-empty__title";
  title.textContent = drawer.emptyTitle;
  const copy = document.createElement("p");
  copy.className = "drawer-empty__copy";
  copy.textContent = drawer.emptyCopy;
  empty.append(title, copy);
  ui.drawerContent.replaceChildren(empty);
}

function openDrawer(drawerId) {
  const drawer = DRAWERS[drawerId];
  if (!drawer) return;
  state.drawerId = drawerId;
  ui.drawerKicker.textContent = drawer.kicker;
  ui.drawerTitle.textContent = drawer.title;
  ui.drawerDescription.textContent = drawer.description;
  ui.drawerDescription.hidden = !drawer.description;
  ui.drawer.classList.toggle("is-blog", Boolean(drawer.supportsBlog));
  ui.drawer.classList.remove("has-expanded-entry");
  renderDrawerContent(drawerId);
  ui.drawer.classList.add("is-open");
  ui.drawer.setAttribute("aria-hidden", "false");
  window.setTimeout(() => ui.drawerClose.focus({ preventScroll: true }), state.reducedMotion ? 0 : 430);
}

function closeDrawer({ restoreFocus = false, preserveBlogUrl = false } = {}) {
  const priorDrawerId = state.drawerId;
  ui.drawer.classList.remove("is-open");
  ui.drawer.classList.remove("has-expanded-entry");
  ui.drawer.setAttribute("aria-hidden", "true");
  state.drawerId = null;
  if (priorDrawerId === "japanese-blog" && !preserveBlogUrl) clearBlogRoute();
  if (restoreFocus && priorDrawerId) {
    ui.actions.querySelector(`[data-drawer="${priorDrawerId}"]`)?.focus();
  }
}

function closePanel({ restoreFocus = false } = {}) {
  const priorId = state.selectedId;
  closeDrawer();
  ui.panel.classList.remove("is-open");
  ui.panel.setAttribute("aria-hidden", "true");
  ui.locationLinks.forEach((link) => link.classList.remove("is-active"));
  state.selectedId = null;
  state.cameraTargetZ = getRestCameraZ();
  if (restoreFocus && priorId) {
    document.querySelector(`[data-location="${priorId}"]`)?.focus();
  }
}

function handleBlogRouteChange() {
  const route = readBlogRoute();
  const match = route ? findBlogEntry(route.categoryId, route.entryId) : null;
  if (!route || !match) {
    document.title = DEFAULT_DOCUMENT_TITLE;
    if (state.drawerId === "japanese-blog") closeDrawer({ preserveBlogUrl: true });
    return;
  }

  document.title = `${match.entry.title} | ${DEFAULT_DOCUMENT_TITLE}`;
  if (state.selectedId !== "tokyo") focusLocation("tokyo", { preserveBlogUrl: true });
  openDrawer("japanese-blog");
}

function bindEvents() {
  ui.stage.addEventListener("pointerdown", onPointerDown);
  ui.stage.addEventListener("pointermove", onPointerMove);
  ui.stage.addEventListener("pointerup", onPointerUp);
  ui.stage.addEventListener("pointercancel", onPointerUp);
  ui.stage.addEventListener("wheel", onWheel, { passive: false });
  ui.panelClose.addEventListener("click", () => closePanel({ restoreFocus: true }));
  ui.drawerClose.addEventListener("click", () => closeDrawer({ restoreFocus: true }));
  ui.actions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-drawer]");
    if (button) openDrawer(button.dataset.drawer);
  });
  ui.locationLinks.forEach((link) => link.addEventListener("click", () => focusLocation(link.dataset.location)));
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("hashchange", handleBlogRouteChange);
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.drawerId) closeDrawer({ restoreFocus: true });
    else if (state.selectedId) closePanel({ restoreFocus: true });
  });
}

async function init() {
  try {
    if (state.reducedMotion) ui.wordmark.querySelector("svg")?.pauseAnimations();
    setLoadProgress(12, "Starting the renderer");
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => {
      setLoadProgress(18 + (loaded / total) * 72, "Preparing the globe");
    };
    const textureLoader = new THREE.TextureLoader(manager);
    const [earthTexture, normalTexture, roughnessTexture, heightTexture, starsTexture] = await Promise.all([
      textureLoader.loadAsync(chooseEarthTexture()),
      textureLoader.loadAsync("assets/earth-normal-2048.png"),
      textureLoader.loadAsync("assets/earth-roughness-2048.webp"),
      textureLoader.loadAsync("assets/earth-height-2048.webp"),
      textureLoader.loadAsync(chooseStarTexture()),
    ]);
    setLoadProgress(92, "Positioning signals");
    setupScene(earthTexture, normalTexture, roughnessTexture, heightTexture, starsTexture);
    bindEvents();
    resize();
    animate();
    closeLoadingScreen();
    handleBlogRouteChange();
  } catch (error) {
    console.error(error);
    showFallback("The globe could not be loaded.");
  }
}

init();
