// SPDX-License-Identifier: GPL-3.0-or-later
const TEAPOTS = ['enemy_1203_sfhu', 'enemy_1203_sfhu_2'];
const emptyAttributes = attributes => attributes && Object.values(attributes).every(a => Array.isArray(a) && !a.length);
function groundArea(rows, radius, alwaysTarget) {
  const hit = rows.find(c => '_targetOptions' in c), life = rows.find(c => '_lifeTime' in c), circle = rows.find(c => 'm_Radius' in c);
  return hit?._ignoreCamouflage === 1 && hit._onlyCheckHitWhenReachTarget === 1 && hit._onlyTraceTarget === 0
    && hit._targetOptions.targetMotion === 1 && hit._targetOptions.targetSide === 2
    && hit._targetOptions.ignoreTargetFree === 0 && hit._targetOptions.ignoreMotionMode === 0
    && life?._canHitSameTargetMultipleTimes === 0 && life._stopWhenSourceInvalid === 0
    && life._alwaysHitTraceTargetInTheEnd === alwaysTarget && life._hitNumType === 2
    && circle?.m_Radius === radius && circle.m_Offset.x === 0 && circle.m_Offset.y === 0;
}
function teapot(record, nat) {
  const bb = record.talents.bb;
  if (!TEAPOTS.includes(record.prefabKey) || record.applyWay !== 'RANGED' || record.skills.length
    || record.talents.groups.DeadBoom?.join() !== 'attack_speed,attack_speed_add,duration,interval'
    || bb['DeadBoom.duration'] !== 15 || bb['DeadBoom.interval'] !== 3 || bb['DeadBoom.attack_speed_add'] !== 0
    || bb['DeadBoom.attack_speed'] !== (record.prefabKey.endsWith('_2') ? -50 : -40)) return false;
  const attack = nat.Attack?.[0], boom = nat.DeadBoom?.[0], trigger = boom?._buffs?.[0], debuff = boom?._projectileBuffs?.[0];
  const projectile = nat.$projectile?.('projectile_enemy_sfhu') ?? [], death = nat.$projectile?.('projectile_enemy_sfhu_boom') ?? [];
  const motion = projectile.find(c => '_speed' in c);
  const start = nat.$template?.('projectile_on_killed')?.eventToActions?.ON_OWNER_KILLED;
  const resist = nat.$template?.('enemy_sfhu_atkspeed_dec[resist]')?.eventToActions?.ON_BUFF_START;
  const tick = nat.$template?.('enemy_sfhu_atkspeed_dec[trig]')?.eventToActions?.ON_BUFF_TRIGGER;
  let actions;
  try { actions = JSON.parse(boom?._projectileActions?.SerializedState); } catch { return false; }
  return nat.Attack?.length === 1 && nat.DeadBoom?.length === 1
    && attack._projectileKey === 'projectile_enemy_sfhu' && attack._damageType === 2 && attack._atkScale === 1
    && attack._attackType === 1 && attack._useCachedAtkOnly === 0 && attack._waitForAttackEvent === 1
    && attack._selector?.m_PathID === '0' && attack._selectTargetSource === 2 && attack._timeMode === 0
    && attack._activeBuffs?.length === 0 && attack._extraProjectileKeys?.length === 0
    && groundArea(projectile, 1, 1) && motion?._speed === 5 && motion._flyToTargetLocationOnly === 0
    && motion._forceReachedWhenTimeup === 1 && projectile.find(c => '_lifeTime' in c)?._lifeTime === 10
    && groundArea(death, 1.25, 0) && death.find(c => '_lifeTime' in c)?._lifeTime === 1
    && boom._buffs.length === 1 && trigger.templateKey === 'projectile_on_killed'
    && trigger.blackboard?.length === 1 && trigger.blackboard[0].key === 'projectile'
    && trigger.blackboard[0].valueStr === 'projectile_enemy_sfhu_boom' && emptyAttributes(trigger.attributes)
    && boom._projectileBuffs.length === 1 && debuff.templateKey === 'enemy_sfhu_atkspeed_dec[resist]'
    && debuff.disableOverride === 1 && debuff.statusResistable === 1 && debuff.lifeTimeType === 1
    && debuff.blackboard?.length === 0 && emptyAttributes(debuff.attributes)
    && actions?.length === 1 && actions[0]._damageType === 'MAGICAL' && actions[0]._defaultAtkScale === 1
    && actions[0]._attackType === 'SPLASH' && actions[0]._applyWay === 'NONE'
    && start?.length === 2 && start[0]._abnormalFlag === 'SILENCED' && start[0]._isUnset === true
    && start[1].$type === 'Torappu.Battle.Action.Nodes+EmitProjectile, Assembly-CSharp'
    && resist?.length === 1 && resist[0]._buff?.templateKey === 'enemy_sfhu_atkspeed_dec[trig]'
    && resist[0]._buff.disableOverride === true
    && tick?.length === 3 && tick[0].$type === 'Torappu.Battle.Action.Nodes+FinishDerivedBuff, Assembly-CSharp'
    && tick[1]._buff?.disableOverride === true && tick[1]._buff.attributes.attributeModifiers.length === 1
    && tick[1]._buff.attributes.attributeModifiers[0].attributeType === 'ATTACK_SPEED'
    && tick[1]._buff.attributes.attributeModifiers[0].formulaItem === 'ADDITION'
    && tick[1]._buff.attributes.attributeModifiers[0].loadFromBlackboard === true
    && tick[2]._blackboardKeys === 'attack_speed' && tick[2]._fromBlackboardKeys === 'attack_speed_add';
}
export const DEATH_ENEMY_FEATURES = Object.freeze({
  'talent:DeadBoom': {
    covers: teapot,
    ability: { kind: 'teapot', params: r => ({ aspd: r.talents.bb['DeadBoom.attack_speed'], duration: r.talents.bb['DeadBoom.duration'] }) },
    explains: /^Upon death, explodes and deals area Arts damage, greatly reducing allied units' ASPD \(can be <\$ba\.buffres>Resisted<\/>\)$/,
    note: 'Ground-only Arts projectile splash and silenceable death pulse; independent resistance-aware ASPD debuffs. Nonzero periodic ASPD changes stay refused.',
  },
});
