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
