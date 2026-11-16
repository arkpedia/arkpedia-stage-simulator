// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-father-agenir-animations.json' with{type:'json'};
import {sameOutcomeValue as same,passiveOutcomeBuff,nativeKillLog} from './enemy-outcome-contracts.js';
import {ordinaryProjectilePacketNative,ordinaryRangedSelectorNative,linearSingleProjectileNative} from './enemy-ordinary-projectile-contract.js';
import {nativeTaggedDeviceSpSelector} from './enemy-device-sp-selector-contract.js';
import {nativeUnscaledTalentBinding} from './enemy-talent-binding-contract.js';
import {compileNativeBuffProgram} from './behavior-native-compiler.js';
import {nativeBuffProgram} from './native-buff-programs.js';
const id='enemy_1284_sgprst',check='enemy_common_check_vg',parent='enemy_sgprst_vg_check',add='enemy_sgprst_vg_add',link='enemy_sgprsr_modify_vg',pulse='modify_sp[trigger_with_no_ui]',spend='enemy_sgprst_sp_attack_check',debuff='enemy_sgprst_reduce_def',log='enemy_sgprst_dead_log';
export const isFatherAgenir=r=>!!r&&r.prefabKey===id;
export const FATHER_AGENIR_LINK_DESCRIPTION='Gradually increases Blood Debt';
export const FATHER_AGENIR_RANGE_DESCRIPTION='Attacks have global range when Asset Liquidation is active';
export const FATHER_AGENIR_AMMO_DESCRIPTION="Attacks using Ammo decrease the target's DEF. Ammo capacity: 10";
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x)),type=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const noAttributes={abnormalFlags:[],abnormalImmunes:[],abnormalAntis:[],abnormalCombos:[],abnormalComboImmunes:[],attributeModifiers:[]};
const when=(index,to)=>({op:'when',condition:{op:'all',terms:[{op:'mode',who:'owner',index}]},yes:[{op:'switchMode',who:'target',index:to}],no:[]});
const expectedCheck={schemaVersion:1,entry:check,templates:{[check]:{events:{ON_BUFF_TRIGGER:[{op:'when',condition:{op:'buff',who:'owner',keys:['vgctrl_s[aura]'],all:true},yes:[when(0,1)],no:[when(1,0)]}]}}}};
const expectedPulse={schemaVersion:1,entry:pulse,templates:{[pulse]:{events:{ON_BUFF_TRIGGER:[{op:'spAdd',who:'target',key:'sp'}]}}}};
// Template descriptors use the Global text encoding; prefab descriptors keep native integers.
const templateBuff={loadFromDB:false,isDurableBuff:false,isDamageMissable:false,isSilenceable:false,isStunnable:false,isFreezable:false,isLevitatable:false,statusResistable:'AUTOMATIC',overrideKey:null,maxStackCnt:-1,refreshRemainingTimeWhenStackMax:false,clearAllStackCntWhenTimeUp:false,maxValidStackCnt:-1,independentCharacterSource:false,overrideOnEventPriority:false,onEventPriority:'DEFAULT',audioSignal:null,lifeTimeType:'INFINITY',takeSnapshotWhenExtend:false,durationKey:null,lifeTime:0,triggerCnt:0,waitFirstTriggerInterval:true,firstTriggerInterval:-1,priority:-1,priorityBBKeys:[],stripBlackboardParamsWithBuffKey:false,blackboard:[]};
// Arrival buff: one round of the source's own magazine buys one permanent,
// uncapped flat DEF stack on the hit target. An empty magazine stops the sequence.
const spendTemplate={templateKey:spend,effectKey:'',onEventPriority:'DEFAULT',eventToActions:{ON_BUFF_START:[
 {$type:type('CheckHasSp'),_ownerType:'BUFF_SOURCE',_checkHasSp:1,_checkKey:'sp',_condType:'GE'},
 {$type:type('CreateBuff'),_buff:{...templateBuff,attributes:{...noAttributes,attributeModifiers:[{attributeType:'DEF',formulaItem:'ADDITION',value:0,loadFromBlackboard:true,fetchBaseValueFromSourceEntity:false}]},buffKey:debuff,templateKey:'empty',disableOverride:false,overrideType:'STACK',overrideEffectKey:'buff_defdown',triggerLifeType:'IMMEDIATELY',triggerInterval:-1},_buffOwner:'BUFF_OWNER',_isDerivedBuff:false,_finishDerivedBuffIfParentFinish:false},
 {$type:type('ModifySp'),_targetType:'BUFF_SOURCE',_modifyByRatio:false,_modifyRatio:0,_modifyByRatioBasedOnCurSP:false,_dontCheckSpType:false,_spMask:'ALL',_forceFlag:false,_dontShowSpUI:true,_modifyValue:-1,_spString:'sp',_isMinis:false}]}};
