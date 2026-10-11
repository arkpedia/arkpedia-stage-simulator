// SPDX-License-Identifier: GPL-3.0-or-later
// Original source contracts; these do not approve runtime or frame parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-magallan-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';

const ID = 'char_248_mgllan';
const tokens = [1, 2, 3].map(n => `token_10005_mgllan_drone${n}`);
const components = ['characters', 'tokens', 'skills', 'projectiles'].flatMap(g =>
  Object.values(e[g]).flat().flatMap(r => r.components));
const comp = id => {
  const c = components.find(c => c.pathId === id);
  assert.ok(c, `Missing native component ${id}`);
  return c.data;
};
const bb = rows => Object.fromEntries(rows.map(r => [r.key, r.valueStr ?? r.value]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const type = node => node.$type.split('+').at(-1).split(',')[0];

test('Magallan historical source foundation remains independent from public runtime approval', () => {
  assert.deepEqual(e.enabledOperators, []);
  assert.deepEqual(e.heldOperators, [ID]);
  assert.deepEqual(REGULAR_OPERATORS[ID].skillIds, [1, 2, 3].map(n => `skchr_mgllan_${n}`));
  assert.ok(data.operators[ID]);
  for (const key of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[key], false);
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.nativeClient, '26-09-23-17-49-43_b9cc4a');
  assert.equal(e.source.bundles.length, 6);
  assert.equal(components.length, 291);
  assert.equal(new Set(components.map(c => c.pathId)).size, 291);
  assert.equal(Object.keys(e.projectiles).length, 5);
  assert.equal(Object.keys(e.templates).length, 11);
  assert.deepEqual(e.nativeTemplateGaps, []);
});

test('all thirty owner ranks retain their own drone override and sixty total ranks', () => {
  assert.deepEqual(Object.keys(e.tokens), tokens);
  for (let n = 1; n <= 3; n++) {
    assert.equal(e.tables.character.skills[n - 1].overrideTokenKey, tokens[n - 1]);
    const owner = e.tables.skills[`skchr_mgllan_${n}`];
    const token = e.tables.tokenSkills[`sktok_mgllan_drone${n}`];
    assert.equal(owner.levels.length, 10);
    assert.equal(token.levels.length, 10);
    for (const rank of owner.levels) {
      assert.equal(rank.skillType, 'MANUAL');
      assert.equal(rank.duration, 15);
      assert.equal(rank.spData.spType, 'INCREASE_WITH_TIME');
    }
    for (const rank of token.levels) {
      assert.equal(rank.skillType, 'MANUAL');
      assert.equal(rank.duration, 0);
      assert.equal(rank.spData.spCost, 0);
      assert.deepEqual(rank.blackboard, []);
    }
  }
  const m3 = n => e.tables.skills[`skchr_mgllan_${n}`].levels[9];
  assert.deepEqual([m3(1).spData.initSp, m3(1).spData.spCost], [20, 30]);
  assert.deepEqual(bb(m3(1).blackboard), { 'attack@interval': 3, 'attack@frozen_duration': 2.5, 'attack@sluggish': 1 });
  for (const n of [2, 3]) assert.deepEqual([m3(n).spData.initSp, m3(n).spData.spCost], [25, 38]);
  assert.equal(bb(m3(2).blackboard).attack_speed, 150);
  assert.equal(bb(m3(3).blackboard).atk, 1.5);
});

test('freezing, mining and combat drones have separate terrain and facing rules', () => {
  const ids = ['-6022056654831303860', '3383066826909765818', '8032229342842227100'];
  ids.forEach((id, n) => {
    const controller = comp(id), p = controller._buildCondition;
    assert.equal(p.buildableType, [3, 1, 2][n]);
    assert.equal(p.needSpecifyDirection, n === 2 ? 1 : 0);
    assert.equal(p.limitByHostAttackRange, 0);
    assert.equal(p.limitByHostAbilityRange, 0);
    assert.equal(controller._occupiedRemainingCharacterCnt, 1);
    for (const phase of e.tables.tokens[tokens[n]].phases)
      for (const frame of phase.attributesKeyFrames) assert.equal(frame.data.blockCnt, 0);
  });
});

test('drone stock and invisibility use their own phase and potential blackboards', () => {
  assert.deepEqual(e.tables.character.talents[0].candidates.map(t => bb(t.blackboard).cnt), [3, 4, 5]);
  for (const id of tokens) {
    const talents = e.tables.tokens[id].talents;
    assert.deepEqual(talents[0].candidates.map(t => bb(t.blackboard).max_deck_stack_cnt), [3, 4, 5]);
    assert.deepEqual(talents[0].candidates.map(t => bb(t.blackboard).max_deploy_count), [2, 2, 2]);
    assert.deepEqual(talents[1].candidates.map(t => [t.unlockCondition.phase, t.requiredPotentialRank, bb(t.blackboard).hidden_duration]),
      [['PHASE_1', 0, 12], ['PHASE_1', 4, 14], ['PHASE_2', 0, 20], ['PHASE_2', 4, 22]]);
  }
  const born = e.templates.mgllan_drone_t.eventToActions.ON_OWNER_BORN[0];
  assert.deepEqual(born._buff.attributes.abnormalFlags, ['INVISIBLE']);
  assert.equal(born._buff.durationKey, 'hidden_duration');
  assert.equal(born._isDerivedBuff, false);
  assert.equal(born._finishDerivedBuffIfParentFinish, false);
});

test('owner attacks use Arts projectiles and original hit events on both facings', () => {
  const attack = comp('8036716727285702695');
  assert.equal(attack._damageType, 2);
  assert.equal(attack._projectileKey, 'projectile_mgllan');
  assert.equal(attack._waitForAttackEvent, 1);
  assert.equal(attack._useCachedAtkOnly, 0);
  assert.equal(comp('8775737600394172606')._speed, 10);
  for (const face of ['Front', 'Back']) {
    const m = e.models[ID][face];
    near(m.eventPayloads.Attack[0].time, 19 / 30);
    assert.equal(m.eventPayloads.Attack[0].name, 'OnAttack');
    near(m.eventPayloads.Skill[0].time, .5);
    assert.equal(m.eventPayloads.Skill[0].name, 'OnAttack');
    assert.equal(e.officialSkeletonBindings[ID][face].sha256, m.sha256);
  }
  assert.equal(e.models[ID].Front.durations.Die, 1);
  assert.equal(e.models[ID].Back.durations.Die, undefined);
});

test('freezing drone has a native disarm buff and no invented Attack event', () => {
  const buff = comp('-197546529714748596')._buffs[0];
  assert.equal(buff.buffKey, 'mgllan_drone_disarmed');
  assert.deepEqual(buff.attributes.abnormalFlags, [11]);
  assert.equal(e.tokenModels[tokens[0]].durations.Attack, undefined);
  assert.deepEqual(e.tokenModels[tokens[0]].hits, {});
});

test('S1 pulses use range actions with separate Sluggish and Bind effects', () => {
  for (const active of [false, true]) {
    const mode = active ? 'active' : 'passive';
    const owner = e.templates[`mgllan_s_1[${mode}]`].eventToActions.ON_BUFF_TRIGGER;
    const token = e.templates[`mgllan_s_1_token[${mode}]`].eventToActions.ON_BUFF_FINISH;
    assert.deepEqual(owner.map(type), ['CreateBuffInRange', 'CreateBuffToToken']);
    assert.equal(type(token[0]), 'CreateBuffInRange');
    for (const node of [owner[0], token[0]]) {
      assert.equal(node._useAttackRange, true);
      assert.equal(node._useRadius, false);
      assert.equal(node._targetOptions.targetSide, 'ENEMY');
      assert.equal(node._targetOptions.targetMotion, 'ALL');
      assert.equal(node._targetOptions.ignoreTargetFree, false);
      const buff = node._buffs[0];
      if (active) {
        assert.deepEqual(buff.attributes.abnormalFlags, ['UNMOVABLE']);
        assert.equal(buff.durationKey, 'frozen_duration');
      } else {
        assert.equal(buff.buffKey, 'sluggish');
        assert.equal(buff.loadFromDB, true);
      }
    }
    assert.equal(owner[1]._buffData.lifeTimeType, 'IMMEDIATELY');
    assert.equal(owner[1]._buffData.templateKey, `mgllan_s_1_token[${mode}]`);
  }
  assert.deepEqual(e.buffDatabase.sluggish.attributes.attributeModifiers,
    [{ attributeType: 'MOVE_SPEED', formulaItem: 'FINAL_SCALER', value: -.8, loadFromBlackboard: false, fetchBaseValueFromSourceEntity: false }]);
});

test('S2 separates event-gated Arts shots from the active area selector', () => {
  const basic = comp('3786224098451148986'), active = comp('1441197292955717818');
  assert.equal(basic._projectileKey, 'projectile_mgllan2_drone_2');
  assert.equal(basic._damageType, 2);
  assert.equal(basic._useCachedAtkOnly, 0);
  assert.equal(basic._waitForAttackEvent, 1);
  assert.equal(comp('-4811128230528815460')._speed, 15);
  assert.equal(active._damageType, 2);
  assert.equal(active._waitForAttackEvent, 1);
  assert.equal(active._selector.m_PathID, '-2559454158479470406');
  assert.equal(comp(active._selector.m_PathID)._limitTargetNum, 0);
  const buff = comp('6739444615076452621')._buffs[0];
  assert.equal(buff.templateKey, 'switch_mode');
  assert.deepEqual(buff.attributes.attributeModifiers.map(v => [v.attributeType, v.formulaItem, v.loadFromBlackboard]), [[7, 0, 1]]);
});

test('S3 checks physical splash on target arrival and retains its multiplicative ATK mode', () => {
  for (const [id, key] of [['-5737959017697408612', 'projectile_mgllan3_drone_3'], ['2695948267423631772', 'projectile_mgllan3_drone_3S']]) {
    const a = comp(id);
    assert.equal(a._projectileKey, key);
    assert.equal(a._damageType, 1);
    assert.equal(a._waitForAttackEvent, 1);
    assert.equal(a._useCachedAtkOnly, 0);
  }
  assert.equal(comp('2142353987835622399').m_Radius, .75);
  assert.equal(comp('5620763496570893951').m_Radius, 1.25);
  for (const id of ['-2511385534807378945', '1424472900917737087']) {
    assert.equal(comp(id)._onlyCheckHitWhenStop, 0);
    assert.equal(comp(id)._onlyCheckHitWhenReachTarget, 1);
    assert.equal(comp(id)._ignoreCamouflage, 1);
  }
  for (const id of ['-135968330856434689', '5996972107188811391']) assert.equal(comp(id)._speed, 12);
  const buff = comp('1633772105727872714')._buffs[0];
  assert.equal(buff.templateKey, 'switch_mode');
  assert.deepEqual(buff.attributes.attributeModifiers.map(v => [v.attributeType, v.formulaItem, v.loadFromBlackboard]), [[1, 1, 1]]);
});

test('skill completion recharges on finish before withdrawing the drone', () => {
  const actions = e.templates['mgllan_drone_s[finish]'].eventToActions.ON_BUFF_START;
  assert.deepEqual(actions.map(type), ['RechargeToken', 'AlwaysNext', 'Withdraw']);
  assert.equal(actions[0]._rechargeTiming, 'ON_FINISH');
  assert.equal(actions[0]._refreshRemainingCnt, false);
  assert.equal(actions[2]._withdrawSource, true);
  assert.equal(actions[2]._switchToDeadState, true);
  assert.equal(actions[2]._force, false);
  assert.equal(type(e.templates.trigger_token_skill.eventToActions.ON_BUFF_START[0]), 'TriggerTokenSkill');
  assert.equal(type(e.templates.die_to_kill_token.eventToActions.ON_OWNER_FINISH[0]), 'KillTokens');
  assert.equal(e.templates['charge_token[born]'].eventToActions.ON_OWNER_BORN[0]._rechargeTiming, 'NORMAL');
});

test('hidden recycle holders support Born without inventing a visible manual skill', () => {
  for (const id of ['2496454571614359436', '-7456215151935425689', '1211171987820311458']) {
    const s = comp(id);
    assert.equal(s._hidden, 1);
    assert.equal(s._canSilenced, 0);
    assert.equal(s._canCastDuringBorn, 1);
    assert.equal(s._canSwitchDuringBorn, 1);
    assert.equal(s._allowNoTarget, 1);
  }
  for (const id of ['-7517917715348533091', '8642975028533401869', '8571353450288844490']) {
    assert.equal(comp(id)._canSilenced, 0);
    assert.equal(comp(id)._allowSpRecoveryWhenAffecting, 0);
  }
});

test('original drone skeleton chains retain literal native aliases and different hit clocks', () => {
  for (const id of tokens) {
    const binding = e.officialTokenSkeletonBindings[id], model = e.tokenModels[id];
    assert.equal(binding.sha256, model.sha256);
    assert.equal(binding.byteLength, model.bytes);
    for (const key of ['rootPathId', 'controllerPathId', 'animatorPathId', 'skeletonAnimationPathId', 'skeletonDataAssetPathId', 'textAssetPathId', 'atlasAssetPathId', 'atlasTextAssetPathId', 'faceSwitcherPathId'])
      assert.match(binding[key], /^-?\d+$/);
    assert.equal(binding.animationAliases.find(a => a.animKey === 'Die').animName, 'Idle');
    assert.equal(binding.animationAliases.find(a => a.animKey === 'Born').animName, 'Start');
    assert.equal(model.durations.Die, .5);
  }
  near(e.tokenModels[tokens[1]].eventPayloads.Attack[0].time, 7 / 30);
  near(e.tokenModels[tokens[2]].eventPayloads.Attack[0].time, 21 / 30);
});
