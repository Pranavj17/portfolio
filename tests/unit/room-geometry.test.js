const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/room/geometry.js'), 'utf8');
eval(SRC + '\nglobalThis.Geo = { parallaxFactor, roomLayout, propScreenRect, hitTestProps, clampUnit, lerp, easeOutCubic };');
// NOTE: access via the namespace object — NOT `const { parallaxFactor } = ...`.
// Direct-eval function declarations bleed into this CJS module scope and would
// collide (TDZ) with any same-named top-level const. Same pattern as store.test.js.
const G = globalThis.Geo;

test('parallaxFactor: far=0.25, near=1.0, monotonic', () => {
  assert.strictEqual(G.parallaxFactor(0), 0.25);
  assert.strictEqual(G.parallaxFactor(1), 1.0);
  assert.ok(G.parallaxFactor(0.5) > G.parallaxFactor(0));
});

test('clampUnit holds [-1,1]', () => {
  assert.strictEqual(G.clampUnit(-3), -1);
  assert.strictEqual(G.clampUnit(3), 1);
  assert.strictEqual(G.clampUnit(0.4), 0.4);
});

test('lerp + easeOutCubic basics', () => {
  assert.strictEqual(G.lerp(0, 10, 0.5), 5);
  assert.strictEqual(G.easeOutCubic(0), 0);
  assert.strictEqual(G.easeOutCubic(1), 1);
  assert.ok(G.easeOutCubic(0.5) > 0.5);   // fast then slow
});

test('a prop at room center maps to canvas center with no camera pan', () => {
  const layout = G.roomLayout(720, 480, { x: 0, y: 0 });
  const r = G.propScreenRect({ x: 500, y: 300, depth: 0.5 }, layout);
  assert.ok(Math.abs(r.cx - 360) < 0.001);
  assert.ok(Math.abs(r.cy - 240) < 0.001);
});

test('camera pan shifts near props more than far props', () => {
  const panned = G.roomLayout(720, 480, { x: 1, y: 0 });
  const center = G.roomLayout(720, 480, { x: 0, y: 0 });
  const nearShift = Math.abs(
    G.propScreenRect({ x: 500, y: 300, depth: 1 }, panned).cx -
    G.propScreenRect({ x: 500, y: 300, depth: 1 }, center).cx);
  const farShift = Math.abs(
    G.propScreenRect({ x: 500, y: 300, depth: 0 }, panned).cx -
    G.propScreenRect({ x: 500, y: 300, depth: 0 }, center).cx);
  assert.ok(nearShift > farShift, `near ${nearShift} should exceed far ${farShift}`);
});

test('hitTestProps returns the prop under the tap', () => {
  const layout = G.roomLayout(720, 480, { x: 0, y: 0 });
  const props = [{ id: 'lamp', x: 500, y: 300, depth: 0.6, w: 90, h: 90, kind: 'memory' }];
  const hit = G.hitTestProps(props, 360, 240, layout);
  assert.strictEqual(hit && hit.id, 'lamp');
});

test('hitTestProps returns null when tapping empty space', () => {
  const layout = G.roomLayout(720, 480, { x: 0, y: 0 });
  const props = [{ id: 'lamp', x: 100, y: 100, depth: 0.5, w: 40, h: 40, kind: 'memory' }];
  assert.strictEqual(G.hitTestProps(props, 700, 460, layout), null);
});

test('hitTestProps: nearer prop wins an overlap', () => {
  const layout = G.roomLayout(720, 480, { x: 0, y: 0 });
  const props = [
    { id: 'far',  x: 500, y: 300, depth: 0.1, w: 120, h: 120, kind: 'memory' },
    { id: 'near', x: 500, y: 300, depth: 0.9, w: 120, h: 120, kind: 'memory' },
  ];
  assert.strictEqual(G.hitTestProps(props, 360, 240, layout).id, 'near');
});

test('hitTestProps ignores decor', () => {
  const layout = G.roomLayout(720, 480, { x: 0, y: 0 });
  const props = [{ id: 'rug', x: 500, y: 300, depth: 0.5, w: 200, h: 200, kind: 'decor' }];
  assert.strictEqual(G.hitTestProps(props, 360, 240, layout), null);
});
