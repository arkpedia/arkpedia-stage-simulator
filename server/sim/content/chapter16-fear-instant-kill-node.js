// SPDX-License-Identifier: GPL-3.0-or-later
// Default InstantKill.Execute. Node effects and virtual dispatch remain
// explicit. A false result can mean the selected entity actually died.
export function fearProjectileInstantKillNode({getEntity,isDestroyedOrNull,asRallyPoint,isValidUnity,readInRallyPointMode,withdraw,finishWithNoReason,finishWithReachExit,suicide,readAlive}){
 if([getEntity,isDestroyedOrNull,asRallyPoint,isValidUnity,readInRallyPointMode,withdraw,finishWithNoReason,finishWithReachExit,suicide,readAlive].some(fn=>typeof fn!=='function'))throw new TypeError('Fear kill action requires native selection, RallyPoint and Entity callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear kill action dereferenced a null native object');return value;},
  boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear kill action requires native Boolean values');return value;},
  int32=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear kill action requires native Int32 values');return value;};
 return Object.freeze({execute(node,_blackboard,_sourceType,ref){
  nonnull(node);const entity=boolean(node._killSource)?nonnull(nonnull(ref).value).source:getEntity(ref,int32(node._targetType));
  if(boolean(isDestroyedOrNull(entity)))return false;
  const rally=entity==null?null:asRallyPoint(entity);
  if(boolean(node._withdrawIfRallyPoint)&&boolean(isValidUnity(rally))){
   if(boolean(readInRallyPointMode(nonnull(rally))))return boolean(node._resultIfInRallyPointMode);
   return boolean(withdraw(rally,false,false,true,false));
  }
  if(boolean(node._noReason))finishWithNoReason(nonnull(entity));
  else if(boolean(node._markReachExit)){const switchState=boolean(node._switchState);finishWithReachExit(nonnull(entity),switchState);}
  else{nonnull(entity);const skipReborn=boolean(node._skipReborn),noSource=boolean(node._noSource);suicide(entity,noSource,skipReborn);}
  return boolean(readAlive(entity));
 }});
}

// Entity.Suicide's default body only. The caller owns any post-effect alive
// query and lifecycle checks; SetHpInternal owns native raw-FP encoding.
export function fearProjectileEntitySuicide({readAlive,setHpInternal}){
 if([readAlive,setHpInternal].some(fn=>typeof fn!=='function'))throw new TypeError('Fear Entity suicide requires native alive and HP callers');
 return(entity,noSource,skipReborn)=>{
  if(entity==null)throw new TypeError('Fear Entity suicide dereferenced a null native object');
  if(typeof noSource!=='boolean'||typeof skipReborn!=='boolean')throw new TypeError('Fear Entity suicide requires native Boolean flags');
  const alive=readAlive(entity);if(typeof alive!=='boolean')throw new TypeError('Fear Entity suicide requires native Boolean alive result');
  if(alive){entity.m_isSuicide=true;setHpInternal(entity,{valueRaw:0n,force:true,noSource,skipReborn});}
 };
}
