const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/ui/input.js'), 'utf8');
// NOTE: not destructuring after eval — see persistence/phase/store test files
// for the rationale (TDZ collision with the eval'd function declarations).
eval(SRC + '\nglobalThis.Input = { classifyGesture, canvasPoint };');

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

// --- canvasPoint: the fix for the broken mini-game hit-testing ---

test('canvasPoint maps a stretched-canvas click to backing-buffer space', () => {
  // 360x240 buffer displayed at 720x480 (2x). A click at the display centre
  // (360,240) must resolve to the buffer centre (180,120), not (360,240).
  const rect = { left: 0, top: 0, width: 720, height: 480 };
  const p = globalThis.Input.canvasPoint(rect, 360, 240, 360, 240);
  assert.strictEqual(p.x, 180);
  assert.strictEqual(p.y, 120);
});

test('canvasPoint subtracts the element page offset', () => {
  const rect = { left: 100, top: 50, width: 360, height: 240 };  // 1:1 scale
  const p = globalThis.Input.canvasPoint(rect, 360, 240, 130, 80);
  assert.strictEqual(p.x, 30);
  assert.strictEqual(p.y, 30);
});

test('canvasPoint is NaN-safe on a zero-size (hidden) canvas', () => {
  const rect = { left: 0, top: 0, width: 0, height: 0 };
  const p = globalThis.Input.canvasPoint(rect, 360, 240, 10, 10);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});
