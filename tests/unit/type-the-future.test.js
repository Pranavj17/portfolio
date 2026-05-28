const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/type-the-future.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.TTF = MINIGAMES.now;');
const game = globalThis.TTF;

test('type-the-future is registered under now', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'type-the-future');
  assert.strictEqual(game.label, 'NOW · TYPE');
});

test('init returns state with 4-letter word and progress=0', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.word.length, 4);
  assert.strictEqual(state.progress, 0);
});

test('onGesture(TAP) on correct letter zone advances progress', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 40, offsetY: 200 });
  assert.strictEqual(state.progress, 1);
});

test('onGesture on wrong zone does not advance', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 320, offsetY: 200 });
  assert.strictEqual(state.progress, 0);
});

test('score scales with progress', () => {
  const state = game.init({}, {});
  state.progress = 0;
  const zero = game.score(state);
  state.progress = 4;
  const full = game.score(state);
  assert.ok(full > zero);
  assert.strictEqual(full, 100);
  assert.ok(zero >= 50);
});

test('scoreLabel formats as N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
