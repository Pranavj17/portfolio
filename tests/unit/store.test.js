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
  assert.deepStrictEqual(store.getChapter('cmr'),
    { phase: 'unseen', score: null, npcChoice: null, roomVisited: false, memoriesPlayed: [] });
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

test('setScore preserves phase and npcChoice across calls', () => {
  const store = globalThis.Store.createChapterStore(mockStorage());
  store.send('cmr', 'ENTER');               // phase → cutscene
  store.setNpcChoice('cmr', 2);
  store.setScore('cmr', 78);
  assert.deepStrictEqual(store.getChapter('cmr'),
    { phase: 'cutscene', score: 78, npcChoice: 2, roomVisited: false, memoriesPlayed: [] });
});

test('markRoomVisited flips the flag and persists', () => {
  const store = globalThis.Store.createChapterStore(mockStorage());
  assert.strictEqual(store.getChapter('cmr').roomVisited, false);
  store.markRoomVisited('cmr');
  assert.strictEqual(store.getChapter('cmr').roomVisited, true);
});

test('markMemoryPlayed appends unique beat ids', () => {
  const store = globalThis.Store.createChapterStore(mockStorage());
  store.markMemoryPlayed('cmr', 'study-lamp');
  store.markMemoryPlayed('cmr', 'study-lamp');   // dupe ignored
  store.markMemoryPlayed('cmr', 'mock-test');
  assert.deepStrictEqual(store.getChapter('cmr').memoriesPlayed, ['study-lamp', 'mock-test']);
});

test('room fields survive a phase transition', () => {
  const store = globalThis.Store.createChapterStore(mockStorage());
  store.markMemoryPlayed('cmr', 'study-lamp');
  store.send('cmr', 'ENTER');
  assert.deepStrictEqual(store.getChapter('cmr').memoriesPlayed, ['study-lamp']);
  assert.strictEqual(store.getChapter('cmr').phase, 'cutscene');
});
