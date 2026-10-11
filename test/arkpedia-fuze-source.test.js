// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-fuze-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';

const ID = 'char_4126_fuze';
const rows = Object.values({ ...e.characters, ...e.skills, ...e.projectiles })
  .flatMap(rs => rs.flatMap(r => r.components));
const component = id => rows.find(c => c.pathId === id).data;
const bb = values => Object.fromEntries(values.map(v => [v.key, v.value]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('Fuze complete source audit retains both ordinary skills with separate reviewed runtime contracts', () => {
  assert.deepEqual(e.enabledOperators, [ID]);
  assert.deepEqual(e.heldOperators, []);
  assert.equal(e.runtimeMapping[ID], "fuze");
  assert.equal(e.runtimeContracts.length, 6);
  assert.deepEqual(REGULAR_OPERATORS[ID].skillIds, ["skchr_fuze_1", "skchr_fuze_2"]);
  assert.equal(data.operators[ID].skills.length, 2);
  assert.equal(rows.length, 56);
  assert.equal(e.source.bundles.length, 5);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.templates), ['fuze_t_1', 'switch_mode_restart_fsm']);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.deepEqual(Object.keys(e.buffDatabase), []);
  assert.equal(e.frameParity, false);
  assert.equal(e.moduleSupport, false);
  assert.equal(e.nativeParticleSupport, false);
  assert.ok(e.historicalHoldReasons.some(r => /five grenades to one center/.test(r)));
  assert.ok(e.historicalHoldReasons.some(r => /only at stop/.test(r)));
});

test('all 20 source ranks preserve manual ammo and bounded Cluster Charge uses', () => {
  const one = e.tables.skills.skchr_fuze_1.levels;
  const two = e.tables.skills.skchr_fuze_2.levels;
  assert.equal(one.length, 10);
  assert.equal(two.length, 10);
  for (const s of [...one, ...two]) {
    assert.equal(s.skillType, 'MANUAL');
    assert.equal(s.spData.spType, 'INCREASE_WITH_TIME');
  }
  for (const s of one) {
    assert.equal(s.durationType, 'AMMO');
    assert.equal(bb(s.blackboard)['attack@trigger_time'], 100);
    assert.equal(bb(s.blackboard).ability_range_forward_extend, 1);
  }
  assert.deepEqual(one.map(s => s.spData.spCost), [55,54,53,52,51,50,49,48,47,45]);
  near(bb(one.at(-1).blackboard).atk, .3);
  near(bb(one.at(-1).blackboard).attack_speed, 90);
  assert.deepEqual(two.map(s => bb(s.blackboard).atk_scale), [3.8,3.9,4,4.1,4.2,4.3,4.4,4.5,4.6,4.8]);
  for (const s of two) {
    assert.equal(s.durationType, 'NONE');
    assert.equal(bb(s.blackboard).skill_max_trigger_time, 3);
    assert.match(s.description, /high-ground tile.*passable tile/s);
  }
});

test('ordinary and S1 selectors preserve the current block-count victim cap and range extension', () => {
  for (const id of ['-7492693438330940593', '-466354574652779697']) {
    const selector = component(id);
    assert.equal(selector._limitedMaxTargetNumToBlockedCnt, 1);
    assert.equal(selector._allowZeroBlockCntLimit, 0);
    assert.equal(selector._limitTargetNum, 0);
    assert.equal(selector._postFilter, 4);
  }
  assert.equal(component('-3996746674723204273')._extendable, 0);
  assert.equal(component('-6611869315128994993')._extendable, 1);
  for (const id of ['-824783117765553329', '-298649812123823281']) {
    const attack = component(id);
    assert.equal(attack._waitForAttackEvent, 1);
    assert.equal(attack._selectTargetTiming, 0);
    assert.equal(attack._damageType, 1);
    assert.equal(attack._maxAnimScale, 1);
  }
});

test('S1 preserves ammo expenditure, manual discard and independent ATK/ASPD/range modifiers', () => {
  const count = component('3538446864662614863');
  assert.equal(count._countEvent, 4);
  assert.equal(count._expendPerTrigger, 1);
  assert.equal(count._resetImmediatelyWhenProgressEnd, 0);
  const skill = component('5710686337732537997');
  assert.equal(skill._fetchFromMainAttack, 1);
  assert.equal(skill._modeIndex, 1);
  assert.equal(skill._finishSkillWithProgress, 1);
  assert.equal(skill._canDiscardRemainingCount, 1);
  assert.equal(skill._earlySkillFinishAtAttackFinished, 0);
  assert.equal(skill._showSpAsBulletMode, 1);
  assert.equal(skill._allowSpRecoveryWhenAffecting, 0);
  const buff = component('1575995095422824077')._buffs[0];
  assert.equal(buff.templateKey, 'switch_mode_restart_fsm');
  assert.equal(bb(buff.blackboard).mode, 1);
  assert.deepEqual(buff.attributes.attributeModifiers.map(m => [m.attributeType, m.formulaItem]),
    [[1,1], [7,0], [15,0]]);
  for (const m of buff.attributes.attributeModifiers) assert.equal(m.loadFromBlackboard, 1);
});

