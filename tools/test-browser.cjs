const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const focused = [
  'navigation-pointer-lifetimes', 'area-loader-failure', 'gpu-resource-lifetimes', 'xp-lifetimes', 'memory-soak',
  'dark-startup', 'gainesville-fourth-room', 'gainesville-xp-fourth-review', 'flight-residency', 'model-texture-residency', 'memory-residency', 'departure-residency', 'background-areas', 'gainesville-xp-third-review', 'gainesville-globe-panel', 'gainesville-surface-response', 'gainesville-texture-detail', 'gainesville-computer-proportions', 'gainesville-lamp', 'gainesville-lamp-integration', 'gainesville-xp-authenticity', 'gainesville-room', 'gainesville-flight', 'gainesville-routing', 'gainesville-lighting', 'gainesville-xp', 'gainesville-xp-controls',
  'tokyo-wordmark-glitch', 'tokyo-direct-entry', 'render-budget', 'loading-progress',
  'location-urls', 'route-retarget', 'japan-room-vinyl-playback', 'japan-room-record',
  'mobile-navigation', 'mobile-reader', 'mobile-discovery', 'mobile-outline-depth', 'mobile-outline-motion', 'spin-window', 'spin-sandstorm', 'startup-room-preload',
  'japan-room-review-books', 'book-reader-landscape',
  'japan-room-diary-mobile-close', 'japan-room-diary-ready',
  'japan-room-blog-link', 'japan-room-outlines', 'japan-room-retry',
];
const args = process.argv.slice(2);
const files = args.includes('--all')
  ? readdirSync(resolve(root, 'tests')).filter(name => name.endsWith('.browser.cjs')).sort()
  : (args.length ? args : focused).map(name => name.endsWith('.browser.cjs') ? name : `${name}.browser.cjs`);
for (const file of files) {
  console.log(`\nRunning ${file}`);
  const result = spawnSync(process.execPath, [resolve(root, 'tests', file)], { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`\nPASS: ${files.length} browser checks`);
