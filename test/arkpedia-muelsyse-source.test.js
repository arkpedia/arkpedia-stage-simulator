// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-muelsyse-prefabs.json' with { type: 'json' };

const ID = 'char_249_mlyss', TOKEN = 'token_10030_mlyss_wtrman';
const components = rows => rows.flatMap(r => r.components);
const by = rows => new Map(components(rows).map(c => [c.pathId, c.data]));
const owner = by(e.characters[ID]), token = by(e.tokens[TOKEN]);
const controller = map => [...map.values()].find(c => c._modes);
const oc = controller(owner), tc = controller(token);
const actions = (key, event) => e.templates[key].eventToActions[event];
const type = a => a.$type.split('+').at(-1).split(',')[0];
const bb = rows => Object.fromEntries(rows.map(r => [r.key, r.valueStr || r.value]));
const rank = n => e.tables.skills[`skchr_mlyss_${n}`].levels[9];

test('Muelsyse complete source stays held at the frozen identities', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  for (const k of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[k], false);
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.modelCommit, 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd');
  assert.equal(e.source.nativeClient, '26-09-23-17-49-43_b9cc4a');
  assert.equal(e.source.bundles.length, 6);
  assert.equal(Object.keys(e.templates).length, 49);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.deepEqual(Object.keys(e.tables.ranges), ['0-1', '3-1', '3-3', 'x-4', 'x-5']);
  assert.equal(Object.keys(e.projectiles).length, 4);
});

test('complete hierarchy keeps exact string pointers beyond JavaScript precision', () => {
  const rows = ['characters', 'tokens', 'skills', 'projectiles'].flatMap(g => Object.values(e[g]).flat());
  assert.equal(components(rows).length, 341);
  function walk(v, key = '') {
    if (key === 'm_PathID') assert.equal(typeof v, 'string');
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  }
  walk(rows);
  assert.equal(tc._modes[0].m_PathID, '-3010893359730239381');
  assert.ok(token.has('-2203269439485355925'));
});

test('three owner skills retain thirty ranks and copy skills remain manual', () => {
  assert.equal(Object.keys(e.tables.skills).length, 3);
  for (const s of Object.values(e.tables.skills)) {
    assert.equal(s.levels.length, 10);
    assert.ok(s.levels.every(l => l.skillType === 'MANUAL' && l.spData.spType === 'INCREASE_WITH_TIME'));
  }
  assert.equal(Object.keys(e.tables.tokenSkills).length, 3);
  for (const [id, s] of Object.entries(e.tables.tokenSkills)) {
    assert.equal(s.levels.length, 1);
    const l = s.levels[0];
    assert.equal(l.skillType, 'MANUAL'); assert.equal(l.prefabId, id);
    assert.equal(l.spData.spType, 'INCREASE_WITH_TIME');
    assert.equal(l.spData.spCost, 100); assert.equal(l.spData.initSp, 95);
    assert.equal(l.duration, 20);
  }
  assert.equal(Object.keys(e.skills).length, 6);
});

test('Flowing Shape accepts both terrain types within its host range without a slot or facing picker', () => {
  assert.equal(oc._occupiedRemainingCharacterCnt, 1);
  assert.equal(oc._buildCondition.buildableType, 2);
  assert.equal(tc._occupiedRemainingCharacterCnt, 0);
  assert.equal(tc._buildCondition.buildableType, 3);
  assert.equal(tc._buildCondition.limitByHostAttackRange, 1);
  assert.equal(tc._buildCondition.needSpecifyDirection, 0);
  assert.equal(tc._withdrawCostRecoverRatio, 0);
});

