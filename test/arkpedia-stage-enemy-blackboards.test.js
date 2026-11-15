// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { applyStageEnemyBlackboard, applyStageEnemyTalentMultipliers } from '../shared/arkpedia/stage-enemy-talents.js';
import { originalEnemyAttributes } from '../tools/arkpedia/stage-enemy-blackboards.mjs';
import { makeBattle } from './helpers/battleHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
const context = await loadContentContext();
test('OD-EX-1 challenge adds one Infused Warrior death child through the existing count account', async () => {
  const p = await planStage(context, 'od-ex-1_challenge_mode'); assert.deepEqual(p.blockers, []);
  const id = 'enemy_1130_infstr', r = p.stage.enemies[id], base = ENEMY_RECORDS.enemies[id].levels[0];
  assert.equal(r.talents.bb['deathrattle.cnt'], base.talents.bb['deathrattle.cnt'] + 1);
  const child = r.talents.bbStr['deathrattle.enemy_key'];
  const h = makeBattle({ content: 'none', autoFinish: false, units: [], defs: { enemies: p.stage.enemies }, setup: installEnemyFeatures });
  h.b.start(); h.b.kill(h.b.spawnEnemy(id, { pos: [9, 8] })); h.run(1);
  assert.equal(h.b.enemies.filter(e => e.defId === child).length, r.talents.bb['deathrattle.cnt']);
  for (const amount of [-base.talents.bb['deathrattle.cnt'], .5, 21, Infinity])
    assert.throws(() => applyStageEnemyTalentMultipliers(base, {}, { 'deathrattle.cnt': amount }), /Unsupported enemy talent addition/);
  assert.deepEqual(h.b.errors, []);
});
test('CB-10 replaces the reviewed Rat King skill list by identity, preserving order, timing and omitted Mark', async () => {
  const plan = await planStage(context, 'cb-10'); assert.deepEqual(plan.blockers, []);
  const r = plan.stage.enemies.enemy_1509_mousek;
  assert.deepEqual(r.skills.map(s => s.prefabKey), ['SandStorm', 'DriftSand']);
  assert.equal(r.skills[0].initCooldown, 65); assert.equal(r.skills[1].bb.damage, 1200);
  const base = ENEMY_RECORDS.enemies.enemy_1509_mousek.levels[0];
  assert.equal(base.skills.length, 3); assert.equal(base.skills[0].bb.damage, 800);
  const h = makeBattle({ content: 'none', autoFinish: false, units: [], defs: { enemies: { [r.key]: r } }, setup: installEnemyFeatures });
  h.b.start(); const e = h.b.spawnEnemy(r.key, { pos: [9, 8] });
  assert.equal(e.mem.ratKing.markAt, Infinity); assert.deepEqual(e.mem.ratKing.clocks, [65, 20]);
  const sourceSkills = r.skills.map(({ bb, bbStr, ...s }) => ({ ...s, blackboard: Object.entries(bb).map(([key, value]) => ({ key, value, valueStr: null })) }));
  const apply = skills => applyStageEnemyBlackboard(base, { level: 0, blackboard: [], skills });
  assert.deepEqual(apply(sourceSkills).skills, r.skills);
  assert.throws(() => apply([...sourceSkills].reverse()), /Unsupported original enemy skill/);
  assert.throws(() => apply([sourceSkills[0], sourceSkills[0]]), /Unsupported original enemy skill/);
  assert.throws(() => apply([{ ...sourceSkills[0], prefabKey: 'NewSkill' }, sourceSkills[1]]), /Unsupported original enemy skill/);
  assert.throws(() => apply(sourceSkills.map(s => ({ ...s, priority: 8 }))), /Unsupported original enemy skill/);
  assert.deepEqual(h.b.errors, []);
});
test('DM-6 retains original zero self-bind duration, begins moving while disarmed and shares its original blob', async () => {
  const plan = await planStage(context, 'dm-6'); assert.deepEqual(plan.blockers, []);
  const id = 'enemy_1074_dbskar', r = plan.stage.enemies[id];
  assert.equal(r.talents.bb['revive.unmove_duration'], 0); assert.equal(r.talents.bb['revive.move_speed'], 2);
  assert.equal(ENEMY_RECORDS.enemies[id].levels[0].talents.bb['revive.unmove_duration'], 150);
  assert.ok(plan.localSources.some(s => s.path.startsWith('.cache/arkpedia/original-level-blobs/')));
  const h = makeBattle({ content: 'none', autoFinish: false, units: [], defs: { enemies: { [id]: r } }, setup: installEnemyFeatures });
  h.b.start(); const e = h.b.spawnEnemy(id, { pos: [9, 8] }), x = e.x; h.run(1);
  assert.ok(e.x < x); assert.equal(e.s.flags.disarm, true); assert.equal(e.stats.attacks, 0); assert.deepEqual(h.b.errors, []);
});
test('FA-6 variants retain weaker original Pompeii values without changing the global record', async () => {
  for (const id of ['fa-6', 'fa-6_challenge_mode']) {
    const plan = await planStage(context, id); assert.deepEqual(plan.blockers, []);
    const bb = plan.stage.enemies.enemy_1050_lslime.talents.bb;
    assert.equal(bb['dot.damage'], 15); assert.equal(bb['rangedamage.attack@damage'], 750);
    assert.equal(bb['dot.interval'], .33); assert.equal(bb['selfbuff.attack_speed'], 40);
  }
  assert.equal(ENEMY_RECORDS.enemies.enemy_1050_lslime.levels[0].talents.bb['dot.damage'], 20);
});
test('literal override validation rejects unknown parameters, changed identities, unsupported skill/SP changes, duplicates and level mismatch', () => {
  const r = ENEMY_RECORDS.enemies.enemy_1360_dfello.levels[0], apply = blackboard => applyStageEnemyBlackboard(r, { level: 0, blackboard });
  assert.equal(apply([{ key: 'DamageUp.scale_ratio', value: 0 }]).talents.bb['DamageUp.scale_ratio'], 0);
  assert.doesNotThrow(() => apply([{ key: 'Summon.enemy_key', value: 0, valueStr: 'enemy_1367_dseed' }]));
  for (const entries of [[{ key: 'new.attack', value: 1 }], [{ key: 'Summon.enemy_key', value: 0, valueStr: 'enemy_1007_slime' }],
    [{ key: 'DamageUp.scale_ratio', value: -1 }], [{ key: 'DamageUp.scale_ratio', value: 0 }, { key: 'DamageUp.scale_ratio', value: 1 }]])
    assert.throws(() => apply(entries), /Unsupported original enemy parameter/);
  assert.throws(() => applyStageEnemyBlackboard(r, { level: 1, blackboard: [] }), /level differs/);
  for (const extra of [{ skills: [{}] }, { spData: {} }]) assert.throws(() => applyStageEnemyBlackboard(r, { level: 0, blackboard: [], ...extra }), /skill\/SP override/);
  assert.equal(r.talents.bb['DamageUp.scale_ratio'], .2);
});

