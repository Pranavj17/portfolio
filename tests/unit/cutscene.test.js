const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/cutscene.js'), 'utf8');
// Stub `window`/`CUTSCENES` so the source's top-level lookups don't blow up;
// the helper we test only reads matchMedia, so the rest is irrelevant.
eval(`
  const CUTSCENES = { __placeholder: { lines: ['x'], durationMs: 1000 } };
  const window = { matchMedia: () => ({ matches: false }) };
  ${SRC}
  globalThis.Cutscene = { isReducedMotion };
`);

test('isReducedMotion returns false when matchMedia says no', () => {
  const stubWin = { matchMedia: () => ({ matches: false }) };
  assert.strictEqual(globalThis.Cutscene.isReducedMotion(stubWin), false);
});

test('isReducedMotion returns true when matchMedia says yes', () => {
  const stubWin = { matchMedia: () => ({ matches: true }) };
  assert.strictEqual(globalThis.Cutscene.isReducedMotion(stubWin), true);
});

test('isReducedMotion returns false when matchMedia is missing', () => {
  const stubWin = {};
  assert.strictEqual(globalThis.Cutscene.isReducedMotion(stubWin), false);
});
