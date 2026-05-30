(() => {

'use strict';

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
  const npcAlreadyAnswered = window.__journeyV2.store.getChapter(chapterId).npcChoice != null;
  if (!npcAlreadyAnswered) {
    // First entry · auto-present the NPC after 800ms so the cutscene fade
    // doesn't step on it. The choice callback feeds into checkQuestComplete.
    setTimeout(() => {
      presentNpc(chapterId, idx => {
        window.__journeyV2.store.setNpcChoice(chapterId, idx);
        checkQuestComplete(chapterId);
      });
    }, 800);
  } else {
    // C-2 fix · re-entry · NPC already answered, don't re-present. If the
    // quest is now complete (player may have collected the remaining beats
    // while away), advance to Act III immediately.
    setTimeout(() => checkQuestComplete(chapterId), 100);
  }
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
  // C-1 fix · if the bridge no longer reports our active chapter (player
  // walked into a different chapter, or out of any v2-enabled band), tear
  // down the leftover poll timer + HUD so they don't run forever.
  if (_activeFlow && _activeFlow !== id) {
    if (_questPollTimers[_activeFlow]) {
      clearInterval(_questPollTimers[_activeFlow]);
      delete _questPollTimers[_activeFlow];
    }
    hideQuestHud();
    _activeFlow = null;
  }
  if (id) startChapterFlow(id);
  updateRoomDoor(id);
}

/**
 * Show the "step inside the memory" door prompt whenever the player is standing
 * in a chapter band they've already completed. Tapping it enters that chapter's
 * Memory Room. Hidden while a room is open or when not in a completed band.
 */
function updateRoomDoor(activeId) {
  const door = document.getElementById('v2-room-door');
  if (!door) return;
  if (typeof isRoomOpen === 'function' && isRoomOpen()) {
    door.setAttribute('aria-hidden', 'true');
    return;
  }
  const store = window.__journeyV2 && window.__journeyV2.store;
  const ready = activeId && store && store.getChapter(activeId).phase === 'complete';
  if (ready) {
    if (door.__chapter !== activeId) {
      door.__chapter = activeId;
      door.onclick = () => {
        door.setAttribute('aria-hidden', 'true');
        if (typeof openMemoryRoom === 'function') openMemoryRoom(activeId);
      };
    }
    door.setAttribute('aria-hidden', 'false');
  } else {
    door.setAttribute('aria-hidden', 'true');
    door.__chapter = null;
  }
}


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
  cmr: {
    lines: ['5:30 a.m.', 'the alarm again.', 'two years to crack JEE.'],
    durationMs: 8000,
  },
  itics: {
    lines: ['8:30 a.m.', 'the bell.', 'a decade of mornings just like this.'],
    durationMs: 7000,
  },
  scripbox: {
    lines: ['the catalog refresh.', 'seventeen times.', 'PR #2913 · merged.'],
    durationMs: 7500,
  },
  now: {
    lines: ['the first hour.', 'belongs to whoever claims it.', 'claim it.'],
    durationMs: 6000,
  },
  sakha: {
    lines: ['interview · five.', 'the call.', 'you cracked it.'],
    durationMs: 7000,
  },
  college: {
    lines: ['bus three of three.', 'campus by 8:55.', 'four years like this.'],
    durationMs: 7500,
  },
  fever104: {
    lines: ['ON-AIR · red.', 'the booth goes quiet.', 'three months.'],
    durationMs: 7000,
  },
  vwgt: {
    lines: ['wooden tray.', 'metallic key.', 'november sixteenth.'],
    durationMs: 7000,
  },
};


// === src/journey/data/culminations.js ===

const CULMINATIONS = {
  __placeholder: 'a placeholder culminating sentence that closes the chapter as one thread.',
  cmr: "the year you stopped sleeping. you didn't crack JEE. you also didn't break. that turned out to be the more useful skill.",
  itics: 'the years that taught you how to lose without breaking. cricket whites, scuffed knees, the morning bell that never asked twice.',
  scripbox: "the catalog page that wouldn't stop reloading. you sent the link to four people who never asked. for the first time the work didn't just pay — it was seen by a name you'd only ever read in papers.",
  now: 'morning coffee · terminal warmth · two hours that feel like ten minutes. the day belongs to whoever claims the first hour. you\'re claiming yours.',
  sakha: "three years and one pandemic. you bought a watch for dad and a saree for mum from your first paycheck. by the time covid ended you had shipped enough PRs that the team's git log read like your handwriting.",
  college: "four years of triples and three-bus commutes. you didn't graduate top of class. you graduated knowing what real work felt like before anyone paid you for it.",
  fever104: "three months in a soundproof room. you learned that a producer's whole craft is silence — choosing what NOT to play, what to fade, what to ride. everything later is a version of this.",
  vwgt: '1.5 TSI · turbo · november 16. ten years of saving became one signature. the salesperson clapped. you drove out with the garland still on the bonnet and three lefts of empty road ahead.',
};


// === src/journey/world/npcs.js ===

/**
 * Per-chapter NPC archetype. Each entry:
 *   { name, sprite, open, choices: [{label, reply}], close }
 * Phase 2 populates `cmr`. Other chapters added in Phase 3.
 */
const NPCS = {
  __placeholder: {
    name: 'THE PLACEHOLDER',
    sprite: '🗿',
    open: 'placeholder open line.',
    choices: [
      { label: 'choice a', reply: 'reply a.' },
      { label: 'choice b', reply: 'reply b.' },
    ],
    close: 'go well.',
  },
  cmr: {
    name: 'THE MOTHER', sprite: '👩',
    open: 'you slept four hours.',
    choices: [
      { label: "i'll sleep after JEE", reply: 'you said that yesterday too.' },
      { label: 'tea?',                 reply: 'already on the stove.' },
    ],
    close: 'go. the bus leaves in twelve.',
  },
  itics: {
    name: 'THE FIRST FRIEND', sprite: '🧒',
    open: 'you missed the bus again.',
    choices: [
      { label: 'ran the whole way', reply: 'three kilometres. shoes still untied.' },
      { label: 'took an auto',      reply: 'splurged. mom is going to know.' },
    ],
    close: 'come on. assembly already started.',
  },
  scripbox: {
    name: 'THE PEER', sprite: '🧑‍💻',
    open: 'show me the MCP protocol again.',
    choices: [
      { label: 'stdio json-rpc', reply: 'okay. and tools/list versus prompts/list?' },
      { label: "it's simpler than it sounds", reply: 'every server reviewer in the catalog said the same thing.' },
    ],
    close: 'send the PR. ship the page. refresh seventeen times.',
  },
  now: {
    name: 'THE SELF · FUTURE', sprite: '🪞',
    open: 'still here?',
    choices: [
      { label: 'always',  reply: 'good. keep claiming the hour.' },
      { label: 'for now', reply: 'for now is enough. it always was.' },
    ],
    close: "the day belongs to whoever claims the first hour. you're claiming yours.",
  },
  sakha: {
    name: 'THE TECH LEAD', sprite: '🧑‍🔧',
    open: 'five interviews. tell me about the last one.',
    choices: [
      { label: 'ran out of time',              reply: 'time runs out on everyone. you came back. that\'s the part.' },
      { label: 'over-prepared the wrong part', reply: 'every junior does. mine was hash maps. yours?' },
    ],
    close: 'monday at nine. wear something with a collar.',
  },
  college: {
    name: 'THE TRIPLE-RIDER', sprite: '🛵',
    open: 'you walking again?',
    choices: [
      { label: 'saving bus fare', reply: 'lend me ten then. tomorrow\'s my treat.' },
      { label: 'lost my pass',    reply: 'same. third time this month. hop on.' },
    ],
    close: 'next class is on the other side. hold on tight.',
  },
  fever104: {
    name: 'THE CONDUCTOR', sprite: '🎚️',
    open: 'feel the room first. then the levels.',
    choices: [
      { label: 'still hearing the bus outside', reply: 'good. don\'t lose that. you\'ll need it on monday.' },
      { label: 'ready',                          reply: 'you\'re not. nobody is on day one. fader up.' },
    ],
    close: 'count me in. four bars.',
  },
  vwgt: {
    name: 'THE SALESMAN', sprite: '🎩',
    open: 'thirty-five minutes on the ORR sold this car.',
    choices: [
      { label: 'i knew at the second roundabout', reply: 'most do. the turbo speaks before the heart catches up.' },
      { label: 'the turbo did',                    reply: '1.5 TSI. 110 kilowatts of small-block thunder.' },
    ],
    close: 'sign here. keys are warm. drive carefully out the gate.',
  },
};


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
 * canvasPoint(rect, bufW, bufH, clientX, clientY) — map a viewport point into
 * canvas backing-buffer coordinates. A mini-game / room canvas is drawn at its
 * intrinsic size (e.g. 360×240, or DPR-scaled full screen) but CSS-stretched to
 * fill its box, so a raw clientX lands in the wrong space — and touch events
 * carry no offsetX at all. This is the single source of truth for canvas
 * hit-testing. Pure + unit-tested.
 *
 *   rect — target.getBoundingClientRect() (or any {left,top,width,height})
 *   bufW/bufH — target.width / target.height (the backing buffer)
 */
