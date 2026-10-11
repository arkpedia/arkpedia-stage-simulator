// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-narant-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';

const ID = 'char_4138_narant';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const all = group => Object.values(e[group]).flatMap(rows => rows.flatMap(r => r.components));
const component = (group, id) => {
  const record = all(group).find(c => c.pathId === id);
  assert.ok(record, `missing native ${group} component ${id}`);
  return record.data;
};
const flat = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
const type = (node, name) => assert.ok(node.$type?.split(',')[0].endsWith(`+${name}`));

test('Narantuya public runtime review preserves complete source facts and explicit fidelity limits', () => {
  assert.deepEqual(e.enabledOperators, [ID]); assert.deepEqual(e.heldOperators, []);
  assert.equal(REGULAR_OPERATORS[ID].mechanic, 'narant'); assert.ok(data.operators[ID]);
  assert.equal(e.runtimeMapping[ID], 'narant'); assert.equal(e.runtimeContracts.length, 7);
  assert.match(e.historicalReviewStatus, /controllers await review/);
  assert.equal(e.recoveredFacts.length, 8); assert.equal(e.historicalHoldReasons.length, 3);
  assert.deepEqual(e.holdReasons, []);
  assert.equal(e.source.bundles.length, 5); assert.equal(Object.keys(e.templates).length, 7);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.equal(all('characters').length, 114); assert.equal(all('skills').length, 9);
  assert.equal(all('projectiles').length, 37);
  assert.equal(e.frameParity, false); assert.equal(e.moduleSupport, false); assert.equal(e.nativeParticleSupport, false);
});

test('all thirty selected ranks retain separate toggle, attack recovery and time recovery kits', () => {
  for (const [id, s] of Object.entries(e.tables.skills)) {
    assert.equal(s.levels.length, 10);
    for (const level of s.levels) {
      assert.equal(level.skillType, 'MANUAL');
      assert.equal(level.spData.maxChargeTime, 1);
      const bb = flat(level.blackboard);
      if (id.endsWith('_1')) {
        assert.equal(level.duration, 0); assert.equal(level.spData.spType, 'INCREASE_WITH_TIME');
        assert.equal(bb['attack@times'], 3); assert.equal(bb.ability_range_forward_extend, -1);
      } else if (id.endsWith('_2')) {
        assert.equal(level.duration, 30); assert.equal(level.spData.spType, 'INCREASE_WHEN_ATTACK');
        assert.ok(bb['attack@atk_scale'] > bb['attack@atk_scale_comeback']);
        assert.equal(bb['attack@move_ahead_time'], .5); assert.equal(bb['attack@projectile_range'], 1);
        assert.equal(bb['attack@sluggish'], 1);
      } else {
        assert.equal(level.duration, 20); assert.equal(level.spData.spType, 'INCREASE_WITH_TIME');
        assert.equal(bb.cnt, 3); assert.equal(bb['attack@aoe.max_target'], 3);
        assert.equal(bb.sluggish, 1); assert.ok(bb.atk_scale_aoe > 0);
      }
    }
  }
  const m3 = Object.values(e.tables.skills).map(s => s.levels.at(-1));
  assert.deepEqual(m3.map(l => [l.spData.initSp, l.spData.spCost]), [[0, 5], [8, 15], [20, 30]]);
});

test('S1 bounce selector retains repeat fallback and a distinct already-hit window', () => {
  const selector = component('projectiles', '-7068130161988167694');
  assert.equal(selector._onlyCheckHitWhenReachTarget, 1);
  assert.equal(selector._allowRepetitionIfNoTarget, 1); assert.equal(selector._fixAllowRepetitionIfNoTarget, 1);
  assert.equal(selector._bounceTimesAsDamageTimes, 0); assert.equal(selector._atkScaleRatePerBounce, 1);
  const body = component('projectiles', '-3242503519602567182');
  near(body._keepAlreadyHitTime, .7); assert.equal(body._canHitSameTargetMultipleTimes, 0);
  assert.equal(body._lifeTime, 25);
  const mover = component('projectiles', '-2371190145282762766');
  assert.equal(mover._speedAfterFirstReach, 6); assert.equal(mover._forceUseTargetMountPoint, 1);
  near(component('projectiles', '5033666104117467122').m_Radius, 1.7);
});

test('returning movers retain selected phases rather than generic instant attacks', () => {
  for (const id of ['6961919233470558115', '-2371190145282762766', '-544848678706100518']) {
    const m = component('projectiles', id);
    assert.equal(m._speed, 15); assert.equal(m._comeBack, 1); assert.equal(m._comeBackSpeedScale, .25);
    assert.equal(m._clearTraceTargetWhenReached, 1);
  }
  for (const id of ['-1505720997345727890', '7862980603147741806', '7880466419594193518', '8641459181420964462']) {
    const attack = component('characters', id);
    assert.equal(attack._waitForAttackEvent, 1); assert.equal(attack._waitForProjectileInvalid, 0);
  }
  assert.match(e.historicalHoldReasons[0], /attack gating/); // Trait gating is not proved by the ordinary attack field.
});

