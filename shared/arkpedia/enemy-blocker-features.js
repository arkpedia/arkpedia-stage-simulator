// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty} from './enemy-outcome-contracts.js';
export const isBlocker=r=>['enemy_1355_mrfly','enemy_1355_mrfly_2'].includes(r.prefabKey);
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
export function blockerNative(r,n){
 if(!isBlocker(r)||r.level!==0||r.applyWay!=='NONE'||r.stats.motion!=='FLY'||r.stats.dmgType!=='none'||r.stats.rangeRadius!==2.5||r.skills.length||r.sp||r.notCountInTotal
  ||!same(r.abilities,[{text:'Flying unit.',format:'NORMAL'},{text:'Increases the RES of surrounding enemy units.',format:'SILENCE'}])
  ||!same(r.talents,{bb:{'magdef_add.magic_resistance':30},bbStr:{},groups:{magdef_add:['magic_resistance']}}))return false;
 const root=n[r.prefabKey]?.find(v=>'_modes'in v),mode=n.$ref(root?._modes?.[0]),a=n.magdef_add?.find(v=>'_buffs'in v),binding=n.$siblings(a).find(v=>'_isSilenceable'in v);
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_idleWhenBorn:0,_canNotExit:0,_blockVolume:1})
  ||root._modes.length!==1||root._commonAbilities.length||!mode||mode._generalAbilities.length||!zero(mode._attack)||!zero(mode._attackTrigger)
  ||!fields(n.$ref(mode._combat),{m_Script:{m_FileID:1,m_PathID:'8145049199648393782'},_activeBuffs:[],_preDelay:0,_escapeTime:0,_animKey:''})
  ||!fields(binding,{m_Script:{m_FileID:1,m_PathID:'-7555088068958382215'},_isSilenceable:1,_overwriteTalentKey:'',_overwriteParentRangeId:0,_checkValidBySkillIndex:[],_attachInDummy:0,_defaultModeIndex:-1,_attackBlackboardModeIndex:-1,_extraAttackBlackboardModeIndices:[],_applyTalentScale:0,_influenceSkillBlackboard:0,_fromRawDataToSkill:0,_applyBlackboardBySkill:0,_applyStrBlackboardBySkill:0})
  ||!fields(a,{m_Script:{m_FileID:1,m_PathID:'9073738633337710967'},_selector:{m_FileID:0,m_PathID:'0'},_passiveBuffs:[],_selfOption:2,_removeBuffWhenTargetLeave:1,_removeBuffWhenAbilityDetached:1,_onlyAddBuffOnceForEachTarget:0,_ignoreOwnerFakeDeath:0})||a._buffs.length!==1)return false;
 const b=a._buffs[0],v=n.$ref(a._targetValidator),circle=n.$siblings(a).find(v=>'m_Radius'in v),transform=n.$siblings(a).find(v=>'m_LocalPosition'in v);
 return fields(b,{buffKey:'add_magicdef',templateKey:'empty',loadFromDB:0,isDurableBuff:0,isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,isGroundBoundable:0,disableOverride:0,overrideType:0,maxStackCnt:1,lifeTimeType:2,lifeTime:0,blackboard:[]})
  &&empty({...b.attributes,attributeModifiers:[]})&&same(b.attributes.attributeModifiers,[{attributeType:3,formulaItem:0,value:0,loadFromBlackboard:1,fetchBaseValueFromSourceEntity:0}])
  &&same(n.$template('empty'),{templateKey:'empty',effectKey:'',onEventPriority:'DEFAULT',eventToActions:{}})
  &&fields(v,{m_Script:{m_FileID:1,m_PathID:'-3637692038217913187'}})&&same(v._targetOptions,{targetSide:1,targetMotion:3,targetCategory:3,enableAdvancedOptions:1,ignoreTargetFree:0,ignoreAllyTargetFree:0,ignoreHealFree:0,ignoreMotionMode:0,ignoreTargetSide:0,excludeSomeAbnormalFlags:0,containSomeAbnormalFlags:0,excludeAbnormalFlag:0,containAbnormalFlag:0,purposeMask:0,professionMask:0,checkUnitType:0,unitTypeMask:0,onlyIgnoreSomeOfTargetFreeCase:0,abnormalFlag:0,abnormalCombo:0})
  &&a._targetValidator.m_FileID===0&&fields(circle,{m_Enabled:1,m_IsTrigger:true,m_Offset:{x:0,y:0},m_Radius:2.5})
  &&fields(transform,{m_LocalPosition:{x:0,y:0,z:0},m_LocalScale:{x:1,y:1,z:1}});
}
export const BLOCKER_FEATURES={
 'talent:magdef_add':{matchesRecord:isBlocker,covers:blockerNative,explains:text=>text==='Increases the RES of surrounding enemy units.',
  ability:{kind:'nativeCircleStatAura',params:()=>({key:'add_magicdef',radius:2.5,mods:{resFlat:30},strength:30,includeDevices:true,silenceable:true})}},
};
