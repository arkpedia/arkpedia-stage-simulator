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
