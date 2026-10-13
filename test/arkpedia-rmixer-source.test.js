// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-rmixer-prefabs.json' with { type: 'json' };
import { RMIXER_ID as ID, rmixerSourceComponent as component } from '../server/sim/content/arkpedia-rmixer-source.js';
const rows = ['characters', 'skills', 'projectiles'].flatMap(g => Object.values(e[g]).flat());
const flat = b => Object.fromEntries(b.map(x => [x.key, x.value]));
const actions = (key, event) => e.templates[key].eventToActions[event];
const type = n => n.$type.split('+').at(-1).split(',')[0];

test('native receipt keeps all dependencies and both original facing bindings while its historical enablement hold is preserved', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.modelCommit, 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd');
  assert.equal(e.source.nativeClient, '26-09-23-17-49-43_b9cc4a');
  assert.equal(e.source.bundles.length, 5); assert.equal(Object.keys(e.templates).length, 14);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.equal(rows.flatMap(r => r.components).length, 111);
  assert.equal(Object.keys(e.projectiles).length, 3);
  assert.deepEqual(Object.keys(e.tables.ranges), ['2-2', '3-13', 'x-4']);
  for (const k of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[k], false);
  for (const face of ['Front', 'Back']) {
    assert.equal(e.officialSkeletonBindings[ID][face].sha256, e.models[ID][face].sha256);
    assert.equal(e.officialSkeletonBindings[ID][face].byteLength, e.models[ID][face].bytes);
  }
  function walk(v, key) {
    if (key === 'm_PathID') assert.equal(typeof v, 'string');
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  }
  walk(rows);
});

test('all thirty ranks retain Defensive S1 and cancellable manual ammo S2/S3', () => {
  for (let i = 1; i <= 3; i++) {
    const ranks = e.tables.skills[`skchr_rmixer_${i}`].levels;
    assert.equal(ranks.length, 10);
    for (const r of ranks) {
      assert.equal(r.skillType, i === 1 ? 'AUTO' : 'MANUAL');
      assert.equal(r.durationType, i === 1 ? 'NONE' : 'AMMO');
      assert.equal(r.spData.spType, i === 1 ? 'INCREASE_WHEN_TAKEN_DAMAGE' : 'INCREASE_WITH_TIME');
    }
  }
  assert.equal(component('8666956974333455062')._canDiscardRemainingCount, 1);
  assert.equal(component('-3546951952713955123')._canDiscardRemainingCount, 1);
});

test('ordinary/S2 projectile modes keep one trace target and S1 uses three authored events', () => {
  for (const [id, clip, projectile] of [['-7035987159684059176', 'Attack_Loop', 'projectile_chr_rmixer'],
    ['7781548002548215768', 'Skill_2_Loop', 'projectile_chr_rmixer_sk2']]) {
    const a = component(id);
    assert.equal(a._animKey, clip); assert.equal(a._projectileKey, projectile);
    assert.equal(a._alwaysIncludeTarget, 1); assert.equal(a._damageType, 1);
    assert.equal(a._waitForAttackEvent, 1);
  }
  const a = e.skills.skchr_rmixer_1.flatMap(r => r.components).map(c => c.data).find(c => c._projectileKey);
  assert.equal(a._additionalTimes, 2); assert.equal(a._waitAttackEventForAllAttacks, 1);
  assert.equal(a._projectileKey, 'projectile_chr_rmixer_sk1');
  for (const face of ['Front', 'Back']) {
    const m = e.models[ID][face];
    assert.deepEqual(m.eventPayloads.Skill_Loop.map(e => e.time), [0, .23333333432674408, .46666666865348816]);
    assert.deepEqual(m.eventPayloads.Attack_Loop.map(e => e.time), [0]);
    assert.deepEqual(m.eventPayloads.Skill_2_Loop.map(e => e.time), [0]);
  }
  for (const p of Object.values(e.projectiles)) {
    const c = p.flatMap(r => r.components).map(c => c.data);
    assert.equal(c.find(c => c._speed != null)._speed, 10);
    const projectile = c.find(c => c._lifeTime != null);
    assert.equal(projectile._lifeTime, 10); assert.equal(projectile._maxHitNum, 1);
    assert.equal(projectile._stopWhenSourceInvalid, 0);
  }
});