function canvasPoint(rect, bufW, bufH, clientX, clientY) {
  const sx = rect.width ? bufW / rect.width : 1;
  const sy = rect.height ? bufH / rect.height : 1;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

/**
 * attachInputRouter(target, onGesture) — wires touch + mouse on `target`
 * and invokes onGesture(result, originalEvent) for each completed gesture.
 * The result carries canvas-space coords: `x/y` = release point, `x0/y0` =
 * press point. Returns a detach() function. Browser-only (uses addEventListener).
 */
function attachInputRouter(target, onGesture) {
  let start = null;
  const isTouch = e => e.touches && e.touches.length > 0;

  function localPoint(clientX, clientY) {
    const rect = target.getBoundingClientRect();
    return canvasPoint(rect, target.width, target.height, clientX, clientY);
  }

  function pointerStart(e) {
    const p = isTouch(e) ? e.touches[0] : e;
    const c = localPoint(p.clientX, p.clientY);
    start = { x: p.clientX, y: p.clientY, cx: c.x, cy: c.y, t: Date.now() };
  }
  function pointerEnd(e) {
    if (!start) return;
    const p = e.changedTouches ? e.changedTouches[0] : e;
    const end = localPoint(p.clientX, p.clientY);
    const result = classifyGesture({
      dx: p.clientX - start.x,
      dy: p.clientY - start.y,
      durationMs: Date.now() - start.t,
    });
    // Canvas-space coords for hit-testing. Replaces the old ev.offsetX reads
    // (absent on touch; wrong space on a CSS-stretched backing buffer).
    result.x = end.x;   result.y = end.y;
    result.x0 = start.cx; result.y0 = start.cy;
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


// === src/journey/ui/hud.js ===

/**
 * Quest checklist renderer. Reads from QUESTS[chapterId] and a collectedMap,
 * paints the panel, fades in/out via aria-hidden.
 */
function showQuestHud(chapterId, collectedMap) {
  const q = QUESTS[chapterId];
  if (!q) return hideQuestHud();
  const $hud = document.getElementById('v2-quest-hud');
  const $title = document.getElementById('v2-quest-title');
  const $progress = document.getElementById('v2-quest-progress');
  const $list = document.getElementById('v2-quest-list');
  const p = questProgress(q.beats, q.needed, collectedMap);
  $title.textContent = `${chapterId.toUpperCase()} · QUEST`;
  $progress.textContent = `${p.done} / ${q.needed}`;
  $list.innerHTML = q.beats
    .map(b => `<li class="${collectedMap[b] ? 'done' : ''}">${collectedMap[b] ? '✓' : '○'} ${b}</li>`)
    .join('');
  $hud.setAttribute('aria-hidden', 'false');
}

function hideQuestHud() {
  const $hud = document.getElementById('v2-quest-hud');
  if ($hud) $hud.setAttribute('aria-hidden', 'true');
}


// === src/journey/acts/cutscene.js ===

/**
 * Act I cutscene player. Fades lines in one-by-one, dismisses on tap or
 * after durationMs. Calls onDismiss() exactly once.
 *
 * Browser-only: touches DOM. Reduced-motion mode displays all lines at
 * once with no animation-delay and shortens the auto-dismiss timer.
 */

// Pure helper · tested independently in tests/unit/cutscene.test.js.
function isReducedMotion(win) {
  if (!win || typeof win.matchMedia !== 'function') return false;
  try { return !!win.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (_) { return false; }
}

function playCutscene(chapterId, intertitle, onDismiss) {
  const data = CUTSCENES[chapterId] ?? CUTSCENES.__placeholder;
  const overlay = document.getElementById('v2-cutscene');
  const actEl   = document.getElementById('v2-cutscene-act');
  const linesEl = document.getElementById('v2-cutscene-lines');
  if (!overlay || !actEl || !linesEl) {
    onDismiss();
    return;
  }
  const reduced = isReducedMotion(window);
  actEl.textContent = intertitle?.act ? `${intertitle.act} · ${intertitle.title ?? ''}` : '';
  linesEl.innerHTML = data.lines
    .map((t, i) => `<div class="v2-line" style="${reduced ? '' : `animation-delay:${i * 0.7}s`}">${t}</div>`)
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
  // Auto-dismiss: 3000ms cap under reduced-motion (so the user isn't
  // stuck reading the same card for the full content duration).
  const effectiveDuration = reduced ? Math.min(data.durationMs, 3000) : data.durationMs;
  setTimeout(dismiss, effectiveDuration);
}


// === src/journey/acts/npc.js ===

/**
 * Act II NPC encounter. Renders open line, then choices. Player taps a
 * choice → reply replaces the line, choices clear, "tap to continue"
 * appears. Tap anywhere → close line → onDone(choiceIdx).
 *
 * Phase machine: choose → reply → close → done. `clickChoice` runs in
 * the capture phase and stops propagation so the same click cannot also
 * trigger `clickAdvance` in the bubble phase. A `done` flag guards
 * against rapid double-clicks calling onDone twice.
 */
function presentNpc(chapterId, onDone) {
  const data = NPCS[chapterId] ?? NPCS.__placeholder;
  const overlay = document.getElementById('v2-npc');
  const $sprite = document.getElementById('v2-npc-sprite');
  const $name   = document.getElementById('v2-npc-name');
  const $line   = document.getElementById('v2-npc-line');
  const $choices = document.getElementById('v2-npc-choices');
  if (!overlay) { onDone(null); return; }

  $sprite.textContent = data.sprite;
  $name.textContent = data.name;
  $line.textContent = data.open;
  $choices.innerHTML = data.choices
    .map((c, i) => `<button class="v2-npc-choice" data-idx="${i}">${c.label}</button>`)
    .join('');
  overlay.setAttribute('aria-hidden', 'false');

  let phase = 'choose';  // choose → reply → close → done
  let pickedIdx = null;
  let done = false;

  function clickChoice(e) {
    const btn = e.target.closest('.v2-npc-choice');
    if (!btn || phase !== 'choose') return;
    // Stop the same click from advancing the reply→close transition.
    e.stopPropagation();
    pickedIdx = parseInt(btn.dataset.idx, 10);
    $line.textContent = data.choices[pickedIdx].reply;
    $choices.innerHTML = `<div class="v2-cutscene-cta">▸ tap to continue ▸</div>`;
    phase = 'reply';
  }
  function clickAdvance(e) {
    if (phase === 'reply') {
      $line.textContent = data.close;
      $choices.innerHTML = `<div class="v2-cutscene-cta">▸ tap to leave ▸</div>`;
      phase = 'close';
      return;
    }
    if (phase === 'close') {
      if (done) return;
      done = true;
      phase = 'done';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.removeEventListener('click', clickChoice, true);
      overlay.removeEventListener('click', clickAdvance);
      onDone(pickedIdx);
    }
  }
  overlay.addEventListener('click', clickChoice, true);
  overlay.addEventListener('click', clickAdvance);
}


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


// === src/journey/acts/minigame.js ===

/**
 * Act III mini-game harness. Each mini-game is registered as:
 *   MINIGAMES[id] = {
 *     id, label, durationMs, prompt,
 *     init(ctx, helpers) -> state,
 *     update(state, dt) -> void,
 *     render(state, ctx) -> void,
 *     onGesture(state, gesture, ev) -> void,
 *     score(state) -> number,
 *     scoreLabel(score) -> string,
 *   }
 *
 * No-fail: when durationMs elapses, score(state) is called and
 * onDone({score, label}) fires unconditionally.
 */
const MINIGAMES = {};
let _minigameLoop = null;
let _minigameDetach = null;

function initMinigame(chapterId, onDone) {
  // Resolve game by chapter; fall back to placeholder
  const game = MINIGAMES[chapterId] ?? MINIGAMES.__stub;
  if (!game) { onDone({ score: 0, label: 'no-game' }); return; }

  const $overlay = document.getElementById('v2-minigame');
  const $name = document.getElementById('v2-minigame-name');
  const $timer = document.getElementById('v2-minigame-timer');
  const $prompt = document.getElementById('v2-minigame-prompt');
  const $canvas = document.getElementById('v2-minigame-canvas');
  const ctx = $canvas.getContext('2d');

  $name.textContent = game.label;
  $prompt.textContent = game.prompt ?? '';
  $overlay.setAttribute('aria-hidden', 'false');

  const state = game.init(ctx, { canvas: $canvas });
  let last = performance.now();
  let remaining = game.durationMs;
  let finished = false;

  function tick(now) {
    const dt = Math.min(100, now - last);
    last = now;
    remaining -= dt;
    if (remaining <= 0 && !finished) { finish(); return; }
    $timer.textContent = `${(remaining / 1000).toFixed(1)}s`;
    game.update(state, dt);
    ctx.clearRect(0, 0, $canvas.width, $canvas.height);
    game.render(state, ctx);
    _minigameLoop = requestAnimationFrame(tick);
  }
  _minigameLoop = requestAnimationFrame(tick);

  _minigameDetach = attachInputRouter($canvas, (gesture, ev) => {
    if (!finished) game.onGesture(state, gesture, ev);
  });

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(_minigameLoop);
    if (_minigameDetach) _minigameDetach();
    $overlay.setAttribute('aria-hidden', 'true');
    const score = game.score(state);
    onDone({ score, label: game.scoreLabel(score) });
  }
}

// Stub mini-game so the harness has something to play before real games land
MINIGAMES.__stub = {
  id: '__stub', label: 'STUB', durationMs: 1500,
  prompt: 'auto-completes',
  init(ctx, _helpers) { return { t: 0 }; },
  update(state, dt) { state.t += dt; },
  render(state, ctx) {
    ctx.fillStyle = '#d4a653';
    ctx.fillRect(10, 10, Math.min(340, state.t / 5), 40);
    ctx.fillStyle = '#e9d8b0';
    ctx.font = '14px monospace';
    ctx.fillText('stub mini-game · auto-completes', 20, 80);
  },
  onGesture(_state, _g, _ev) { /* ignored */ },
  score(state) { return Math.min(100, Math.floor(state.t / 15)); },
  scoreLabel(score) { return `${score}/100`; },
};


// === src/journey/acts/minigames/mock-test.js ===

/**
 * `mock-test` · CMR's mini-game.
 * One MCQ question, 3 options, 8s timer. All options are "valid" — no-fail.
 * Score = 100 − (elapsedMs / 80) clamped to [50, 100]. Faster = higher.
 */
MINIGAMES.cmr = {
  id: 'mock-test',
  label: 'CMR · MOCK TEST',
  durationMs: 8000,
  prompt: 'tap the right answer · the clock is louder than the question',

  init(ctx, helpers) {
    return {
      options: ['a · 42',  'b · 49',  'c · 56'],
      question: 'if  3x + 7 = 22  then  x = ?',
      pickedIdx: null,
      elapsedMs: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) {
    state.elapsedMs += dt;
  },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e9d8b0';
    ctx.font = '16px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.question, W / 2, 40);

    const slotW = W / 3;
    for (let i = 0; i < state.options.length; i++) {
      const x = i * slotW, y = 70, w = slotW - 4, h = 100;
      ctx.strokeStyle = state.pickedIdx === i ? '#d4a653' : '#5a2e1a';
      ctx.lineWidth = state.pickedIdx === i ? 3 : 1;
      ctx.strokeRect(x + 4, y, w, h);
      ctx.fillStyle = state.pickedIdx === i ? '#d4a653' : '#e9d8b0';
      ctx.fillText(state.options[i], x + slotW / 2, y + h / 2 + 6);
    }
    ctx.textAlign = 'left';
  },

  onGesture(state, gesture, ev) {
    if (gesture.kind !== 'TAP') return;
    const W = state.canvas.width;
    const x = ev.offsetX ?? (ev.changedTouches ? ev.changedTouches[0].clientX : 0);
    const slotW = W / 3;
    const idx = Math.max(0, Math.min(2, Math.floor(x / slotW)));
    state.pickedIdx = idx;
  },

  score(state) {
    if (state.pickedIdx === null) return 50;   // no-fail floor for non-participation
    const speed = 100 - Math.floor(state.elapsedMs / 80);
    return Math.max(50, Math.min(100, speed));
  },

  scoreLabel(score) { return `${score}/100`; },
};


// === src/journey/acts/minigames/kick-football.js ===

/**
 * `kick-football` · ITICS mini-game.
 * Timing bar: an arrow sweeps left-right between 0 and 1 at ~1 cycle/sec.
 * Player taps to "kick"; score = 100 if arrow is at 0.5, decays linearly
 * to floor 50 at the edges. One tap only. No-fail.
 */
MINIGAMES.itics = {
  id: 'kick-football',
  label: 'ITICS · KICK',
  durationMs: 6000,
  prompt: 'tap when the arrow lands dead-center · one kick only',

  init(ctx, helpers) {
    return {
      arrow: 0,
      dir: 1,
      kicked: false,
      kickAt: null,
      elapsedMs: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) {
    state.elapsedMs += dt;
    if (state.kicked) return;
    const speed = dt / 500;
    state.arrow += state.dir * speed;
    if (state.arrow >= 1) { state.arrow = 1; state.dir = -1; }
    if (state.arrow <= 0) { state.arrow = 0; state.dir = 1; }
  },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    const barY = H / 2;
    ctx.strokeStyle = '#5a2e1a'; ctx.lineWidth = 2;
    ctx.strokeRect(20, barY - 18, W - 40, 36);
    ctx.fillStyle = '#3d2818';
    ctx.fillRect(20 + (W - 40) * 0.45, barY - 16, (W - 40) * 0.1, 32);
    const ax = 20 + (W - 40) * state.arrow;
    ctx.fillStyle = state.kicked ? '#d4a653' : '#e9d8b0';
    ctx.beginPath();
    ctx.moveTo(ax, barY - 28); ctx.lineTo(ax - 7, barY - 14); ctx.lineTo(ax + 7, barY - 14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e9d8b0';
    ctx.font = '14px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.kicked ? 'KICKED' : 'tap to kick', W / 2, H - 30);
    ctx.textAlign = 'left';
  },

  onGesture(state, gesture, _ev) {
    if (gesture.kind !== 'TAP') return;
    if (state.kicked) return;
    state.kicked = true;
    state.kickAt = state.arrow;
  },

  score(state) {
    if (!state.kicked || state.kickAt === null) return 50;
    const dist = Math.abs(state.kickAt - 0.5);
    const raw = 100 - Math.round(dist * 100);
    return Math.max(50, Math.min(100, raw));
  },

  scoreLabel(score) { return `${score}/100`; },
};


// === src/journey/acts/minigames/debug-the-pr.js ===

/**
 * `debug-the-pr` · SCRIPBOX mini-game.
 * 4 lines of JS. One has a bug. Tap the line you think is wrong. All
 * answers are "valid" (no-fail), but the score is higher if you pick the
 * actual bug AND pick it fast.
 */
MINIGAMES.scripbox = {
  id: 'debug-the-pr',
  label: 'SCRIPBOX · DEBUG',
  durationMs: 8000,
  prompt: 'tap the line with the bug · all answers are valid',

  init(ctx, helpers) {
    return {
      lines: [
        '  const beats = state.discoveredBeats;',
        '  if (beats.size = 0) return;',
        '  for (const id of beats) {',
        '    render(id);',
      ],
      bugLine: 1,
      pickedIdx: null,
      elapsedMs: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) { state.elapsedMs += dt; },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    ctx.font = '13px "IBM Plex Mono", monospace';
    const lh = 40;
    for (let i = 0; i < state.lines.length; i++) {
      const y = 30 + i * lh;
      if (state.pickedIdx === i) {
        ctx.fillStyle = '#3d2818'; ctx.fillRect(10, y - 18, W - 20, lh - 4);
        ctx.strokeStyle = '#d4a653'; ctx.lineWidth = 2;
        ctx.strokeRect(10, y - 18, W - 20, lh - 4);
      }
      ctx.fillStyle = '#e9d8b0';
      ctx.fillText(`${i + 1}  ${state.lines[i]}`, 20, y);
    }
  },

  onGesture(state, gesture, ev) {
    if (gesture.kind !== 'TAP') return;
    const y = ev.offsetY ?? (ev.changedTouches ? ev.changedTouches[0].clientY : 0);
    const lh = 40;
    const idx = Math.max(0, Math.min(3, Math.floor((y - 30) / lh)));
    state.pickedIdx = idx;
  },

  score(state) {
    if (state.pickedIdx === null) return 50;
    const right = state.pickedIdx === state.bugLine;
    const speed = right ? Math.max(0, 50 - Math.floor(state.elapsedMs / 160)) : 0;
    return Math.max(50, Math.min(100, (right ? 50 : 0) + speed + 50));
  },

  scoreLabel(score) { return `${score}/100`; },
};


// === src/journey/acts/minigames/type-the-future.js ===

/**
 * `type-the-future` · NOW mini-game.
 * A 4-letter word is shown. Each letter has a tap zone (canvas split into
 * 4 vertical columns). Tap the letters in order. Out-of-order taps are
 * ignored. Score scales with progress; floor 50.
 */
MINIGAMES.now = {
  id: 'type-the-future',
  label: 'NOW · TYPE',
  durationMs: 7000,
  prompt: 'tap the letters · in order',

  init(ctx, helpers) {
    return {
      word: 'NEXT',
      progress: 0,
      elapsedMs: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) { state.elapsedMs += dt; },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    const colW = W / 4;
    for (let i = 0; i < state.word.length; i++) {
      const done = i < state.progress;
      const next = i === state.progress;
      ctx.strokeStyle = done ? '#d4a653' : (next ? '#e6c285' : '#5a2e1a');
      ctx.lineWidth = next ? 3 : 1;
      ctx.strokeRect(i * colW + 4, 30, colW - 8, H - 60);
      ctx.fillStyle = done ? '#d4a653' : '#e9d8b0';
      ctx.font = 'bold 36px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.word[i], i * colW + colW / 2, H / 2 + 12);
    }
    ctx.textAlign = 'left';
  },

  onGesture(state, gesture, ev) {
    if (gesture.kind !== 'TAP') return;
    if (state.progress >= state.word.length) return;
    const W = state.canvas.width;
    const x = ev.offsetX ?? (ev.changedTouches ? ev.changedTouches[0].clientX : 0);
    const colW = W / 4;
    const idx = Math.floor(x / colW);
    if (idx === state.progress) state.progress++;
  },

  score(state) {
    const raw = 50 + Math.floor((state.progress / state.word.length) * 50);
    return Math.max(50, Math.min(100, raw));
  },

  scoreLabel(score) { return `${score}/100`; },
};


// === src/journey/acts/minigames/standup-bingo.js ===

/**
 * `standup-bingo` · SAKHA mini-game.
 * 3×3 grid of standup phrases. Every ~900ms a random cell flashes
 * ("active"). Tap it within ~900ms to catch it. Score scales with caught
 * count over 10s. No-fail floor 50.
 */
MINIGAMES.sakha = {
  id: 'standup-bingo',
  label: 'SAKHA · STANDUP',
  durationMs: 10000,
  prompt: 'tap the flashing cards · they only stay for a beat',

  init(ctx, helpers) {
    return {
      cells: [
        'blockers?', 'shipping today', 'merge ready',
        'EOD?', 'standup soon', 'PR review',
        'one bug', '+1', 'LGTM',
      ],
      activeIdx: null,
      tSinceLast: 0,
      caught: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) {
    state.tSinceLast += dt;
    if (state.tSinceLast >= 900) {
      state.tSinceLast = 0;
      state.activeIdx = Math.floor(Math.random() * 9);
    }
  },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    const cw = W / 3, ch = H / 3;
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < 9; i++) {
      const cx = (i % 3) * cw, cy = Math.floor(i / 3) * ch;
      const active = i === state.activeIdx;
      ctx.fillStyle = active ? '#d4a653' : '#2a1c10';
      ctx.fillRect(cx + 4, cy + 4, cw - 8, ch - 8);
      ctx.fillStyle = active ? '#1f1610' : '#e9d8b0';
      ctx.fillText(state.cells[i], cx + cw / 2, cy + ch / 2 + 4);
    }
    ctx.textAlign = 'left';
  },

  onGesture(state, gesture, ev) {
    if (gesture.kind !== 'TAP') return;
    const W = state.canvas.width, H = state.canvas.height;
    const x = ev.offsetX ?? 0, y = ev.offsetY ?? 0;
    const cw = W / 3, ch = H / 3;
    const idx = Math.floor(y / ch) * 3 + Math.floor(x / cw);
    if (idx === state.activeIdx) {
      state.caught++;
      state.activeIdx = null;
      state.tSinceLast = 0;
    }
  },

  score(state) {
    const raw = 50 + state.caught * 6;
    return Math.max(50, Math.min(100, raw));
  },

  scoreLabel(score) { return `${score}/100`; },
};


// === src/journey/acts/minigames/cad-snap.js ===

/**
 * `cad-snap` · DSCE mini-game.
 * Pick up parts (tap) then place at slots (tap). Auto-snap when released
 * within snap-distance. Score scales with snapped count.
 *
 * Internal helpers `snapPart` and `tryPlace` are exposed via the game
 * object so unit tests can drive the state machine.
 */
const CAD_SNAP_DISTANCE = 30;

MINIGAMES.college = {
  id: 'cad-snap',
  label: 'DSCE · CAD',
  durationMs: 10000,
  prompt: 'tap a part to pick it up · tap a slot to drop it',

  init(ctx, helpers) {
    const W = helpers.canvas ? helpers.canvas.width : 360;
    const H = helpers.canvas ? helpers.canvas.height : 240;
    return {
      slots: [
        { x: W * 0.25, y: H * 0.30, label: 'piston' },
        { x: W * 0.50, y: H * 0.30, label: 'gear'   },
        { x: W * 0.75, y: H * 0.30, label: 'cam'    },
      ],
      parts: [
        { x: W * 0.20, y: H * 0.80, label: 'piston', snapped: false },
        { x: W * 0.50, y: H * 0.80, label: 'gear',   snapped: false },
        { x: W * 0.80, y: H * 0.80, label: 'cam',    snapped: false },
      ],
      dragging: -1,
      elapsedMs: 0,
      canvas: helpers.canvas,
    };
  },

  snapPart(state, idx) {
    const part = state.parts[idx];
    const slot = state.slots.find(s => s.label === part.label);
    part.x = slot.x;
    part.y = slot.y;
    part.snapped = true;
  },

  tryPlace(state, idx) {
    const part = state.parts[idx];
    for (const slot of state.slots) {
      if (slot.label !== part.label) continue;
      const dx = slot.x - part.x, dy = slot.y - part.y;
      if (Math.sqrt(dx * dx + dy * dy) <= CAD_SNAP_DISTANCE) {
        this.snapPart(state, idx);
        return true;
      }
    }
    return false;
  },

  update(state, dt) { state.elapsedMs += dt; },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    for (const slot of state.slots) {
      ctx.strokeStyle = '#5a2e1a'; ctx.lineWidth = 1;
      ctx.strokeRect(slot.x - 22, slot.y - 22, 44, 44);
      ctx.fillStyle = '#5a2e1a';
      ctx.fillText(slot.label, slot.x, slot.y + 40);
    }
    for (let i = 0; i < state.parts.length; i++) {
      const p = state.parts[i];
      ctx.fillStyle = p.snapped ? '#d4a653' : '#e9d8b0';
      ctx.fillRect(p.x - 18, p.y - 18, 36, 36);
      ctx.fillStyle = '#1f1610';
      ctx.fillText(p.label, p.x, p.y + 4);
    }
    ctx.textAlign = 'left';
  },

  onGesture(state, gesture, ev) {
    if (gesture.kind !== 'TAP' && gesture.kind !== 'HOLD') return;
    if (state.dragging >= 0) {
      this.tryPlace(state, state.dragging);
      state.dragging = -1;
    } else {
      const x = ev.offsetX ?? 0, y = ev.offsetY ?? 0;
      for (let i = 0; i < state.parts.length; i++) {
        const p = state.parts[i];
        if (p.snapped) continue;
        if (Math.abs(p.x - x) <= 22 && Math.abs(p.y - y) <= 22) {
          p.x = x; p.y = y;
          state.dragging = i;
          return;
        }
      }
    }
  },

  score(state) {
    const snapped = state.parts.filter(p => p.snapped).length;
    return Math.max(50, Math.min(100, 50 + snapped * 17));
  },

  scoreLabel(score) { return `${score}/100`; },
};


// === src/journey/acts/minigames/live-mix.js ===

/**
 * `live-mix` · FEVER 104 mini-game.
 * Three vertical faders, three target levels (random per init).
 * SWIPE-V on a column raises (up) or lowers (down) that fader by 0.18 per
 * swipe. Score = 100 - mean(|fader - target|) * 100, floor 50.
 */
const LIVE_MIX_SWIPE_STEP = 0.18;

MINIGAMES.fever104 = {
  id: 'live-mix',
  label: 'FEVER 104 · MIX',
  durationMs: 10000,
  prompt: 'swipe up/down on each fader · match the target',

  init(ctx, helpers) {
    return {
      faders: [0.5, 0.5, 0.5],
      targets: [
        0.3 + Math.random() * 0.4,
        0.3 + Math.random() * 0.4,
        0.3 + Math.random() * 0.4,
      ],
      elapsedMs: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) { state.elapsedMs += dt; },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    const colW = W / 3;
    for (let i = 0; i < 3; i++) {
      const cx = i * colW + colW / 2;
      const trackTop = 30, trackBot = H - 30;
      const trackH = trackBot - trackTop;
      ctx.strokeStyle = '#5a2e1a';
      ctx.strokeRect(cx - 5, trackTop, 10, trackH);
      const ty = trackBot - state.targets[i] * trackH;
      ctx.strokeStyle = '#d4a653'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 20, ty); ctx.lineTo(cx + 20, ty); ctx.stroke();
      const fy = trackBot - state.faders[i] * trackH;
      ctx.fillStyle = '#e9d8b0';
      ctx.fillRect(cx - 15, fy - 5, 30, 10);
      ctx.lineWidth = 1;
    }
  },

  onGesture(state, gesture, ev) {
    if (gesture.kind !== 'SWIPE-V') return;
    const W = state.canvas.width;
    const x = ev.offsetX ?? 0;
    const idx = Math.max(0, Math.min(2, Math.floor(x / (W / 3))));
    state.faders[idx] = Math.max(0, Math.min(1, state.faders[idx] - gesture.dir * LIVE_MIX_SWIPE_STEP));
  },

  score(state) {
    let sumDist = 0;
    for (let i = 0; i < 3; i++) sumDist += Math.abs(state.faders[i] - state.targets[i]);
    const meanDist = sumDist / 3;
    const raw = 100 - Math.round(meanDist * 100);
    return Math.max(50, Math.min(100, raw));
  },

  scoreLabel(score) { return `${score}/100`; },
};


// === src/journey/acts/minigames/parallel-park.js ===

/**
 * `parallel-park` · THE GT mini-game.
 * Top-down lane view; car at the center; cones on left/right.
 * SWIPE-H nudges the car along a 0..1 scale. Touching a wall (carX <= 0
 * or carX >= 1) clamps and increments wallTouches. Score = 100 - 10
 * per touch, floor 50.
 */
const PARALLEL_PARK_NUDGE = 0.07;

MINIGAMES.vwgt = {
  id: 'parallel-park',
  label: 'THE GT · PARK',
  durationMs: 10000,
  prompt: 'swipe left/right to steer · don\'t touch the cones',

  init(ctx, helpers) {
    return {
      carX: 0.5,
      wallTouches: 0,
      elapsedMs: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) { state.elapsedMs += dt; },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#a4332e';
    ctx.fillRect(0, H * 0.20, 30, H * 0.60);
    ctx.fillRect(W - 30, H * 0.20, 30, H * 0.60);
    const cx = 30 + (W - 60) * state.carX;
    ctx.fillStyle = '#d4a653';
    ctx.fillRect(cx - 30, H * 0.40, 60, H * 0.20);
    ctx.fillStyle = '#1f1610';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GT', cx, H * 0.50 + 4);
    ctx.fillStyle = '#e9d8b0';
    ctx.fillText(`touches: ${state.wallTouches}`, W / 2, H - 10);
    ctx.textAlign = 'left';
  },

  onGesture(state, gesture, _ev) {
    if (gesture.kind !== 'SWIPE-H') return;
    const next = state.carX + gesture.dir * PARALLEL_PARK_NUDGE;
    if (next >= 1) { state.carX = 1; state.wallTouches++; }
    else if (next <= 0) { state.carX = 0; state.wallTouches++; }
    else state.carX = next;
  },

  score(state) {
    const raw = 100 - state.wallTouches * 10;
    return Math.max(50, Math.min(100, raw));
  },

  scoreLabel(score) { return `${score}/100`; },
};


// === src/journey/acts/culmination.js ===

/**
 * Act III culmination card. Shows the chapter's closing paragraph, then on
 * tap chains into the existing v1 stage-video player if available.
 * Falls back to immediate onDone if neither overlay nor stage-video exists.
 */
function showCulmination(chapterId, chapterLabel, onDone) {
  const text = CULMINATIONS[chapterId] ?? CULMINATIONS.__placeholder ?? '';
  const $overlay = document.getElementById('v2-culmination');
  const $text = document.getElementById('v2-culmination-text');
  if (!$overlay || !$text) { onDone(); return; }
  $text.textContent = text;
  $overlay.setAttribute('aria-hidden', 'false');

  function dismiss() {
    $overlay.removeEventListener('click', dismiss);
    $overlay.setAttribute('aria-hidden', 'true');
    // Chain into the v1 stage-video player. It lives inside v1's IIFE and is
    // only reachable through the bridge — the old `typeof playStageVideo` sniff
    // resolved to this module's own name (a no-op), so the video never played.
    const playVid = window.__journeyV1Bridge && window.__journeyV1Bridge.playStageVideo;
    if (typeof playVid === 'function') {
      try { playVid(chapterId, chapterLabel); } catch (_) {}
    }
    onDone();
  }
  $overlay.addEventListener('click', dismiss);
}


// === src/journey/room/geometry.js ===

/**
 * Pure geometry for the Memory Room.
 *
 * A room is authored in a fixed virtual space (ROOM_W × ROOM_H). The renderer
 * maps that space onto whatever canvas the device has, with a parallax camera
 * that pans a little toward the pointer / device-tilt to sell depth. EVERY tap
 * is hit-tested through propScreenRect, so what you can touch is exactly what
 * you see — no matter the screen size. All functions here are pure (no DOM) so
 * they're unit-tested without a browser.
 */
const ROOM_W = 1000;
const ROOM_H = 600;
const ROOM_OVERSCAN = 1.08;   // draw a touch larger than fit so parallax never reveals an edge
const CAM_PARALLAX_PX = 48;   // max room-space camera shift from a full pointer deflection

function clampUnit(v) { return v < -1 ? -1 : (v > 1 ? 1 : v); }
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOutCubic(t) { const u = 1 - t; return 1 - u * u * u; }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

/**
 * depth 0 = far wall (barely moves), 1 = foreground (moves most with camera).
 * Near things parallax more than far things — the core depth cue.
 */
function parallaxFactor(depth) { return 0.25 + depth * 0.75; }

/**
 * Per-frame mapping from room space to canvas space.
 *   cam = { x, y } pointer-normalized in [-1,1].
 */
function roomLayout(canvasW, canvasH, cam) {
  const scale = Math.min(canvasW / ROOM_W, canvasH / ROOM_H) * ROOM_OVERSCAN;
  return {
    canvasW, canvasH, scale,
    originX: canvasW / 2,
    originY: canvasH / 2,
    camX: (cam && cam.x ? cam.x : 0) * CAM_PARALLAX_PX,
    camY: (cam && cam.y ? cam.y : 0) * CAM_PARALLAX_PX,
  };
}

/**
 * Screen rect for a prop (center cx/cy + size w/h) under the frame layout.
 * Near props render larger and shift more with the camera.
 */
function propScreenRect(prop, layout) {
  const depth = prop.depth == null ? 0.5 : prop.depth;
  const pf = parallaxFactor(depth);
  const rx = prop.x - ROOM_W / 2;
  const ry = prop.y - ROOM_H / 2;
  const cx = layout.originX + (rx - layout.camX * pf) * layout.scale;
  const cy = layout.originY + (ry - layout.camY * pf) * layout.scale;
  const sizeScale = layout.scale * (0.65 + depth * 0.7);
  const w = (prop.w == null ? 90 : prop.w) * sizeScale;
  const h = (prop.h == null ? 90 : prop.h) * sizeScale;
  return { cx, cy, w, h, depth };
}

/**
 * Topmost interactable prop under a canvas-space tap, or null. Near props
 * (higher depth) win overlaps. `pad` grows the hit box for fat-finger taps.
 * Props with kind 'decor' are scenery and never interactable.
 */
function hitTestProps(props, sx, sy, layout, pad) {
  if (pad == null) pad = 12;
  let best = null, bestDepth = -1;
  for (const prop of props) {
    if (prop.kind === 'decor') continue;
    const r = propScreenRect(prop, layout);
    const hw = r.w / 2 + pad, hh = r.h / 2 + pad;
    if (sx >= r.cx - hw && sx <= r.cx + hw && sy >= r.cy - hh && sy <= r.cy + hh) {
      if (r.depth >= bestDepth) { best = prop; bestDepth = r.depth; }
    }
  }
  return best;
}


// === src/journey/room/motes.js ===

/**
 * Dust motes drifting in the room's light shaft — the cheapest, highest-impact
 * "this is a 3D space" cue. Positions are normalized [0,1] over the canvas so
 * they're resolution-independent. The step is pure (dt in ms) so it's testable
 * without a browser; makeMotes takes an injectable rng for deterministic tests.
 */
function makeMotes(n, rng) {
  rng = rng || Math.random;
  const motes = [];
  for (let i = 0; i < n; i++) {
    motes.push({
      x: rng(),
      y: rng(),
      r: 0.6 + rng() * 1.9,          // radius in px (scaled at draw time)
      vy: 0.015 + rng() * 0.045,     // rise speed, normalized units/sec
      sway: 0.4 + rng() * 1.4,       // horizontal sway frequency
      amp: 0.004 + rng() * 0.012,    // sway amplitude
      phase: rng() * Math.PI * 2,
      a: 0.12 + rng() * 0.40,        // base alpha
    });
  }
  return motes;
}

/**
 * Advance motes by dtMs. Each rises slowly, sways, and wraps to the bottom
 * once it floats off the top. Returns the same array (mutated) for chaining.
 */
function stepMotes(motes, dtMs) {
  const dt = dtMs / 1000;
  for (const m of motes) {
    m.y -= m.vy * dt;
    m.phase += m.sway * dt;
    if (m.y < -0.05) { m.y = 1.05; }
  }
  return motes;
}


// === src/journey/room/data.js ===

/**
 * Memory Room content + procedural layout.
 *
 * A room is mostly GENERATED, not hand-placed: the memory objects come from the
 * chapter's quest beats (QUESTS, already in the bundle) and are enriched at open
 * time from v1's authored beat lore (window.__journey.BEATS — each beat carries
 * { title, lore, hint:<emoji> }). So a memory card shows the real title, the real
 * prose, and the real emoji with zero duplication. Per-chapter we only author the
 * era palette + a title; layout is computed. That keeps all 8 rooms consistent
 * and cheap to maintain while still feeling individually art-directed via colour.
 */

// Per-era tint over the shared sepia base. Every value stays in the RDR palette.
const ROOM_META = {
  __default: {
    title: 'A MEMORY', subtitle: '',
    palette: { wall1: '#3a2616', wall2: '#180f07', floor: '#0f0a05', accent: '#d4a653', frame: '#5a2e1a' },
    light: { x: 200, y: 150, w: 300, warmth: 1 }, motes: 26,
  },
  itics:    { title: 'ITICS', subtitle: 'until 2013 · the first bell',
    palette: { wall1: '#3a2716', wall2: '#1a1108', floor: '#100a05', accent: '#d4a653', frame: '#5a2e1a' },
    light: { x: 200, y: 150, w: 320, warmth: 1.05 }, motes: 30 },
  cmr:      { title: 'CMR NATIONAL', subtitle: '2013–2015 · the pressure cooker',
    palette: { wall1: '#2a2418', wall2: '#120f08', floor: '#0c0905', accent: '#c9b58c', frame: '#4a2a18' },
    light: { x: 175, y: 130, w: 240, warmth: 0.82 }, motes: 22 },
  college:  { title: 'D.S.C.E.', subtitle: '2015–2019 · triples & three-bus commutes',
    palette: { wall1: '#33291a', wall2: '#16100a', floor: '#0e0a05', accent: '#c47540', frame: '#5a3018' },
    light: { x: 210, y: 160, w: 300, warmth: 0.95 }, motes: 28 },
  fever104: { title: 'FEVER 104 FM', subtitle: 'Mar–May 2019 · the soundproof room',
    palette: { wall1: '#3a1e16', wall2: '#190d08', floor: '#0f0805', accent: '#e0a35a', frame: '#5a2618' },
    light: { x: 190, y: 150, w: 280, warmth: 1.1 }, motes: 24 },
  sakha:    { title: 'SAKHA GLOBAL', subtitle: '2019–2022 · the first paycheck',
    palette: { wall1: '#2e2a1e', wall2: '#15120b', floor: '#0d0a06', accent: '#d4a653', frame: '#534127' },
    light: { x: 205, y: 150, w: 300, warmth: 0.98 }, motes: 26 },
  scripbox: { title: 'SCRIPBOX', subtitle: '2022–present · a protocol no one had heard of',
    palette: { wall1: '#2b2c20', wall2: '#121309', floor: '#0b0c06', accent: '#e6c285', frame: '#4d4327' },
    light: { x: 200, y: 140, w: 300, warmth: 1.0 }, motes: 28 },
  vwgt:     { title: 'THE GT', subtitle: 'Nov 16 2025 · one signature',
    palette: { wall1: '#332014', wall2: '#160c06', floor: '#0e0805', accent: '#e6c285', frame: '#5a3016' },
    light: { x: 210, y: 150, w: 320, warmth: 1.08 }, motes: 30 },
  now:      { title: 'NOW', subtitle: '2026–present · still building',
    palette: { wall1: '#3d2c18', wall2: '#1c1206', floor: '#100a05', accent: '#f0c060', frame: '#5a3a1a' },
    light: { x: 220, y: 140, w: 340, warmth: 1.15 }, motes: 32 },
};

// Fallback emoji if a beat has no hint and isn't found in v1 BEATS.
const MEMORY_FALLBACK_ICON = '🖼️';

/** Look up a chapter's authored beat lore from v1 (window.__journey.BEATS). */
function lookupBeat(chapterId, beatId) {
  const all = (typeof window !== 'undefined' && window.__journey && window.__journey.BEATS) || [];
  const full = chapterId + '-' + beatId;
  return all.find(b => b.id === full || b.id === beatId) || null;
}

function humanize(id) {
  return String(id).replace(/[-_]/g, ' ');
}

/** Distribute N memory frames across the back/mid wall in a gentle zig-zag arc. */
function layoutMemories(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0.5 : i / (n - 1);
    out.push({
      x: 300 + t * 430,            // 300 → 730 across the wall
      y: 258 + (i % 2) * 74,       // zig-zag two rows
      depth: 0.48 + t * 0.22,      // far-left → nearer-right
      w: 116, h: 150,
    });
  }
  return out;
}