test('owner has four Physical modes while token retains six distinct native modes', () => {
  const attacks = oc._modes.map(p => owner.get(owner.get(p.m_PathID)._attack.m_PathID));
  assert.equal(attacks.length, 4);
  assert.deepEqual(attacks.map(a => a._projectileKey),
    ['projectile_chr_mlyss', 'projectile_chr_mlyss', 'projectile_chr_mlyss_s2', 'projectile_chr_mlyss_s3']);
  assert.ok(attacks.every(a => a._damageType === 1 && a._waitForAttackEvent === 1));
  assert.deepEqual(tc._modes.map(p => p.m_PathID), ['-3010893359730239381', '-6783944507502339989',
    '5094094692542011499', '4894465367708293227', '-5695668553156831125', '-6686906446068819861']);
});

test('copy uses the donor card snapshot with four scaled and two unscaled stats', () => {
  const a = actions('mlyss_wtrman_s_begin', 'ON_ENTITY_WILL_OVERLAP');
  assert.equal(type(a[0]), 'ModifyAttributeRawDataByEntity');
  assert.equal(a[0]._sourceType, 'TARGET'); assert.equal(a[0]._targetType, 'BUFF_OWNER');
  assert.equal(a[0]._useCardSnapshot, true); assert.equal(a[0]._useRatio, true);
  assert.deepEqual(a[0]._typesNeedtoUseRatio, ['MAX_HP', 'ATK', 'DEF', 'MAGIC_RESISTANCE']);
  assert.deepEqual(a[0]._typesNeedtoModify, [...a[0]._typesNeedtoUseRatio, 'BLOCK_CNT', 'BASE_ATTACK_TIME']);
  assert.equal(a[1]._directionKey, 'direction'); assert.equal(a[1]._useDirectionFromBlackboard, true);
  assert.deepEqual(a.filter(n => type(n) === 'TriggerAbility').map(n => [n._abilityName, n._castDirectly]),
    [['steal_atk', true], ['steal_def', true]]);
  const branch = a.find(n => type(n) === 'IfElse' && type(n._conditionNode) === 'FilterSubProfessionAttackType');
  assert.deepEqual(branch._succeedNodes[0]._modes, [2, 3, 4, 5]);
  assert.equal(branch._succeedNodes[0]._damageType, 'PHYSICAL');
  assert.equal(branch._failNodes[1]._damageType, 'MAGICAL');
});

test('copy scaling and recovery time depend on promotion', () => {
  const t = e.tables.tokens[TOKEN].talents[0].candidates.map(c => bb(c.blackboard));
  assert.deepEqual(t.map(v => v.scale), [.5, .7, .9]);
  assert.deepEqual(t.map(v => v.interval), [30, 28, 25]);
  assert.ok(t.every(v => v.block_cnt === 1));
});

test('melee stealing is limited to its own attack and keeps owner gains after target loss', () => {
  const a = actions('mlyss_wtrman_t_2[melee]', 'ON_BEFORE_TARGET_APPLY_MODIFIER');
  assert.equal(a[0]._abilityName, 'wtrman_melee_Attack');
  const t = bb(e.tables.tokens[TOKEN].talents[1].candidates[0].blackboard);
  for (const [id, attr, key] of [['1941241512984926315', 1, 'atk'], ['-6309947762518042517', 2, 'def']]) {
    const s = token.get(id);
    assert.equal(s._attributeType, attr); assert.equal(s._formulaType, 2);
    assert.equal(s._stealOnceBBKey, `steal_${key}`); assert.equal(t[s._stealOnceBBKey], 10);
    assert.equal(s._stealMaxBBKey, `steal_${key}_max`); assert.equal(t[s._stealMaxBBKey], 250);
    assert.equal(s._finishTargetBuffWhenInvalid, 1); assert.equal(s._finishOwnerBuffWhenTargetInvalid, 0);
    assert.ok(tc._retainedBuffsWhenDead.includes(`steal_attr_self[${key}]`));
  }
});

