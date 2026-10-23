import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokyoDaylight } from '../tokyo-daylight.mjs';
test('Tokyo noon and midnight do not depend on the visitor time zone', () => {
  assert.equal(tokyoDaylight(new Date('2026-01-15T03:00:00Z')).phase, 'day');
  assert.equal(tokyoDaylight(new Date('2026-01-15T15:00:00Z')).phase, 'night');
  assert.equal(tokyoDaylight(new Date('2026-01-15T12:00:00+09:00')).daylight, 1);
});
test('dawn follows the seasons rather than a fixed clock hour', () => {
  assert.equal(tokyoDaylight(new Date('2026-06-20T19:10:00Z')).phase, 'dawn');
  assert.equal(tokyoDaylight(new Date('2026-12-20T19:10:00Z')).phase, 'night');
});
test('October morning and evening select the corresponding twilight phase', () => {
  assert.equal(tokyoDaylight(new Date('2026-10-17T20:45:00Z')).phase, 'dawn');
  const evening = tokyoDaylight(new Date('2026-10-18T07:30:00Z'));
  assert.equal(evening.phase, 'dusk');
  assert.ok(evening.daylight > 0 && evening.daylight < 1);
});
