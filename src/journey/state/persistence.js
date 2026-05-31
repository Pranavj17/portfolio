// === src/journey/state/persistence.js ===
/**
 * localStorage.journey schema migration + IO.
 * Pure functions — accept a storage-like object so tests don't need jsdom.
 */
const JOURNEY_STORAGE_KEY = 'journey';
const JOURNEY_SCHEMA_VERSION = 2;

function migrateJourneyState(stored) {
  if (!stored || typeof stored !== 'object') return { v: 2, chapters: {} };
  if (stored.v === 2) return migrateChapterRecords(stored);
  // v1 (or missing v): build chapters map from the collected set — every
  // collected chapter was a finished milestone, so it maps to visited+complete.
  const collected = Array.isArray(stored.collected) ? stored.collected : [];
  const chapters = {};
  for (const id of collected) {
    chapters[id] = { visited: true, complete: true, memoriesPlayed: [], score: null };
  }
  return { ...stored, v: 2, chapters };
}

/**
 * Upgrade v:2 chapter records from the old phase machine to the room-as-
 * milestone shape. `phase==='complete'` → {visited,complete:true};
 * `memoriesPlayed`/`score` are preserved. Records already in the new shape pass
 * through untouched. The schema version stays v:2 (no key bump).
 */
function migrateChapterRecords(stored) {
  const chapters = stored.chapters;
  if (!chapters || typeof chapters !== 'object') return stored;
  let changed = false;
  const next = {};
  for (const id of Object.keys(chapters)) {
    const rec = chapters[id] || {};
    if ('phase' in rec) {
      changed = true;
      const done = rec.phase === 'complete';
      next[id] = {
        visited: done || !!rec.roomVisited,
        complete: done,
        memoriesPlayed: Array.isArray(rec.memoriesPlayed) ? rec.memoriesPlayed : [],
        score: rec.score != null ? rec.score : null,
      };
    } else {
      next[id] = rec;
    }
  }
  return changed ? { ...stored, chapters: next } : stored;
}

function loadJourneyState(storage) {
  const raw = storage.getItem(JOURNEY_STORAGE_KEY);
  let parsed;
  try { parsed = raw ? JSON.parse(raw) : null; } catch (_) { parsed = null; }
  const migrated = migrateJourneyState(parsed);
  // write-back any migration so older visitors are upgraded on the next load
  // (covers both v1→v2 and old-v2-phase-records → room-as-milestone records).
  if (parsed && migrated !== parsed) {
    try { storage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(migrated)); } catch (_) {}
  }
  return migrated;
}

function saveJourneyState(storage, state) {
  try { storage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}
