// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-mitm-prefabs.json' with { type: 'json' };

const ID = 'char_4147_mitm', TOKEN = 'token_10037_mitm_trshrb';
const components = rows => rows.flatMap(r => r.components);
const by = group => new Map(components(group).map(c => [c.pathId, c.data]));
const controller = rows => components(rows).find(c => c.data._modes).data;
const actions = (key, event) => e.templates[key].eventToActions[event];
const type = a => a.$type.split('+').at(-1).split(',')[0];
const bb = rows => Object.fromEntries(rows.map(r => [r.key, r.valueStr || r.value]));

test('Mitm foundation holds public enablement and unsupported fidelity claims', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  for (const k of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[k], false);
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.nativeClient, '26-09-23-17-49-43_b9cc4a');
  assert.deepEqual(Object.keys(e.tokens), [TOKEN]);
  assert.equal(e.source.bundles.length, 6);
  assert.equal(Object.keys(e.templates).length, 17);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.deepEqual(Object.keys(e.tables.ranges), ['0-1', '3-1', '3-3', 'x-5']);
  // The native cross includes its centre despite the description saying four
  // adjacent tiles. Placement filters must decide occupancy in the runtime.
  assert.deepEqual(e.tables.ranges['x-5'].grids.map(g => [g.row, g.col]),
    [[1, 0], [0, -1], [0, 0], [0, 1], [-1, 0]]);
  assert.deepEqual(Object.keys(e.projectiles), ['projectile_chr_mitm', 'projectile_chr_mitm_s2']);
  const rows = ['characters', 'tokens', 'skills', 'projectiles'].flatMap(g => Object.values(e[g]).flat());
  assert.equal(components(rows).length, 152);
  assert.ok(components(rows).every(c => typeof c.pathId === 'string'));
});

test('both owner skills retain ten ranks while token skills are single-rank passives', () => {
  assert.deepEqual(Object.keys(e.tables.skills), ['skchr_mitm_1', 'skchr_mitm_2']);
  assert.deepEqual(Object.keys(e.tables.tokenSkills), ['sktok_mitm_trshrb_1', 'sktok_mitm_trshrb_2']);
  for (const skill of Object.values(e.tables.skills)) {
    assert.equal(skill.levels.length, 10);
    assert.ok(skill.levels.every(l => l.skillType === 'MANUAL' && l.spData.spType === 'INCREASE_WITH_TIME'));
  }
  for (const skill of Object.values(e.tables.tokenSkills)) {
    assert.equal(skill.levels.length, 1); assert.equal(skill.levels[0].skillType, 'PASSIVE');
    assert.equal(skill.levels[0].prefabId, null);
  }
  assert.equal(Object.keys(e.skills).length, 4);
});

test('tactical point requires ground in host attack range and consumes no operator slot', () => {
  assert.equal(controller(e.characters[ID])._occupiedRemainingCharacterCnt, 1);
  const c = controller(e.tokens[TOKEN]);
  assert.equal(c._occupiedRemainingCharacterCnt, 0);
  assert.equal(c._buildCondition.buildableType, 1);
  assert.equal(c._buildCondition.limitByHostAttackRange, 1);
  assert.equal(c._buildCondition.needSpecifyDirection, 0);
  assert.equal(c._sideType, 1); assert.equal(c._category, 2);
  assert.equal(c._withdrawCostRecoverRatio, 0);
});

test('owner modes preserve physical projectiles and skill-specific event clips', () => {
  const b = by(e.characters[ID]);
  const attacks = controller(e.characters[ID])._modes.map(p => b.get(b.get(p.m_PathID)._attack.m_PathID));
  assert.deepEqual(attacks.map(a => a._animKey), ['Attack', 'Skill_2_Loop']);
  assert.deepEqual(attacks.map(a => a._projectileKey), ['projectile_chr_mitm', 'projectile_chr_mitm_s2']);
  assert.ok(attacks.every(a => a._damageType === 1 && a._waitForAttackEvent === 1));
  const rank = bb(e.tables.skills.skchr_mitm_2.levels[9].blackboard);
  assert.equal(rank['attack@max_target'], 1);
  assert.equal(rank.atk, .8); assert.equal(rank.mode, 1);
});