test('Ballistic Shield is a ranged Physical dice block, not percentage damage reduction', () => {
  const actions = e.templates.fuze_t_1.eventToActions.ON_TAKE_DAMAGE;
  assert.equal(actions.length, 3);
  assert.match(actions[0].$type, /Nodes\+IfTarget,/);
  assert.equal(actions[0]._targetType, 'MODIFIER_SOURCE');
  assert.equal(actions[0]._checkApplyWay, true);
  assert.equal(actions[0]._applyWay, 'RANGED');
  assert.match(actions[1].$type, /Nodes\+Dice,/);
  assert.equal(actions[1]._probKey, 'prob');
  assert.match(actions[2].$type, /Nodes\+BlockDamage,/);
  assert.equal(actions[2]._damageMask, 'PHYSICAL');
  assert.equal(actions[2]._useFixedValue, false);
  const talent = component('5986297597097694031')._buffs[0];
  assert.equal(talent.isSilenceable, 0);
  assert.deepEqual(e.tables.character.talents[0].candidates.map(c => bb(c.blackboard).prob),
    [.17, .2, .27, .3]);
});

test('S2 requires its opaque native manual trigger and has three uses per deployment', () => {
  const skill = component('-2039949020313241653');
  assert.equal(skill._maxTriggerTime, 3);
  assert.equal(skill._useTriggerInManualMode, 1);
  assert.equal(skill._canSwitchDuringBorn, 0);
  const trigger = component(skill._trigger.m_PathID);
  assert.equal(trigger.m_Script.m_PathID, '7692650582132910872');
  assert.deepEqual(Object.keys(trigger).filter(k => !k.startsWith('m_')), []);
  assert.ok(e.historicalHoldReasons.some(r => /no serialized tile geometry/.test(r)));
});

test('five-emission fields and offsets remain separate from the single animation event', () => {
  const ability = component('1058628261399541707');
  assert.equal(ability._projectileKey, 'projectile_chr_fuze_s2');
  assert.equal(ability._additionalTimes, 4);
  near(ability._triggerDelta, .5);
  assert.equal(ability._waitAttackEventForAllAttacks, 0);
  near(ability._offset, .25);
  near(ability._beginOffset, 0);
  assert.equal(ability._useCachedAtkOnly, 0);
  for (const face of ['Front', 'Back']) {
    assert.deepEqual(e.models[ID][face].eventPayloads.Skill_2.filter(event => event.name === 'OnAttack'),
      [{ time: 1.2000000476837158, name: 'OnAttack', int: 0, float: 0, string: '' }]);
    near(e.models[ID][face].durations.Skill_2, 3.333);
  }
  assert.deepEqual(e.models[ID].Front.eventPayloads.Skill_Down_2.filter(event => event.name === 'OnAttack'),
    e.models[ID].Front.eventPayloads.Skill_2.filter(event => event.name === 'OnAttack'));
});

test('grenades preserve delayed stop-only ground collision and original radius', () => {
  assert.deepEqual(Object.keys(e.projectiles), ['projectile_chr_fuze_s2']);
  const mover = component('-1799061712939353497');
  near(mover._speed, 8);
  near(mover._delayAfterReached, 1.8);
  assert.equal(mover._clearTraceTargetWhenReached, 1);
  const collider = component('-754226651951105433');
  assert.equal(collider._targetOptions.targetMotion, 1);
  assert.equal(collider._onlyCheckHitWhenReachTarget, 0);
  assert.equal(collider._onlyCheckHitWhenStop, 1);
  assert.equal(collider._ignoreCamouflage, 1);
  assert.equal(collider._goThroughWall, 1);
  near(component('7514207246336096871').m_Radius, 1.2);
  const controller = component('6581086060126173799');
  assert.equal(controller._hitNumType, 2);
  assert.equal(controller._maxHitNum, 1);
  assert.equal(controller._stopAfterMaxHit, 1);
  assert.equal(controller._stopWhenSourceInvalid, 0);
  assert.equal(controller._canHitSameTargetMultipleTimes, 0);
});

test('original facing chains and clips are retained without inventing Down or End variants', () => {
  for (const face of ['Front', 'Back']) {
    const model = e.models[ID][face];
    const binding = e.officialSkeletonBindings[ID][face];
    assert.equal(binding.sha256, model.sha256);
    assert.equal(binding.byteLength, model.bytes);
    near(model.durations.Skill_1_Begin, .233);
    assert.deepEqual(model.hits.Attack, [.2]);
    assert.deepEqual(model.hits.Skill_1_Loop, [.2]);
  }
  near(e.models[ID].Front.durations.Skill_1_End, 1.367);
  near(e.models[ID].Back.durations.Skill_1_End, 1.267);
  assert.equal(e.models[ID].Back.durations.Skill_Down_2, undefined);
  assert.equal(e.models[ID].Back.durations.Die, undefined);
  assert.match(e.primaryCalculator.limitations, /cannot establish native Fuze offset-axis/);
  assert.ok(e.primaryCalculator.excerpt.startsWith('class Fuze(Operator):'));
});
