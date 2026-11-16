// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
export function ordinaryProjectilePacketNative(attack,{projectileKey,type,interruptOnDetach=0,clip='Attack',elementDamageType=0,selectTargetSource=2,atkScale=1,selector={m_FileID:0,m_PathID:'0'}}){
 return fields(attack,{m_Script:{m_FileID:1,m_PathID:'4156651312234227407'},m_Enabled:1,_selector:selector,
  _interruptAbilityOnDetach:interruptOnDetach,_ignoreIfOwnerDead:0,_forceAsDmgOrHealAbility:0,_waitForAttackEvent:1,_interuptIfTargetDead:0,
  _selectTargetSource:selectTargetSource,_selectTargetTiming:0,_timeMode:0,_alwaysIncludeTarget:1,_allowNoTarget:0,_animKey:clip,_endAnimKey:'Idle',
  _preDelay:0,_activeBuffs:[],_maxAnimScale:1,_affectedBySlowDown:1,_atkScale:atkScale,_atkScaleKey:'atk_scale',_attackType:1,
  _elementDamageType:elementDamageType,_epDamageRatio:0,_useDynamicAttackType:0,_projectileKey:projectileKey,_damageType:type,
  _waitForProjectileInvalid:0,_notClearProjectileWhenCastEnd:0,_fireAttackFinishWhenProjectileInvalid:0,_minPostDelayWhenProjectileInvalid:0,
  _waitForAnimEndWhenProjectileInvalid:0,_projectileDestination:0,_extraDamageType:0,_emitToInputPosWhenTargetIsInvalid:0,
  _emitToInputRootTileWhenTargetIsInvalid:0,_useCachedAtkOnly:0,_transferSource:0,_extraProjectileKeys:[],_fireCreateProjectileEvent:0});
}
export function ordinaryRangedSelectorNative(n,trigger,{radius,abnormalFlag,motion=1,scalable=0}){
 if(!fields(trigger,{m_Script:{m_FileID:1,m_PathID:'8607874384982393801'},_keepTarget:0,_minTargetNum:1,_overrideSearchTargetTick:-1}))return false;
 const siblings=n.$siblings(trigger),selector=siblings.find(c=>'_targetSide'in c);
 return siblings.filter(c=>c.m_Script).every(c=>['8607874384982393801','7080728813803358465','6185056810787956083'].includes(c.m_Script.m_PathID))
  &&siblings.some(c=>fields(c,{m_Script:{m_FileID:1,m_PathID:'6185056810787956083'},_useBlackboardRangeId:0,_extendable:0,_scaleble:scalable}))
  &&siblings.some(c=>fields(c,{m_Radius:radius,m_Enabled:1,m_Offset:{x:0,y:0}}))
  &&siblings.some(c=>fields(c,{m_LocalPosition:{x:0,y:0,z:0},m_LocalScale:{x:1,y:1,z:1}}))
  &&ordinaryAllyFilterNative(selector,{motion,abnormalFlag,limitTargetNum:1});
}
function ordinaryAllyFilterNative(selector,{motion,abnormalFlag,limitTargetNum}){
 return fields(selector,{m_Script:{m_FileID:1,m_PathID:'7080728813803358465'},_targetSide:2,_targetMotion:motion,_targetCategory:1,_postFilter:4,
   _ignoreTargetFree:0,_onlyIgnoreSomeOfTargetFreeCase:0,_abnormalFlag:abnormalFlag,_abnormalCombo:2,_ignoreAllyTargetFree:0,_ignoreHealFree:0,
   _ignoreMotionMode:0,_forceIgnoreCamouflage:0,_needProfessionMask:0,_professionMask:0,_excludeSomeAbnormalFlags:0,_excludeAbnormalFlag:46,
   _limitTargetNum:limitTargetNum,_maxTargetKey:'max_target',_maxNum:1,_excludeOwner:0,_sortByTauntAtLast:0,_ignoreHitRange:0,_checkUnitType:0,
   _unitTypeMask:0,_abilityInputTargetAsSortSource:0});
}
function linearProjectileTransport(n,key,{speed,lifetime,hitNumType=1}){
 const parts=n.$projectile(key),life=parts.find(c=>'_lifeTime'in c),move=parts.find(c=>'_moveType'in c);
 return ordinaryProjectileLifeNative(parts,{lifetime,hitNumType})
  &&fields(move,{_moveType:1,_speed:speed,_delayToStart:0,_flyToTargetLocationOnly:0,_forceReachedWhenTimeup:1});
}

function ordinaryProjectileLifeNative(parts,{lifetime,hitNumType}){
 const life=parts.find(c=>'_lifeTime'in c);
 return fields(life,{_randomDelayToBorn:0,_lifeTimeType:1,_lifeTime:lifetime,_canHitSameTargetMultipleTimes:0,_hitNumType:hitNumType,_maxHitNum:1,
   _stopAfterMaxHit:1,_stopWhenSourceInvalid:0,_alwaysHitTraceTargetInTheEnd:1,_managedBySource:0,_eliminatableStatus:0,_movementAdjustableStatus:0})
  &&fields(life._actionController,{_detachBuffsWhenTargetLeave:0,_detachAllBuffsWhenStopped:0,_onlyAddBuffsToTraceTarget:0,
   _onlyAddBuffsToTargetOnce:0,_dontAddBuffs:0,_excludeAttachments:0,_useSelfBlackboard:0,_extraBuffsInTheEnd:[],_useExtraBuffsWhenStopHit:0,
   _addExtraBuffsWhenReached:0,_detachAllExtraBuffsWhenStopped:0});
}