/**
 * Build the full room descriptor for a chapter. Memory props are generated from
 * QUESTS[chapterId].beats and enriched from v1 BEATS; the four fixtures
 * (projector / arcade / journal / exit) and the window are fixed furniture.
 */
function buildRoom(chapterId) {
  const meta = ROOM_META[chapterId] || ROOM_META.__default;
  const beats = (typeof QUESTS !== 'undefined' && QUESTS[chapterId] && QUESTS[chapterId].beats) || [];
  const slots = layoutMemories(beats.length);

  const props = [];

  // Window — the light source, far back, non-interactable.
  props.push({ id: 'window', kind: 'decor', draw: 'window',
    x: meta.light.x, y: meta.light.y, depth: 0.04, w: meta.light.w, h: meta.light.w * 0.9 });

  // Projector screen — plays the chapter's stage video (far wall).
  props.push({ id: 'screen', kind: 'video', draw: 'screen', icon: '▶',
    x: 510, y: 150, depth: 0.18, w: 270, h: 150, title: 'the reel' });

  // Memory frames — one per quest beat, enriched from authored lore.
  beats.forEach((beatId, i) => {
    const beat = lookupBeat(chapterId, beatId);
    const s = slots[i];
    props.push({
      id: beatId, kind: 'memory', draw: 'frame', beat: beatId,
      x: s.x, y: s.y, depth: s.depth, w: s.w, h: s.h,
      icon: (beat && beat.hint) || MEMORY_FALLBACK_ICON,
      title: (beat && beat.title) || humanize(beatId),
      body: (beat && beat.lore) || 'a memory from this chapter.',
    });
  });

  // Arcade cabinet — replays the chapter's mini-game (foreground left).
  props.push({ id: 'arcade', kind: 'minigame', draw: 'arcade', icon: '🕹',
    x: 150, y: 432, depth: 0.9, w: 150, h: 196,
    title: (typeof MINIGAMES !== 'undefined' && MINIGAMES[chapterId] && MINIGAMES[chapterId].label) || 'replay' });

  // Journal — the culmination paragraph (foreground right).
  props.push({ id: 'journal', kind: 'culmination', draw: 'journal', icon: '📖',
    x: 848, y: 470, depth: 0.92, w: 150, h: 120, title: 'the page',
    body: (typeof CULMINATIONS !== 'undefined' && (CULMINATIONS[chapterId] || CULMINATIONS.__placeholder)) || '' });

  // Exit door — back to the overworld (right wall).
  props.push({ id: 'exit', kind: 'exit', draw: 'door', icon: '→',
    x: 940, y: 332, depth: 0.42, w: 132, h: 300, title: 'step back out' });

  return {
    chapterId,
    title: meta.title,
    subtitle: meta.subtitle,
    palette: meta.palette,
    light: meta.light,
    moteCount: meta.motes,
    props,
  };
}


