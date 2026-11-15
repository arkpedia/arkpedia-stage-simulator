// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-whisperer-animations.json' with { type: 'json' };
const isWhisperer = r => ['enemy_1088_ltsmer', 'enemy_1088_ltsmer_2'].includes(r.prefabKey);
export function matterllurgistNative(r, n) {
  if (!['enemy_1090_mdsnpr', 'enemy_1090_mdsnpr_2'].includes(r.prefabKey) || r.skills.length
    || Object.keys(r.talents.groups).length || r.applyWay !== 'RANGED' || r.stats.dmgType !== 'phys') return false;
  const root = n[r.prefabKey]?.[0], mode = n.$ref(root?._modes[0]), attack = n.$ref(mode?._attack);
  const selector = n.$siblings(mode?._attackTrigger).find(c => '_secondaryFilter' in c);
  if (root?._modes.length !== 1 || root._commonAbilities.length || mode._generalAbilities.length
    || n.$ref(mode._combat) !== attack || attack?._projectileKey !== 'projectile_enemy_mdsnpr'
    || attack._selectTargetSource !== 1 || attack._waitForAttackEvent !== 1 || attack._timeMode !== 0
    || attack._damageType !== 1 || attack._atkScale !== 1 || attack._activeBuffs.length || attack._extraProjectileKeys.length
    || selector?._targetSide !== 2 || selector._targetMotion !== 3 || selector._targetCategory !== 1
    || selector._postFilter !== 4 || selector._secondaryFilter !== 3 || selector._sortByTauntAtLast !== 1
    || selector._buffKey !== 'tower_t_1[charge_range]' || selector._withoutThisBuff !== 0 || selector._filterBuffSource !== 0
    || selector._ignoreTargetFree !== 0 || selector._forceIgnoreCamouflage !== 0 || selector._maxNum !== (r.prefabKey.endsWith('_2') ? 2 : 1)) return false;
  const parts = n.$projectile('projectile_enemy_mdsnpr'), motion = parts.find(c => '_speed' in c), life = parts.find(c => '_lifeTime' in c);
  return motion?._speed === 10 && motion._flyToTargetLocationOnly === 0 && motion._delayToStart === 0
    && life?._lifeTime === 5 && life._maxHitNum === 1 && life._stopWhenSourceInvalid === 0;
}
export const GRAMOPHONE_ENEMY_FEATURES = {
  'skill:charge': { matchesRecord: isWhisperer, covers: whispererNative, nativeClaim: () => ({ wrappers: 1 }),
    stageSkillMultipliers: { charge: { sp: value => Number.isFinite(value) && value < 0 } },
    stageSkillTimingOverrides: { charge: { initCooldown: value => value === 0 } },
    ability: r => isWhisperer(r) ? { kind: 'whispererChannel', params: r => ({ cooldown: r.skills[0].cooldown, initial: r.skills[0].initCooldown,
      duration: r.skills[0].bb.hit_duration, sp: r.skills[0].bb.sp,
      begin: clocks.enemies[r.prefabKey].durations.Skill_Begin, recovery: Math.fround(.667) }) } : null,
    explains: /^Continuously casts at the nearest non-enemy controlled 'Gramophone' within attack range to attempt to seize control of it\.$/ },
  'talent:boom': { covers: shamanNative,
    ability: { kind: 'shamanDeath', params: r => ({ delay: Math.fround(1.3), radius: 1.5, scale: r.talents.bb['boom.atk_scale'] }) },
    explains: /^Upon death, deals (Arts damage|a large amount of Arts damage) to all surrounding units and immediately seizes control of any 'Gramophones'$/ },
  'talent:occupy': { covers: shamanNative, note: 'The shared delayed death payload drains a full control-SP bar and immediately switches the affected Gramophones.' },
  "ability:Prioritizes attacking units that are vying for control of a 'Gramophone.'": { covers: matterllurgistNative,
    ability: { kind: 'projectileBurst', params: r => ({ count: 1, spacing: 0, speed: 10, lifetime: 5, type: 'phys',
      maxTargets: r.prefabKey.endsWith('_2') ? 2 : 1, priorityBuff: 'tower_t_1[charge_range]' }) },
    note: 'Native charging marker priority, shared blocker/taunt ordering, one or two original homing targets.' },
};

