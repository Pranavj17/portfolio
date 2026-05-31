const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public/journey3d/mood.js'), 'utf8');
eval(SRC.replace(/export\s*\{[^}]*\}\s*;?/, '') +
  '\nglobalThis.J3D_MOOD = { MOODS, HALL_MOOD, moodFor, audioMood, gradeMood, chordFreqs };');

const M = () => globalThis.J3D_MOOD;
const IDS = ['itics', 'cmr', 'college', 'fever104', 'sakha', 'scripbox', 'vwgt', 'now'];

test('defines mood config for all 8 journey chapters', () => {
  assert.deepStrictEqual(Object.keys(M().MOODS), IDS);
});

test('moodFor falls back to hall mood for null and unknown ids', () => {
  assert.strictEqual(M().moodFor(null), M().HALL_MOOD);
  assert.strictEqual(M().moodFor('missing'), M().HALL_MOOD);
});

test('every mood has valid audio and grade values', () => {
  for (const id of IDS) {
    const mood = M().moodFor(id);
    assert.ok(mood.audio.root > 0, id + ' root');
    assert.ok(Array.isArray(mood.audio.ratios) && mood.audio.ratios.length >= 3, id + ' ratios');
    assert.ok(['sine', 'triangle'].includes(mood.audio.wave), id + ' wave');
    assert.ok(mood.audio.cutoff > 0, id + ' cutoff');
    assert.ok(mood.audio.gain > 0 && mood.audio.gain <= 1, id + ' gain');
    assert.match(mood.grade.fog, /^#[0-9a-f]{6}$/i, id + ' fog');
    assert.match(mood.grade.overlay.color, /^#[0-9a-f]{6}$/i, id + ' overlay');
    assert.ok(mood.grade.overlay.opacity >= 0 && mood.grade.overlay.opacity <= 1, id + ' opacity');
  }
});

test('chordFreqs maps root times ratios exactly', () => {
  const id = 'now';
  const audio = M().audioMood(id);
  assert.deepStrictEqual(M().chordFreqs(id), audio.ratios.map(r => audio.root * r));
});

