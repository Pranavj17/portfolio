const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/parallel-park.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.PP = MINIGAMES.vwgt;');
const game = globalThis.PP;

test('parallel-park is registered under vwgt', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'parallel-park');
});

test('init returns car at center, 0 wallTouches', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.carX, 0.5);
  assert.strictEqual(state.wallTouches, 0);
});

test('SWIPE-H (dir +1, right) moves car right', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.onGesture(state, { kind: 'SWIPE-H', dir: 1 }, { offsetX: 180, offsetY: 120 });
  assert.ok(state.carX > 0.5);
});

test('SWIPE-H (dir -1, left) moves car left', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.onGesture(state, { kind: 'SWIPE-H', dir: -1 }, { offsetX: 180, offsetY: 120 });
  assert.ok(state.carX < 0.5);
});

test('hitting wall (carX <= 0 or >= 1) increments wallTouches', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  for (let i = 0; i < 20; i++)
    game.onGesture(state, { kind: 'SWIPE-H', dir: 1 }, { offsetX: 180, offsetY: 120 });
  assert.ok(state.wallTouches > 0);
});

test('score 100 with 0 wallTouches, lower with more', () => {
  const state = game.init({}, {});
  state.wallTouches = 0;
  const clean = game.score(state);
  state.wallTouches = 5;
  const messy = game.score(state);
  assert.ok(clean > messy);
  assert.strictEqual(clean, 100);
  assert.ok(messy >= 50);
});

test('scoreLabel formats N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
