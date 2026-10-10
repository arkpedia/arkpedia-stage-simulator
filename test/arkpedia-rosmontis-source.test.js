// SPDX-License-Identifier: GPL-3.0-or-later
// Native contracts for the held Rosmontis kit; source recovery is not enablement.
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-rosmontis-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';

const ID = 'char_391_rosmon', TOKEN = 'token_10012_rosmon_shield';
const components = Object.values({ ...e.characters, ...e.tokens, ...e.skills, ...e.projectiles })
  .flatMap(rows => rows.flatMap(r => r.components));
const c = id => components.find(v => v.pathId === id).data;
const bb = values => Object.fromEntries(values.map(v => [v.key, v.value]));
const type = action => action.$type.split('+').at(-1).split(',')[0];
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-6, `${a} != ${z}`);
const levels = n => e.tables.skills[`skchr_rosmon_${n}`].levels;

test('Rosmontis source recovery preserves native identities while keeping the incomplete kit unavailable', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(REGULAR_OPERATORS[ID], undefined); assert.equal(data.operators[ID], undefined);
  assert.equal(e.runtimeMapping, undefined); assert.equal(e.runtimeContracts, undefined);
  assert.equal(e.frameParity, false); assert.equal(e.moduleSupport, false);
  assert.equal(e.nativeParticleSupport, false);
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.nativeClient, '26-09-23-17-49-43_b9cc4a');
  assert.equal(e.source.modelCommit, 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd');
  assert.equal(components.length, 180); assert.equal(e.source.bundles.length, 6);
  assert.equal(Object.keys(e.templates).length, 9); assert.equal(Object.keys(e.projectiles).length, 7);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.deepEqual(Object.keys(e.buffDatabase), ['stun']);
  assert.equal(e.recoveredFacts.length, 9); assert.equal(e.holdReasons.length, 3);
});

test('all selected S1 ranks retain offensive SP and main-only Arts coefficients', () => {
  assert.equal(levels(1).length, 10);
  assert.deepEqual(levels(1).map(s => s.spData.spCost), [4,4,4,4,4,4,3,3,3,2]);
  assert.deepEqual(levels(1).map(s => bb(s.blackboard).extra_atk_scale), [.8,.85,.95,1,1.05,1.1,1.2,1.4,1.6,1.8]);
  for (const s of levels(1)) {
    assert.equal(s.skillType, 'AUTO'); assert.equal(s.spData.spType, 'INCREASE_WHEN_ATTACK');
    assert.equal(s.spData.initSp, 0); assert.equal(s.duration, 0);
    assert.equal(bb(s.blackboard).append_atk_scale, .5);
  }
  const ability = c('-3989187602593460007');
  assert.equal(ability._onlyFeedActiveBuffToFirstOne, 1);
  assert.equal(ability._additionalTimes, 1); near(ability._triggerDelta, .15);
  assert.equal(ability._additionalProjectile, 'projectile_chr_rosmon_after_shock');
  const [damage] = e.templates.rosmon_s_1.eventToActions.ON_BUFF_START;
  assert.equal(type(damage), 'AdvancedApplyDamage'); assert.equal(damage._damageType, 'MAGICAL');
  assert.equal(damage._atkScaleVar, 'extra_atk_scale'); assert.equal(damage._forceUseProjectileCachedAtk, false);
});