export function whispererNative(r, n) {
  if (!['enemy_1088_ltsmer', 'enemy_1088_ltsmer_2'].includes(r.prefabKey) || r.skills.length !== 1
    || r.applyWay !== 'RANGED' || r.stats.dmgType !== 'arts' || Object.keys(r.talents.groups).length) return false;
  const s = r.skills[0], root = n[r.prefabKey]?.[0], cast = n.Charge?.find(c => '_projectileKey' in c);
  const wrapper = n.Charge?.find(c => '_familyMask' in c), selector = n.$ref(cast?._selector);
  const clock = clocks.enemies[r.prefabKey], animator = n.$ref(root?._animator);
  if (s.prefabKey !== 'charge' || s.cooldown !== 15 || s.initCooldown !== 5 || s.spCost !== 0
    || Object.keys(s.bb).sort().join() !== 'duration,hit_duration,sp' || s.bb.duration !== 25 || s.bb.hit_duration !== 25 || s.bb.sp !== -2
    || root?._modes.length !== 1 || root._commonAbilities.length || wrapper?._familyMask !== 3 || wrapper._ignoreSilence !== 0
    || wrapper._resetMainAbilityCdWhenCastEnd !== 0 || cast?._projectileKey !== 'projectile_enemy_ltsmer_charge'
    || cast._waitForAttackEvent !== 1 || cast._selectTargetSource !== 1 || cast._selectTargetTiming !== 0
    || cast._waitForProjectileInvalid !== 1 || cast._notClearProjectileWhenCastEnd !== 0 || cast._affectedBySlowDown !== 0
    || cast._minPostDelayWhenProjectileInvalid !== Math.fround(.667) || cast._atkScale !== 0
    || selector?._targetSide !== 1 || selector._targetCategory !== 2 || selector._targetMotion !== 3
    || selector._postFilter !== 11 || selector._filterTag !== 'tower' || selector._buffKey !== 'tower_t_4[mark]'
    || selector._buffKeyExcluded !== 1 || selector._ignoreTargetFree !== 1 || selector._maxNum !== 1
    || !clock || n.$ref(animator?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId
    || clock.durations.Skill_Begin !== Math.fround(5 / 30) || clock.events.Skill_Loop?.[0]?.time !== 0) return false;
  const projectile = n.$projectile('projectile_enemy_ltsmer_charge'), link = projectile.find(c => '_linkDuration' in c);
  const actions = n.$template('enemy_ltsmer_s_1[modify_sp]')?.eventToActions.ON_BUFF_START;
  const regular = n.$ref(n.$ref(root._modes[0])._attack), trigger = n.$ref(n.$ref(root._modes[0])._attackTrigger);
  const target = n.$siblings(trigger).find(c => '_postFilter' in c);
  return regular?._projectileKey === 'projectile_enemy_ltsmer' && regular._damageType === 2 && regular._atkScale === 1
    && target?._targetMotion === 1 && link?._isSilenceable === 1 && link._keepAlreadyHitTime === 1
    && link._keepHitTarget === 1 && link._lifeTimeType === 2 && link._maxHitTimes === -1
    && projectile.some(c => c._speed === 10 && c._extendLenth === 15)
    && actions?.[0]?._spString === 'sp' && !actions[0]._modifyByRatio && !actions[0]._forceFlag
    && actions[2]._condType === 'LE' && actions[3]._resetCooldown === false;
}

export function shamanNative(r, n) {
  if (!['enemy_1089_ltlntc', 'enemy_1089_ltlntc_2'].includes(r.prefabKey) || r.skills.length || r.applyWay !== 'MELEE'
    || Object.keys(r.talents.groups).sort().join() !== 'boom,occupy,periodic_damage'
    || r.talents.bb['periodic_damage.damage'] !== 400 || r.talents.bb['occupy.sp'] !== -1
    || r.talents.bb['boom.atk_scale'] !== (r.prefabKey.endsWith('_2') ? 2.5 : 2)) return false;
  const root = n[r.prefabKey]?.[0], boom = n.boom?.find(c => '_projectileActions' in c), occupy = n.occupy?.find(c => '_projectileActions' in c);
  if (root?._modes.length !== 1 || root._commonAbilities.length) return false;
  for (const [part, projectile, side, category] of [[boom, 'projectile_enemy_ltlntc', 2, 1], [occupy, 'projectile_enemy_ltlntc_2', 1, 2]]) {
    const buff = part?._buffs?.[0], rows = n.$projectile(projectile), hit = rows.find(c => '_targetOptions' in c);
    const life = rows.find(c => '_lifeTime' in c), circle = rows.find(c => 'm_Radius' in c);
    if (part?._buffs.length !== 1 || buff.templateKey !== 'projectile_on_killed' || buff.lifeTimeType !== 2
      || buff.blackboard.length !== 1 || buff.blackboard[0].valueStr !== projectile
      || life?._lifeTime !== Math.fround(1.3) || life._alwaysReachInTheEnd !== 1 || life._stopWhenSourceInvalid !== 0
      || hit?._ignoreCamouflage !== 1 || hit._onlyCheckHitWhenReachTarget !== 1 || hit._targetOptions.targetSide !== side
      || hit._targetOptions.targetMotion !== 1 || hit._targetOptions.targetCategory !== category || hit._targetOptions.ignoreTargetFree !== 0
      || circle?.m_Radius !== 1.5 || circle.m_Offset.x !== 0 || circle.m_Offset.y !== 0) return false;
  }
  let actions;
  try { actions = JSON.parse(boom._projectileActions.SerializedState); } catch { return false; }
  const damage = actions?.[0], capture = n.$template('tower_t_3[be_enemy_instant]')?.eventToActions.ON_BUFF_START;
  const death = n.$template('projectile_on_killed')?.eventToActions.ON_OWNER_KILLED;
  return actions.length === 1 && damage._damageType === 'MAGICAL' && damage._attackType === 'SPLASH'
    && damage._forceUseProjectileCachedAtk && damage._applyWay === 'NONE' && !damage._skipModifierEvent
    && boom._projectileBuffs.length === 0 && occupy._projectileBuffs.length === 1
    && occupy._projectileBuffs[0].templateKey === 'tower_t_3[be_enemy_instant]'
    && capture?.[0]?._filterTag === 'tower' && capture[1]._modifyByRatio && !capture[1]._modifyByRatioBasedOnCurSP
    && !capture[1]._forceFlag && capture[1]._spString === 'sp' && capture[4]._modeIndex === 2
    && death?.[0]?._abnormalFlag === 'SILENCED' && death[0]._isUnset;
}
