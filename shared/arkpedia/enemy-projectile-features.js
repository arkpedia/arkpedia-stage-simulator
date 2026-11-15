// SPDX-License-Identifier: GPL-3.0-or-later
const mortar = r => ['enemy_1024_mortar', 'enemy_1024_mortar_2'].includes(r.prefabKey);
function mortarProjectile(r, nat) {
  if (!mortar(r) || r.applyWay !== 'RANGED' || r.skills.length || Object.keys(r.talents.bb).length) return false;
  const cast = nat.Attack?.[0], rows = nat.$projectile?.('projectile_mortar') ?? [];
  const motion = rows.find(c => '_speed' in c), hit = rows.find(c => '_targetOptions' in c);
  const life = rows.find(c => '_lifeTime' in c), box = rows.find(c => 'm_Size' in c);
  return nat.Attack?.length === 1 && cast._projectileKey === 'projectile_mortar' && cast._atkScale === 1
    && cast._damageType === 1 && cast._useDynamicAttackType === 1 && cast._waitForAttackEvent === 1
    && cast._activeBuffs?.length === 0 && cast._extraProjectileKeys?.length === 0
    && cast._selector?.m_PathID === '0' && cast._selectTargetSource === 1 && cast._timeMode === 0
    && cast._animKey === 'Attack' && cast._endAnimKey === 'Idle' && cast._useCachedAtkOnly === 0
    && motion?._speed === 4 && motion._flyToTargetLocationOnly === 0 && motion._forceReachedWhenTimeup === 1
    && life?._lifeTime === 10 && life._canHitSameTargetMultipleTimes === 0 && life._stopWhenSourceInvalid === 0
    && life._hitNumType === 2 && life._alwaysHitTraceTargetInTheEnd === 1
    && hit?._onlyCheckHitWhenReachTarget === 1 && hit._ignoreCamouflage === 1 && hit._onlyTraceTarget === 0
    && hit._targetOptions.targetSide === 2 && hit._targetOptions.ignoreTargetFree === 0
    && box?.m_Size?.x === 3 && box.m_Size.y === 3 && box.m_Offset?.x === 0 && box.m_Offset.y === 0;
}
export const PROJECTILE_ENEMY_FEATURES = Object.freeze({
  'native:imperialShell': {
    covers: imperialShell,
    ability: { kind: 'imperialShell', params: () => ({}) },
    note: 'Cached, sourceless Physical blast at the locked position after three seconds; radius 1.2, no forced primary hit, neutral-marker preference at equal taunt.',
  },
  'skill:stunattack': {
    covers: sniper,
    ability: { kind: 'chargedStatusProjectile', params: r => ({ chargeCost: r.skills[0].spCost,
      duration: r.skills[0].bb.stun, cooldown: r.skills[0].cooldown, initialCooldown: r.skills[0].initCooldown,
      release: 25 / 30, castDuration: 50 / 30, speed: 10, lifetime: 5 }) },
    nativeClaim: () => ({ wrappers: 1 }),
    explains: /^After two attacks, the next attack <\$ba\.stun>Stuns<\/> its target$/,
    note: 'Two ordinary attacks charge a separate fixed-clock, ground-targeted stun projectile; status resolves on impact.',
  },
  'ability:Capable of extremely long ranged-attacks': {
    covers: r => mortar(r) && r.applyWay === 'RANGED' && r.stats.rangeRadius >= 7,
    note: 'Original enemy range is used by the ordinary target selector.',
  },
  'ability:Shells deal area damage to target and any allied units in the surrounding 8 tiles': {
    covers: mortarProjectile,
    ability: { kind: 'projectileBoxAttack', params: () => ({ speed: 4, lifetime: 10, width: 3, height: 3 }) },
    note: 'One homing shell, then physical ordinary-attack damage across the retained rectangular collider.',
  },
});

