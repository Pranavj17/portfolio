const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Order matters: persistence + phase first, then store
const ROOT = path.join(__dirname, '..', '..');
const load = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
eval(
  load('src/journey/state/persistence.js') + '\n' +
  load('src/journey/state/phase.js') + '\n' +
  load('src/journey/state/store.js') + '\n' +
  'globalThis.Store = { createChapterStore };'
);

// Note: cannot destructure `createChapterStore` into a top-level `const` here —
// function decls inside direct eval bleed into the enclosing CJS module scope,
// causing TDZ collisions with any same-named top-level `const`. Access via
// `globalThis.Store.createChapterStore` (same pattern as phase.test.js).

function mockStorage() {
  const m = {};
  return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, _raw: m };
}

test('createChapterStore returns empty chapters when storage is blank', () => {
  const store = globalThis.Store.createChapterStore(mockStorage());
  assert.deepStrictEqual(store.getChapter('cmr'), { phase: 'unseen', score: null, npcChoice: null });
});

test('store.send(id, ENTER) moves unseen → cutscene and persists', () => {
  const s = mockStorage();
  const store = globalThis.Store.createChapterStore(s);
  store.send('cmr', 'ENTER');
  assert.strictEqual(store.getChapter('cmr').phase, 'cutscene');
  const persisted = JSON.parse(s._raw.journey);
  assert.strictEqual(persisted.chapters.cmr.phase, 'cutscene');
});

test('store.setScore(id, n) writes through', () => {
  const s = mockStorage();
  const store = globalThis.Store.createChapterStore(s);
  store.send('cmr', 'ENTER');
  store.setScore('cmr', 78);
  assert.strictEqual(store.getChapter('cmr').score, 78);
});

test('store.setNpcChoice(id, idx) writes through', () => {
  const s = mockStorage();
  const store = globalThis.Store.createChapterStore(s);
  store.setNpcChoice('cmr', 1);
  assert.strictEqual(store.getChapter('cmr').npcChoice, 1);
});
