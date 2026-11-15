// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../data/arkpedia-native-stage-rules.json' with { type: 'json' };

const components = (source, key) => source.prefabs[key]?.components.map(c => c.data) ?? [];
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const emptyAttributes = (a, except) => a && Object.entries(a).every(([k, v]) => k === except || (Array.isArray(v) && !v.length));
const passive = buff => buff?.loadFromDB === 0 && buff.templateKey === 'empty' && buff.lifeTimeType === 2
  && buff.isSilenceable === 0 && buff.isStunnable === 0 && buff.isFreezable === 0
  && buff.isLevitatable === 0 && buff.isGroundBoundable === 0 && buff.blackboard?.length === 0;

/** Deliberately narrow native contracts. New rule IDs require their own review;
 * an unknown ability must never silently become a generic stat modifier. */
export function nativeStageRuleReviewed(key, source = evidence) {
  const rows = components(source, key);
  if (key === 'silenceimmue') {
    const [p] = rows, [buff] = p?._buffs ?? [];
    return rows.length === 1 && p.m_Script.m_PathID === '3800760148018415462'
      && zero(p._selector) && p._buffs.length === 1 && passive(buff)
      && buff.buffKey === 'common_silence_immue' && buff.attributes.abnormalImmunes?.join() === '12'
      && emptyAttributes(buff.attributes, 'abnormalImmunes');
  }
  if (key === 'invisible') {
    const checker = rows.find(p => '_restoreDelay' in p), toggle = rows.find(p => '_checker' in p);
    const [buff] = toggle?._buffs ?? [];
    return rows.length === 2 && checker?._isInitToggled === 1 && checker._disableWhenBlocked === 1
      && checker._restoreDelay === 3
      && Object.entries(checker).filter(([k]) => k.startsWith('_disable') && k !== '_disableWhenBlocked').every(([, v]) => v === 0)
      && toggle?._isInverseToggle === 0 && toggle._buffsWhenToggleOff?.length === 0
      && toggle._buffs.length === 1 && zero(toggle._selector) && passive(buff)
      && source.prefabs[key].components.find(c => c.data === checker)?.pathId === toggle._checker.m_PathID
      && buff.buffKey === 'common_invisible' && buff.attributes.abnormalFlags?.join() === '9'
      && emptyAttributes(buff.attributes, 'abnormalFlags');
  }
  if (key === 'common_char_melee_built') {
    const [p] = rows, [buff] = p?._buffs ?? [], opts = p?._options;
    const template = source.templates[key], events = template?.eventToActions;
    const root = events?.ON_BUFF_START?.[0], melee = root?._succeedNodes?.[0], all = melee?._failNodes?.[0];
    const isLog = n => n?.$type?.includes('+LogExtraBattleInfoWithNoTarget,') && n._key === 'melee_built'
      && n._additionValue === 1 && n._loadKeyFromBlackBoard === false && n._logType === 'SIMPLE';
    const build = (n, type) => n?._conditionNode?.$type?.includes('+CheckBuildableType,')
      && n._conditionNode._target === 'BUFF_OWNER' && n._conditionNode._buildableType === type
      && n._conditionNode._checkOriginCondition === false;
    return rows.length === 1 && opts?.targetSide === 1 && opts.targetMotion === 3 && opts.targetCategory === 1
      && opts.enableAdvancedOptions === 1 && opts.professionMask === 639
      && opts.ignoreTargetFree === 1 && opts.ignoreAllyTargetFree === 1 && opts.ignoreHealFree === 1
      && p._buffs.length === 1 && buff.templateKey === key && buff.lifeTimeType === 0 && buff.disableOverride === 1
      && emptyAttributes(buff.attributes) && Object.keys(events ?? {}).join() === 'ON_BUFF_START'
      && events.ON_BUFF_START.length === 1 && root._conditionNode?._heightType === 'LOWLAND'
      && root._conditionNode?._targetType === 'BUFF_OWNER' && root._failNodes === null
      && root._succeedNodes.length === 1 && build(melee, 'MELEE') && build(all, 'ALL')
      && melee._succeedNodes.length === 1 && isLog(melee._succeedNodes[0])
      && melee._failNodes.length === 1 && all._succeedNodes.length === 1 && isLog(all._succeedNodes[0]) && all._failNodes === null;
  }
  if (key === 'deploy_damage') {
    const [p] = rows, [buff] = p?._buffs ?? [], opts = p?._options;
    const events = source.templates[key]?.eventToActions, [damage] = events?.ON_OWNER_POST_BORN ?? [];
    return rows.length === 1 && opts?.targetSide === 1 && opts.targetMotion === 3 && opts.targetCategory === 1
      && opts.enableAdvancedOptions === 0 && opts.ignoreTargetFree === 0 && opts.ignoreAllyTargetFree === 0
      && p._buffs.length === 1 && buff.templateKey === key && buff.buffKey === '[g]deploy_damage'
      && buff.lifeTimeType === 2 && buff.disableOverride === 1 && buff.isDamageMissable === 0
      && buff.isSilenceable === 0 && emptyAttributes(buff.attributes) && buff.blackboard.length === 0
      && Object.keys(events ?? {}).join() === 'ON_OWNER_POST_BORN' && events.ON_OWNER_POST_BORN.length === 1
      && damage.$type?.includes('+DamageViaMaxHpRatio,') && damage._targetType === 'BUFF_OWNER'
      && damage._getMaxHpFromTarget === false && damage._damageType === 'PURE' && damage._applyWay === 'NONE'
      && damage._ignoreForSp === false && damage._isUndeadable === false && damage._attackType === 'NORMAL'
      && damage._skipModifierEvent === false && damage._multiplyByKey === false && damage._noSourceDamage === false;
  }
  return false;
}

export const STAGE_DYNAMIC_ABILITIES = Object.freeze(['silenceimmue', 'invisible']);