test('ordinary attack alternation preserves one main and one distinct delayed half-scale splash', () => {
  const alternate = c('2589603807382764315');
  assert.deepEqual(alternate._abilities.map(v => v.m_PathID), ['2024263541393947419','2031596922367998747']);
  assert.equal(alternate._diffFromLastOneIfNotFirst, 1);
  for (const id of ['2024263541393947419','2031596922367998747']) {
    const a = c(id); assert.equal(a._waitForAttackEvent, 1);
    assert.equal(a._additionalTimes, 1); near(a._triggerDelta, .15);
    assert.equal(a._castToFirstRoundTargetLocationsAtProjectileBirth, 1);
    assert.equal(a._damageType, 1); assert.equal(a._additionalProjectile, 'projectile_chr_rosmon_after_shock');
  }
  const ordinary = bb(e.tables.character.trait.candidates[0].blackboard);
  assert.equal(ordinary['attack@append_atk_scale'], .5); assert.equal(ordinary['attack@times'], 2);
  const aftershock = c('-4537478076430255760');
  assert.equal(aftershock._applyExtraAtkScale, 1); assert.equal(aftershock._atkScaleKey, 'append_atk_scale');
  assert.equal(aftershock._mergeTraceTargetMotion, 1);
  for (const key of ['projectile_chr_rosmon_A','projectile_chr_rosmon_B','projectile_chr_rosmon_s1',
    'projectile_chr_rosmon_s3','projectile_chr_rosmon_after_shock']) {
    const collider = e.projectiles[key].flatMap(r => r.components).find(v => v.data.m_Radius != null);
    near(collider.data.m_Radius, .9);
  }
});

test('S2 preserves rank-dependent ATK, duration and stun plus percentage interval and four projectile births', () => {
  assert.deepEqual(levels(2).map(s => s.duration), [30,31,32,33,34,35,36,37,38,40]);
  assert.deepEqual(levels(2).map(s => s.spData.spCost), [40,39,38,37,36,35,34,33,32,30]);
  assert.deepEqual(levels(2).map(s => bb(s.blackboard).atk), [.1,.1,.1,.2,.2,.2,.3,.37,.45,.55]);
  assert.deepEqual(levels(2).map(s => bb(s.blackboard)['attack@stun']), [.7,.7,.7,.9,.9,.9,1.1,1.2,1.3,1.5]);
  for (const s of levels(2)) {
    assert.equal(s.skillType, 'MANUAL'); assert.equal(s.spData.spType, 'INCREASE_WITH_TIME');
    assert.equal(s.spData.initSp, 20); assert.equal(bb(s.blackboard).base_attack_time, .5);
    assert.equal(bb(s.blackboard)['attack@prob'], .2); assert.equal(bb(s.blackboard).add_times, 2);
  }
  const modifiers = c('-6342955037654950080')._buffs[0].attributes.attributeModifiers;
  assert.ok(modifiers.some(v => v.attributeType === 8 && v.formulaItem === 1 && v.loadFromBlackboard === 1));
  const a = c('8002166357578185499');
  assert.equal(a._additionalTimes, 3); near(a._triggerDelta, .15);
  assert.equal(a._onlyFeedActiveBuffToFirstOne, 0); assert.equal(a._waitForAttackEvent, 0);
  assert.equal(a._selectTargetTiming, 0); assert.equal(a._castToFirstRoundTargetLocationsAtProjectileBirth, 0);
  assert.equal(a._maxAnimScale, 1); assert.equal(a._waitForProjectileInvalid, 0);
  assert.equal(a._activeBuffs[0].isDamageMissable, 0);
  for (const key of ['projectile_chr_rosmon_s2','projectile_chr_rosmon_s2_after_shock']) {
    const rows = e.projectiles[key].flatMap(r => r.components);
    assert.equal(rows.find(r => r.data.m_Radius != null).data.m_Radius, 1.5);
    const movement = rows.find(r => r.data._immediatelyReach != null).data;
    assert.equal(movement._immediatelyReach, 0); assert.equal(movement._checkReached, 0);
    assert.equal(movement._attachToMountPoint, 1);
    assert.equal(movement._keepUpdate, 0); assert.equal(movement._followTarget, 0);
    const body = rows.find(r => r.data._lifeTime != null).data;
    near(body._lifeTime, 1.2); assert.equal(body._lifeTimeType, 1);
    assert.equal(body._alwaysReachInTheEnd, 1); assert.equal(body._stopWhenSourceInvalid, 0);
    assert.equal(rows.find(r => r.data._onlyCheckHitWhenReachTarget != null).data._onlyCheckHitWhenReachTarget, 1);
  }
  assert.deepEqual(e.templates['rosmon_s_2[stun]'].eventToActions.ON_BUFF_START.map(type), ['Dice','CreateBuff']);
});

