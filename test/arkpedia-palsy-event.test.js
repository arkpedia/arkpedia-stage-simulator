// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';
import { updateEnemy } from '../server/sim/ai.js';

function setup(observe = true) {
  const wall = chessRec({ id: 'palsy_wall', skill: null,
    stats: { maxHp: 100000, atk: 0, blockCnt: 3 } });
  const enemy = enemyRec({ key: 'palsy_enemy', atk: 100, speed: 0, bat: 2 });
  const h = makeBattle({ content: 'none', hooks: [], autoFinish: false,
    defs: { chess: { palsy_wall: wall }, enemies: { palsy_enemy: enemy } },
    kits: { palsy_wall: () => ({ trait: { noAttack: true } }) },
    units: [{ chessId: 'palsy_wall', row: 9, col: 5 }] });
  h.step();
  const a = h.unit('palsy_wall'), e = h.spawn('palsy_enemy', { pos: [9, 5] });
  assert.equal(h.b._checkBlock(e), true);
  const events = [];
  if (observe) h.b.on('palsyTriggered', ctx => events.push(ctx));
  return { h, a, e, events };
}

test('palsy edge fires only on actual attack interruption and retains source after final-stack removal', () => {
  const { h, a, e, events } = setup();
  h.b.applyStatus(e, 'palsy', { value: 2, source: a });
  assert.equal(events.length, 0, 'granting stacks is not PALSYING');
  const hp = a.hp;
  e.atkCd = 0; updateEnemy(h.b, e, h.b.dt);
  assert.equal(events.length, 1); assert.equal(events[0].unit, e); assert.equal(events[0].source, a);
  assert.equal(e.findBuff('palsy').stacks, 1); assert.equal(e.atkCd, e.s.interval);
  assert.equal(e.stats.attacks, 0); assert.equal(a.hp, hp);
  updateEnemy(h.b, e, h.b.dt); assert.equal(events.length, 1, 'cooldown cannot consume another stack');
  e.atkCd = 0; updateEnemy(h.b, e, h.b.dt);
  assert.equal(events.length, 2); assert.equal(events[1].source, a);
  assert.equal(e.findBuff('palsy'), null); assert.equal(a.hp, hp);
});

test('palsy does not fire without a legal attack or during control', () => {
  const { h, e, events } = setup();
  h.b.applyStatus(e, 'palsy', { value: 2 });
  h.b.addBuff(e, { key: 'test:control', flags: { disarm: true } });
  e.atkCd = 0; updateEnemy(h.b, e, h.b.dt);
  assert.equal(events.length, 0); assert.equal(e.findBuff('palsy').stacks, 2);
  h.b.removeBuff(e, 'test:control'); h.b._unblock(e); e.x = 9;
  updateEnemy(h.b, e, h.b.dt);
  assert.equal(events.length, 0); assert.equal(e.findBuff('palsy').stacks, 2);
});

test('resist decay and unrelated stun do not synthesize a consumed-attack palsy edge', () => {
  const { h, e, events } = setup();
  h.b.applyStatus(e, 'palsy', { value: 2 });
  h.b.applyStatus(e, 'resist', { duration: 11 });
  h.b.addBuff(e, { key: 'test:control', flags: { disarm: true } });
  h.run(5.1);
  assert.equal(e.findBuff('palsy').stacks, 1); assert.equal(events.length, 0);
  h.b.applyStatus(e, 'stun', { duration: 1 }); h.run(.2);
  assert.equal(events.length, 0); assert.deepEqual(h.b.errors, []);
});

test('no palsy observer preserves interruption cooldown, damage and attack count', () => {
  const observed = setup(), plain = setup(false);
  for (const { h, e } of [observed, plain]) {
    h.b.applyStatus(e, 'palsy', { value: 1 });
    e.atkCd = 0; updateEnemy(h.b, e, h.b.dt);
  }
  assert.equal(observed.events[0].source, null);
  assert.equal(plain.e.atkCd, observed.e.atkCd);
  assert.equal(plain.e.stats.attacks, observed.e.stats.attacks);
  assert.equal(plain.a.hp, observed.a.hp);
  assert.equal(plain.e.findBuff('palsy'), null);
  assert.deepEqual(plain.h.b.errors, []);
});
