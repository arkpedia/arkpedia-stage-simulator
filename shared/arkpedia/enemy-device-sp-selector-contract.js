// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
/** Exact global, one-target native tagged-device SP selector. */
export function nativeTaggedDeviceSpSelector(n,commonRef){
 const select=n.SelectVg?.find(v=>'_selector'in v),parts=n.$siblings(select),filter=n.$ref(select?._selector);
 if(!select)return false;
 return n.$ref(commonRef)===select&&fields(select,{m_Script:{m_FileID:1,m_PathID:'4865767822664548221'},_selector:select._selector,_metadata:{namedAsAlias:'',blackboardPrefix:''},_interruptAbilityOnDetach:0,_ignoreIfOwnerDead:0,_forceAsDmgOrHealAbility:0})&&select._selector.m_FileID===0
  &&parts.some(v=>fields(v,{m_Script:{m_FileID:1,m_PathID:'6275044311115013764'},_useBlackboardRangeId:0}))
  &&fields(filter,{m_Script:{m_FileID:1,m_PathID:'6959540303033999559'},_targetSide:3,_targetMotion:3,_targetCategory:2,_postFilter:4,_ignoreTargetFree:0,_ignoreAllyTargetFree:0,_ignoreMotionMode:0,_forceIgnoreCamouflage:0,_limitTargetNum:1,_maxTargetKey:'max_target',_maxNum:1,_excludeOwner:0,_checkUnitType:0,_unitTypeMask:0,_tagExcluded:0,_filterTag:'vgctrl',_filterTagList:[],_buffKeyExcluded:0,_buffKey:'',_buffs:[],_checkOrInsteadOfAnd:0,_filterBuffSource:0,_filterTokenHost:0});
}

export const nativeSelectedSpRewardBuff=key=>({attributes:{abnormalFlags:[],abnormalImmunes:[],abnormalAntis:[],abnormalCombos:[],abnormalComboImmunes:[],attributeModifiers:[]},buffKey:key,loadFromDB:false,isDurableBuff:false,isDamageMissable:false,isSilenceable:false,isStunnable:false,isFreezable:false,isLevitatable:false,statusResistable:'AUTOMATIC',templateKey:'modify_sp[start]',disableOverride:true,overrideKey:null,overrideType:'DEFAULT',maxStackCnt:-1,refreshRemainingTimeWhenStackMax:false,clearAllStackCntWhenTimeUp:false,maxValidStackCnt:-1,independentCharacterSource:false,overrideEffectKey:null,overrideOnEventPriority:false,onEventPriority:'DEFAULT',audioSignal:null,lifeTimeType:'IMMEDIATELY',takeSnapshotWhenExtend:false,durationKey:null,lifeTime:0,triggerLifeType:'IMMEDIATELY',triggerCnt:0,triggerInterval:-1,waitFirstTriggerInterval:true,firstTriggerInterval:-1,priority:-1,priorityBBKeys:[],stripBlackboardParamsWithBuffKey:false,blackboard:[]});
