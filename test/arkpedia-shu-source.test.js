// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-shu-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';

const ID = 'char_2025_shu';
const components = rows => rows.flatMap(r => r.components);
const owner = components(e.characters[ID]);
const component = id => owner.find(c => c.pathId === id).data;
const skillComponent = (n, id) => components(e.skills[`skchr_shu_${n}`]).find(c => c.pathId === id).data;
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

test('Shu source remains held without changing playable coverage or fidelity claims', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(REGULAR_OPERATORS[ID], undefined); assert.equal(data.operators[ID], undefined);
  for (const key of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[key], false);
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.nativeClient, '26-09-23-17-49-43_b9cc4a');
  assert.equal(e.source.modelCommit, 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd');
  assert.equal(e.source.buffDatabase.gitBlob.sha, 'de9e0777610e3be81185ec45841f3e007b51ccbf');
});

test('Shu retains complete native component, skill-rank and dependency groups', () => {
  assert.equal(e.source.bundles.length, 5);
  for (const key of ['tokens', 'tokenModels', 'officialTokenSkeletonBindings', 'projectiles']) assert.deepEqual(e[key], {});
  assert.deepEqual(e.tables.tokens, {}); assert.deepEqual(e.tables.tokenSkills, {});
  assert.deepEqual(Object.keys(e.tables.skills), [1, 2, 3].map(n => `skchr_shu_${n}`));
  assert.ok(Object.values(e.tables.skills).every(s => s.levels.length === 10));
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.templates), Object.keys(e.originalTemplates));
  assert.equal(Object.keys(e.templates).length, 17);
  assert.deepEqual(Object.keys(e.tables.ranges), ['0-1', 'x-1', 'x-2', 'x-4', 'x-5']);
  let count = 0;
  for (const rs of [...Object.values(e.characters), ...Object.values(e.skills)]) {
    assert.equal(rs.length, new Set(rs.map(r => r.pathId)).size);
    for (const r of rs) {
      assert.equal(r.components.length, new Set(r.components.map(c => c.pathId)).size);
      for (const c of r.components) { assert.equal(typeof c.pathId, 'string'); count++; }
    }
  }
  assert.equal(count, 112);
});

test('native owner modes separate physical attacks, S2 healing and S3 combined abilities', () => {
  const ctrl = component('-5441914612618988253');
  assert.equal(ctrl._buildCondition.buildableType, 1);
  assert.equal(ctrl._buildCondition.needSpecifyDirection, 1);
  assert.equal(ctrl._occupiedRemainingCharacterCnt, 1);
  const modes = ctrl._modes.map(p => component(p.m_PathID));
  assert.equal(modes.length, 3);
  const ordinary = component(modes[0]._attack.m_PathID);
  assert.equal(ordinary._damageType, 1); assert.equal(ordinary._animKey, 'Attack_1');
  assert.equal(ordinary._waitForAttackEvent, 1);
  const heal = component(modes[1]._attack.m_PathID);
  assert.equal(heal._ignoreHealFree, 0); assert.equal(heal._maxAnimScale, 1);
  assert.equal(heal._animKey, 'Attack');
  assert.deepEqual(component('6044950186018567459')._replaceAnimPairs, [
    { fromAnimKey: 'Idle', toAnimKey: 'Skill_2_Idle' },
    { fromAnimKey: 'Attack', toAnimKey: 'Skill_2_Attack' },
  ]);
  const combined = component(modes[2]._attack.m_PathID);
  const abilities = combined._abilities.map(p => component(p.m_PathID));
  assert.deepEqual(abilities.map(a => a._animKey), ['Skill_3_Attack_1', 'Skill_3_Attack_2']);
  assert.equal(abilities[0]._damageType, 1); assert.equal(abilities[1]._ignoreHealFree, 0);
  assert.ok(abilities.every(a => a._waitForAttackEvent === 1));
});

test('all thirty ranks retain source SP rules, S1 charges and duration', () => {
  for (const [n, s] of Object.values(e.tables.skills).entries()) {
    for (const rank of s.levels) {
      assert.equal(rank.spData.spType, 'INCREASE_WITH_TIME');
      assert.equal(rank.spData.maxChargeTime, n === 0 ? bb(rank.blackboard).ct : 1);
      assert.ok(rank.spData.spCost > 0);
      assert.equal(rank.duration, [0, 25, 30][n]);
    }
  }
  assert.deepEqual(Object.values(e.tables.skills).map(s => {
    const { spCost, initSp, maxChargeTime } = s.levels.at(-1).spData;
    return [spCost, initSp, maxChargeTime];
  }), [[4, 0, 3], [25, 20, 1], [45, 30, 1]]);
});

