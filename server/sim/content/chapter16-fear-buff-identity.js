// SPDX-License-Identifier: GPL-3.0-or-later
// Plain field projection of default Buff.OnAllocate/OnRecycle. The shared
// native static counter is supplied; it is not reset per owner or battle.
export function fearProjectileBuffIdentity({counter}){
 const uint=value=>{
  if(!Number.isInteger(value)||value<0||value>0xffffffff)throw new TypeError('Fear buff identity requires native UInt32 values');
  return value;
 };
 const field=(object,name)=>{
  if(!object||typeof object!=='object')throw new TypeError('Fear buff identity requires writable native field projections');
  const descriptor=Object.getOwnPropertyDescriptor(object,name);
  if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.writable)
   throw new TypeError('Fear buff identity requires writable native data fields');
  return descriptor.value;
 };
 const state=buff=>{
  uint(field(buff,'instanceUid'));
  if(typeof field(buff,'m_isValid')!=='boolean')throw new TypeError('Fear buff identity requires a native Boolean validity field');
 };
 uint(field(counter,'value'));
 return Object.freeze({
  allocate(buff){
   state(buff);const next=(uint(field(counter,'value'))+1)>>>0;
   counter.value=next;
   buff.instanceUid=next;
   buff.m_isValid=true;
  },
  recycle(buff){
   state(buff);
   buff.instanceUid=0;
   buff.m_isValid=false;
  },
 });
}

// The lifecycle-field block inside Buff.Reset, after context/blackboard copies
// and before timing/actions initialization. Allocation owns UID/validity.
export function fearProjectileResetBuffLifecycle(buff){
 const names=['m_started','m_isFinished','m_needRemove','m_isActuallyEnabled','m_isLateEnabled','m_isManuallyEnabled','m_isActuallyFinished'];
 if(!buff||typeof buff!=='object')throw new TypeError('Fear buff reset requires native lifecycle data fields');
 for(const name of names){
  const d=Object.getOwnPropertyDescriptor(buff,name);
  if(!d||!Object.hasOwn(d,'value')||!d.writable||typeof d.value!=='boolean')
   throw new TypeError('Fear buff reset requires native Boolean lifecycle data fields');
 }
 const derived=Object.getOwnPropertyDescriptor(buff,'m_derivedBuffs');
 if(!derived||!Object.hasOwn(derived,'value')||(derived.value!=null&&!Array.isArray(derived.value)))
  throw new TypeError('Fear buff reset requires a native nullable derived-buff list projection');
 for(const name of names)buff[name]=false;
 if(derived.value!=null)derived.value.length=0;
}
