// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-yu-prefabs.json' with { type: 'json' };

const ID = 'char_2026_yu';
const components = rows => rows.flatMap(r => r.components);
const owner = components(e.characters[ID]);
const component = id => owner.find(c => c.pathId === id).data;
const skillComponent = (n, id) => components(e.skills[`skchr_yu_${n}`]).find(c => c.pathId === id).data;
const bb = rows => Object.fromEntries(rows.map(r => [r.key, r.valueStr || r.value]));
function nodes(value, wanted) {
  const found = [];
  function visit(v) {
    if (!v || typeof v !== 'object') return;
    if (wanted(v)) found.push(v);
    for (const [key, x] of Object.entries(v)) {
      if (key === 'SerializedState') visit(JSON.parse(x));
      else visit(x);
    }
  }
  visit(value); return found;
}
const action = (v, name) => nodes(v, n => n.$type?.split('+').at(-1).split(',')[0] === name);

test('Yu native foundation remains held independently of the separate public runtime review', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  for (const key of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[key], false);
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.nativeClient, '26-09-23-17-49-43_b9cc4a');
  assert.equal(e.source.modelCommit, 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd');
});

test('Yu receipt retains complete modes, skill ranks, dependencies and exact Unity IDs', () => {
  assert.equal(e.source.bundles.length, 5);
  for (const key of ['tokens', 'tokenModels', 'officialTokenSkeletonBindings', 'projectiles']) assert.deepEqual(e[key], {});
  assert.deepEqual(e.tables.tokens, {}); assert.deepEqual(e.tables.tokenSkills, {});
  assert.deepEqual(Object.keys(e.tables.skills), [1, 2, 3].map(n => `skchr_yu_${n}`));
  assert.ok(Object.values(e.tables.skills).every(s => s.levels.length === 10));
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.templates), Object.keys(e.originalTemplates));
  assert.equal(Object.keys(e.templates).length, 16);
  assert.deepEqual(Object.keys(e.tables.ranges), ['0-1', 'x-1']);
  const rows = [...Object.values(e.characters), ...Object.values(e.skills)].flat();
  assert.equal(rows.flatMap(r => r.components).length, 131);
  for (const r of rows) {
    assert.equal(r.components.length, new Set(r.components.map(c => c.pathId)).size);
    assert.ok(r.components.every(c => typeof c.pathId === 'string'));
  }
  assert.ok(nodes(e, n => Object.hasOwn(n, 'm_PathID')).every(n => typeof n.m_PathID === 'string'));
});

test('four native attack modes preserve physical/Arts type and source targeting', () => {
  const ctrl = component('-835087265059286');
  assert.equal(ctrl._buildCondition.buildableType, 1);
  assert.equal(ctrl._buildCondition.needSpecifyDirection, 1);
  assert.equal(ctrl._occupiedRemainingCharacterCnt, 1);
  const attacks = ctrl._modes.map(p => component(component(p.m_PathID)._attack.m_PathID));
  assert.deepEqual(attacks.map(a => a._animKey), ['Attack', 'Skill_1', 'Skill_2', 'Skill_3_Loop']);
  assert.deepEqual(attacks.map(a => a._damageType), [1, 1, 2, 1]);
  assert.deepEqual(attacks.map(a => a._selectTargetSource), [2, 2, 2, 1]);
  assert.ok(attacks.every(a => a._waitForAttackEvent === 1 && a._maxAnimScale === -1));
  const selector = component(attacks[3]._selector.m_PathID);
  assert.equal(selector._limitTargetNum, 1); assert.equal(selector._maxNum, 1);
  assert.equal(selector._targetMotion, 1);
});