// === src/journey/room/render.js ===

/**
 * Memory Room renderer. Pure-ish: draws a room descriptor onto a 2D context for
 * the current frame. No state of its own — the controller owns the loop, camera,
 * motes and hover/played sets and hands them in via `frame`. All art is
 * procedural canvas (no image assets) to honour the overworld's zero-extra-
 * request constraint, layered far→near with a volumetric light shaft, drifting
 * motes, and per-prop bloom so it reads as a lit 3D space.
 *
 *   frame = { tMs, motes, hoverId, played:Set, reduced:bool, intro:0..1 }
 */
function drawRoom(ctx, room, layout, frame) {
  const W = layout.canvasW, H = layout.canvasH;
  const p = room.palette;
  const t = frame.tMs || 0;
  const reduced = !!frame.reduced;

  // 1 · back wall — vertical era-tinted gradient + soft corner darkening.
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, p.wall1);
  wall.addColorStop(1, p.wall2);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);

  // 2 · floor — lower third, darker, with a faint reflective sheen line.
  const floorTop = H * 0.66;
  const floor = ctx.createLinearGradient(0, floorTop, 0, H);
  floor.addColorStop(0, p.wall2);
  floor.addColorStop(1, p.floor);
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorTop, W, H - floorTop);
  ctx.strokeStyle = 'rgba(212,166,83,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, floorTop); ctx.lineTo(W, floorTop); ctx.stroke();

  // window screen position (light origin), used by the shaft + motes.
  const win = room.props.find(pr => pr.id === 'window');
  const winRect = win ? propScreenRect(win, layout) : { cx: W * 0.2, cy: H * 0.25, w: 200, h: 200 };

  // 3 · volumetric light shaft — additive warm cone from the window, with a
  // slow breathing intensity. Skipped flat in reduced-motion.
  drawLightShaft(ctx, W, H, winRect, p, room.light, reduced ? 0.5 : 0.5 + 0.12 * Math.sin(t / 1400));

  // 4 · props, far → near. Draw decor first within that ordering anyway.
  const ordered = room.props.slice().sort((a, b) => (a.depth || 0) - (b.depth || 0));

  // motes live between the far wall and the near furniture (drawn after the
  // far screen/window, before the near interactables) — split the prop list.
  let motesDrawn = false;
  for (const prop of ordered) {
    if (!motesDrawn && (prop.depth || 0) >= 0.4) {
      drawMotes(ctx, W, H, frame.motes, winRect, p.accent);
      motesDrawn = true;
    }
    drawProp(ctx, prop, layout, frame, p, t);
  }
  if (!motesDrawn) drawMotes(ctx, W, H, frame.motes, winRect, p.accent);

  // 5 · vignette — period-photo corner darkening (over everything in the room).
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.30, W / 2, H / 2, Math.max(W, H) * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(8,5,2,0.62)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // 6 · iris-in transition overlay (a closing/opening circular mask).
  if (frame.intro != null && frame.intro < 1) {
    const r = Math.max(W, H) * (0.05 + easeOutCubic(frame.intro) * 1.05);
    ctx.save();
    ctx.fillStyle = 'rgba(8,5,2,1)';
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2, true);   // counter-clockwise → punch a hole
    ctx.fill('evenodd');
    ctx.restore();
  }
}

