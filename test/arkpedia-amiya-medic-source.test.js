// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-amiya-medic-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';

const ID = 'char_1037_amiya3';
const components = group => Object.values(group).flatMap(rows => rows.flatMap(r => r.components));
const rows = [...components(e.characters), ...components(e.skills), ...components(e.projectiles)];
const component = id => rows.find(c => c.pathId === id)?.data;
const bb = values => Object.fromEntries(values.map(r => [r.key, r.value]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const actions = (key, event) => e.templates[key].eventToActions[event];
const type = (values, name) => values.filter(v => v.$type?.split(',')[0].endsWith(`+${name}`));

test('Medic source foundation retains the complete kit while combat registration stays held', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(REGULAR_OPERATORS[ID], undefined); assert.equal(data.operators[ID], undefined);
  assert.match(e.reviewStatus, /source foundation; combat adapter pending/);
  assert.equal(rows.length, 102); assert.equal(e.source.bundles.length, 5);
  assert.equal(Object.keys(e.templates).length, 9); assert.equal(Object.keys(e.projectiles).length, 2);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.templates), Object.keys(e.originalTemplates));
  assert.equal(e.recoveredFacts.length, 9); assert.deepEqual(e.runtimeContracts, []);
  assert.equal(e.verificationLimits.length, 4); assert.equal(e.holdReasons.length, 4);
  for (const key of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[key], false);
});

test('Global patch data preserves Medic identity and chapter-14 form unlock', () => {
  assert.equal(e.source.repository, 'Kengxxiao/ArknightsGameData_YoStar');
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.deepEqual(e.source.patchTable, { path: 'en_US/gamedata/excel/char_patch_table.json',
    sha: 'fc84d705f44b9c2e430069c482fbf935a995952e', size: 47115 });
  assert.equal(e.tables.character.name, 'Amiya'); assert.equal(e.tables.character.profession, 'MEDIC');
  assert.equal(e.tables.character.subProfessionId, 'incantationmedic');
  assert.equal(e.tables.character.position, 'RANGED');
  assert.deepEqual(e.tables.formInfo, { tmplIds: ['char_002_amiya', 'char_1001_amiya2', ID], default: 'char_002_amiya' });
  assert.deepEqual(e.tables.unlockConds[ID], { conds: [{ stageId: 'main_14-20', completeState: 'PASS', unlockTs: 0 }] });
  assert.equal(e.tables.patchDetailInfoList[ID].infoParam, 'Medic');
});

test('S1 retains every selected-rank speed, area-heal and recharge value', () => {
  const ranks = e.tables.skills.skchr_amiya3_1.levels;
  assert.equal(ranks.length, 10);
  assert.deepEqual(ranks.map(l => bb(l.blackboard).attack_speed), [30,35,40,45,50,55,60,65,70,75]);
  assert.deepEqual(ranks.map(l => bb(l.blackboard).heal_scale), [.1,.1,.1,.15,.15,.15,.2,.2,.2,.25]);
  assert.deepEqual(ranks.map(l => l.spData.initSp), [20,20,20,25,25,25,30,33,36,40]);
  for (const rank of ranks) {
    assert.equal(rank.duration, 50); assert.equal(rank.rangeId, 'x-1');
    assert.equal(rank.spData.spCost, 70); assert.equal(rank.skillType, 'MANUAL');
    assert.equal(rank.spData.spType, 'INCREASE_WITH_TIME');
  }
});

