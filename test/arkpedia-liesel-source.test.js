// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-native-operators/char_4031_liesel.json' with { type: 'json' };
import { LIESEL_ID as ID, LIESEL_SKILLS, selectedLieselBuild as select, lieselNativeInputs } from '../server/sim/content/arkpedia-liesel-source.js';
import { near } from './helpers/mon3tr-fixture.js';
const build = (elite = 2, skill = 0, rank = [4, 7, 10][elite], potential = 1, trust = 0) => ({
  elite, level: e.tables.character.phases[elite].maxLevel, potential, trust, skillId: LIESEL_SKILLS[skill], skillRank: rank, module: 'none',
});
test('Ripresa original source receipt stays held independently of public runtime approval', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(e.source.commit, 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');
  assert.equal(e.source.nativeClient, '26-09-22-07-47-20_6c71fa');
  assert.equal(e.source.bundles.length, 5); assert.equal(Object.keys(e.source.tableGitBlobs).length, 6);
  assert.deepEqual(e.nativeTemplateGaps, []); assert.deepEqual(e.jsonTemplateGaps, []);
  for (const flag of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[flag], false);
  assert.equal(Object.keys(e.projectiles).length, 3); assert.equal(Object.keys(e.templates).length, 3);
});
for (const elite of [0, 1, 2]) for (const potential of [1, 6]) test(`selected E${elite}/P${potential} source stats, potential and trust`, () => {
  const r = select(build(elite, 0, [4, 7, 10][elite], potential, 200));
  near(r.stats.maxHp, [967, 1209, 1550][elite]); near(r.stats.atk, [514, 659, 785][elite] + 90 + (potential === 6 ? 32 : 0));
  near(r.stats.def, [76, 105, 125][elite]); near(r.stats.cost, [30, 33, 33][elite] - (potential === 6 ? 2 : 0));
  near(r.stats.respawnTime, potential === 6 ? 66 : 70); near(r.stats.baseAttackTime, 2.9);
  near(r.talentBb[0]?.damage_scale ?? 1, elite === 0 ? 1 : [0, 1.1, 1.2][elite] + (potential === 6 ? .05 : 0));
});
for (let rank = 1; rank <= 10; rank++) test(`both source skills retain exact rank ${rank} costs, charges and blackboard`, () => {
  const a = select(build(2, 0, rank)), b = select(build(2, 1, rank));
  near(a.source.spData.spCost, [9, 9, 9, 9, 9, 9, 8, 8, 8, 7][rank - 1]);
  near(a.source.spData.maxChargeTime, rank < 7 ? 1 : 2); near(a.bb.atk_scale, 1.1 + rank * .1);
  near(b.source.spData.spCost, [17, 16, 16, 15, 15, 14, 13, 13, 13, 12][rank - 1]);
  near(b.bb.max_target_cnt, 3); near(b.bb['liesel_s_2[dot].duration'], 6);
  near(b.bb['liesel_s_2[dot].atk_scale'], [.1, .1, .1, .15, .2, .25, .3, .3, .35, .35][rank - 1]);
});
test('phase/rank/trust/potential/module/source-skill admission rejects invalid or locked builds', () => {
  for (const patch of [{ elite: -1 }, { elite: 3 }, { level: 0 }, { level: 81 }, { skillRank: 11 },
    { potential: 0 }, { potential: 7 }, { trust: -1 }, { trust: 201 }, { module: 'mod-y' }, { module: '' }, { module: 0 },
    { skillId: 'other' }, { elite: 0, skillRank: 4, skillId: LIESEL_SKILLS[1] }, { elite: 1, skillRank: 8 }, { elite: 0, skillRank: 5 }])
    assert.throws(() => select({ ...build(), ...patch }));
});
test('native graphs distinguish uncapped enhanced swings, capped ordinary swings and delayed homing shot lifetimes', () => {
  const n = lieselNativeInputs(); near(n.ordinaryRadius, 1.100000023841858); near(n.enhancedRadius, 1.7000000476837158);
  assert.equal(n.ordinary._maxAnimScale, 1); assert.equal(n.s1._maxAnimScale, -1); assert.equal(n.s2._maxAnimScale, 1);
  assert.equal(n.s2._additionalTimes, 2); assert.equal(n.s2._triggerDelta, 0); assert.equal(n.s2._waitAttackEventForAllAttacks, 0);
  assert.equal(n.exclusion.buffKey, 'liesel_s_2[exclude]'); near(n.exclusion.lifeTime, 1.5); assert.equal(n.exclusion.independentCharacterSource, 1);
  for (const [i, shot] of n.shots.entries()) {
    near(shot.projectile._lifeTime, [1.2000000476837158, 1.600000023841858, 2][i]);
    near(shot.motion._delayToStart, [1.100000023841858, 1.5, 1.899999976158142][i]);
    assert.equal(shot.projectile._stopWhenSourceInvalid, 1); assert.equal(shot.motion._followTarget, 1);
    assert.equal(shot.motion._stopIfTargetDead, 0); assert.equal(shot.motion._immediatelyReach, 1);
  }
});
test('original projectile actions and DOT template preserve distinct damage keys and snapshot-on-extend input', () => {
  const actions = lieselNativeInputs().projectileActions;
  assert.match(actions[0].$type, /CheckUnitAlive/); assert.equal(actions[0]._ownerType, 'SOURCE');
  assert.equal(actions[1]._conditionNode._blackboardKey, 'projectile_targets_count');
  assert.equal(actions[1]._conditionNode._valueToCompare, 3);
  assert.equal(actions[1]._succeedNodes[0]._modifierKey, 'damage_up');
  assert.equal(actions[1]._failNodes[0]._modifierKey, 'ignore_damage_up');
  assert.equal(actions[1]._succeedNodes[0]._attackType, 'NORMAL');
  assert.equal(actions[1]._succeedNodes[0]._forceUseProjectileCachedAtk, false);
  const dot = actions[2]._buff; assert.equal(dot.templateKey, 'liesel_s_2[dot]');
  assert.equal(dot.takeSnapshotWhenExtend, true); assert.equal(dot.overrideType, 'EXTEND');
  assert.equal(dot.independentCharacterSource, true); assert.equal(dot.waitFirstTriggerInterval, true); near(dot.triggerInterval, 1);
  const tick = e.templates['liesel_s_2[dot]'].eventToActions.ON_BUFF_TRIGGER[0];
  assert.match(tick.$type, /ApplyCacheAtkDamageFromBuff/); assert.equal(tick._modifierKey, 'dot'); assert.equal(tick._applyWay, 'RANGED');
});
test('both original skeletons retain literal attack and separate S2 events; neither facing is aliased', () => {
  for (const face of ['Front', 'Back']) {
    const m = e.models[ID][face], binding = e.officialSkeletonBindings[ID][face];
    assert.equal(m.sha256, binding.sha256); near(m.durations.Attack, 2.9); near(m.durations.Skill_1, 2.9); near(m.durations.Skill_2, 1.5);
    near(m.eventPayloads.Attack[0].time, .5); near(m.eventPayloads.Skill_1[0].time, .5);
    near(m.eventPayloads.Skill_2[0].time, .2666666805744171); assert.equal(m.eventPayloads.Skill_2[1].name, 'AnimeAttack');
    near(m.eventPayloads.Skill_2[1].time, 1.3666666746139526);
  }
  assert.notEqual(e.models[ID].Front.sha256, e.models[ID].Back.sha256);
});
