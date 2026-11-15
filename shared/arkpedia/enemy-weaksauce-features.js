// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
import {nativeBuffProgram,nativeBuffProgramSupported} from './native-buff-programs.js';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
const isWeaksauce=r=>r.prefabKey==='enemy_5010_catrdg';
export function weaksauceNative(r,n){
 if(!isWeaksauce(r)||r.level!==0||r.applyWay!=='RANGED'||r.stats.dmgType!=='none'||r.stats.motion!=='FLY'||r.notCountInTotal
  ||r.skills.length||r.sp||!same(r.talents,{bb:{},bbStr:{},groups:{}})||!same(r.abilities,[{text:'-',format:'NORMAL'}]))return false;
 const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes?.[0]);
 const contact=n.Crash?.find(c=>'_targetValidator'in c),buff=contact?._buffs?.[0];
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'5961076520065977353'},_commonAbilities:[],_sideTypeIndex:1,_delayToBorn:0,
  _blockVolume:1,_canNotExit:0,_idleWhenBorn:0,_overridePreloadCnt:100})||root._modes.length!==1
  ||!mode||!zero(mode._combat)||!zero(mode._attack)||!zero(mode._attackTrigger)||!same(mode._generalAbilities,[]))return false;
 if(!fields(contact,{m_Script:{m_FileID:1,m_PathID:'9073738633337710967'},_selector:{m_FileID:0,m_PathID:'0'},
  _interruptAbilityOnDetach:0,_ignoreIfOwnerDead:0,_passiveBuffs:[],_selfOption:0,_removeBuffWhenTargetLeave:1,
  _removeBuffWhenAbilityDetached:1,_onlyAddBuffOnceForEachTarget:0,_ignoreOwnerFakeDeath:0})||contact._buffs.length!==1
  ||!fields(buff,{buffKey:'catdg_crash',templateKey:'enemy_catrdg_crash',loadFromDB:0,isDamageMissable:0,isSilenceable:0,
   isStunnable:0,isFreezable:0,isLevitatable:0,isGroundBoundable:0,lifeTimeType:2,maxStackCnt:1,overrideType:0,blackboard:[]})
  ||!same(buff.attributes,{abnormalFlags:[],abnormalImmunes:[],abnormalAntis:[],abnormalCombos:[],abnormalComboImmunes:[],attributeModifiers:[]}))return false;
 const siblings=n.$siblings(contact),range=siblings.find(c=>'_useBlackboardRangeId'in c),circle=siblings.find(c=>'m_Radius'in c),validator=n.$ref(contact._targetValidator);
 return fields(range,{m_Script:{m_FileID:1,m_PathID:'4158870186494526771'},_useBlackboardRangeId:0,_extendable:0})
  &&fields(circle,{m_Radius:Math.fround(.1),m_Offset:{x:0,y:0},m_Enabled:1})
  &&fields(validator,{m_Script:{m_FileID:1,m_PathID:'-3637692038217913187'},_targetOptions:{targetSide:2,targetMotion:3,targetCategory:1,
   enableAdvancedOptions:0,ignoreTargetFree:0,ignoreAllyTargetFree:0,ignoreHealFree:0,ignoreMotionMode:0,ignoreTargetSide:0,
   excludeSomeAbnormalFlags:0,containSomeAbnormalFlags:0,excludeAbnormalFlag:0,containAbnormalFlag:0,purposeMask:0,
   professionMask:0,checkUnitType:0,unitTypeMask:0,onlyIgnoreSomeOfTargetFreeCase:0,abnormalFlag:0,abnormalCombo:0}})
  &&nativeBuffProgramSupported('enemy_catrdg_crash',n);
}
export const WEAKSAUCE_FEATURE={matchesRecord:isWeaksauce,covers:weaksauceNative,
 ability:{kind:'contactBuffProgram',params:()=>({radius:Math.fround(.1),buffKey:'catdg_crash',damageMissable:false,
  program:nativeBuffProgram('enemy_catrdg_crash')})},
 note:'Native contact circle and damage/source-kill template mapped through a shared contact program. The custom root and mesh/effect renderer do not certify native callback or visual parity.'};