test('S3 paired token ranks preserve selected stun, blocked-target selector and source summon-first order', () => {
  assert.deepEqual(levels(3).map(s => s.spData.spCost), [80,79,78,77,76,75,74,70,66,60]);
  assert.deepEqual(levels(3).map(s => s.duration), [25,25,25,26,26,26,27,28,29,30]);
  assert.deepEqual(levels(3).map(s => bb(s.blackboard).atk), [.1,.15,.2,.25,.3,.35,.4,.5,.6,.75]);
  for (let i = 0; i < 10; i++) {
    const s = levels(3)[i], t = e.tables.tokenSkills.sktok_rosmon.levels[i];
    assert.equal(s.skillType, 'MANUAL'); assert.equal(s.spData.initSp, 35);
    assert.equal(bb(s.blackboard).base_attack_time, -.5);
    assert.equal(bb(s.blackboard)['attack@max_target'], 2);
    assert.equal(bb(s.blackboard).def, 1);
    assert.deepEqual(t.blackboard, s.blackboard); assert.equal(t.skillType, 'AUTO'); assert.equal(t.spData.spCost, 0);
  }
  assert.deepEqual(c('-1685444342655389443')._abilities.map(v => v.m_PathID), ['7280470274788913405','2308109288669081853']);
  const target = c('-4062741853108798693');
  assert.equal(target._abnormalFlag, 20); assert.equal(target._abnormalCombo, 2);
  assert.equal(target._shrinkInTheEnd, 1); assert.equal(target._shrinkNum, 2);
  assert.equal(target._pickMyTokenFirst, 1);
  assert.equal(target._targetMotion, 3);
  assert.equal(c('-1685444342655389443')._alwaysNext, 1);
  const attack = c('-525305113394709733');
  assert.equal(attack._additionalTimes, 1); assert.equal(attack._waitForAttackEvent, 0);
  assert.equal(attack._selectTargetTiming, 1); near(attack._preDelay, .17); near(attack._triggerDelta, .15);
  assert.equal(attack._maxAnimScale, 1); assert.equal(attack._castToFirstRoundTargetLocationsAtProjectileBirth, 1);
  const metadata = c('-2478265015880290051');
  assert.equal(metadata._canCastDuringBorn, 1); assert.equal(metadata._allowNoTarget, 1);
  assert.equal(metadata._checkHasTargetBeforeDoCast, 0); assert.equal(metadata._canSilenced, 0);
  assert.equal(metadata._allowSpRecoveryWhenAffecting, 0);
});

test('automatic equipment selector retains legal ground tiles, one-to-two count and hidden zero-slot ownership', () => {
  const tile = c('-7679568899476983555');
  assert.equal(tile._options.buildableType, 1); assert.equal(tile._options.passableMask, 3);
  assert.equal(tile._options.checkExtraBuildableCheckers, 1); assert.equal(tile._options.advancedBuildableMask, 1);
  assert.equal(tile._filterType, 7); assert.equal(tile._maxNum, 2); assert.equal(tile._alwaysRandomInTheEnd, 1);
  assert.equal(c('6433005972886089981')._minTileNum, 1);
  const root = c('4110751172866130270');
  assert.equal(root._occupiedRemainingCharacterCnt, 0); assert.equal(root._notShowInDeck, 1);
  assert.equal(root._isFixedRotation, 1); assert.equal(root._useRealBornTimeFromAnim, 1);
  assert.equal(c('7280470274788913405')._tokenId, TOKEN);
});

