// SPDX-License-Identifier: GPL-3.0-or-later
export const CHEERING_DESCRIPTION = 'Upon death, significantly increase ASPD and DEF of our units on the field for a period.';
export function cheeringDrone(r, nat) {
  const bb = r.talents.bb, component = nat.buff?.[0], start = component?._buffs?.[0], reward = component?._projectileBuffs?.[0];
  if (r.prefabKey !== 'enemy_1106_byokai' || r.applyWay !== 'NONE' || r.stats.motion !== 'FLY' || r.skills.length
    || r.talents.groups.buff?.join() !== 'attack_speed,def,duration' || bb['buff.attack_speed'] !== 100 || bb['buff.def'] !== .5 || ![20, 60].includes(bb['buff.duration'])
    || !r.stats.immunities.silence || !r.abilities.some(a => a.text === CHEERING_DESCRIPTION)) return false;
  const projectile = nat.$projectile?.('projectile_enemy_byokai') ?? [], hit = projectile.find(c => '_targetOptions' in c);
  const circle = projectile.find(c => 'm_Radius' in c), life = projectile.find(c => '_lifeTime' in c);
  const actions = nat.$template?.('projectile_on_killed')?.eventToActions?.ON_OWNER_KILLED;
  const mods = reward?.attributes?.attributeModifiers;
  return nat.buff?.length === 1 && component._buffs?.length === 1 && start.templateKey === 'projectile_on_killed'
    && start.blackboard?.length === 1 && start.blackboard[0].key === 'projectile' && start.blackboard[0].valueStr === 'projectile_enemy_byokai'
    && start.disableOverride === 1 && start.triggerCnt === 1 && start.lifeTimeType === 2
    && component._projectileActions?.SerializedState === '[]' && component._projectileBuffs?.length === 1
    && reward.templateKey === 'empty' && reward.disableOverride === 0 && reward.overrideType === 4 && reward.maxStackCnt === 1
    && reward.independentCharacterSource === 0 && reward.lifeTimeType === 1 && reward.statusResistable === 2
    && mods?.length === 2 && mods[0].attributeType === 2 && mods[0].formulaItem === 1 && mods[0].loadFromBlackboard === 1
    && mods[1].attributeType === 7 && mods[1].formulaItem === 0 && mods[1].loadFromBlackboard === 1
    && Object.entries(reward.attributes).filter(([key]) => key !== 'attributeModifiers').every(([, values]) => !values.length)
    && circle?.m_Radius === 30 && circle.m_Offset.x === 0 && circle.m_Offset.y === 0
    && hit?._ignoreCamouflage === 1 && hit._targetOptions.ignoreTargetFree === 1 && hit._targetOptions.ignoreHealFree === 1
    && hit._targetOptions.targetMotion === 3 && hit._targetOptions.targetSide === 2 && hit._targetOptions.professionMask === 767
    && life?._lifeTime === .5 && life._canHitSameTargetMultipleTimes === 0 && life._stopWhenSourceInvalid === 0
    && life._alwaysReachInTheEnd === 1 && life._hitNumType === 2
    && actions?.length === 2 && actions[0]._abnormalFlag === 'SILENCED' && actions[0]._isUnset === true
    && actions[1].$type === 'Torappu.Battle.Action.Nodes+EmitProjectile, Assembly-CSharp';
}
export const cheeringAbility = { kind: 'deathAreaBuff', params: r => ({ radius: 30, duration: r.talents.bb['buff.duration'],
  mods: { aspd: r.talents.bb['buff.attack_speed'], defPct: r.talents.bb['buff.def'] }, key: 'ab:cheeringDrone' }) };
