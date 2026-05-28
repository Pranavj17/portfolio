const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/cad-snap.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.CS = MINIGAMES.college;');
const game = globalThis.CS;

test('cad-snap is registered under college', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'cad-snap');
});

test('init returns 3 parts and 3 slots, all parts un-snapped', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.parts.length, 3);
  assert.strictEqual(state.slots.length, 3);
  assert.strictEqual(state.parts.filter(p => p.snapped).length, 0);
});

test('snapPart(idx) sets snapped=true and aligns to slot', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.snapPart(state, 0);
  assert.ok(state.parts[0].snapped);
  assert.strictEqual(state.parts[0].x, state.slots[0].x);
  assert.strictEqual(state.parts[0].y, state.slots[0].y);
});

test('tryPlace(idx) snaps if part is within snap-distance of matching slot', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  state.parts[0].x = state.slots[0].x + 10;
  state.parts[0].y = state.slots[0].y - 10;
  const ok = game.tryPlace(state, 0);
  assert.strictEqual(ok, true);
  assert.ok(state.parts[0].snapped);
});

test('tryPlace returns false if far from all slots', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  state.parts[0].x = 9999;
  state.parts[0].y = 9999;
  const ok = game.tryPlace(state, 0);
  assert.strictEqual(ok, false);
  assert.strictEqual(state.parts[0].snapped, false);
});

test('score 50 with 0 snapped, scales to 100 with all 3', () => {
  const state = game.init({}, {});
  assert.strictEqual(game.score(state), 50);
  game.snapPart(state, 0);
  game.snapPart(state, 1);
  game.snapPart(state, 2);
  assert.strictEqual(game.score(state), 100);
});

test('scoreLabel formats N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
