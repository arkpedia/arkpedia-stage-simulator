// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-spider-animations.json' with { type: 'json' };
export const mutantSpider = r => ['enemy_1133_harchn', 'enemy_1133_harchn_2'].includes(r.prefabKey);
const node = (a, name) => a?.$type === `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
export function mutantSpiderNative(r, n) {
  if (!mutantSpider(r) || r.applyWay !== 'RANGED' || r.stats.dmgType !== 'phys' || r.skills.length !== 1 || r.sp) return false;
  const child = r.prefabKey.endsWith('_2') ? 'enemy_1138_tumor' : 'enemy_1137_plasm', s = r.skills[0];
  if (Object.keys(r.talents.bb).sort().join() !== 'deathrattle.cnt,deathrattle.delay,deathrattle.offset_bound'
    || r.talents.bb['deathrattle.cnt'] !== 4 || r.talents.bb['deathrattle.delay'] !== .2 || r.talents.bb['deathrattle.offset_bound'] !== .2
    || Object.keys(r.talents.bbStr).join() !== 'deathrattle.enemy_key' || r.talents.bbStr['deathrattle.enemy_key'] !== child
    || s.prefabKey !== 'SummonToken' || s.priority !== 1 || s.cooldown !== 5 || s.initCooldown !== 5 || s.spCost !== 0
    || Object.keys(s.bb).join() !== 'cnt' || s.bb.cnt !== 1 || Object.keys(s.bbStr).join() !== 'enemy_key' || s.bbStr.enemy_key !== child) return false;
  const root = n[r.prefabKey]?.find(c => '_modes' in c), mode = n.$ref(root?._modes?.[0]);
  const attack = n.$ref(mode?._attack), target = n.$ref(attack?._selector);
  const cast = n.SummonToken?.find(c => '_activeBuffs' in c), wrapper = n.SummonToken?.find(c => '_familyMask' in c);
  const graphic = n.$ref(root?._animator), clock = clocks.enemies[r.prefabKey];
  if (root?._modes.length !== 1 || root._commonAbilities.length || mode?._generalAbilities.length
    || n.$ref(mode._combat) !== attack || attack?._projectileKey !== 'projectile_enemy_harchn_attack'
    || attack._damageType !== 1 || attack._atkScale !== 1 || attack._attackType !== 1 || attack._activeBuffs.length
    || attack._timeMode !== 0 || attack._maxAnimScale !== 1 || attack._selectTargetSource !== 1
    || target?._targetSide !== 2 || target._targetMotion !== 1 || target._targetCategory !== 1 || target._postFilter !== 4
    || target._ignoreTargetFree !== 0 || target._forceIgnoreCamouflage !== 0 || target._limitTargetNum !== 1
    || wrapper?._familyMask !== 3 || wrapper._ignoreSilence !== 0 || wrapper._resetMainAbilityCdWhenCastEnd !== 0
    || wrapper._resetCdWaitFirstPeriod !== 1 || wrapper._maxTriggerTime !== -1
    || cast?._timeMode !== 1 || cast._allowNoTarget !== 1 || cast._selectTargetSource !== 1
    || n.$ref(cast._selector)?.m_Script?.m_PathID !== '8735719249224227112'
    || !clock || n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId) return false;
  for (const [ability, clip, duration, release] of [[attack, 'Attack', 1.5, Math.fround(.7)], [cast, 'Skill', 1, Math.fround(17 / 30)]]) {
    const binding = graphic._animations.find(a => a.animKey === clip), events = clock.events[clip];
    if (ability._animKey !== clip || ability._waitForAttackEvent !== 1 || ability._affectedBySlowDown !== 1 || ability._preDelay !== 0
      || binding?.animName !== clip || binding.speed !== 1 || binding.loop !== 0
      || clock.durations[clip] !== duration || events?.length !== 1 || events[0].name !== 'OnAttack' || events[0].time !== release) return false;
  }
  const projectile = n.$projectile('projectile_enemy_harchn_attack');
  const motion = projectile.find(c => '_speed' in c), life = projectile.find(c => '_lifeTime' in c);
  if (motion?._speed !== 12 || motion._flyToTargetLocationOnly !== 0 || motion._forceReachedWhenTimeup !== 1
    || life?._lifeTime !== 10 || life._maxHitNum !== 1 || life._hitNumType !== 1 || life._stopWhenSourceInvalid !== 0
    || life._alwaysHitTraceTargetInTheEnd !== 1 || life._canHitSameTargetMultipleTimes !== 0
    || life._actionController._extraBuffsInTheEnd.length) return false;
  const buff = cast._activeBuffs[0], deathBuff = n.deathrattle?.find(c => '_buffs' in c)?._buffs[0];
  if (cast._activeBuffs.length !== 1 || buff.templateKey !== 'harchn[sum_token]' || buff.isDamageMissable !== 0 || buff.lifeTimeType !== 0
    || deathBuff?.templateKey !== 'deathrattle_sum[walk_only]' || deathBuff.lifeTimeType !== 2) return false;
  const summon = n.$template('harchn[sum_token]')?.eventToActions.ON_BUFF_START;
  const death = n.$template('deathrattle_sum[walk_only]')?.eventToActions.ON_OWNER_KILLED;
  if (summon?.length !== 1 || death?.length !== 6 || !node(death[0], 'CheckAbnormalFlag') || death[0]._abnormalFlag !== 'SILENCED' || !death[0]._isUnset
    || !node(death[1], 'FilterDeathReason') || death[1]._finishReason !== 'FALLDOWN' || !node(death[2], 'IfNot')) return false;
  for (const [action, count, offset] of [[summon[0], 1, 0], [death[3], 0, Math.fround(.1)]])
    if (!node(action, 'SummonEnemiesFollowMyRoute') || action._summonCount !== count || action._delayTime !== 0
      || action._randomOffsetBound !== offset || action._useRandomDelay || !action._managedByScheduler || action._dontBlockWave
      || !action._trySummonOutsideWhenInObstacle || action._passableMask !== 'WALK_ONLY' || action._stopSummonIfHostDead || action._skipCheckPoint) return false;
  // The death projectile contains no damage or buff payload; its effect is cosmetic.
  return node(death[4], 'CreateEffect') && node(death[5], 'EmitProjectile') && !death[5]._actions.length && !death[5]._buffDataList.length;
}
export const SPIDER_FEATURE = {
  matchesRecord: mutantSpider,
  covers: mutantSpiderNative, nativeClaim: () => ({ wrappers: 1, active: 0 }),
  dependsOn: r => [r.skills[0].bbStr.enemy_key],
  ability: { kind: 'mutantSpider', params: r => {
    const clock = clocks.enemies[r.prefabKey], s = r.skills[0];
    return { child: s.bbStr.enemy_key, count: s.bb.cnt, deathCount: r.talents.bb['deathrattle.cnt'],
      deathDelay: r.talents.bb['deathrattle.delay'], radius: r.talents.bb['deathrattle.offset_bound'],
      attackAnim: { dur: clock.durations.Attack, hit: clock.events.Attack[0].time },
      cast: { initial: s.initCooldown, cooldown: s.cooldown, duration: clock.durations.Skill, release: clock.events.Skill[0].time } };
  } },
  explains: /^Periodically creates an <Originiutant (?:Excrescence|Tumor)>$/,
  note: 'silenceable five-second summon and four-child death split; ground projectile and retained source clocks',
};
