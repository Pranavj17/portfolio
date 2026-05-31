(() => {

'use strict';

// === src/journey/core.js ===

/**
 * v2 milestone orchestrator (room-as-milestone).
 *
 * The v1 game owns the world, parallax, walking, beats, and achievements. v2
 * sits on top and watches the v1 bridge to know which chapter band the player
 * is standing in. There is no longer a walk-by vignette — the Memory Room IS
 * the milestone. core.js shrank to a single job: when the player is in a
 * v2-enabled band and no room is open, show the deterministic "STEP INSIDE"
 * prompt wired to open that chapter's room.
 */
const JOURNEY_V2_VERSION = 2;

const V2_ENABLED_CHAPTERS = new Set(['cmr', 'itics', 'scripbox', 'now', 'sakha', 'college', 'fever104', 'vwgt']);

/**
 * Returns the v2 chapter id for the player's current world-x, or null if no v2
 * chapter is active. Reads window.__journeyV1Bridge populated by v1's loop.
 */
function detectActiveV2Chapter() {
  const b = window.__journeyV1Bridge;
  if (!b || !b.getCurrentChapterId) return null;
  const id = b.getCurrentChapterId();
  return V2_ENABLED_CHAPTERS.has(id) ? id : null;
}

/**
 * Polled (250ms from bootstrap). The ONLY job: manage the STEP-INSIDE prompt.
 *   - room open      → hide the prompt
 *   - in a v2 band   → show "STEP INSIDE · <label>", wire tap → openMemoryRoom
 *   - otherwise      → hide the prompt
 * Deterministic — no phase/completion gating, so the prompt appears EVERY time
 * the player stands at a milestone (fixes "sometimes shows up, sometimes not").
 */
function tickChapterFlow() {
  const id = detectActiveV2Chapter();
  const door = document.getElementById('v2-room-door');
  if (!door) return;

  if (typeof isRoomOpen === 'function' && isRoomOpen()) {
    door.setAttribute('aria-hidden', 'true');
    return;
  }

  if (id) {
    const label = (window.__journeyV1Bridge && window.__journeyV1Bridge.getChapterLabel
      && window.__journeyV1Bridge.getChapterLabel(id)) || id.toUpperCase();
    if (door.__chapter !== id) {
      door.__chapter = id;
      const labelEl = door.querySelector('.v2-room-door-label');
      if (labelEl) labelEl.textContent = 'STEP INSIDE · ' + label;
      door.onclick = () => {
        door.setAttribute('aria-hidden', 'true');
        if (typeof openMemoryRoom === 'function') openMemoryRoom(id);
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
  if (stored.v === 2) return migrateChapterRecords(stored);
  // v1 (or missing v): build chapters map from the collected set — every
  // collected chapter was a finished milestone, so it maps to visited+complete.
  const collected = Array.isArray(stored.collected) ? stored.collected : [];
  const chapters = {};
  for (const id of collected) {
    chapters[id] = { visited: true, complete: true, memoriesPlayed: [], score: null };
  }
  return { ...stored, v: 2, chapters };
}

/**
 * Upgrade v:2 chapter records from the old phase machine to the room-as-
 * milestone shape. `phase==='complete'` → {visited,complete:true};
 * `memoriesPlayed`/`score` are preserved. Records already in the new shape pass
 * through untouched. The schema version stays v:2 (no key bump).
 */
function migrateChapterRecords(stored) {
  const chapters = stored.chapters;
  if (!chapters || typeof chapters !== 'object') return stored;
  let changed = false;
  const next = {};
  for (const id of Object.keys(chapters)) {
    const rec = chapters[id] || {};
    if ('phase' in rec) {
      changed = true;
      const done = rec.phase === 'complete';
      next[id] = {
        visited: done || !!rec.roomVisited,
        complete: done,
        memoriesPlayed: Array.isArray(rec.memoriesPlayed) ? rec.memoriesPlayed : [],
        score: rec.score != null ? rec.score : null,
      };
    } else {
      next[id] = rec;
    }
  }
  return changed ? { ...stored, chapters: next } : stored;
}

function loadJourneyState(storage) {
  const raw = storage.getItem(JOURNEY_STORAGE_KEY);
  let parsed;
  try { parsed = raw ? JSON.parse(raw) : null; } catch (_) { parsed = null; }
  const migrated = migrateJourneyState(parsed);
  // write-back any migration so older visitors are upgraded on the next load
  // (covers both v1→v2 and old-v2-phase-records → room-as-milestone records).
  if (parsed && migrated !== parsed) {
    try { storage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(migrated)); } catch (_) {}
  }
  return migrated;
}

function saveJourneyState(storage, state) {
  try { storage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}


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

// Distinct, meaningful icon per quest beat — the primary source so every memory
// reads differently at a glance (v1 BEATS hints don't always match the quest ids,
// which made every frame fall back to the same generic 🖼️).
const MEMORY_ICONS = {
  // itics
  'football-match': '⚽', 'cricket-match': '🏏', 'sports-day': '🏅', 'assembly-stage': '🎤',
  // cmr
  'tuition-rush': '🛺', 'mock-test': '📝', 'study-lamp': '🪔', 'first-crush': '🌹',
  // college (DSCE)
  'bosch-intern': '🔧', 'abb-intern': '⚙️', 'fest-stage': '🎸', 'convocation': '🎓',
  // fever104
  'headphones': '🎧', 'script-binder': '📋', 'sound-engineer': '🎚️', 'trainee-cert': '📜',
  // sakha
  'interview-day': '🤝', 'first-paycheck': '💰', 'wfh-covid': '🏠', 'late-night-coding': '🌙',
  // scripbox
  'pr-review': '🔀', 'anthropic-catalog': '📚', 'claude-code': '🤖', 'whiteboard': '📊', 'anthropic-talk': '🎙️',
  // vwgt (the GT)
  'test-drive': '🚗', 'documents-signing': '✍️', 'keys-handover': '🔑', 'first-drive-out': '🛣️',
  // now
  'morning-routine': '☕', 'code-flow': '💻', 'anthropic-goal': '🎯', 'forward-horizon': '🌅',
};

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
      icon: MEMORY_ICONS[beatId] || (beat && beat.hint) || MEMORY_FALLBACK_ICON,
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

  // Guided-sequence copy. INTRO = the chapter's opening line(s) from CUTSCENES
  // (joined with the same ' · ' divider the rest of the room uses), falling back
  // to the era subtitle. CLOSING = the culmination paragraph.
  const cut = (typeof CUTSCENES !== 'undefined' && CUTSCENES[chapterId]) || null;
  const intro = (cut && Array.isArray(cut.lines) && cut.lines.length)
    ? cut.lines.join(' · ')
    : (meta.subtitle || meta.title);
  const closing = (typeof CULMINATIONS !== 'undefined'
    && (CULMINATIONS[chapterId] || CULMINATIONS.__placeholder)) || '';

  return {
    chapterId,
    title: meta.title,
    subtitle: meta.subtitle,
    palette: meta.palette,
    light: meta.light,
    moteCount: meta.motes,
    props,
    intro,
    closing,
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
 *   frame = { tMs, motes, hoverId, played:Set, reduced:bool, intro:0..1,
 *             activeIds:Set|null }
 *
 * activeIds drives the GUIDED sequence: when it's a Set, props NOT in it are
 * dimmed (low alpha, no glow/hover) so exactly the current step's interactable
 * stands out; props IN it draw at full strength. When null (free-explore on a
 * revisit), every prop draws normally — the original behaviour.
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
  // During a guided run, only props in activeIds are "live" this stage. The
  // window (decor light source) is always live so the room stays lit. Dimmed
  // props get reduced alpha and no glow/hover so the eye lands on the step.
  const guided = frame.activeIds instanceof Set;
  const dimmed = guided && prop.kind !== 'decor' && !frame.activeIds.has(prop.id);
  const hovered = !dimmed && frame.hoverId === prop.id;
  const played = prop.kind === 'memory' && frame.played && frame.played.has(prop.beat);

  if (hovered) { r = { ...r, w: r.w * 1.08, h: r.h * 1.08 }; }

  ctx.save();
  if (dimmed) ctx.globalAlpha = 0.32;

  // glow halo for interactable, unplayed / hovered props (skipped when dimmed)
  if (prop.kind !== 'decor' && !dimmed) {
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
  ctx.restore();
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
 * parallax camera, pointer/tilt input, the memory cards, the cinematic
 * enter/exit, and (new) the GUIDED SEQUENCER that makes the room itself the
 * milestone. The v1 overworld keeps running cheaply underneath an opaque
 * overlay; we only suppress its movement keys + shield its pointer listeners
 * while a room is open, then resume the player exactly where they were (no v1
 * surgery, lowest regression risk).
 *
 * Guided sequence (first visit, store.getChapter(id).complete === false):
 *   intro → memories → play → close → exit
 * Exactly one step's prop(s) are lit + hittable at a time (sess.activeIds); the
 * renderer dims the rest. A revisit (complete === true) runs free-explore: all
 * props live, no forced order. The pure advance rule lives in
 * nextRoomStage()/computeActiveIds() so it's unit-testable without a DOM.
 */
const MOVE_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar',
  'w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'h', 'H',
]);

const ROOM_STAGES = ['intro', 'memories', 'play', 'close', 'exit'];
const INTRO_AUTO_MS = 2600;

let _room = null;   // active session or null

function roomStore() { return window.__journeyV2 && window.__journeyV2.store; }
function isRoomOpen() { return !!_room; }

// ---------------------------------------------------------------------------
// Pure stage logic (no DOM) — unit-tested in tests/unit/room-sequence.test.js.
// ---------------------------------------------------------------------------

/** Next stage after `stage`, or the same stage if already at the end. */
function nextRoomStage(stage) {
  const i = ROOM_STAGES.indexOf(stage);
  if (i < 0) return ROOM_STAGES[0];
  return i >= ROOM_STAGES.length - 1 ? ROOM_STAGES[i] : ROOM_STAGES[i + 1];
}

/** Ids of the memory props in a room descriptor. */
function memoryPropIds(room) {
  return room.props.filter(p => p.kind === 'memory').map(p => p.id);
}

/**
 * The set of prop ids that are lit + hittable for a stage. `played` is the Set
 * of beat ids already viewed (a memory prop's id === its beat id here).
 *   intro    → none (room dim, just the intro line)
 *   memories → all memory props
 *   play     → the arcade
 *   close    → the projector screen
 *   exit     → the exit door
 */
function computeActiveIds(stage, room) {
  switch (stage) {
    case 'memories': return new Set(memoryPropIds(room));
    case 'play':     return new Set(['arcade']);
    case 'close':    return new Set(['screen']);
    case 'exit':     return new Set(['exit']);
    case 'intro':
    default:         return new Set();
  }
}

/**
 * True when the `memories` stage is satisfied — every memory beat has been
 * played (or there are no memory props at all, so the stage is trivially done).
 */
function memoriesStageComplete(room, played) {
  const ids = memoryPropIds(room);
  if (ids.length === 0) return true;
  return ids.every(id => played.has(id));
}

// ---------------------------------------------------------------------------
// Open / lifecycle
// ---------------------------------------------------------------------------

function openMemoryRoom(chapterId) {
  if (_room) return;
  const overlay = document.getElementById('v2-room');
  const canvas = document.getElementById('v2-room-canvas');
  if (!overlay || !canvas) return;

  const room = buildRoom(chapterId);
  const store = roomStore();
  const rec = store ? store.getChapter(chapterId) : {};
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // First visit runs the guided sequence; a completed chapter is free-explore.
  const guided = !rec.complete;

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
    // guided sequencer
    guided,
    stage: guided ? 'intro' : null,
    activeIds: null,        // null === free-explore (all props live)
    introTimer: null,
  };
  _room = sess;

  sizeCanvas(sess);
  if (store && store.markVisited) store.markVisited(chapterId);

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

  // --- taps select props (guided: only active-stage props; free: any) ---
  sess.detachInput = attachInputRouter(canvas, (gesture) => {
    if (sess.cardOpen) return;            // card eats the next tap (handled by card)
    if (gesture.kind !== 'TAP' && gesture.kind !== 'HOLD') return;
    // INTRO + CLOSE are "reading" steps with a single forward action — any tap
    // continues (the close clip plays an overlay on top, so requiring a precise
    // prop tap there was a dead-end). Memories/play/exit still need a real prop.
    if (sess.guided && (sess.stage === 'intro' || sess.stage === 'close')) { advanceStage(sess); return; }
    const layout = roomLayout(canvas.width, canvas.height, sess.cam);
    const hit = hitTestProps(sess.room.props, gesture.x, gesture.y, layout);
    if (!hit) return;
    // During a guided run ignore props that aren't lit this stage.
    if (sess.guided && sess.activeIds && !sess.activeIds.has(hit.id)) return;
    handleProp(sess, hit);
  });
  // hover highlight on desktop
  sess.handlers.hover = (e) => {
    const layout = roomLayout(canvas.width, canvas.height, sess.cam);
    const pt = canvasPoint(canvas.getBoundingClientRect(), canvas.width, canvas.height, e.clientX, e.clientY);
    const hit = hitTestProps(sess.room.props, pt.x, pt.y, layout);
    const liveHit = hit && (!sess.guided || !sess.activeIds || sess.activeIds.has(hit.id)) ? hit : null;
    sess.hoverId = liveHit ? liveHit.id : null;
    canvas.style.cursor = liveHit ? 'pointer' : 'default';
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

  // skip affordance — never a hard gate; advances the current guided stage.
  const skip = document.getElementById('v2-room-skip');
  if (skip) {
    sess.handlers.skip = (e) => { e.stopPropagation(); if (sess.guided) advanceStage(sess); };
    skip.addEventListener('click', sess.handlers.skip);
  }

  startRoomAudio(sess);

  if (sess.guided) enterStage(sess, 'intro');
  else setRoomHint(sess, 'tap a memory · play · the door takes you back');

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
  // skip chip only matters during a guided run
  const skip = document.getElementById('v2-room-skip');
  if (skip) skip.setAttribute('aria-hidden', sess.guided ? 'false' : 'true');
}

function setRoomHint(sess, text) {
  const el = document.getElementById('v2-room-hint');
  if (el) el.textContent = text || '';
}

function updateRoomProgress(sess) {
  const pEl = document.getElementById('v2-room-progress');
  if (!pEl) return;
  const total = sess.room.props.filter(p => p.kind === 'memory').length;
  const done = sess.room.props.filter(p => p.kind === 'memory' && sess.played.has(p.beat)).length;
  pEl.textContent = total ? `memories · ${done} / ${total}` : '';
}

// ---------------------------------------------------------------------------
// Guided stage machine (DOM side; pure rules live above)
// ---------------------------------------------------------------------------

/** Show a big centered line (intro / closing) over the dim room. */
function showRoomLine(sess, text) {
  const el = document.getElementById('v2-room-line');
  if (!el) return;
  el.textContent = text || '';
  el.setAttribute('aria-hidden', text ? 'false' : 'true');
}
function hideRoomLine() {
  const el = document.getElementById('v2-room-line');
  if (el) el.setAttribute('aria-hidden', 'true');
}

/** Enter a guided stage: set activeIds, hints, and any side effects. */
function enterStage(sess, stage) {
  sess.stage = stage;
  sess.activeIds = computeActiveIds(stage, sess.room);
  if (sess.introTimer) { clearTimeout(sess.introTimer); sess.introTimer = null; }
  hideRoomLine();

  switch (stage) {
    case 'intro':
      showRoomLine(sess, sess.room.intro);
      setRoomHint(sess, 'tap to begin');
      if (!sess.reduced) sess.introTimer = setTimeout(() => { if (_room === sess) advanceStage(sess); }, INTRO_AUTO_MS);
      break;
    case 'memories': {
      const total = memoryPropIds(sess.room).length;
      const done = memoryPropIds(sess.room).filter(id => sess.played.has(id)).length;
      setRoomHint(sess, `tap the glowing memories · ${done}/${total}`);
      // Player may have already seen every memory on a prior partial visit.
      if (memoriesStageComplete(sess.room, sess.played)) advanceStage(sess);
      break;
    }
    case 'play':
      setRoomHint(sess, 'play this moment ▸  ·  skip ▸');
      break;
    case 'close':
      setRoomHint(sess, 'the closing word · tap anywhere to continue ▸');
      // Auto-play the stage clip + settle the closing line.
      {
        const playVid = window.__journeyV1Bridge && window.__journeyV1Bridge.playStageVideo;
        const label = (window.__journeyV1Bridge && window.__journeyV1Bridge.getChapterLabel
          && window.__journeyV1Bridge.getChapterLabel(sess.chapterId)) || sess.room.title;
        if (typeof playVid === 'function') { try { playVid(sess.chapterId, label); } catch (_) {} }
      }
      showRoomLine(sess, sess.room.closing);
      break;
    case 'exit':
      setRoomHint(sess, 'step back out ▸');
      break;
  }
}

/** Advance to the next guided stage. At `exit` this completes + closes. */
function advanceStage(sess) {
  if (!sess.guided) return;
  if (sess.stage === 'exit') { finishGuided(sess); return; }
  enterStage(sess, nextRoomStage(sess.stage));
}

/** Mark the chapter complete and leave the room (end of the guided run). */
function finishGuided(sess) {
  const store = roomStore();
  if (store && store.markComplete) store.markComplete(sess.chapterId);
  maybeShowEndCard();
  closeMemoryRoom();
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
    activeIds: sess.guided ? sess.activeIds : null,
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
      // In the guided run, all memories seen → advance to PLAY.
      if (sess.guided && sess.stage === 'memories') {
        const total = memoryPropIds(sess.room).length;
        const done = memoryPropIds(sess.room).filter(id => sess.played.has(id)).length;
        setRoomHint(sess, `tap the glowing memories · ${done}/${total}`);
        if (memoriesStageComplete(sess.room, sess.played)) {
          // advance once the card is dismissed (handled in closeRoomCard).
          sess.pendingAdvance = true;
        }
      }
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
          if (sess.guided && sess.stage === 'play' && _room === sess) advanceStage(sess);
        });
      } else if (sess.guided && sess.stage === 'play') {
        advanceStage(sess);
      }
      break;
    case 'video': {
      const playVid = window.__journeyV1Bridge && window.__journeyV1Bridge.playStageVideo;
      const label = (window.__journeyV1Bridge && window.__journeyV1Bridge.getChapterLabel
        && window.__journeyV1Bridge.getChapterLabel(sess.chapterId)) || sess.room.title;
      if (typeof playVid === 'function') { try { playVid(sess.chapterId, label); } catch (_) {} }
      // In the guided run the screen is the CLOSE step → advance to EXIT.
      if (sess.guided && sess.stage === 'close') advanceStage(sess);
      break;
    }
    case 'exit':
      if (sess.guided) advanceStage(sess);   // exit stage → finishGuided
      else closeMemoryRoom();
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
  setTimeout(() => {
    if (_room !== sess) return;
    sess.cardOpen = false;
    // memories-stage auto-advance once the last memory card is dismissed.
    if (sess.pendingAdvance) { sess.pendingAdvance = false; advanceStage(sess); }
  }, 60);
}

function closeMemoryRoom() {
  const sess = _room;
  if (!sess) return;

  const finish = () => {
    if (sess.raf) cancelAnimationFrame(sess.raf);
    if (sess.introTimer) clearTimeout(sess.introTimer);
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
    const skip = document.getElementById('v2-room-skip');
    if (skip && sess.handlers.skip) skip.removeEventListener('click', sess.handlers.skip);
    if (skip) skip.setAttribute('aria-hidden', 'true');
    hideRoomLine();
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
      activeIds: sess.guided ? sess.activeIds : null,
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

// --- Memory Rooms picker — an always-available list so the feature is easy to
// find. Lives in the HUD the whole time and lets you jump into any room you've
// entered. Visited rooms re-open in free-explore. ---
const ROOM_ORDER = ['itics', 'cmr', 'college', 'fever104', 'sakha', 'scripbox', 'vwgt', 'now'];

function openRoomPicker() {
  if (_room) return;                       // not while already inside a room
  const picker = document.getElementById('v2-rooms-picker');
  const list = document.getElementById('v2-rooms-list');
  if (!picker || !list) return;
  const store = roomStore();
  const anyVisited = ROOM_ORDER.some(id => store && store.getChapter(id).visited);
  list.innerHTML = ROOM_ORDER.map(id => {
    const meta = (typeof ROOM_META !== 'undefined' && (ROOM_META[id] || ROOM_META.__default)) || { title: id, subtitle: '' };
    const ch = store ? store.getChapter(id) : {};
    const visited = !!ch.visited;
    const done = !!ch.complete;
    return `<button class="v2-room-pick${visited ? '' : ' locked'}" data-room="${id}"${visited ? '' : ' disabled'}>
        <span class="v2-room-pick-name">${meta.title}</span>
        <span class="v2-room-pick-sub">${visited ? (meta.subtitle || '') : 'step inside on the walk to unlock'}</span>
        <span class="v2-room-pick-cta">${visited ? (done ? '↺ revisit' : 'continue ▸') : '🔒'}</span>
      </button>`;
  }).join('');
  const hint = document.getElementById('v2-rooms-hint');
  if (hint) hint.textContent = anyVisited
    ? 'tap a room to step back inside'
    : 'reach a milestone on the walk to step into its memory room';
  list.querySelectorAll('.v2-room-pick:not(.locked)').forEach(btn => {
    btn.onclick = () => { closeRoomPicker(); openMemoryRoom(btn.getAttribute('data-room')); };
  });
  picker.setAttribute('aria-hidden', 'false');
}

function closeRoomPicker() {
  const picker = document.getElementById('v2-rooms-picker');
  if (picker) picker.setAttribute('aria-hidden', 'true');
}

// --- End card — when every V2_ENABLED_CHAPTERS room is complete, show a short
// "the journey, complete" card. Checked after each markComplete. ---
function allChaptersComplete() {
  const store = roomStore();
  if (!store) return false;
  const ids = (typeof V2_ENABLED_CHAPTERS !== 'undefined') ? Array.from(V2_ENABLED_CHAPTERS) : [];
  return ids.length > 0 && ids.every(id => store.getChapter(id).complete);
}

function maybeShowEndCard() {
  if (!allChaptersComplete()) return;
  const end = document.getElementById('v2-end');
  if (!end) return;
  end.setAttribute('aria-hidden', 'false');
  if (!end.__wired) {
    end.__wired = true;
    const close = document.getElementById('v2-end-close');
    const dismiss = () => end.setAttribute('aria-hidden', 'true');
    if (close) close.onclick = (e) => { e.stopPropagation(); dismiss(); };
    end.addEventListener('click', (e) => { if (e.target === end) dismiss(); });
  }
}


// === src/journey/bootstrap.js ===

/**
 * Wires v2 to the page: exposes the API on window.__journeyV2, shows the
 * one-time onboarding intro card, wires the always-visible "memory rooms"
 * picker button, and starts the STEP-INSIDE prompt poll.
 *
 * v1 (journey.js) owns the world + walking and populates window.__journeyV1Bridge
 * from inside its IIFE; v2 reads from it. The room IS the milestone now — there
 * is no walk-by vignette layer.
 */
window.__journeyV2 = {
  initMinigame,
  store: createChapterStore(window.localStorage),
  // chapter detection + prompt poll
  detectActiveV2Chapter,
  tickChapterFlow,
  // Memory Room API
  openMemoryRoom,
  closeMemoryRoom,
  isRoomOpen,
  buildRoom,
  openRoomPicker,
  closeRoomPicker,
};

// Onboarding intro card — shown once per browser (localStorage flag). Two lines:
// what this is + how to move, then "tap to begin". Dismiss writes the flag so
// returning visitors go straight to the walk.
(function wireIntroCard() {
  const intro = document.getElementById('v2-intro');
  if (!intro) return;
  let seen = false;
  try { seen = !!window.localStorage.getItem('journey_intro_seen'); } catch (_) {}
  if (seen) { intro.setAttribute('aria-hidden', 'true'); return; }
  intro.setAttribute('aria-hidden', 'false');
  const dismiss = () => {
    intro.setAttribute('aria-hidden', 'true');
    try { window.localStorage.setItem('journey_intro_seen', '1'); } catch (_) {}
    intro.removeEventListener('click', dismiss);
  };
  intro.addEventListener('click', dismiss);
})();

// Memory-Rooms picker button — always visible once v2 is loaded so the rooms
// are discoverable from anywhere, not just by stumbling onto the prompt.
(function wireRoomsButton() {
  const btn = document.getElementById('v2-rooms-btn');
  if (btn) { btn.setAttribute('aria-hidden', 'false'); btn.onclick = openRoomPicker; }
  const picker = document.getElementById('v2-rooms-picker');
  if (picker) {
    picker.addEventListener('click', (e) => { if (e.target === picker) closeRoomPicker(); });
    const close = document.getElementById('v2-rooms-close');
    if (close) close.onclick = closeRoomPicker;
  }
})();

// Poll for the milestone band → STEP-INSIDE prompt. The bridge is filled by
// v1's IIFE; until then detectActiveV2Chapter returns null and the prompt stays
// hidden.
setInterval(tickChapterFlow, 250);


})();