const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// public/journey3d/data.js is an ES module (trailing `export { ... }`). We can't
// eval `export`, so strip that line, then expose the declarations via globalThis.
// Inline globalThis access — do NOT destructure after eval (TDZ).
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public/journey3d/data.js'), 'utf8');
eval(SRC.replace(/export\s*\{[^}]*\}\s*;?/, '') +
  '\nglobalThis.J3D_DATA = { CHAPTERS, chapterIds, chapterById, totalMemoryCount };');

const EXPECTED_ORDER = ['itics', 'cmr', 'college', 'fever104', 'sakha', 'scripbox', 'vwgt', 'now'];

test('there are exactly 8 chapters in chronological order', () => {
  assert.strictEqual(globalThis.J3D_DATA.CHAPTERS.length, 8);
  assert.deepStrictEqual(globalThis.J3D_DATA.chapterIds(), EXPECTED_ORDER);
});

test('every chapter has label, years, palette, beats, culmination', () => {
  for (const c of globalThis.J3D_DATA.CHAPTERS) {
    assert.ok(typeof c.id === 'string' && c.id.length, 'id');
    assert.ok(typeof c.label === 'string' && c.label.length, 'label ' + c.id);
    assert.ok(typeof c.years === 'string' && c.years.length, 'years ' + c.id);
    assert.ok(c.palette && typeof c.palette.accent === 'string', 'palette ' + c.id);
    assert.ok(Array.isArray(c.beats) && c.beats.length >= 1, 'beats ' + c.id);
    assert.ok(typeof c.culmination === 'string' && c.culmination.length, 'culmination ' + c.id);
  }
});

test('display labels match the spec doorway order', () => {
  const labels = globalThis.J3D_DATA.CHAPTERS.map(c => c.label);
  assert.deepStrictEqual(labels, [
    'ITICS', 'CMR NATIONAL', 'D.S.C.E.', 'FEVER 104 FM',
    'SAKHA GLOBAL', 'SCRIPBOX', 'THE GT', 'NOW',
  ]);
});

test('every beat carries id, title, lore, icon', () => {
  for (const c of globalThis.J3D_DATA.CHAPTERS) {
    for (const b of c.beats) {
      assert.ok(typeof b.id === 'string' && b.id.length, 'beat id in ' + c.id);
      assert.ok(typeof b.title === 'string' && b.title.length, 'beat title ' + b.id);
      assert.ok(typeof b.lore === 'string' && b.lore.length, 'beat lore ' + b.id);
      assert.ok(typeof b.icon === 'string' && b.icon.length, 'beat icon ' + b.id);
    }
  }
});

test('transcribed content matches the v1/v2 source verbatim (spot checks)', () => {
  const itics = globalThis.J3D_DATA.chapterById('itics');
  const football = itics.beats.find(b => b.id === 'football-match');
  assert.strictEqual(football.title, 'Football match');
  assert.strictEqual(football.lore, 'Intra and inter-school competitions. Played striker.');
  assert.strictEqual(football.icon, '⚽');

  const gt = globalThis.J3D_DATA.chapterById('vwgt');
  assert.strictEqual(gt.label, 'THE GT');
  assert.ok(gt.culmination.startsWith('1.5 TSI · turbo · november 16.'));

  // college = DSCE; ensure the internal id is preserved but display is D.S.C.E.
  const dsce = globalThis.J3D_DATA.chapterById('college');
  assert.strictEqual(dsce.label, 'D.S.C.E.');
});

test('chapterById returns null for unknown ids', () => {
  assert.strictEqual(globalThis.J3D_DATA.chapterById('nope'), null);
});

test('totalMemoryCount sums all beats', () => {
  const sum = globalThis.J3D_DATA.CHAPTERS.reduce((n, c) => n + c.beats.length, 0);
  assert.strictEqual(globalThis.J3D_DATA.totalMemoryCount(), sum);
});
