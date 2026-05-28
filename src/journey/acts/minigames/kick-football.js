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
