// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const rows = (n, id) => n.prefabs[id]?.components.map(c => c.data) ?? [];
export function rangeSupplyNativeReviewed(id, evidence = native) {
  if (!['trap_006_antidr', 'trap_009_battery'].includes(id)) return false;
  const parts = rows(evidence, id), root = parts.find(c => '_modes' in c), jammer = id === 'trap_006_antidr';
  if (root?._modes.length !== 1 || root._sideType !== 1 || root._occupiedRemainingCharacterCnt !== 0
    || root._withdrawable !== 1 || root._withdrawCostRecoverRatio !== .5 || root._category !== (jammer ? 1 : 2)
    || root._buildCondition.buildableType !== (jammer ? 2 : 3)
    || root._buildCondition.needSpecifyDirection !== (jammer ? 0 : 1) || root._buildCondition.isTryingOverlapCharacater !== 0) return false;
  const aura = rows(evidence, jammer ? 'sktok_antidr' : id).find(c => '_removeBuffWhenTargetLeave' in c);
  const validator = rows(evidence, jammer ? 'sktok_antidr' : id).find(c => '_targetOptions' in c);
  const buff = aura?._buffs[0], options = validator?._targetOptions;
  if (aura?._buffs.length !== 1 || aura._removeBuffWhenTargetLeave !== 1 || aura._removeBuffWhenAbilityDetached !== 1
    || options?.targetSide !== (jammer ? 2 : 1) || options.targetCategory !== 1 || options.targetMotion !== 3
    || options.ignoreTargetFree !== 0 || buff.isSilenceable !== 0 || buff.lifeTimeType !== 2) return false;
  if (jammer) {
    const passive = parts.find(c => c._buffs?.[0]?.buffKey === 'antidr_healfree')?._buffs[0];
    const mod = buff.attributes.attributeModifiers;
    return validator._tags?.join() === 'drone' && validator._isUnset === 0 && buff.templateKey === 'empty'
      && buff.attributes.abnormalFlags.join() === '11,12' && mod.length === 1 && mod[0].attributeType === 6
      && mod[0].formulaItem === 3 && mod[0].loadFromBlackboard === 1
      && passive?.attributes.abnormalFlags.join() === '7,3,15'
      && passive.attributes.attributeModifiers.length === 2
      && passive.attributes.attributeModifiers.every((m, i) => m.attributeType === [13, 19][i] && m.formulaItem === 3 && m.value === 0);
  }
  const actions = evidence.templates['modify_sp[trigger]']?.eventToActions.ON_BUFF_TRIGGER;
  return buff.templateKey === 'modify_sp[trigger]' && options.ignoreAllyTargetFree === 1
    && buff.triggerLifeType === 2 && buff.triggerInterval === -1 && buff.waitFirstTriggerInterval === 1
    && buff.firstTriggerInterval === -1 && buff.disableOverride === 1
    && actions?.length === 2 && actions[0]._spMask === 'ALL' && actions[0]._spString === 'sp'
    && !actions[0]._forceFlag && !actions[0]._modifyByRatio;
}
export function rangeSupplyDefinition(id, instance) {
  const jammer = id === 'trap_006_antidr';
  if (!rangeSupplyNativeReviewed(id) || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || instance.elite !== 0 || instance.potential !== 0 || instance.skill_index !== (jammer ? 0 : -1) || instance.skill_level !== 1)
    throw Error(`Unsupported range supply instance: ${id}`);
  const record = tables.devices[id], phase = record.phases[0], [low, high] = phase.attributesKeyFrames;
  const t = (instance.level - low.level) / (high.level - low.level);
  const hp = Math.round(low.data.maxHp + (high.data.maxHp - low.data.maxHp) * t);
  const bb = Object.fromEntries((jammer ? tables.skills.sktok_antidr.levels[0].blackboard : record.talents[0].candidates[0].blackboard).map(x => [x.key, x.value]));
  if (jammer ? bb.move_speed !== .5 : bb.interval !== 4 || bb.sp !== 3) throw Error(`Changed range supply parameters: ${id}`);
  return { kind: jammer ? 'jammer' : 'battery', supplyCard: true, obstacle: false, hp,
    cost: low.data.cost, cooldown: low.data.respawnTime, refundRatio: .5,
    taunt: low.data.tauntLevel, ...(jammer ? { rangedBuildOnly: true, moveMul: bb.move_speed } : { anyBuildOnly: true, chooseFacing: true, interval: bb.interval, sp: bb.sp }),
    range: tables.ranges[phase.rangeId].grids.map(p => [p.row, p.col]),
    description: jammer ? 'Drones in range cannot attack or use silenceable abilities and move at half speed. Enemies prioritize this device. Cannot be healed.'
      : 'Restores 3 SP every 4 seconds to each eligible allied unit in front. Skill SP restrictions still apply.' };
}
