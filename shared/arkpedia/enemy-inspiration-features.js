// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty} from './enemy-outcome-contracts.js';
export const INSPIRATION_MARKER='enemy_9D0_talent_strength';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const action=(name,params={})=>({$type:`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`,...params});
const contains=key=>action('CheckContainsBuff',{_targetType:'BUFF_OWNER',_buffKeys:[key],isAND:true,
 _loadFromBlackboard:false,_checkBuffSource:false,_buffSourceType:'BUFF_SOURCE',_checkSourceHost:false});
const producers=['enemy_1080_sotidp','enemy_1080_sotidp_2'];
const receiverTypes={enemy_1078_sotisc:'move_speed',enemy_1078_sotisc_2:'move_speed',enemy_1082_soticn:'atk_speed',enemy_1082_soticn_2:'atk_speed',enemy_1083_sotiab:'atk',enemy_1083_sotiab_2:'atk'};
export const isNativeInspiration=r=>producers.includes(r.prefabKey)||Object.hasOwn(receiverTypes,r.prefabKey);
const nativeBinding=(n,c)=>n.$siblings(c).some(v=>fields(v,{m_Script:{m_FileID:1,m_PathID:c.m_Script?.m_PathID==='-5793748974791823428'?'-7555088068958382215':'-2726233351382997147'},m_Enabled:1,
 ...(c.m_Script?.m_PathID==='-5793748974791823428'?{_isSilenceable:0}:{}),
 _overwriteTalentKey:'',_attachInDummy:0,_checkValidBySkillIndex:[],_defaultModeIndex:-1,_attackBlackboardModeIndex:-1,
 _extraAttackBlackboardModeIndices:[],_applyTalentScale:0,_influenceSkillBlackboard:0,_fromRawDataToSkill:0,
 _applyBlackboardBySkill:0,_applyStrBlackboardBySkill:0,_scaleCertainKeyFlag:0,_scaleCertainKeyList:[],_scaleModeIndices:[]}));
const passive={loadFromDB:0,isDurableBuff:0,isDamageMissable:0,isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,
 isGroundBoundable:0,statusResistable:2,overrideType:0,overrideKey:'',blackboard:[],lifeTimeType:2,lifeTime:0};