test('native blocked-enemy damage retains half-second first trigger and source lifetime', () => {
  const check = component('-5466566168720789974');
  assert.equal(check._blockMinCnt, 1); assert.equal(check._blockMaxCnt, -1); assert.equal(check._useBlockAsMin, 1);
  const buff = check._buffsToBlockee[0];
  assert.equal(buff.templateKey, 'yu_t_1[enemy]'); assert.equal(buff.triggerInterval, 1);
  assert.equal(buff.firstTriggerInterval, .5); assert.equal(buff.waitFirstTriggerInterval, 1);
  assert.equal(buff.independentCharacterSource, 1); assert.equal(buff.stripBlackboardParamsWithBuffKey, 1);
  const sequence = e.templates['yu_t_1[enemy]'].eventToActions.ON_BUFF_TRIGGER;
  assert.deepEqual(sequence.map(a => a.$type.split('+').at(-1).split(',')[0]),
    ['ApplyElementDamage', 'AlwaysNext', 'AdvancedApplyDamage', 'CreateEffect']);
  assert.equal(sequence[0]._elementDamageType, 'FIRE'); assert.equal(sequence[0]._epDamageScale, 'ep_damage_ratio');
  assert.equal(sequence[2]._damageType, 'MAGICAL'); assert.equal(sequence[2]._attackType, 'BUFF');
  assert.equal(sequence[2]._emitSourceOnCalculateDamage, false);
});

test('blocking Sanctuary uses derived buffs and ends when the block condition ends', () => {
  const parent = e.templates['yu_t_1[self]'];
  assert.equal(action(parent, 'CheckBlocked').length, 1);
  const remove = action(parent, 'FinishDerivedBuffById')[0];
  assert.equal(remove._buffKey, 'yu_t_1[damage_resistance]');
  const derived = action(e.templates['yu_t_1[damage_resistance]'], 'CreateBuff')[0];
  assert.equal(derived._buff.buffKey, 'damage_resistance[inf]');
  assert.equal(derived._isDerivedBuff, true); assert.equal(derived._finishDerivedBuffIfParentFinish, true);
  assert.equal(e.buffDatabase['damage_resistance[inf]'].lifeTimeType, 'INFINITY');
  const scale = action(e.templates.damage_resistance, 'DamageScale')[0];
  assert.equal(scale._damageMask, 'PHYSICAL_AND_MAGICAL'); assert.equal(scale._isStackable, false);
});

test('second-talent table count and serialized checker count remain separate facts', () => {
  const candidates = e.tables.character.talents[1].candidates;
  assert.deepEqual(candidates.map(c => bb(c.blackboard).cnt), [4, 4]);
  assert.deepEqual(candidates.map(c => bb(c.blackboard).ep_heal_ratio), [.015, .02]);
  assert.deepEqual(candidates.map(c => bb(c.blackboard).hp_recovery_per_sec_by_max_hp_ratio), [.015, .02]);
  const checkers = owner.filter(c => '_professionMask' in c.data && '_minCount' in c.data).map(c => c.data);
  assert.equal(checkers.length, 4);
  assert.ok(checkers.every(c => c._minCount === 5 && c._professionMask === 639
    && !c._checkMaxDifferentProfessionCount && !c._checkMaxSameProfessionCount));
});

test('elemental recovery tracks current MAX_HP independently of HP regeneration', () => {
  const trigger = e.templates['yu_t_2[heal]'].eventToActions.ON_BUFF_TRIGGER;
  assert.equal(trigger[0]._attributeType, 'MAX_HP'); assert.equal(trigger[0]._scaleVar, 'ep_heal_ratio');
  assert.equal(trigger[1]._blackboardKey, 'ep_recovery_per_sec');
  assert.equal(trigger[2]._attributeType, 'EP_RECOVERY_PER_SEC'); assert.equal(trigger[2]._formulaType, 'ADDITION');
  const buff = component('-1850537544557547990')._buffs[0];
  assert.equal(buff.triggerInterval, 0.20000000298023224); assert.equal(buff.waitFirstTriggerInterval, 0);
  assert.deepEqual(buff.attributes.attributeModifiers.map(m => [m.attributeType, m.formulaItem]), [[19, 0]]);
});