test('S2 preserves forward movement, return coefficient and collision metadata independently', () => {
  const m = component('projectiles', '-544848678706100518');
  assert.equal(m._moveAheadTimeKey, 'move_ahead_time'); assert.equal(m._moveAheadTime, 1);
  assert.equal(m._updateDelayTimeOnlyOnce, 0);
  const collider = component('projectiles', '7004249894758893274');
  assert.equal(collider.m_comebackAtkScaleKey, 'atk_scale_comeback');
  assert.equal(collider._goThroughWall, 1); assert.equal(collider._ignoreCamouflage, 1);
  const circles = e.projectiles.projectile_chr_narant_s2.flatMap(r => r.components).filter(c => 'm_Radius' in c.data);
  assert.equal(circles.length, 1); near(circles[0].data.m_Radius, .5);
  const body = component('projectiles', '6328842336110167770');
  assert.equal(body._hitNumType, 2); assert.equal(body._stopAfterFirstHit, 0);
  assert.equal(body._actionController._onlyAddBuffsToTraceTarget, 1);
  assert.equal(body._actionController._onlyAddBuffsToTargetOnce, 1);
});

test('S3 retains three separately named straight and opposing curved projectiles', () => {
  assert.deepEqual(Object.keys(e.projectiles).sort(), ['projectile_chr_narant', 'projectile_chr_narant_s1',
    'projectile_chr_narant_s2', 'projectile_chr_narant_s3', 'projectile_chr_narant_s3_1', 'projectile_chr_narant_s3_2']);
  const attack = component('characters', '8641459181420964462');
  assert.equal(attack._additionalTimes, 2); assert.equal(attack._triggerDelta, 0);
  assert.equal(attack._waitAttackEventForAllAttacks, 0); assert.equal(attack._useMultiAdditionalProjectiles, 1);
  assert.deepEqual(attack._additionalProjectiles, ['projectile_chr_narant_s3_1', 'projectile_chr_narant_s3_2']);
  const movers = ['6680989130054430318', '-5370923305493859919', '6387134102494608240']
    .map(id => component('projectiles', id));
  assert.deepEqual(movers.map(m => m._clockwiseOffset), [0, 0, 1]);
  movers.forEach(m => { assert.equal(m._comeBack, 1); assert.equal(m._comeBackSpeedScale, .25); });
  near(movers[0]._curveHeight, 0); near(movers[1]._curveHeight, .2); near(movers[2]._curveHeight, .2);
});

test('S3 return output checks active skill and uses the retained tile selector with selected cap', () => {
  const trait = component('characters', '-921784957868021138');
  assert.equal(trait._activeBuffsWhenProjectileComeback[0].templateKey, 'narant_s_3[AOE]');
  const [guard, damage] = e.templates['narant_s_3[AOE]'].eventToActions.ON_BUFF_START;
  type(guard, 'CheckContainsBuff'); assert.deepEqual(guard._buffKeys, ['narant_s_3']);
  type(damage, 'AOEDamage'); assert.equal(damage._useRadius, false); assert.equal(damage._useAbilitySelector, true);
  assert.equal(damage._abilityName, 'aoe_selector'); assert.equal(damage._damageScale, 'atk_scale_AOE');
  assert.equal(damage._damageType, 'PHYSICAL'); assert.equal(damage._useDamageFromBB, false);
  for (const id of ['2479922297763555950', '-9178075872939382162']) {
    const s = component('characters', id);
    assert.equal(s._limitTargetNum, 1); assert.equal(s._maxTargetKey, 'max_target');
    assert.equal(s._maxNum, 1); assert.equal(s._forceIgnoreCamouflage, 0);
  }
  for (const id of ['2651435913646205550', '6502725562167618158'])
    assert.equal(component('characters', id)._rangeId, 'x-4');
  assert.equal(e.tables.ranges['x-4'].grids.length, 9);
});

test('skill disable resets projectile counts and restores native modes', () => {
  for (const key of ['narant_s_1', 'narant_s_2', 'narant_s_3']) {
    const actions = e.templates[key].eventToActions;
    type(actions.ON_BUFF_START[0], 'ModifyBoomberangMaxCnt'); assert.equal(actions.ON_BUFF_START[0]._reset, false);
    type(actions.ON_BUFF_DISABLE[0], 'ModifyBoomberangMaxCnt'); assert.equal(actions.ON_BUFF_DISABLE[0]._reset, true);
    if (!key.endsWith('_1')) {
      const direction = actions.ON_BUFF_START[1];
      assert.equal(direction._conditionNode._direction, 'DOWN');
      assert.equal(direction._succeedNodes[0]._modeIndex, key.endsWith('_2') ? 3 : 5);
      assert.equal(direction._failNodes[0]._modeIndex, key.endsWith('_2') ? 2 : 4);
      assert.equal(actions.ON_BUFF_DISABLE[1]._modeIndex, 0);
      assert.equal(actions.ON_BUFF_DISABLE[1]._restartFSM, true);
    }
  }
  const toggle = component('skills', '3979525015320414263');
  assert.equal(toggle._switchToMode, 1); assert.equal(toggle._playSkillBeginAnim, 0);
});

