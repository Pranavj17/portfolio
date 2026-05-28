// === src/journey/state/persistence.js ===
/**
 * localStorage.journey schema migration + IO.
 * Pure functions — accept a storage-like object so tests don't need jsdom.
 */
const JOURNEY_STORAGE_KEY = 'journey';
const JOURNEY_SCHEMA_VERSION = 2;

function migrateJourneyState(stored) {
  if (!stored || typeof stored !== 'object') return { v: 2, chapters: {} };
  if (stored.v === 2) return stored;
  // v1 (or missing v): build chapters map from collected set
  const collected = Array.isArray(stored.collected) ? stored.collected : [];
  const chapters = {};
  for (const id of collected) {
    chapters[id] = { phase: 'complete', score: null, npcChoice: null };
  }
  return { ...stored, v: 2, chapters };
}

function loadJourneyState(storage) {
  const raw = storage.getItem(JOURNEY_STORAGE_KEY);
  let parsed;
  try { parsed = raw ? JSON.parse(raw) : null; } catch (_) { parsed = null; }
  const migrated = migrateJourneyState(parsed);
  // write-back any migration so v1 visitors are upgraded
  if (parsed && parsed.v !== 2) {
    try { storage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(migrated)); } catch (_) {}
  }
  return migrated;
}

function saveJourneyState(storage, state) {
  try { storage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}
