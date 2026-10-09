// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-weedy-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID = 'char_400_weedy', TOKEN = 'token_10009_weedy_cannon';
const rows = (group, id) => e[group][id].flatMap(o => o.components.map(c => c.data));
const bb = list => Object.fromEntries(list.map(r => [r.key, r.value]));

test('Weedy audit preserves all40 ranks without enabling partial combat coverage', () => {
  assert.deepEqual(e.enabledOperators, []);
  assert.equal(REGULAR_OPERATORS[ID], undefined); assert.equal(data.operators[ID], undefined);
  assert.equal(e.frameParity, false); assert.equal(e.moduleSupport, false);
  assert.equal(e.nativeParticleSupport, false);
  assert.equal(e.source.bundles.length, 6);
  assert.equal(Object.keys(e.tables.skills).length, 4);
  for (const skill of Object.values(e.tables.skills)) assert.equal(skill.levels.length, 10);
  for (const source of e.source.bundles) assert.match(source.sha256, /^[a-f0-9]{64}$/);
});
test('normal and S1 capture ground victims limited by block count; ordinary attacks do not push', () => {
  const normal = rows('characters', ID).find(d => d._animKey === 'Attack');
  assert.equal(normal._selectTargetSource, 1); assert.equal(normal._selectTargetTiming, 0);
  assert.deepEqual(normal._activeBuffs, []); assert.equal(normal._maxAnimScale, 1);
  const selector = rows('skills', 'skchr_weedy_1').find(d => d._limitedMaxTargetNumToBlockedCnt != null);
  assert.equal(selector._limitedMaxTargetNumToBlockedCnt, 1); assert.equal(selector._targetMotion, 1);
  const s1 = rows('skills', 'skchr_weedy_1').find(d => d._animKey);
  assert.equal(s1._maxAnimScale, -1);
  assert.deepEqual(s1._activeBuffs.map(b => b.templateKey), ['knockback[dir]', 'empty']);
  assert.equal(s1._activeBuffs[1].buffKey, 'stun'); assert.equal(s1._activeBuffs[1].loadFromDB, 1);
});
test('S2 retains percentage BAT and true source radius, not a flat replacement or generic melee splash', () => {
  const buff = rows('skills', 'skchr_weedy_2').find(d => d._buffs)?.['_buffs'][0];
  const bat = buff.attributes.attributeModifiers.find(d => d.attributeType === 8);
  assert.equal(bat.formulaItem, 1); assert.equal(bat.loadFromBlackboard, 1);
  const last = bb(e.tables.skills.skchr_weedy_2.levels.at(-1).blackboard);
  assert.equal(last.base_attack_time, 2.2);
  assert.ok(Math.abs(e.tables.character.phases[2].attributesKeyFrames[0].data.baseAttackTime * (1 + last.base_attack_time) - 3.84) < 1e-9);
  assert.equal(rows('projectiles', 'projectile_weedy_s2').find(d => d.m_Radius).m_Radius, 0.8999999761581421);
});
test('S3/cannon share all rank blackboards and native remote activation, fixed clock and1.2 splash', () => {
  for (let i = 0; i < 10; i++) assert.deepEqual(e.tables.skills.skchr_weedy_3.levels[i].blackboard,
    e.tables.skills.sktok_weedy_token.levels[i].blackboard);
  for (const id of ['skchr_weedy_3', 'sktok_weedy_token']) {
    const attack = rows('skills', id).find(d => d._animKey);
    assert.equal(attack._timeMode, 1); assert.equal(attack._waitForProjectileInvalid, 1);
    const rupture = attack._activeBuffs.find(b => b.templateKey === 'rupture');
    assert.equal(rupture.overrideKey, 'rupture'); assert.equal(rupture.overrideType, 3);
  }
  assert.equal(rows('skills', 'sktok_weedy_token').find(d => d._isRemoteControlled != null)._isRemoteControlled, 1);
  assert.equal(rows('projectiles', 'projectile_weedy_s3').find(d => d.m_Radius).m_Radius, 1.2000000476837158);
  const trigger = e.templates.trigger_token_skill_within_range.eventToActions.ON_BUFF_START[0];
  assert.ok(trigger.$type.includes('TriggerTokenSkillWithinManhattanDistance'));
  assert.equal(bb(e.tables.skills.skchr_weedy_3.levels[9].blackboard).dist, 1);
});
test('cannon source keeps zero-slot BOTH placement, finish recharge,15/20s life and adjacent aura range', () => {
  const root = rows('tokens', TOKEN).find(d => d._occupiedRemainingCharacterCnt != null);
  assert.equal(root._occupiedRemainingCharacterCnt, 0); assert.equal(root._useRealBornTimeFromAnim, 0);
  assert.equal(root._buildCondition.buildableType, 3); assert.equal(root._buildCondition.needSpecifyDirection, 1);
  assert.equal(root._withdrawCostRecoverRatio, .5);
  const t = e.tables.tokens[TOKEN];
  assert.deepEqual(t.talents[0].candidates.map(c => bb(c.blackboard).duration), [15, 20]);
  assert.equal(t.talents[1].candidates[0].rangeId, 'x-5');
  assert.deepEqual(bb(t.talents[1].candidates[0].blackboard), { base_force_level: 1, interval: 3, sp: 1 });
  assert.ok(e.tables.ranges['x-5'].grids.every(({row,col}) => Math.abs(row) + Math.abs(col) <= 1));
  assert.ok(rows('tokens', TOKEN).some(d => d._buffs?.some(b => b.templateKey === 'charge_token[finish]')));
});
test('four original skeleton chains and separate cannon material pointers survive duplicate source filenames', () => {
  for (const id of [ID, TOKEN]) for (const face of ['Front', 'Back'])
    assert.equal(e.models[id][face].sha256, e.officialSkeletonBindings[id][face].sha256);
  const f = e.officialSkeletonBindings[TOKEN].Front, b = e.officialSkeletonBindings[TOKEN].Back;
  for (const key of ['textAssetPathId', 'skeletonDataAssetPathId', 'materialPathId', 'rgbTexturePathId', 'alphaTexturePathId'])
    assert.notEqual(f[key], b[key]);
  assert.notEqual(f.sha256, b.sha256);
  for (const face of ['front', 'back']) {
    const m = e.originalCannonModels.models[TOKEN].facings[face];
    assert.equal(m.animationRoles.die, 'Idle'); assert.equal(m.animationRoles.deploy, 'Start');
    assert.deepEqual(m.hits.Attack_Loop, [.033]); assert.deepEqual(m.hits.Skill, [.333]);
    assert.equal(m.durations.Attack_Begin, .167);
  }
});
test('rupture source includes initialization,periodic and final distance damage; execution parity remains explicit', () => {
  const events = e.templates.rupture.eventToActions;
  assert.equal(events.ON_BUFF_START[0]._isInit, true);
  for (const key of ['ON_BUFF_TRIGGER','ON_BUFF_FINISH']) {
    assert.equal(events[key][0]._isInit, false); assert.equal(events[key][0]._damageType, 'PURE');
  }
  assert.ok(e.verificationLimits.some(s => s.includes('instantaneous local shift')));
  assert.ok(e.verificationLimits.some(s => s.includes('closed native code')));
});
test('native pointers stay exact strings and unsupported floats have explicit string serialization', () => {
  const walk = (v, key = '') => {
    if (key === 'm_PathID') assert.equal(typeof v, 'string');
    if (typeof v === 'number') assert.ok(Number.isFinite(v));
    else if (Array.isArray(v)) v.forEach(x => walk(x));
    else if (v && typeof v === 'object') for (const [k,x] of Object.entries(v)) walk(x,k);
  };
  walk(e);
});
