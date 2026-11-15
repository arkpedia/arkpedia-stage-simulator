// SPDX-License-Identifier: GPL-3.0-or-later
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
export function taggedArtsBonusNative(attack, n, tagName) {
  const [buff] = attack?._activeBuffs ?? [];
  if (attack?._activeBuffs.length !== 1 || buff.templateKey !== 'enemy_fixed_value_damage_to_trap'
    || buff.isDamageMissable !== 0 || buff.lifeTimeType !== 0 || buff.isSilenceable !== 0
    || buff.blackboard.length !== 1 || buff.blackboard[0].key !== 'tag' || buff.blackboard[0].valueStr !== tagName) return false;
  const events = n.$template('enemy_fixed_value_damage_to_trap')?.eventToActions, [tag, damage] = events?.ON_BUFF_START ?? [];
  return Object.keys(events ?? {}).join() === 'ON_BUFF_START' && events.ON_BUFF_START.length === 2
    && tag.$type === 'Torappu.Battle.Action.Nodes+CheckFilterTag, Assembly-CSharp' && tag._targetType === 'TARGET' && tag._bbKey === 'tag'
    && damage.$type === 'Torappu.Battle.Action.Nodes+FixedValueDamage, Assembly-CSharp' && damage._damageType === 'MAGICAL'
    && damage._damageKey === 'trapdamage' && !('_atkScaleKey' in damage) && damage._ignoreForSp
    && damage._attackType === 'NORMAL' && !damage._skipModifierEvent && !damage._noSourceDamage && damage._targetType === 'TARGET';
}
export function velesNative(r, n) {
  if (!['enemy_1215_ptrarc', 'enemy_1215_ptrarc_2'].includes(r.prefabKey) || r.applyWay !== 'RANGED' || r.skills.length
    || Object.keys(r.talents.groups).join() !== 'shottrap' || r.talents.groups.shottrap.join() !== 'attack@trapdamage'
    || !Number.isFinite(r.talents.bb['shottrap.attack@trapdamage']) || r.talents.bb['shottrap.attack@trapdamage'] <= 0) return false;
  const [root] = n[r.prefabKey] ?? [], [mode] = n.Default ?? [], attack = n.$ref(mode?._attack);
  const selector = n.$siblings(mode?._attackTrigger).find(c => '_filterTag' in c);
  if (!root || root._modes.length !== 1 || root._commonAbilities.length || n.$ref(root._modes[0]) !== mode
    || mode._generalAbilities.length || n.$ref(mode._combat) !== attack
    || !zero(attack?._selector) || attack._projectileKey !== 'projectile_enemy_ptrarc' || attack._useCachedAtkOnly !== 0
    || attack._damageType !== 1 || attack._attackType !== 1 || attack._atkScale !== 1 || attack._useDynamicAttackType !== 0
    || attack._waitForAttackEvent !== 1 || attack._selectTargetSource !== 2
    || selector?._targetSide !== 2 || selector._targetMotion !== 1 || selector._maxNum !== 1
    || selector._secondaryFilter !== 2 || selector._filterTag !== 'TAG_TRAP_WPNSTS'
    || selector._ignoreTargetFree !== 0 || selector._forceIgnoreCamouflage !== 0
    || !taggedArtsBonusNative(attack, n, 'TAG_TRAP_WPNSTS')) return false;
  const rows = n.$projectile('projectile_enemy_ptrarc'), motion = rows.find(c => '_speed' in c), life = rows.find(c => '_lifeTime' in c);
  return motion?._speed === 10 && motion._flyToTargetLocationOnly === 0 && motion._forceReachedWhenTimeup === 1
    && motion._delayToStart === 0 && life?._lifeTime === 10 && life._hitNumType === 1 && life._maxHitNum === 1
    && life._stopAfterMaxHit === 1 && life._stopWhenSourceInvalid === 0 && life._alwaysHitTraceTargetInTheEnd === 1
    && life._canHitSameTargetMultipleTimes === 0 && life._actionController?._extraBuffsInTheEnd?.length === 0;
}
export const TAGGED_PROJECTILE_ENEMY_FEATURES = {
  'talent:shottrap': { covers: velesNative,
    ability: { kind: 'taggedProjectile', params: r => ({ speed: 10, lifetime: 10, type: 'phys', noAir: true,
      priorityTag: 'TAG_TRAP_WPNSTS', bonus: { tag: 'TAG_TRAP_WPNSTS', damage: r.talents.bb['shottrap.attack@trapdamage'] } }) },
    stageMultipliers: { 'shottrap.attack@trapdamage': v => Number.isFinite(v) && v > 0 },
    explains: /^Prioritizes attacking 'Gelato Stops'\. Deals additional Arts Damage to 'Gelato Stops'\.$/,
    note: 'Ground-targeted homing Physical shot, native Gelato Stop tag priority and an independently unmissable fixed Arts payload' },
};