function drawLightShaft(ctx, W, H, winRect, p, light, intensity) {
  const ox = winRect.cx, oy = winRect.cy;
  const spread = winRect.w * 1.1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(ox, oy, ox + W * 0.5, H);
  const warm = (light && light.warmth) || 1;
  g.addColorStop(0, `rgba(${Math.round(240 * warm)}, ${Math.round(205 * warm)}, ${Math.round(140 * warm)}, ${0.30 * intensity})`);
  g.addColorStop(1, 'rgba(120,80,30,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(ox - spread * 0.35, oy);
  ctx.lineTo(ox + spread * 0.35, oy);
  ctx.lineTo(ox + W * 0.62, H);
  ctx.lineTo(ox - W * 0.10, H);
  ctx.closePath();
  ctx.fill();
  // bright bloom at the window mouth
  const b = ctx.createRadialGradient(ox, oy, 2, ox, oy, spread);
  b.addColorStop(0, `rgba(255,235,180,${0.34 * intensity})`);
  b.addColorStop(1, 'rgba(255,235,180,0)');
  ctx.fillStyle = b;
  ctx.fillRect(ox - spread, oy - spread, spread * 2, spread * 2);
  ctx.restore();
}

function drawMotes(ctx, W, H, motes, winRect, accent) {
  if (!motes) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const m of motes) {
    const x = m.x * W + Math.sin(m.phase) * m.amp * W;
    const y = m.y * H;
    // brighter the closer to the shaft centre line
    const dx = (x - winRect.cx) / W;
    const near = Math.max(0, 1 - Math.abs(dx) * 1.8);
    const a = m.a * (0.35 + near * 0.65);
    ctx.fillStyle = `rgba(247,232,188,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawProp(ctx, prop, layout, frame, palette, t) {
  let r = propScreenRect(prop, layout);
  const hovered = frame.hoverId === prop.id;
  const played = prop.kind === 'memory' && frame.played && frame.played.has(prop.beat);

  if (hovered) { r = { ...r, w: r.w * 1.08, h: r.h * 1.08 }; }

  // glow halo for interactable, unplayed / hovered props
  if (prop.kind !== 'decor') {
    const pulse = 0.5 + 0.5 * Math.sin(t / 600 + (prop.x || 0));
    const baseA = played ? 0.10 : (hovered ? 0.55 : 0.22 + pulse * 0.16);
    drawHalo(ctx, r.cx, r.cy, Math.max(r.w, r.h) * (hovered ? 0.95 : 0.8), palette.accent, baseA);
  }

  switch (prop.draw) {
    case 'window':  drawWindowSprite(ctx, r, palette); break;
    case 'screen':  drawScreenSprite(ctx, r, palette, t); break;
    case 'arcade':  drawArcadeSprite(ctx, r, palette, t); break;
    case 'journal': drawJournalSprite(ctx, r, palette); break;
    case 'door':    drawDoorSprite(ctx, r, palette, t); break;
    case 'frame':
    default:        drawFrameSprite(ctx, r, palette, prop, played, hovered); break;
  }

  // floating label on hover
  if (hovered && prop.title) {
    drawLabel(ctx, r.cx, r.cy - r.h / 2 - 16, prop.title);
  }
}

function drawHalo(ctx, x, y, radius, color, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 1, x, y, radius);
  g.addColorStop(0, hexA(color, alpha));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function rr(ctx, x, y, w, h, rad) {
  const r = Math.min(rad, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFrameSprite(ctx, r, p, prop, played, hovered) {
  const x = r.cx - r.w / 2, y = r.cy - r.h / 2, w = r.w, h = r.h;
  // drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  rr(ctx, x + 4, y + 6, w, h, 6); ctx.fill();
  // outer frame
  const fg = ctx.createLinearGradient(x, y, x, y + h);
  fg.addColorStop(0, '#6b3a1f'); fg.addColorStop(1, p.frame);
  ctx.fillStyle = fg; rr(ctx, x, y, w, h, 6); ctx.fill();
  // inner mat (parchment)
  const m = w * 0.12;
  const mat = ctx.createLinearGradient(x, y, x, y + h);
  mat.addColorStop(0, '#e9d8b0'); mat.addColorStop(1, '#c9b58c');
  ctx.fillStyle = mat; rr(ctx, x + m, y + m, w - 2 * m, h - 2 * m, 3); ctx.fill();
  // icon
  ctx.save();
  ctx.globalAlpha = played ? 0.55 : 1;
  ctx.font = `${Math.round(h * 0.40)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(prop.icon || '🖼️', r.cx, r.cy - h * 0.04);
  ctx.restore();
  // played wax seal ✓ / unplayed shimmer dot
  if (played) {
    ctx.fillStyle = '#7a1f12';
    ctx.beginPath(); ctx.arc(r.cx, y + h - m - 4, h * 0.10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e9d8b0'; ctx.font = `${Math.round(h * 0.12)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✓', r.cx, y + h - m - 4);
  } else {
    ctx.fillStyle = hovered ? p.accent : 'rgba(212,166,83,0.85)';
    ctx.beginPath(); ctx.arc(r.cx, y + h - m - 2, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.textBaseline = 'alphabetic';
}

function drawScreenSprite(ctx, r, p, t) {
  const x = r.cx - r.w / 2, y = r.cy - r.h / 2, w = r.w, h = r.h;
  ctx.fillStyle = '#0a0a0c'; rr(ctx, x, y, w, h, 4); ctx.fill();
  ctx.strokeStyle = p.frame; ctx.lineWidth = 3; rr(ctx, x, y, w, h, 4); ctx.stroke();
  // soft projector glow
  const g = ctx.createRadialGradient(r.cx, r.cy, 2, r.cx, r.cy, w * 0.6);
  g.addColorStop(0, hexA(p.accent, 0.30)); g.addColorStop(1, hexA(p.accent, 0));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // scanlines
  ctx.strokeStyle = 'rgba(255,235,180,0.05)';
  for (let yy = y + 4; yy < y + h; yy += 5) { ctx.beginPath(); ctx.moveTo(x + 3, yy); ctx.lineTo(x + w - 3, yy); ctx.stroke(); }
  // play glyph
  ctx.fillStyle = hexA(p.accent, 0.9);
  const s = h * 0.22;
  ctx.beginPath(); ctx.moveTo(r.cx - s * 0.5, r.cy - s); ctx.lineTo(r.cx - s * 0.5, r.cy + s); ctx.lineTo(r.cx + s, r.cy); ctx.closePath(); ctx.fill();
}

function drawArcadeSprite(ctx, r, p, t) {
  const x = r.cx - r.w / 2, y = r.cy - r.h / 2, w = r.w, h = r.h;
  // body
  ctx.fillStyle = '#241712'; rr(ctx, x, y, w, h, 6); ctx.fill();
  ctx.strokeStyle = p.frame; ctx.lineWidth = 2; rr(ctx, x, y, w, h, 6); ctx.stroke();
  // marquee
  const mg = ctx.createLinearGradient(x, y, x, y + h * 0.16);
  mg.addColorStop(0, p.accent); mg.addColorStop(1, '#8a5a1a');
  ctx.fillStyle = mg; rr(ctx, x + 6, y + 6, w - 12, h * 0.14, 3); ctx.fill();
  // screen
  ctx.fillStyle = '#05060a'; ctx.fillRect(x + 10, y + h * 0.22, w - 20, h * 0.34);
  const sg = ctx.createRadialGradient(r.cx, y + h * 0.39, 2, r.cx, y + h * 0.39, w * 0.5);
  const flick = 0.5 + 0.3 * Math.sin(t / 220);
  sg.addColorStop(0, hexA(p.accent, 0.35 * flick)); sg.addColorStop(1, hexA(p.accent, 0));
  ctx.fillStyle = sg; ctx.fillRect(x + 10, y + h * 0.22, w - 20, h * 0.34);
  // control panel + joystick
  ctx.fillStyle = '#1a110b'; ctx.fillRect(x + 8, y + h * 0.60, w - 16, h * 0.22);
  ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(x + w * 0.35, y + h * 0.71, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a4332e'; ctx.beginPath(); ctx.arc(x + w * 0.6, y + h * 0.71, 5, 0, Math.PI * 2); ctx.fill();
}

function drawJournalSprite(ctx, r, p) {
  const x = r.cx - r.w / 2, y = r.cy - r.h / 2, w = r.w, h = r.h;
  // lectern
  ctx.fillStyle = '#2a1a10'; ctx.beginPath();
  ctx.moveTo(r.cx - w * 0.30, y + h); ctx.lineTo(r.cx + w * 0.30, y + h);
  ctx.lineTo(r.cx + w * 0.42, y + h * 0.55); ctx.lineTo(r.cx - w * 0.42, y + h * 0.55); ctx.closePath(); ctx.fill();
  // open book — two pages
  ctx.fillStyle = '#e9d8b0';
  ctx.beginPath(); ctx.moveTo(r.cx, y + h * 0.30); ctx.lineTo(x + 6, y + h * 0.40);
  ctx.lineTo(x + 10, y + h * 0.62); ctx.lineTo(r.cx, y + h * 0.55); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(r.cx, y + h * 0.30); ctx.lineTo(x + w - 6, y + h * 0.40);
  ctx.lineTo(x + w - 10, y + h * 0.62); ctx.lineTo(r.cx, y + h * 0.55); ctx.closePath(); ctx.fill();
  // text lines
  ctx.strokeStyle = 'rgba(90,46,26,0.5)'; ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const ly = y + h * (0.40 + i * 0.05);
    ctx.beginPath(); ctx.moveTo(x + 12, ly); ctx.lineTo(r.cx - 6, ly + h * 0.012); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r.cx + 6, ly); ctx.lineTo(x + w - 12, ly + h * 0.012); ctx.stroke();
  }
}

function drawDoorSprite(ctx, r, p, t) {
  const x = r.cx - r.w / 2, y = r.cy - r.h / 2, w = r.w, h = r.h;
  // frame
  ctx.fillStyle = '#2a1a10'; rr(ctx, x, y, w, h, 4); ctx.fill();
  // door ajar — warm light spilling
  const lg = ctx.createLinearGradient(x + w * 0.2, y, x + w, y);
  lg.addColorStop(0, '#3a2616'); lg.addColorStop(1, hexA('#f0c878', 0.9));
  ctx.fillStyle = lg; ctx.fillRect(x + w * 0.18, y + 8, w * 0.7, h - 16);
  // glow from the gap
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x + w * 0.85, r.cy, 2, x + w * 0.85, r.cy, h * 0.6);
  const pulse = 0.6 + 0.25 * Math.sin(t / 700);
  g.addColorStop(0, hexA('#ffdf9a', 0.5 * pulse)); g.addColorStop(1, hexA('#ffdf9a', 0));
  ctx.fillStyle = g; ctx.fillRect(x, y, w * 1.5, h); ctx.restore();
  // arrow glyph
  ctx.fillStyle = '#2a1a10'; ctx.font = `${Math.round(h * 0.14)}px 'Cinzel', serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('→', x + w * 0.52, r.cy);
}

function drawWindowSprite(ctx, r, p) {
  const x = r.cx - r.w / 2, y = r.cy - r.h / 2, w = r.w, h = r.h;
  // bright sky behind panes (the light source)
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#fff0cf'); sky.addColorStop(1, '#e6b066');
  ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
  // muntin bars
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = Math.max(3, w * 0.03);
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath(); ctx.moveTo(r.cx, y); ctx.lineTo(r.cx, y + h);
  ctx.moveTo(x, r.cy); ctx.lineTo(x + w, r.cy); ctx.stroke();
  // outer bloom
  drawHalo(ctx, r.cx, r.cy, w * 0.9, '#ffe9b0', 0.30);
}

function drawLabel(ctx, x, y, text) {
  ctx.save();
  ctx.font = "600 13px 'Cinzel', serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width + 22;
  ctx.fillStyle = 'rgba(20,12,6,0.86)';
  rr(ctx, x - tw / 2, y - 13, tw, 24, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(212,166,83,0.6)'; ctx.lineWidth = 1; rr(ctx, x - tw / 2, y - 13, tw, 24, 4); ctx.stroke();
  ctx.fillStyle = '#e9d8b0';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

/** hex (#rrggbb) + alpha → rgba() string. Tolerates already-rgba input. */
function hexA(hex, a) {
  if (typeof hex !== 'string' || hex[0] !== '#') return `rgba(212,166,83,${a})`;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}


// === src/journey/room/controller.js ===

/**
 * Memory Room controller — owns the open/close lifecycle, the rAF loop, the
 * parallax camera, pointer/tilt input, the memory cards, and the cinematic
 * enter/exit. The v1 overworld keeps running cheaply underneath an opaque
 * overlay; we only suppress its movement keys + shield its pointer listeners
 * while a room is open, then resume the player exactly where they were (no v1
 * surgery, lowest regression risk).
 */
const MOVE_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar',
  'w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'h', 'H',
]);

let _room = null;   // active session or null

function roomStore() { return window.__journeyV2 && window.__journeyV2.store; }
function isRoomOpen() { return !!_room; }

function openMemoryRoom(chapterId) {
  if (_room) return;
  const overlay = document.getElementById('v2-room');
  const canvas = document.getElementById('v2-room-canvas');
  if (!overlay || !canvas) return;

  const room = buildRoom(chapterId);
  const store = roomStore();
  const rec = store ? store.getChapter(chapterId) : {};
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const sess = {
    chapterId, room, canvas, overlay,
    ctx: canvas.getContext('2d'),
    cam: { x: 0, y: 0, tx: 0, ty: 0 },
    motes: (typeof makeMotes === 'function') ? makeMotes(reduced ? Math.round(room.moteCount / 2) : room.moteCount) : [],
    played: new Set(Array.isArray(rec.memoriesPlayed) ? rec.memoriesPlayed : []),
    hoverId: null,
    cardOpen: false,
    reduced,
    tMs: 0,
    intro: reduced ? 1 : 0,
    last: (typeof performance !== 'undefined' ? performance.now() : 0),
    raf: null,
    detachInput: null,
    handlers: {},
  };
  _room = sess;

  sizeCanvas(sess);
  if (store && store.markRoomVisited) store.markRoomVisited(chapterId);

  document.body.classList.add('v2-room-open');
  overlay.setAttribute('aria-hidden', 'false');
  setRoomChrome(sess);

  // --- freeze v1: swallow movement keys (capture), Esc exits ---
  sess.handlers.key = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeMemoryRoom(); return; }
    if (MOVE_KEYS.has(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  window.addEventListener('keydown', sess.handlers.key, true);
  window.addEventListener('keyup', sess.handlers.key, true);

  // --- shield v1 from our pointer input (stop bubbling past the overlay) ---
  sess.handlers.shield = (e) => { e.stopPropagation(); };
  ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'touchmove', 'pointerdown', 'pointerup']
    .forEach(t => overlay.addEventListener(t, sess.handlers.shield));

  // --- camera parallax: pointer (desktop) + device-tilt (mobile, best-effort) ---
  sess.handlers.move = (e) => {
    const p = e.touches ? e.touches[0] : e;
    if (!p || p.clientX == null) return;
    const w = window.innerWidth || 1, h = window.innerHeight || 1;
    sess.cam.tx = clampUnit((p.clientX / w) * 2 - 1);
    sess.cam.ty = clampUnit(((p.clientY / h) * 2 - 1) * 0.6);
  };
  overlay.addEventListener('mousemove', sess.handlers.move);
  if (window.DeviceOrientationEvent && !reduced) {
    sess.handlers.tilt = (e) => {
      if (e.gamma == null) return;
      sess.cam.tx = clampUnit(e.gamma / 28);
      sess.cam.ty = clampUnit(((e.beta || 45) - 45) / 36);
    };
    window.addEventListener('deviceorientation', sess.handlers.tilt);
  }

  // --- taps select props ---
  sess.detachInput = attachInputRouter(canvas, (gesture) => {
    if (sess.cardOpen) return;            // card eats the next tap (handled by card)
    if (gesture.kind !== 'TAP' && gesture.kind !== 'HOLD') return;
    const layout = roomLayout(canvas.width, canvas.height, sess.cam);
    const hit = hitTestProps(sess.room.props, gesture.x, gesture.y, layout);
    if (hit) handleProp(sess, hit);
  });
  // hover highlight on desktop
  sess.handlers.hover = (e) => {
    const layout = roomLayout(canvas.width, canvas.height, sess.cam);
    const pt = canvasPoint(canvas.getBoundingClientRect(), canvas.width, canvas.height, e.clientX, e.clientY);
    const hit = hitTestProps(sess.room.props, pt.x, pt.y, layout);
    sess.hoverId = hit ? hit.id : null;
    canvas.style.cursor = hit ? 'pointer' : 'default';
  };
  canvas.addEventListener('mousemove', sess.handlers.hover);

  sess.handlers.resize = () => sizeCanvas(sess);
  window.addEventListener('resize', sess.handlers.resize);

  // card dismiss
  const card = document.getElementById('v2-room-card');
  if (card) {
    sess.handlers.card = () => closeRoomCard(sess);
    card.addEventListener('click', sess.handlers.card);
  }

  startRoomAudio(sess);
  loop(sess);
}

function sizeCanvas(sess) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  sess.canvas.width = Math.round(w * dpr);
  sess.canvas.height = Math.round(h * dpr);
  sess.canvas.style.width = w + 'px';
  sess.canvas.style.height = h + 'px';
}

function setRoomChrome(sess) {
  const tEl = document.getElementById('v2-room-title');
  const sEl = document.getElementById('v2-room-sub');
  if (tEl) tEl.textContent = sess.room.title;
  if (sEl) sEl.textContent = sess.room.subtitle || '';
  updateRoomProgress(sess);
}

function updateRoomProgress(sess) {
  const pEl = document.getElementById('v2-room-progress');
  if (!pEl) return;
  const total = sess.room.props.filter(p => p.kind === 'memory').length;
  const done = sess.room.props.filter(p => p.kind === 'memory' && sess.played.has(p.beat)).length;
  pEl.textContent = total ? `memories · ${done} / ${total}` : '';
}

function loop(sess) {
  if (_room !== sess) return;
  const now = (typeof performance !== 'undefined' ? performance.now() : sess.last + 16);
  const dt = Math.min(60, now - sess.last);
  sess.last = now;
  sess.tMs += dt;

  // ease camera toward target + a slow idle drift so the room always breathes
  const drift = sess.reduced ? 0 : Math.sin(sess.tMs / 3200) * 0.10;
  sess.cam.x = lerp(sess.cam.x, sess.cam.tx + drift, 0.06);
  sess.cam.y = lerp(sess.cam.y, sess.cam.ty, 0.06);

  if (!sess.reduced && typeof stepMotes === 'function') stepMotes(sess.motes, dt);
  if (sess.intro < 1) sess.intro = Math.min(1, sess.intro + dt / 680);

  const layout = roomLayout(sess.canvas.width, sess.canvas.height, sess.cam);
  drawRoom(sess.ctx, sess.room, layout, {
    tMs: sess.tMs, motes: sess.motes, hoverId: sess.hoverId,
    played: sess.played, reduced: sess.reduced, intro: sess.intro,
  });

  sess.raf = requestAnimationFrame(() => loop(sess));
}

function handleProp(sess, prop) {
  switch (prop.kind) {
    case 'memory': {
      if (!sess.played.has(prop.beat)) {
        sess.played.add(prop.beat);
        const store = roomStore();
        if (store && store.markMemoryPlayed) store.markMemoryPlayed(sess.chapterId, prop.beat);
        updateRoomProgress(sess);
      }
      openRoomCard(sess, prop.icon + '  ' + prop.title, prop.body);
      break;
    }
    case 'culmination':
      openRoomCard(sess, 'the page', prop.body);
      break;
    case 'minigame':
      if (typeof initMinigame === 'function') {
        initMinigame(sess.chapterId, ({ score }) => {
          const store = roomStore();
          const prev = store ? (store.getChapter(sess.chapterId).score || 0) : 0;
          if (store && store.setScore && score > prev) store.setScore(sess.chapterId, score);
        });
      }
      break;
    case 'video': {
      const playVid = window.__journeyV1Bridge && window.__journeyV1Bridge.playStageVideo;
      const label = (window.__journeyV1Bridge && window.__journeyV1Bridge.getChapterLabel
        && window.__journeyV1Bridge.getChapterLabel(sess.chapterId)) || sess.room.title;
      if (typeof playVid === 'function') { try { playVid(sess.chapterId, label); } catch (_) {} }
      break;
    }
    case 'exit':
      closeMemoryRoom();
      break;
  }
}

function openRoomCard(sess, title, body) {
  const card = document.getElementById('v2-room-card');
  const tEl = document.getElementById('v2-room-card-title');
  const bEl = document.getElementById('v2-room-card-body');
  if (!card) return;
  if (tEl) tEl.textContent = title;
  if (bEl) bEl.textContent = body;
  card.setAttribute('aria-hidden', 'false');
  card.classList.add('shown');
  sess.cardOpen = true;
}

function closeRoomCard(sess) {
  const card = document.getElementById('v2-room-card');
  if (card) { card.classList.remove('shown'); card.setAttribute('aria-hidden', 'true'); }
  // defer clearing the flag so the dismiss tap doesn't also hit a prop
  setTimeout(() => { if (_room === sess) sess.cardOpen = false; }, 60);
}

function closeMemoryRoom() {
  const sess = _room;
  if (!sess) return;

  const finish = () => {
    if (sess.raf) cancelAnimationFrame(sess.raf);
    if (sess.detachInput) sess.detachInput();
    window.removeEventListener('keydown', sess.handlers.key, true);
    window.removeEventListener('keyup', sess.handlers.key, true);
    window.removeEventListener('resize', sess.handlers.resize);
    if (sess.handlers.tilt) window.removeEventListener('deviceorientation', sess.handlers.tilt);
    sess.overlay.removeEventListener('mousemove', sess.handlers.move);
    sess.canvas.removeEventListener('mousemove', sess.handlers.hover);
    ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'touchmove', 'pointerdown', 'pointerup']
      .forEach(t => sess.overlay.removeEventListener(t, sess.handlers.shield));
    const card = document.getElementById('v2-room-card');
    if (card && sess.handlers.card) card.removeEventListener('click', sess.handlers.card);
    sess.overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('v2-room-open');
    stopRoomAudio(sess);
    _room = null;
  };

  if (sess.reduced) { finish(); return; }
  // iris-out, then tear down
  sess.closing = true;
  const t0 = (typeof performance !== 'undefined' ? performance.now() : 0);
  const out = () => {
    const now = (typeof performance !== 'undefined' ? performance.now() : t0 + 700);
    sess.intro = 1 - Math.min(1, (now - t0) / 520);
    const layout = roomLayout(sess.canvas.width, sess.canvas.height, sess.cam);
    drawRoom(sess.ctx, sess.room, layout, {
      tMs: sess.tMs, motes: sess.motes, hoverId: null,
      played: sess.played, reduced: sess.reduced, intro: sess.intro,
    });
    if (sess.intro > 0) requestAnimationFrame(out); else finish();
  };
  if (sess.raf) cancelAnimationFrame(sess.raf);
  out();
}

// --- subtle ambient drone (best-effort; silent if WebAudio unavailable) ---
function startRoomAudio(sess) {
  if (sess.reduced) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    osc.type = 'triangle'; osc.frequency.value = 72;
    osc2.type = 'sine'; osc2.frequency.value = 108;
    gain.gain.value = 0;
    osc.connect(lp); osc2.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc2.start();
    gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 1.2);
    sess.audio = { ctx, gain };
  } catch (_) { /* no audio, no problem */ }
}

function stopRoomAudio(sess) {
  if (!sess.audio) return;
  try {
    const { ctx, gain } = sess.audio;
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    setTimeout(() => { try { ctx.close(); } catch (_) {} }, 600);
  } catch (_) {}
  sess.audio = null;
}


// === src/journey/bootstrap.js ===

/**
 * Exposes v2 internals on window.__journeyV2 for integration tests and
 * for the v1 game loop to call into during Phase 2 wiring.
 */
window.__journeyV2 = {
  playCutscene,
  presentNpc,
  initMinigame,
  showCulmination,
  store: createChapterStore(window.localStorage),
  // exposed for the chapter-flow polling
  detectActiveV2Chapter,
  startChapterFlow,
  // Memory Room API (Phase R)
  openMemoryRoom,
  closeMemoryRoom,
  isRoomOpen,
  buildRoom,
};

// Start polling for v2 chapter entry. The v1 bundle (journey.js) is NOT
// loaded under ?v=2 — that's by design for Phase 2 vertical slice. v2 also
// has to draw its own minimal "is the player in CMR?" check, so the bridge
// below is filled by an inline patch in journey.html.
setInterval(tickChapterFlow, 250);


})();