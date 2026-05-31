const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public/journey3d/state.js'), 'utf8');
eval(SRC.replace(/export\s*\{[^}]*\}\s*;?/, '') +
  '\nglobalThis.J3D_STATE = { STORAGE_KEY, emptyState, normalizeState, loadState, ' +
  'saveState, markVisited, markMemorySeen, hasVisited, hasSeenMemory, nextUnvisited };');

const S = () => globalThis.J3D_STATE;

function mockStorage(seed) {
  const store = Object.assign({}, seed);
  return {
    _store: store,
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
  };
}

test('uses the journey3d storage key', () => {
  assert.strictEqual(S().STORAGE_KEY, 'journey3d');
});

test('emptyState is a clean v3 record', () => {
  assert.deepStrictEqual(S().emptyState(), { v: 3, visited: [], memoriesSeen: [] });
});

test('loadState on empty storage returns empty state', () => {
  assert.deepStrictEqual(S().loadState(mockStorage()), { v: 3, visited: [], memoriesSeen: [] });
});

test('loadState reads and dedupes a stored blob', () => {
  const st = mockStorage({ journey3d: JSON.stringify({ v: 3, visited: ['itics', 'itics', 'cmr'], memoriesSeen: ['itics:football-match'] }) });
  const out = S().loadState(st);
  assert.deepStrictEqual(out.visited, ['itics', 'cmr']);
  assert.deepStrictEqual(out.memoriesSeen, ['itics:football-match']);
});

test('loadState tolerates a corrupt blob', () => {
  const st = mockStorage({ journey3d: '{not json' });
  assert.deepStrictEqual(S().loadState(st), { v: 3, visited: [], memoriesSeen: [] });
});

test('saveState writes normalised JSON to the key', () => {
  const st = mockStorage();
  S().saveState(st, { v: 3, visited: ['cmr', 'cmr'], memoriesSeen: [] });
  assert.deepStrictEqual(JSON.parse(st._store.journey3d), { v: 3, visited: ['cmr'], memoriesSeen: [] });
});

test('markVisited adds a chapter once (immutably)', () => {
  const a = S().emptyState();
  const b = S().markVisited(a, 'itics');
  const c = S().markVisited(b, 'itics'); // idempotent
  assert.deepStrictEqual(a.visited, []); // original untouched
  assert.deepStrictEqual(b.visited, ['itics']);
  assert.deepStrictEqual(c.visited, ['itics']);
});

test('markMemorySeen keys by chapter:beat and dedupes', () => {
  let s = S().emptyState();
  s = S().markMemorySeen(s, 'itics', 'football-match');
  s = S().markMemorySeen(s, 'itics', 'football-match');
  s = S().markMemorySeen(s, 'cmr', 'mock-test');
  assert.deepStrictEqual(s.memoriesSeen, ['itics:football-match', 'cmr:mock-test']);
  assert.strictEqual(S().hasSeenMemory(s, 'itics', 'football-match'), true);
  assert.strictEqual(S().hasSeenMemory(s, 'cmr', 'study-lamp'), false);
});

test('hasVisited reflects visited list', () => {
  const s = S().markVisited(S().emptyState(), 'sakha');
  assert.strictEqual(S().hasVisited(s, 'sakha'), true);
  assert.strictEqual(S().hasVisited(s, 'now'), false);
});

test('nextUnvisited returns the first unvisited id, then null when all done', () => {
  const order = ['itics', 'cmr', 'college'];
  let s = S().emptyState();
  assert.strictEqual(S().nextUnvisited(s, order), 'itics');
  s = S().markVisited(s, 'itics');
  assert.strictEqual(S().nextUnvisited(s, order), 'cmr');
  s = S().markVisited(s, 'cmr');
  s = S().markVisited(s, 'college');
  assert.strictEqual(S().nextUnvisited(s, order), null);
});
