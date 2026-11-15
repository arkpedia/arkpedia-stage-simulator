// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, chessRec } from './helpers/battleHarness.js';
import { RegularDisplacement } from '../server/sim/regular-displacement.js';
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function fixture() {
  const def = enemyRec({ key: 'shift_test', hp: 100000, atk: 100, mass: 0, speed: 1 });
  const ally = chessRec({ id: 'shift_blocker', stats: { maxHp: 100000, atk: 0 } });
  const h = makeBattle({ content: 'none', autoFinish: false, units: [{ chessId: ally.chessId, row: 9, col: 5 }],
    defs: { enemies: { shift_test: def }, chess: { [ally.chessId]: ally } } });
  const b = h.b; b.regularDisplacement = new RegularDisplacement(b); b.start();
  const e = b.spawnEnemy('shift_test', { pos: [9, 5.3], route: 0 });
  b.addBuff(e, { key: 'hold', flags: { noMove: true, disarm: true } });
  b.addBuff(b.allyUnits[0], { key: 'hold', flags: { disarm: true } });
  return { b, e, h };
}
function settle(b, e) {
  let frames = 0;
  while (e.mem.regularShift && frames < 150) { b.step(); frames++; }
  assert.ok(frames < 150); assert.deepEqual(b.errors, []); return frames;
}

test('pushes use 30 Hz friction: observed distances and durations for all force grades', () => {
  // Closed-form sums of the published 30 Hz velocity/friction model.
  const distances = [.118883333333, .441566666667, 1.698333333333, 2.1399, 2.9524, 3.5265];
  const frames = [6, 12, 24, 27, 32, 35];
  for (const effect of [false, true]) for (let i = 0; i < 6; i++) {
    const { b, e } = fixture(), x = e.x;
    const speed = [1, 2, 4, 4.5, 5.3, 5.8][i];
    assert.equal(b.push(e, i - 2, { dir: { x: 1, y: 0 }, effect }), true);
    near(e.x - x, effect ? 0 : speed / 30);
    assert.equal(e.canAct, false); assert.equal(settle(b, e), frames[i]);
    near(e.x - x, distances[i] - (effect ? speed / 30 : 0));
    assert.equal(e.canAct, true);
  }
});

test('force breaks blocking and forbids reblocking and attacks until settled, independently of stun immunity', () => {
  const { b, e } = fixture(); b.removeBuff(e, 'hold');
  b.addBuff(e, { key: 'immunity', flags: { stunImmune: true, noMove: true } });
  assert.ok(b._checkBlock(e));
  assert.equal(b.push(e, -2, { dir: { x: 1, y: 0 }, effect: true }), true);
  assert.equal(e.blockedBy, null); assert.equal(b._checkBlock(e), false);
  b.step(); assert.equal(e.stats.attacks, 0);
  settle(b, e); assert.ok(b._checkBlock(e)); b.step(); assert.equal(e.stats.attacks, 1);
});

test('direction corrections, repeated velocity addition, and force immunity', () => {
  const { b, e } = fixture(); const x = e.x;
  b.push(e, 0, { from: { x: e.x, y: e.y - 1 }, dir: { x: 1, y: 0 }, effect: true });
  near(e.mem.regularShift.vx, 0); near(e.mem.regularShift.vy, 1);
  b.push(e, 0, { dir: { x: 1, y: 0 }, effect: true });
  near(e.mem.regularShift.vx, 4); near(e.mem.regularShift.vy, 1); assert.equal(e.x, x);
  b.applyStatus(e, 'levitate', { duration: 1 }); b.step(); assert.equal(e.mem.regularShift, undefined);
  assert.equal(b.push(e, 4, { dir: { x: 1, y: 0 } }), 0);
  const fresh = fixture(); fresh.e.hidden = true;
  assert.equal(fresh.b.push(fresh.e, 0, { dir: { x: 1, y: 0 } }), 0);
});

test('walls stop velocity and emit one collision; travel callbacks cover actual distance', () => {
  const { b, e } = fixture(); e.x = 6;
  b.grid.tiles[9 * 21 + 7] = { ...b.grid.tile(9, 7), pass: 'FLY', height: 'HIGH' };
  const hits = [], moves = [], receipts = [];
  b.on('enemyDisplaced', c => receipts.push(c.distance));
  b.push(e, 3, { dir: { x: 1, y: 0 }, onCollision: c => hits.push(c), onTravel: c => moves.push(c.distance) });
  settle(b, e); assert.equal(hits.length, 1); assert.equal(hits[0].tile.height, 'HIGH');
  assert.ok(e.x < 6.5 && e.x > 6.4); near(moves.reduce((a, v) => a + v, 0), e.x - 6);
  near(receipts.reduce((a, v) => a + v, 0), e.x - 6);
});

test('pulls retain unbalance for the force duration and stop at the owner circle', () => {
  for (const level of [-2, -1, 0, 3]) {
    const { b, e } = fixture(); e.x = 8;
    assert.equal(b.pull(e, level, { to: { x: 5.5, y: 9 }, center: { x: 5, y: 9 } }), true);
    assert.equal(e.x, 8); const frames = settle(b, e);
    assert.ok(frames >= (level < -1 ? 15 : 30)); assert.ok(e.x < 8);
    assert.ok(e.x >= 5.6708 - 1e-9);
    if (level >= 0) near(e.x, 5.6708);
  }
});

test('static bodies become unbalanced without moving; force immunity and levitation still win', () => {
  const { b, e } = fixture(); b.addBuff(e, { key: 'static', flags: { staticBody: true } }); e.motion = 'FLY'; const x = e.x;
  assert.equal(b.push(e, 3, { dir: { x: 1, y: 0 } }), true);
  assert.equal(e.canAct, false); assert.equal(settle(b, e), 1); near(e.x, x);
  assert.equal(b.pull(e, 0, { to: { x: 3, y: 9 } }), true);
  assert.equal(settle(b, e), 30); near(e.x, x);
  b.addBuff(e, { key: 'no', flags: { noDisplace: true } });
  assert.equal(b.push(e, 3, { dir: { x: 1, y: 0 } }), 0);
});

test('teleporting movement observers retire the force instead of dragging across the teleport', () => {
  const { b, e } = fixture();
  b.on('enemyMoved', ({ enemy }) => { enemy.x = 9; });
  b.push(e, 3, { dir: { x: 1, y: 0 } });
  assert.equal(e.x, 9); assert.equal(e.mem.regularShift, undefined);
  b.step(); assert.equal(e.x, 9);
});
