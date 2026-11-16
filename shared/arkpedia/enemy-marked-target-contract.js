// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
/** Shared native ground-target marker filter with explicit local/global scope. */
export function markedGroundSelectorNative(n,trigger,{markerKey,abnormalFlag,excludedTag=null,globalRange=false,radius=1}){
 if(!fields(trigger,{m_Script:{m_FileID:1,m_PathID:'8607874384982393801'},_keepTarget:0,_minTargetNum:1,_overrideSearchTargetTick:-1}))return false;
 const siblings=n.$siblings(trigger),filter=siblings.find(c=>'_buffKey'in c);
 if(!siblings.filter(c=>c.m_Script).every(c=>['8607874384982393801','6959540303033999559',globalRange?'6275044311115013764':'6185056810787956083'].includes(c.m_Script.m_PathID)))return false;
 if(globalRange){
  if(!siblings.some(c=>fields(c,{m_Script:{m_FileID:1,m_PathID:'6275044311115013764'},_useBlackboardRangeId:0})))return false;
 }else{
  if(!siblings.some(c=>fields(c,{m_Script:{m_FileID:1,m_PathID:'6185056810787956083'},_useBlackboardRangeId:0,_extendable:0,_scaleble:1}))
   ||!siblings.some(c=>fields(c,{m_Radius:radius,m_Enabled:1,m_Offset:{x:0,y:0}}))
   ||!siblings.some(c=>fields(c,{m_LocalScale:{x:1,y:1,z:1},m_LocalPosition:{x:0,y:0,z:0}})))return false;
 }
 return fields(filter,{m_Script:{m_FileID:1,m_PathID:'6959540303033999559'},_targetSide:2,_targetMotion:1,_targetCategory:1,_postFilter:4,
  _ignoreTargetFree:0,_onlyIgnoreSomeOfTargetFreeCase:0,_abnormalFlag:abnormalFlag,_abnormalCombo:2,_ignoreAllyTargetFree:0,_ignoreHealFree:0,
  _ignoreMotionMode:0,_forceIgnoreCamouflage:0,_needProfessionMask:0,_professionMask:0,_excludeSomeAbnormalFlags:0,_excludeAbnormalFlag:46,
  _limitTargetNum:1,_maxTargetKey:'max_target',_maxNum:1,_excludeOwner:0,_sortByTauntAtLast:0,_ignoreHitRange:0,_checkUnitType:0,_unitTypeMask:0,
  _abilityInputTargetAsSortSource:0,_tagExcluded:excludedTag?1:0,_filterTag:excludedTag??'',_filterTagList:[],_buffKeyExcluded:0,_buffKey:markerKey,_buffs:[],
  _checkOrInsteadOfAnd:0,_filterBuffSource:0,_filterTokenHost:0});
}