test('SE-6 retains the Storm zero-capacity SP override without creating a skill or widening other enemy overrides', async () => {
  for (const id of ['se-6', 'se-6_challenge_mode']) {
    const p = await planStage(context, id); assert.deepEqual(p.blockers, []);
    assert.deepEqual(p.stage.enemies.enemy_1420_lrmm.sp, { type: 'INCREASE_WITH_TIME', maxSp: 0, initSp: 0, increment: 1 });
    assert.deepEqual(p.stage.enemies.enemy_1420_lrmm.skills, []);
  }
  const sp = { spType: 'INCREASE_WITH_TIME', maxSp: 0, initSp: 0, increment: 1 };
  const apply = (record, spData) => applyStageEnemyBlackboard(record, { level: 0, blackboard: [], spData });
  const storm = ENEMY_RECORDS.enemies.enemy_1420_lrmm.levels[0];
  for (const change of [{ maxSp: 1 }, { initSp: 1 }, { increment: 2 }, { spType: 'INCREASE_WHEN_ATTACK' }])
    assert.throws(() => apply(storm, { ...sp, ...change }), /Unsupported original enemy skill\/SP/);
  assert.throws(() => apply(ENEMY_RECORDS.enemies.enemy_1421_lrchld.levels[0], sp), /Unsupported original enemy skill\/SP/);
});


test('original enemy attributes use only defined values, preserve unknown fields for rejection and validate source shape', () => {
  const refs = [{ id: 'enemy_test', useDb: true, level: 0, overwrittenData: { attributes: {
    maxHp: { m_defined: true, m_value: 900 }, atk: { m_defined: false, m_value: -999999 },
    silenceImmune: { m_defined: true, m_value: true }, futureAttribute: { m_defined: true, m_value: 7 },
  }, rangeRadius: { m_defined: true, m_value: 2 }, lifePointReduce: { m_defined: true, m_value: 0 } } }];
  const before = structuredClone(refs);
  assert.deepEqual(originalEnemyAttributes(refs), { enemy_test: { level: 0, overrides: {
    hp: 900, silenceImmune: true, futureAttribute: 7, range: 2, life_cost: 0,
  } } });
  assert.deepEqual(refs, before);
  assert.throws(() => originalEnemyAttributes([...refs, ...refs]), /Duplicate/);
  assert.throws(() => originalEnemyAttributes([{ ...refs[0], level: -1 }]), /database level/);
  const bad = structuredClone(refs); delete bad[0].overwrittenData.attributes.maxHp.m_defined;
  assert.throws(() => originalEnemyAttributes(bad), /Malformed/);
});

test('DM-EX-6 variants replace corrupt viewer overrides with verified original attributes', async () => {
  for (const id of ['dm-ex-6', 'dm-ex-6_challenge_mode']) {
    const p = await planStage(context, id, { waves: true }); assert.deepEqual(p.blockers, []);
    const entry = p.stage.geometry.enemyConfigurations.find(c => c.enemy_id === 'enemy_1073_dscout_2');
    assert.deepEqual(entry.overrides, { stunImmune: true, silenceImmune: true });
    const r = p.stage.enemies[entry.enemy_id];
    assert.equal(r.stats.immunities.stun, true); assert.equal(r.stats.immunities.silence, true);
    assert.equal(r.stats.blockCnt, ENEMY_RECORDS.enemies[entry.enemy_id].levels[0].stats.blockCnt);
    assert.equal(p.stage.enemies.enemy_1074_dbskar_2.talents.bb['revive.unmove_duration'], 300);
    assert.ok(p.localSources.some(s => s.path.includes('/original-level-blobs/')));
  }
});
