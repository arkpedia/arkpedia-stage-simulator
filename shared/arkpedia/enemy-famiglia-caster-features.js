import {nativeUnscaledTalentBinding} from './enemy-talent-binding-contract.js';
// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-famiglia-casters-animations.json' with{type:'json'};
import {sameOutcomeValue as same,passiveOutcomeBuff,nativeKillLog} from './enemy-outcome-contracts.js';
import {ordinaryProjectilePacketNative,ordinaryRangedSelectorNative,linearSingleProjectileNative} from './enemy-ordinary-projectile-contract.js';
import {nativeTaggedDeviceSpSelector,nativeSelectedSpRewardBuff} from './enemy-device-sp-selector-contract.js';
import {nativeBuffProgram,nativeBuffProgramSupported} from './native-buff-programs.js';
const ids=['enemy_1280_sgmag','enemy_1280_sgmag_2'],key='enemy_sgmag_s_modify_vg';
export const isFamigliaCaster=r=>!!r&&ids.includes(r.prefabKey);
export const FAMIGLIA_CASTER_DESCRIPTION='Can stop attacking to continually increase Blood Debt';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const type=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
export function famigliaCasterNative(r,n){
 if(!isFamigliaCaster(r)||r.level!==0||r.applyWay!=='RANGED'||r.stats.dmgType!=='arts'||r.stats.motion!=='WALK'||r.stats.rangeRadius!==(r.prefabKey.endsWith('_2')?2.5:2.2)||r.sp||r.notCountInTotal
  ||!same(r.abilities,[{text:'Attacks two targets simultaneously.',format:'NORMAL'},{text:FAMIGLIA_CASTER_DESCRIPTION,format:'NORMAL'}])||!same(r.talents,{bb:{},bbStr:{},groups:{}})
  ||!same(r.skills,[{prefabKey:'AddVG',priority:0,cooldown:10,initCooldown:5,spCost:0,bb:{sp:5,duration:8},bbStr:{}}]))return false;
 const root=n[r.prefabKey]?.find(v=>v._modes),mode=n.$ref(root?._modes?.[0]),wrapper=n.AddVG?.find(v=>'_familyMask'in v),parts=n.$siblings(wrapper),action=parts.find(v=>v.m_Script?.m_PathID==='8145049199648393782'),buffs=parts.find(v=>v._buffs),animation=parts.find(v=>v._default),trigger=n.$ref(wrapper?._trigger),check=n.$siblings(trigger).find(v=>'_checkNotContainBuffs'in v),passive=n.Passive?.find(v=>v._buffs);
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_onlyDelayToBornOnTileStart:0,_idleWhenBorn:0,_canNotExit:0,_blockVolume:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]}})||root._modes.length!==1||root._commonAbilities.length!==1
  ||!mode||mode._generalAbilities.length||!same(mode._combat,mode._attack)||[root._animator,...root._modes,...root._commonAbilities,mode._combat,mode._attack,mode._attackTrigger].some(v=>v.m_FileID!==0)
  ||n.$ref(mode._attack)._selector.m_FileID!==0||n.$ref(n.$ref(mode._attack)._selector)!==n.$siblings(n.$ref(mode._attackTrigger)).find(v=>'_targetSide'in v)
  ||!ordinaryProjectilePacketNative(n.$ref(mode._attack),{projectileKey:'projectile_enemy_sgmag',type:2,selectTargetSource:1,selector:n.$ref(mode._attack)._selector})||!ordinaryRangedSelectorNative(n,n.$ref(mode._attackTrigger),{radius:Math.fround(2.2),abnormalFlag:23,maxTargets:2})
  ||!linearSingleProjectileNative(n,'projectile_enemy_sgmag',{speed:10,lifetime:10})||!nativeTaggedDeviceSpSelector(n,root._commonAbilities[0]))return false;
 if(!fields(wrapper,{m_Script:{m_FileID:1,m_PathID:'-5087399121287503180'},_familyMask:3,_checkParentActive:0,_maxTriggerTime:-1,_resetMainAbilityCdWhenCastEnd:0,_resetCdWaitFirstPeriod:1,_overwriteInitCooldown:-1,_ignoreSilence:0,_immuneStunWhenAffecting:0,_addEnemyIdToSignalId:1,_castLikeAttack:0})||wrapper._trigger.m_FileID!==0
  ||!fields(trigger,{m_Script:{m_FileID:1,m_PathID:'8607874384982393801'},_keepTarget:0,_minTargetNum:1,_overrideSearchTargetTick:-1})
  ||!fields(check,{m_Script:{m_FileID:1,m_PathID:'-928041209999387916'},_checkHpRatioCondition:0,_maxRatio:0,_checkNotContainBuffs:1,_checkContainBuffs:0,_checkBuffStackCount:0,_buffStackCount:0,_buffStackCountCompareType:2,_buffStackCountFromBB:0,_buffStackCountBBKey:'value',_buffKeys:['vgctrl_s[aura]'],_checkDistToExit:0,_distToExitCompareType:2,_distToExitBBKey:'dist'}))return false;
 if(!fields(action,{_selector:{m_FileID:0,m_PathID:'0'},_metadata:{namedAsAlias:'',blackboardPrefix:''},_interruptAbilityOnDetach:0,_ignoreIfOwnerDead:0,_forceAsDmgOrHealAbility:0,_waitForAttackEvent:1,_interuptIfTargetDead:0,_resetCdStrategy:1,_selectTargetSource:1,_selectTargetTiming:0,_timeMode:3,_alwaysIncludeTarget:1,_allowNoTarget:1,_animKey:'',_endAnimKey:'',_cooldown:0,_cooldownKey:'duration',_preDelay:0,_escapeTime:0,_activeBuffs:[],_maxAnimScale:-1,_affectedBySlowDown:0}))return false;
 if(!fields(animation,{m_Script:{m_FileID:1,m_PathID:'680305599797508032'},_default:{beginAnim:'Skill_Begin',loopAnim:'Skill_Loop',endAnim:'Skill_End'},_overrideDownAnimation:0,_down:{beginAnim:'',loopAnim:'',endAnim:''},_overrideUpAnimation:0,_up:{beginAnim:'',loopAnim:'',endAnim:''},_faceToFront:0,_faceToDefault:0,_waitForAttachFinishEvent:0,_earlyFinishEndIdleAnimation:0,_fireAttackFinishEvent:0,_delayToFireAttackSkillEvent:0,_delaySecond:0,_fireAnimEndEvent:0,_dontPlayBeginAnimFromInterrupted:0,_onlyPlayBeginAnimWhenFirstAttack:0,_delayToAnimateEndAnimation:0,_delayToAnimateEndAnimationTime:0,_playIdleAnimInTheEnd:0})
  ||!fields(buffs,{m_Script:{m_FileID:1,m_PathID:'1339719624887862345'}})||buffs._buffs.length!==2||buffs._buffs.some(v=>!passiveOutcomeBuff(v)||!same(v.blackboard,[])||v.overrideType!==0)
  ||!fields(buffs._buffs[0],{buffKey:key,templateKey:key,triggerLifeType:2,triggerInterval:1,waitFirstTriggerInterval:1,firstTriggerInterval:-1})
  ||!fields(buffs._buffs[1],{buffKey:'enemy_sgmag_s_effect',templateKey:'empty',triggerLifeType:0,triggerInterval:1}))return false;
 if(!fields(passive,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0,_interruptAbilityOnDetach:0})||passive._buffs.length!==1||!passiveOutcomeBuff(passive._buffs[0])||!fields(passive._buffs[0],{buffKey:'enemy_sgmag_dead_log',templateKey:'log_killed',blackboard:[]})||!nativeKillLog(n)||!nativeUnscaledTalentBinding(n,passive))return false;
 const expected={templateKey:key,effectKey:'',onEventPriority:'DEFAULT',eventToActions:{ON_BUFF_TRIGGER:[{$type:type('CreateBuffUseAbilitySelector'),_sourceType:'BUFF_OWNER',_targetType:'BUFF_OWNER',_abilityName:'SelectVg',_excludeTarget:false,_excludeTargetType:'SOURCE',_buff:{...nativeSelectedSpRewardBuff(key),triggerInterval:1},_isDerivedBuff:true,_finishDerivedBuffIfParentFinish:true}]}};
 const clock=clocks.enemies[r.prefabKey],graphic=n.$ref(root._animator);
 return same(n.$template(key),expected)&&same(n.$template('empty')?.eventToActions,{})&&nativeBuffProgramSupported('modify_sp[start]',n)
  &&n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&['Attack','Skill_Begin','Skill_Loop','Skill_End'].every(clip=>graphic._animations.some(v=>v.animKey===clip&&v.animName===clip&&v.speed===1&&!!v.loop===(clip==='Skill_Loop')))
  &&clock.durations.Attack===Math.fround(40/30)&&same(clock.events.Attack,[{time:Math.fround(14/30),name:'OnAttack',int:0,float:0,string:''}])
  &&clock.durations.Skill_Begin===.5&&clock.durations.Skill_End===.5&&clock.durations.Skill_Loop===Math.fround(40/30)&&['Skill_Begin','Skill_Loop','Skill_End'].every(k=>!clock.events[k]?.length);
}
export const FAMIGLIA_CASTER_FEATURES={
 'skill:AddVG':{matchesRecord:isFamigliaCaster,covers:famigliaCasterNative,nativeClaim:()=>({wrappers:1,active:1}),explains:text=>text===FAMIGLIA_CASTER_DESCRIPTION,ability:{kind:'channelledSpEmitter',params:r=>({
  attack:{type:'arts',speed:10,lifetime:10,noAir:false,animation:{clip:'Attack',duration:clocks.enemies[r.prefabKey].durations.Attack,releases:clocks.enemies[r.prefabKey].events.Attack.map(v=>v.time),maxScale:1}},
  channel:{initial:5,cooldown:10,duration:8,interval:1,buffKey:key,markerKeys:['enemy_sgmag_s_effect'],excludedBuff:'vgctrl_s[aura]',begin:{clip:'Skill_Begin',duration:.5},loop:{clip:'Skill_Loop'},end:{clip:'Skill_End',duration:.5}},selector:{tag:'vgctrl',side:'both',maxTargets:1},blackboard:{sp:5},program:nativeBuffProgram('modify_sp[start]')})}},
 'native:famigliaCasterLog':{matchesRecord:isFamigliaCaster,covers:famigliaCasterNative,ability:{kind:'stageOutcomeCounter',params:()=>({killedKey:'killed',buffKey:'enemy_sgmag_dead_log'})}},
};
