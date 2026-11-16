// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
const node=(v,type)=>v?.$type===`Torappu.Battle.Action.Nodes+${type}, Assembly-CSharp`;
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const empty=a=>a&&Object.keys(a).sort().join()==='abnormalAntis,abnormalComboImmunes,abnormalCombos,abnormalFlags,abnormalImmunes,attributeModifiers'
 &&Object.values(a).every(v=>v===null||Array.isArray(v)&&!v.length);
/** Scoped visual markers: no attributes, blackboard, script or foreign owner. */
export function cosmeticMarkerCreate(v,{key,effect}){
 const b=v?._buff;
 return node(v,'CreateBuff')&&fields(v,{_buffOwner:'BUFF_OWNER',_isDerivedBuff:false,_finishDerivedBuffIfParentFinish:false})
  &&empty(b?.attributes)&&fields(b,{buffKey:key,templateKey:'empty',blackboard:[],loadFromDB:false,lifeTimeType:'INFINITY',lifeTime:0,
   maxStackCnt:1,overrideType:'DEFAULT',disableOverride:false,isDurableBuff:false,isDamageMissable:false,isSilenceable:false,isStunnable:false,
   isFreezable:false,isLevitatable:false,triggerLifeType:'IMMEDIATELY',triggerCnt:0,triggerInterval:-1,overrideEffectKey:effect});
}
export function cosmeticMarkerFinish(v,key){
 return node(v,'FinishBuffsById')&&fields(v,{_buffKey:key,_loadFromBlackboard:false,_decCntIfStack:false,_updateOverrideMap:true,
  _targetType:'BUFF_OWNER',_checkBuffSource:false,_sourceType:'BUFF_SOURCE',_alsoClearNullSource:false,_finishHostBuff:false});
}
export function cosmeticMarkerHolder(n,template,{key,effect}){
 const t=n.$template(template),events=t?.eventToActions,finish=events?.ON_ABILITY_FINISH,contains=finish?.[0];
 return t?.effectKey===''&&t.onEventPriority==='DEFAULT'
  &&same(Object.keys(events??{}).sort(),['ON_ABILITY_FINISH','ON_ABILITY_SPELL_ON','ON_BUFF_FINISH','ON_BUFF_START'])
  &&events.ON_BUFF_START.length===1&&cosmeticMarkerCreate(events.ON_BUFF_START[0],{key,effect})
  &&events.ON_BUFF_FINISH.length===1&&cosmeticMarkerFinish(events.ON_BUFF_FINISH[0],key)
  &&events.ON_ABILITY_SPELL_ON.length===1&&cosmeticMarkerFinish(events.ON_ABILITY_SPELL_ON[0],key)
  &&finish.length===3&&node(contains,'CheckContainsBuff')&&fields(contains,{_targetType:'BUFF_OWNER',_buffKeys:[key],isAND:true,
   _loadFromBlackboard:false,_checkBuffSource:false,_buffSourceType:'BUFF_SOURCE',_checkSourceHost:false})
  &&same(finish[1],{$type:'Torappu.Battle.Action.Nodes+IfNot, Assembly-CSharp'})&&cosmeticMarkerCreate(finish[2],{key,effect})
  &&same(n.$template('empty')?.eventToActions,{});
}
