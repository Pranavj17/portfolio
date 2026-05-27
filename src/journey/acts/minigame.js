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
