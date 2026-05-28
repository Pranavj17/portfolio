const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/live-mix.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.LM = MINIGAMES.fever104;');
const game = globalThis.LM;

test('live-mix is registered under fever104', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'live-mix');
});

test('init returns 3 faders + 3 targets, all faders at 0.5 (mid)', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.faders.length, 3);
  assert.strictEqual(state.targets.length, 3);
  for (const f of state.faders) assert.strictEqual(f, 0.5);
});

test('SWIPE-V (dir -1, up) on fader column raises that fader', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.onGesture(state, { kind: 'SWIPE-V', dir: -1 }, { offsetX: 180, offsetY: 100 });
  assert.ok(state.faders[1] > 0.5);
});

test('SWIPE-V (dir +1, down) lowers fader', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.onGesture(state, { kind: 'SWIPE-V', dir: 1 }, { offsetX: 180, offsetY: 100 });
  assert.ok(state.faders[1] < 0.5);
});

test('faders clamped to [0, 1]', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  for (let i = 0; i < 10; i++)
    game.onGesture(state, { kind: 'SWIPE-V', dir: -1 }, { offsetX: 180, offsetY: 100 });
  assert.ok(state.faders[1] <= 1.0);
  assert.ok(state.faders[1] >= 0);
});

test('score 100 when all faders match targets exactly', () => {
  const state = game.init({}, {});
  for (let i = 0; i < 3; i++) state.faders[i] = state.targets[i];
  assert.strictEqual(game.score(state), 100);
});

test('score floor 50 with worst-case mismatch', () => {
  const state = game.init({}, {});
  for (let i = 0; i < 3; i++) state.faders[i] = (state.targets[i] > 0.5 ? 0 : 1);
  assert.ok(game.score(state) >= 50);
});

test('scoreLabel formats N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
