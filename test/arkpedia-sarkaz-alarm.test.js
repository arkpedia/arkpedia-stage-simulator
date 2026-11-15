// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import alarmAnimation from '../data/arkpedia-sentinel-animation.json' with { type: 'json' };
import leaderAnimation from '../data/arkpedia-sentinel-leader-animation.json' with { type: 'json' };
const SENTINELS = ['enemy_1073_dscout', 'enemy_1073_dscout_2'];
const STANDBY = ['enemy_1074_dbskar', 'enemy_1074_dbskar_2', 'enemy_1075_dmgswd', 'enemy_1075_dmgswd_2'];
function fixture() {
  const guard = chessRec({ id: 'alarm_target', stats: { maxHp: 1e6, atk: 0, def: 0, res: 0 }, skill: null });
  const defs = Object.fromEntries([...SENTINELS, ...STANDBY, 'enemy_1007_slime'].map(id => [id, structuredClone(ENEMY_RECORDS.enemies[id].levels[0])]));
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 240, defs: { enemies: defs, chess: { [guard.chessId]: guard } },
    units: [[9, 6], [10, 6], [11, 6]].map(([row, col]) => ({ chessId: guard.chessId, row, col })), setup: installEnemyFeatures });
  const b = h.b; b.start(); for (const u of b.allyUnits) b.addBuff(u, { key: 'quiet', flags: { disarm: true, noMove: true, noBlock: true } });
  return { h, b, units: b.allyUnits, spawn: id => b.spawnEnemy(id, { pos: [9, 8] }) };
}
for (const id of STANDBY) {
  test(`${id}: temporary self-bind expires without waking; injury wakes through a 0.2-second HP listener`, () => {
    const { h, b, spawn } = fixture(), e = spawn(id), x = e.x;
    assert.equal(e.s.flags.disarm, true); assert.equal(e.s.flags.noMove, true); assert.equal(e.s.flags.stun, false);
    h.run(149.8); assert.equal(e.x, x); assert.equal(e.stats.attacks, 0);
    h.run(1); assert.notEqual(e.x, x); assert.equal(e.stats.attacks, 0); assert.equal(e.s.flags.disarm, true);
    b.dealDamage(null, e, { amount: e.s.maxHp * .01, type: 'true' }); h.run(.21);
    assert.ok(!e.s.flags.disarm && !e.s.flags.noMove); assert.ok(Math.abs(e.s.moveSpeed - 1.2) < 1e-9);
    b.emit('enemyStandbyWake', { unit: e }); assert.ok(Math.abs(e.s.moveSpeed - 1.2) < 1e-9, 'repeated wake cannot stack speed');
    assert.deepEqual(b.errors, []);
  });
}
for (const id of SENTINELS) {
  test(`${id}: protects the initial HP listener, alarms once and wakes all four native slumber variants`, () => {
    const { h, b, spawn } = fixture(), asleep = STANDBY.map(spawn), e = spawn(id), leader = id.endsWith('_2');
    h.run(.1); assert.equal(e.stats.attacks, 0);
    b.dealDamage(null, e, { amount: 1e6, type: 'true' }); assert.equal(e.hp, 1); assert.equal(e.alive, true);
    h.runUntil(() => !e.findBuff('ab:sentinelUndead') || asleep[0].findBuff(`ab:sarkazAlarm:${e.id}`), .5);
    if (!leader) { assert.ok(asleep.every(u => u.s.flags.disarm)); h.run(.11); }
    for (const u of asleep) {
      assert.ok(!u.s.flags.disarm && !u.s.flags.noMove);
      assert.ok(Math.abs(u.s.atk - u.base.atk * (leader ? 1.5 : 1.3)) < 1e-8);
      assert.ok(Math.abs(u.s.def - u.base.def * (leader ? 1.5 : 1.3)) < 1e-8);
    }
    if (leader) { assert.ok(e.s.flags.undeadable); h.run(.4); assert.ok(e.s.flags.undeadable); h.run(.3); }
    assert.ok(!e.s.flags.undeadable); const later = spawn('enemy_1007_slime'); h.run(1);
    assert.equal(later.findBuff(`ab:sarkazAlarm:${e.id}`), null, 'no permanent battlefield aura');
    assert.equal(e.stats.attacks, 0); assert.deepEqual(b.errors, []);
  });
}
test('ordinary Sentinel can be defeated between mode change and alarm; leader protection lasts through the cast', () => {
  for (const id of SENTINELS) {
    const { h, b, spawn } = fixture(), e = spawn(id), u = spawn('enemy_1074_dbskar');
    b.dealDamage(null, e, { amount: 1e6, type: 'true' }); h.step();
    b.dealDamage(null, e, { amount: 1e6, type: 'true' });
    if (id === SENTINELS[0]) { assert.equal(e.alive, false); h.run(1); assert.equal(u.s.flags.disarm, true); }
    else { assert.equal(e.alive, true); h.run(.15); assert.ok(u.findBuff(`ab:sarkazAlarm:${e.id}`)); }
  }
});
test('independent alarm grants stack additively, survive the source, and do not wake unrelated enemies', () => {
  const { h, b, spawn } = fixture(), u = spawn('enemy_1007_slime'), first = spawn(SENTINELS[0]), second = spawn(SENTINELS[1]);
  b.addBuff(u, { key: 'unrelatedSleep', flags: { disarm: true } });
  for (const e of [first, second]) b.dealDamage(null, e, { amount: 100, type: 'true' }); h.run(1);
  assert.ok(Math.abs(u.s.atk - u.base.atk * 1.8) < 1e-9); assert.equal(u.s.flags.disarm, true);
  b.kill(first); b.kill(second); assert.ok(Math.abs(u.s.atk - u.base.atk * 1.8) < 1e-9);
  assert.deepEqual(b.errors, []);
});
test('Grudgebearer selects two ground targets and delivers direct melee-path Arts damage', () => {
  const { h, b, spawn, units } = fixture(), e = spawn('enemy_1074_dbskar');
  units[2].motion = 'FLY'; const hits = []; b.on('damaged', c => { if (c.source === e) hits.push(c); });
  b.emit('enemyStandbyWake', { unit: e }); h.runUntil(() => hits.length >= 2, 3);
  assert.equal(hits.length, 2); assert.equal(b.projectiles.list.length, 0);
  assert.ok(hits.every(c => c.dmg.applyWay === 'melee' && c.dmg.type === 'arts' && c.target !== units[2]));
  assert.deepEqual(b.errors, []);
});
test('alarm duration matches both original Skill_Begin clips; changed native mechanics refuse admission', () => {
  for (const a of [alarmAnimation, leaderAnimation]) assert.ok(Math.abs(a.durations.Skill_Begin - 2 / 3) < 1e-6);
  for (const id of [...SENTINELS, ...STANDBY]) {
    const entry = ENEMY_RECORDS.enemies[id]; assert.ok(enemySupport(entry, index.prefabs, evidence).policy, id);
    assert.equal(enemySupport(entry, index.prefabs, {}).policy, null);
    const changed = structuredClone(evidence);
    for (const row of changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) {
      const c = JSON.parse(row.originalJson);
      for (const buff of c._buffs ?? []) if (buff.templateKey === 'enemy_hp_listener') buff.triggerInterval = 1;
      row.originalJson = JSON.stringify(c);
    }
    assert.equal(enemySupport(entry, index.prefabs, changed).policy, null, id + ' changed HP timer');
  }
  const changed = structuredClone(evidence); changed.templates.dscout_cancel_undead.eventToActions.ON_BUFF_START[0]._buffKey = 'different';
  assert.equal(enemySupport(ENEMY_RECORDS.enemies[SENTINELS[1]], index.prefabs, changed).policy, null);
});
