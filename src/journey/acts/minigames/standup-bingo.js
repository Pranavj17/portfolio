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
