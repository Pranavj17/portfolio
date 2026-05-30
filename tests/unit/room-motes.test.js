const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/room/motes.js'), 'utf8');
eval(SRC + '\nglobalThis.Motes = { makeMotes, stepMotes };');
// Access via namespace (not destructured const) — see store.test.js rationale.
const M = globalThis.Motes;

// deterministic rng for reproducible tests
function seq(values) { let i = 0; return () => values[i++ % values.length]; }

test('makeMotes builds N motes with the expected fields', () => {
  const motes = M.makeMotes(5, seq([0.5]));
  assert.strictEqual(motes.length, 5);
  for (const m of motes) {
    assert.ok(m.x >= 0 && m.x <= 1);
    assert.ok(m.y >= 0 && m.y <= 1);
    assert.ok(m.vy > 0);
    assert.ok(typeof m.a === 'number');
  }
});

test('stepMotes raises a mote over time', () => {
  const m = { x: 0.5, y: 0.5, vy: 0.1, sway: 1, amp: 0.01, phase: 0, a: 0.3, r: 1 };
  M.stepMotes([m], 1000);   // 1s
  assert.ok(Math.abs(m.y - 0.4) < 1e-9);
  assert.ok(Math.abs(m.phase - 1) < 1e-9);
});

test('stepMotes wraps a mote that floats off the top', () => {
  const m = { x: 0.5, y: 0.0, vy: 0.1, sway: 1, amp: 0.01, phase: 0, a: 0.3, r: 1 };
  M.stepMotes([m], 1000);   // y -> -0.1, below -0.05 threshold -> wraps
  assert.ok(m.y > 1, `expected wrap to bottom, got ${m.y}`);
});