test('trait multiplier checks blocking by the source operator token', () => {
  const a = actions('mitm_tr_1', 'ON_CALCULATE_DAMAGE');
  assert.deepEqual(a.map(type), ['CheckBlocked', 'AtkScaleUp']);
  assert.equal(a[0]._checkBlockedBySourceToken, true);
  assert.equal(a[0]._checkBlockedBySource, false);
  assert.equal(a[1]._atkScaleKey, 'atk_scale');
  assert.equal(bb(e.tables.character.trait.candidates[0].blackboard).atk_scale, 1.5);
});

test('Cherry-3 separates respawn, attacking, wreckage and skill modes', () => {
  const b = by(e.tokens[TOKEN]);
  const modes = controller(e.tokens[TOKEN])._modes.map(p => b.get(p.m_PathID));
  assert.equal(modes.length, 4);
  assert.equal(b.get(modes[1]._attack.m_PathID)._animKey, 'Attack');
  assert.equal(modes[2]._attack.m_PathID, '0');
  assert.equal(b.get(modes[3]._attack.m_PathID)._animKey, undefined);
  assert.equal(b.get('-8804709210525108281')._waitForAttackEvent, 1);
  assert.equal(b.get('-8804709210525108281')._damageType, 1);
  const aliases = e.officialTokenSkeletonBindings[TOKEN].animationAliases;
  assert.equal(aliases.find(a => a.animKey === 'Idle').animName, 'Idle_1');
  assert.equal(aliases.find(a => a.animKey === 'ReBorn').animName, 'Start');
  assert.equal(aliases.find(a => a.animKey === 'Waste').animName, 'Waste');
});

test('defeat spawns wreckage before returning the tactical point to respawn mode', () => {
  const a = actions('trshrb_t_1[dead_listener]', 'ON_BEFORE_TRY_SET_HP_ZERO');
  assert.deepEqual(a.map(type), ['SwitchRallyPointCategory', 'PlayAudio', 'TriggerAbilityMergeBB', 'SwitchMode', 'CreateEffect']);
  assert.equal(a[2]._abilityName, 'SpawnTrash'); assert.equal(a[2]._castDirectly, false);
  assert.equal(a[3]._loadModeFromBlackboard, true);
  assert.equal(a[4]._effectKey, 'token_mitm_trshrb_die_01');
  const b = by(e.tokens[TOKEN]);
  const spawn = b.get('-113505676959385657');
  assert.equal(spawn._tokenId, TOKEN); assert.equal(spawn._useOwnerHost, 1);
  assert.equal(spawn._forceSpawn, 0); assert.equal(spawn._checkTokenMaxDeployCnt, 0);
  assert.equal(b.get('3739768722213337031')._rangeId, 'x-5');
  const selector = b.get('-5454132628107659321');
  assert.equal(selector._options.buildableType, 1); assert.equal(selector._options.checkHeightType, 1);
  assert.equal(selector._options.heightType, 0); assert.equal(selector._limitTargetNum, 0);
});

test('wreckage is a non-attacking half-HP token with one block and zero ATK/DEF', () => {
  const a = actions('trshrb_t_1[trash_born]', 'ON_BUFF_START');
  assert.equal(a[0]._modeIndex, 2);
  assert.equal(a[1]._category, 'DEFAULT');
  assert.equal(a[2]._effectKey, 'token_mitm_trshrb_waste_01');
  const talents = e.tables.tokens[TOKEN].talents[0].candidates.map(c => bb(c.blackboard));
  assert.deepEqual(talents.map(t => t.interval), [20, 17, 15]);
  for (const t of talents) {
    assert.equal(t['trshrb_t_1[trash_born].max_hp'], -.5);
    assert.equal(t['trshrb_t_1[trash_born].block_cnt'], 1);
    assert.equal(t['trshrb_t_1[trash_born].def'], -1);
    assert.equal(t['trshrb_t_1[trash_born].atk'], -1);
  }
  assert.ok(e.tables.tokens[TOKEN].phases.every(p => p.attributesKeyFrames.every(f => f.data.blockCnt === 0)));
});

