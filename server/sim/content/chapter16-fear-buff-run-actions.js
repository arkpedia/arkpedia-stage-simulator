// SPDX-License-Identifier: GPL-3.0-or-later
// Default Buff._RunActions. Context guard effects, ActionUtil execution and
// mixed reference/value Snapshot copies remain explicit native receivers.
export function fearProjectileRunBuffActions({buff,readContext,beginChangeGuard,setBuff,readSource,setSource,readOwner,
 setTarget,readAlive,readRootTile,setTile,runActionArray,copySnapshot,disposeGuard,isActive}){
 if(!buff||[readContext,beginChangeGuard,setBuff,readSource,setSource,readOwner,setTarget,readAlive,readRootTile,setTile,
  runActionArray,copySnapshot,disposeGuard,isActive].some(fn=>typeof fn!=='function'))throw new TypeError('Fear buff action dispatch requires native buff, context guard, owner, action and lifecycle callers');
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear buff action dispatch requires native Boolean results');return value;};
 const nonnull=value=>{if(value==null)throw new TypeError('Fear buff action dispatch dereferenced a null native object');return value;};
 const cancelled=Symbol('cancelled'),check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 return Object.freeze({run(event,setMeAsTarget){
  try{
   check();if(!Number.isInteger(event)||event<-(2**31)||event>=2**31)throw new TypeError('Fear buff action dispatch requires a native Int32 event');boolean(setMeAsTarget);
   const context=nonnull(invoke(readContext,buff)),guard=beginChangeGuard(context);let result;
   try{
    check();invoke(setBuff,nonnull(guard),buff);
    const source=invoke(readSource,buff);invoke(setSource,nonnull(guard),source);
    if(setMeAsTarget){const owner=invoke(readOwner,buff);invoke(setTarget,nonnull(guard),owner);}
    const owner=nonnull(invoke(readOwner,buff));
    if(boolean(invoke(readAlive,owner))){
     const current=nonnull(invoke(readOwner,buff)),tile=invoke(readRootTile,current);invoke(setTile,nonnull(guard),tile);
    }
    const actions=buff.m_actions;
    if(actions==null)throw new TypeError('Fear buff action dispatch dereferenced a null native action array');
    if(!Array.isArray(actions))throw new TypeError('Fear buff action dispatch requires native event action arrays');
    if(event<0||event>=actions.length)throw new RangeError('Fear buff event is outside the native action array');
    const board=buff.m_blackboard,selected=actions[event];
    const snapshot=invoke(runActionArray,selected,true,board);
    result=invoke(copySnapshot,snapshot);
   }finally{if(guard!=null)disposeGuard(guard);}
   check();return invoke(copySnapshot,result);
  }catch(error){if(error===cancelled)return null;throw error;}
 }});
}
