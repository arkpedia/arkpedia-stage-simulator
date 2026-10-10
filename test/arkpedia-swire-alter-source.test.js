// SPDX-License-Identifier: GPL-3.0-or-later
// Source gates only. Swire's complete regular-stage controller is not enabled.
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-swire-alter-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';

const ID = 'char_1033_swire2', TOKEN = 'token_10031_swire2_gdtrap';
const rows = Object.values({ ...e.characters, ...e.tokens, ...e.skills, ...e.projectiles })
  .flatMap(rs => rs.flatMap(r => r.components));
const c = id => rows.find(v => v.pathId === id).data;
const bb = values => Object.fromEntries(values.map(v => [v.key, v.value]));
const type = v => v.$type.split('+').at(-1).split(',')[0];
const actions = (key, event) => e.templates[key].eventToActions[event];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('Swire source foundation cannot silently enable an incomplete public kit', () => {
  assert.deepEqual(e.enabledOperators, []);
  assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(REGULAR_OPERATORS[ID], undefined);
  assert.equal(data.operators[ID], undefined);
  assert.equal(rows.length, 190);
  assert.equal(e.source.bundles.length, 6);
  assert.equal(e.recoveredFacts.length, 8);
  assert.equal(e.holdReasons.length, 3);
  assert.equal(e.frameParity, false);
  assert.equal(e.moduleSupport, false);
  assert.equal(e.nativeParticleSupport, false);
  assert.equal(e.runtimeMapping, undefined);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.equal(Object.keys(e.templates).length, 13);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.deepEqual(Object.keys(e.buffDatabase), ['sluggish']);
});

test('all thirty owner ranks retain special SP, selected coin capacity and AUTO S3', () => {
  const one = e.tables.skills.skchr_swire2_1.levels;
  const two = e.tables.skills.skchr_swire2_2.levels;
  const three = e.tables.skills.skchr_swire2_3.levels;
  assert.equal(one.length + two.length + three.length, 30);
  assert.deepEqual(one.map(s => bb(s.blackboard).sp), [1,1,1,2,2,2,2,3,3,3]);
  assert.deepEqual(two.map(s => bb(s.blackboard).sp), [3,3,3,3,3,3,4,4,5,5]);
  for (const s of [...one, ...two]) {
    assert.equal(s.skillType, 'PASSIVE');
    assert.equal(s.spData.spType, 8);
    assert.equal(s.spData.spCost, 0);
    assert.equal(bb(s.blackboard)['attack@sp'], -1);
    assert.equal(s.duration, -1);
  }
  assert.deepEqual(one.map(s => bb(s.blackboard)['attack@heal_scale']),
    [.25,.3,.35,.4,.45,.5,.55,.6,.7,.8]);
  for (const s of three) {
    assert.equal(s.skillType, 'AUTO');
    assert.equal(s.spData.spType, 'INCREASE_WITH_TIME');
    assert.equal(s.spData.spCost, 5);
    assert.equal(s.duration, -1);
    assert.equal(bb(s.blackboard).sp, 10);
  }
});

test('trait payment, conditional coin/ATK gain and zero refund remain separate', () => {
  assert.deepEqual(bb(e.tables.character.trait.candidates[0].blackboard), { interval: 3, cost: -3 });
  assert.equal(c('4031899472847314984')._withdrawCostRecoverRatio, 0);
  const payment = actions('swire2_tr', 'ON_BUFF_TRIGGER');
  assert.equal(type(payment[0]), 'CalculateBlackboardValueViaParams');
  assert.equal(payment[0]._minValueKey, 'cost_max');
  const branches = payment[1];
  assert.equal(type(branches._conditionNode), 'CheckCost');
  assert.equal(type(branches._succeedNodes[0]), 'ModifyCost');
  assert.deepEqual(branches._succeedNodes[1]._buffKeys, ['swire2_t_1','swire2_skill_on']);
  assert.equal(branches._succeedNodes[1].isAND, true);
  assert.equal(type(branches._succeedNodes[2]), 'ModifySp');
  assert.equal(branches._succeedNodes[2]._dontCheckSpType, true);
  assert.equal(type(branches._failNodes[0]), 'Withdraw');
  const candidates = e.tables.character.talents[0].candidates.map(z => bb(z.blackboard));
  assert.deepEqual(candidates.map(z => z.atk), [0,.03,.03,.04,.04]);
  assert.deepEqual(candidates.map(z => z.max_stack_cnt), [0,5,6,8,9]);
  assert.deepEqual(candidates.map(z => z.sp), [0,0,0,1,1]);
  assert.ok(candidates.every(z => z.trait_sp === 1));
});

