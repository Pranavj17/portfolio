// === public/journey3d/state.js ===
// journey v3 — progress persistence in localStorage key 'journey3d'. NO three.
//
// Pure functions taking a storage-like object ({ getItem, setItem }) so they
// are unit-testable in Node with a plain mock. Shape:
//   { v: 3, visited: string[], memoriesSeen: string[] }
//   - visited: chapter ids whose room you have entered
//   - memoriesSeen: "<chapterId>:<beatId>" keys you have inspected
//
// This is a SEPARATE key from v1/v2's 'journey' — v3 never touches that state.
//
// Authored as plain declarations + a trailing `export` so the test can eval it
// after stripping the export line.

const STORAGE_KEY = 'journey3d';

function emptyState() {
  return { v: 3, visited: [], memoriesSeen: [] };
}

/** Coerce arbitrary parsed JSON into a valid, deduped v3 state. */
function normalizeState(raw) {
  const s = emptyState();
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.visited)) {
      s.visited = Array.from(new Set(raw.visited.filter(x => typeof x === 'string')));
    }
    if (Array.isArray(raw.memoriesSeen)) {
      s.memoriesSeen = Array.from(new Set(raw.memoriesSeen.filter(x => typeof x === 'string')));
    }
  }
  return s;
}

/** Read + normalise state from a storage-like object. Never throws. */
function loadState(storage) {
  let raw = null;
  try {
    const txt = storage && storage.getItem ? storage.getItem(STORAGE_KEY) : null;
    if (txt) raw = JSON.parse(txt);
  } catch (e) {
    raw = null; // corrupt blob → start clean
  }
  return normalizeState(raw);
}

/** Persist state (normalised) to a storage-like object. Returns what was saved. */
function saveState(storage, state) {
  const s = normalizeState(state);
  if (storage && storage.setItem) storage.setItem(STORAGE_KEY, JSON.stringify(s));
  return s;
}

/** Pure: mark a chapter room visited; returns a new state. */
function markVisited(state, chapterId) {
  const s = normalizeState(state);
  if (typeof chapterId === 'string' && !s.visited.includes(chapterId)) {
    s.visited = s.visited.concat(chapterId);
  }
  return s;
}

/** Pure: mark a memory inspected; returns a new state. */
function markMemorySeen(state, chapterId, beatId) {
  const s = normalizeState(state);
  const key = chapterId + ':' + beatId;
  if (!s.memoriesSeen.includes(key)) {
    s.memoriesSeen = s.memoriesSeen.concat(key);
  }
  return s;
}

function hasVisited(state, chapterId) {
  return normalizeState(state).visited.includes(chapterId);
}

function hasSeenMemory(state, chapterId, beatId) {
  return normalizeState(state).memoriesSeen.includes(chapterId + ':' + beatId);
}

/**
 * The next unvisited chapter in a chronological id list (for the objective
 * marker), or null when every room has been entered.
 */
function nextUnvisited(state, orderedIds) {
  const s = normalizeState(state);
  for (let i = 0; i < orderedIds.length; i++) {
    if (!s.visited.includes(orderedIds[i])) return orderedIds[i];
  }
  return null;
}

export {
  STORAGE_KEY,
  emptyState,
  normalizeState,
  loadState,
  saveState,
  markVisited,
  markMemorySeen,
  hasVisited,
  hasSeenMemory,
  nextUnvisited,
};
