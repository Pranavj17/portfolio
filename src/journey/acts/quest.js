// === src/journey/acts/quest.js ===
/**
 * Quest = a subset of chapter beats the player must collect to gate Act III.
 * Pure logic — DOM rendering lives in ui/hud.js.
 *
 * Beat collection comes from the v1 state.discoveredBeats Set; we hand it
 * in as a plain object map for testability.
 */

const QUESTS = {
  __placeholder: { beats: ['p1', 'p2', 'p3'], needed: 2 },
  cmr: {
    beats: ['tuition-rush', 'mock-test', 'study-lamp', 'first-crush'],
    needed: 3,
  },
  itics: {
    beats: ['football-match', 'cricket-match', 'sports-day', 'assembly-stage'],
    needed: 3,
  },
  scripbox: {
    beats: ['pr-review', 'anthropic-catalog', 'claude-code', 'whiteboard', 'anthropic-talk'],
    needed: 3,
  },
  now: {
    beats: ['morning-routine', 'code-flow', 'anthropic-goal', 'forward-horizon'],
    needed: 4,
  },
  sakha: {
    beats: ['interview-day', 'first-paycheck', 'wfh-covid', 'late-night-coding'],
    needed: 3,
  },
  college: {
    beats: ['bosch-intern', 'abb-intern', 'fest-stage', 'convocation'],
    needed: 3,
  },
  fever104: {
    beats: ['headphones', 'script-binder', 'sound-engineer', 'trainee-cert'],
    needed: 3,
  },
  vwgt: {
    beats: ['test-drive', 'documents-signing', 'keys-handover', 'first-drive-out'],
    needed: 4,
  },
};

function questProgress(beatIds, needed, collectedMap) {
  const collected = beatIds.filter(b => collectedMap[b]);
  const remaining = beatIds.filter(b => !collectedMap[b]);
  return { done: collected.length, needed, collected, remaining };
}

function isQuestComplete(beatIds, needed, collectedMap) {
  return questProgress(beatIds, needed, collectedMap).done >= needed;
}