test('S2 retains all ten burst coefficients, stack caps, debuff times and one-use values', () => {
  const ranks = e.tables.skills.skchr_amiya3_2.levels;
  assert.equal(ranks.length, 10);
  assert.deepEqual(ranks.map(l => bb(l.blackboard).atk_scale), [1.4,1.45,1.5,1.55,1.6,1.65,1.7,1.8,1.9,2]);
  assert.deepEqual(ranks.map(l => bb(l.blackboard).atk), [.15,.15,.15,.2,.2,.2,.25,.25,.25,.3]);
  assert.deepEqual(ranks.map(l => bb(l.blackboard)['amiya3_s_2[debuff].duration']), [5,5,5,6,6,6,7,8,9,10]);
  assert.deepEqual(ranks.map(l => l.spData.spCost), [30,30,30,28,28,28,25,25,25,20]);
  for (const rank of ranks) {
    assert.equal(rank.duration, 32); assert.equal(rank.rangeId, null);
    assert.equal(rank.skillType, 'MANUAL'); assert.equal(rank.spData.spType, 'INCREASE_WITH_TIME');
    const values = bb(rank.blackboard);
    assert.equal(values.max_stack_cnt, 5); assert.equal(values.skill_max_trigger_time, 1);
    assert.equal(values['amiya3_s_2[debuff].attack_speed'], -60);
    assert.equal(values['amiya3_s_2[debuff].move_speed'], -.6);
  }
});

test('ordinary and S1 attacks keep separate one-target Arts projectile modes and native speed cap', () => {
  for (const [id, projectile, selector] of [
    ['7223227860240500211', 'projectile_chr_amiya3', '4752095896714675699'],
    ['1384560687938274803', 'projectile_chr_amiya3_s1', '-373509140296301069'],
  ]) {
    const a = component(id), s = component(selector);
    assert.equal(a._damageType, 2); assert.equal(a._projectileKey, projectile);
    assert.equal(a._maxAnimScale, 1); assert.equal(a._waitForAttackEvent, 1);
    assert.equal(a._elementDamageType, 0); assert.equal(a._epDamageRatio, 0);
    assert.equal(s._limitTargetNum, 1); assert.equal(s._maxNum, 1);
    assert.equal(s._targetSide, 2); assert.equal(s._targetMotion, 3);
    const flight = e.projectiles[projectile].flatMap(r => r.components).find(c => c.data._speed != null).data;
    assert.equal(flight._speed, 10); assert.equal(flight._delayToStart, 0);
    assert.equal(flight._flyToTargetLocationOnly, 0);
  }
});

test('trait healing uses calculated damage and one eligible ally instead of actual HP loss', () => {
  near(bb(e.tables.character.trait.candidates[0].blackboard).scale, .5);
  const a = actions('amiya3_tr', 'ON_AFTER_OUTPUT_DAMAGE');
  const assign = type(a, 'AssignDamageValueToBlackboard')[0];
  assert.equal(assign._scaleKey, 'scale'); assert.equal(assign._assignRealDelta, false);
  assert.equal(assign._assignValueWithoutCalculate, false); assert.equal(assign._damageType, 'HEAL');
  assert.equal(type(a, 'CreateBuffUseAbilitySelector')[0]._abilityName, 'TraitHealRange');
  const selector = component('4867660826156140019');
  assert.equal(selector._targetSide, 1); assert.equal(selector._postFilter, 3);
  assert.equal(selector._limitTargetNum, 1); assert.equal(selector._maxNum, 1);
  assert.equal(selector._excludeOwner, 0); assert.equal(selector._ignoreHealFree, 0);
  const heal = type(actions('amiya3_instant_heal', 'ON_BUFF_START'), 'FixedValueHeal')[0];
  assert.equal(heal._healValueKey, 'value'); assert.equal(heal._ignoreHealFree, false);
});