test('S1 uses the original heal clip and cancels or restores SP for invalid targets', () => {
  const holder = skillComponent(1, '5135447623683147884');
  assert.equal(holder._cancelIfSearchTargetFailed, 1); assert.equal(holder._recoverSpIfTargetDead, 1);
  assert.equal(holder._allowSpRecoveryWhenAffecting, 0);
  const heal = skillComponent(1, '1176209197441157228');
  assert.equal(heal._animKey, 'Attack_2'); assert.equal(heal._endAnimKey, 'Idle');
  assert.equal(heal._waitForAttackEvent, 1); assert.equal(heal._ignoreHealFree, 0);
  assert.equal(bb(e.tables.skills.skchr_shu_1.levels.at(-1).blackboard).heal_scale, 1.8);
});

test('S2 selected blackboard and modifier formulas retain two-target healing and added interval/block', () => {
  assert.deepEqual(bb(e.tables.skills.skchr_shu_2.levels.at(-1).blackboard), {
    atk: 1.2, extra_extend_scale: 1.5, block_cnt: 1, 'attack@max_target': 2, base_attack_time: 1.3,
  });
  const selector = component('2688464648485172515');
  assert.equal(selector._targetSide, 1); assert.equal(selector._maxTargetKey, 'max_target');
  assert.equal(selector._limitTargetNum, 1); assert.equal(selector._ignoreHealFree, 0);
  const buff = skillComponent(2, '7777792923929471108')._buffs.find(b => b.templateKey === 'shu_s_2');
  assert.deepEqual(buff.attributes.attributeModifiers.map(m => [m.attributeType, m.formulaItem]), [[1, 1], [5, 0], [8, 0]]);
  assert.equal(bb(buff.blackboard).mode, 1);
  const refresh = action(e.templates.shu_s_2, 'RefreshAttachListenerToTileAbility');
  assert.equal(refresh.length, 2); assert.ok(refresh.every(a => a._abilityName === 'DoFarm'));
  const reset = action(e.templates.shu_s_2.eventToActions.ON_BUFF_FINISH, 'ModifyAbilityBlackboard')[0];
  assert.equal(reset._blackboardKeys, 'extra_extend_scale'); assert.equal(reset._value, 1);
});

test('Sowing is triggered by healing and retains exact cross tile and birth range inputs', () => {
  const events = e.templates.shu_t_1.eventToActions;
  assert.equal(action(events.ON_OUTPUT_MODIFIER, 'IsHeal').length, 1);
  const sow = action(events.ON_OUTPUT_MODIFIER, 'TriggerAttachListenerToTileAbility')[0];
  assert.equal(sow._abilityName, 'DoFarm'); assert.equal(sow._targetType, 'MODIFIER_TARGET');
  assert.equal(sow._rangeId, 'x-5');
  const originalSow = action(e.originalTemplates.shu_t_1, 'TriggerAttachListenerToTileAbility');
  assert.ok(originalSow.every(a => a._useTargetRootTile === false && a._exceptTargetRootTile === false));
  assert.deepEqual(e.tables.ranges['x-5'].grids.map(g => [g.row, g.col]).sort(),
    [[-1, 0], [0, -1], [0, 0], [0, 1], [1, 0]].sort());
  const birth = action(events.ON_BUFF_START, 'TriggerAttachListenerToTileAbility')[0];
  assert.equal(birth._rangeIdKey, 'born_range_id'); assert.equal(birth._targetType, 'BUFF_OWNER');
  const farm = component('-3350176013360532189');
  assert.equal(farm._metadata.namedAsAlias, 'DoFarm'); assert.equal(farm._timeMode, 2);
  assert.equal(farm._selector.m_PathID, '1915937978337948963');
});

test('Sowing regeneration and Sanctuary retain source lifetime and owner cleanup linkage', () => {
  const t = e.templates['shu_farm_buff[char]'];
  const link = action(t, 'AttachAsDerivedBuffById')[0];
  assert.equal(link._buffKey, 'shu_t_1'); assert.equal(link._finishDerivedBuffIfParentFinish, true);
  const sanctuary = action(t, 'CreateBuffById')[0];
  assert.equal(sanctuary._buffKey, 'damage_resistance[inf]'); assert.equal(sanctuary._isDerivedBuff, true);
  const regen = action(t, 'CreateBuff')[0]._buff;
  assert.equal(regen.lifeTimeType, 'INFINITY');
  assert.deepEqual(regen.attributes.attributeModifiers.map(m => [m.attributeType, m.formulaItem]), [['HP_RECOVERY_PER_SEC', 'ADDITION']]);
  assert.deepEqual(e.tables.character.talents[0].candidates.map(c => Object.values(bb(c.blackboard))),
    [[40, .05], [45, .07], [70, .1], [75, .12]]);
});

