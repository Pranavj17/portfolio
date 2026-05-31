const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public/journey3d/nearest.js'), 'utf8');
eval(SRC.replace(/export\s*\{[^}]*\}\s*;?/, '') +
  '\nglobalThis.J3D_NEAREST = { nearestInView, normalize, length, dot };');

const N = () => globalThis.J3D_NEAREST;

test('returns the nearest target that is in front and in range', () => {
  const cam = { x: 0, y: 0, z: 0 };
  const fwd = { x: 0, y: 0, z: -1 };
  const targets = [
    { x: 0, y: 0, z: -2.5 }, // in front, in range, far
    { x: 0, y: 0, z: -1.0 }, // in front, in range, near  ← expected
    { x: 0, y: 0, z: 5.0 },  // behind
  ];
  const out = N().nearestInView(cam, fwd, targets, { range: 3 });
  assert.ok(out);
  assert.strictEqual(out.index, 1);
  assert.ok(Math.abs(out.distance - 1.0) < 1e-9);
});

test('ignores targets beyond range', () => {
  const out = N().nearestInView(
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 },
    [{ x: 0, y: 0, z: -10 }], { range: 3 });
  assert.strictEqual(out, null);
});

test('ignores targets behind the camera (outside view cone)', () => {
  const out = N().nearestInView(
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 },
    [{ x: 0, y: 0, z: 2 }], { range: 3 });
  assert.strictEqual(out, null);
});

test('ignores targets to the side beyond the cone', () => {
  // straight to the right, 90° off forward → dot 0 < minDot 0.5 → excluded
  const out = N().nearestInView(
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 },
    [{ x: 1, y: 0, z: 0 }], { range: 3, minDot: 0.5 });
  assert.strictEqual(out, null);
});

test('a target inside the cone but off-axis is accepted', () => {
  // forward -z, target slightly left and well ahead → within 60° cone
  const out = N().nearestInView(
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 },
    [{ x: -0.4, y: 0, z: -2 }], { range: 3, minDot: 0.5 });
  assert.ok(out);
  assert.strictEqual(out.index, 0);
});

test('forward need not be normalised', () => {
  const out = N().nearestInView(
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -10 }, // unnormalised forward
    [{ x: 0, y: 0, z: -1 }], { range: 3 });
  assert.ok(out);
  assert.strictEqual(out.index, 0);
});

test('empty target list returns null', () => {
  assert.strictEqual(N().nearestInView({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, []), null);
});

test('normalize of zero vector is zero (no NaN)', () => {
  assert.deepStrictEqual(N().normalize({ x: 0, y: 0, z: 0 }), { x: 0, y: 0, z: 0 });
});
