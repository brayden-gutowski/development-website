import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Reader layout reuses a media query while observing its current matches value', async () => {
  const previousWidth = Object.getOwnPropertyDescriptor(globalThis, 'innerWidth');
  const previousMatchMedia = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  const query = { matches: false };
  let calls = 0;
  globalThis.innerWidth = 1000;
  globalThis.matchMedia = value => {
    assert.equal(value, '(hover: none) and (pointer: coarse)');
    calls++;
    return query;
  };
  try {
    const source = await readFile(new URL('../reader-ui.js', import.meta.url), 'utf8');
    const { mobileReaderLayout } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    for (let i = 0; i < 200; i++) assert.equal(mobileReaderLayout(), false);
    query.matches = true; assert.equal(mobileReaderLayout(), true);
    query.matches = false; assert.equal(mobileReaderLayout(), false);
    globalThis.innerWidth = 700; assert.equal(mobileReaderLayout(), true);
    assert.equal(calls, 1, 'Repeated frame/layout checks reuse one MediaQueryList');
  } finally {
    for (const [name, descriptor] of [['innerWidth', previousWidth], ['matchMedia', previousMatchMedia]]) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
