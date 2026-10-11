// SPDX-License-Identifier: GPL-3.0-or-later
// Source contracts only: no regular-stage enablement or compiled callback claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-exusiai-covenant-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';

const ID = 'char_1041_angel2', TOKEN = 'token_10056_angel2_target';
const components = ['characters', 'tokens', 'skills', 'projectiles'].flatMap(group =>
  Object.values(e[group]).flat().flatMap(row => row.components));
const comp = id => {
  const c = components.find(c => c.pathId === id);
  assert.ok(c, id);
  return c.data;
};
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const nodes = v => !v || typeof v !== 'object' ? [] :
  [...(v.$type ? [v] : []), ...Object.values(v).flatMap(nodes)];
const type = v => v.$type.split('+').at(-1).split(',')[0];
const bb = rows => Object.fromEntries(rows.map(r => [r.key, r.valueStr ?? r.value]));

test('Exusiai source remains held until attacks, three skills, talents and coordinate lifecycle are verified', () => {
  assert.deepEqual(e.enabledOperators, []);
  assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(REGULAR_OPERATORS[ID], undefined);
  assert.equal(data.operators[ID], undefined);
  assert.equal(e.frameParity, false);
  assert.equal(e.moduleSupport, false);
  assert.equal(e.nativeParticleSupport, false);
  assert.equal(e.source.bundles.length, 6);
  assert.equal(components.length, 287);
  assert.equal(new Set(components.map(c => c.pathId)).size, 287);
  assert.equal(Object.keys(e.projectiles).length, 7);
  assert.equal(Object.keys(e.templates).length, 20);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.templates), Object.keys(e.originalTemplates));
});

test('each original facing retains five distinct S3 hit events and separate delivery-cannon animation', () => {
  for (const face of ['Front', 'Back']) {
    const m = e.models[ID][face];
    const hits = m.eventPayloads.Skill_3_Loop.filter(v => v.name === 'OnAttack');
    assert.equal(hits.length, 5);
    hits.forEach((v, i) => near(v.time, (5 + i) / 30));
    near(m.eventPayloads.Skill_3_Skill.find(v => v.name === 'OnAttack').time, 2 / 30);
    near(m.eventPayloads.Attack_Loop.find(v => v.name === 'OnAttack').time, 8 / 30);
    const binding = e.officialSkeletonBindings[ID][face];
    assert.equal(binding.sha256, m.sha256);
    assert.equal(binding.byteLength, m.bytes);
    for (const key of ['animatorPathId', 'skeletonAnimationPathId', 'skeletonDataAssetPathId', 'textAssetPathId'])
      assert.match(binding[key], /^-?\d+$/);
  }
});

test('Exusiai has her own one-percent nonlethal Geek drain rather than another Geek operator percentage', () => {
  assert.equal(bb(e.tables.character.trait.candidates[0].blackboard).hp_ratio, .01);
  const buff = comp('-7586576539634244369')._buffs[0];
  assert.equal(buff.triggerInterval, 1);
  assert.equal(buff.waitFirstTriggerInterval, 1);
  const action = e.templates[buff.templateKey].eventToActions.ON_BUFF_TRIGGER[0];
  assert.equal(type(action), 'DamageViaMaxHpRatio');
  assert.equal(action._isUndeadable, true);
  assert.equal(action._ignoreForSp, true);
  assert.equal(action._skipModifierEvent, true);
});

test('S3 consumes five ammunition per attack command, with its own projectile and event gate', () => {
  const a = comp('7303740197574534383');
  assert.equal(a._animKey, 'Skill_3_Loop');
  assert.equal(a._waitForAttackEvent, 1);
  assert.equal(a._projectileKey, 'projectile_chr_angel2_s3');
  assert.equal(a._additionalProjectile, 'projectile_chr_angel2_s3');
  assert.equal(comp('-3515024303529728785')._expendPerTrigger, 5);
  assert.equal(comp('-1444526159829080849')._expendPerTrigger, 5);
  near(comp('4112073188336795232').m_Radius, 1.8);
  assert.equal(comp('-4694220270147994016')._onlyCheckHitWhenStop, 1);
});

test('S2 does not borrow its OnAttack animation event as an unproven projectile-birth clock', () => {
  for (const id of ['3670591584193012975', '-5719382545127709457']) {
    const a = comp(id);
    assert.equal(a._waitForAttackEvent, 0);
    assert.equal(a._projectileKey, 'projectile_chr_angel2_s2');
    assert.equal(a._useCachedAtkOnly, 1);
  }
  assert.equal(comp('3215183870520921349')._speed, 30);
});

test('S1 manually ending snapshots remaining ammunition into the separate burst ability', () => {
  const actions = e.templates['angel2_s_1[ammo_assign]'].eventToActions.ON_BUFF_START;
  assert.equal(type(actions[0]), 'AssignAmmoSkillRemainingCountToBB');
  assert.equal(actions[0]._blackboardKey, 'times');
  assert.equal(type(actions[1]), 'ModifyAbilityBlackboard');
  assert.equal(actions[1]._abilityName, 'S1_Burst');
  assert.equal(actions[1]._blackboardKeys, 'times');
  assert.equal(comp('5571565256772543727')._animKey, 'Skill_1_Close');
  assert.equal(comp('5571565256772543727')._additionalProjectile, 'projectile_chr_angel2_s1_close');
});

