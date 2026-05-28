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

const V2_ENABLED_CHAPTERS = new Set(['cmr']);   // expand each Phase 3 task

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
  _activeFlow = chapterId;
  const store = window.__journeyV2.store;
  const phase = store.getChapter(chapterId).phase;
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

let _questPollTimer = null;
function pollQuest(chapterId) {
  if (_questPollTimer) clearInterval(_questPollTimer);
  _questPollTimer = setInterval(() => {
    const cm = collectedBeatsMap();
    showQuestHud(chapterId, cm);
    const q = QUESTS[chapterId];
    if (q && isQuestComplete(q.beats, q.needed, cm)) {
      checkQuestComplete(chapterId);
    }
  }, 500);
}

let _act3Started = false;
function checkQuestComplete(chapterId) {
  if (_act3Started) return;
  const q = QUESTS[chapterId];
  const cm = collectedBeatsMap();
  if (!q || !isQuestComplete(q.beats, q.needed, cm)) return;
  // Need NPC choice recorded AND quest complete
  if (window.__journeyV2.store.getChapter(chapterId).npcChoice == null) return;
  _act3Started = true;
  if (_questPollTimer) clearInterval(_questPollTimer);
  hideQuestHud();
  window.__journeyV2.store.send(chapterId, 'QUEST_COMPLETE');   // → closing
  initMinigame(chapterId, ({ score, label }) => {
    window.__journeyV2.store.setScore(chapterId, score);
    window.__journeyV2.store.send(chapterId, 'MINIGAME_DONE');  // → culminating
    const lbl = window.__journeyV1Bridge?.getChapterLabel?.(chapterId) ?? chapterId.toUpperCase();
    showCulmination(chapterId, lbl, () => {
      window.__journeyV2.store.send(chapterId, 'DISMISS');      // → complete
      _act3Started = false;
      _activeFlow = null;
    });
  });
}

// Polled from a setInterval that bootstrap starts.
function tickChapterFlow() {
  const id = detectActiveV2Chapter();
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
};


// === src/journey/data/culminations.js ===

const CULMINATIONS = {
  __placeholder: 'a placeholder culminating sentence that closes the chapter as one thread.',
  cmr: "the year you stopped sleeping. you didn't crack JEE. you also didn't break. that turned out to be the more useful skill.",
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