// === src/journey/ui/input.js ===
/**
 * Gesture classifier. Pure function over an end-of-pointer snapshot:
 *   { dx, dy, durationMs }
 * Returns one of TAP / HOLD / SWIPE-V / SWIPE-H plus direction for swipes.
 * Thresholds are deliberately generous for mobile.
 */
const INPUT_SWIPE_THRESHOLD_PX = 40;
const INPUT_HOLD_THRESHOLD_MS  = 300;

function classifyGesture({ dx, dy, durationMs }) {
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (ady > INPUT_SWIPE_THRESHOLD_PX && ady >= adx) {
    return { kind: 'SWIPE-V', dir: Math.sign(dy) };  // +1 down, -1 up
  }
  if (adx > INPUT_SWIPE_THRESHOLD_PX) {
    return { kind: 'SWIPE-H', dir: Math.sign(dx) };  // +1 right, -1 left
  }
  if (durationMs >= INPUT_HOLD_THRESHOLD_MS) return { kind: 'HOLD' };
  return { kind: 'TAP' };
}

/**
 * canvasPoint(rect, bufW, bufH, clientX, clientY) — map a viewport point into
 * canvas backing-buffer coordinates. A mini-game / room canvas is drawn at its
 * intrinsic size (e.g. 360×240, or DPR-scaled full screen) but CSS-stretched to
 * fill its box, so a raw clientX lands in the wrong space — and touch events
 * carry no offsetX at all. This is the single source of truth for canvas
 * hit-testing. Pure + unit-tested.
 *
 *   rect — target.getBoundingClientRect() (or any {left,top,width,height})
 *   bufW/bufH — target.width / target.height (the backing buffer)
 */
function canvasPoint(rect, bufW, bufH, clientX, clientY) {
  const sx = rect.width ? bufW / rect.width : 1;
  const sy = rect.height ? bufH / rect.height : 1;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

/**
 * attachInputRouter(target, onGesture) — wires touch + mouse on `target`
 * and invokes onGesture(result, originalEvent) for each completed gesture.
 * The result carries canvas-space coords: `x/y` = release point, `x0/y0` =
 * press point. Returns a detach() function. Browser-only (uses addEventListener).
 */
function attachInputRouter(target, onGesture) {
  let start = null;
  const isTouch = e => e.touches && e.touches.length > 0;

  function localPoint(clientX, clientY) {
    const rect = target.getBoundingClientRect();
    return canvasPoint(rect, target.width, target.height, clientX, clientY);
  }

  function pointerStart(e) {
    const p = isTouch(e) ? e.touches[0] : e;
    const c = localPoint(p.clientX, p.clientY);
    start = { x: p.clientX, y: p.clientY, cx: c.x, cy: c.y, t: Date.now() };
  }
  function pointerEnd(e) {
    if (!start) return;
    const p = e.changedTouches ? e.changedTouches[0] : e;
    const end = localPoint(p.clientX, p.clientY);
    const result = classifyGesture({
      dx: p.clientX - start.x,
      dy: p.clientY - start.y,
      durationMs: Date.now() - start.t,
    });
    // Canvas-space coords for hit-testing. Replaces the old ev.offsetX reads
    // (absent on touch; wrong space on a CSS-stretched backing buffer).
    result.x = end.x;   result.y = end.y;
    result.x0 = start.cx; result.y0 = start.cy;
    start = null;
    onGesture(result, e);
  }
  target.addEventListener('touchstart', pointerStart, { passive: true });
  target.addEventListener('touchend',   pointerEnd,   { passive: true });
  target.addEventListener('mousedown',  pointerStart);
  target.addEventListener('mouseup',    pointerEnd);

  return function detach() {
    target.removeEventListener('touchstart', pointerStart);
    target.removeEventListener('touchend',   pointerEnd);
    target.removeEventListener('mousedown',  pointerStart);
    target.removeEventListener('mouseup',    pointerEnd);
  };
}
