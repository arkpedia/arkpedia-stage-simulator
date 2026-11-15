// SPDX-License-Identifier: GPL-3.0-or-later
import animations from '../../data/arkpedia-snack-animations.json' with { type: 'json' };
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const positive = v => Number.isFinite(v) && v > 0;
export const vendor = r => ['enemy_1217_rescar', 'enemy_1217_rescar_2'].includes(r.prefabKey);
export const cart = r => ['enemy_1218_bomscr', 'enemy_1218_bomscr_2'].includes(r.prefabKey);
const child = r => r.prefabKey.endsWith('_2') ? 'enemy_1218_bomscr_2' : 'enemy_1218_bomscr';
const type = name => `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
function animationReviewed(r, n) {
  const source = animations.enemies[r.prefabKey], root = n[r.prefabKey]?.[0], animator = n.$ref(root?._animator);
  const skeleton = n.$ref(animator?._skeleton)?.skeletonDataAsset;
  const clip = animator?._animations?.find(a => a.animKey === 'Skill');
  const event = source?.events.Skill;
  return source?.source.skeletonDataPathId === skeleton?.m_PathID && clip?.animName === 'Skill' && clip.speed === 1 && clip.loop === 0
    && event?.length === 1 && event[0].name === 'OnAttack' && event[0].time === Math.fround((vendor(r) ? 13 : 8) / 30)
    && source.durations.Skill === Math.fround((vendor(r) ? 34 : 11) / 30);
}

export function vendorNative(r, n) {
  if (!vendor(r) || !animationReviewed(r, n) || r.applyWay !== 'RANGED' || Object.keys(r.talents.groups).join() !== 'shotbuff'
    || r.talents.groups.shotbuff.join() !== 'attack@combat_atk_scale' || !positive(r.talents.bb['shotbuff.attack@combat_atk_scale'])
    || r.sp?.maxSp !== 3 || r.sp.initSp !== 3 || r.sp.increment !== 0 || r.sp.type !== 'INCREASE_WITH_TIME'
    || r.skills.length !== 1 || r.skills[0].prefabKey !== 'BornCar' || r.skills[0].spCost !== 1
    || r.skills[0].cooldown !== 10 || r.skills[0].initCooldown !== 5 || Object.keys(r.skills[0].bb).length) return false;
  const [root] = n[r.prefabKey] ?? [], [mode] = n.Default ?? [], attack = n.$ref(mode?._attack), combat = n.$ref(mode?._combat);
  const selector = n.$siblings(mode?._attackTrigger).find(c => '_targetSide' in c);
  const wrapper = n.BornCar?.find(c => '_familyMask' in c), cast = n.BornCar?.find(c => '_actions' in c);
  const finish = n.$siblings(wrapper).find(c => '_runActionOnEvent' in c), buff = finish?._buffs?.[0];
  if (!root || root._modes.length !== 1 || n.$ref(root._modes[0]) !== mode || root._commonAbilities.length || mode._generalAbilities.length
    || attack?._projectileKey !== 'projectile_enemy_rescar' || attack._damageType !== 1 || attack._atkScale !== 1
    || attack._activeBuffs.length || attack._useCachedAtkOnly !== 0 || attack._waitForAttackEvent !== 1
    || combat?._damageType !== 1 || combat._atkScale !== 1 || combat._activeBuffs.length || '_projectileKey' in combat
    || combat._metadata.blackboardPrefix !== 'combat_' || !zero(combat._selector)
    || selector?._targetSide !== 2 || selector._targetMotion !== 1 || selector._maxNum !== 1
    || wrapper?._ignoreSilence !== 1 || wrapper._familyMask !== 3 || wrapper._maxTriggerTime !== -1
    || wrapper._immuneStunWhenAffecting !== 0 || wrapper._resetMainAbilityCdWhenCastEnd !== 0 || wrapper._castLikeAttack !== 0
    || n.$ref(wrapper._trigger)?.m_Script.m_PathID !== '-2995189732062982133'
    || cast?._allowNoTarget !== 1 || cast._waitForAttackEvent !== 1 || cast._affectedBySlowDown !== 1 || cast._actions.SerializedState !== '[]'
    || finish?._runActionOnEvent !== 4 || finish._extraCondition !== 0 || finish._onlyRunOnce !== 0 || finish._buffs.length !== 1
    || buff.templateKey !== 'enemy_rescar_skill[summon]' || buff.lifeTimeType !== 0 || buff.isSilenceable !== 0
    || buff.blackboard.length !== 1 || buff.blackboard[0].key !== 'enemy_key' || buff.blackboard[0].valueStr !== child(r)) return false;
  const events = n.$template('enemy_rescar_skill[summon]')?.eventToActions, [summon] = events?.ON_BUFF_START ?? [];
  if (Object.keys(events ?? {}).join() !== 'ON_BUFF_START' || events.ON_BUFF_START.length !== 1
    || summon.$type !== type('SummonEnemiesFollowMyRoute') || summon._source !== 'TARGET' || summon._summonCount !== 1
    || summon._delayTime !== Math.fround(.1) || !summon._managedByScheduler || summon._dontBlockWave
    || summon._stopSummonIfHostDead || summon._randomOffsetBound !== 0 || summon._offset.x !== 0 || summon._offset.y !== 0
    || summon._spawnOnHostRootTile || summon._useTargetPosition || summon._skipCheckPoint || summon._addBuffToEnemy) return false;
  const p = n.$projectile('projectile_enemy_rescar'), motion = p.find(c => '_speed' in c), life = p.find(c => '_lifeTime' in c);
  return motion?._speed === 5 && motion._flyToTargetLocationOnly === 0 && motion._forceReachedWhenTimeup === 1
    && life?._lifeTime === 10 && life._maxHitNum === 1 && life._hitNumType === 1 && life._stopWhenSourceInvalid === 0
    && life._alwaysHitTraceTargetInTheEnd === 1 && !life._canHitSameTargetMultipleTimes && !life._actionController._extraBuffsInTheEnd.length;
}

export function cartNative(r, n) {
  if (!cart(r) || !animationReviewed(r, n) || r.applyWay !== 'MELEE' || r.skills.length || Object.keys(r.talents.groups).join() !== 'boom'
    || r.talents.groups.boom.join() !== 'attack@s2mode_boom_atk,attack@s2mode_boom_atk_totrap,attack@s2mode_ep_fire_damage'
    || !Object.values(r.talents.bb).every(positive)) return false;
  const [root] = n[r.prefabKey] ?? [], [normal] = n.Default ?? [], armed = n.Boom?.find(c => '_combat' in c);
  const aura = n.Boom?.find(c => '_checker' in c), checker = n.$ref(aura?._checker), toggle = aura?._buffs?.[0];
  if (!root || root._modes.length !== 2 || n.$ref(root._modes[0]) !== normal || n.$ref(root._modes[1]) !== armed
    || root._commonAbilities.length || !zero(normal._attack) || !zero(armed._attack)
    || normal._generalAbilities.length || armed._generalAbilities.length
    || checker?._blockMinCnt !== 1 || checker._blockMaxCnt !== -1 || checker._useBlockAsMin !== 1 || checker._buffsToBlockee.length
    || aura._isInverseToggle !== 0 || aura._buffsWhenToggleOff.length || aura._buffs.length !== 1
    || toggle.templateKey !== 'enemy_bomscr_boom_switch_mode' || toggle.triggerInterval !== Math.fround(.1)
    || toggle.waitFirstTriggerInterval !== 0 || toggle.lifeTimeType !== 2) return false;
  for (const [mode, scale] of [[normal, 1], [armed, 0]]) {
    const attack = n.$ref(mode._combat);
    if (attack?._damageType !== 1 || attack._atkScale !== scale || attack._activeBuffs.length
      || attack._waitForAttackEvent !== 1 || attack._metadata.blackboardPrefix !== (scale ? '' : 's2mode_')) return false;
  }
  const finish = n.$siblings(armed._combat).find(c => '_runActionOnEvent' in c), buff = finish?._buffs?.[0];
  const switched = n.$template('enemy_bomscr_boom_switch_mode')?.eventToActions?.ON_BUFF_TRIGGER;
  if (finish?._runActionOnEvent !== 4 || finish._buffs.length !== 1 || buff.templateKey !== 'enemy_bomscr_boom_and_killself'
    || buff.lifeTimeType !== 0 || buff.blackboard[0]?.valueStr !== 'x-4' || switched?.length !== 2
    || switched[0]._abnormalFlag !== 'SILENCED' || !switched[0]._isUnset || switched[1]._modeIndex !== 1 || switched[1]._restoreDefault) return false;
  const actions = n.$template('enemy_bomscr_boom_and_killself')?.eventToActions?.ON_BUFF_START;
  const area = actions?.[1], blocker = actions?.[2], kill = actions?.[4];
  if (actions?.length !== 5 || area.$type !== type('CreateBuffInRange') || area._rangeId !== 'x-4' || area._useRadius
    || area._targetOptions.targetSide !== 'ENEMY' || area._targetOptions.targetMotion !== 'WALK_ONLY'
    || area._targetOptions.ignoreTargetFree || !area._excludeCurAtkTarget || area._buffs[0]?.templateKey !== 'enemy_bomscr_boom_damage'
    || blocker.$type !== type('CreateBuffToBlockee') || blocker._buff.templateKey !== 'enemy_bomscr_boom_damage'
    || kill.$type !== type('InstantKill') || !kill._killSource || kill._noSource || kill._markReachExit) return false;
  const [choose] = n.$template('enemy_bomscr_boom_damage')?.eventToActions?.ON_BUFF_START ?? [];
  const [trap] = choose?._succeedNodes ?? [], [hit, next, element] = choose?._failNodes ?? [];
  return choose?._conditionNode?._filterTag === 'TAG_TRAP_WPNSTS' && choose._succeedNodes.length === 1 && choose._failNodes.length === 3
    && [trap, hit].every(a => a.$type === type('FixedValueDamage') && a._damageType === 'MAGICAL' && a._attackType === 'SPLASH'
      && !a._ignoreForSp && !a._noSourceDamage && !a._skipModifierEvent && !a._isEnvDamage)
    && trap._damageKey === 'boom_atk_totrap' && hit._damageKey === 'boom_atk' && next.$type === type('AlwaysNext')
    && element.$type === type('ApplyElementDamage') && element._sourceType === 'BUFF_OWNER' && element._targetType === 'TARGET'
    && element._isFixedEpDamage && element._elementDamageType === 'FIRE' && element._fixedEpDamageKey === 'ep_fire_damage' && !element._noSource
    && n.$range('x-4')?.grids.length === 9 && n.$range('x-4').grids.every(p => Math.abs(p.row) <= 1 && Math.abs(p.col) <= 1);
}

const castClock = r => ({ windup: animations.enemies[r.prefabKey].events.Skill[0].time, castTime: animations.enemies[r.prefabKey].durations.Skill });
export const cartAbility = { kind: 'blockedCartBlast', params: r => ({ ...castClock(r), damage: r.talents.bb['boom.attack@s2mode_boom_atk'],
  deviceDamage: r.talents.bb['boom.attack@s2mode_boom_atk_totrap'], element: r.talents.bb['boom.attack@s2mode_ep_fire_damage'],
  range: [-1, 0, 1].flatMap(r => [-1, 0, 1].map(c => [r, c])) }) };
export const SNACK_ENEMY_FEATURES = {
  'skill:BornCar': { covers: vendorNative, nativeClaim: () => ({ wrappers: 1 }), dependsOn: r => [child(r)],
    ability: { kind: 'ammoSummoner', params: r => ({ ...castClock(r), max: r.sp.maxSp, initial: r.sp.initSp,
      cooldown: r.skills[0].cooldown, initialCooldown: r.skills[0].initCooldown, child: child(r), meleeScale: r.talents.bb['shotbuff.attack@combat_atk_scale'] }) },
    explains: /^(While this unit is holding Ammo, periodically summons a <(?:Luscious )?Snack Cart>\. Ammo capacity: 3|Deals significantly increased damage to enemies blocking this unit)$/,
    note: 'Bounded ammunition feeds delayed route-following summons; native Physical ranged and scaled direct melee combat' },
};