test('equipment has independent source stats, heal-free, flat blocked DEF reduction and cleanup marks', () => {
  const stats = e.tables.token.phases[2].attributesKeyFrames.at(-1).data;
  assert.equal(stats.maxHp, 5000); assert.equal(stats.def, 520); assert.equal(stats.blockCnt, 2);
  assert.equal(stats.cost, 0); assert.equal(stats.maxDeployCount, 2);
  assert.deepEqual(bb(e.tables.token.talents[0].candidates[0].blackboard), { duration:25, def:-160 });
  const passive = c('-4208363989957885602')._buffs[0];
  assert.deepEqual(passive.attributes.abnormalFlags, [7]);
  assert.deepEqual(passive.attributes.attributeModifiers.map(v => [v.attributeType,v.formulaItem,v.value]),
    [[13,3,0],[19,3,0]]);
  const block = c('-5764927146475863714');
  assert.equal(block._useBlockAsMin, 1);
  assert.deepEqual(block._buffsToBlockee[0].attributes.attributeModifiers,
    [{ attributeType:2, formulaItem:0, value:0, loadFromBlackboard:1, fetchBaseValueFromSourceEntity:0 }]);
  const end = e.templates.rosmon_e_003_kill_token.eventToActions.ON_BUFF_FINISH[0];
  assert.equal(type(end), 'KillTokens'); assert.equal(end._checkContainsBuff, true);
  assert.equal(end._buffKey, 'rosmon_token_s3_mark');
  assert.equal(type(e.templates.die_to_kill_token.eventToActions.ON_OWNER_FINISH[0]), 'KillTokens');
  assert.equal(c('-8443908124375782465')._activeBuffs[0].buffKey, 'stun');
  assert.equal(c('-8443908124375782465')._atkScale, 0);
  assert.equal(c('4033724824449051583')._targetMotion, 1);
  assert.equal(c('4033724824449051583')._ignoreHitRange, 0);
  assert.deepEqual(e.tables.ranges[e.tables.token.phases[2].rangeId].grids.map(v => [v.row,v.col]), [[0,0]]);
});

test('promotion and potential select flat penetration while the Caster aura retains its conditional count', () => {
  assert.deepEqual(e.tables.character.talents[0].candidates.map(v => bb(v.blackboard).def_penetrate_fixed), [90,105,160,175]);
  const pierce = c('1763068339972700955')._buffs[0].attributes.attributeModifiers[0];
  assert.equal(pierce.attributeType, 25); assert.equal(pierce.formulaItem, 0);
  const condition = c('3296982081147665179'), aura = c('4613541746547129115');
  assert.equal(condition._professionMask, 32); assert.equal(condition._minCount, 1);
  assert.equal(aura._maxNum, 1); assert.equal(aura._selfOption, 1);
  assert.equal(aura._removeBuffWhenTargetLeave, 1); assert.equal(aura._removeBuffWhenAbilityDetached, 1);
  assert.equal(bb(e.tables.character.talents[1].candidates[0].blackboard).atk, .08);
});

test('original facing attack markers and fixed-facing equipment aliases retain timing without certifying frame parity', () => {
  for (const face of ['Front','Back']) {
    const model = e.models[ID][face];
    assert.deepEqual(model.hits.Attack_A, [.533]); assert.deepEqual(model.hits.Attack_B, [.533]);
    assert.deepEqual(model.hits.Skill_2, [1.2]); assert.deepEqual(model.hits.Skill_3_Loop, [.033]);
    near(model.eventPayloads.Attack_A[0].time, 8/15);
    assert.equal(model.eventPayloads.Attack_A[0].name, 'OnAttack');
    assert.equal(e.officialSkeletonBindings[ID][face].sha256, model.sha256);
  }
  const art = e.tokenArtwork.models[TOKEN].facings;
  assert.deepEqual(art.front.files, art.back.files);
  assert.equal(art.front.originalPathIds.faceSwitcherPathId, '0');
  assert.equal(art.front.originalPathIds.rgbTexturePathId, '4741414236889284299');
  assert.equal(art.front.originalPathIds.alphaTexturePathId, '900126499714364929');
  assert.equal(art.front.animationRoles.attack, null);
  assert.equal(e.tokenModels[TOKEN].front.durations.Start, .133);
  assert.deepEqual(e.tokenModels[TOKEN].front.hits, {});
  assert.equal(e.tokenArtwork.avatarSource, undefined);
});
