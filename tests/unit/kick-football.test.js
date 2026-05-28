const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/kick-football.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.KF = MINIGAMES.itics;');
const game = globalThis.KF;

test('kick-football is registered under itics with id kick-football', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'kick-football');
  assert.strictEqual(game.label, 'ITICS · KICK');
});

test('init returns state with arrow at 0 and no kick yet', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.arrow, 0);
  assert.strictEqual(state.kicked, false);
  assert.strictEqual(state.kickAt, null);
});

test('update moves arrow back and forth across [0,1]', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.update(state, 500);
  assert.ok(state.arrow > 0 && state.arrow <= 1);
});

test('onGesture(TAP) records kickAt and sets kicked', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.update(state, 250);
  game.onGesture(state, { kind: 'TAP' }, {});
  assert.strictEqual(state.kicked, true);
  assert.ok(typeof state.kickAt === 'number');
});

test('subsequent taps ignored (one kick only)', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.update(state, 250);
  game.onGesture(state, { kind: 'TAP' }, {});
  const firstKickAt = state.kickAt;
  game.update(state, 250);
  game.onGesture(state, { kind: 'TAP' }, {});
  assert.strictEqual(state.kickAt, firstKickAt);
});

test('score is 100 for a dead-center kick (arrow at 0.5)', () => {
  const state = game.init({}, {});
  state.kicked = true;
  state.kickAt = 0.5;
  assert.strictEqual(game.score(state), 100);
});

test('score is 50 (no-fail floor) if never kicked', () => {
  const state = game.init({}, {});
  state.kicked = false;
  state.kickAt = null;
  assert.strictEqual(game.score(state), 50);
});

test('score degrades linearly with distance from 0.5', () => {
  const state = game.init({}, {});
  state.kicked = true;
  state.kickAt = 0;
  const worst = game.score(state);
  state.kickAt = 0.5;
  const best = game.score(state);
  assert.ok(best > worst);
  assert.strictEqual(best, 100);
  assert.ok(worst >= 50, 'must still respect no-fail floor');
});

test('scoreLabel formats as N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
