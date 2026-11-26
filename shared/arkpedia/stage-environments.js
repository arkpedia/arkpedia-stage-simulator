// SPDX-License-Identifier: GPL-3.0-or-later
import { SIGHT_ENVIRONMENT, sightNativeReviewed } from './stage-sight.js';
import native from '../../data/arkpedia-environment-native-source.json' with { type: 'json' };
import { dangerNativeReviewed, compileStageDanger } from './stage-danger.js';
import { PARASITIC_ENVIRONMENT, parasiticNativeReviewed, compileParasiticEnvironment } from './stage-parasitic.js';

export function stageEnvironmentEnemyDependencies(environments) {
  return [...new Set(environments.filter(e => e.kind === PARASITIC_ENVIRONMENT && e.hosts?.length).map(e => e.enemy))];
}

// `mainline14_enemy_sign_effect` (14-20): presentation only. The generic global-buff holder gives every enemy the buff
// `[g]mainline14_enemy_sign_effect` (no attributes, no trigger). On start it creates `mainline14_enemy_sign_effect[core]`
// on its owner: template `empty`, no attributes, held for life, effect `enemy_common_sign_01` (a marker over the unit).
// With `filter_id` > 0 only the nine listed enemies get it; otherwise every enemy does. Nothing reads the buff key.
export const ENEMY_SIGN_ENVIRONMENT = 'mainline14_enemy_sign_effect';
const ENEMY_SIGN_IDS = ['enemy_1506_patrt', 'enemy_1542_wdslm', 'enemy_1542_wdslm_2', 'enemy_1542_wdslm_3', 'enemy_1542_wdslm_4',
  'enemy_1547_blord', 'enemy_1547_blord_2', 'enemy_1501_demonk', 'enemy_1081_sotisd'];
const emptyAttributes = a => !!a && ['abnormalFlags', 'abnormalImmunes', 'abnormalAntis', 'abnormalCombos', 'abnormalComboImmunes', 'attributeModifiers']
  .every(k => Array.isArray(a[k]) && a[k].length === 0) && Object.keys(a).length === 6;
export function enemySignNativeReviewed(evidence = native) {
  const rows = evidence.prefabs?.[ENEMY_SIGN_ENVIRONMENT], c = rows?.[0]?.data, buff = c?._buffs?.[0];
  const holder = evidence.prefabs?.periodic_damage?.[0]?.data?.m_Script?.m_PathID;
  const events = evidence.templates?.['[g]mainline14_enemy_sign_effect']?.eventToActions, start = events?.ON_BUFF_START, branch = start?.[0];
  const type = n => String(n?.$type ?? '').replace('Torappu.Battle.Action.Nodes+', '').replace(', Assembly-CSharp', '');
  const core = n => type(n) === 'CreateBuff' && n._buffOwner === 'BUFF_OWNER' && n._isDerivedBuff === false
    && n._buff.buffKey === 'mainline14_enemy_sign_effect[core]' && n._buff.templateKey === 'empty' && emptyAttributes(n._buff.attributes)
    && n._buff.lifeTimeType === 'INFINITY' && n._buff.overrideEffectKey === 'enemy_common_sign_01' && n._buff.blackboard.length === 0
    && n._buff.triggerInterval === -1 && n._buff.loadFromDB === false;
  return rows?.length === 1 && typeof holder === 'string' && c.m_Script?.m_PathID === holder && c.m_Enabled === 1
    && c._key === '' && c._sourceType === 0 && c._overrideCameraEffect === '' && c._deckBuffs?.length === 0 && c._buffs?.length === 1
    && c._options.targetSide === 2 && c._options.targetMotion === 3 && c._options.targetCategory === 1
    && buff.buffKey === '[g]mainline14_enemy_sign_effect' && buff.templateKey === '[g]mainline14_enemy_sign_effect'
    && emptyAttributes(buff.attributes) && buff.triggerInterval === -1 && buff.blackboard.length === 0 && buff.overrideEffectKey === ''
    && JSON.stringify(Object.keys(events ?? {})) === '["ON_BUFF_START"]' && start.length === 1 && type(branch) === 'IfElse'
    && type(branch._conditionNode) === 'FilterByBlackboardValue' && branch._conditionNode._blackboardKey === 'filter_id'
    && branch._conditionNode._valueToCompare === 0 && branch._conditionNode._condType === 'GT' && branch._conditionNode._targetType === 'BUFF_OWNER'
    && branch._succeedNodes.length === 2 && type(branch._succeedNodes[0]) === 'CheckEnemyId' && branch._succeedNodes[0]._isUnset === false
    && branch._succeedNodes[0]._loadIdFromBb === false && JSON.stringify(branch._succeedNodes[0]._filterIds) === JSON.stringify(ENEMY_SIGN_IDS)
    && core(branch._succeedNodes[1]) && branch._failNodes.length === 1 && core(branch._failNodes[0])
    && JSON.stringify(evidence.templates.empty?.eventToActions) === '{}';
}

