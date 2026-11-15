// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-heavy-power-armor-animations.json' with {type:'json'};
import {sameOutcomeValue as same,nativeKillLog,passiveOutcomeBuff} from './enemy-outcome-contracts.js';
const matchesRecord=r=>['enemy_1255_lybgpa','enemy_1255_lybgpa_2'].includes(r.prefabKey);
const type=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
export function heavyPowerArmorNative(r,n){
  if(!matchesRecord(r)||r.key!==r.prefabKey||r.skills.length!==1||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.sp
    ||!same(r.talents,{bb:{},bbStr:{},groups:{}}))return false;
  const elite=r.prefabKey.endsWith('_2'),s=r.skills[0],root=n[r.prefabKey]?.[0],mode=n.$ref(root?._modes?.[0]),combat=n.$ref(mode?._combat);
  const clock=clocks.enemies[r.prefabKey],graphic=n.$ref(root?._animator),wrapper=n.Punch?.find(c=>'_familyMask'in c),seq=n.Punch?.find(c=>'_abilities'in c),main=n.PunchMain?.[0];
  if(s.prefabKey!=='Punch'||s.cooldown!==20||s.initCooldown!==0||s.spCost!==0||!same(s.bb,{stun:elite?1:2,atk_scale:elite?.5:.75,duration:10,unmovable_duration:1})
    ||Object.keys(s.bbStr).length||root?._modes.length!==1||root._commonAbilities.length!==2||mode?._generalAbilities.length
    ||n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID!==clock.source.skeletonDataPathId
    ||combat?._damageType!==1||combat._atkScale!==1||combat._activeBuffs.length||combat._animKey!=='Attack'
    ||wrapper?._familyMask!==3||wrapper._ignoreSilence!==0||wrapper._resetCdWaitFirstPeriod!==1||wrapper._maxTriggerTime!==-1
    ||!same(seq?._abilities?.map(n.$ref),[main,n.PunchEnd?.[0]])||seq._enableLoop!==0||seq._alwaysNext!==1
    ||!same(main?._abilities?.map(n.$ref),[n.ReleaseFromBlocker?.[0],n.PunchReleaseLasso?.[0],n.FirstPunch?.[0],n.KeepPunch?.[0]])
    ||main._enableLoop!==1||main._interruptIfTargetDead!==1||main._abilityLoopSettings.length!==1||main._abilityLoopSettings[0].loopIndex!==3)return false;
  const selector=n.$ref(main._selector),validator=n.$ref(main._abilityLoopSettings[0].validator);
  if(selector?._targetSide!==2||selector._targetMotion!==1||selector._targetCategory!==1||selector._postFilter!==4||selector._maxNum!==1
    ||selector._ignoreTargetFree!==0||selector._forceIgnoreCamouflage!==0||!same(validator?._buffs,['lybgpa[keep_punch]'])||validator._excludeKey!==0)return false;
  for(const [name,clip,hits]of [['FirstPunch','Skill_Begin',[Math.fround(.3)]],['KeepPunch','Skill_Loop',[.5,1.5]]]){
    const a=n[name]?.[0],buff=a?._activeBuffs?.[0];
    if(a?._damageType!==1||a._atkScale!==1||a._attackType!==1||a._timeMode!==1||a._affectedBySlowDown!==1||a._preDelay!==0
      ||a._animKey!==clip||a._waitForAttackEvent!==1||a._activeBuffs.length!==1||a._selectTargetSource!==2||a._selectTargetTiming!==0
      ||buff?.buffKey!=='stun'||buff.loadFromDB!==1||buff.lifeTimeType!==1||buff.blackboard.length
      ||!same(clock.events[clip]?.map(e=>[e.name,e.time]),hits.map(t=>['OnAttack',t])))return false;
  }
  if(n.KeepPunch[0]._additionalTimes!==1||n.KeepPunch[0]._waitAttackEventForAllAttacks!==1||n.KeepPunch[0]._splitDamage!==0
    ||clock.durations.Skill_Begin!==.5||clock.durations.Skill_Loop!==2
    ||n.PunchEnd?.[0]._timeMode!==3||n.PunchEnd[0]._cooldownKey!=='unmovable_duration'||n.PunchEnd[0]._affectedBySlowDown!==0)return false;
  const release=n.ReleaseFromBlocker?.[0],mark=n.PunchReleaseLasso?.[0],lasso=n.InturruptLasso?.[0];
  if(release?._buffs.length!==2||release._buffs[0].templateKey!=='enemy_lybgpa[release_from_blocker]'
    ||release._buffs[1].buffKey!=='lybgpa[keep_punch]'||release._buffs[1].templateKey!=='empty'||release._buffs[1].lifeTimeType!==1
    ||mark?._activeBuffs[0]?.templateKey!=='enemy_lybgpa[keep_punch_mark]'||mark._atkScale!==0
    ||lasso?._projectileKey!=='projectile_enemy_lybgpa'||lasso._atkScale!==0||lasso._activeBuffs.length||lasso._waitForProjectileInvalid!==1)return false;
  if(!same(n.$template('enemy_lybgpa[release_from_blocker]')?.eventToActions,{ON_BUFF_START:[{$type:type('ReleaseFromBlocker'),_target:'BUFF_OWNER'}]})
    ||!same(n.$template('enemy_lybgpa[keep_punch_mark]')?.eventToActions,{ON_BUFF_START:[{$type:type('TriggerAbility'),_ownerType:'BUFF_SOURCE',_targetType:'BUFF_OWNER',
      _abilityName:'InturruptLasso',_checkCanUseAblityFlag:false,_castDirectly:false,_useFirstActiveAbility:false,_useCastResult:false}]}))return false;
  const common=root._commonAbilities.map(n.$ref),log=common.find(a=>a?._buffs);
  if(!common.includes(lasso)||log?._buffs?.length!==1||!passiveOutcomeBuff(log._buffs[0])
    ||log._buffs[0].templateKey!=='log_killed'||log._buffs[0].blackboard.length||!nativeKillLog(n))return false;
  const projectile=n.$projectile('projectile_enemy_lybgpa'),link=projectile.find(c=>'_linkDuration'in c),motion=projectile.find(c=>'_speed'in c);
  return motion?._speed===50&&link?._isSilenceable===0&&link._lifeTime===1000&&link._linkDuration===1000&&link._maxHitTimes===-1
    &&link._actionController._detachAllBuffsWhenStopped===1&&link._actionController._extraBuffsInTheEnd.length===0;
}
export const HEAVY_POWER_ARMOR_FEATURES={
  'skill:Punch':{matchesRecord,covers:heavyPowerArmorNative,nativeClaim:()=>({wrappers:1,active:2}),
    explains:/^\[Overload\] Continuously deals Physical damage to the target proportional to the unit's ATK, and<\$ba.stun>Stuns<\/> the target$/,
    ability:{kind:'heavyPowerArmor',params:r=>{
      const c=clocks.enemies[r.prefabKey],s=r.skills[0];return{initial:s.initCooldown,cooldown:s.cooldown,scale:s.bb.atk_scale,stun:s.bb.stun,
        duration:s.bb.duration,recovery:s.bb.unmovable_duration,begin:c.durations.Skill_Begin,loop:c.durations.Skill_Loop,endClip:c.durations.Skill_End,
        firstHits:c.events.Skill_Begin.map(e=>e.time),loopHits:c.events.Skill_Loop.map(e=>e.time),attackAnim:{dur:c.durations.Attack,hit:c.events.Attack[0].time}};}},
    note:'Source opening/loop/end sequence retains one target life after releasing its block; the cast uses original event clocks.'},
};