test('native resource preprocessing and successful cast initialization are preserved', () => {
  const cfg = c('-8864556117869125592')._config;
  assert.equal(cfg[0]._sourceTalentKey, '11');
  assert.equal(cfg[0]._acceptEmptyBB, 1);
  assert.equal(cfg[0]._targetTalentKey, '1');
  assert.deepEqual(cfg.slice(1).map(z => z._sourceKey), ['trait_sp','atk','max_stack_cnt']);
  const cast = actions('swire2_t_1', 'ON_SKILL_CAST_SUCCEED');
  assert.deepEqual(cast.map(type), ['ClearCharacterSp', 'ModifySp']);
  assert.equal(cast[1]._spString, 'sp');
  assert.equal(cast[1]._forceFlag, true);
});

test('lethal recovery spends and doubles DP before separate post-fatal healing', () => {
  const before = actions('swire2_t_2', 'ON_BEFORE_TRY_SET_HP_ZERO');
  assert.deepEqual(before.map(type), ['CheckCost','ConsumeTrySetHpZeroModifier','ModifyCost','CalculateBlackboardValueViaParams']);
  assert.equal(before[1]._dontConsumeWhenUndeadable, true);
  assert.equal(before[3]._multiplyParamKey, 'cost_multi');
  assert.deepEqual(actions('swire2_t_2', 'ON_POST_TRY_SET_HP_ZERO').map(type),
    ['IsConsumerOfTrySetHpZeroModifier','CreateBuff']);
  const heal = actions('swire2_t_2[heal]', 'ON_BUFF_FINISH')[0];
  assert.equal(type(heal), 'HealViaMaxHpRatio');
  assert.equal(heal._ignoreHealFree, true);
  assert.equal(heal._skipModifierEvent, false);
  assert.deepEqual(e.tables.character.talents[1].candidates.map(z => bb(z.blackboard)),
    [{ cost:-5, hp_ratio:.7, cost_multi:2 }, { cost:-5, hp_ratio:.8, cost_multi:2 }]);
});

test('S1 healing uses the native low-HP ally selector and separate coin action', () => {
  const selector = c('8128235924711153704');
  near(selector._maxHpRatio, .7);
  assert.equal(selector._filerMaxHp, 1);
  assert.equal(selector._limitTargetNum, 1);
  assert.equal(c('8149180644766785576')._rangeId, 'x-4');
  const heal = c('-1464407450805657560');
  assert.equal(heal._animKey, 'Skill_1');
  assert.equal(heal._waitForAttackEvent, 1);
  assert.equal(heal._isHpRatio, 0);
  assert.equal(heal._ignoreHealFree, 0);
  const action = c('6378928893253132328');
  assert.equal(action._runActionOnEvent, 4);
  assert.equal(JSON.parse(action._actions.SerializedState)[0]._spString, 'sp');
});

test('S2 uses automatic random ground placement with no fabricated deck card', () => {
  const placement = c('-2441054884777222104');
  assert.equal(placement._alwaysRandomInTheEnd, 1);
  assert.equal(placement._options.buildableType, 1);
  assert.equal(placement._options.passableMask, 1);
  assert.equal(placement._options.checkBuildableOrPassable, 0);
  assert.equal(c('-2377756328771968984')._rangeId, 'x-6');
  assert.equal(c('3493383170212372520')._tokenId, TOKEN);
  assert.equal(c('3493383170212372520')._waitForAttackEvent, 1);
  const root = c('6574921324621103369');
  assert.equal(root._notShowInDeck, 1);
  assert.equal(root._occupiedRemainingCharacterCnt, 0);
  assert.equal(root._isInfinity, 1);
  assert.equal(root._buildCondition.needSpecifyDirection, 0);
  assert.deepEqual(actions('die_to_kill_token', 'ON_OWNER_FINISH').map(type), ['KillTokens']);
});

