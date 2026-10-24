const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const focused = [
  'location-urls', 'route-retarget', 'japan-room-vinyl-playback', 'japan-room-record',
  'mobile-reader', 'mobile-discovery', 'mobile-outline-depth', 'spin-window', 'spin-sandstorm', 'startup-room-preload',
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