function imperialShell(r, nat) {
  if (!['enemy_1112_emppnt', 'enemy_1112_emppnt_2'].includes(r.prefabKey) || r.applyWay !== 'RANGED'
    || r.stats.motion !== 'FLY' || r.skills.length || Object.keys(r.talents.bb).length) return false;
  const attack = nat.Attack?.[0], selector = nat.$ref?.(attack?._selector);
  const rows = nat.$projectile?.('projectile_enemy_emppnt') ?? [];
  const hit = rows.find(c => '_targetOptions' in c), life = rows.find(c => '_lifeTime' in c);
  const movement = rows.find(c => '_delayToStart' in c), circle = rows.find(c => 'm_Radius' in c);
  return nat.Attack?.length === 1 && attack._damageType === 1 && attack._attackType === 1 && attack._atkScale === 1
    && attack._timeMode === 0 && attack._useCachedAtkOnly === 1 && attack._projectileDestination === 2
    && attack._projectileKey === 'projectile_enemy_emppnt' && attack._activeBuffs?.length === 0 && attack._extraProjectileKeys?.length === 0
    && attack._selectTargetSource === 1 && attack._selectTargetTiming === 1 && attack._waitForAttackEvent === 1
    && selector?._buffKey === 'mark_neutral[effect]' && selector._withoutThisBuff === 0 && selector._secondaryFilter === 3
    && selector._postFilter === 4 && selector._sortByTauntAtLast === 1 && selector._maxNum === 1 && selector._limitTargetNum === 1
    && selector._targetSide === 2 && selector._targetMotion === 3 && selector._ignoreTargetFree === 0 && selector._forceIgnoreCamouflage === 0
    && hit?._ignoreCamouflage === 1 && hit._onlyCheckHitWhenReachTarget === 1 && hit._onlyTraceTarget === 0
    && hit._targetOptions.targetMotion === 3 && hit._targetOptions.targetSide === 2 && hit._targetOptions.ignoreTargetFree === 0
    && movement?._delayToStart === 3 && movement._followTarget === 0 && movement._keepUpdate === 0
    && movement._stopIfTargetDead === 0 && movement._stopIfTargetDisappeared === 0
    && life?._lifeTime === 10 && life._alwaysReachInTheEnd === 1 && life._alwaysHitTraceTargetInTheEnd === 0
    && life._stopWhenSourceInvalid === 0 && life._canHitSameTargetMultipleTimes === 0 && life._hitNumType === 2
    && Math.abs((circle?.m_Radius ?? 0) - 1.2) < 1e-6 && circle.m_Offset.x === 0 && circle.m_Offset.y === 0;
}

function sniper(r, nat) {
  if (!['enemy_1047_sagent', 'enemy_1047_sagent_2'].includes(r.prefabKey) || r.applyWay !== 'RANGED'
    || r.skills.length !== 1 || Object.keys(r.talents.bb).length) return false;
  const skill = r.skills[0], leader = r.prefabKey.endsWith('_2');
  const rows = nat.StunAttack ?? [], wrapper = rows.find(c => '_familyMask' in c), cast = rows.find(c => '_activeBuffs' in c);
  const buff = cast?._activeBuffs?.[0], projectile = nat.$projectile?.('projectile_sagent_s1') ?? [];
  const motion = projectile.find(c => '_speed' in c), life = projectile.find(c => '_lifeTime' in c);
  return skill.prefabKey === 'stunattack' && skill.spCost === 2 && skill.bb.stun === (leader ? 15 : 5)
    && Object.keys(skill.bb).join() === 'stun' && skill.cooldown === (leader ? 1 : 0) && skill.initCooldown === (leader ? 1 : 0)
    && r.sp?.type === 'INCREASE_WHEN_ATTACK' && r.sp.maxSp === 2 && r.sp.initSp === 0 && r.sp.increment === 1
    && rows.length === 2 && wrapper?._ignoreSilence === 0 && wrapper._familyMask === 3
    && wrapper._trigger?.m_PathID === '0' && wrapper._castLikeAttack === 0 && wrapper._resetMainAbilityCdWhenCastEnd === 1
    && wrapper._immuneStunWhenAffecting === 0 && wrapper._maxTriggerTime === -1
    && cast?._projectileKey === 'projectile_sagent_s1' && cast._atkScale === 1 && cast._damageType === 1
    && cast._useDynamicAttackType === 0 && cast._attackType === 1 && cast._selectTargetSource === 2
    && cast._selector?.m_PathID === '0' && cast._timeMode === 1 && cast._animKey === 'Skill'
    && cast._waitForAttackEvent === 1 && cast._affectedBySlowDown === 1 && cast._preDelay === 0
    && cast._escapeTime === 0 && cast._waitForProjectileInvalid === 0 && cast._activeBuffs.length === 1
    && buff.buffKey === 'stun' && buff.loadFromDB === 1 && buff.statusResistable === 2
    && buff.lifeTimeType === 1 && buff.lifeTime === 0 && buff.blackboard?.length === 0
    && Object.values(buff.attributes ?? {}).every(list => Array.isArray(list) && list.length === 0)
    && motion?._speed === 10 && motion._flyToTargetLocationOnly === 0 && motion._delayToStart === 0
    && life?._lifeTime === 5 && life._maxHitNum === 1 && life._stopAfterMaxHit === 1
    && life._stopWhenSourceInvalid === 0 && life._alwaysHitTraceTargetInTheEnd === 1;
}
