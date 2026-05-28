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
    // Chain into stage video if v1 helper exposed it (it's a top-level
    // function in journey.js; we sniff for it).
    const playVid = window.__playStageVideoV1 || (typeof playStageVideo !== 'undefined' ? playStageVideo : null);
    if (typeof playVid === 'function') {
      try { playVid(chapterId, chapterLabel); } catch (_) {}
    }
    onDone();
  }
  $overlay.addEventListener('click', dismiss);
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
};

// Start polling for v2 chapter entry. The v1 bundle (journey.js) is NOT
// loaded under ?v=2 — that's by design for Phase 2 vertical slice. v2 also
// has to draw its own minimal "is the player in CMR?" check, so the bridge
// below is filled by an inline patch in journey.html.
setInterval(tickChapterFlow, 250);


})();