const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/mock-test.js'), 'utf8');
// Provide a global MINIGAMES so the registration assignment works
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.MockTest = MINIGAMES.cmr;');
const game = globalThis.MockTest;

test('mock-test is registered under cmr', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'mock-test');
});

test('init returns a state with 3 options and pickedIdx null', () => {
  const state = game.init({}, {});
  assert.strictEqual(state.options.length, 3);
  assert.strictEqual(state.pickedIdx, null);
});

test('onGesture(TAP near option idx) sets pickedIdx', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  // Tap event at canvas x=180 (middle option, index 1)
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 180, offsetY: 120 });
  assert.strictEqual(state.pickedIdx, 1);
});

test('score is high when picked fast', () => {
  const state = game.init({}, {});
  state.pickedIdx = 0;
  state.elapsedMs = 1000;            // picked in 1s
  assert.ok(game.score(state) >= 80);
});

test('score is low when never picked', () => {
  const state = game.init({}, {});
  state.pickedIdx = null;
  state.elapsedMs = 8000;
  assert.strictEqual(game.score(state), 50);   // no-fail floor
});