test('S2 barrier derives capacity from its source Max HP and has decaying dynamic capacity', () => {
  const events = e.templates['angel2_s_2[shield]'].eventToActions;
  const capacity = events.ON_BUFF_START[0];
  assert.equal(capacity._targetType, 'BUFF_SOURCE');
  assert.equal(capacity._attributeType, 'MAX_HP');
  assert.equal(capacity._scaleVar, 'shield_max_hp_ratio');
  assert.equal(events.ON_BUFF_START[2]._dividedParamKey, 'shield_max_duration');
  assert.equal(events.ON_BUFF_TRIGGER[0]._minusParamKey, 'shield_reduce_each_sec');
  assert.equal(events.ON_TAKE_DAMAGE[0]._useDynamicVar, true);
  const cleaner = e.templates['angel2_s_2[cleaner]'].eventToActions.ON_BUFF_START[0];
  assert.equal(cleaner._checkBuffSource, true);
  assert.equal(cleaner._buffKey, 'angel2_s_2[select_target]');
});

test('Delivery Coordinates retain a separate native token, all three rank sets and placement limits', () => {
  assert.equal(e.tables.character.skills[2].overrideTokenKey, TOKEN);
  assert.deepEqual(Object.keys(e.tokens), [TOKEN]);
  const token = comp('5469880532721077243');
  assert.equal(token._occupiedRemainingCharacterCnt, 0);
  assert.equal(token._buildCondition.buildableType, 1);
  assert.equal(token._buildCondition.limitByHostAttackRange, 1);
  for (let n = 1; n <= 3; n++) {
    const id = `sktok_angel2_target_${n}`;
    assert.ok(e.skills[id]);
    assert.equal(e.tables.tokenSkills[id].levels.length, 10);
    for (const rank of e.tables.tokenSkills[id].levels) {
      assert.equal(rank.skillType, 'PASSIVE');
      assert.equal(rank.prefabId, id);
    }
  }
  const sp = e.templates['angel2_s_3[sp]'].eventToActions.ON_BUFF_START[0];
  assert.equal(type(sp), 'ModifySp');
  assert.equal(sp._spString, 'sp');
  assert.equal(sp._forceFlag, false);
});

test('ammo talent heals once per consumed count and independently rolls bombardment using the ally range', () => {
  const self = e.templates['angel2_t_1[self]'].eventToActions.ON_BUFF_START[0];
  assert.equal(type(self), 'Loop');
  assert.equal(self._loopCntKey, 'times');
  assert.equal(type(self._loopBody[0]), 'HealViaMaxHpRatio');
  const target = nodes(e.templates['angel2_t_1[target]']);
  const range = target.find(v => type(v) === 'CreateBuffInRange');
  assert.equal(range._useTargetRangeInsteadOfSource, true);
  assert.equal(range._targetOptions.targetMotion, 'ALL');
  assert.equal(target.find(v => type(v) === 'Dice')._probKey, 'prob');
  near(comp('-7222720199102148552').m_Radius, 1.3);
});

test('native ASPD stealing preserves separate target-invalid and owner-invalid cleanup flags', () => {
  for (const id of ['-848266832636746513', '8008112031636710639']) {
    const steal = comp(id);
    assert.equal(steal._attributeType, 7);
    assert.equal(steal._formulaType, 2);
    assert.equal(steal._stealOnceBBKey, 'steal');
    assert.equal(steal._stealMaxBBKey, 'steal_max');
    assert.equal(steal._finishTargetBuffWhenInvalid, 1);
    assert.equal(steal._finishOwnerBuffWhenTargetInvalid, 0);
  }
});

test('Covenant aura explicitly checks ammo duration and Laterano before applying its derived ATK buff', () => {
  const a = e.templates.angel2_t_2.eventToActions.ON_BUFF_START;
  assert.equal(type(a[0]), 'CheckTargetSkillDurationType');
  assert.deepEqual(a[0]._checkTypes, ['AMMO']);
  assert.equal(a[1]._conditionNode._groupTag, 'laterano');
  assert.equal(a[1]._succeedNodes[0]._multiplyParamKey, 'mult');
  assert.equal(a[2]._isDerivedBuff, true);
  assert.equal(a[2]._finishDerivedBuffIfParentFinish, true);
});

test('all thirty owner ranks retain ammunition, SP and recovery rather than converted durations', () => {
  for (let n = 1; n <= 3; n++) for (const rank of e.tables.skills[`skchr_angel2_${n}`].levels) {
    assert.equal(rank.spData.spType, 'INCREASE_WITH_TIME');
    assert.equal(rank.skillType, n === 1 ? 'AUTO' : 'MANUAL');
    assert.equal(rank.durationType, 'AMMO');
    assert.equal(rank.duration, -1);
    const b = bb(rank.blackboard);
    assert.equal(b['attack@trigger_time'], n === 1 ? 8 : n === 2 ? 35 : 50);
    if (n === 2) {
      assert.equal(b.addtional_ammo_each, 5);
      assert.equal(b.shield_max_duration, 30);
      assert.equal(b.max_target, 1);
    }
    if (n === 3) assert.equal(b['attack@sp'], 6);
  }
});
