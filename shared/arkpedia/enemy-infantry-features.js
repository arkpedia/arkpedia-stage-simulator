// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-infantry-animations.json' with { type: 'json' };
export const isInfantry = r => ['enemy_1143_merrpg', 'enemy_1143_merrpg_2'].includes(r.prefabKey);
export function infantryNative(r, n) {
  if (!isInfantry(r) || r.skills.length || r.sp
    || r.applyWay !== 'ALL' || r.stats.dmgType !== 'phys' || Object.keys(r.talents.bbStr).length
    || Object.keys(r.talents.bb).sort().join() !== 'Combat.attack@atk_scale,MoveSpeedUp.move_speed'
    || r.talents.bb['Combat.attack@atk_scale'] !== 2 || r.talents.bb['MoveSpeedUp.move_speed'] !== 2) return false;
  const root = n[r.prefabKey]?.find(c => '_modes' in c), modes = root?._modes.map(ref => n.$ref(ref));
  const ranged = n.$ref(modes?.[0]?._attack), melee = n.$ref(modes?.[1]?._combat);
  const target = n.$siblings(modes?.[0]?._attackTrigger).find(c => '_targetSide' in c);
  const hook = n.$siblings(modes?.[0]?._attack).find(c => '_runActionOnEvent' in c), buff = hook?._buffs?.[0];
  const speed = n.MoveSpeedUp?.find(c => '_buffs' in c)?._buffs[0], modifier = speed?.attributes.attributeModifiers;
  const graphic = n.$ref(root?._animator), clock = clocks.enemies[r.prefabKey];
  if (modes?.length !== 2 || root._commonAbilities.length || modes.some(m => m._generalAbilities.length)
    || n.$ref(modes[0]._combat) !== ranged || modes[1]._attack.m_PathID !== '0' || modes[1]._attackTrigger.m_PathID !== '0'
    || ranged?._projectileKey !== 'projectile_enemy_merrpg' || ranged._damageType !== 1 || ranged._atkScale !== 1
    || ranged._timeMode !== 1 || ranged._selectTargetSource !== 2 || ranged._activeBuffs.length
    || melee?._damageType !== 1 || melee._atkScale !== 1 || melee._activeBuffs.length || melee._timeMode !== 0
    || target?._targetSide !== 2 || target._targetMotion !== 1 || target._targetCategory !== 1 || target._postFilter !== 4
    || target._ignoreTargetFree !== 0 || target._forceIgnoreCamouflage !== 0 || target._limitTargetNum !== 1
    || hook?._runActionOnEvent !== 4 || hook._extraCondition !== 0 || hook._onlyRunOnce !== 0 || hook._buffs.length !== 1
    || buff.templateKey !== 'switch_mode_restart_fsm_when_trigger' || buff.triggerInterval !== Math.fround(1.14)
    || buff.waitFirstTriggerInterval !== 1 || buff.triggerLifeType !== 1 || buff.triggerCnt !== 1 || buff.lifeTimeType !== 2
    || buff.isSilenceable !== 0 || buff.isStunnable !== 0 || buff.isFreezable !== 0
    || buff.blackboard.length !== 1 || buff.blackboard[0].key !== 'mode' || buff.blackboard[0].value !== 1
    || speed?.templateKey !== 'empty' || speed.isSilenceable !== 0 || speed.lifeTimeType !== 2
    || modifier?.length !== 1 || modifier[0].attributeType !== 6 || modifier[0].formulaItem !== 1 || modifier[0].loadFromBlackboard !== 1
    || !clock || n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId) return false;
  for (const [ability, key, clip, duration, hit] of [[ranged, 'Attack', 'Attack_A', Math.fround(53 / 30), .5], [melee, 'Attack_2', 'Attack_B', 1, Math.fround(.4)]]) {
    const binding = graphic._animations.find(a => a.animKey === key), events = clock.events[clip];
    if (ability._waitForAttackEvent !== 1 || ability._affectedBySlowDown !== 1 || ability._preDelay !== 0
      || binding?.animName !== clip || binding.speed !== 1 || binding.loop !== 0
      || clock.durations[clip] !== duration || events?.length !== 1 || events[0].name !== 'OnAttack' || events[0].time !== hit) return false;
  }
  const move = graphic._animations.find(a => a.animKey === 'Move_2');
  const aliases = n.$ref(modes[1]._animatorHooker)?._replaceAnimPairs;
  if (move?.animName !== 'Move_B' || move.speed !== .5 || move.loop !== 1 || aliases?.length !== 5
    || !['Move', 'Idle', 'Attack', 'Die', 'Default'].every(k => aliases.some(a => a.fromAnimKey === k && a.toAnimKey === `${k}_2`))) return false;
  const actions = n.$template('switch_mode_restart_fsm_when_trigger')?.eventToActions, change = actions?.ON_BUFF_TRIGGER;
  if (change?.length !== 1 || !change[0].$type.endsWith('SwitchMode, Assembly-CSharp') || !change[0]._loadModeFromBlackboard
    || !change[0]._restartFSM || change[0]._restoreDefault) return false;
  const p = n.$projectile('projectile_enemy_merrpg'), motion = p.find(c => '_speed' in c), life = p.find(c => '_lifeTime' in c);
  const area = p.find(c => '_targetOptions' in c), box = p.find(c => 'm_Size' in c);
  return motion?._speed === 5 && motion._flyToTargetLocationOnly === 0 && motion._forceReachedWhenTimeup === 1
    && life?._lifeTime === 10 && life._maxHitNum === 1 && life._hitNumType === 2 && life._stopWhenSourceInvalid === 0
    && life._alwaysHitTraceTargetInTheEnd === 1 && life._canHitSameTargetMultipleTimes === 0 && !life._actionController._extraBuffsInTheEnd.length
    && area?._onlyCheckHitWhenReachTarget === 1 && area._ignoreCamouflage === 1 && area._targetOptions.targetSide === 2
    && area._targetOptions.targetMotion === 3 && area._targetOptions.targetCategory === 1 && area._targetOptions.ignoreTargetFree === 0
    && box?.m_Size.x === 3 && box.m_Size.y === 3 && box.m_Offset.x === 0 && box.m_Offset.y === 0;
}
export const INFANTRY_ATTACK = { covers: infantryNative, ability: { kind: 'singleGrenadeInfantry', params: r => {
    const c = clocks.enemies[r.prefabKey];
    return { scale: r.talents.bb['Combat.attack@atk_scale'], move: r.talents.bb['MoveSpeedUp.move_speed'], switchDelay: Math.fround(1.14),
      rangedAnim: { dur: c.durations.Attack_A, hit: c.events.Attack_A[0].time },
      meleeAnim: { dur: c.durations.Attack_B, hit: c.events.Attack_B[0].time } };
  } }, explains: /^Can fire a super long-range grenade, dealing AoE Physical damage$/ };
export const INFANTRY_FEATURES = {
  'talent:MoveSpeedUp': { covers: infantryNative,
    explains: /^After firing, significantly increases Movement Speed and can only perform melee attacks$/ },
};