test('all thirty skill ranks retain defensive/time SP, source duration and selected M3 values', () => {
  for (const [n, s] of Object.values(e.tables.skills).entries()) {
    for (const [i, rank] of s.levels.entries()) {
      assert.equal(rank.spData.spType, n === 0 ? 'INCREASE_WHEN_TAKEN_DAMAGE' : 'INCREASE_WITH_TIME');
      assert.equal(rank.spData.maxChargeTime, 1); assert.ok(rank.spData.spCost > 0);
      assert.equal(rank.duration, n === 2 ? [40, 40, 40, 41, 41, 41, 42, 43, 44, 45][i] : [30, 20][n]);
    }
  }
  assert.deepEqual(Object.values(e.tables.skills).map(s => [s.levels.at(-1).spData.spCost, s.levels.at(-1).spData.initSp]),
    [[16, 0], [26, 20], [55, 42]]);
  assert.deepEqual(bb(e.tables.skills.skchr_yu_2.levels.at(-1).blackboard),
    { max_hp: 1.6, atk: 2.9, atk_scale: 1, block_cnt: 2 });
});

test('S1 separates persistent passive taunt from active inverse Burn and stat modifiers', () => {
  const ability = skillComponent(1, '-8761052572476042498');
  assert.deepEqual(ability._passiveBuffs[0].attributes.attributeModifiers.map(m => [m.attributeType, m.formulaItem]), [[20, 0]]);
  assert.equal(ability._passiveBuffs[0].lifeTimeType, 2);
  assert.deepEqual(ability._buffs[0].attributes.attributeModifiers.map(m => [m.attributeType, m.formulaItem]), [[0, 1], [2, 1]]);
  assert.equal(bb(ability._buffs[0].blackboard).mode, 1);
  const burn = action(e.templates['yu_s_1[inverse_damage]'], 'ApplyElementDamage')[0];
  assert.equal(burn._targetType, 'MODIFIER_SOURCE'); assert.equal(burn._sourceType, 'BUFF_OWNER');
  assert.equal(burn._elementDamageType, 'FIRE'); assert.equal(burn._epDamageScale, 'ep_damage_ratio');
});

test('S2 burst includes all selected ground inputs and delays teleport separately from damage', () => {
  const hit = skillComponent(2, '954501052673400092');
  assert.equal(hit._damageType, 2); assert.equal(hit._selectTargetSource, 1); assert.equal(hit._selectTargetTiming, 1);
  assert.equal(hit._animKey, 'Skill_2'); assert.equal(hit._waitForAttackEvent, 1);
  const sel = skillComponent(2, hit._selector.m_PathID);
  assert.equal(sel._targetMotion, 1); assert.equal(sel._limitTargetNum, 0);
  const tp = hit._activeBuffs[0];
  assert.equal(tp.templateKey, 'yu_s_2[try_tp]'); assert.equal(tp.triggerCnt, 1);
  assert.equal(tp.triggerInterval, 0.12999999523162842); assert.equal(tp.disableOverride, 1);
});

test('S2 teleport preserves immunity, ground reachability, blocker release and random offsets', () => {
  const tree = e.templates['yu_s_2[try_tp]'];
  assert.deepEqual(action(tree, 'CheckContainsBuff')[0]._buffKeys, ['immune_shu_blink', 'immune_yu_blink']);
  assert.deepEqual(action(tree, 'CheckAbnormalFlags')[0]._abnormalFlags, ['UNMOVABLE_PRIVATE']);
  assert.equal(action(tree, 'CheckMotionMode')[0]._mode, 'WALK');
  assert.equal(action(tree, 'CheckEnemyRealReachableToTile')[0]._avoidObstacleLike, true);
  const tp = action(tree, 'ForceSetToTilePosition')[0];
  assert.equal(tp._disableCurrentStillPull, true); assert.equal(tp._releaseFromBlocker, true);
  assert.equal(tp._findNearestPassableTile, false);
  assert.equal(tp._randomOffset, 0.15000000596046448); assert.equal(tp._randomOffsetInnerRange, 0.30000001192092896);
});

