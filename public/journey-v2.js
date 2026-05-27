(() => {

'use strict';

// === src/journey/core.js ===

// Entry hooks for the v2 harness. Populated in later tasks.
const JOURNEY_V2_VERSION = 2;


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


// === src/journey/state/store.js ===

/**
 * Chapter store. Wraps localStorage via persistence module, exposes
 * getChapter / send (transition) / setScore / setNpcChoice.
 */
function createChapterStore(storage) {
  let state = loadJourneyState(storage);
  if (!state.chapters) state.chapters = {};

  function persist() { saveJourneyState(storage, state); }

  function getChapter(id) {
    const existing = state.chapters[id];
    return existing
      ? { ...existing }
      : { phase: 'unseen', score: null, npcChoice: null };
  }

  function send(id, event) {
    const cur = getChapter(id);
    const next = transitionChapterPhase(cur.phase, event);
    state.chapters[id] = { ...cur, phase: next };
    persist();
    return next;
  }

  function setScore(id, score) {
    state.chapters[id] = { ...getChapter(id), score };
    persist();
  }

  function setNpcChoice(id, idx) {
    state.chapters[id] = { ...getChapter(id), npcChoice: idx };
    persist();
  }

  return { getChapter, send, setScore, setNpcChoice, _state: () => state };
}


// === src/journey/data/cutscenes.js ===

/**
 * Per-chapter Act I cutscene lines. Each entry:
 *   { lines: [...string], durationMs: number }
 * Phase 2 populates `cmr`. Other chapters stay empty until Phase 3 — the
 * cutscene player gracefully no-ops on a missing entry.
 */
const CUTSCENES = {
  __placeholder: {
    lines: ['act i', 'a placeholder line', 'tap to continue'],
    durationMs: 4000,
  },
};


// === src/journey/data/culminations.js === (missing — skipped)

// === src/journey/world/npcs.js === (missing — skipped)

// === src/journey/ui/input.js ===

/**
 * Gesture classifier. Pure function over an end-of-pointer snapshot:
 *   { dx, dy, durationMs }
 * Returns one of TAP / HOLD / SWIPE-V / SWIPE-H plus direction for swipes.
 * Thresholds are deliberately generous for mobile.
 */
const INPUT_SWIPE_THRESHOLD_PX = 40;
const INPUT_HOLD_THRESHOLD_MS  = 300;

function classifyGesture({ dx, dy, durationMs }) {
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (ady > INPUT_SWIPE_THRESHOLD_PX && ady >= adx) {
    return { kind: 'SWIPE-V', dir: Math.sign(dy) };  // +1 down, -1 up
  }
  if (adx > INPUT_SWIPE_THRESHOLD_PX) {
    return { kind: 'SWIPE-H', dir: Math.sign(dx) };  // +1 right, -1 left
  }
  if (durationMs >= INPUT_HOLD_THRESHOLD_MS) return { kind: 'HOLD' };
  return { kind: 'TAP' };
}

/**
 * attachInputRouter(target, onGesture) — wires touch + mouse on `target`
 * and invokes onGesture(result, originalEvent) for each completed gesture.
 * Returns a detach() function. Browser-only (uses addEventListener).
 */
function attachInputRouter(target, onGesture) {
  let start = null;
  const isTouch = e => e.touches && e.touches.length > 0;

  function pointerStart(e) {
    const p = isTouch(e) ? e.touches[0] : e;
    start = { x: p.clientX, y: p.clientY, t: Date.now() };
  }
  function pointerEnd(e) {
    if (!start) return;
    const p = e.changedTouches ? e.changedTouches[0] : e;
    const result = classifyGesture({
      dx: p.clientX - start.x,
      dy: p.clientY - start.y,
      durationMs: Date.now() - start.t,
    });
    start = null;
    onGesture(result, e);
  }
  target.addEventListener('touchstart', pointerStart, { passive: true });
  target.addEventListener('touchend',   pointerEnd,   { passive: true });
  target.addEventListener('mousedown',  pointerStart);
  target.addEventListener('mouseup',    pointerEnd);

  return function detach() {
    target.removeEventListener('touchstart', pointerStart);
    target.removeEventListener('touchend',   pointerEnd);
    target.removeEventListener('mousedown',  pointerStart);
    target.removeEventListener('mouseup',    pointerEnd);
  };
}


// === src/journey/ui/hud.js === (missing — skipped)

// === src/journey/acts/cutscene.js ===

/**
 * Act I cutscene player. Fades lines in one-by-one, dismisses on tap or
 * after durationMs. Calls onDismiss() exactly once.
 *
 * Browser-only: touches DOM. Reduced-motion mode displays all lines at
 * once with no animation and shortens display time.
 */
function playCutscene(chapterId, intertitle, onDismiss) {
  const data = CUTSCENES[chapterId] ?? CUTSCENES.__placeholder;
  const overlay = document.getElementById('v2-cutscene');
  const actEl   = document.getElementById('v2-cutscene-act');
  const linesEl = document.getElementById('v2-cutscene-lines');
  if (!overlay || !actEl || !linesEl) {
    onDismiss();
    return;
  }
  actEl.textContent = intertitle?.act ? `${intertitle.act} · ${intertitle.title ?? ''}` : '';
  linesEl.innerHTML = data.lines
    .map((t, i) => `<div class="v2-line" style="animation-delay:${i * 0.7}s">${t}</div>`)
    .join('');
  overlay.setAttribute('aria-hidden', 'false');

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onKey, true);
    overlay.removeEventListener('click', dismiss);
    onDismiss();
  }
  function onKey(e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dismiss(); } }
  overlay.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKey, true);
  setTimeout(dismiss, data.durationMs);
}


// === src/journey/acts/npc.js === (missing — skipped)

// === src/journey/acts/quest.js === (missing — skipped)

// === src/journey/acts/minigame.js === (missing — skipped)

// === src/journey/acts/minigames/mock-test.js === (missing — skipped)

// === src/journey/acts/culmination.js === (missing — skipped)

// === src/journey/bootstrap.js ===

/**
 * Exposes v2 internals on window.__journeyV2 for integration tests and
 * for the v1 game loop to call into during Phase 2 wiring.
 */
window.__journeyV2 = {
  playCutscene,
  // populated in later tasks:
  presentNpc: null,
  initMinigame: null,
  showCulmination: null,
  store: null,
};


})();