// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
export function ordinaryProjectilePacketNative(attack,{projectileKey,type,interruptOnDetach=0,clip='Attack',selector={m_FileID:0,m_PathID:'0'}}){
 return fields(attack,{m_Script:{m_FileID:1,m_PathID:'4156651312234227407'},m_Enabled:1,_selector:selector,
  _interruptAbilityOnDetach:interruptOnDetach,_ignoreIfOwnerDead:0,_forceAsDmgOrHealAbility:0,_waitForAttackEvent:1,_interuptIfTargetDead:0,
  _selectTargetSource:2,_selectTargetTiming:0,_timeMode:0,_alwaysIncludeTarget:1,_allowNoTarget:0,_animKey:clip,_endAnimKey:'Idle',
  _preDelay:0,_activeBuffs:[],_maxAnimScale:1,_affectedBySlowDown:1,_atkScale:1,_atkScaleKey:'atk_scale',_attackType:1,
  _elementDamageType:0,_epDamageRatio:0,_useDynamicAttackType:0,_projectileKey:projectileKey,_damageType:type,
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
  &&fields(selector,{m_Script:{m_FileID:1,m_PathID:'7080728813803358465'},_targetSide:2,_targetMotion:motion,_targetCategory:1,_postFilter:4,
   _ignoreTargetFree:0,_onlyIgnoreSomeOfTargetFreeCase:0,_abnormalFlag:abnormalFlag,_abnormalCombo:2,_ignoreAllyTargetFree:0,_ignoreHealFree:0,
   _ignoreMotionMode:0,_forceIgnoreCamouflage:0,_needProfessionMask:0,_professionMask:0,_excludeSomeAbnormalFlags:0,_excludeAbnormalFlag:46,
   _limitTargetNum:1,_maxTargetKey:'max_target',_maxNum:1,_excludeOwner:0,_sortByTauntAtLast:0,_ignoreHitRange:0,_checkUnitType:0,
   _unitTypeMask:0,_abilityInputTargetAsSortSource:0});
}
export function linearSingleProjectileNative(n,key,{speed,lifetime}){
 const parts=n.$projectile(key),life=parts.find(c=>'_lifeTime'in c),move=parts.find(c=>'_moveType'in c);
 return parts.length===3&&parts.every(c=>['-8797129986015012478','-1429203677512073985','6834194400804168919'].includes(c.m_Script?.m_PathID))
  &&fields(life,{_randomDelayToBorn:0,_lifeTimeType:1,_lifeTime:lifetime,_canHitSameTargetMultipleTimes:0,_hitNumType:1,_maxHitNum:1,
   _stopAfterMaxHit:1,_stopWhenSourceInvalid:0,_alwaysHitTraceTargetInTheEnd:1,_managedBySource:0,_eliminatableStatus:0,_movementAdjustableStatus:0})
  &&fields(life._actionController,{_detachBuffsWhenTargetLeave:0,_detachAllBuffsWhenStopped:0,_onlyAddBuffsToTraceTarget:0,
   _onlyAddBuffsToTargetOnce:0,_dontAddBuffs:0,_excludeAttachments:0,_useSelfBlackboard:0,_extraBuffsInTheEnd:[],_useExtraBuffsWhenStopHit:0,
   _addExtraBuffsWhenReached:0,_detachAllExtraBuffsWhenStopped:0})
  &&fields(move,{_moveType:1,_speed:speed,_delayToStart:0,_flyToTargetLocationOnly:0,_forceReachedWhenTimeup:1});
}
