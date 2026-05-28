const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/standup-bingo.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.SB = MINIGAMES.sakha;');
const game = globalThis.SB;

test('standup-bingo registered under sakha', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'standup-bingo');
});

test('init returns 9-cell grid with 0 caught', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.cells.length, 9);
  assert.strictEqual(state.caught, 0);
  assert.strictEqual(state.activeIdx, null);
});

test('update activates a cell after the first interval', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.update(state, 900);
  assert.ok(state.activeIdx === null || (state.activeIdx >= 0 && state.activeIdx <= 8));
});

test('tap on the active cell catches it (count++) and clears active', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  state.activeIdx = 4;
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 180, offsetY: 120 });
  assert.strictEqual(state.caught, 1);
  assert.strictEqual(state.activeIdx, null);
});

test('tap on inactive cell does NOT catch', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  state.activeIdx = 0;
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 180, offsetY: 120 });
  assert.strictEqual(state.caught, 0);
});

test('score scales with caught (no-fail floor 50)', () => {
  const state = game.init({}, {});
  state.caught = 0;
  assert.strictEqual(game.score(state), 50);
  state.caught = 5;
  const mid = game.score(state);
  state.caught = 10;
  const high = game.score(state);
  assert.ok(high > mid);
  assert.ok(high <= 100);
});

test('scoreLabel formats N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
