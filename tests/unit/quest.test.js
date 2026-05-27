const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/quest.js'), 'utf8');
// Inline globalThis access — do not destructure (see persistence/phase/store tests)
eval(SRC + '\nglobalThis.Quest = { isQuestComplete, questProgress };');

test('isQuestComplete returns false when fewer beats collected than needed', () => {
  assert.strictEqual(globalThis.Quest.isQuestComplete(['a', 'b'], 3, { a: true, b: true }), false);
});

test('isQuestComplete returns true at threshold', () => {
  assert.strictEqual(globalThis.Quest.isQuestComplete(['a', 'b', 'c'], 3, { a: true, b: true, c: true }), true);
});

test('isQuestComplete ignores collected beats not in the quest list', () => {
  assert.strictEqual(globalThis.Quest.isQuestComplete(['a', 'b'], 2, { a: true, x: true }), false);
});

test('questProgress returns done/total + lists', () => {
  const out = globalThis.Quest.questProgress(['a', 'b', 'c', 'd'], 3, { a: true, c: true });
  assert.strictEqual(out.done, 2);
  assert.strictEqual(out.needed, 3);
  assert.deepStrictEqual(out.collected, ['a', 'c']);
  assert.deepStrictEqual(out.remaining, ['b', 'd']);
});
