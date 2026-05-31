// === src/journey/room/render.js ===
/**
 * Memory Room renderer. Pure-ish: draws a room descriptor onto a 2D context for
 * the current frame. No state of its own — the controller owns the loop, camera,
 * motes and hover/played sets and hands them in via `frame`. All art is
 * procedural canvas (no image assets) to honour the overworld's zero-extra-
 * request constraint, layered far→near with a volumetric light shaft, drifting
 * motes, and per-prop bloom so it reads as a lit 3D space.
 *
 *   frame = { tMs, motes, hoverId, played:Set, reduced:bool, intro:0..1,
 *             activeIds:Set|null }
 *
 * activeIds drives the GUIDED sequence: when it's a Set, props NOT in it are
 * dimmed (low alpha, no glow/hover) so exactly the current step's interactable
 * stands out; props IN it draw at full strength. When null (free-explore on a
 * revisit), every prop draws normally — the original behaviour.
 */
function drawRoom(ctx, room, layout, frame) {
  const W = layout.canvasW, H = layout.canvasH;
  const p = room.palette;
  const t = frame.tMs || 0;
  const reduced = !!frame.reduced;

  // 1 · back wall — vertical era-tinted gradient + soft corner darkening.
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, p.wall1);
  wall.addColorStop(1, p.wall2);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);

  // 2 · floor — lower third, darker, with a faint reflective sheen line.
  const floorTop = H * 0.66;
  const floor = ctx.createLinearGradient(0, floorTop, 0, H);
  floor.addColorStop(0, p.wall2);
  floor.addColorStop(1, p.floor);
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorTop, W, H - floorTop);
  ctx.strokeStyle = 'rgba(212,166,83,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, floorTop); ctx.lineTo(W, floorTop); ctx.stroke();

  // window screen position (light origin), used by the shaft + motes.
  const win = room.props.find(pr => pr.id === 'window');
  const winRect = win ? propScreenRect(win, layout) : { cx: W * 0.2, cy: H * 0.25, w: 200, h: 200 };

  // 3 · volumetric light shaft — additive warm cone from the window, with a
  // slow breathing intensity. Skipped flat in reduced-motion.
  drawLightShaft(ctx, W, H, winRect, p, room.light, reduced ? 0.5 : 0.5 + 0.12 * Math.sin(t / 1400));

  // 4 · props, far → near. Draw decor first within that ordering anyway.
  const ordered = room.props.slice().sort((a, b) => (a.depth || 0) - (b.depth || 0));

  // motes live between the far wall and the near furniture (drawn after the
  // far screen/window, before the near interactables) — split the prop list.
  let motesDrawn = false;
  for (const prop of ordered) {
    if (!motesDrawn && (prop.depth || 0) >= 0.4) {
      drawMotes(ctx, W, H, frame.motes, winRect, p.accent);
      motesDrawn = true;
    }
    drawProp(ctx, prop, layout, frame, p, t);
  }
  if (!motesDrawn) drawMotes(ctx, W, H, frame.motes, winRect, p.accent);

  // 5 · vignette — period-photo corner darkening (over everything in the room).
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.30, W / 2, H / 2, Math.max(W, H) * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(8,5,2,0.62)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // 6 · iris-in transition overlay (a closing/opening circular mask).
  if (frame.intro != null && frame.intro < 1) {
    const r = Math.max(W, H) * (0.05 + easeOutCubic(frame.intro) * 1.05);
    ctx.save();
    ctx.fillStyle = 'rgba(8,5,2,1)';
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2, true);   // counter-clockwise → punch a hole
    ctx.fill('evenodd');
    ctx.restore();
  }
}

