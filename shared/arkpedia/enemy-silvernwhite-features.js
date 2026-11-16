// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
const id='enemy_2047_smtree';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
const isSilvernwhite=r=>r.prefabKey===id;
const log=value=>({$type:'Torappu.Battle.Action.Nodes+LogExtraBattleInfo, Assembly-CSharp',_logType:'SIMPLE',_key:'alive_cnt',
 _loadKeyFromBlackBoard:false,_countInHostIfToken:false,_additionValue:value,_attributeType:'NONE',_target:'BUFF_OWNER'});
export function silvernwhiteNative(r,n){
 if(!isSilvernwhite(r)||r.level!==0||r.applyWay!=='NONE'||r.stats.dmgType!=='none'||r.stats.motion!=='WALK'||r.stats.moveSpeed!==0
  ||r.stats.atk!==0||r.stats.lpr!==0||r.notCountInTotal||r.skills.length||r.sp||r.abilities.length
  ||!same(r.talents,{bb:{},bbStr:{},groups:{}}))return false;
 const root=n[id]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes?.[0]),passive=n.$ref(root?._commonAbilities?.[0]),buff=passive?._buffs?.[0];
 const graphic=n.$ref(root?._animator);
 if(!fields(graphic,{m_Script:{m_FileID:1,m_PathID:'-6490301617952843582'},_animations:[],_animation:{m_FileID:0,m_PathID:'0'}}))return false;
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:1,_onlyDelayToBornOnTileStart:0,
  _blockVolume:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_idleWhenBorn:0,_canNotExit:0})
  ||root._modes.length!==1||root._commonAbilities.length!==1||!mode||!zero(mode._combat)||!same(mode._generalAbilities,[])
  ||!fields(n.$ref(mode._attack),{m_Script:{m_FileID:1,m_PathID:'-8178746901033412656'},_selector:{m_FileID:0,m_PathID:'0'},
   _interruptAbilityOnDetach:0,_ignoreIfOwnerDead:0,_forceAsDmgOrHealAbility:0})
  ||!fields(n.$ref(mode._attackTrigger),{m_Script:{m_FileID:1,m_PathID:'248012603862317511'}}))return false;
 return fields(passive,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},
   _interruptAbilityOnDetach:0,_ignoreIfOwnerDead:0})&&passive._buffs.length===1
  &&fields(buff,{buffKey:'enemy_smtree_passive',templateKey:'enemy_smtree_log',loadFromDB:0,isDurableBuff:0,isSilenceable:0,
   isStunnable:0,isFreezable:0,isLevitatable:0,isGroundBoundable:0,lifeTimeType:2,lifeTime:0,triggerLifeType:0,triggerCnt:0,
   triggerInterval:-1,maxStackCnt:1,overrideType:0,blackboard:[]})
  &&same(buff.attributes,{abnormalFlags:[22,8],abnormalImmunes:[],abnormalAntis:[],abnormalCombos:[],abnormalComboImmunes:[],attributeModifiers:[
   {attributeType:20,formulaItem:0,value:1,loadFromBlackboard:0,fetchBaseValueFromSourceEntity:0}]})
  &&same(n.$template('enemy_smtree_log')?.eventToActions,{ON_BUFF_START:[log(1)],ON_BUFF_FINISH:[log(-1)]});
}
const feature={matchesRecord:isSilvernwhite,covers:silvernwhiteNative};
export const SILVERNWHITE_FEATURES={
 'native:silvernwhiteBody':{...feature,ability:{kind:'passiveEnemyBody',params:()=>({birthDelay:1,birthClip:null})}},
 'native:silvernwhitePresence':{...feature,nativeClaim:()=>({active:1}),ability:{kind:'stagePresenceGauge',params:()=>({
  key:'alive_cnt',buffKey:'enemy_smtree_passive',flags:{noMove:true,noDisplace:true},mods:{taunt:1}})}},
};
