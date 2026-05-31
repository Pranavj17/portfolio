// === public/journey3d/mood.js ===
// journey v3 — per-era MOOD config: audio (chord/timbre) + colour grade.
// PURE: NO `three` import, NO WebAudio, NO DOM. Plain data + lookups so this is
// trivially unit-testable in Node (the renderer + audio engine consume it).
//
// Keyed by the 8 chapter ids (itics, cmr, college, fever104, sakha, scripbox,
// vwgt, now). Each entry carries:
//   audio.root   · base frequency (Hz) of the drone chord
//   audio.ratios · frequency ratios for the 2-4 detuned voices (the chord shape;
//                  minor-ish vs major-ish = the era's emotional colour)
//   audio.wave   · oscillator type ('sine' | 'triangle')
//   audio.cutoff · lowpass cutoff (Hz) the LFO sweeps around (timbre brightness)
//   audio.gain   · per-era pad level multiplier (0..1)
//   grade.light  · multiplier on the per-room point-light intensity (mood)
//   grade.fog    · hex string — per-era fog tint
//   grade.overlay· { color: hex, opacity: 0..1 } — subtle full-screen CSS wash
//
// Authored as plain declarations + a trailing `export` so the test can eval it
// after stripping the export line (same pattern as data.js / quality.js).

const MOODS = {
  // ITICS — schoolyard warmth, simple major triad, honey light.
  itics: {
    audio: { root: 174.6, ratios: [1, 1.25, 1.5], wave: 'triangle', cutoff: 900, gain: 0.85 },
    grade: { light: 1.05, fog: '#33271a', overlay: { color: '#d4a653', opacity: 0.05 } },
  },
  // CMR — the pressure cooker, pre-dawn. Cold, minor, dim.
  cmr: {
    audio: { root: 146.8, ratios: [1, 1.2, 1.5], wave: 'sine', cutoff: 600, gain: 0.8 },
    grade: { light: 0.82, fog: '#1c2233', overlay: { color: '#5a78c8', opacity: 0.12 } },
  },
  // DSCE (college) — busy, earnest, neutral-warm; suspended-ish chord.
  college: {
    audio: { root: 164.8, ratios: [1, 1.333, 1.78], wave: 'triangle', cutoff: 820, gain: 0.82 },
    grade: { light: 1.0, fog: '#2e2415', overlay: { color: '#c47540', opacity: 0.06 } },
  },
  // FEVER 104 — the radio booth, red on-air glow, brighter timbre.
  fever104: {
    audio: { root: 196.0, ratios: [1, 1.25, 1.5, 1.875], wave: 'triangle', cutoff: 1100, gain: 0.85 },
    grade: { light: 1.05, fog: '#33140e', overlay: { color: '#e0432a', opacity: 0.12 } },
  },
  // SAKHA — first paycheck, steady warm major.
  sakha: {
    audio: { root: 174.6, ratios: [1, 1.26, 1.5], wave: 'sine', cutoff: 880, gain: 0.85 },
    grade: { light: 1.05, fog: '#2a2818', overlay: { color: '#d4a653', opacity: 0.05 } },
  },
  // SCRIPBOX — the present craft, cool monitor cyan, bright clean tone.
  scripbox: {
    audio: { root: 220.0, ratios: [1, 1.25, 1.5], wave: 'triangle', cutoff: 1300, gain: 0.82 },
    grade: { light: 1.05, fog: '#16242a', overlay: { color: '#3fd0d4', opacity: 0.09 } },
  },
  // THE GT — the showroom, bright + celebratory.
  vwgt: {
    audio: { root: 207.6, ratios: [1, 1.25, 1.5, 2], wave: 'triangle', cutoff: 1400, gain: 0.85 },
    grade: { light: 1.18, fog: '#2e2616', overlay: { color: '#e6c285', opacity: 0.05 } },
  },
  // NOW — golden morning, warmest + most open, full major add-9.
  now: {
    audio: { root: 261.6, ratios: [1, 1.25, 1.5, 2.25], wave: 'triangle', cutoff: 1500, gain: 0.88 },
    grade: { light: 1.15, fog: '#3a2c14', overlay: { color: '#f0c060', opacity: 0.06 } },
  },
};

// The hall (between rooms): neutral warm drone, no overlay wash.
const HALL_MOOD = {
  audio: { root: 130.8, ratios: [1, 1.5, 2], wave: 'sine', cutoff: 700, gain: 0.7 },
  grade: { light: 1.0, fog: '#33271a', overlay: { color: '#000000', opacity: 0 } },
};

/** Look up the mood for a chapter id; falls back to the hall mood. */
function moodFor(id) {
  if (id == null) return HALL_MOOD;
  return MOODS[id] || HALL_MOOD;
}

/** Just the audio sub-config for an id (chord/timbre). */
function audioMood(id) {
  return moodFor(id).audio;
}

/** Just the colour-grade sub-config for an id (light/fog/overlay). */
function gradeMood(id) {
  return moodFor(id).grade;
}

/** The concrete oscillator frequencies (Hz) for a chord — root × each ratio. */
function chordFreqs(id) {
  const a = audioMood(id);
  return a.ratios.map(r => a.root * r);
}

export { MOODS, HALL_MOOD, moodFor, audioMood, gradeMood, chordFreqs };
