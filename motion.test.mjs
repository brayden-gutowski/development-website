import test from 'node:test';
import assert from 'node:assert/strict';
import { springStep, resistBoundary } from './motion.mjs';

test('spring returns displaced content to rest without depending on refresh rate', () => {
  const settle = (fps) => {
    let position = 80;
    let velocity = 0;
    for (let frame = 0; frame < fps * 2; frame++) {
      ({ position, velocity } = springStep(position, velocity, 0, 1 / fps));
      assert.ok(Number.isFinite(position));
    }
    return position;
  };
  assert.ok(Math.abs(settle(60)) < 0.01);
  assert.ok(Math.abs(settle(120)) < 0.01);
  assert.ok(Math.abs(settle(60) - settle(120)) < 0.001);
});

test('boundary resistance allows a limited excursion in both directions', () => {
  assert.equal(resistBoundary(0.5, 0, 1), 0.5);
  assert.ok(resistBoundary(-1, 0, 1) < 0);
  assert.ok(resistBoundary(-1, 0, 1) > -0.18);
  assert.ok(resistBoundary(2, 0, 1) > 1);
  assert.ok(resistBoundary(2, 0, 1) < 1.18);
});

test('spring remains stable after a paused frame and can reverse direction', () => {
  const first = springStep(1.1, 2, 1, 10);
  const reverse = springStep(first.position, first.velocity, 0.5, 1 / 60);
  assert.ok(Number.isFinite(reverse.position));
  assert.ok(reverse.velocity < first.velocity);
});