// Start-only acquisition of the tagged controller; the periodic child is derived and finishes with this parent.
const addTemplate={templateKey:add,effectKey:'',onEventPriority:'DEFAULT',eventToActions:{ON_BUFF_START:[{$type:type('CreateBuffUseAbilitySelector'),_sourceType:'BUFF_OWNER',_targetType:'BUFF_OWNER',_abilityName:'SelectVg',_excludeTarget:false,_excludeTargetType:'SOURCE',
 _buff:{...templateBuff,attributes:noAttributes,buffKey:link,templateKey:pulse,disableOverride:true,overrideType:'DEFAULT',overrideEffectKey:null,triggerLifeType:'INFINITY',triggerInterval:1},_isDerivedBuff:true,_finishDerivedBuffIfParentFinish:true}]}};
const activeBuff={attributes:noAttributes,audioSignal:'',blackboard:[],buffKey:spend,clearAllStackCntWhenTimeUp:0,disableOverride:1,durationKey:'',enableInitDirectionFromSource:0,firstTriggerInterval:-1,independentCharacterSource:0,isDamageMissable:0,isDurableBuff:0,isFreezable:0,isGroundBoundable:0,isLevitatable:0,isSilenceable:0,isStunnable:0,lifeTime:0,lifeTimeType:0,loadFromDB:0,maxStackCnt:1,maxValidStackCnt:-1,onEventPriority:0,overrideEffectKey:'',overrideKey:'',overrideOnEventPriority:0,overrideType:0,priority:-1,priorityBBKeys:[],refreshRemainingTimeWhenStackMax:0,remainingTimeKey:'',statusResistable:2,stripBlackboardParamsWithBuffKey:0,takeSnapshotWhenExtend:0,templateKey:spend,triggerCnt:0,triggerInterval:-1,triggerLifeType:0,waitFirstTriggerInterval:1};
const allyFilter={m_Script:{m_FileID:1,m_PathID:'7080728813803358465'},_targetSide:2,_targetMotion:3,_targetCategory:1,_postFilter:4,_ignoreTargetFree:0,_onlyIgnoreSomeOfTargetFreeCase:0,_abnormalFlag:23,_abnormalCombo:2,_ignoreAllyTargetFree:0,_ignoreHealFree:0,_ignoreMotionMode:0,_forceIgnoreCamouflage:0,_needProfessionMask:0,_professionMask:0,_excludeSomeAbnormalFlags:0,_excludeAbnormalFlag:46,_limitTargetNum:1,_maxTargetKey:'max_target',_maxNum:1,_excludeOwner:0,_sortByTauntAtLast:0,_ignoreHitRange:0,_checkUnitType:0,_unitTypeMask:0,_abilityInputTargetAsSortSource:0};
function globalSelectorNative(n,trigger){
 if(!fields(trigger,{m_Script:{m_FileID:1,m_PathID:'8607874384982393801'},_keepTarget:0,_minTargetNum:1,_overrideSearchTargetTick:-1}))return false;
 const siblings=n.$siblings(trigger);
 return siblings.filter(c=>c.m_Script).length===3&&siblings.filter(c=>c.m_Script).every(c=>['8607874384982393801','7080728813803358465','6275044311115013764'].includes(c.m_Script.m_PathID))
  &&!siblings.some(c=>'m_Radius'in c||'m_Size'in c)&&siblings.some(c=>fields(c,{m_Script:{m_FileID:1,m_PathID:'6275044311115013764'},_useBlackboardRangeId:0}))&&siblings.some(c=>fields(c,allyFilter));
}
export function fatherAgenirNative(r,n){
 if(!isFatherAgenir(r)||![0,1].includes(r.level)||r.applyWay!=='RANGED'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.stats.rangeRadius!==1.9||r.skills.length||r.notCountInTotal
  ||!same(r.sp,{type:'INCREASE_WITH_TIME',maxSp:10,initSp:10,increment:0})||!same(r.talents,{bb:{'Passive.sp':2,'Passive.attack@def':-300},bbStr:{},groups:{Passive:['attack@def','sp']}})
  ||!same(r.abilities,[FATHER_AGENIR_LINK_DESCRIPTION,FATHER_AGENIR_RANGE_DESCRIPTION,FATHER_AGENIR_AMMO_DESCRIPTION].map(text=>({text,format:'NORMAL'}))))return false;
 const root=n[r.prefabKey]?.find(v=>v._modes),passive=n.Passive?.find(v=>v._buffs?.some(b=>b.buffKey===parent));
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_onlyDelayToBornOnTileStart:0,_idleWhenBorn:0,_canNotExit:0,_blockVolume:1,_showSpAsBulletMode:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]}})
  ||root._modes.length!==2||root._commonAbilities.length!==1||root._commonAbilities[0].m_FileID!==0||!nativeTaggedDeviceSpSelector(n,root._commonAbilities[0])||!passive)return false;
 if(!fields(passive,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},_metadata:{namedAsAlias:'',blackboardPrefix:''},_ignoreIfOwnerDead:0,_interruptAbilityOnDetach:0})
  ||passive._buffs.length!==3||passive._buffs.some(b=>!passiveOutcomeBuff(b)||!same(b.blackboard,[])||b.overrideType!==0||b.stripBlackboardParamsWithBuffKey!==0)||!nativeUnscaledTalentBinding(n,passive)
  ||!fields(passive._buffs[0],{buffKey:parent,templateKey:check,triggerLifeType:2,triggerInterval:.5,waitFirstTriggerInterval:1,firstTriggerInterval:-1})
  ||!fields(passive._buffs[1],{buffKey:add,templateKey:add,triggerLifeType:0,triggerInterval:-1})
  ||!fields(passive._buffs[2],{buffKey:log,templateKey:'log_killed',triggerLifeType:0,triggerInterval:-1})||!nativeKillLog(n)
  ||!same(n.$template('empty')?.eventToActions,{})||!same(n.$template(spend),spendTemplate)||!same(n.$template(add),addTemplate))return false;
 try{if(!same(compileNativeBuffProgram(check,k=>n.$template(k)),expectedCheck)||!same(compileNativeBuffProgram(pulse,k=>n.$template(k)),expectedPulse))return false;}catch{return false;}
 const visuals=[['enemy_sgprst_eff1'],['enemy_sgprst_eff2','enemy_sgprst_eff2']];
 for(const [i,ref]of root._modes.entries()){
  const m=n.$ref(ref),general=n.$ref(m?._generalAbilities?.[0]),attack=n.$ref(m?._attack),projectile=`projectile_enemy_sgprst${i?'_s':''}`;
  if(!m||!same(m._combat,m._attack)||m._generalAbilities.length!==1||[ref,m._combat,m._attack,m._attackTrigger,...m._generalAbilities].some(v=>v.m_FileID!==0)||!general||!attack
   ||!fields(general,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0,_interruptAbilityOnDetach:0})
   ||!same(general._buffs.map(b=>b.buffKey),visuals[i])||general._buffs.some(b=>!passiveOutcomeBuff(b)||!same(b.blackboard,[])||b.overrideType!==0||b.templateKey!=='empty'||b.triggerLifeType!==0||b.triggerInterval!==-1)
   ||!same(attack._activeBuffs,[activeBuff])||!ordinaryProjectilePacketNative({...attack,_activeBuffs:[]},{projectileKey:projectile,type:1,clip:i?'Skill':'Attack'})
   ||!(i?globalSelectorNative(n,n.$ref(m._attackTrigger)):ordinaryRangedSelectorNative(n,n.$ref(m._attackTrigger),{radius:2,abnormalFlag:23,motion:3}))
   ||!linearSingleProjectileNative(n,projectile,{speed:10,lifetime:5}))return false;
 }
 const graphic=n.$ref(root._animator),clock=clocks.enemies[r.prefabKey];
 return root._animator.m_FileID===0&&n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&['Attack','Skill'].every(clip=>graphic._animations.some(v=>v.animKey===clip&&v.animName===clip&&v.speed===1&&!v.loop))
  &&clock.durations.Attack===Math.fround(40/30)&&same(clock.events.Attack,[{time:Math.fround(23/30),name:'OnAttack',int:0,float:0,string:''}])
  &&clock.durations.Skill===2&&same(clock.events.Skill,[{time:Math.fround(43/30),name:'OnAttack',int:0,float:0,string:''}]);
}
const animation=(r,clip)=>({clip,duration:clocks.enemies[r.prefabKey].durations[clip],releases:clocks.enemies[r.prefabKey].events[clip].map(v=>v.time),maxScale:1});
const ammoHit=r=>({cost:1,buffKey:debuff,mods:{defFlat:r.talents.bb['Passive.attack@def']}});
export const FATHER_AGENIR_FEATURES={
 // Two mode-general visual passives are claimed with the mode attacks they belong to.
 [`ability:${FATHER_AGENIR_RANGE_DESCRIPTION}`]:{matchesRecord:isFatherAgenir,covers:fatherAgenirNative,nativeClaim:()=>({active:2}),explains:text=>text===FATHER_AGENIR_AMMO_DESCRIPTION,
  ability:{kind:'programmedProjectileModes',params:r=>({program:nativeBuffProgram(check),initialMode:0,buffKey:parent,disabledBy:[],triggerInterval:.5,groundOnly:false,ammo:{max:r.sp.maxSp,initial:r.sp.initSp},
   modes:[{type:'phys',speed:10,lifetime:5,noAir:false,interruptOnDetach:false,globalRange:false,markerKey:'enemy_sgprst_eff1',ammoHit:ammoHit(r),animation:animation(r,'Attack')},
    {type:'phys',speed:10,lifetime:5,noAir:false,interruptOnDetach:false,globalRange:true,markerKey:'enemy_sgprst_eff2',ammoHit:ammoHit(r),animation:animation(r,'Skill')}]})}},
 // The common SelectVg ability is consumed once, by the start-only link parent.
 [`ability:${FATHER_AGENIR_LINK_DESCRIPTION}`]:{matchesRecord:isFatherAgenir,covers:fatherAgenirNative,nativeClaim:()=>({active:1}),
  ability:{kind:'selectedSpLink',params:r=>({parentKey:add,linkKey:link,interval:1,selector:{tag:'vgctrl',side:'both',maxTargets:1},blackboard:{sp:r.talents.bb['Passive.sp']},program:nativeBuffProgram(pulse)})}},
 'native:fatherAgenirLog':{matchesRecord:isFatherAgenir,covers:fatherAgenirNative,ability:{kind:'stageOutcomeCounter',params:()=>({killedKey:'killed',buffKey:log})}},
};
