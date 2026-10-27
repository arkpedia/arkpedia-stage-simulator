// SPDX-License-Identifier: GPL-3.0-or-later
// Selected AbilityStandard target loop and CheckFinished bodies. Target-list
// storage, pointer/Unity queries, virtual dispatch and finish effects stay explicit.
export function fearProjectileTargetCasting({readTargets,readCount,readPointer,copyPointer,validAndAlive,lockPointer,castOnTarget,readSelector,isValidUnity,notifySelector,checkFinished}){
 if([readTargets,readCount,readPointer,copyPointer,validAndAlive,lockPointer,castOnTarget,readSelector,isValidUnity,notifySelector,checkFinished].some(fn=>typeof fn!=='function'))throw new TypeError('Fear target casting requires native list, pointer, cast, selector and finish callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear target casting dereferenced a null native object');return value;},
  bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear target casting requires native Boolean results');return value;},
  count=list=>{const size=readCount(list);if(!Number.isInteger(size)||size<-(2**31)||size>=2**31)throw new TypeError('Fear target casting requires native Int32 counts');return size;};
 return function cast(ability,actions,buffs,attachments){
  nonnull(ability);let current=nonnull(readTargets(ability)),castAny=false;
  for(let index=0;index<count(current);index++){
   const pointer=copyPointer(readPointer(current,index));
   if(bool(validAndAlive(pointer))){
    const selected=nonnull(readTargets(ability)),target=lockPointer(copyPointer(readPointer(selected,index)));
    castAny=true;castOnTarget(ability,target,actions,buffs,attachments);
    const selector=readSelector(ability);
    if(bool(isValidUnity(selector)))notifySelector(nonnull(readSelector(ability)),target);
    if(bool(checkFinished(ability)))return castAny;
   }
   current=nonnull(readTargets(ability));
  }
  return castAny;
 };
}
export function fearProjectileCheckCastingFinished({readCasting,copyOwnerPointer,readIgnoreIfOwnerDead,validOwnerAndAlive,finishIfNot}){
 if([readCasting,copyOwnerPointer,readIgnoreIfOwnerDead,validOwnerAndAlive,finishIfNot].some(fn=>typeof fn!=='function'))throw new TypeError('Fear casting finish check requires native casting, owner and finish callers');
 const bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear casting finish check requires native Boolean values');return value;};
 return ability=>{
  if(!bool(readCasting(ability)))return true;
  const owner=copyOwnerPointer(ability),ignore=bool(readIgnoreIfOwnerDead(ability));
  if(bool(validOwnerAndAlive(owner,ignore)))return false;
  finishIfNot(ability,2,false);return true;
 };
}