export function environmentNativeReviewed(key, evidence = native) {
  if (key === PARASITIC_ENVIRONMENT) return parasiticNativeReviewed(evidence);
  if (key === SIGHT_ENVIRONMENT) return sightNativeReviewed(evidence);
  if (key === 'legion_mode_enemy_boost') return dangerNativeReviewed(evidence);
  const rows = evidence.prefabs?.[key], c = rows?.[0]?.data, buff = c?._buffs?.[0];
  if (key === ENEMY_SIGN_ENVIRONMENT) return enemySignNativeReviewed(evidence);
  // This is a specialized timed-wave controller, despite its empty buff list.
  if (key === 'strife_mode_feature') return rows?.length === 1
    && c?.m_Script?.m_PathID === '257254889598074357' && c.m_Enabled === 1
    && c._key === '' && c._sourceType === 0 && c._overrideCameraEffect === ''
    && c._buffs?.length === 0 && c._deckBuffs?.length === 0 && c._initBlackboard?.length === 0
    && !!c._options && Object.keys(c._options).sort().join(',') === [
      'targetSide', 'targetMotion', 'targetCategory', 'enableAdvancedOptions', 'ignoreTargetFree',
      'ignoreAllyTargetFree', 'ignoreHealFree', 'ignoreMotionMode', 'ignoreTargetSide',
      'excludeSomeAbnormalFlags', 'containSomeAbnormalFlags', 'excludeAbnormalFlag', 'containAbnormalFlag',
      'purposeMask', 'professionMask', 'checkUnitType', 'unitTypeMask', 'onlyIgnoreSomeOfTargetFreeCase',
      'abnormalFlag', 'abnormalCombo',
    ].sort().join(',') && Object.values(c._options).every(value => value === 0);
  if (rows?.length !== 1 || c?._sourceType !== 0 || c._deckBuffs?.length !== 0 || c._buffs?.length !== 1
    || c._options.targetSide !== (key === 'kill_to_add_cost' ? 2 : 1) || c._options.targetMotion !== 3
    || c._options.targetCategory !== 1 || c._options.enableAdvancedOptions !== 0 || c._options.ignoreTargetFree !== 0
    || buff?.isSilenceable !== 0 || buff.isStunnable !== 0 || buff.isFreezable !== 0 || buff.lifeTimeType !== 2) return false;
  if (key === 'periodic_damage') {
    const actions = evidence.templates.periodic_damage?.eventToActions.ON_BUFF_TRIGGER, a = actions?.[0];
    return buff.templateKey === 'periodic_damage' && buff.triggerLifeType === 2 && buff.waitFirstTriggerInterval === 1
      && buff.triggerInterval === 1 && buff.disableOverride === 1 && actions?.length === 1
      && a.$type.endsWith('NoSourceDamage, Assembly-CSharp') && a._damageType === 'PURE' && a._damageKey === 'damage'
      && a._ignoreForSp && a._isEnvDamage && !a._damageWithoutModify && a._attackType === 'BUFF' && !a._isUndeadable;
  }
  if (key === 'kill_to_add_cost') {
    const actions = evidence.templates.die_to_add_cost?.eventToActions.ON_OWNER_KILLED, a = actions?.[0];
    return buff.templateKey === 'die_to_add_cost' && actions?.length === 1 && a.$type.endsWith('ModifyCost, Assembly-CSharp')
      && a._sourceType === 'SOURCE' && a._blackboardKey === 'cost';
  }
  if (key === 'character_in_magiccircuit_env') {
    const events = evidence.templates.character_in_magiccircuit_env?.eventToActions;
    const start = events?.ON_BUFF_START, enter = events?.ON_ENTER_MAGICCIRCUIT, leave = events?.ON_LEAVE_MAGICCIRCUIT;
    const child = enter?.[0]?._buff, modifier = child?.attributes.attributeModifiers;
    return buff.templateKey === key && buff.attributes.attributeModifiers.length === 1
      && buff.attributes.attributeModifiers[0].attributeType === 30 && buff.attributes.attributeModifiers[0].formulaItem === 1
      && buff.attributes.attributeModifiers[0].loadFromBlackboard === 1
      && start?.length === 2 && start[0].$type.endsWith('CheckCharacterInMagicCircuit, Assembly-CSharp')
      && start[0]._targetType === 'BUFF_OWNER' && JSON.stringify(start[1]) === JSON.stringify(enter?.[0])
      && enter?.length === 1 && enter[0].$type.endsWith('CreateBuff, Assembly-CSharp') && enter[0]._isDerivedBuff
      && child.buffKey === 'character_in_magiccircuit[normal]' && child.overrideType === 'UNIQUE' && child.lifeTimeType === 'INFINITY'
      && modifier?.length === 1 && modifier[0].attributeType === 'SP_RECOVER_RATIO' && modifier[0].formulaItem === 'MULTIPLIER'
      && modifier[0].loadFromBlackboard && leave?.length === 1 && leave[0].$type.endsWith('FinishDerivedBuff, Assembly-CSharp');
  }
  return false;
}