test('S3 source wall retains all four direction boundaries and excludes Yu and enemy sources', () => {
  const tree = e.templates['yu_s_3[ally]'];
  const filter = action(tree, 'FilterDamageModifer')[0];
  assert.equal(filter._damageMask, 'MAGICAL'); assert.equal(filter._filterAttackType, false);
  const equal = action(tree, 'IfTargetEqual')[0];
  assert.equal(equal._target1, 'BUFF_SOURCE'); assert.equal(equal._target2, 'MODIFIER_SOURCE');
  const direction = action(tree, 'SwitchDirection')[0];
  for (const side of ['right', 'left', 'up', 'down']) {
    const comparisons = action(direction[`_${side}Nodes`], 'CheckTargetGridPositionRowOrColWithBB');
    assert.deepEqual(comparisons.map(c => c._compareType), ['right', 'up'].includes(side)
      ? ['LE', 'GT', 'GT', 'LE'] : ['LT', 'GE', 'GE', 'LT']);
    assert.ok(comparisons.every(c => c._checkRow === ['up', 'down'].includes(side)));
  }
  assert.ok(action(tree, 'ApplyElementDamage').every(a => a._elementDamageType === 'FIRE'
    && a._sourceType === 'BUFF_SOURCE' && a._targetType === 'MODIFIER_TARGET'));
});

test('S3 projectile wall and ally aura retain different geometry and detach/disappearance cleanup', () => {
  const wall = skillComponent(3, '1077596554295986484');
  assert.equal(wall._isHorizontalInfinite, 1); assert.equal(wall._horizonOffsetFront, .5);
  assert.equal(wall._horizonSize, 0.30000001192092896);
  assert.equal(skillComponent(3, '1616396259393751348')._targetSide, 2);
  assert.equal(skillComponent(3, '4448953952700942644')._eliminateOnEnter, 1);
  const aura = skillComponent(3, '8793779211263428916');
  assert.equal(aura._removeBuffWhenAbilityDetached, 1); assert.equal(aura._clearBuffsWhenDisappear, 1);
  assert.equal(aura._listenUnitRebornEvent, 1); assert.equal(aura._excludeReborningEntity, 1);
  assert.equal(action(e.templates['yu_s_3[switch_mode]'], 'InterruptAbility')[0]._abilityName, 'Aura');
});

test('original facing skeletons retain exact hit events, Start alias and missing Back death', () => {
  for (const face of ['Front', 'Back']) {
    const model = e.models[ID][face];
    for (const key of ['Attack', 'Skill_1', 'Skill_2', 'Skill_3_Loop'])
      assert.equal(model.eventPayloads[key][0].time, .5);
    assert.equal(model.eventPayloads.Skill_3_Begin[0].time, 0.4333333373069763);
    assert.equal(model.eventPayloads.Start[0].time, 0.1666666716337204);
    assert.equal(e.officialSkeletonBindings[ID][face].sha256, model.sha256);
    assert.equal(e.officialSkeletonBindings[ID][face].byteLength, model.bytes);
  }
  const animator = e.chararts[ID].find(c => c.data._animations).data;
  assert.equal(animator._animations.find(a => a.animKey === 'Born').animName, 'Start');
  assert.equal(e.models[ID].Front.durations.Die, 1); assert.equal(e.models[ID].Back.durations.Die, undefined);
  assert.deepEqual(animator._mixSettings.map(m => [m.sourceAnimName, m.targetAnimName, m.mixAnimName]),
    [['Skill_3_Idle', 'Idle', 'Skill_3_End'], ['Skill_3_Loop', 'Idle', 'Skill_3_End']]);
});
