// SPDX-License-Identifier: GPL-3.0-or-later
// Default ActionUtil.CheckExecute and both RunActions overloads. Native
// collection/virtual dispatch and battle lookup remain explicit receivers.
// Operations finish synchronously once entered; outer callers own lifecycle.
export const FEAR_ACTION_SOURCE_FROM_BUFF=1;
export function fearProjectileActionUtil({readBattle,readContext,takeSnapshot,copySnapshot,readCount,readNode,readAllowedSource,readExecuteCondition,executeNode,reportSourceMismatch}){
 if([readBattle,readContext,takeSnapshot,copySnapshot,readCount,readNode,readAllowedSource,readExecuteCondition,executeNode,reportSourceMismatch].some(fn=>typeof fn!=='function'))throw new TypeError('Fear action utility requires native context, collection and virtual action callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear action utility dereferenced a null native object');return value;},
  int32=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear action utility requires native Int32 values');return value;},
  boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear action utility requires native Boolean results');return value;};
 const checkExecute=(node,previous)=>{
  boolean(previous);const condition=int32(readExecuteCondition(nonnull(node)));
  return condition===0?true:condition===1?previous:condition===2?!previous:false;
 };
 const runInto=(actions,sourceType,blackboard,snapshotRef)=>{
  int32(sourceType);if(actions==null||int32(readCount(actions))===0)return true;
  let previous=true;
  for(let index=0;index<int32(readCount(actions));index=(index+1)|0){
   const node=nonnull(readNode(actions,index)),allowed=int32(readAllowedSource(node));
   if((allowed&sourceType)!==sourceType){reportSourceMismatch(node,sourceType,int32(readAllowedSource(node)));return false;}
   if(!checkExecute(node,previous))return false;
   previous=boolean(executeNode(node,blackboard,sourceType,snapshotRef));
  }
  return previous;
 };
 return Object.freeze({checkExecute,runInto,
  run(actions,sourceType,blackboard){
   const battle=nonnull(readBattle()),context=nonnull(readContext(battle)),snapshotRef={value:copySnapshot(takeSnapshot(context))};
   runInto(actions,sourceType,blackboard,snapshotRef);return copySnapshot(snapshotRef.value);
  },
 });
}
