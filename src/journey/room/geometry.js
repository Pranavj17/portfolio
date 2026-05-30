// === src/journey/room/geometry.js ===
/**
 * Pure geometry for the Memory Room.
 *
 * A room is authored in a fixed virtual space (ROOM_W × ROOM_H). The renderer
 * maps that space onto whatever canvas the device has, with a parallax camera
 * that pans a little toward the pointer / device-tilt to sell depth. EVERY tap
 * is hit-tested through propScreenRect, so what you can touch is exactly what
 * you see — no matter the screen size. All functions here are pure (no DOM) so
 * they're unit-tested without a browser.
 */
const ROOM_W = 1000;
const ROOM_H = 600;
const ROOM_OVERSCAN = 1.08;   // draw a touch larger than fit so parallax never reveals an edge
const CAM_PARALLAX_PX = 48;   // max room-space camera shift from a full pointer deflection

function clampUnit(v) { return v < -1 ? -1 : (v > 1 ? 1 : v); }
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOutCubic(t) { const u = 1 - t; return 1 - u * u * u; }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

/**
 * depth 0 = far wall (barely moves), 1 = foreground (moves most with camera).
 * Near things parallax more than far things — the core depth cue.
 */
function parallaxFactor(depth) { return 0.25 + depth * 0.75; }

/**
 * Per-frame mapping from room space to canvas space.
 *   cam = { x, y } pointer-normalized in [-1,1].
 */
function roomLayout(canvasW, canvasH, cam) {
  const scale = Math.min(canvasW / ROOM_W, canvasH / ROOM_H) * ROOM_OVERSCAN;
  return {
    canvasW, canvasH, scale,
    originX: canvasW / 2,
    originY: canvasH / 2,
    camX: (cam && cam.x ? cam.x : 0) * CAM_PARALLAX_PX,
    camY: (cam && cam.y ? cam.y : 0) * CAM_PARALLAX_PX,
  };
}

/**
 * Screen rect for a prop (center cx/cy + size w/h) under the frame layout.
 * Near props render larger and shift more with the camera.
 */
function propScreenRect(prop, layout) {
  const depth = prop.depth == null ? 0.5 : prop.depth;
  const pf = parallaxFactor(depth);
  const rx = prop.x - ROOM_W / 2;
  const ry = prop.y - ROOM_H / 2;
  const cx = layout.originX + (rx - layout.camX * pf) * layout.scale;
  const cy = layout.originY + (ry - layout.camY * pf) * layout.scale;
  const sizeScale = layout.scale * (0.65 + depth * 0.7);
  const w = (prop.w == null ? 90 : prop.w) * sizeScale;
  const h = (prop.h == null ? 90 : prop.h) * sizeScale;
  return { cx, cy, w, h, depth };
}

/**
 * Topmost interactable prop under a canvas-space tap, or null. Near props
 * (higher depth) win overlaps. `pad` grows the hit box for fat-finger taps.
 * Props with kind 'decor' are scenery and never interactable.
 */
function hitTestProps(props, sx, sy, layout, pad) {
  if (pad == null) pad = 12;
  let best = null, bestDepth = -1;
  for (const prop of props) {
    if (prop.kind === 'decor') continue;
    const r = propScreenRect(prop, layout);
    const hw = r.w / 2 + pad, hh = r.h / 2 + pad;
    if (sx >= r.cx - hw && sx <= r.cx + hw && sy >= r.cy - hh && sy <= r.cy + hh) {
      if (r.depth >= bestDepth) { best = prop; bestDepth = r.depth; }
    }
  }
  return best;
}
