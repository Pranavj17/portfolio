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
