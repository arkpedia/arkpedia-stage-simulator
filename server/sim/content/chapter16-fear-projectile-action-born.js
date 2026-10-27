// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear projectile action birth dereferenced a null native object');return value;};
const integer=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear projectile action birth requires native Int32 values');return value;};
export function fearProjectileDefaultOnBorn(_object){}
export function fearProjectileBaseBorn({onBorn=fearProjectileDefaultOnBorn}={}){
 if(typeof onBorn!=='function')throw new TypeError('Fear base Born requires a virtual OnBorn caller');
 return object=>{nonnull(object);onBorn(object);object.borned=true;};
}
export function fearProjectileActionBirth({runActions}){
 if(typeof runActions!=='function')throw new TypeError('Fear action birth requires its native action runner');
 return controller=>{runActions(controller,5,null);};
}

// Remaining selected ChangeGuard setters. Like the native bodies, Pop and Push
// use separately fetched context/stack fields and complete once entered.
export function fearProjectileActionContextSetters({popPointer,pushPointer,popReference,pushReference}){
 if([popPointer,pushPointer,popReference,pushReference].some(fn=>typeof fn!=='function'))throw new TypeError('Fear action context setters require native stack callers');
 const set=(guard,field,value,pop,push)=>{
  const first=nonnull(nonnull(guard).m_context);pop(nonnull(first[field]));
  const current=nonnull(guard.m_context);push(nonnull(current[field]),value);
 };
 return Object.freeze({setProjectile:(guard,value)=>set(guard,'m_projectile',value,popPointer,pushPointer),
  setAbility:(guard,value)=>set(guard,'m_ability',value,popReference,pushReference),
  setMainTarget:(guard,value)=>set(guard,'m_mainTarget',value,popReference,pushReference)});
}

// Default ActionController._RunActions. Cleanup precedes the separately fetched
// projectile callback. Native context/array/action/delegate effects are callers.
export function fearProjectileControllerRunActions({readProjectile,readContext,beginGuard,setProjectile,readSource,setSource,isNullUnity,
 readTraceTarget,setTarget,setMainTarget,readAbility,setAbility,readActions,readLength,readElement,readBlackboard,runActionArray,
 disposeGuard,readEventCallbacks,invokeCallback}){
 if([readProjectile,readContext,beginGuard,setProjectile,readSource,setSource,isNullUnity,readTraceTarget,setTarget,setMainTarget,
  readAbility,setAbility,readActions,readLength,readElement,readBlackboard,runActionArray,disposeGuard,readEventCallbacks,invokeCallback].some(fn=>typeof fn!=='function'))throw new TypeError('Fear projectile action runner requires native context, arrays, actions and cleanup callers');
 const index=(array,event)=>{const length=integer(readLength(array));if((event>>>0)>=(length>>>0))throw new RangeError('Fear projectile action runner native array bounds');};
 return(controller,event,target)=>{
  nonnull(controller);integer(event);const context=nonnull(readContext(nonnull(readProjectile(controller)))),guard=beginGuard(context);
  try{
   setProjectile(nonnull(guard),readProjectile(controller));
   const source=readSource(nonnull(readProjectile(controller)));setSource(nonnull(guard),source);
   const absent=isNullUnity(target);if(typeof absent!=='boolean')throw new TypeError('Fear projectile action runner requires native Boolean Unity queries');
   const selected=absent?readTraceTarget(nonnull(readProjectile(controller))):target;setTarget(nonnull(guard),selected);
   const main=readTraceTarget(nonnull(readProjectile(controller)));setMainTarget(nonnull(guard),main);
   const ability=readAbility(nonnull(readProjectile(controller)));setAbility(nonnull(guard),ability);
   const actions=nonnull(readActions(controller));index(actions,event);const blackboard=readBlackboard(controller),nodes=readElement(actions,event);
   runActionArray(nodes,4,blackboard);
  }finally{if(guard!=null)disposeGuard(guard);}
  const projectile=nonnull(readProjectile(controller)),callbacks=nonnull(readEventCallbacks(projectile));index(callbacks,event);
  const callback=readElement(callbacks,event);if(callback!=null)invokeCallback(callback,projectile);
 };
}
