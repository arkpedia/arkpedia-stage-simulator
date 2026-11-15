// SPDX-License-Identifier: GPL-3.0-or-later
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
export function withererNative(r, n) {
  if (!['enemy_1267_nhpbr', 'enemy_1267_nhpbr_2'].includes(r.prefabKey)
    || JSON.stringify(r.talents.groups.PollutedDie) !== JSON.stringify(['polluted_damage_high', 'polluted_damage_low', 'projectile_life_time', 'projectile_range'])
    || r.talents.bb['PollutedDie.projectile_range'] !== 2 || r.talents.bb['PollutedDie.projectile_life_time'] !== 8
    || !['polluted_damage_low', 'polluted_damage_high'].every(k => Number.isFinite(r.talents.bb['PollutedDie.' + k]) && r.talents.bb['PollutedDie.' + k] >= 0)) return false;
  const [death] = n.PollutedDie ?? [], [trigger] = death?._buffs ?? [], [pool] = death?._projectileBuffs ?? [];
  if (!zero(death?._selector) || death._buffs.length !== 1 || death._projectileBuffs.length !== 1
    || trigger.templateKey !== 'projectile_on_killed' || trigger.blackboard?.length !== 1
    || trigger.blackboard[0].key !== 'projectile' || trigger.blackboard[0].valueStr !== 'projectile_enemy_nhpbr_polluted'
    || pool.buffKey !== 'enemy_polluted_t' || pool.templateKey !== 'polluted_area' || pool.lifeTimeType !== 2
    || pool.triggerInterval !== 1 || pool.waitFirstTriggerInterval !== 1 || pool.isDamageMissable !== 0
    || pool.isSilenceable !== 0 || pool.overrideType !== 0 || pool.independentCharacterSource !== 0) return false;
  const projectile = n.$projectile('projectile_enemy_nhpbr_polluted'), life = projectile.find(c => '_lifeTime' in c);
  const hit = projectile.find(c => '_targetOptions' in c), range = projectile.find(c => '_scaleble' in c), circle = projectile.find(c => 'm_Radius' in c);
  if (!life || life._getLifeTimeFromBB !== 1 || life._lifeTimeType !== 1 || life._stopWhenSourceInvalid !== 0
    || life._stopAfterFirstHit !== 0 || life._hitNumType !== 2 || life._managedBySource !== 0
    || life._actionController?._detachBuffsWhenTargetLeave !== 1 || life._actionController?._detachAllBuffsWhenStopped !== 1
    || hit?._targetOptions?.targetSide !== 2 || hit._targetOptions.targetMotion !== 3 || hit._targetOptions.professionMask !== 767
    || hit._targetOptions.ignoreTargetFree !== 1 || hit._ignoreCamouflage !== 1 || hit._goThroughWall !== 1
    || hit._exceptFlyCharacter !== 0 || range?._scaleble !== 0 || range._extendable !== 0
    || circle?.m_Radius !== Math.fround(1.7) || circle.m_Offset.x !== 0 || circle.m_Offset.y !== 0) return false;
  const killed = n.$template('projectile_on_killed')?.eventToActions?.ON_OWNER_KILLED;
  const action = n.$template('polluted_area')?.eventToActions?.ON_BUFF_TRIGGER;
  if (killed?.length !== 2 || killed[0]._abnormalFlag !== 'SILENCED' || killed[0]._isUnset !== true
    || killed[1]._sourceType !== 'BUFF_OWNER' || action?.length !== 1
    || action[0]._conditionNode?._heightType !== 'LOWLAND' || action[0]._conditionNode?._targetType !== 'BUFF_OWNER') return false;
  for (const [field, key] of [['_succeedNodes', 'polluted_damage_low'], ['_failNodes', 'polluted_damage_high']]) {
    const [damage] = action[0][field] ?? [];
    if (action[0][field]?.length !== 1 || damage._damageType !== 'PURE' || damage._damageKey !== key
      || damage._ignoreForSp !== true || damage._attackType !== 'BUFF' || damage._skipModifierEvent !== false
      || damage._noSourceDamage !== false || damage._isEnvDamage !== false) return false;
  }
  return true;
}