test('S1 DP grant remains separate from mode-gated ground-only physical explosion', () => {
  assert.deepEqual(actions('mitm_s_1[cost]', 'ON_BUFF_START').map(type), ['CreateEffect', 'ModifyCost']);
  const a = actions('mitm_s_1', 'ON_BUFF_START');
  assert.deepEqual(a.map(type), ['CheckUnitCurrentMode', 'CreateEffect', 'PlayAudio', 'AOEDamage', 'Withdraw']);
  assert.equal(a[0]._checkCurModeIndex, 1);
  assert.equal(a[3]._sourceType, 'BUFF_SOURCE'); assert.equal(a[3]._targetType, 'BUFF_OWNER');
  assert.equal(a[3]._damageType, 'PHYSICAL'); assert.equal(a[3]._rangeId, 'x-5');
  assert.equal(a[3]._targetOptions.targetMotion, 'WALK_ONLY'); assert.equal(a[3]._damageScale, 'aoe_damage_scale');
  const skill = components(e.skills.skchr_mitm_1).find(c => c.data._animKey === 'Skill_1').data;
  assert.equal(skill._waitForAttackEvent, 1); assert.equal(skill._allowNoTarget, 1);
  assert.ok(e.tables.skills.skchr_mitm_1.levels.every(l => bb(l.blackboard).cost === 6));
  assert.equal(bb(e.tables.skills.skchr_mitm_1.levels[9].blackboard).aoe_damage_scale, 4);
});

test('S2 changes active buggy mode, derives attributes and self-destructs on finish', () => {
  const start = actions('mitm_s_2[to_token]', 'ON_BUFF_START');
  assert.deepEqual(start.map(type), ['CheckUnitCurrentMode', 'SwitchMode', 'PlayAudio', 'CreateBuff']);
  assert.equal(start[0]._checkCurModeIndex, 1); assert.equal(start[1]._modeIndex, 3);
  assert.equal(start[3]._isDerivedBuff, true); assert.equal(start[3]._finishDerivedBuffIfParentFinish, true);
  assert.deepEqual(start[3]._buff.attributes.attributeModifiers.map(m => [m.attributeType, m.formulaItem]),
    [['BLOCK_CNT', 'ADDITION'], ['DEF', 'MULTIPLIER']]);
  const finish = actions('mitm_s_2[to_token]', 'ON_BUFF_FINISH');
  assert.deepEqual(finish.map(type), ['CheckUnitCurrentMode', 'IfNot', 'CheckUnitCurrentMode', 'IfNot', 'Withdraw']);
  assert.deepEqual([finish[0]._checkCurModeIndex, finish[2]._checkCurModeIndex], [0, 2]);
  const rank = e.tables.skills.skchr_mitm_2.levels[9];
  assert.equal(rank.duration, 15); assert.equal(bb(rank.blackboard)['mitm_s_2[cost].interval'], 1.25);
  assert.equal(bb(rank.blackboard)['mitm_s_2[to_token].block_cnt'], 2);
  assert.equal(bb(rank.blackboard).block_cnt_display, 1);
  assert.equal(actions('mitm_s_2[cost]', 'ON_BUFF_TRIGGER')[0]._blackboardKey, 'cost');
});

test('owner-finish kills owned tokens and respawn restores the buggy mode', () => {
  assert.deepEqual(actions('die_to_kill_token', 'ON_OWNER_FINISH').map(type), ['KillTokens']);
  const a = actions('trshrb_t_1[reborn]', 'ON_BUFF_START');
  assert.deepEqual(a.map(type), ['SwitchRallyPointCategory', 'RallyPointReborn', 'SwitchMode']);
  const switchAbility = by(e.tokens[TOKEN]).get('4285070726392215495');
  assert.equal(switchAbility._preDelay, 1); assert.equal(switchAbility._animKey, 'ReBorn');
  assert.equal(bb(switchAbility._activeBuffs[0].blackboard).mode, 1);
});

test('owner and Cherry-3 preserve original unrounded events and literal skeletons', () => {
  for (const face of ['Front', 'Back']) {
    const m = e.models[ID][face];
    assert.equal(m.eventPayloads.Attack[0].time, .36666667461395264);
    assert.equal(m.eventPayloads.Skill_1[0].time, .36666667461395264);
    assert.equal(m.eventPayloads.Skill_2_Loop[0].time, .4000000059604645);
    assert.equal(m.eventPayloads.Start[0].name, 'OnAttack');
    assert.equal(m.eventPayloads.Start[0].time, .13333334028720856);
  }
  assert.equal(e.models[ID].Back.durations.Die, undefined);
  assert.deepEqual(Object.keys(e.tokenModels[TOKEN]), ['Single']);
  assert.equal(e.tokenModels[TOKEN].Single.eventPayloads.Attack[0].time, .46666666865348816);
  assert.equal(e.tokenModels[TOKEN].Single.durations.Waste, 0);
  assert.equal(e.tokenModels[TOKEN].Single.durations.Idle_2, 0);
});