test('S1 area healing has its own ATTACK-family calculation callback and unlimited allied selector', () => {
  const a = actions('amiya3_s_1', 'ON_CALCULATE_DAMAGE');
  assert.equal(type(a, 'FilterAbilityFamily')[0]._familyGroupMask, 'ATTACK');
  const create = type(a, 'CreateBuffUseAbilitySelector')[0];
  assert.equal(create._abilityName, 'amiya3_skill1');
  assert.equal(create._buff.templateKey, 'amiya3_s_1[heal]');
  assert.equal(create._buff.lifeTimeType, 'IMMEDIATELY');
  const selector = component('1660124063962620841');
  assert.equal(selector._targetSide, 1); assert.equal(selector._limitTargetNum, 0);
  assert.equal(selector._ignoreHealFree, 0); assert.equal(selector._excludeOwner, 0);
  assert.equal(selector._ignoreTargetFree, 1);
  const heal = type(actions('amiya3_s_1[heal]', 'ON_BUFF_START'), 'AdvancedApplyHeal')[0];
  assert.equal(heal._sourceType, 'BUFF_SOURCE'); assert.equal(heal._targetType, 'BUFF_OWNER');
  assert.equal(heal._useDynamicVar, false);
  const native = JSON.parse(e.originalTemplates['amiya3_s_1[heal]'].eventToActions._items[0].value.SerializedState);
  assert.equal(native[0]._healScaleKey, 'heal_scale');
  assert.equal(e.templates.heal_scale, undefined, 'a blackboard key is not a template dependency');
  assert.equal(component('2447008719906202537')._rangeIdUsageType, 7);
  assert.equal(e.tables.ranges['x-1'].grids.length, 13);
  assert.deepEqual(e.tables.character.phases.map(p => p.rangeId), ['3-1', '3-3', '3-3']);
});

test('S1 and S2 retain different begin dispatchers and no-target manual activation', () => {
  const one = component('2447008719906202537'), two = component('3915156506434781326');
  assert.equal(one._playSkillBeginAnim, 1); assert.equal(one._beginAnim, 'Skill_1_Begin');
  assert.equal(two._playSkillBeginAnim, 0); assert.equal(two._beginAnim, '');
  for (const s of [one, two]) { assert.equal(s._useTriggerInManualMode, 0); assert.equal(s._allowNoTarget, 1); }
  assert.equal(one._maxTriggerTime, -1); assert.equal(one._limitGlobalTriggerTime, 0);
  assert.equal(two._maxTriggerTime, 0); assert.equal(two._limitGlobalTriggerTime, 1);
  const sequence = component('-5224572289971863410');
  assert.deepEqual(sequence._abilities.map(a => a.m_PathID), ['3746498373130109070', '-3936013573671436146']);
  assert.equal(sequence._alwaysNext, 1); assert.deepEqual(sequence._interruptableSubAbilityIndice, [1]);
});

test('S2 all-enemy burst and subsequent two-target True attacks stay separate', () => {
  const burst = component('-3936013573671436146'), normal = component('8831638944291423731');
  assert.equal(burst._damageType, 2); assert.equal(burst._animKey, 'Skill_2_Begin');
  assert.equal(burst._atkScaleKey, 'atk_scale'); assert.equal(burst._timeMode, 1);
  assert.equal(component('-5373416544054886258')._limitTargetNum, 0);
  assert.equal(normal._damageType, 3); assert.equal(normal._projectileKey, undefined);
  assert.equal(component('-5523266684462955021')._maxNum, 2);
  assert.equal(component('-5523266684462955021')._limitTargetNum, 1);
  for (const a of [burst, normal]) { assert.equal(a._maxAnimScale, 1); assert.equal(a._waitForAttackEvent, 1); }
  assert.deepEqual(component('-7707414205317184013')._replaceAnimPairs,
    [{ fromAnimKey: 'Idle', toAnimKey: 'Skill_2_Loop' }, { fromAnimKey: 'Attack', toAnimKey: 'Skill_2_Attack' }]);
});

test('S2 debuffs preserve selected timing and distinct attack-speed/movement formulas', () => {
  const b = component('-3936013573671436146')._activeBuffs[0];
  assert.equal(b.buffKey, 'amiya3_s_2[debuff]'); assert.equal(b.stripBlackboardParamsWithBuffKey, 1);
  assert.equal(b.lifeTimeType, 1); assert.equal(b.isDamageMissable, 0);
  assert.deepEqual(b.attributes.attributeModifiers.map(a => [a.attributeType, a.formulaItem, a.loadFromBlackboard]),
    [[7,0,1], [6,1,1]]);
});