function drawLightShaft(ctx, W, H, winRect, p, light, intensity) {
  const ox = winRect.cx, oy = winRect.cy;
  const spread = winRect.w * 1.1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(ox, oy, ox + W * 0.5, H);
  const warm = (light && light.warmth) || 1;
  g.addColorStop(0, `rgba(${Math.round(240 * warm)}, ${Math.round(205 * warm)}, ${Math.round(140 * warm)}, ${0.30 * intensity})`);
  g.addColorStop(1, 'rgba(120,80,30,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(ox - spread * 0.35, oy);
  ctx.lineTo(ox + spread * 0.35, oy);
  ctx.lineTo(ox + W * 0.62, H);
  ctx.lineTo(ox - W * 0.10, H);
  ctx.closePath();
  ctx.fill();
  // bright bloom at the window mouth
  const b = ctx.createRadialGradient(ox, oy, 2, ox, oy, spread);
  b.addColorStop(0, `rgba(255,235,180,${0.34 * intensity})`);
  b.addColorStop(1, 'rgba(255,235,180,0)');
  ctx.fillStyle = b;
  ctx.fillRect(ox - spread, oy - spread, spread * 2, spread * 2);
  ctx.restore();
}

function drawMotes(ctx, W, H, motes, winRect, accent) {
  if (!motes) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const m of motes) {
    const x = m.x * W + Math.sin(m.phase) * m.amp * W;
    const y = m.y * H;
    // brighter the closer to the shaft centre line
    const dx = (x - winRect.cx) / W;
    const near = Math.max(0, 1 - Math.abs(dx) * 1.8);
    const a = m.a * (0.35 + near * 0.65);
    ctx.fillStyle = `rgba(247,232,188,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawProp(ctx, prop, layout, frame, palette, t) {
  let r = propScreenRect(prop, layout);
  // During a guided run, only props in activeIds are "live" this stage. The
  // window (decor light source) is always live so the room stays lit. Dimmed
  // props get reduced alpha and no glow/hover so the eye lands on the step.
  const guided = frame.activeIds instanceof Set;
  const dimmed = guided && prop.kind !== 'decor' && !frame.activeIds.has(prop.id);
  const hovered = !dimmed && frame.hoverId === prop.id;
  const played = prop.kind === 'memory' && frame.played && frame.played.has(prop.beat);

  if (hovered) { r = { ...r, w: r.w * 1.08, h: r.h * 1.08 }; }

  ctx.save();
  if (dimmed) ctx.globalAlpha = 0.32;

  // glow halo for interactable, unplayed / hovered props (skipped when dimmed)
  if (prop.kind !== 'decor' && !dimmed) {
    const pulse = 0.5 + 0.5 * Math.sin(t / 600 + (prop.x || 0));
    const baseA = played ? 0.10 : (hovered ? 0.55 : 0.22 + pulse * 0.16);
    drawHalo(ctx, r.cx, r.cy, Math.max(r.w, r.h) * (hovered ? 0.95 : 0.8), palette.accent, baseA);
  }

  switch (prop.draw) {
    case 'window':  drawWindowSprite(ctx, r, palette); break;
    case 'screen':  drawScreenSprite(ctx, r, palette, t); break;
    case 'arcade':  drawArcadeSprite(ctx, r, palette, t); break;
    case 'journal': drawJournalSprite(ctx, r, palette); break;
    case 'door':    drawDoorSprite(ctx, r, palette, t); break;
    case 'frame':
    default:        drawFrameSprite(ctx, r, palette, prop, played, hovered); break;
  }

  // floating label on hover
  if (hovered && prop.title) {
    drawLabel(ctx, r.cx, r.cy - r.h / 2 - 16, prop.title);
  }
  ctx.restore();
}

function drawHalo(ctx, x, y, radius, color, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 1, x, y, radius);
  g.addColorStop(0, hexA(color, alpha));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function rr(ctx, x, y, w, h, rad) {
  const r = Math.min(rad, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFrameSprite(ctx, r, p, prop, played, hovered) {
  const x = r.cx - r.w / 2, y = r.cy - r.h / 2, w = r.w, h = r.h;
  // drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  rr(ctx, x + 4, y + 6, w, h, 6); ctx.fill();
  // outer frame
  const fg = ctx.createLinearGradient(x, y, x, y + h);
  fg.addColorStop(0, '#6b3a1f'); fg.addColorStop(1, p.frame);
  ctx.fillStyle = fg; rr(ctx, x, y, w, h, 6); ctx.fill();
  // inner mat (parchment)
  const m = w * 0.12;
  const mat = ctx.createLinearGradient(x, y, x, y + h);
  mat.addColorStop(0, '#e9d8b0'); mat.addColorStop(1, '#c9b58c');
  ctx.fillStyle = mat; rr(ctx, x + m, y + m, w - 2 * m, h - 2 * m, 3); ctx.fill();
  // icon
  ctx.save();
  ctx.globalAlpha = played ? 0.55 : 1;
  ctx.font = `${Math.round(h * 0.40)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(prop.icon || '🖼️', r.cx, r.cy - h * 0.04);
  ctx.restore();
  // played wax seal ✓ / unplayed shimmer dot
  if (played) {
    ctx.fillStyle = '#7a1f12';
    ctx.beginPath(); ctx.arc(r.cx, y + h - m - 4, h * 0.10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e9d8b0'; ctx.font = `${Math.round(h * 0.12)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✓', r.cx, y + h - m - 4);
  } else {
    ctx.fillStyle = hovered ? p.accent : 'rgba(212,166,83,0.85)';
    ctx.beginPath(); ctx.arc(r.cx, y + h - m - 2, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.textBaseline = 'alphabetic';
}

function drawScreenSprite(ctx, r, p, t) {
  const x = r.cx - r.w / 2, y = r.cy - r.h / 2, w = r.w, h = r.h;
  ctx.fillStyle = '#0a0a0c'; rr(ctx, x, y, w, h, 4); ctx.fill();
  ctx.strokeStyle = p.frame; ctx.lineWidth = 3; rr(ctx, x, y, w, h, 4); ctx.stroke();
  // soft projector glow
  const g = ctx.createRadialGradient(r.cx, r.cy, 2, r.cx, r.cy, w * 0.6);
  g.addColorStop(0, hexA(p.accent, 0.30)); g.addColorStop(1, hexA(p.accent, 0));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // scanlines
  ctx.strokeStyle = 'rgba(255,235,180,0.05)';
  for (let yy = y + 4; yy < y + h; yy += 5) { ctx.beginPath(); ctx.moveTo(x + 3, yy); ctx.lineTo(x + w - 3, yy); ctx.stroke(); }
  // play glyph
  ctx.fillStyle = hexA(p.accent, 0.9);
  const s = h * 0.22;
  ctx.beginPath(); ctx.moveTo(r.cx - s * 0.5, r.cy - s); ctx.lineTo(r.cx - s * 0.5, r.cy + s); ctx.lineTo(r.cx + s, r.cy); ctx.closePath(); ctx.fill();
}

function drawArcadeSprite(ctx, r, p, t) {
  const x = r.cx - r.w / 2, y = r.cy - r.h / 2, w = r.w, h = r.h;
  // body
  ctx.fillStyle = '#241712'; rr(ctx, x, y, w, h, 6); ctx.fill();
  ctx.strokeStyle = p.frame; ctx.lineWidth = 2; rr(ctx, x, y, w, h, 6); ctx.stroke();
  // marquee
  const mg = ctx.createLinearGradient(x, y, x, y + h * 0.16);
  mg.addColorStop(0, p.accent); mg.addColorStop(1, '#8a5a1a');
  ctx.fillStyle = mg; rr(ctx, x + 6, y + 6, w - 12, h * 0.14, 3); ctx.fill();
  // screen
  ctx.fillStyle = '#05060a'; ctx.fillRect(x + 10, y + h * 0.22, w - 20, h * 0.34);
  const sg = ctx.createRadialGradient(r.cx, y + h * 0.39, 2, r.cx, y + h * 0.39, w * 0.5);
  const flick = 0.5 + 0.3 * Math.sin(t / 220);
  sg.addColorStop(0, hexA(p.accent, 0.35 * flick)); sg.addColorStop(1, hexA(p.accent, 0));
  ctx.fillStyle = sg; ctx.fillRect(x + 10, y + h * 0.22, w - 20, h * 0.34);
  // control panel + joystick
  ctx.fillStyle = '#1a110b'; ctx.fillRect(x + 8, y + h * 0.60, w - 16, h * 0.22);
  ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(x + w * 0.35, y + h * 0.71, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a4332e'; ctx.beginPath(); ctx.arc(x + w * 0.6, y + h * 0.71, 5, 0, Math.PI * 2); ctx.fill();
}

function drawJournalSprite(ctx, r, p) {
  const x = r.cx - r.w / 2, y = r.cy - r.h / 2, w = r.w, h = r.h;
  // lectern
  ctx.fillStyle = '#2a1a10'; ctx.beginPath();
  ctx.moveTo(r.cx - w * 0.30, y + h); ctx.lineTo(r.cx + w * 0.30, y + h);
  ctx.lineTo(r.cx + w * 0.42, y + h * 0.55); ctx.lineTo(r.cx - w * 0.42, y + h * 0.55); ctx.closePath(); ctx.fill();
  // open book — two pages
  ctx.fillStyle = '#e9d8b0';
  ctx.beginPath(); ctx.moveTo(r.cx, y + h * 0.30); ctx.lineTo(x + 6, y + h * 0.40);
  ctx.lineTo(x + 10, y + h * 0.62); ctx.lineTo(r.cx, y + h * 0.55); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(r.cx, y + h * 0.30); ctx.lineTo(x + w - 6, y + h * 0.40);
  ctx.lineTo(x + w - 10, y + h * 0.62); ctx.lineTo(r.cx, y + h * 0.55); ctx.closePath(); ctx.fill();
  // text lines
  ctx.strokeStyle = 'rgba(90,46,26,0.5)'; ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const ly = y + h * (0.40 + i * 0.05);
    ctx.beginPath(); ctx.moveTo(x + 12, ly); ctx.lineTo(r.cx - 6, ly + h * 0.012); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r.cx + 6, ly); ctx.lineTo(x + w - 12, ly + h * 0.012); ctx.stroke();
  }
}

function drawDoorSprite(ctx, r, p, t) {
  const x = r.cx - r.w / 2, y = r.cy - r.h / 2, w = r.w, h = r.h;
  // frame
  ctx.fillStyle = '#2a1a10'; rr(ctx, x, y, w, h, 4); ctx.fill();
  // door ajar — warm light spilling
  const lg = ctx.createLinearGradient(x + w * 0.2, y, x + w, y);
  lg.addColorStop(0, '#3a2616'); lg.addColorStop(1, hexA('#f0c878', 0.9));
  ctx.fillStyle = lg; ctx.fillRect(x + w * 0.18, y + 8, w * 0.7, h - 16);
  // glow from the gap
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x + w * 0.85, r.cy, 2, x + w * 0.85, r.cy, h * 0.6);
  const pulse = 0.6 + 0.25 * Math.sin(t / 700);
  g.addColorStop(0, hexA('#ffdf9a', 0.5 * pulse)); g.addColorStop(1, hexA('#ffdf9a', 0));
  ctx.fillStyle = g; ctx.fillRect(x, y, w * 1.5, h); ctx.restore();
  // arrow glyph
  ctx.fillStyle = '#2a1a10'; ctx.font = `${Math.round(h * 0.14)}px 'Cinzel', serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('→', x + w * 0.52, r.cy);
}

function drawWindowSprite(ctx, r, p) {
  const x = r.cx - r.w / 2, y = r.cy - r.h / 2, w = r.w, h = r.h;
  // bright sky behind panes (the light source)
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#fff0cf'); sky.addColorStop(1, '#e6b066');
  ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
  // muntin bars
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = Math.max(3, w * 0.03);
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath(); ctx.moveTo(r.cx, y); ctx.lineTo(r.cx, y + h);
  ctx.moveTo(x, r.cy); ctx.lineTo(x + w, r.cy); ctx.stroke();
  // outer bloom
  drawHalo(ctx, r.cx, r.cy, w * 0.9, '#ffe9b0', 0.30);
}

function drawLabel(ctx, x, y, text) {
  ctx.save();
  ctx.font = "600 13px 'Cinzel', serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width + 22;
  ctx.fillStyle = 'rgba(20,12,6,0.86)';
  rr(ctx, x - tw / 2, y - 13, tw, 24, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(212,166,83,0.6)'; ctx.lineWidth = 1; rr(ctx, x - tw / 2, y - 13, tw, 24, 4); ctx.stroke();
  ctx.fillStyle = '#e9d8b0';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

/** hex (#rrggbb) + alpha → rgba() string. Tolerates already-rgba input. */
function hexA(hex, a) {
  if (typeof hex !== 'string' || hex[0] !== '#') return `rgba(212,166,83,${a})`;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
