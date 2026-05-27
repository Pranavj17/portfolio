const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/state/phase.js'), 'utf8');
eval(SRC + '\nglobalThis.Phase = { transitionChapterPhase, CHAPTER_PHASES };');

// Note: cannot destructure into top-level `const`s here — function decls
// inside direct eval bleed into the enclosing CJS module scope, causing TDZ
// collisions with any same-named top-level `const`. Access via globalThis.

test('CHAPTER_PHASES lists all 6 phase names', () => {
  assert.deepStrictEqual(globalThis.Phase.CHAPTER_PHASES, [
    'unseen', 'cutscene', 'exploring', 'closing', 'culminating', 'complete',
  ]);
});

test('unseen + ENTER → cutscene', () => {
  assert.strictEqual(globalThis.Phase.transitionChapterPhase('unseen', 'ENTER'), 'cutscene');
});

test('cutscene + DISMISS → exploring', () => {
  assert.strictEqual(globalThis.Phase.transitionChapterPhase('cutscene', 'DISMISS'), 'exploring');
});

test('exploring + QUEST_COMPLETE → closing', () => {
  assert.strictEqual(globalThis.Phase.transitionChapterPhase('exploring', 'QUEST_COMPLETE'), 'closing');
});

test('closing + MINIGAME_DONE → culminating', () => {
  assert.strictEqual(globalThis.Phase.transitionChapterPhase('closing', 'MINIGAME_DONE'), 'culminating');
});

test('culminating + DISMISS → complete', () => {
  assert.strictEqual(globalThis.Phase.transitionChapterPhase('culminating', 'DISMISS'), 'complete');
});

test('complete + ENTER → exploring (re-entry skips cutscene)', () => {
  assert.strictEqual(globalThis.Phase.transitionChapterPhase('complete', 'ENTER'), 'exploring');
});

test('invalid event returns current phase (no-op)', () => {
  assert.strictEqual(globalThis.Phase.transitionChapterPhase('cutscene', 'QUEST_COMPLETE'), 'cutscene');
});

test('unknown phase throws', () => {
  assert.throws(() => globalThis.Phase.transitionChapterPhase('nope', 'ENTER'), /unknown phase/i);
});