test('ranged split counts ability casts and refreshes existing copies without forced placement', () => {
  const a = actions('mlyss_wtrman_t_2[range]', 'ON_ABILITY_CAST_ON_TARGET');
  assert.equal(a[0]._familyGroupMask, 'ATTACK_OR_COMBAT');
  assert.equal(a[1]._buff.overrideType, 'STACK');
  assert.equal(a[2]._stackCountKey, 'max_stack_cnt'); assert.equal(a[2]._condType, 'GE');
  assert.equal(bb(e.tables.tokens[TOKEN].talents[1].candidates[0].blackboard)['mlyss_wtrman_t_2[range].max_stack_cnt'], 10);
  assert.deepEqual(a.slice(4).map(n => n._abilityName), ['EmitProjectile', 'SpawnTokenCommon']);
  const s = token.get('4692281838629771371');
  assert.equal(s._tokenId, TOKEN); assert.equal(s._useOwnerHost, 1); assert.equal(s._useOwnerDirection, 1);
  assert.equal(s._addBuffsIfOverlay, 1); assert.equal(s._forceSpawn, 0);
  assert.equal(s._checkTokenMaxDeployCnt, 0); assert.equal(s._refreshTokenCardCooldown, 0);
  const kill = actions('mlyss_wtrman_summon[trigger]', 'ON_BUFF_TRIGGER')[0];
  assert.equal(type(kill), 'InstantKill'); assert.equal(kill._skipReborn, false);
  assert.equal(bb(e.tables.tokens[TOKEN].talents[1].candidates[0].blackboard).interval, 25);
});

test('split copies inherit normalized parent stats without applying donor scaling again', () => {
  const a = actions('mlyss_wtrman_summon[override]', 'ON_BUFF_START');
  assert.equal(a[0]._sourceType, 'BUFF_SOURCE');
  assert.equal(a[0]._useCardSnapshot, false); assert.equal(a[0]._useRatio, false);
  assert.equal(a[1]._sourceMode, 3); assert.deepEqual(a[1]._modes, [3, 4]);
  assert.equal(a[1]._useSpecifiedModeRangeId, true);
  assert.equal(type(a[2]), 'ClearCharacterSp');
  assert.deepEqual(a[4]._modes, [3, 4]); assert.equal(a[4]._damageType, 'PHYSICAL');
});

test('defeat interrupts copying and recovery restores the appropriate active skill form', () => {
  const a = actions('mlyss_wtrman_t_1[listener]', 'ON_BEFORE_TRY_SET_HP_ZERO');
  assert.deepEqual(a.map(type), ['SwitchRallyPointCategory', 'CreateBuff', 'SwitchMode',
    'InterruptCharacterSkill', 'ClearCharacterSp', 'CreateEffect']);
  assert.equal(a[0]._category, 'TRAP_OR_ITEM'); assert.equal(a[2]._loadModeFromBlackboard, true);
  for (const [form, skill, special, normal] of [['melee', 3, 5, 2], ['range', 2, 4, 3]]) {
    const branch = actions(`mlyss_wtrman_t_1[reborn_${form}]`, 'ON_BUFF_START')[3];
    assert.deepEqual(branch._conditionNode._buffKeys, [`mlyss_s_${skill}[buff]`]);
    assert.equal(branch._succeedNodes[0]._modeIndex, special); assert.equal(branch._failNodes[0]._modeIndex, normal);
  }
  assert.ok(tc._retainedBuffsWhenDead.includes('mlyss_wtrman_t_2[range_cnt]'));
  assert.ok(tc._retainedBuffsWhenDead.includes('mlyss_wtrman_physical'));
});

test('S1 preserves its source DP interval rather than rounding to fit fifteen seconds', () => {
  const r = rank(1), b = bb(r.blackboard);
  assert.equal(r.duration, 15); assert.equal(r.spData.spCost, 28); assert.equal(r.spData.initSp, 8);
  assert.equal(b['mlyss_s_1[cost].interval'], 1.154); assert.equal(b['mlyss_s_1[cost].cost'], 1);
  assert.equal(b.fake_cost, 13); assert.equal(b.atk, .5); assert.equal(b.attack_speed, 50);
  assert.ok(b.fake_cost * b['mlyss_s_1[cost].interval'] > r.duration);
});

