const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/ui/input.js'), 'utf8');
// NOTE: not destructuring after eval — see persistence/phase/store test files
// for the rationale (TDZ collision with the eval'd function declarations).
eval(SRC + '\nglobalThis.Input = { classifyGesture };');

test('short stationary press is a TAP', () => {
  const out = globalThis.Input.classifyGesture({ dx: 2, dy: -1, durationMs: 80 });
  assert.strictEqual(out.kind, 'TAP');
});

test('long stationary press is a HOLD', () => {
  const out = globalThis.Input.classifyGesture({ dx: 4, dy: 3, durationMs: 600 });
  assert.strictEqual(out.kind, 'HOLD');
});

test('large vertical drag is SWIPE-V', () => {
  const out = globalThis.Input.classifyGesture({ dx: 5, dy: -80, durationMs: 200 });
  assert.strictEqual(out.kind, 'SWIPE-V');
  assert.strictEqual(out.dir, -1);  // up
});

test('large horizontal drag is SWIPE-H', () => {
  const out = globalThis.Input.classifyGesture({ dx: 120, dy: 4, durationMs: 200 });
  assert.strictEqual(out.kind, 'SWIPE-H');
  assert.strictEqual(out.dir, 1);   // right
});

test('vertical wins when both axes exceed threshold but |dy| > |dx|', () => {
  const out = globalThis.Input.classifyGesture({ dx: 50, dy: -90, durationMs: 200 });
  assert.strictEqual(out.kind, 'SWIPE-V');
});