export function linearSingleProjectileNative(n,key,params){
 const parts=n.$projectile(key);
 return parts.length===3&&parts.every(c=>['-8797129986015012478','-1429203677512073985','6834194400804168919'].includes(c.m_Script?.m_PathID))
  &&linearProjectileTransport(n,key,params);
}
export function linearTileProjectileNative(n,key,{speed,lifetime,rangeId}){
 const parts=n.$projectile(key),select=parts.find(c=>'_onlyCheckHitWhenReachTarget'in c),range=parts.find(c=>'_rangeId'in c),filter=parts.find(c=>'_targetSide'in c);
 return parts.length===7&&parts.filter(c=>c.m_Script).every(c=>['-8797129986015012478','-1429203677512073985','6834194400804168919','-5673327578790077295','-4310568981281620583','7080728813803358465'].includes(c.m_Script.m_PathID))
  &&linearProjectileTransport(n,key,{speed,lifetime,hitNumType:2})
  &&fields(select,{_hitPasserby:0,_onlyCheckHitWhenReachTarget:1,_onlyCheckHitWhenStop:0,_interval:0,_limitedHitTimes:0,_exceptTraceTarget:0,_exceptSource:0,_ignoreRangeScale:1,_ignoreSmallEps:0})
  &&fields(range,{_rangeId:rangeId,_extendable:0,_useBlackboardRangeId:0})
  &&ordinaryAllyFilterNative(filter,{motion:3,abnormalFlag:23,limitTargetNum:0})
  &&parts.some(c=>fields(c,{m_LocalPosition:{x:0,y:0,z:0},m_LocalScale:{x:1,y:1,z:1}}));
}

/** The ordinary parabolic carrier's range lives on its projectile root. */
export function arcBoxProjectileNative(n,key,{speed,lifetime,width,height}){
 const parts=n.$projectile(key),area=parts.find(c=>'_targetOptions'in c),move=parts.find(c=>'_raiseHeight'in c),range=parts.find(c=>c.m_Script?.m_PathID==='4158870186494526771');
 return parts.length===7&&parts.filter(c=>c.m_Script).every(c=>['-8797129986015012478','5247176549481151122','6834194400804168919','-3494225671239136090','4158870186494526771'].includes(c.m_Script.m_PathID))
  &&ordinaryProjectileLifeNative(parts,{lifetime,hitNumType:2})
  &&fields(move,{_speed:speed,_delayTime:0,_comeBack:0,_flyToTargetLocationOnly:0,_onlyReachedInTime:0,_forceReachedWhenTimeup:1,_useRandomHeight:0,_raiseHeight:Math.fround(1.2),_inverseParacurve:0,_noRaiseHeightThreshold:Math.fround(1.3)})
  &&fields(area,{_onlyCheckHitWhenReachTarget:1,_onlyCheckHitWhenStop:0,_onlyTraceTarget:0,_exceptSource:0,_exceptTraceTarget:0,_exceptFlyCharacter:0,
   _ignoreCamouflage:1,_goThroughWall:1,_ignoreRangeScale:0,_markReachedOnlyWhenTargetEnter:0,_mergeTraceTargetMotion:0,_overridePurposeMaskWithTargetOptions:0,
   _targetOptions:{abnormalCombo:0,abnormalFlag:0,checkUnitType:0,containAbnormalFlag:0,containSomeAbnormalFlags:0,enableAdvancedOptions:1,
    excludeAbnormalFlag:0,excludeSomeAbnormalFlags:0,ignoreAllyTargetFree:0,ignoreHealFree:0,ignoreMotionMode:0,ignoreTargetFree:0,ignoreTargetSide:0,
    onlyIgnoreSomeOfTargetFreeCase:0,professionMask:0,purposeMask:0,targetCategory:1,targetMotion:3,targetSide:2,unitTypeMask:0}})
  &&fields(range,{_useBlackboardRangeId:0,_extendable:0})&&area._rangeToLoad?.m_FileID===0&&same(range.m_GameObject,area.m_GameObject)&&same(n.$projectileRef(key,area._rangeToLoad),range)
  &&parts.some(c=>same(c.m_GameObject,area.m_GameObject)&&fields(c,{m_Size:{x:width,y:height},m_Enabled:1,m_Offset:{x:0,y:0},m_EdgeRadius:0}))
  &&parts.some(c=>same(c.m_GameObject,area.m_GameObject)&&fields(c,{m_LocalPosition:{x:0,y:0,z:0},m_LocalScale:{x:1,y:1,z:1},m_LocalRotation:{w:1,x:0,y:0,z:0}}));
}
