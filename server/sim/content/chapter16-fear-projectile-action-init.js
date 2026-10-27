// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear projectile action Init dereferenced a null native object');return value;};
const bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear projectile action Init requires native Boolean values');return value;};
const integer=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear projectile action Init requires native Int32 values');return value;};
const bounds=(array,event,readLength)=>{if((integer(event)>>>0)>=(integer(readLength(nonnull(array)))>>>0))throw new RangeError('Fear projectile action Init native array bounds');};
const requireCalls=options=>{if(Object.values(options).some(fn=>typeof fn!=='function'))throw new TypeError('Fear projectile action Init requires native collection and ability callers');};

// Collection allocation, clearing, AddRange and GC effects stay explicit. Lists
// are captured or fetched again at the same points as the retained native body.
export function fearProjectileActionControllerInit({readAbilityBlackboard,createSelfBlackboard,writeBarrier,getActiveBuffs,
 clearList,allocateBuffList,constructBuffList,isNullOrEmpty,addBuffRange,getAttachments,readLength,readElement,
 getProjectileActions,registerActions,clearMap}){
 requireCalls({readAbilityBlackboard,createSelfBlackboard,writeBarrier,getActiveBuffs,clearList,allocateBuffList,constructBuffList,isNullOrEmpty,
  addBuffRange,getAttachments,readLength,readElement,getProjectileActions,registerActions,clearMap});
 return(controller,ability,projectile)=>{
  nonnull(controller);nonnull(ability);const own=bool(controller._useSelfBlackboard),board=readAbilityBlackboard(ability);
  controller.blackboard=own?createSelfBlackboard(board):board;writeBarrier(controller,'blackboard',controller.blackboard);
  controller.projectile=projectile;writeBarrier(controller,'projectile',projectile);
  const buffs=getActiveBuffs(ability),old=controller.m_buffsToAttach;
  if(old!=null)clearList(old);else{const list=nonnull(allocateBuffList());constructBuffList(list);controller.m_buffsToAttach=list;writeBarrier(controller,'m_buffsToAttach',list);}
  if(!bool(isNullOrEmpty(buffs)))addBuffRange(nonnull(controller.m_buffsToAttach),buffs);
  controller.m_attachmentsToAttach=getAttachments(ability);writeBarrier(controller,'m_attachmentsToAttach',controller.m_attachmentsToAttach);
  for(let event=0;event<7;event++){
   const array=nonnull(controller.actions);bounds(array,event,readLength);const list=readElement(array,event);if(list!=null)clearList(list);
   const actions=getProjectileActions(ability,event,projectile);registerActions(controller,event,actions,true);
  }
  clearMap(nonnull(controller.m_attachedBuffsForTargetMap));clearMap(nonnull(controller.m_attachedExtraBuffsForTargetMap));
  controller.m_addBuffsToTargetCnt=0;
 };
}

export function fearProjectileRegisterActions({readProjectileType,isNullOrEmpty,readLength,readElement,clearList,
 allocateActionList,constructActionList,checkArrayElement,writeElement,writeBarrier,addRange}){
 requireCalls({readProjectileType,isNullOrEmpty,readLength,readElement,clearList,allocateActionList,constructActionList,checkArrayElement,writeElement,writeBarrier,addRange});
 return(controller,event,actions,append)=>{
  nonnull(controller);integer(event);bool(append);
  if(integer(readProjectileType(nonnull(controller.projectile)))===2)return;
  if(bool(isNullOrEmpty(actions)))return;
  const array=nonnull(controller.actions);bounds(array,event,readLength);const old=readElement(array,event);
  if(old!=null){if(!append)clearList(old);}
  else{
   const list=nonnull(allocateActionList());constructActionList(list);checkArrayElement(array,list);bounds(array,event,readLength);
   writeElement(array,event,list);writeBarrier(array,event,list);
  }
  const current=nonnull(controller.actions);bounds(current,event,readLength);addRange(nonnull(readElement(current,event)),actions);
 };
}
