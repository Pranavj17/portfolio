const test = require('node:test');
const assert = require('node:assert');

// Load the source by reading it and evaluating into a sandbox so we can
// test pure functions without a browser. The file declares top-level
// consts/functions; we expose them via globalThis at the end of the file.
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/state/persistence.js'), 'utf8');
eval(SRC + '\nglobalThis.JourneyPersistence = { loadJourneyState, saveJourneyState, migrateJourneyState };');

test('migrateJourneyState backfills chapters from v1 collected set', () => {
  const v1 = {
    v: 1,
    playerX: 1200,
    vehicle: 'run',
    collected: ['itics', 'cmr'],
    achievements: ['school-1'],
    discoveredBeats: ['exam-anxiety'],
  };
  const v2 = globalThis.JourneyPersistence.migrateJourneyState(v1);
  assert.strictEqual(v2.v, 2);
  assert.strictEqual(v2.chapters.itics.phase, 'complete');
  assert.strictEqual(v2.chapters.cmr.phase, 'complete');
  assert.strictEqual(v2.chapters.college, undefined);
  // existing fields preserved
  assert.strictEqual(v2.playerX, 1200);
  assert.strictEqual(v2.vehicle, 'run');
  assert.deepStrictEqual(v2.collected, ['itics', 'cmr']);
});

test('migrateJourneyState handles missing v field as v1', () => {
  const stored = { collected: [], playerX: 0 };
  const out = globalThis.JourneyPersistence.migrateJourneyState(stored);
  assert.strictEqual(out.v, 2);
  assert.deepStrictEqual(out.chapters, {});
});

test('migrateJourneyState is a no-op on already-v2 state', () => {
  const v2 = { v: 2, chapters: { itics: { phase: 'complete', score: 50, npcChoice: 0 } } };
  const out = globalThis.JourneyPersistence.migrateJourneyState(v2);
  assert.strictEqual(out, v2);
});

test('loadJourneyState reads + migrates from a mock storage', () => {
  const store = { journey: JSON.stringify({ v: 1, collected: ['itics'] }) };
  const mockStorage = {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
  };
  const state = globalThis.JourneyPersistence.loadJourneyState(mockStorage);
  assert.strictEqual(state.v, 2);
  assert.strictEqual(state.chapters.itics.phase, 'complete');
  // and writes back the migrated form
  assert.strictEqual(JSON.parse(store.journey).v, 2);
});

test('saveJourneyState writes JSON', () => {
  const store = {};
  const mockStorage = {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
  };
  globalThis.JourneyPersistence.saveJourneyState(mockStorage, { v: 2, foo: 1 });
  assert.deepStrictEqual(JSON.parse(store.journey), { v: 2, foo: 1 });
});
