// === src/journey/data/cutscenes.js ===
/**
 * Per-chapter Act I cutscene lines. Each entry:
 *   { lines: [...string], durationMs: number }
 * Phase 2 populates `cmr`. Other chapters stay empty until Phase 3 — the
 * cutscene player gracefully no-ops on a missing entry.
 */
const CUTSCENES = {
  __placeholder: {
    lines: ['act i', 'a placeholder line', 'tap to continue'],
    durationMs: 4000,
  },
  cmr: {
    lines: ['5:30 a.m.', 'the alarm again.', 'two years to crack JEE.'],
    durationMs: 8000,
  },
  itics: {
    lines: ['8:30 a.m.', 'the bell.', 'a decade of mornings just like this.'],
    durationMs: 7000,
  },
  scripbox: {
    lines: ['the catalog refresh.', 'seventeen times.', 'PR #2913 · merged.'],
    durationMs: 7500,
  },
};
