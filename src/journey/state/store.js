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
    // roomVisited / memoriesPlayed are additive Memory-Room fields; default them
    // so chapters saved before the rooms shipped still read cleanly.
    return existing
      ? { roomVisited: false, memoriesPlayed: [], ...existing }
      : { phase: 'unseen', score: null, npcChoice: null, roomVisited: false, memoriesPlayed: [] };
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

  function markRoomVisited(id) {
    state.chapters[id] = { ...getChapter(id), roomVisited: true };
    persist();
  }

  function markMemoryPlayed(id, beatId) {
    const cur = getChapter(id);
    const played = Array.isArray(cur.memoriesPlayed) ? cur.memoriesPlayed : [];
    if (played.includes(beatId)) return;
    state.chapters[id] = { ...cur, memoriesPlayed: [...played, beatId] };
    persist();
  }

  return {
    getChapter, send, setScore, setNpcChoice,
    markRoomVisited, markMemoryPlayed,
    _state: () => state,
  };
}
