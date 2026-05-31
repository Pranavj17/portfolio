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

// --- Memory Rooms picker — an always-available list so the feature is easy to
// find. The in-world door alone was too easy to miss; this button lives in the
// HUD the whole time and lets you jump into any room you've unlocked. ---
const ROOM_ORDER = ['itics', 'cmr', 'college', 'fever104', 'sakha', 'scripbox', 'vwgt', 'now'];

function openRoomPicker() {
  if (_room) return;                       // not while already inside a room
  const picker = document.getElementById('v2-rooms-picker');
  const list = document.getElementById('v2-rooms-list');
  if (!picker || !list) return;
  const store = roomStore();
  const anyOpen = ROOM_ORDER.some(id => store && store.getChapter(id).phase === 'complete');
  list.innerHTML = ROOM_ORDER.map(id => {
    const meta = (typeof ROOM_META !== 'undefined' && (ROOM_META[id] || ROOM_META.__default)) || { title: id, subtitle: '' };
    const ch = store ? store.getChapter(id) : {};
    const done = ch.phase === 'complete';
    const visited = !!ch.roomVisited;
    return `<button class="v2-room-pick${done ? '' : ' locked'}" data-room="${id}"${done ? '' : ' disabled'}>
        <span class="v2-room-pick-name">${meta.title}</span>
        <span class="v2-room-pick-sub">${done ? (meta.subtitle || '') : 'finish this milestone to unlock'}</span>
        <span class="v2-room-pick-cta">${done ? (visited ? '↺ revisit' : 'enter ▸') : '🔒'}</span>
      </button>`;
  }).join('');
  const hint = document.getElementById('v2-rooms-hint');
  if (hint) hint.textContent = anyOpen
    ? 'tap a room to step inside'
    : 'complete a milestone on the walk to unlock its memory room';
  list.querySelectorAll('.v2-room-pick:not(.locked)').forEach(btn => {
    btn.onclick = () => { closeRoomPicker(); openMemoryRoom(btn.getAttribute('data-room')); };
  });
  picker.setAttribute('aria-hidden', 'false');
}

function closeRoomPicker() {
  const picker = document.getElementById('v2-rooms-picker');
  if (picker) picker.setAttribute('aria-hidden', 'true');
}
