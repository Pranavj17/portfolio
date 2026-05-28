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
