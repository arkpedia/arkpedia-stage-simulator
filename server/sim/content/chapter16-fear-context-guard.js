// SPDX-License-Identifier: GPL-3.0-or-later
// Default Context.BeginChangeGard and selected ChangeGuard setters/Dispose.
// Allocation, initial snapshot pushes and native stack operations stay explicit.
export function fearProjectileContextGuards({allocateGuard,initializeGuard,duplicateAll,popPointer,pushPointer,popValue,isActive}){
 if([allocateGuard,initializeGuard,duplicateAll,popPointer,pushPointer,popValue,isActive].some(fn=>typeof fn!=='function'))throw new TypeError('Fear context guard requires native allocation, duplication, stack and lifecycle callers');
 const cancelled=Symbol('cancelled'),check=()=>{const active=isActive();if(typeof active!=='boolean')throw new TypeError('Fear context guard requires native Boolean lifecycle results');if(!active)throw cancelled;};
 const nonnull=value=>{if(value==null)throw new TypeError('Fear context guard dereferenced a null native object');return value;};
 // Guard operations complete their native stack changes once entered. Dispose
 // is cleanup and must remain callable after the outer lifecycle is cancelled.
 const invoke=(fn,...args)=>fn(...args);
 const run=fn=>{try{check();return fn();}catch(error){if(error===cancelled)return null;throw error;}};
 const set=(guard,field,value)=>run(()=>{
  const first=nonnull(nonnull(guard).m_context);invoke(popPointer,nonnull(first[field]));
  const current=nonnull(guard.m_context);invoke(pushPointer,nonnull(current[field]),value);
 });
 return Object.freeze({
  begin:context=>run(()=>{
   const guard=nonnull(invoke(allocateGuard));invoke(initializeGuard,guard);
   guard.m_context=context;invoke(duplicateAll,nonnull(guard.m_context));return guard;
  }),
  setBuff:(guard,value)=>set(guard,'m_buff',value),setSource:(guard,value)=>set(guard,'m_source',value),
  setTarget:(guard,value)=>set(guard,'m_target',value),setTile:(guard,value)=>set(guard,'m_tile',value),
  dispose:guard=>{
   const context=nonnull(nonnull(guard).m_context);
   for(const [field,valueStack]of [['m_source',false],['m_target',false],['m_buff',false],['m_ability',true],['m_modifier',true],
    ['m_projectile',false],['m_tile',false],['m_mainTarget',true],['m_atkInfo',true],['m_mainBuff',false]])
    invoke(valueStack?popValue:popPointer,nonnull(context[field]));
  },
 });
}
