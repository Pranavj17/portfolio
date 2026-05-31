const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Order matters: persistence first (store calls loadJourneyState), then store.
const ROOT = path.join(__dirname, '..', '..');
const load = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
eval(
  load('src/journey/state/persistence.js') + '\n' +
  load('src/journey/state/store.js') + '\n' +
  'globalThis.Store = { createChapterStore };'
);

// Note: cannot destructure `createChapterStore` into a top-level `const` here —
// function decls inside direct eval bleed into the enclosing CJS module scope,
// causing TDZ collisions with any same-named top-level `const`. Access via
// `globalThis.Store.createChapterStore` (same pattern as room-geometry.test.js).

function mockStorage() {
  const m = {};
  return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, _raw: m };
}

test('getChapter returns the room-as-milestone defaults when storage is blank', () => {
  const store = globalThis.Store.createChapterStore(mockStorage());
  assert.deepStrictEqual(store.getChapter('cmr'),
    { visited: false, complete: false, memoriesPlayed: [], score: null });
});

test('markVisited flips visited (not complete) and persists', () => {
  const s = mockStorage();
  const store = globalThis.Store.createChapterStore(s);
  store.markVisited('cmr');
  assert.strictEqual(store.getChapter('cmr').visited, true);
  assert.strictEqual(store.getChapter('cmr').complete, false);
  const persisted = JSON.parse(s._raw.journey);
  assert.strictEqual(persisted.chapters.cmr.visited, true);
});

test('markComplete sets visited + complete and persists', () => {
  const s = mockStorage();
  const store = globalThis.Store.createChapterStore(s);
  store.markComplete('cmr');
  assert.strictEqual(store.getChapter('cmr').visited, true);
  assert.strictEqual(store.getChapter('cmr').complete, true);
  const persisted = JSON.parse(s._raw.journey);
  assert.strictEqual(persisted.chapters.cmr.complete, true);
});

test('markMemoryPlayed appends unique beat ids', () => {
  const store = globalThis.Store.createChapterStore(mockStorage());
  store.markMemoryPlayed('cmr', 'study-lamp');
  store.markMemoryPlayed('cmr', 'study-lamp');   // dupe ignored
  store.markMemoryPlayed('cmr', 'mock-test');
  assert.deepStrictEqual(store.getChapter('cmr').memoriesPlayed, ['study-lamp', 'mock-test']);
});

test('setScore writes through', () => {
  const store = globalThis.Store.createChapterStore(mockStorage());
  store.setScore('cmr', 78);
  assert.strictEqual(store.getChapter('cmr').score, 78);
});

test('fields survive across mutations (no clobbering)', () => {
  const store = globalThis.Store.createChapterStore(mockStorage());
  store.markMemoryPlayed('cmr', 'study-lamp');
  store.setScore('cmr', 78);
  store.markComplete('cmr');
  assert.deepStrictEqual(store.getChapter('cmr'),
    { visited: true, complete: true, memoriesPlayed: ['study-lamp'], score: 78 });
});

test('an old phase-shaped v2 record migrates to the milestone shape on load', () => {
  const s = mockStorage();
  s._raw.journey = JSON.stringify({
    v: 2,
    chapters: { cmr: { phase: 'complete', score: 60, npcChoice: 1, memoriesPlayed: ['mock-test'] } },
  });
  const store = globalThis.Store.createChapterStore(s);
  assert.deepStrictEqual(store.getChapter('cmr'),
    { visited: true, complete: true, memoriesPlayed: ['mock-test'], score: 60 });
});