test('profession auras and Sui deck bonus retain distinct count and selection checks', () => {
  const different = component('-634519851075144413'), same = component('7779170618748532003');
  assert.equal(different._minCount, 3); assert.equal(same._minCount, 3);
  assert.equal(different._checkMaxDifferentProfessionCount, 1); assert.equal(different._checkMaxSameProfessionCount, 0);
  assert.equal(same._checkMaxDifferentProfessionCount, 0); assert.equal(same._checkMaxSameProfessionCount, 1);
  assert.ok([different, same].every(c => c._professionMask === 639));
  const deck = component('-3066102878310402781');
  assert.equal(deck._options.selector.filterTag, 'sui'); assert.equal(deck._options.minCntToTrig, 4);
  assert.equal(deck._options.useOtherSelectorWhenGetBuff, 1);
  assert.equal(deck._options.selectorWhenGetBuff.filterTag, '');
  assert.equal(deck._deckBuffs[0].buff.templateKey, 'modify_sp[trigger]');
  assert.deepEqual(bb(e.tables.character.talents[1].candidates[0].blackboard),
    { max_hp: .12, attack_speed: 12, atk: .12, interval: 4, sp: 1 });
});

test('S3 preserves enemy entry, departure and capped ally attack/speed refresh', () => {
  const enter = e.templates['shu_s_3[enemy][enter]'].eventToActions;
  const count = action(enter.ON_BUFF_START, 'AddBuffBlackboard')[0];
  assert.equal(count._blackboardKey, 'enemy_count'); assert.equal(count._addition, 1);
  assert.equal(count._targetType, 'BUFF_SOURCE');
  const leave = action(e.templates['shu_s_3[enemy][leave]'], 'FinishBuffsById')[0];
  assert.equal(leave._buffKey, 'shu_s_3[enemy][enter]');
  const cap = action(e.templates.shu_s_3, 'CalculateBlackboardValueViaParams').find(a => a._outputKey === 'current_stack');
  assert.equal(cap._inputKey, 'enemy_count'); assert.equal(cap._maxValueKey, 'e_max_stack_cnt');
  const modifiers = action(e.templates['shu_s_3[in_range]'], 'AttributeModifierWithBB');
  assert.deepEqual(modifiers.map(a => [a._attributeType, a._formulaType]), [['ATK', 'MULTIPLIER'], ['ATTACK_SPEED', 'ADDITION']]);
  const sync = action(e.templates.shu_s_3.eventToActions.ON_BUFF_LATE_ENABLE, 'RefreshAttachListenerToTileAbility')[0];
  assert.equal(sync._abilityName, 'EnemyListener'); assert.equal(sync._syncAbilityName, 'DoFarm');
});

test('S3 teleport preserves marked root tile and exact threshold/position flags', () => {
  const t = e.templates['shu_s_3[enemy][mark]'];
  const mark = action(t, 'AssignRootTileToBB')[0];
  assert.equal(mark._colKey, 'start_col'); assert.equal(mark._rowKey, 'start_row');
  const threshold = action(t.eventToActions.ON_OWNER_ROOT_TILE_CHANGED, 'FilterRootTileOffset')[0];
  assert.equal(threshold._anotherKeyToCompare, 'max_distance'); assert.equal(threshold._condType, 'GE');
  const teleport = action(t.eventToActions.ON_BUFF_TRIGGER, 'ForceSetToTilePosition')[0];
  assert.equal(teleport._colKey, 'start_col'); assert.equal(teleport._rowKey, 'start_row');
  assert.equal(teleport._disableCurrentStillPull, true);
  assert.equal(teleport._findNearestPassableTile, false); assert.equal(teleport._releaseFromBlocker, false);
  assert.equal(bb(e.tables.skills.skchr_shu_3.levels.at(-1).blackboard).max_distance, 2);
  const link = action(t, 'AttachAsDerivedBuffById')[0];
  assert.equal(link._buffKey, 'shu_s_3'); assert.equal(link._finishDerivedBuffIfParentFinish, true);
  assert.equal(action(t.eventToActions.ON_BEFORE_DISAPPEAR, 'FinishBuff').length, 1);
});

test('native facing clips retain full-precision hit events and missing-back death boundary', () => {
  const front = e.models[ID].Front, back = e.models[ID].Back;
  for (const face of ['Front', 'Back']) {
    const model = e.models[ID][face];
    for (const name of ['Attack_1', 'Attack_2', 'Skill_2_Attack', 'Skill_3_Attack_1', 'Skill_3_Attack_2']) {
      assert.deepEqual(model.eventPayloads[name], [{ time: .5333333611488342, name: 'OnAttack', int: 0, float: 0, string: '' }]);
    }
    assert.equal(e.officialSkeletonBindings[ID][face].sha256, model.sha256);
    assert.equal(typeof e.officialSkeletonBindings[ID][face].textAssetPathId, 'string');
  }
  assert.equal(front.durations.Die, 1); assert.equal(back.durations.Die, undefined);
  assert.equal(front.durations.Skill_3_End, .5); assert.equal(back.durations.Skill_3_End, .167);
  const animator = e.chararts[ID].find(c => c.data._animations).data;
  assert.equal(animator._animations.find(a => a.animKey === 'Born').animName, 'Start');
  assert.equal(animator._animations.find(a => a.animKey === 'Skill_2_Attack').animName, 'Skill_2_Attack');
});
