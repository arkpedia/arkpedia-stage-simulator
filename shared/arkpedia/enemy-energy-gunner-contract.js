// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty} from './enemy-outcome-contracts.js';
import {energyGrantProgramNative,sourceEnergyGrantBuff} from './enemy-energy-grant-contract.js';
import {ordinaryProjectilePacketNative,ordinaryRangedSelectorNative,linearSingleProjectileNative} from './enemy-ordinary-projectile-contract.js';
import clocks from '../../data/arkpedia-energy-gunners-animations.json' with{type:'json'};
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const type=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const parent={templateKey:'enemy_egun_s_1',effectKey:'',onEventPriority:'DEFAULT',eventToActions:{ON_BUFF_TRIGGER:[{$type:type('CreateBuffInCircleRange'),_sourceType:'BUFF_OWNER',_targetType:'BUFF_OWNER',_targetOptions:{targetSide:'ALLY',targetMotion:'ALL',targetCategory:'DEFAULT',enableAdvancedOptions:false,ignoreTargetFree:false,ignoreAllyTargetFree:false,ignoreHealFree:false,ignoreTargetSide:false,excludeSomeAbnormalFlags:false,excludeAbnormalFlag:'STUNNED',purposeMask:'NONE',professionMask:'NONE',onlyIgnoreSomeOfTargetFreeCase:false,abnormalFlag:'STUNNED',abnormalCombo:'SLEEPING'},_excludeTarget:false,_rangeRadius:0,_checkInArcCircle:false,_degreeRanges:[],_buffs:[sourceEnergyGrantBuff(true)],_isDerivedBuff:false,_finishDerivedBuffIfParentFinish:false}]}};
const log={templateKey:'enemy_egun_over_energy_buff[log]',effectKey:'',onEventPriority:'DEFAULT',eventToActions:{ON_BUFF_START:[{$type:type('LogExtraBattleInfo'),_logType:'SIMPLE',_key:'egun_over_energy',_loadKeyFromBlackBoard:false,_countInHostIfToken:false,_additionValue:1,_attributeType:'NONE',_target:'BUFF_OWNER'}]}};
export function energyGunnerLogNative(n,buff){return !!buff&&empty(buff.attributes)&&fields(buff,{buffKey:log.templateKey,templateKey:log.templateKey,loadFromDB:0,isDurableBuff:0,isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,isGroundBoundable:0,overrideType:0,maxStackCnt:1,blackboard:[],lifeTimeType:0,lifeTime:0})&&same(n.$template(log.templateKey),log);}
export function energyGunnerNative(r,n){
 if(!same(r.skills,[{prefabKey:'AddEnergy',priority:0,cooldown:28,initCooldown:5,spCost:0,bb:{duration:5,interval:1,add_count:1,range_radius:2.2},bbStr:{}}]))return false;
 const root=n[r.prefabKey].find(v=>v._modes),mode=n.$ref(root._modes[0]),graphic=n.$ref(root._animator),clock=clocks.enemies[r.prefabKey],skill=n.AddEnergy?.find(v=>'_activeBuffs'in v),wrapper=n.$siblings(skill).find(v=>'_familyMask'in v),buff=skill?._activeBuffs?.[0];
 return r.stats.rangeRadius===2.2&&mode._combat.m_FileID===0&&same(mode._combat,mode._attack)
  &&ordinaryProjectilePacketNative(n.$ref(mode._attack),{projectileKey:'projectile_enemy_egun',type:1})
  &&ordinaryRangedSelectorNative(n,n.$ref(mode._attackTrigger),{radius:Math.fround(.0001),motion:1,abnormalFlag:29})
  &&linearSingleProjectileNative(n,'projectile_enemy_egun',{speed:10,lifetime:10})
  &&clock&&n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&['Attack','Skill'].every(clip=>graphic._animations.some(a=>a.animKey===clip&&a.animName===clip&&a.speed===1&&!a.loop))
  &&clock.durations.Attack===Math.fround(25/30)&&clock.durations.Skill===Math.fround(20/30)
  &&same(clock.events.Attack,[{time:Math.fround(13/30),name:'OnAttack',int:0,float:0,string:''}])&&same(clock.events.Skill,[{time:Math.fround(8/30),name:'OnAttack',int:0,float:0,string:''}])
  &&fields(skill,{m_Script:{m_FileID:1,m_PathID:'2702927552840241462'},_interruptAbilityOnDetach:0,_ignoreIfOwnerDead:0,_waitForAttackEvent:1,_interuptIfTargetDead:0,_resetCdStrategy:1,_selectTargetSource:1,_selectTargetTiming:0,_timeMode:1,_alwaysIncludeTarget:0,_allowNoTarget:1,_animKey:'Skill',_endAnimKey:'',_cooldown:0,_cooldownKey:'duration',_preDelay:0,_escapeTime:0,_maxAnimScale:-1,_affectedBySlowDown:1,_actions:{SerializedState:'null',SerializedObjectReferences:[]}})
  &&skill._activeBuffs.length===1&&skill._selector.m_FileID===0&&fields(n.$ref(skill._selector),{m_Script:{m_FileID:1,m_PathID:'8735719249224227112'}})
  &&fields(wrapper,{m_Script:{m_FileID:1,m_PathID:'-5087399121287503180'},_familyMask:3,_checkParentActive:0,_maxTriggerTime:-1,_resetMainAbilityCdWhenCastEnd:0,_resetCdWaitFirstPeriod:1,_overwriteInitCooldown:-1,_ignoreSilence:1,_immuneStunWhenAffecting:0,_addEnemyIdToSignalId:1,_castLikeAttack:0})
  &&wrapper._trigger.m_FileID===0&&fields(n.$ref(wrapper._trigger),{m_Script:{m_FileID:1,m_PathID:'-2995189732062982133'}})
  &&fields(buff,{buffKey:parent.templateKey,templateKey:parent.templateKey,loadFromDB:0,isDurableBuff:0,isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,isGroundBoundable:0,overrideType:0,maxStackCnt:1,blackboard:[],lifeTimeType:1,lifeTime:0,durationKey:'duration',triggerLifeType:2,triggerInterval:-1,waitFirstTriggerInterval:1,firstTriggerInterval:-1})
  &&same(buff.attributes,{abnormalFlags:[22],abnormalImmunes:[],abnormalAntis:[],abnormalCombos:[],abnormalComboImmunes:[],attributeModifiers:[]})
  &&same(n.$template(parent.templateKey),parent)&&energyGrantProgramNative(n);
}
export const energyGunnerClocks=r=>clocks.enemies[r.prefabKey];
