// === src/journey/core.js ===
/**
 * v2 chapter flow orchestrator.
 *
 * The v1 game continues to handle the world, parallax, walking, beats, and
 * achievements. v2 sits on top and watches the v1 globals:
 *   - state.playerX (from v1, exposed on window for v2)
 *   - state.discoveredBeats (Set in v1)
 *   - CHAPTERS array (v1)
 *
 * When the player enters a chapter that has v2 content (NPCS[id] !== undefined
 * and id !== '__placeholder'), v2 takes over for the 3-act vignette. Otherwise
 * v1 chapter behavior runs as today.
 */
const JOURNEY_V2_VERSION = 2;

const V2_ENABLED_CHAPTERS = new Set(['cmr', 'itics', 'scripbox', 'now', 'sakha', 'college', 'fever104', 'vwgt']);   // expand each Phase 3 task

/**
 * Returns the v2 chapter id for the player's current world-x, or null
 * if no v2 chapter is active. Reads window.__journeyV1Bridge populated by
 * v1's game loop (added in the v1 patch below).
 */
function detectActiveV2Chapter() {
  const b = window.__journeyV1Bridge;
  if (!b || !b.getCurrentChapterId) return null;
  const id = b.getCurrentChapterId();
  return V2_ENABLED_CHAPTERS.has(id) ? id : null;
}

let _activeFlow = null;

function startChapterFlow(chapterId) {
  if (_activeFlow === chapterId) return;
  const store = window.__journeyV2.store;
  const phase = store.getChapter(chapterId).phase;
  // Re-entry: completed chapters don't auto-replay. Medal-mode replay is a
  // Phase 4 polish item (see docs/journey-v2-status.md).
  if (phase === 'complete') return;
  _activeFlow = chapterId;
  const intertitle = (window.__journeyV1Bridge?.getIntertitle?.(chapterId)) || {};

  if (phase === 'unseen') {
    store.send(chapterId, 'ENTER');                 // → cutscene
    playCutscene(chapterId, intertitle, () => {
      store.send(chapterId, 'DISMISS');             // → exploring
      enterExploring(chapterId);
    });
  } else {
    enterExploring(chapterId);
  }
}

function enterExploring(chapterId) {
  const collectedMap = collectedBeatsMap();
  showQuestHud(chapterId, collectedMap);
  // The NPC is presented when the player taps the NPC sprite. For the
  // Phase-2 slice we auto-present it 800ms after entering exploring (so the
  // cutscene fade isn't stepped on). Phase 3 wires a real tappable sprite.
  setTimeout(() => {
    presentNpc(chapterId, idx => {
      window.__journeyV2.store.setNpcChoice(chapterId, idx);
      checkQuestComplete(chapterId);
    });
  }, 800);
  // Poll for quest completion as the player walks and collects beats
  pollQuest(chapterId);
}

function collectedBeatsMap() {
  const b = window.__journeyV1Bridge;
  const set = b?.getDiscoveredBeats?.() ?? new Set();
  const m = {};
  for (const id of set) m[id] = true;
  return m;
}

const _questPollTimers = {};   // { [chapterId]: intervalId }
function pollQuest(chapterId) {
  if (_questPollTimers[chapterId]) clearInterval(_questPollTimers[chapterId]);
  _questPollTimers[chapterId] = setInterval(() => {
    const cm = collectedBeatsMap();
    showQuestHud(chapterId, cm);
    const q = QUESTS[chapterId];
    if (q && isQuestComplete(q.beats, q.needed, cm)) {
      checkQuestComplete(chapterId);
    }
  }, 500);
}

const _act3Started = {};       // { [chapterId]: true }
function checkQuestComplete(chapterId) {
  if (_act3Started[chapterId]) return;
  const q = QUESTS[chapterId];
  const cm = collectedBeatsMap();
  if (!q || !isQuestComplete(q.beats, q.needed, cm)) return;
  // Need NPC choice recorded AND quest complete
  if (window.__journeyV2.store.getChapter(chapterId).npcChoice == null) return;
  _act3Started[chapterId] = true;
  if (_questPollTimers[chapterId]) {
    clearInterval(_questPollTimers[chapterId]);
    delete _questPollTimers[chapterId];
  }
  hideQuestHud();
  window.__journeyV2.store.send(chapterId, 'QUEST_COMPLETE');   // → closing
  initMinigame(chapterId, ({ score, label }) => {
    window.__journeyV2.store.setScore(chapterId, score);
    window.__journeyV2.store.send(chapterId, 'MINIGAME_DONE');  // → culminating
    const lbl = window.__journeyV1Bridge?.getChapterLabel?.(chapterId) ?? chapterId.toUpperCase();
    showCulmination(chapterId, lbl, () => {
      window.__journeyV2.store.send(chapterId, 'DISMISS');      // → complete
      delete _act3Started[chapterId];
      _activeFlow = null;
    });
  });
}

// Polled from a setInterval that bootstrap starts.
function tickChapterFlow() {
  const id = detectActiveV2Chapter();
  if (id) startChapterFlow(id);
}
