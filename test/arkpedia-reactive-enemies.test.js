// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny, ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };

for (const [id, level, bonus] of [...[0, 1, 2].map(level => ['enemy_2001_duckmi', level, 4]), ['enemy_2001_duckmi_2', 0, 3]]) test(`${id} level ${level}: first damage starts one permanent run modifier, retaining slows and unblockability`, () => {
  assert.ok(support.enemies[id].policy);
  const h = spawnAny(id, { level, seconds: .1 }), b = h.b;
  const e = b.enemies[0], guard = b.allyUnits[0], speed = e.s.moveSpeed;
  assert.equal(e.buffs.some(b => b.key === 'ab:duckRun'), false);
  b.dealDamage(guard, e, { amount: 1, type: 'true', isAttack: true });
  assert.equal(e.s.moveSpeed, speed * (1 + bonus));
  for (let i = 0; i < 4; i++) b.dealDamage(null, e, { amount: 1, type: 'true', sourceless: true });
  assert.equal(e.s.moveSpeed, speed * (1 + bonus)); assert.equal(e.buffs.filter(b => b.key === 'ab:duckRun').length, 1);
  b.applyStatus(e, 'slow', { duration: 10, value: .5 });
  assert.equal(e.s.moveSpeed, speed * (1 + bonus) * .5);
  e.x = guard.x + .2; e.y = guard.y; assert.equal(b._checkBlock(e), false);
  b.applyStatus(e, 'stun', { duration: 1 }); h.run(.5);
  assert.ok(e.findBuff('ab:duckRun')); h.run(.6); assert.ok(!e.s.flags.stun);
  assert.equal(e.stats.attacks, 0); assert.deepEqual(b.errors, []);
});

for (const [id, duration] of [['enemy_1049_eagent', 5], ['enemy_1049_eagent_2', 10]]) {
  test(`${id}: a real attack removes one block, extends without stacking, and expires after its source dies`, () => {
    assert.ok(support.enemies[id].policy);
    const h = spawnAny(id, { seconds: .1, stats: { moveSpeed: 0 } }), b = h.b;
    const e = b.enemies[0], guard = b.allyUnits[0]; guard.base.blockCnt = 1; guard.markDirty();
    e.x = guard.x + .2; e.y = guard.y; assert.ok(b._checkBlock(e));
    h.runUntil(() => !!guard.findBuff('ab:agentBlock'), 3);
    const buff = guard.findBuff('ab:agentBlock'); assert.ok(buff); assert.equal(buff.duration, duration);
    assert.equal(guard.s.blockCnt, 0); h.run(.1); assert.equal(e.blockedBy, null);
    e.profile.noAttack = true; h.run(1);
    b.dealDamage(e, guard, { amount: 1, type: 'arts', isAttack: true });
    assert.equal(guard.buffs.filter(b => b.key === 'ab:agentBlock').length, 1);
    assert.equal(guard.findBuff('ab:agentBlock').timeLeft, duration);
    assert.equal(guard.s.blockCnt, 0);
    b.spawnEnemy(id, { pos: [0, 0] }); // Keep the battle clock running after the original source dies.
    b.kill(e, guard); h.run(duration - .1); assert.equal(guard.s.blockCnt, 0);
    h.run(.2); assert.equal(guard.s.blockCnt, 1); assert.deepEqual(b.errors, []);
  });
  test(`${id}: silence suppresses new debuffs without erasing an existing one`, () => {
    const h = spawnAny(id, { seconds: .1 }), b = h.b, e = b.enemies[0], guard = b.allyUnits[0];
    b.applyStatus(e, 'silence', { duration: 20 });
    b.dealDamage(e, guard, { amount: 1, type: 'arts', isAttack: true });
    assert.equal(guard.findBuff('ab:agentBlock'), null);
    b.removeBuff(e, 'silence'); b.dealDamage(e, guard, { amount: 1, type: 'arts', isAttack: true });
    assert.ok(guard.findBuff('ab:agentBlock'));
    b.applyStatus(e, 'silence', { duration: 20 }); h.run(.5);
    assert.ok(guard.findBuff('ab:agentBlock')); assert.deepEqual(b.errors, []);
  });
}

test('Agent and Leader share one debuff; a shorter application cannot replace the remaining longer duration', () => {
  const h = spawnAny('enemy_1049_eagent_2', { seconds: .1 }), b = h.b;
  const e = b.enemies[0], guard = b.allyUnits[0];
  b.dealDamage(e, guard, { amount: 1, type: 'arts', isAttack: true });
  // Parameterize the same shared factory through the ordinary Agent record.
  const record = ENEMY_RECORDS.enemies.enemy_1049_eagent.levels[0];
  b.data.raw.enemies.enemy_1049_eagent = record;
  const other = b.spawnEnemy('enemy_1049_eagent', { pos: [0, 0] });
  h.run(1); const remaining = guard.findBuff('ab:agentBlock').timeLeft;
  b.dealDamage(other, guard, { amount: 1, type: 'arts', isAttack: true });
  assert.equal(guard.findBuff('ab:agentBlock').timeLeft, remaining);
  assert.equal(guard.buffs.filter(b => b.key === 'ab:agentBlock').length, 1);
});

test('native changes cannot silently reuse the reviewed reactive families', () => {
  for (const [id, edit] of [
    ['enemy_1049_eagent', c => { if (c._additiveActiveBuffs) c._additiveActiveBuffs[0].overrideType = 1; }],
    ['enemy_1049_eagent_2', c => { if (c._additiveActiveBuffs) c._additiveActiveBuffs[0].attributes.attributeModifiers[0].formulaItem = 1; }],
    ['enemy_2001_duckmi', c => { if (c._buffs?.[0]?.buffKey === 'duckmi_speed_up') c._buffs[0].isSilenceable = 1; }],
  ]) {
    const changed = structuredClone(evidence);
    for (const row of changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) {
      const c = JSON.parse(row.originalJson); edit(c); row.originalJson = JSON.stringify(c);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, changed).policy, null, id);
  }
  for (const id of ['enemy_1049_eagent', 'enemy_2001_duckmi'])
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, {}).policy, null);
});