test('S2 ranged repeat uses two original hit events while melee receives Sanctuary', () => {
  const r = rank(2), b = bb(r.blackboard);
  assert.equal(b.cost, 15); assert.equal(b.damage_resistance, .25); assert.equal(b.hp_recovery_per_sec_by_max_hp_ratio, .05);
  const a = token.get(token.get(tc._modes[4].m_PathID)._attack.m_PathID);
  assert.equal(a._additionalTimes, 1); assert.equal(a._waitAttackEventForAllAttacks, 1);
  assert.equal(a._alwaysIncludeTarget, 0); assert.equal(a._splitDamage, 0);
  assert.equal(a._selectTargetSource, 1); assert.equal(a._selectTargetTiming, 1);
  assert.equal(actions('mlyss_s_2[token_buff_melee]', 'ON_BUFF_START')[0]._buffKey, 'damage_resistance[inf]');
  assert.deepEqual(e.tokenModels[TOKEN].Single.eventPayloads.B_Attack_2.map(v => v.time),
    [.30000001192092896, .3333333432674408]);
});

test('S3 keeps melee pull and ranged Bind as separate source branches', () => {
  const b = bb(rank(3).blackboard);
  assert.equal(b.cost, 15); assert.equal(b['mlyss_s_3[token_melee_trigger].interval'], 2);
  assert.equal(b['mlyss_s_3[unmoveable].duration'], 1.5);
  assert.equal(actions('mlyss_s_3[token_melee_trigger]', 'ON_BUFF_TRIGGER')[0]._abilityName, 'PullS3');
  const bind = actions('mlyss_s_3[token_buff_range]', 'ON_ABILITY_SPELL_ON');
  assert.equal(bind[0]._familyGroupMask, 'ATTACK_OR_COMBAT');
  assert.deepEqual(bind[1]._buff.attributes.abnormalFlags, ['UNMOVABLE']);
  assert.equal(bind[1]._buff.durationKey, 'duration');
});

test('Rhine selectors include Muelsyse and trait damage checks her own token blocking', () => {
  const selectors = [owner.get('7978323624740392138')._options.selector,
    owner.get('-2980648226026091318')._selector, owner.get('8460009272480042186')._options.selector];
  assert.ok(selectors.every(s => s.filterTag === 'rhine' && s.excludeMe === 0 && s.onlySelectMe === 0));
  const a = actions('mlyss_tr', 'ON_CALCULATE_DAMAGE');
  assert.equal(a[0]._checkBlockedBySourceToken, true); assert.equal(a[0]._checkBlockedBySource, false);
  assert.equal(a[1]._atkScaleKey, 'atk_scale');
});

test('literal original clips retain case, absent clips, static durations and unrounded events', () => {
  for (const face of ['Front', 'Back']) {
    const m = e.models[ID][face];
    assert.equal(m.eventPayloads.Attack[0].time, .4000000059604645);
    assert.equal(m.eventPayloads.Skill_2_Loop[0].time, .36666667461395264);
    assert.equal(m.eventPayloads.Skill_3_loop[0].time, .4000000059604645);
    assert.equal(m.durations.Skill_3_Loop, undefined);
  }
  assert.equal(e.models[ID].Back.durations.Die, undefined);
  assert.deepEqual(Object.keys(e.tokenModels[TOKEN]), ['Single']);
  const m = e.tokenModels[TOKEN].Single;
  assert.equal(m.durations.Idle_2, 0); assert.equal(m.durations.A_Default, 0); assert.equal(m.durations.B_Default, 0);
  assert.equal(m.eventPayloads.Attack[0].time, .30000001192092896);
  assert.equal(e.officialTokenSkeletonBindings[TOKEN].animationAliases.find(a => a.animKey === 'ReBorn').animName, 'Start');
});
