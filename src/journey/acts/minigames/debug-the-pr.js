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