export function inspirationNative(r,n){
 if(!isNativeInspiration(r)||r.skills.length||r.sp||Object.keys(r.talents.groups).join()!=='strength'||Object.keys(r.talents.bbStr).length)return false;
 const c=n.Strength?.find(v=>'_buffs'in v);
 if(!c||c.m_Enabled!==1||c._selector?.m_PathID!=='0'||!nativeBinding(n,c))return false;
 if(producers.includes(r.prefabKey)){
  const [stats,marker]=c._buffs,selector=n.$ref(c._targetValidator);
  return same(r.talents.bb,{'strength.atk':.1,'strength.def':100})&&same(r.talents.groups.strength,['atk','def'])
   &&c._buffs.length===2&&c.m_Script?.m_PathID==='-5793748974791823428'
   &&fields(c,{_passiveBuffs:[],_selfOption:0,_removeBuffWhenAbilityDetached:1,_removeBuffIncludeReborning:0,
    _onlyDetactTargetWhenStarted:0,_onlyDetectCurrentMapLayer:0,_listenUnitRebornEvent:0,_tryRemoveBuffFirstWhenReborn:0,
    _useDurableRallyPointLikeSwitch:0,_forceRemoveAllBuffsByKey:0,_forceTick:0,_excludeReborningEntity:0,_interval:0,_clearBuffsWhenDisappear:0})
   &&fields(stats,{...passive,buffKey:`${INSPIRATION_MARKER}[attribute]`,templateKey:'empty',disableOverride:1,maxStackCnt:-1})
   &&empty({...stats.attributes,attributeModifiers:[]})&&same(stats.attributes.attributeModifiers,[
    {attributeType:1,formulaItem:1,value:0,loadFromBlackboard:1,fetchBaseValueFromSourceEntity:0},
    {attributeType:2,formulaItem:0,value:0,loadFromBlackboard:1,fetchBaseValueFromSourceEntity:0}])
   &&fields(marker,{...passive,buffKey:INSPIRATION_MARKER,templateKey:'empty',disableOverride:0,maxStackCnt:1})&&empty(marker.attributes)
   &&selector?.m_Script?.m_PathID==='-3637692038217913187'&&fields(selector._targetOptions,{targetSide:1,targetMotion:3,targetCategory:1,
    enableAdvancedOptions:0,ignoreTargetFree:0,ignoreAllyTargetFree:0,ignoreMotionMode:0,ignoreTargetSide:0,
    excludeSomeAbnormalFlags:0,containSomeAbnormalFlags:0,professionMask:0,checkUnitType:0,unitTypeMask:0});
 }
 const type=receiverTypes[r.prefabKey],bb=type==='atk_speed'?'attack_speed':type,expected=type==='atk_speed'?50:type==='atk' ? (r.prefabKey==='enemy_1083_sotiab_2'?.8:.5) : .3;
 if(!same(r.talents.bb,{[`strength.${bb}`]:expected})||!same(r.talents.groups.strength,[bb])
  ||c.m_Script?.m_PathID!=='3800760148018415462'||c._buffs.length!==2)return false;
 for(const[index,end]of['start','finish'].entries()){
  const key=`enemy_strength_talent_${end}_listener[${type}]`,buff=c._buffs[index];
  if(!fields(buff,{...passive,buffKey:key,templateKey:key,disableOverride:0,maxStackCnt:1,triggerLifeType:2,
   triggerInterval:.25,waitFirstTriggerInterval:1,firstTriggerInterval:-1})||!empty(buff.attributes))return false;
 }
 const key=`enemy_talent_strength[${type}]`,start=n.$template(`enemy_strength_talent_start_listener[${type}]`),finish=n.$template(`enemy_strength_talent_finish_listener[${type}]`);
 const nodes=start?.eventToActions?.ON_BUFF_TRIGGER,create=nodes?.[3],buff=create?._buff;
 if(!fields(start,{templateKey:`enemy_strength_talent_start_listener[${type}]`,effectKey:'',onEventPriority:'DEFAULT'})
  ||!fields(finish,{templateKey:`enemy_strength_talent_finish_listener[${type}]`,effectKey:'',onEventPriority:'DEFAULT'})
  ||!same(Object.keys(start?.eventToActions??{}),['ON_BUFF_TRIGGER'])||nodes?.length!==4||!same(nodes[0],contains(INSPIRATION_MARKER))
  ||!same(nodes[1],contains(key))||!same(nodes[2],action('IfNot'))
  ||!same(create,{$type:action('CreateBuff').$type,_buff:buff,_buffOwner:'BUFF_OWNER',_isDerivedBuff:true,_finishDerivedBuffIfParentFinish:false})
  ||!same(buff,{attributes:buff?.attributes,buffKey:key,templateKey:'empty',loadFromDB:false,isDurableBuff:false,isDamageMissable:false,
   isSilenceable:false,isStunnable:false,isFreezable:false,isLevitatable:false,statusResistable:'AUTOMATIC',
   disableOverride:false,overrideKey:null,overrideType:'DEFAULT',maxStackCnt:1,refreshRemainingTimeWhenStackMax:false,
   clearAllStackCntWhenTimeUp:false,maxValidStackCnt:-1,independentCharacterSource:false,overrideEffectKey:'sotidp_buff_01_start',
   overrideOnEventPriority:false,onEventPriority:'DEFAULT',audioSignal:null,lifeTimeType:'INFINITY',takeSnapshotWhenExtend:false,
   durationKey:null,lifeTime:0,triggerLifeType:'IMMEDIATELY',triggerCnt:0,triggerInterval:-1,waitFirstTriggerInterval:true,
   firstTriggerInterval:-1,priority:-1,priorityBBKeys:[],stripBlackboardParamsWithBuffKey:false,blackboard:[]})
  ||!same(buff.attributes,{abnormalFlags:[],abnormalImmunes:[],abnormalAntis:null,abnormalCombos:[],abnormalComboImmunes:[],attributeModifiers:[{
   attributeType:type==='atk_speed'?'ATTACK_SPEED':type==='atk'?'ATK':'MOVE_SPEED',formulaItem:type==='atk_speed'?'ADDITION':'MULTIPLIER',
   value:0,loadFromBlackboard:true,fetchBaseValueFromSourceEntity:false}]}))return false;
 const a=finish?.eventToActions?.ON_BUFF_TRIGGER;
 return same(Object.keys(finish?.eventToActions??{}),['ON_BUFF_TRIGGER'])&&a?.length===3&&same(a[0],contains(INSPIRATION_MARKER))
  &&same(a[1],action('IfNot'))&&same(a[2],action('FinishBuffsById',{_buffKey:key,_loadFromBlackboard:false,_decCntIfStack:false,
   _updateOverrideMap:true,_targetType:'BUFF_OWNER',_checkBuffSource:false,_sourceType:'BUFF_SOURCE',_alsoClearNullSource:false,
   _finishHostBuff:false}));
}
export function nativeInspirationAbility(r){
 if(producers.includes(r.prefabKey))return{kind:'statMarkerAura',params:()=>({markerKey:INSPIRATION_MARKER,
  attributeKey:`${INSPIRATION_MARKER}[attribute]`,mods:{atkPct:r.talents.bb['strength.atk'],defFlat:r.talents.bb['strength.def']}})};
 const type=receiverTypes[r.prefabKey],map={atk:['atkPct','atk'],atk_speed:['aspd','attack_speed'],move_speed:['movePct','move_speed']},[mod,key]=map[type];
 return{kind:'markerStatBonus',params:()=>({markerKey:INSPIRATION_MARKER,bonusKey:`enemy_talent_strength[${type}]`,interval:.25,
  mods:{[mod]:r.talents.bb[`strength.${key}`]}})};
}
