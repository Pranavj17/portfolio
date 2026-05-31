// === src/journey/state/store.js ===
/**
 * Chapter store. Wraps localStorage via the persistence module.
 *
 * Room-as-milestone shape — one record per chapter:
 *   { visited:false, complete:false, memoriesPlayed:[], score:null }
 * `visited`  → the room has been entered at least once.
 * `complete` → the guided sequence has been finished at least once (a revisit
 *              after this runs in free-explore mode).
 * The old phase machine + npcChoice are gone; the room IS the milestone.
 */
function createChapterStore(storage) {
  let state = loadJourneyState(storage);
  if (!state.chapters) state.chapters = {};

  function persist() { saveJourneyState(storage, state); }

  function defaults() {
    return { visited: false, complete: false, memoriesPlayed: [], score: null };
  }

  function getChapter(id) {
    const existing = state.chapters[id];
    // Spread over defaults so records written before a field existed read cleanly.
    return existing ? { ...defaults(), ...existing } : defaults();
  }

  function markVisited(id) {
    state.chapters[id] = { ...getChapter(id), visited: true };
    persist();
  }

  function markComplete(id) {
    state.chapters[id] = { ...getChapter(id), visited: true, complete: true };
    persist();
  }

  function markMemoryPlayed(id, beatId) {
    const cur = getChapter(id);
    const played = Array.isArray(cur.memoriesPlayed) ? cur.memoriesPlayed : [];
    if (played.includes(beatId)) return;
    state.chapters[id] = { ...cur, memoriesPlayed: [...played, beatId] };
    persist();
  }

  function setScore(id, score) {
    state.chapters[id] = { ...getChapter(id), score };
    persist();
  }

  return {
    getChapter, markVisited, markComplete, markMemoryPlayed, setScore,
    _state: () => state,
  };
}
