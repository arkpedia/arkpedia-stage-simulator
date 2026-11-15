// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-power-armor-animations.json' with { type: 'json' };
import { sameOutcomeValue as same, nativeKillLog, passiveOutcomeBuff } from './enemy-outcome-contracts.js';
export const isAssaultPowerArmor = r => ['enemy_1256_lyacpa','enemy_1256_lyacpa_2'].includes(r.prefabKey);
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';
export function assaultPowerArmorNative(r,n) {
  if (!isAssaultPowerArmor(r) || r.key !== r.prefabKey || r.applyWay !== 'RANGED' || r.stats.motion !== 'WALK'
    || r.stats.dmgType !== 'phys' || r.skills.length || r.sp
    || !same(r.talents,{bb:{'Passive.attack@ranged.atk_scale':.5},bbStr:{},groups:{Passive:['attack@ranged.atk_scale']}})
    || !same(r.abilities,[{text:'Attacks 4 enemies simultaneously',format:'NORMAL'}])) return false;
  const root=n[r.prefabKey]?.[0], mode=n.$ref(root?._modes?.[0]), combat=n.$ref(mode?._combat), attack=n.$ref(mode?._attack);
  const selector=n.$ref(attack?._selector), trigger=n.$ref(mode?._attackTrigger), log=n.$ref(root?._commonAbilities?.[0]);
  const clock=clocks.enemies[r.prefabKey], graphic=n.$ref(root?._animator);
  if (root?._modes.length !== 1 || root._commonAbilities.length !== 1 || mode?._generalAbilities.length
    || n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId
    || !nativeKillLog(n) || log?._buffs.length !== 1 || !passiveOutcomeBuff(log._buffs[0])
    || log._buffs[0].templateKey !== 'log_killed' || log._buffs[0].blackboard.length || !zero(log._selector)) return false;
  for(const [a,clip,script] of [[combat,'Attack_2','4381884627089348317'],[attack,'Attack','4156651312234227407']]) {
    if(a?.m_Script.m_PathID!==script || a._damageType!==1 || a._attackType!==1 || a._atkScale!==1
      || a._activeBuffs.length || a._epDamageRatio!==0 || a._extraDamageType!==0 || a._preDelay!==0
      || a._animKey!==clip || a._timeMode!==0 || a._waitForAttackEvent!==1 || a._affectedBySlowDown!==1
      || a._atkScaleKey!=='atk_scale' || clock.durations[clip]!==2
      || !same(clock.events[clip],[{time:Math.fround(5/6),name:'OnAttack',int:0,float:0,string:''}]))return false;
  }
  if(!zero(combat._selector) || combat._selectTargetSource!==2 || combat._selectTargetTiming!==0
    || attack._projectileKey!=='projectile_enemy_lyacpa' || attack._extraProjectileKeys.length
    || attack._selectTargetSource!==1 || attack._selectTargetTiming!==1 || attack._useCachedAtkOnly!==0
    || attack._projectileDestination!==0 || attack._waitForProjectileInvalid!==0
    || attack._metadata.blackboardPrefix!=='ranged.' || trigger?._keepTarget!==0 || trigger._minTargetNum!==1
    || selector?._limitTargetNum!==1 || selector._maxNum!==4 || selector._maxTargetKey!=='max_target'
    || selector._targetSide!==2 || selector._targetMotion!==1 || selector._targetCategory!==1
    || selector._postFilter!==4 || selector._ignoreHitRange!==0 || selector._forceIgnoreCamouflage!==0
    || selector._ignoreTargetFree!==0 || selector._ignoreMotionMode!==0 || selector._needProfessionMask!==0) return false;
  const parts=n.$projectile('projectile_enemy_lyacpa'), motion=parts.find(c=>'_speed'in c), life=parts.find(c=>'_lifeTime'in c);
  return motion?.m_Script.m_PathID==='-1429203677512073985' && motion._speed===10 && motion._moveType===1
    && motion._flyToTargetLocationOnly===0 && motion._forceReachedWhenTimeup===1 && motion._delayToStart===0
    && motion._deltaSpeedPerSec===0 && life?._lifeTime===10 && life._stopWhenSourceInvalid===0
    && life._maxHitNum===1 && life._hitNumType===1 && life._alwaysHitTraceTargetInTheEnd===1
    && life._canHitSameTargetMultipleTimes===0 && life._actionController._dontAddBuffs===0
    && life._actionController._extraBuffsInTheEnd.length===0;
}
export const ASSAULT_POWER_ARMOR_ABILITY = {kind:'blockedMeleeProjectileAttack',params:r=>({
  speed:10,lifetime:10,type:'phys',killedKey:'killed',maxTargets:4,rangedScale:r.talents.bb['Passive.attack@ranged.atk_scale'],
  attackAnim:{dur:clocks.enemies[r.prefabKey].durations.Attack,hit:clocks.enemies[r.prefabKey].events.Attack[0].time},
})};
