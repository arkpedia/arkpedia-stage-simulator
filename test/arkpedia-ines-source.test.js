// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-ines-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID = 'char_4087_ines';
const rows = Object.values({ ...e.characters, ...e.skills, ...e.projectiles })
  .flatMap(rs => rs.flatMap(r => r.components));
const component = id => rows.find(c => c.pathId === id).data;
const bb = values => Object.fromEntries(values.map(v => [v.key, v.value]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('Ines full source kit stays separate from playable coverage until its runtime is implemented', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(REGULAR_OPERATORS[ID], undefined); assert.equal(data.operators[ID], undefined);
  assert.equal(rows.length, 143); assert.equal(e.source.bundles.length, 5);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.equal(Object.keys(e.templates).length, 9);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.deepEqual(e.buffDatabase, {});
  for (const key of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[key], false);
});

test('all thirty ranks retain S1 attack recovery, S2 manual activation and S3 passive deployment', () => {
  const [one, two, three] = [1, 2, 3].map(n => e.tables.skills[`skchr_ines_${n}`].levels);
  for (const levels of [one, two, three]) assert.equal(levels.length, 10);
  for (const s of one) {
    assert.equal(s.skillType, 'AUTO'); assert.equal(s.spData.spType, 'INCREASE_WHEN_ATTACK');
    assert.equal(bb(s.blackboard).bleed_duration, 3); assert.equal(bb(s.blackboard).cost, 2);
  }
  assert.deepEqual(one.map(s => s.spData.initSp), [0,0,0,0,0,0,0,1,2,3]);
  for (const s of two) { assert.equal(s.skillType, 'MANUAL'); assert.equal(s.duration, 12); }
  near(bb(two.at(-1).blackboard).atk, 1.1);
  assert.equal(bb(two.at(-1).blackboard)['attack@steal_atk_speed_max'], 70);
  for (const s of three) { assert.equal(s.skillType, 'PASSIVE'); assert.equal(s.spData.spCost, 0); }
  assert.deepEqual(three.map(s => s.duration), [9,9,9,11,11,11,13,14,15,16]);
  const selected = bb(three.at(-1).blackboard);
  assert.equal(selected.max_target, 6); near(selected.projectile_range, 1.4);
});

test('ATK and ASPD theft preserve different invalid-victim cleanup contracts', () => {
  const atk = component('-1282257970960793723'), aspd = component('-5655628780310888571');
  assert.equal(atk._attributeType, 1); assert.equal(aspd._attributeType, 7);
  assert.equal(atk._formulaType, 2); assert.equal(aspd._formulaType, 2);
  assert.equal(atk._finishTargetBuffWhenInvalid, 1); assert.equal(aspd._finishTargetBuffWhenInvalid, 1);
  assert.equal(atk._finishOwnerBuffWhenTargetInvalid, 1); assert.equal(aspd._finishOwnerBuffWhenTargetInvalid, 0);
  const actions = e.templates.ines_t_1.eventToActions.ON_BEFORE_TARGET_APPLY_MODIFIER;
  const check = actions.find(a => /CheckContainsBuff/.test(a.$type));
  assert.deepEqual(check._buffKeys, ['ines_t_1[enemy][mark]']); assert.equal(check._checkBuffSource, true);
  const bind = actions.find(a => a._buff?.buffKey === 'ines_t_1[enemy][unmove]');
  assert.deepEqual(bind._buff.attributes.abnormalFlags, ['UNMOVABLE']);
  assert.equal(bind._buff.independentCharacterSource, true);
});

test('S1 snapshots Arts DOT and grants DP on buff start, separate from ordinary Physical damage', () => {
  const buff = component('-3802985892624843140')._activeBuffs[0];
  assert.equal(buff.templateKey, 'ines_s_1[damage]'); assert.equal(buff.durationKey, 'bleed_duration');
  near(buff.firstTriggerInterval, .9); near(buff.triggerInterval, 1);
  assert.equal(buff.waitFirstTriggerInterval, 1); assert.equal(buff.independentCharacterSource, 0);
  const actions = e.templates['ines_s_1[damage]'].eventToActions;
  assert.match(actions.ON_BUFF_START[0].$type, /ModifyCost/);
  assert.match(actions.ON_BUFF_START[1].$type, /AssignAttributeToBB/);
  assert.equal(actions.ON_BUFF_START[1]._scaleVar, 'bleed_atk_scale');
  assert.equal(actions.ON_BUFF_TRIGGER[0]._damageType, 'MAGICAL');
  assert.equal(actions.ON_BUFF_TRIGGER[0]._damageKey, 'bleed_value');
  assert.equal(actions.ON_BUFF_TRIGGER[0]._ignoreForSp, true);
});

test('S2 keeps invisible mode replacement and separate before-damage theft/output-DP phases', () => {
  const buff = component('-1074543269009645259')._buffs[0];
  assert.deepEqual(buff.attributes.abnormalFlags, [9]); assert.equal(bb(buff.blackboard).mode, 1);
  const actions = e.templates.ines_s_2.eventToActions;
  assert.equal(actions.ON_BEFORE_TARGET_APPLY_MODIFIER.at(-1)._abilityName, 'ines_steal_attack_speed');
  assert.match(actions.ON_OUTPUT_DAMAGE[0].$type, /ModifyCost/);
  assert.equal(actions.ON_BUFF_START[0]._restartFSM, true);
  assert.equal(actions.ON_BUFF_FINISH[0]._restoreDefault, true);
  assert.deepEqual(component('-7842823755977916539')._replaceAnimPairs.map(p => p.toAnimKey),
    ['Skill_2_Attack', 'Skill_2_Idle', 'Skill_2_Combat']);
});

test('Shadow Sentry is an infinite fixed-range projectile, with exit and stop cleanup', () => {
  const sentry = component('-561048560923893340');
  assert.equal(sentry._lifeTimeType, 2); assert.equal(sentry._stopWhenSourceInvalid, 0);
  assert.equal(sentry._actionController._detachBuffsWhenTargetLeave, 1);
  assert.equal(sentry._actionController._detachAllBuffsWhenStopped, 1);
  assert.equal(component('-6980898084118453852')._rangeId, '2-2');
  assert.equal(component('-6980898084118453852')._extendable, 0);
  assert.equal(component('-6594174309048376924')._immediatelyReach, 1);
  assert.equal(component('-6594174309048376924')._useSourceDirection, 1);
  const collider = component('8851723271416914340');
  assert.equal(collider._targetOptions.targetMotion, 3); assert.equal(collider._targetOptions.ignoreTargetFree, 1);
  assert.equal(collider._ignoreCamouflage, 1);
});

test('S3 first deployment gates replacement/withdrawal separately from later retrieval', () => {
  assert.deepEqual(component('1553822114842476095')._buffKeys, ['ines_s_3[deck]']);
  assert.equal(component('1889652980367359551')._animKey, 'Start_Skill');
  const actions = e.templates['ines_s_3[summon]'].eventToActions;
  assert.match(actions.ON_BUFF_START[0].$type, /FinishManagedProjectiles/);
  assert.equal(actions.ON_BUFF_START[1]._abilityName, 'ines_emit_guard');
  assert.match(actions.ON_OWNER_LOCATE[0].$type, /Withdraw/);
  assert.equal(actions.ON_OWNER_LOCATE[0]._switchToDeadState, false);
  assert.equal(component('-7379018104740118651')._runtimeCost, 0);
  const card = component('5012320168815296389')._deckBuffs[0].buff;
  assert.equal(bb(card.blackboard).respawn_time, 0); assert.equal(bb(card.blackboard).not_add_respawn_cost_cnt, 1);
  near(component('-523640202411835841')._buffs[0].triggerInterval, .03);
  const retrieve = e.templates.ines_s_3.eventToActions.ON_BUFF_TRIGGER;
  assert.match(retrieve[0].$type, /EmitProjectileFromManagedProjectiles/);
  assert.match(retrieve[1].$type, /FinishManagedProjectiles/);
});

test('retrieval keeps swept radius, speed, hit cap and Physical receipt rather than an instant centered explosion', () => {
  const mover = component('-3877886251781951896'); near(mover._speed, 10);
  near(component('474562155916062312').m_Radius, 1);
  assert.equal(component('7005739620414221928')._scaleble, 1);
  const projectile = component('6941692683646758504');
  assert.equal(projectile._maxHitNum, 6); assert.equal(projectile._getMaxHitNumFromBB, 1);
  assert.equal(projectile._canHitSameTargetMultipleTimes, 0); assert.equal(projectile._stopAfterMaxHit, 0);
  const collider = component('-8488566880314233240');
  assert.equal(collider._onlyCheckHitWhenReachTarget, 0); assert.equal(collider._onlyCheckHitWhenStop, 0);
  assert.equal(collider._targetOptions.targetMotion, 3);
  const [damage] = JSON.parse(component('952120871013936744')._actions.SerializedState);
  assert.equal(damage._damageType, 'PHYSICAL'); assert.equal(damage._atkScaleVar, 'atk_scale');
});

test('both native facing chains retain ranged, blocked and deployment event distinctions', () => {
  assert.deepEqual(Object.keys(e.projectiles).sort(), ['projectile_chr_ines_guard', 'projectile_chr_ines_guard_back',
    'projectile_chr_ines_normal', 'projectile_chr_ines_s1', 'projectile_chr_ines_s2', 'projectile_chr_ines_s3'].sort());
  for (const face of ['Front', 'Back']) {
    const model = e.models[ID][face], binding = e.officialSkeletonBindings[ID][face];
    assert.equal(binding.sha256, model.sha256); assert.equal(binding.byteLength, model.bytes);
    assert.deepEqual(model.hits.Attack, [.467]); assert.deepEqual(model.hits.Combat, [.333]);
    assert.deepEqual(model.hits.Skill_2_Attack, [.467]); assert.deepEqual(model.hits.Skill_2_Combat, [.467]);
    assert.deepEqual(model.hits.Start, [.2]); assert.deepEqual(model.hits.Start_Skill, [.167]);
    near(model.durations.Skill_2_Begin, .167); near(model.durations.Skill_2_End, .667);
  }
  assert.equal(e.models[ID].Back.durations.Die, undefined);
});
