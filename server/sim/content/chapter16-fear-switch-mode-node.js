// SPDX-License-Identifier: GPL-3.0-or-later
// Default Nodes.SwitchMode.Execute. Unit calls return void; successful action
// dispatch does not depend on whether the Unit actually changed modes.
export function fearProjectileSwitchModeNode({getEntity,asUnit,isDestroyedOrNull,tryReadInt,switchByIndex,switchToDefaultMode}){
 if([getEntity,asUnit,isDestroyedOrNull,tryReadInt,switchByIndex,switchToDefaultMode].some(fn=>typeof fn!=='function'))throw new TypeError('Fear mode action requires native entity, cast, blackboard and Unit callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear mode action dereferenced a null native object');return value;},
  int32=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear mode action requires native Int32 values');return value;},
  boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear mode action requires native Boolean values');return value;};
 return Object.freeze({execute(node,blackboard,_sourceType,snapshotRef){
  const indexRef={value:0},entity=getEntity(snapshotRef,int32(nonnull(node)._targetType)),unit=entity==null?null:asUnit(entity);
  if(boolean(isDestroyedOrNull(unit)))return false;
  if(!boolean(node._loadModeFromBlackboard)||!boolean(tryReadInt(nonnull(blackboard),'mode',indexRef)))indexRef.value=int32(node._modeIndex);
  const index=int32(indexRef.value);nonnull(unit);
  if(boolean(node._restoreDefault))switchToDefaultMode(unit,boolean(node._restartFSM));
  else switchByIndex(unit,index,boolean(node._restartFSM));
  return true;
 }});
}