/** Original global-buff instances are mandatory semantics, not presentation.
 * Unknown modes stay explicit blockers until their shared controller exists. */
export function compileStageEnvironments(instances, evidence = native) {
  if (instances == null) return [];
  if (!Array.isArray(instances)) throw Error('Malformed original stage environments');
  const seen = new Set();
  return instances.map(instance => {
    const key = instance?.prefabKey;
    if (seen.has(key) || !environmentNativeReviewed(key, evidence)) throw Error(`Unsupported stage environment: ${key}`);
    seen.add(key);
    if (Object.keys(instance).some(k => !['prefabKey', 'blackboard', 'overrideCameraEffect', 'passProfessionMaskFlag', 'professionMask', 'playerSideMask', 'useExtraData'].includes(k))
      || ![undefined, false].includes(instance.passProfessionMaskFlag) || ![undefined, 'NONE'].includes(instance.professionMask)
      || ![undefined, false].includes(instance.useExtraData)
      || ![undefined, 'ALL'].includes(instance.playerSideMask) || instance.overrideCameraEffect != null)
      throw Error(`Unsupported stage environment targeting: ${key}`);
    if (key === 'legion_mode_enemy_boost') return compileStageDanger(instance.blackboard);
    if (key === SIGHT_ENVIRONMENT) {
      if (instance.blackboard != null && instance.blackboard.length) throw Error('Unsupported sight parameters');
      return { kind: SIGHT_ENVIRONMENT, interval: .5 };
    }
    if (key === PARASITIC_ENVIRONMENT) return compileParasiticEnvironment(instance.blackboard);
    if (key === ENEMY_SIGN_ENVIRONMENT) {
      const rows = instance.blackboard;
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0].key !== 'filter_id' || ![0, 1].includes(rows[0].value)
        || rows[0].valueStr != null && rows[0].valueStr !== '') throw Error('Unsupported enemy sign parameters');
      return { kind: key, presentationOnly: true, enemies: rows[0].value > 0 ? [...ENEMY_SIGN_IDS] : null };
    }
    if (key === 'strife_mode_feature') {
      const rows = instance.blackboard;
      if (!Array.isArray(rows)) throw Error('Missing Strife wave parameters');
      const duration = rows.find(p => p.key === 'duration_of_each_wave');
      const objective = rows.find(p => p.key === 'must_kill_them_all_one_wave');
      if (!Array.isArray(rows) || rows.length !== 2 || !duration || !objective
        || objective.value !== 1 || objective.valueStr != null && objective.valueStr !== '')
        throw Error('Unsupported Strife wave objective');
      const string = duration.valueStr;
      if (string != null && (typeof string !== 'string' || !/^[1-9][0-9]*$/.test(string) || duration.value !== 0))
        throw Error('Unsupported Strife wave durations');
      const seconds = string == null ? duration.value : Number(string);
      if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 3600) throw Error('Invalid Strife deadline');
      return { kind: key, duration: seconds };
    }
    const bb = {}, expected = key === 'periodic_damage' ? ['damage', 'interval'] : key === 'kill_to_add_cost' ? ['cost']
      : ['sp_recover_ratio', 'character_in_magiccircuit[normal].sp_recover_ratio'];
    if (!Array.isArray(instance.blackboard)) throw Error(`Missing environment parameters: ${key}`);
    for (const p of instance.blackboard) {
      if (!expected.includes(p.key) || Object.hasOwn(bb, p.key) || p.valueStr != null && p.valueStr !== '' || !Number.isFinite(p.value))
        throw Error(`Unsupported stage environment parameter: ${key}.${p.key}`);
      bb[p.key] = p.value;
    }
    if (Object.keys(bb).length !== expected.length || (key === 'character_in_magiccircuit_env'
      ? bb.sp_recover_ratio < -1 || bb.sp_recover_ratio > 0
        || bb['character_in_magiccircuit[normal].sp_recover_ratio'] < 0 || bb['character_in_magiccircuit[normal].sp_recover_ratio'] > 10
      : expected.some(k => bb[k] <= 0))
      || key === 'periodic_damage' && (bb.interval < 1 / 30 || bb.interval > 3600)) throw Error(`Invalid stage environment values: ${key}`);
    return { kind: key, ...bb };
  });
}
