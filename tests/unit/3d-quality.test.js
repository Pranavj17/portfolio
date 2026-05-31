const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public/journey3d/quality.js'), 'utf8');
eval(SRC.replace(/export\s*\{[^}]*\}\s*;?/, '') +
  '\nglobalThis.J3D_QUALITY = { pickTier, tierSettings };');

const Q = () => globalThis.J3D_QUALITY;

test('capable desktop GPU → high', () => {
  assert.strictEqual(Q().pickTier({ maxTextureSize: 16384, deviceMemory: 8, isMobile: false, dpr: 2 }), 'high');
});

test('modest desktop GPU → medium', () => {
  assert.strictEqual(Q().pickTier({ maxTextureSize: 4096, deviceMemory: 8, isMobile: false, dpr: 1 }), 'medium');
});

test('strong mobile → medium (never high)', () => {
  assert.strictEqual(Q().pickTier({ maxTextureSize: 16384, deviceMemory: 6, isMobile: true, dpr: 3 }), 'medium');
});

test('weak mobile → low', () => {
  assert.strictEqual(Q().pickTier({ maxTextureSize: 4096, deviceMemory: 3, isMobile: true, dpr: 2 }), 'low');
});

test('tiny texture cap → low regardless of platform', () => {
  assert.strictEqual(Q().pickTier({ maxTextureSize: 2048, deviceMemory: 8, isMobile: false, dpr: 1 }), 'low');
});

test('very low memory → low', () => {
  assert.strictEqual(Q().pickTier({ maxTextureSize: 16384, deviceMemory: 2, isMobile: false, dpr: 1 }), 'low');
});

test('missing deviceMemory is treated as ample', () => {
  assert.strictEqual(Q().pickTier({ maxTextureSize: 16384, isMobile: false, dpr: 1 }), 'high');
});

test('tierSettings caps mobile pixelRatio at 1.5 even on high inputs', () => {
  const s = Q().tierSettings('high', 3, true);
  assert.ok(s.pixelRatio <= 1.5, 'mobile dpr cap');
});

test('tierSettings high desktop allows up to dpr 2 and enables shadows', () => {
  const s = Q().tierSettings('high', 2, false);
  assert.strictEqual(s.pixelRatio, 2);
  assert.strictEqual(s.shadows, true);
  assert.strictEqual(s.shadowMapSize, 2048);
});

test('tierSettings low disables shadows', () => {
  const s = Q().tierSettings('low', 2, false);
  assert.strictEqual(s.shadows, false);
});
