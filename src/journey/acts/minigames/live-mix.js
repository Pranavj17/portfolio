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