test('all ten token ranks preserve three-second age mode, two hits and first-hit Slow', () => {
  const levels = e.tables.tokenSkills.sktok_swire2_gdtrap.levels;
  assert.equal(levels.length, 10);
  assert.deepEqual(levels.map(s => bb(s.blackboard)['attack@atk_scale']),
    [1.4,1.45,1.5,1.55,1.6,1.65,1.7,1.8,1.9,2]);
  for (const s of levels) {
    assert.equal(s.skillType, 'PASSIVE');
    assert.equal(bb(s.blackboard).duration_switch, 3);
    assert.equal(bb(s.blackboard)['attack@sluggish'], 2);
  }
  const mature = c('-330720896360414967');
  assert.equal(mature._additionalTimes, 1);
  near(mature._triggerDelta, .1);
  assert.equal(mature._onlyFeedActiveBuffToFirstOne, 1);
  assert.equal(mature._waitAttackEventForAllAttacks, 0);
  assert.equal(c('7792456031847088393')._damageType, 1);
  assert.equal(c('-4198447998653464311')._runActionOnEvent, 3);
  assert.deepEqual(actions('swire2_token[withdraw]', 'ON_BUFF_FINISH').map(type), ['Withdraw']);
});

test('S3 separate two-hit attacks, kill credit and finish coins do not collapse', () => {
  const attack = c('-1637502540339863512');
  assert.equal(attack._additionalTimes, 1);
  assert.equal(attack._waitAttackEventForAllAttacks, 1);
  const end = actions('swire2_skill_3', 'ON_BUFF_FINISH');
  assert.equal(type(end[0]), 'AssignCurSpToBB');
  assert.equal(end[0]._blackboardKey, 'times');
  assert.ok(end.some(v => type(v) === 'ClearCharacterSp'));
  assert.equal(type(actions('swire2_skill_3','ON_TARGET_KILLED')[0]), 'ModifySp');
  const emission = c('-6662058350676271064');
  near(emission._triggerDelta, .07);
  assert.equal(emission._refreshTimesOnCastStart, 1);
  assert.equal(emission._projectileKey, 'projectile_chr_swire2_s_3');
  assert.equal(emission._useCachedAtkOnly, 0);
  assert.equal(emission._emitToInputRootTileWhenTargetIsInvalid, 1);
  assert.equal(c('-3665835510809550808')._postFilter, 14);
  assert.equal(emission._activeBuffs[0].templateKey, 'knockback[relative]');
});

test('owner and original bomb skeletons retain unrounded events and texture chains', () => {
  for (const face of ['Front','Back']) {
    const m = e.models[ID][face];
    const hit = clip => m.eventPayloads[clip].filter(v => v.name === 'OnAttack').map(v => v.time);
    near(hit('Attack')[0], .2);
    near(hit('Skill_2')[0], 1/3);
    near(hit('Skill_3_End')[0], 13/30);
    near(hit('Skill_3_Loop')[0], 7/30);
    near(hit('Skill_3_Loop')[1], .5);
    assert.equal(e.officialSkeletonBindings[ID][face].sha256, m.sha256);
  }
  const art = e.tokenArtwork.models[TOKEN].facings;
  assert.deepEqual(art.front.files, art.back.files);
  assert.equal(art.front.originalPathIds.alphaTexturePathId, '-714937374822539887');
  assert.equal(art.front.originalPathIds.rgbTexturePathId, '-5145313298703244773');
  assert.deepEqual(art.front.textureDimensions, [256,256]);
  for (const face of ['front','back']) {
    const m = e.tokenModels[TOKEN][face];
    near(m.eventPayloads.Attack.find(v => v.name === 'OnAttack').time, .2);
    near(m.durations.Attack, .2);
    assert.equal(m.durations.Start, .667); // Parser's display duration is rounded.
  }
});