test('S2 capped ATK bonus follows burst selection and is removed on skill finish', () => {
  const holder = component('-7983620827201683314');
  assert.equal(holder._runActionOnEvent, 2); assert.equal(holder._loadMaxTargetFromBlackboard, 1);
  assert.equal(holder._buffs[0].templateKey, 'amiya3_s_2[atk_holder]');
  const create = type(actions('amiya3_s_2[atk_holder]', 'ON_BUFF_START'), 'CreateBuffUseAbilitySelector')[0];
  assert.equal(create._abilityName, 'S2Attack'); assert.equal(create._buff.templateKey, 'amiya3_s_2[atk_trigger]');
  const atk = type(actions('amiya3_s_2[atk_trigger]', 'ON_BUFF_START'), 'CreateBuff')[0];
  assert.equal(atk._buffOwner, 'BUFF_SOURCE'); assert.equal(atk._buff.overrideType, 'STACK');
  assert.equal(atk._buff.lifeTimeType, 'INFINITY'); assert.equal(atk._buff.buffKey, 'amiya3_s_2[atk]');
  assert.equal(atk._buff.attributes.attributeModifiers[0].formulaItem, 'MULTIPLIER');
  const finish = actions('amiya3_s_2[passive]', 'ON_SKILL_FINISH');
  assert.equal(finish[0]._modeIndex, 0); assert.equal(finish[0]._restartFSM, true);
  assert.equal(finish[1]._buffKey, 'amiya3_s_2[atk]');
  assert.equal(finish[1]._checkBuffSource, false);
  assert.equal(actions('amiya3_s_2[atk_trigger]', 'ON_TARGET_KILLED'), undefined);
});

test('talent retains promotion-specific owned HP aura and shared active-skill regeneration holder', () => {
  assert.deepEqual(e.tables.character.talents[0].candidates.map(c => [c.unlockCondition.phase, bb(c.blackboard)]), [
    ['PHASE_1', { max_hp: .05, hp_recovery_per_sec_by_max_hp_ratio: .015 }],
    ['PHASE_2', { max_hp: .08, hp_recovery_per_sec_by_max_hp_ratio: .025 }],
  ]);
  const hp = component('9076201804656543219'), one = component('4996852043280287219'), two = component('5341537068325864947');
  for (const a of [hp, one, two]) {
    assert.equal(a._removeBuffWhenAbilityDetached, 1);
    const validator = component(a._targetValidator.m_PathID)._targetOptions;
    assert.equal(validator.targetSide, 1); assert.equal(validator.professionMask, 0);
    assert.equal(validator.ignoreTargetFree, 1); assert.equal(validator.ignoreHealFree, 0);
    assert.equal(a._buffs[0].maxStackCnt, 1);
  }
  assert.equal(hp._buffs[0].buffKey, 'amiya3_t_1');
  assert.equal(hp._buffs[0].attributes.attributeModifiers[0].attributeType, 0);
  assert.equal(one._buffs[0].buffKey, 'amiya3_t_1[s]'); assert.equal(two._buffs[0].buffKey, one._buffs[0].buffKey);
  assert.equal(one._buffs[0].attributes.attributeModifiers[0].attributeType, 19);
});

test('original facing chains preserve every exact attack payload and distinct S1 Begin duration', () => {
  for (const face of ['Front', 'Back']) {
    const m = e.models[ID][face], b = e.officialSkeletonBindings[ID][face];
    assert.equal(m.sha256, b.sha256); assert.equal(m.bytes, b.byteLength);
    assert.ok(e.chararts[ID].some(r => r.pathId === b.faceSwitcherPathId));
    for (const [key, time] of [['Attack', .76666665], ['Skill_1_Attack', .43333334],
      ['Skill_2_Attack', .63333333], ['Skill_2_Begin', 1.10000002]]) {
      assert.equal(m.eventPayloads[key].length, 1); assert.equal(m.eventPayloads[key][0].name, 'OnAttack');
      near(m.eventPayloads[key][0].time, time);
    }
    assert.equal(m.durations.Skill_2_Begin, 1.833); assert.equal(m.durations.Skill_2_End, .167);
    assert.equal(m.eventPayloads.Skill_1_Begin, undefined);
  }
  assert.equal(e.models[ID].Front.durations.Skill_1_Begin, .167);
  assert.equal(e.models[ID].Back.durations.Skill_1_Begin, .233);
});
