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
    // INTRO: any tap dismisses the opening line and advances.
    if (sess.guided && sess.stage === 'intro') { advanceStage(sess); return; }
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
      setRoomHint(sess, 'the reel ▸');
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
