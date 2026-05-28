const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/debug-the-pr.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.DBG = MINIGAMES.scripbox;');
const game = globalThis.DBG;

test('debug-the-pr is registered under scripbox', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'debug-the-pr');
  assert.strictEqual(game.label, 'SCRIPBOX · DEBUG');
});

test('init returns state with 4 lines, no pick, bugLine in [0,3]', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.lines.length, 4);
  assert.strictEqual(state.pickedIdx, null);
  assert.ok(state.bugLine >= 0 && state.bugLine <= 3);
});

test('onGesture(TAP) within line area sets pickedIdx', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 100, offsetY: 100 });   // line ~1
  assert.ok(state.pickedIdx === 1);
});

test('subsequent taps overwrite pickedIdx (caller decides one-shot)', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 100, offsetY: 50 });
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 100, offsetY: 180 });
  assert.strictEqual(state.pickedIdx, 3);
});

test('score is 100 when bug line picked', () => {
  const state = game.init({}, {});
  state.bugLine = 2;
  state.pickedIdx = 2;
  state.elapsedMs = 1000;
  assert.strictEqual(game.score(state), 100);
});

test('score floor 50 when nothing picked', () => {
  const state = game.init({}, {});
  state.pickedIdx = null;
  assert.strictEqual(game.score(state), 50);
});

test('score is reduced when wrong line picked', () => {
  const state = game.init({}, {});
  state.bugLine = 2;
  state.pickedIdx = 0;
  state.elapsedMs = 1000;
  const wrong = game.score(state);
  state.pickedIdx = 2;
  const right = game.score(state);
  assert.ok(right > wrong);
});

test('scoreLabel formats as N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
