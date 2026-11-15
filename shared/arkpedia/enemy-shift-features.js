// SPDX-License-Identifier: GPL-3.0-or-later
const node = name => `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const empty = attributes => attributes && Object.values(attributes).every(v => Array.isArray(v) && v.length === 0);
const zeroRef = value => value?.m_PathID === '0';

export function shiftBleedNative(r, n) {
  if (!['enemy_1328_cbjedi', 'enemy_1328_cbjedi_2'].includes(r.prefabKey)
    || r.applyWay !== 'MELEE' || r.stats.dmgType !== 'arts' || r.skills.length
    || r.talents.groups.unbalanced_bleed?.join() !== 'damage,interval'
    || r.talents.bb['unbalanced_bleed.damage'] !== 400 || r.talents.bb['unbalanced_bleed.interval'] !== .066) return false;
  const root = n[r.prefabKey]?.[0], mode = n.Default?.[0], attack = n.Combat?.[0];
  const passive = n.unbalanced_bleed?.find(c => c._buffs), buff = passive?._buffs?.[0];
  const events = n.$template?.('enemy_cbjedi_bleed')?.eventToActions;
  const branch = events?.ON_BUFF_TRIGGER?.[0], contains = branch?._succeedNodes?.[0];
  const create = contains?._failNodes?.[0], blood = create?._buff, finish = branch?._failNodes?.[0];
  const damageEvents = n.$template?.('periodic_damage_without_modify')?.eventToActions;
  const damage = damageEvents?.ON_BUFF_TRIGGER?.[0];
  return root?._modes?.length === 1 && n.$ref(root._modes[0]) === mode && root._commonAbilities.length === 0
    && mode?._generalAbilities?.length === 0 && n.$ref(mode._combat) === attack
    && zeroRef(mode._attack) && zeroRef(mode._attackTrigger)
    && attack?._attackType === 1 && attack._damageType === 2 && attack._atkScale === 1 && attack._activeBuffs.length === 0
    && zeroRef(attack._selector) && attack._selectTargetSource === 2 && attack._waitForAttackEvent === 1
    && attack._epDamageRatio === 0 && attack._extraDamageType === 0
    && passive && zeroRef(passive._selector) && passive._buffs.length === 1
    && buff.buffKey === 'enemy_cbjedi_bleed' && buff.templateKey === 'enemy_cbjedi_bleed'
    && !buff.loadFromDB && !buff.isSilenceable && !buff.isStunnable && !buff.isFreezable
    && buff.lifeTimeType === 2 && buff.triggerLifeType === 2 && buff.triggerInterval === 1
    && buff.waitFirstTriggerInterval === 1 && buff.firstTriggerInterval === -1
    && buff.blackboard.length === 0 && empty(buff.attributes)
    && Object.keys(events ?? {}).join() === 'ON_BUFF_TRIGGER' && events.ON_BUFF_TRIGGER.length === 1
    && branch.$type === node('IfElse') && branch._conditionNode?.$type === node('CheckEnemyUnbalanced')
    && branch._conditionNode._targetType === 'BUFF_OWNER' && branch._succeedNodes.length === 1 && branch._failNodes.length === 1
    && contains.$type === node('IfElse') && contains._succeedNodes === null && contains._failNodes.length === 1
    && contains._conditionNode?.$type === node('CheckContainsBuff') && contains._conditionNode._targetType === 'BUFF_OWNER'
    && contains._conditionNode._buffKeys?.join() === 'cbjedi_blood' && contains._conditionNode.isAND
    && !contains._conditionNode._checkBuffSource && !contains._conditionNode._loadFromBlackboard
    && create.$type === node('CreateBuff') && create._buffOwner === 'BUFF_OWNER' && !create._isDerivedBuff && !create._useSpecialBuffSource
    && blood.buffKey === 'cbjedi_blood' && blood.templateKey === 'periodic_damage_without_modify'
    && !blood.loadFromDB && !blood.isSilenceable && !blood.isStunnable && !blood.isFreezable && empty(blood.attributes)
    && blood.lifeTimeType === 'INFINITY' && blood.triggerLifeType === 'INFINITY' && blood.waitFirstTriggerInterval
    && blood.triggerInterval === -1 && blood.firstTriggerInterval === -1 && blood.blackboard.length === 0
    && finish.$type === node('FinishBuffsById') && finish._buffKey === 'cbjedi_blood' && finish._targetType === 'BUFF_OWNER'
    && !finish._loadFromBlackboard && !finish._decCntIfStack && !finish._checkBuffSource && !finish._finishHostBuff
    && Object.keys(damageEvents ?? {}).join() === 'ON_BUFF_TRIGGER' && damageEvents.ON_BUFF_TRIGGER.length === 1
    && damage.$type === node('NoSourceDamage') && damage._damageType === 'PURE' && damage._damageKey === 'damage'
    && damage._ignoreForSp && damage._damageWithoutModify && damage._attackType === 'BUFF'
    && !damage._isEnvDamage && !damage._isUndeadable && damage._ignoreCancelReasonMask === 'NONE'
    && !damage._instantKillLikeDamage && !damage._isNotChangeableValue && !damage._multiplierByKey && !damage._modifierKey;
}

export const SHIFT_ENEMY_FEATURES = Object.freeze({
  'talent:unbalanced_bleed': { covers: shiftBleedNative,
    ability: { kind: 'unbalancedPeriodicDamage', params: r => ({ damage: r.talents.bb['unbalanced_bleed.damage'],
      interval: r.talents.bb['unbalanced_bleed.interval'] }) },
    explains: /^Loses HP proportional to distance moved when shifted$/,
    note: 'Original template checks the unbalanced state and maintains fixed unmodified periodic true damage; ordinary walking and teleports do not count. Requires regular-stage continuous force integration. Native frame phase is not certified.' },
});