test('S2 has a whole-HP-set rejection in both sufficient and insufficient ammo branches', () => {
  const a = actions('rmixer_sk2', 'ON_BEFORE_TRY_SET_HP_ZERO');
  assert.equal(type(a[0]), 'AssignAmmoSkillRemainingCountToBB'); assert.equal(a[0]._blackboardKey, 'cur_count');
  const branch = a[1];
  assert.equal(branch._conditionsNode[0]._anotherKeyToCompare, 'ammo_cost');
  assert.equal(branch._conditionsNode[0]._condType, 'GE');
  for (const [nodes, key, trigger] of [[branch._succeedNodes, 'ammo_cost', false], [branch._failNodes, 'cur_count', true]]) {
    assert.equal(type(nodes[0]), 'ConsumeTrySetHpZeroModifier');
    assert.equal(nodes[0]._blockThisHpSet, true); assert.equal(nodes[0]._dontConsumeWhenUndeadable, true);
    assert.equal(nodes[1]._consumeCountBBKey, key); assert.equal(nodes[1]._triggerConsumeEvent, trigger);
  }
});

test('barrier snapshots own current Max HP and distinguishes normal counterattack alias', () => {
  const a = actions('rmixer_t2', 'ON_AFTER_ATTACK');
  assert.equal(a[0]._abilityName, 'S3Attack'); assert.equal(type(a[1]), 'IfNot');
  assert.equal(type(a[2]), 'FinishDerivedBuff');
  const take = actions('rmixer_t2', 'ON_TAKE_DAMAGE')[0];
  assert.equal(take._filterDamageType, false); assert.equal(take._filterApplyWay, false);
  assert.equal(take._showShieldUI, true);
  const sample = actions('rmixer_t2', 'ON_BUFF_TRIGGER')[0];
  assert.equal(sample._attributeType, 'MAX_HP'); assert.equal(sample._scaleVar, 'shield');
  assert.equal(sample._targetType, 'BUFF_OWNER');
});

test('S3 native damage event dispatch chooses two distinct eventless counterattack clocks', () => {
  const branch = actions('rmixer_sk3', 'ON_TAKE_DAMAGE')[0];
  assert.equal(branch._conditionsNode[0]._blackboardKey, 'base_attack_time');
  assert.equal(branch._conditionsNode[0]._condType, 'LE');
  assert.equal(branch._succeedNodes[0]._abilityName, 'S3Attack_Zero');
  assert.equal(branch._succeedNodes[0]._castDirectly, true);
  assert.equal(branch._failNodes[0]._abilityName, 'S3Attack');
  assert.equal(branch._failNodes[0]._checkCanUseAblityFlag, true);
  const normal = component('-8831280125258731560'), zero = component('7220685850704113624');
  assert.equal(normal._waitForAttackEvent, 0); assert.equal(zero._waitForAttackEvent, 0);
  assert.equal(normal._timeMode, 0); assert.equal(zero._timeMode, 2);
  assert.equal(normal._allowNoTarget, 1); assert.equal(zero._allowNoTarget, 1);
  assert.equal(component('3109481951465074648')._countEvent, 4);
  assert.equal(component('-2532073356256317480')._countEvent, 2);
  for (const r of e.tables.skills.skchr_rmixer_3.levels) assert.equal(flat(r.blackboard)['attack@max_target'], 3);
});

test('S1 recipient has native Laterano, ammo-duration and active-skill validators; S3 recovers current rounds globally', () => {
  assert.deepEqual(component('-8012436871788131590')._tags, ['laterano']);
  assert.deepEqual(component('-8183669405685609734')._checkTypes, [1]);
  assert.equal(component('-607868508060480774')._checkSkillAffecting, 1);
  assert.equal(component('-2442329197482112262')._excludeOwner, 1);
  const trigger = actions('rmixer_sk1[trigger-ability]', 'ON_BUFF_START');
  assert.equal(trigger.find(n => type(n) === 'TriggerAbility')._abilityName, 'AmmoRecover');
  assert.equal(trigger.find(n => type(n) === 'CreateBuff')._buff.buffKey, 'rmixer_sk1[trigger-ability-mark]');
  const recharge = actions('rmixer_sk3', 'ON_BUFF_START')[0];
  assert.equal(recharge._useGlobalRange, true); assert.equal(recharge._targetOptions.targetSide, 'ALLY');
  const a = actions('rmixer_sk3[ammo-recover]', 'ON_BUFF_START');
  assert.equal(a[0]._groupTag, 'laterano'); assert.equal(type(a[1]), 'CheckTargetSkillDurationType');
  assert.equal(type(a[2]), 'CheckCharSkillAffecting');
  assert.equal(a[3]._recoverEventCount, true); assert.equal(a[3]._modifyMaxCount, false);
  assert.equal(a[3]._recoverCountBBKey, 'ammo');
});
