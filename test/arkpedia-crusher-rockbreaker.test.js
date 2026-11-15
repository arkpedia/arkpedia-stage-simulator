// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny, ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };

function fixture(id, stats) {
  assert.ok(support.enemies[id].policy);
  const h = spawnAny(id, { stats, seconds: .1, units: [6, 7].map(col => ({ chessId: 'test_enemy_harness_guard', row: 9, col })) });
  const b = h.b, e = b.enemies.find(e => e.defId === id), [guard, neighbor] = b.allyUnits;
  e.x = guard.x + .2; e.y = guard.y;
  assert.equal(b._checkBlock(e), true);
  return { h, b, e, guard, neighbor };
}

test('a faster stage attack interval cannot bypass the Crusher skill initial cooldown', () => {
  const { h, b, e, guard } = fixture('enemy_1045_hammer', { bat: .1 });
  h.run(.8);
  assert.ok(e.stats.attacks >= 3); assert.ok(!guard.s.flags.stun);
  assert.equal(e.mem.ab.list.find(a => Object.hasOwn(a, 'charge')).charge, 2);
  h.runUntil(() => guard.s.flags.stun, 1);
  assert.ok(guard.s.flags.stun); assert.ok(b.time >= 1);
  assert.deepEqual(b.errors, []);
});

for (const id of ['enemy_1045_hammer', 'enemy_1045_hammer_2']) {
  test(`${id}: two ordinary attacks charge a single-target seven-second stun`, () => {
    const { h, b, e, guard, neighbor } = fixture(id), attacks = [];
    b.on('attack', c => { if (c.attacker === e) attacks.push(!!guard.s.flags.stun); }, { priority: -200 });
    h.runUntil(() => attacks.length === 3, 15);
    assert.deepEqual(attacks, [false, false, true]);
    assert.equal(guard.buffs.find(buff => buff.status === 'stun').duration, 7);
    assert.ok(!neighbor.s.flags.stun, 'no adjacent splash stun');
    assert.deepEqual(b.errors, []);
  });

  test(`${id}: silence suppresses casting but preserves attack SP; control pauses do not spend it`, () => {
    const { h, b, e, guard } = fixture(id);
    b.applyStatus(e, 'silence', { duration: 30 });
    h.runUntil(() => e.stats.attacks >= 4, 20);
    assert.ok(!guard.s.flags.stun);
    const ability = e.mem.ab.list.find(a => Object.hasOwn(a, 'charge'));
    assert.equal(ability.charge, 2);
    const attacks = e.stats.attacks;
    b.applyStatus(e, 'stun', { duration: 2 }); h.run(1.5);
    assert.equal(e.stats.attacks, attacks); assert.equal(ability.charge, 2);
    b.removeBuff(e, 'silence');
    h.runUntil(() => e.stats.attacks > attacks, 6);
    assert.ok(guard.s.flags.stun); assert.equal(ability.charge, 0);
    assert.deepEqual(b.errors, []);
  });
}

for (const [id, bonus] of [['enemy_1048_hirman', 40], ['enemy_1048_hirman_2', 50]]) {
  test(`${id}: blocking changes actual Arts damage, and single/batch release removes RES immediately`, () => {
    const { b, e, guard } = fixture(id);
    assert.equal(e.s.res, 40 + bonus);
    const hp = e.hp;
    b.dealDamage(null, e, { amount: 1000, type: 'arts', sourceless: true });
    assert.ok(Math.abs(hp - e.hp - (600 - 10 * bonus)) < 1e-6);
    b._unblock(e); assert.equal(e.s.res, 40);
    const unblockedHp = e.hp;
    b.dealDamage(null, e, { amount: 1000, type: 'arts', sourceless: true });
    assert.equal(unblockedHp - e.hp, 600);
    for (let i = 0; i < 3; i++) {
      assert.ok(b._checkBlock(e)); assert.equal(e.s.res, 40 + bonus);
      b.releaseBlocked(guard); assert.equal(e.s.res, 40);
    }
    assert.deepEqual(b.errors, []);
  });

  test(`${id}: blocker death removes the bonus and a new blocker restores it once`, () => {
    const { h, b, e, guard, neighbor } = fixture(id);
    assert.equal(e.s.res, 40 + bonus);
    b.kill(guard, null); assert.equal(e.s.res, 40);
    e.x = neighbor.x + .2; e.y = neighbor.y;
    assert.ok(b._checkBlock(e)); h.run(.2);
    assert.equal(e.s.res, 40 + bonus);
    assert.equal(e.buffs.filter(buff => buff.key === 'ab:blockedRes').length, 1);
    assert.deepEqual(b.errors, []);
  });
}

test('both families refuse changed source mechanics instead of broadening admission', () => {
  for (const [id, edit] of [
    ['enemy_1045_hammer', c => { if ('_ignoreSilence' in c) c._ignoreSilence = 1; }],
    ['enemy_1045_hammer', c => { if ('_selector' in c) c._selector.m_PathID = '999'; }],
    ['enemy_1048_hirman', c => { if ('_blockMinCnt' in c) c._blockMinCnt = 2; }],
    ['enemy_1048_hirman_2', c => { if (c._buffs) c._buffs[0].attributes.attributeModifiers[0].formulaItem = 1; }],
  ]) {
    const changed = structuredClone(evidence);
    for (const row of changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) {
      const component = JSON.parse(row.originalJson); edit(component); row.originalJson = JSON.stringify(component);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, changed).policy, null, id);
  }
  for (const id of ['enemy_1045_hammer', 'enemy_1048_hirman'])
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, {}).policy, null, id);
  const changed = structuredClone(ENEMY_RECORDS.enemies.enemy_1045_hammer);
  changed.levels[0].skills[0].spCost = 3;
  assert.equal(enemySupport(changed, index.prefabs, evidence).policy, null, 'cannot fall through to another stuncombat family');
});
