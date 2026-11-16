// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-famiglia-capos-animations.json' with{type:'json'};
import {sameOutcomeValue as same,passiveOutcomeBuff} from './enemy-outcome-contracts.js';
import {ordinaryMeleePacketNative} from './enemy-ordinary-body-contract.js';
import {nativeTaggedDeviceSpSelector,nativeSelectedSpRewardBuff} from './enemy-device-sp-selector-contract.js';
import {nativeBuffProgram,nativeBuffProgramSupported} from './native-buff-programs.js';
const ids=['enemy_1282_sgelder','enemy_1282_sgelder_2'],key='enemy_sgelder_aura_vg';
export const isFamigliaCapo=r=>!!r&&ids.includes(r.prefabKey);
export const FAMIGLIA_CAPO_DESCRIPTION='Increases Blood Debt whenever an enemy unit is defeated within range';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const type=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
export function famigliaCapoNative(r,n){
 if(!isFamigliaCapo(r)||r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='arts'||r.stats.motion!=='WALK'||r.skills.length||r.sp||r.notCountInTotal
  ||!same(r.abilities,[{text:FAMIGLIA_CAPO_DESCRIPTION,format:'NORMAL'}])||!same(r.talents,{bb:{'AuraVG.sp':40},bbStr:{},groups:{AuraVG:['sp']}}))return false;
 const root=n[r.prefabKey]?.find(v=>v._modes),mode=n.$ref(root?._modes?.[0]),aura=n.AuraVG?.find(v=>v._buffs),validator=n.$ref(aura?._targetValidator),clock=clocks.enemies[r.prefabKey],graphic=n.$ref(root?._animator);
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_onlyDelayToBornOnTileStart:0,_idleWhenBorn:0,_canNotExit:0,_blockVolume:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]}})||root._modes.length!==1||root._commonAbilities.length!==1
  ||!mode||mode._generalAbilities.length||!fields(mode,{_attack:{m_FileID:0,m_PathID:'0'},_attackTrigger:{m_FileID:0,m_PathID:'0'}})
  ||[root._animator,...root._modes,...root._commonAbilities,mode._combat].some(v=>v.m_FileID!==0)
  ||!ordinaryMeleePacketNative(n.$ref(mode._combat),{damageType:2})||!nativeTaggedDeviceSpSelector(n,root._commonAbilities[0]))return false;
 if(!fields(aura,{m_Script:{m_FileID:1,m_PathID:'9073738633337710967'},_selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0,_interruptAbilityOnDetach:0,_selfOption:0,_removeBuffWhenTargetLeave:1,_removeBuffWhenAbilityDetached:1,_onlyAddBuffOnceForEachTarget:0,_effects:[],_ignoreOwnerFakeDeath:0})||aura._targetValidator.m_FileID!==0||aura._buffs.length!==1||aura._passiveBuffs.length!==2)return false;
 if(!passiveOutcomeBuff(aura._buffs[0])||!fields(aura._buffs[0],{buffKey:key,templateKey:key,disableOverride:1,overrideType:2,blackboard:[],triggerLifeType:0,triggerInterval:-1}))return false;
 for(const [i,b]of aura._passiveBuffs.entries())if(!passiveOutcomeBuff(b)||!fields(b,{buffKey:`enemy_sgelder_eff${i+1}`,templateKey:'empty',blackboard:[],disableOverride:0,overrideType:0}))return false;
 if(!fields(validator,{m_Script:{m_FileID:1,m_PathID:'-3637692038217913187'},_targetOptions:{targetSide:1,targetMotion:3,targetCategory:1,enableAdvancedOptions:1,ignoreTargetFree:1,ignoreAllyTargetFree:0,ignoreHealFree:0,ignoreMotionMode:0,ignoreTargetSide:0,excludeSomeAbnormalFlags:0,containSomeAbnormalFlags:0,excludeAbnormalFlag:0,containAbnormalFlag:0,purposeMask:0,professionMask:0,checkUnitType:0,unitTypeMask:0,onlyIgnoreSomeOfTargetFreeCase:0,abnormalFlag:0,abnormalCombo:0}}))return false;
 const siblings=n.$siblings(aura),wrapper=siblings.find(v=>v.m_Script?.m_PathID==='-1398656344548769790');
 if(!fields(wrapper,{_overwriteTalentKey:'',_overwriteParentRangeId:0,_checkValidBySkillIndex:[],_attachInDummy:0,_defaultModeIndex:-1,_attackBlackboardModeIndex:-1,_extraAttackBlackboardModeIndices:[],_overrideDefaultRangeId:0,_applyTalentScale:0,_influenceSkillBlackboard:0,_fromRawDataToSkill:0,_applyTalentRange:0,_applyBlackboardBySkill:0,_applyStrBlackboardBySkill:0,_writeRangeIdToProjectileBlackboard:0,_affectWhenNotRootTalent:0,_scaleCertainKeyFlag:0,_scaleCertainKeyList:[],_scaleCertainMode:0,_scaleModeIndices:[]})
  ||!siblings.some(v=>fields(v,{m_Script:{m_FileID:1,m_PathID:'6185056810787956083'},_useBlackboardRangeId:0,_extendable:0,_scaleble:0}))
  ||!siblings.some(v=>fields(v,{m_Radius:Math.fround(1.8),m_Enabled:1,m_Offset:{x:0,y:0}}))
  ||!siblings.some(v=>fields(v,{m_LocalPosition:{x:0,y:0,z:0},m_LocalScale:{x:1,y:1,z:1}})))return false;
 const expected={templateKey:key,effectKey:'',onEventPriority:'DEFAULT',eventToActions:{ON_OWNER_KILLED:[{$type:type('CreateBuffUseAbilitySelector'),_sourceType:'BUFF_SOURCE',_targetType:'BUFF_OWNER',_abilityName:'SelectVg',_excludeTarget:false,_excludeTargetType:'SOURCE',_buff:{...nativeSelectedSpRewardBuff('sgelder_trigger_modify_vg'),triggerInterval:1},_isDerivedBuff:false,_finishDerivedBuffIfParentFinish:false},{$type:type('FinishBuff'),_decCntIfStack:false,_updateOverrideMap:true}]}};
 return same(n.$template(key),expected)&&same(n.$template('empty')?.eventToActions,{})&&nativeBuffProgramSupported('modify_sp[start]',n)
  &&n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId&&graphic._animations.some(v=>v.animKey==='Attack'&&v.animName==='Attack'&&v.speed===1&&!v.loop)
  &&clock.durations.Attack===Math.fround(40/30)&&same(clock.events.Attack,[{time:Math.fround(.4),name:'OnAttack',int:0,float:0,string:''}]);
}
export const FAMIGLIA_CAPO_FEATURES={
 'talent:AuraVG':{matchesRecord:isFamigliaCapo,covers:famigliaCapoNative,nativeClaim:()=>({active:1}),explains:text=>text===FAMIGLIA_CAPO_DESCRIPTION,ability:{kind:'selectedAuraDeathSp',params:()=>({key,radius:Math.fround(1.8),includeSelf:true,markerKeys:['enemy_sgelder_eff1','enemy_sgelder_eff2'],selector:{tag:'vgctrl',side:'both',maxTargets:1},blackboard:{sp:40},program:nativeBuffProgram('modify_sp[start]')})}},
 'native:famigliaCapoMelee':{matchesRecord:isFamigliaCapo,covers:famigliaCapoNative,ability:{kind:'animatedMeleeAttack',params:r=>({type:'arts',animation:{clip:'Attack',duration:clocks.enemies[r.prefabKey].durations.Attack,releases:clocks.enemies[r.prefabKey].events.Attack.map(v=>v.time),maxScale:1}})}},
};
