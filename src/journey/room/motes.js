// === src/journey/room/motes.js ===
/**
 * Dust motes drifting in the room's light shaft — the cheapest, highest-impact
 * "this is a 3D space" cue. Positions are normalized [0,1] over the canvas so
 * they're resolution-independent. The step is pure (dt in ms) so it's testable
 * without a browser; makeMotes takes an injectable rng for deterministic tests.
 */
function makeMotes(n, rng) {
  rng = rng || Math.random;
  const motes = [];
  for (let i = 0; i < n; i++) {
    motes.push({
      x: rng(),
      y: rng(),
      r: 0.6 + rng() * 1.9,          // radius in px (scaled at draw time)
      vy: 0.015 + rng() * 0.045,     // rise speed, normalized units/sec
      sway: 0.4 + rng() * 1.4,       // horizontal sway frequency
      amp: 0.004 + rng() * 0.012,    // sway amplitude
      phase: rng() * Math.PI * 2,
      a: 0.12 + rng() * 0.40,        // base alpha
    });
  }
  return motes;
}

/**
 * Advance motes by dtMs. Each rises slowly, sways, and wraps to the bottom
 * once it floats off the top. Returns the same array (mutated) for chaining.
 */
function stepMotes(motes, dtMs) {
  const dt = dtMs / 1000;
  for (const m of motes) {
    m.y -= m.vy * dt;
    m.phase += m.sway * dt;
    if (m.y < -0.05) { m.y = 1.05; }
  }
  return motes;
}
