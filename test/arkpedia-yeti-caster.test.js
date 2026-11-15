// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { applyStageEnemyBlackboard } from '../shared/arkpedia/stage-enemy-talents.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ID = 'enemy_1068_snmage';
function fixture(record = ENEMY_RECORDS.enemies[ID].levels[0]) {
  const guard = chessRec({ id: 'yeti_target', stats: { maxHp: 1e6, atk: 0, def: 0, res: 0 } });
  record = structuredClone(record); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { enemies: { [record.key]: record }, chess: { [guard.chessId]: guard } },
    units: [{ chessId: guard.chessId, row: 9, col: 6 }], setup: installEnemyFeatures });
  const b = h.b; b.start(); const u = b.allyUnits[0];
  b.addBuff(u, { key: 'stationary', flags: { noMove: true, disarm: true, noBlock: true } });
  const e = b.spawnEnemy(record.key, { pos: [9, 8] }), hits = [];
  b.on('damaged', c => hits.push(c));
  return { h, b, u, e, hits };
}
test('Yeti Caster: ordinary shots travel; the third shot carries Cold until impact', () => {
  const { h, b, u, e, hits } = fixture();
  h.runUntil(() => b.projectiles.list.length > 0, 5);
  assert.equal(hits.length, 0); assert.equal(u.buffs.some(x => x.status === 'cold'), false);
  h.runUntil(() => hits.length === 1, 1);
  assert.equal(hits[0].hpLoss, 320); assert.equal(hits[0].dmg.applyWay, 'ranged');
  h.runUntil(() => e.stats.attacks === 3, 15);
  assert.equal(u.buffs.some(x => x.status === 'cold'), false, 'Cold does not precede its projectile');
  assert.ok(h.runUntil(() => u.buffs.some(x => x.status === 'cold'), 1));
  assert.equal(u.buffs.find(x => x.status === 'cold').duration, 10);
  assert.deepEqual(b.errors, []);
});
test('silence permits ordinary charging; released Cold survives source death and damage evasion', () => {
  const { h, b, u, e, hits } = fixture();
  b.addBuff(e, { key: 'silenced', flags: { silence: true } });
  b.addBuff(u, { key: 'evasion', mods: { dodgeArts: 1 } });
  h.runUntil(() => e.stats.attacks === 3, 20); h.run(.3);
  assert.equal(u.buffs.some(x => x.status === 'cold'), false); assert.equal(hits.length, 0);
  b.removeBuff(e, 'silenced'); h.runUntil(() => e.stats.attacks === 4, 6);
  assert.equal(u.buffs.some(x => x.status === 'cold'), false); b.kill(e);
  assert.ok(h.runUntil(() => u.buffs.some(x => x.status === 'cold'), 1)); assert.equal(hits.length, 0);
  assert.deepEqual(b.errors, []);
});
test('TR-16 original skill duration and initial SP change only the local enemy records', async () => {
  const plan = await planStage(await loadContentContext(), 'tr-16'); assert.deepEqual(plan.blockers, []);
  const a = plan.stage.enemies[ID], elite = plan.stage.enemies[`${ID}_2`];
  assert.equal(a.skills[0].bb.freeze, 12); assert.equal(elite.sp.initSp, 1);
  assert.equal(ENEMY_RECORDS.enemies[ID].levels[0].skills[0].bb.freeze, 10);
  assert.equal(ENEMY_RECORDS.enemies[`${ID}_2`].levels[0].sp.initSp, 0);
  for (const [r, attacks, duration] of [[a, 3, 12], [elite, 2, 10]]) {
    const { h, b, u, e } = fixture(r); assert.ok(h.runUntil(() => u.buffs.some(x => x.status === 'cold'), 20));
    assert.equal(e.stats.attacks, attacks); assert.equal(u.buffs.find(x => x.status === 'cold').duration, duration);
    assert.deepEqual(b.errors, []);
  }
});
test('literal skill/SP overrides reject altered mechanics and undeclared parameters', () => {
  const r = ENEMY_RECORDS.enemies[ID].levels[0];
  const skill = { prefabKey: 'coldattack', priority: 0, cooldown: 0, initCooldown: 0, spCost: 2,
    blackboard: [{ key: 'freeze', value: 12, valueStr: null }] };
  for (const extra of [{ skills: [{ ...skill, spCost: 1 }] }, { skills: [{ ...skill, prefabKey: 'other' }] },
    { skills: [{ ...skill, blackboard: [{ key: 'freeze', value: -1 }] }] },
    { skills: [{ ...skill, blackboard: [{ key: 'new', value: 1 }] }] },
    { spData: { spType: r.sp.type, maxSp: 3, initSp: 1, increment: 1 } },
    { spData: { spType: r.sp.type, maxSp: 2, initSp: 3, increment: 1 } }])
    assert.throws(() => applyStageEnemyBlackboard(r, { level: 0, blackboard: [], ...extra }));
});
test('native admission rejects changed projectile motion, payload missability and ordinary attack', () => {
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[ID], index.prefabs, evidence).policy);
  for (const change of ['projectile', 'buff', 'ordinary']) {
    const d = structuredClone(evidence);
    const rows = change === 'projectile' ? d.projectiles.projectile_enemy_snow_magic_ball : d.prefabs[`dyn/battle/prefabs/enemies/${ID}.prefab`];
    for (const row of rows) {
      const c = JSON.parse(row.originalJson);
      if (change === 'projectile' && '_speed' in c) c._speed = 1;
      if (change === 'buff' && c._activeBuffs?.length) c._activeBuffs[0].isDamageMissable = 1;
      if (change === 'ordinary' && row.objectName === 'Attack' && '_atkScale' in c) c._atkScale = 2;
      row.originalJson = JSON.stringify(c);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ID], index.prefabs, d).policy, null, change);
  }
});
