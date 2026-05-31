// === public/journey3d/nearest.js ===
// journey v3 — pure "nearest interactable in view" math. NO `three` import.
//
// Operates on plain {x,y,z} vectors so it is unit-testable in Node. main.js
// feeds it the camera world position, a normalised forward vector, and a list
// of interactable world positions; it returns the index of the nearest one
// that is within range AND roughly in front of the camera (so you must look at
// a thing to inspect it), or -1.
//
// Authored as plain declarations + a trailing `export` so the test can eval it
// after stripping the export line.

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function length(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalize(v) {
  const l = length(v);
  if (l === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/**
 * @param {{x,y,z}} camPos     camera world position
 * @param {{x,y,z}} forward    camera forward direction (need not be normalised)
 * @param {Array<{x,y,z}>} targets  interactable world positions
 * @param {object} [opts]
 * @param {number} [opts.range=3.0]   max distance to be eligible (world units)
 * @param {number} [opts.minDot=0.5]  min cos(angle) between forward and target dir
 *                                     (0.5 ≈ within a 60° half-cone)
 * @returns {{index:number, distance:number}|null} nearest eligible target or null
 */
function nearestInView(camPos, forward, targets, opts) {
  const range = opts && typeof opts.range === 'number' ? opts.range : 3.0;
  const minDot = opts && typeof opts.minDot === 'number' ? opts.minDot : 0.5;
  const fwd = normalize(forward);

  let best = null;
  for (let i = 0; i < targets.length; i++) {
    const toTarget = sub(targets[i], camPos);
    const dist = length(toTarget);
    if (dist > range) continue;
    // A target on top of the camera (dist ~0) is always "in view".
    if (dist > 1e-6) {
      const viewDot = dot(fwd, normalize(toTarget));
      if (viewDot < minDot) continue;
    }
    if (best === null || dist < best.distance) {
      best = { index: i, distance: dist };
    }
  }
  return best;
}

export { nearestInView, sub, length, dot, normalize };
