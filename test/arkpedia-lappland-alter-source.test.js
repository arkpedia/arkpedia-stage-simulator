// SPDX-License-Identifier: GPL-3.0-or-later
// Native contracts for the complete kit, before regular-stage execution is enabled.
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-lappland-alter-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID = 'char_1038_whitw2';
const components = Object.values({ ...e.characters, ...e.skills, ...e.projectiles })
  .flatMap(rows => rows.flatMap(row => row.components));
const component = id => components.find(c => c.pathId === id).data;
const bb = rows => Object.fromEntries(rows.map(v => [v.key, v.value]));
const ranks = n => e.tables.skills[`skchr_whitw2_${n}`].levels;
const type = node => node.$type.split('+').at(-1).split(',')[0];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('complete Lappland source stays held until all three skills and drone lifecycle work', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(REGULAR_OPERATORS[ID], undefined); assert.equal(data.operators[ID], undefined);
  assert.equal(e.frameParity, false); assert.equal(e.moduleSupport, false);
  assert.equal(e.nativeParticleSupport, false);
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.nativeClient, '26-09-23-17-49-43_b9cc4a');
  assert.equal(e.source.bundles.length, 5); assert.equal(components.length, 370);
  assert.equal(new Set(components.map(c => c.pathId)).size, 370);
  assert.equal(Object.keys(e.projectiles).length, 24); assert.equal(Object.keys(e.templates).length, 12);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.deepEqual(Object.keys(e.buffDatabase), ['fear']);
  assert.equal(e.recoveredFacts.length, 9); assert.equal(e.holdReasons.length, 1);
});
test('ordinary Funnel ramp uses six increments and shared normal attack ability', () => {
  assert.deepEqual(bb(e.tables.character.trait.candidates[0].blackboard), {
    init_atk_scale: .2, delta_atk_scale: .15, max_atk_scale: 1.1, max_stack_cnt: 6,
  });
  assert.equal(component('-5130080421960187587')._normalAttackMultiFunnelsButSingleAbility, 1);
  const attack = component('1782122181183635773');
  assert.equal(attack._funnelActions.length, 3); assert.equal(attack._useExtraActiveCntAbility, 1);
  assert.equal(attack._projectileKey, 'projectile_chr_whitw2');
  assert.equal(attack._waitForAttackEvent, 1);
});
test('Alpha Wolf native branches grant cap multiplier, silence and one extra Funnel then finish', () => {
  const first = e.templates['whitw2_t[extra_ability]'].eventToActions.ON_BUFF_TRIGGER[0];
  const second = first._failNodes[0], third = second._failNodes[0];
  assert.deepEqual([first, second, third].map(n => n._conditionNode._stackCount), [0, 1, 2]);
  assert.deepEqual([first, second, third].map(n => n._conditionNode._buffKey), Array(3).fill('whiw2_t[trigger]'));
  assert.equal(type(first._succeedNodes[0]), 'ModifyFunnelMaxAtkScaleMultiplier');
  assert.equal(second._succeedNodes[0]._buff.buffKey, 'whitw2_t[silenced_mark]');
  assert.equal(type(third._succeedNodes[0]), 'AddFunnelAbilityActiveCnt');
  assert.equal(third._succeedNodes[0]._addCnt, 1);
  assert.deepEqual(third._succeedNodes[0]._abilityNames,
    ['M0FunnelsNormalAttack', 'M1FunnelRemoteAttack', 'M2FunnelRemoteAttack', 'WolvesDispersed']);
  assert.deepEqual(third._failNodes.map(type), ['FinishBuffsById', 'FinishBuff']);
  const talents = e.tables.character.talents[0].candidates;
  assert.deepEqual(talents.map(t => bb(t.blackboard).interval), [30, 26, 20, 16]);
  assert.deepEqual(talents.map(t => bb(t.blackboard).scale), [1.06, 1.06, 1.1, 1.1]);
  assert.deepEqual(talents.map(t => bb(t.blackboard)['attack@silence_duration']), [1, 1, 2, 2]);
});
test('squad SP uses Siracusa deck selection and born callback rather than deployment aura', () => {
  const deck = component('1516058703642198333');
  assert.equal(deck._options.selector.filterTag, 'siracusa');
  assert.equal(deck._options.selector.excludeMe, 0);
  assert.equal(deck._options.selector.excludeNotInHand, 0);
  assert.equal(deck._deckBuffs[0].buff.templateKey, 'modify_sp[born]');
  const sp = e.templates['modify_sp[born]'].eventToActions.ON_OWNER_BORN[0];
  assert.equal(type(sp), 'ModifySp'); assert.equal(sp._spString, 'sp'); assert.equal(sp._forceFlag, false);
  const talents = e.tables.character.talents[1].candidates;
  assert.deepEqual(talents.map(t => [t.requiredPotentialRank, bb(t.blackboard).sp, bb(t.blackboard).attack_speed]),
    [[0, 5, 0], [2, 6, 0]]);
});
test('S1 passive and native mode toggle are distinct from a timed ordinary buff', () => {
  const passive = e.templates['whitw2_s1[passive]'].eventToActions.ON_BUFF_START[0];
  assert.equal(type(passive), 'AddFunnelAbilityActiveCnt'); assert.equal(passive._addCnt, 1);
  assert.deepEqual(passive._abilityNames, ['M0FunnelsNormalAttack', 'M1FunnelRemoteAttack']);
  const meta = component('-8772634714371302916');
  assert.equal(meta._switchToMode, 1); assert.equal(meta._switchToModeDown, 0);
  assert.equal(meta._allowSpRecoveryWhenAffecting, 0);
  assert.equal(meta._extraAbilities[0].m_PathID, '6742883360359537148');
  assert.equal(component('8116426389566882109')._alwaysUseFunnelSelector, 1);
  assert.equal(component('8116426389566882109')._funnelActions.length, 3);
  for (const id of ['6098793789611540797', '7723503446556049725', '8747591276910969149']) {
    assert.equal(component(id)._postFilter, 58); assert.equal(component(id)._targetMotion, 3);
  }
  assert.deepEqual(ranks(1).map(r => r.spData.spCost), [20, 19, 18, 16, 15, 14, 12, 10, 8, 6]);
  assert.deepEqual(ranks(1).map(r => bb(r.blackboard).atk), [.05, .08, .11, .14, .17, .2, .23, .27, .31, .35]);
  for (const r of ranks(1)) { assert.equal(r.duration, -1); assert.equal(r.spData.initSp, 0); }
});
test('S2 preserves all ranks, six independent selectors and probabilistic Fear', () => {
  const attack = component('-5894285726353424067');
  assert.equal(attack._alwaysUseFunnelSelector, 1); assert.equal(attack._funnelActions.length, 6);
  assert.equal(new Set(attack._funnelActions.map(p => component(p.m_PathID)._selector.m_PathID)).size, 6);
  for (let i = 0; i < 6; i++)
    assert.equal(component(attack._funnelActions[i].m_PathID)._projectileKey, `projectile_chr_whitw2_funnel_s2_${i + 1}`);
  assert.deepEqual(ranks(2).map(r => r.duration), [12, 13, 14, 15, 16, 17, 18, 20, 21, 22]);
  assert.deepEqual(ranks(2).map(r => r.spData.initSp), [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
  assert.deepEqual(ranks(2).map(r => bb(r.blackboard).atk), [.4, .45, .5, .6, .65, .7, .8, .95, 1.05, 1.2]);
  for (const r of ranks(2)) {
    const b = bb(r.blackboard); assert.equal(r.spData.spCost, 28);
    assert.equal(b['attack@cnt'], 3); assert.equal(b['attack@prob'], .1); assert.equal(b['attack@fear'], 1);
  }
  const fear = e.templates['whitw2_s[fear]'].eventToActions.ON_BUFF_START;
  assert.deepEqual(fear.map(type), ['CheckUnitAlive', 'IsCharacterOrTokenOrTrap', 'IfNot', 'Dice', 'CreateBuff']);
  assert.equal(fear[3]._probKey, 'prob'); assert.equal(fear[4]._buff.buffKey, 'fear');
});
test('S3 separates four cruise/attachment pairs, damage abilities and detach cleanup', () => {
  const a = component('-661545081116982979');
  assert.equal(a._funnelActions.length, 4); near(a._projectileInitRadius, .5);
  assert.equal(a._clearProjectilesWhenDetached, 1); assert.equal(a._waitForAttackEvent, 0);
  assert.equal(a._allowNoTarget, 1);
  assert.deepEqual(a._cruiseProjectileKeys, [1, 2, 3, 4].map(i => `projectile_chr_whitw2_funnel_s3_${i}`));
  assert.deepEqual(a._funnelProjectileKeys, [1, 2, 3, 4].map(i => `projectile_chr_whitw2_funnel_s3_${i}_attach`));
  assert.deepEqual(ranks(3).map(r => r.spData.spCost), [75, 73, 71, 69, 67, 65, 63, 60, 57, 54]);
  assert.deepEqual(ranks(3).map(r => bb(r.blackboard).atk), [.3, .35, .4, .45, .5, .55, .6, .65, .7, .8]);
  for (const r of ranks(3)) {
    const b = bb(r.blackboard); assert.equal(r.duration, 40); assert.equal(r.spData.initSp, 38);
    assert.equal(b['attack@cnt'], 2); assert.equal(b['attack@times'], 1.3);
    assert.equal(b['attack@range_radius'], .9); assert.equal(b['attack@projectile_turn_speed'], 5);
  }
});
test('native S3 spread, inertial chase, reappearance offsets and idle orbit stay distinct', () => {
  const spread = component('-7339734723477589033');
  near(spread._speed, .1); near(spread._deltaSpeedPerSec, 1.9); near(spread._finalSpeed, 2);
  assert.equal(spread._awayFromSourceAsDirection, 1); assert.equal(spread._useDynamicSpeed, 1);
  const chase = component('398906320185045975');
  assert.equal(chase._speed, 2); assert.equal(chase._deltaSpeedPerSec, 1); assert.equal(chase._finalSpeed, 4);
  assert.equal(chase._addInertia, 1); assert.equal(chase._turnSpeed, 5);
  const movement = component('3248638574952362967');
  assert.deepEqual(movement._movementTypes, [0, 1, 2, 3]);
  assert.deepEqual(movement._randomOffsetMin, { x: -.75, y: -.75, z: 0 });
  assert.deepEqual(movement._randomOffsetMax, { x: .75, y: .75, z: 0 });
  assert.deepEqual(movement._periodTimeBBKeys, ['times']);
  const orbit = component('-8483330843134676009');
  assert.equal(orbit._radius, 1.25); assert.equal(orbit._speed, 1); assert.equal(orbit._initKeepLastDirection, 1);
});
test('S3 aura has one-stack shared ownership and immediate one-second normal Arts ticks', () => {
  for (const id of component('-661545081116982979')._funnelActions.map(p => p.m_PathID)) {
    const aura = component(id)._activeBuffs[0];
    assert.equal(aura.templateKey, 'whitw2_s3_t[slow_and_damage]');
    assert.equal(aura.maxStackCnt, 1); assert.equal(aura.independentCharacterSource, 0);
    assert.equal(aura.overrideType, 2); assert.equal(aura.triggerInterval, 1);
    assert.equal(aura.waitFirstTriggerInterval, 0);
    assert.deepEqual(aura.attributes.attributeModifiers.map(m => [m.attributeType, m.formulaItem]), [[6, 3]]);
  }
  const tick = e.templates['whitw2_s3_t[slow_and_damage]'].eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[0];
  assert.equal(type(tick), 'AdvancedApplyDamage'); assert.equal(tick._damageType, 'MAGICAL');
  assert.equal(tick._attackType, 'NORMAL'); assert.equal(tick._atkScaleVar, 'magic_atk_scale');
});
test('both original owner facings retain differing ordinary and S1 events and S3 entrance', () => {
  for (const face of ['Front', 'Back']) {
    const m = e.models[ID][face], binding = e.officialSkeletonBindings[ID][face];
    near(m.eventPayloads.Attack[0].time, .4);
    near(m.eventPayloads.Skill_1_Loop[0].time, 1 / 6);
    near(m.eventPayloads.Skill_2_Loop[0].time, .4);
    near(m.eventPayloads.Skill_3_Begin[0].time, 14 / 30);
    near(m.eventPayloads.Skill_3_Loop[0].time, .4);
    assert.equal(binding.sha256, m.sha256); assert.equal(binding.byteLength, m.bytes);
    assert.notEqual(binding.textAssetPathId, '0');
  }
});