test('stat theft remains a before-modifier chain with separate victim/owner cleanup', () => {
  const nodes = e.templates['narant_t_1[steal]'].eventToActions.ON_BEFORE_TARGET_APPLY_MODIFIER;
  type(nodes[0], 'IsDamage'); type(nodes[1], 'IfTarget');
  assert.equal(nodes[1]._checkTargetAlive, true); assert.equal(nodes[1]._targetType, 'MODIFIER_TARGET');
  assert.equal(nodes[1]._checkApplyWay, false); assert.equal(nodes[1]._checkTargetUnitType, false);
  assert.deepEqual([nodes[2]._abilityName, nodes[4]._abilityName], ['narant_steal_atk', 'narant_steal_def']);
  for (const [id, key, attr] of [['6320898112776202862', 'atk', 1], ['8295920505985985134', 'def', 2]]) {
    const steal = component('characters', id);
    assert.equal(steal._attributeType, attr); assert.equal(steal._formulaType, 2);
    assert.equal(steal._stealOnceBBKey, `steal_${key}`); assert.equal(steal._stealMaxBBKey, `steal_${key}_max`);
    assert.equal(steal._finishTargetBuffWhenInvalid, 1); assert.equal(steal._finishOwnerBuffWhenTargetInvalid, 0);
  }
  const candidates = e.tables.character.talents[0].candidates;
  assert.deepEqual(candidates.map(c => [c.unlockCondition.phase, c.requiredPotentialRank]),
    [['PHASE_1', 0], ['PHASE_1', 4], ['PHASE_2', 0], ['PHASE_2', 4]]);
  assert.deepEqual(candidates.map(c => Object.values(flat(c.blackboard))),
    [[15, 150, 10, 100], [17, 170, 11, 110], [25, 250, 20, 200], [27, 270, 21, 210]]);
});

test('dodge and adjacent hit-rate reduction stay separate with range/owner cleanup', () => {
  const evade = e.templates.evade.eventToActions.ON_TAKE_DAMAGE[0];
  assert.equal(evade._damageMask, 'PHYSICAL_AND_MAGICAL'); assert.equal(evade._applyWayFilter, 'ALL');
  const candidates = e.tables.character.talents[1].candidates;
  assert.deepEqual(candidates.map(c => c.requiredPotentialRank), [0, 2]);
  assert.deepEqual(candidates.map(c => flat(c.blackboard)), [
    { prob: .35, damage_hitrate_physical: -.2, damage_hitrate_magical: -.2 },
    { prob: .38, damage_hitrate_physical: -.2, damage_hitrate_magical: -.2 }]);
  const aura = component('characters', '8823808515991890542');
  assert.equal(aura._buffs[0].buffKey, 'narant_t_1[hitrate]');
  assert.equal(aura._passiveBuffs[0].templateKey, 'evade');
  assert.equal(aura._removeBuffWhenTargetLeave, 1); assert.equal(aura._removeBuffWhenAbilityDetached, 1);
  assert.equal(component('characters', '-9119054547283842450')._rangeId, 'x-4');
});

test('Slow keeps its database modifier, selected duration and missable damage attachment', () => {
  const slow = e.buffDatabase.sluggish;
  assert.equal(slow.durationKey, 'sluggish'); assert.equal(slow.isDamageMissable, true);
  assert.deepEqual(slow.attributes.attributeModifiers, [{ attributeType: 'MOVE_SPEED', formulaItem: 'FINAL_SCALER',
    value: -.8, loadFromBlackboard: false, fetchBaseValueFromSourceEntity: false }]);
});

test('both original facing skeleton chains retain distinct attack and skill events', () => {
  for (const face of ['Front', 'Back']) {
    const model = e.models[ID][face];
    assert.equal(model.sha256, e.officialSkeletonBindings[ID][face].sha256);
    assert.equal(model.bytes, e.officialSkeletonBindings[ID][face].byteLength);
    near(model.hits.Attack[0], .533); near(model.hits.Skill_1[0], .367);
    near(model.hits.Skill_2_Loop[0], .333); near(model.hits.Skill_3_Loop[0], .4);
    near(model.durations.Attack, 1); near(model.durations.Skill_2_Begin, .167);
    near(model.durations.Skill_3_End, .167);
  }
  assert.ok(e.models[ID].Front.durations.Skill_Down_3_Loop);
  assert.equal(e.models[ID].Back.durations.Skill_Down_3_Loop, undefined);
  assert.notEqual(e.models[ID].Front.sha256, e.models[ID].Back.sha256);
});
