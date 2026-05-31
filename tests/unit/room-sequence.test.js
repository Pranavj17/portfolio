const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// controller.js is browser code, but its top level is only declarations (no DOM
// calls run at parse time), so we can eval it and pull the PURE stage helpers
// out via a namespace object. As elsewhere, access through globalThis.Seq — do
// NOT destructure into top-level consts (direct-eval function decls bleed into
// this CJS module scope and would collide / TDZ).
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/room/controller.js'), 'utf8');
eval(SRC + '\nglobalThis.Seq = { ROOM_STAGES, nextRoomStage, computeActiveIds, memoryPropIds, memoriesStageComplete };');
const S = globalThis.Seq;

function roomWith(memoryIds) {
  const props = memoryIds.map(id => ({ id, kind: 'memory', beat: id }));
  props.push({ id: 'arcade', kind: 'minigame' });
  props.push({ id: 'screen', kind: 'video' });
  props.push({ id: 'exit', kind: 'exit' });
  props.push({ id: 'window', kind: 'decor' });
  return { props };
}

test('ROOM_STAGES is the canonical 5-step order', () => {
  assert.deepStrictEqual(S.ROOM_STAGES, ['intro', 'memories', 'play', 'close', 'exit']);
});

test('nextRoomStage walks intro → memories → play → close → exit', () => {
  assert.strictEqual(S.nextRoomStage('intro'), 'memories');
  assert.strictEqual(S.nextRoomStage('memories'), 'play');
  assert.strictEqual(S.nextRoomStage('play'), 'close');
  assert.strictEqual(S.nextRoomStage('close'), 'exit');
});

test('nextRoomStage clamps at exit (the terminal stage)', () => {
  assert.strictEqual(S.nextRoomStage('exit'), 'exit');
});

test('nextRoomStage on an unknown stage restarts at intro', () => {
  assert.strictEqual(S.nextRoomStage('bogus'), 'intro');
});

test('memoryPropIds returns only the memory prop ids', () => {
  const room = roomWith(['a', 'b', 'c']);
  assert.deepStrictEqual(S.memoryPropIds(room), ['a', 'b', 'c']);
});

test('computeActiveIds lights the right prop(s) per stage', () => {
  const room = roomWith(['a', 'b']);
  assert.deepStrictEqual([...S.computeActiveIds('intro', room)], []);
  assert.deepStrictEqual([...S.computeActiveIds('memories', room)].sort(), ['a', 'b']);
  assert.deepStrictEqual([...S.computeActiveIds('play', room)], ['arcade']);
  assert.deepStrictEqual([...S.computeActiveIds('close', room)], ['screen']);
  assert.deepStrictEqual([...S.computeActiveIds('exit', room)], ['exit']);
});

test('memoriesStageComplete is false until every memory beat is played', () => {
  const room = roomWith(['a', 'b']);
  assert.strictEqual(S.memoriesStageComplete(room, new Set()), false);
  assert.strictEqual(S.memoriesStageComplete(room, new Set(['a'])), false);
  assert.strictEqual(S.memoriesStageComplete(room, new Set(['a', 'b'])), true);
});

test('memoriesStageComplete is trivially true when a room has no memories', () => {
  const room = roomWith([]);
  assert.strictEqual(S.memoriesStageComplete(room, new Set()), true);
});
