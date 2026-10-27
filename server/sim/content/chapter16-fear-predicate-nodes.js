// SPDX-License-Identifier: GPL-3.0-or-later
// Selected default CheckAbnormalFlag/CheckAbnormalCombo/AlwaysNext Execute
// bodies. Snapshot entity selection, Unity validity and native queries remain
// explicit receivers; SourceType is unused by these default bodies.
export function fearProjectilePredicateNodes({getEntity,isDestroyedOrNull,readAttributes,readBlackboardInt,queryFlag,queryCombo}){
 if([getEntity,isDestroyedOrNull,readAttributes,readBlackboardInt,queryFlag,queryCombo].some(fn=>typeof fn!=='function'))throw new TypeError('Fear predicate nodes require native entity, blackboard and attribute callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear predicate node dereferenced a null native object');return value;},
  int32=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear predicate node requires native Int32 values');return value;},
  boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear predicate node requires native Boolean values');return value;};
 return Object.freeze({
  executeFlag(node,blackboard,_sourceType,snapshotRef){
   const entity=getEntity(snapshotRef,int32(nonnull(node)._targetType));
   if(boolean(isDestroyedOrNull(entity)))return false;
   const key=node._abnormalFlagKey;if(key!=null&&typeof key!=='string')throw new TypeError('Fear predicate node requires a nullable native string key');
   let flag;
   if(key==null||key==='')flag=int32(node._abnormalFlag);
   else{nonnull(blackboard);const fallback=int32(node._abnormalFlag),currentKey=node._abnormalFlagKey;flag=int32(readBlackboardInt(blackboard,currentKey,fallback,true));}
   const inverse=boolean(node._isUnset),attributes=nonnull(readAttributes(nonnull(entity)));
   return boolean(queryFlag(attributes,flag))!==inverse;
  },
  executeCombo(node,_blackboard,_sourceType,snapshotRef){
   const entity=getEntity(snapshotRef,int32(nonnull(node)._targetType));
   if(boolean(isDestroyedOrNull(entity)))return false;
   const inverse=boolean(node._isUnset),attributes=nonnull(readAttributes(nonnull(entity))),combo=int32(node._abnormalCombo);
   return boolean(queryCombo(attributes,combo))!==inverse;
  },
  executeAlwaysNext:()=>true,
 });
}
