// SPDX-License-Identifier: GPL-3.0-or-later
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
export function buildingPriorityNative(n, trigger) {
  const selector = n.$siblings(trigger).find(c => '_filterTag' in c);
  return selector?._targetSide === 2 && selector._targetMotion === 3 && selector._secondaryFilter === 2
    && selector._filterTag === 'building' && selector._sortByTauntAtLast === 1
    && selector._limitTargetNum === 1 && selector._maxNum === 1 && selector._ignoreTargetFree === 0
    && selector._forceIgnoreCamouflage === 0 && selector._excludeAbnormalFlag === 46;
}
export function marksmanNative(r, n) {
  if (!['enemy_1057_gansho', 'enemy_1057_gansho_2'].includes(r.prefabKey)
    || r.applyWay !== 'RANGED' || r.skills.length || Object.keys(r.talents.bb).length) return false;
  const [root] = n[r.prefabKey] ?? [], [mode] = n.Default ?? [], [attack] = n.Attack ?? [];
  if (!root || root._modes.length !== 1 || n.$ref(root._modes[0]) !== mode || root._commonAbilities.length
    || mode._generalAbilities.length || n.$ref(mode._combat) !== attack || n.$ref(mode._attack) !== attack
    || !zero(attack?._selector) || attack._projectileKey !== 'projectile_gansho' || attack._additionalProjectile !== 'projectile_gansho'
    || attack._additionalTimes !== 2 || attack._triggerDelta !== Math.fround(.01) || attack._waitAttackEventForAllAttacks !== 0
    || attack._splitDamage !== 0 || attack._interuptIfTargetDead !== 0 || attack._waitForAttackEvent !== 1
    || attack._damageType !== 1 || attack._attackType !== 1 || attack._atkScale !== 1 || attack._useCachedAtkOnly !== 0
    || attack._activeBuffs.length || attack._extraProjectileKeys.length || attack._additionalProjectiles.length) return false;
  if (!buildingPriorityNative(n, mode._attackTrigger)) return false;
  const projectile = n.$projectile('projectile_gansho'), motion = projectile.find(c => '_speed' in c), life = projectile.find(c => '_lifeTime' in c);
  return motion?._speed === 10 && motion._flyToTargetLocationOnly === 0 && motion._forceReachedWhenTimeup === 1
    && motion._delayToStart === 0 && life?._lifeTime === 5 && life._hitNumType === 1 && life._maxHitNum === 1
    && life._stopAfterMaxHit === 1 && life._stopWhenSourceInvalid === 0 && life._alwaysHitTraceTargetInTheEnd === 1
    && life._canHitSameTargetMultipleTimes === 0 && life._actionController?._extraBuffsInTheEnd?.length === 0;
}
export const MARKSMAN_ENEMY_FEATURES = {
  'ability:Shoots 3 times in a row': { covers: marksmanNative,
    ability: { kind: 'projectileBurst', params: () => ({ count: 3, spacing: .01, speed: 10, lifetime: 5, type: 'phys', priorityTag: 'building' }) },
    note: 'Three independently mitigated homing shots, shared attack identity and native building-tag priority' },
  'ability:Prioritizes attacking the Command Terminal': { covers: (r, n) => marksmanNative(r, n) || fanaticNative(r, n),
    note: 'Native building-tag selector before taunt; blocker priority remains shared' },
};

export function fanaticNative(r, n) {
  if (!['enemy_1059_buster', 'enemy_1059_buster_2'].includes(r.prefabKey) || r.skills.length
    || r.applyWay !== 'RANGED' || Object.keys(r.talents.groups).join() !== 'atkup'
    || r.talents.groups.atkup?.join() !== 'atk_scale' || !(r.talents.bb['atkup.atk_scale'] > 0)) return false;
  const [root] = n[r.prefabKey] ?? [], [mode] = n.Default ?? [], [attack] = n.Attack ?? [], [passive] = n.AtkUp ?? [];
  const [buff] = passive?._buffs ?? [];
  if (!root || root._modes.length !== 1 || n.$ref(root._modes[0]) !== mode || root._commonAbilities.length
    || mode._generalAbilities.length || n.$ref(mode._combat) !== attack || n.$ref(mode._attack) !== attack
    || !buildingPriorityNative(n, mode._attackTrigger) || !zero(attack?._selector)
    || attack._atkScale !== 1 || attack._damageType !== 1 || attack._attackType !== 1 || '_projectileKey' in attack
    || attack._selectTargetSource !== 1 || attack._waitForAttackEvent !== 1 || attack._timeMode !== 0
    || attack._preDelay !== Math.fround(1.134) || attack._activeBuffs.length
    || !zero(passive?._selector) || passive._buffs.length !== 1 || buff.templateKey !== 'filtertag_enhance'
    || buff.isSilenceable !== 1 || buff.lifeTimeType !== 2 || buff.blackboard?.length !== 1
    || buff.blackboard[0].key !== 'tag' || buff.blackboard[0].valueStr !== 'building') return false;
  const actions = n.$template('filtertag_enhance')?.eventToActions?.ON_CALCULATE_DAMAGE;
  return actions?.length === 2 && actions[0]._targetType === 'TARGET' && actions[0]._bbKey === 'tag'
    && actions[1]._atkScaleKey === 'atk_scale' && actions[1]._defaultValue === 1
    && actions[1]._filterApplyWay === false && actions[1]._filterProjectileKey === '';
}
