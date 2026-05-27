(() => {

'use strict';

// === src/journey/core.js ===

// === src/journey/core.js ===
// Entry hooks for the v2 harness. Populated in later tasks.
const JOURNEY_V2_VERSION = 2;


// === src/journey/state/persistence.js ===

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


// === src/journey/state/phase.js ===

// === src/journey/state/phase.js ===
/**
 * Per-chapter phase machine.
 *   unseen → cutscene → exploring → closing → culminating → complete
 * Re-entry to a `complete` chapter via ENTER drops back to `exploring`
 * (cutscene is one-shot per chapter; NPC and beats remain interactive).
 */
const CHAPTER_PHASES = ['unseen', 'cutscene', 'exploring', 'closing', 'culminating', 'complete'];

const PHASE_TRANSITIONS = {
  unseen:     { ENTER: 'cutscene' },
  cutscene:   { DISMISS: 'exploring' },
  exploring:  { QUEST_COMPLETE: 'closing' },
  closing:    { MINIGAME_DONE: 'culminating' },
  culminating:{ DISMISS: 'complete' },
  complete:   { ENTER: 'exploring' },   // re-entry
};

function transitionChapterPhase(current, event) {
  const row = PHASE_TRANSITIONS[current];
  if (!row) throw new Error(`unknown phase: ${current}`);
  return row[event] ?? current;
}


// === src/journey/state/store.js === (missing — skipped)

// === src/journey/data/cutscenes.js === (missing — skipped)

// === src/journey/data/culminations.js === (missing — skipped)

// === src/journey/world/npcs.js === (missing — skipped)

// === src/journey/ui/input.js === (missing — skipped)

// === src/journey/ui/hud.js === (missing — skipped)

// === src/journey/acts/cutscene.js === (missing — skipped)

// === src/journey/acts/npc.js === (missing — skipped)

// === src/journey/acts/quest.js === (missing — skipped)

// === src/journey/acts/minigame.js === (missing — skipped)

// === src/journey/acts/minigames/mock-test.js === (missing — skipped)

// === src/journey/acts/culmination.js === (missing — skipped)

// === src/journey/bootstrap.js === (missing — skipped)

})();