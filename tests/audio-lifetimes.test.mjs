import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
function runIsolated(source) {
  const result = spawnSync(process.execPath, ['--expose-gc', '--input-type=module', '-e', source], {
    cwd: root, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}

test('record soundtrack cancels pending starts and releases its audio graph on disposal', () => {
  const result = runIsolated(`
    import { readFileSync } from 'node:fs';
    const module = readFileSync('japan-room.js', 'utf8');
    const source = module.slice(module.indexOf('function createSoundtrack()'), module.indexOf('\\nexport async function createJapanRoom'));
    const unhandled = [], contexts = [], audios = [], timers = new Map();
    process.on('unhandledRejection', error => unhandled.push(error.message));
    let timerID = 0;
    class Audio {
      constructor() { this.dataset = {}; this.paused = true; this.currentTime = 0; this.duration = 20; this.playCalls = 0; audios.push(this); }
      play() { this.playCalls++; this.paused = false; return Promise.resolve(); }
      pause() { this.paused = true; }
      removeAttribute() {} load() {} remove() {} addEventListener() {} removeEventListener() {}
    }
    const node = () => ({
      connect() { return this; }, disconnect() { this.disconnected = true; }, start() {}, stop() {},
      gain: { cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} },
    });
    class Context {
      constructor() { this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 100; this.closeCalls = 0; this.suspendsAfterClose = 0; contexts.push(this); }
      createGain() { return this.gain = node(); }
      createMediaElementSource() { return this.media = node(); }
      createBufferSource() { return node(); }
      createBuffer(_, size) { return { getChannelData: () => new Float32Array(size) }; }
      resume() {
        if (this.state === 'closed') return Promise.reject(new Error('resume on closed context'));
        return new Promise(resolve => { this.release = () => { if (this.state !== 'closed') this.state = 'running'; resolve(); }; });
      }
      suspend() {
        if (this.state === 'closed') { this.suspendsAfterClose++; return Promise.reject(new Error('suspend on closed context')); }
        this.state = 'suspended'; return Promise.resolve();
      }
      close() { this.closeCalls++; this.state = 'closed'; return Promise.resolve(); }
    }
    const create = new Function('Audio', 'window', 'document', 'THREE', 'setTimeout', 'clearTimeout', source + ';return createSoundtrack;')(
      Audio, { AudioContext: Context }, { body: { append() {} } }, { MathUtils: { clamp: (n,a,b) => Math.max(a,Math.min(n,b)) } },
      callback => { timers.set(++timerID, callback); return timerID; }, id => timers.delete(id),
    );
    const stopped = create(), stoppedStart = stopped.toggle(), first = contexts.at(-1);
    stopped.stop(); first.release(); await stoppedStart;
    const stoppedResult = { playing: stopped.playing, paused: audios.at(-1).paused, state: first.state };
    stopped.dispose();

    const disposed = create(), pending = disposed.toggle(), last = contexts.at(-1), audio = audios.at(-1);
    disposed.dispose(); last.release(); await pending;
    const callsBeforeReuse = audio.playCalls;
    let restarted;
    try { restarted = await disposed.toggle(); } catch (error) { restarted = error.message; }
    disposed.dispose();
    await new Promise(setImmediate);
    console.log(JSON.stringify({ stopped: stoppedResult, playing: disposed.playing, paused: audio.paused,
      restarted, playCallsAfterDisposal: audio.playCalls - callsBeforeReuse, timers: timers.size,
      closes: last.closeCalls, graphDisconnected: last.media.disconnected && last.gain.disconnected,
      suspendsAfterClose: last.suspendsAfterClose, unhandled }));
  `);
  assert.deepEqual(result, {
    stopped: { playing: false, paused: true, state: 'suspended' },
    playing: false, paused: true, restarted: false, playCallsAfterDisposal: 0,
    timers: 0, closes: 1, graphDisconnected: true, suspendsAfterClose: 0, unhandled: [],
  });
});

test('record player releases construction-only connectivity data while its controller remains live', () => {
  const result = runIsolated(`
    import { readFileSync } from 'node:fs';
    let source = readFileSync('record-player.js', 'utf8').replace(/import .*?;\\n/, '').replace('export function', 'function');
    const probes = {};
    globalThis.trackSetup = (name, value) => { probes[name] = new WeakRef(value); return value; };
    source = source.replace('const parents = []', 'const parents = globalThis.trackSetup("parents", [])')
      .replace('const bounds = new Map()', 'const bounds = globalThis.trackSetup("bounds", new Map())');
    class Vector {
      constructor(x=0,y=0,z=0) { Object.assign(this,{x,y,z}); }
      copy() { return this; } sub() { return this; } normalize() { return this; } toArray() { return [this.x,this.y,this.z]; }
    }
    class Group {
      constructor() { this.position = new Vector(); this.rotation = {}; this.quaternion = { setFromAxisAngle() {} }; }
      add() {}
    }
    const geometry = () => ({
      attributes: { position: { count: 9887, getX: i => i / 1000, getY: () => 0, getZ: () => 0 } },
      index: { count: (9887 - 2) * 3, getX: i => i % 3 === 0 ? 0 : Math.floor(i / 3) + i % 3 },
      clone: geometry, setIndex() {}, dispose() {},
    });
    const mesh = { geometry: geometry(), position: new Vector(), isMesh: true,
      clone() { return { position: new Vector() }; }, removeFromParent() {} };
    const arm = { traverse: callback => callback(mesh), add() {}, userData: {} };
    const make = new Function('THREE', source + ';return createRecordPlayer;')({ Vector3: Vector, Group });
    globalThis.controller = make({ getObjectByName: name => name === 'Cylinder005' ? arm : null });
    for (let i=0;i<20;i++) { await new Promise(setImmediate); global.gc(); }
    const retained = Object.fromEntries(Object.entries(probes).map(([name, ref]) => [name, !!ref.deref()]));
    console.log(JSON.stringify({ probes: Object.keys(probes), retained, live: !!controller.state }));
  `);
  assert.deepEqual(result, { probes: ['parents', 'bounds'], retained: { parents: false, bounds: false }, live: true });
});
