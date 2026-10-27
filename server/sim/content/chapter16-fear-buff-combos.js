// SPDX-License-Identifier: GPL-3.0-or-later
// Default AbnormalComboManager PushMask/PopMask and _UpdateAbnormalCombo.
// Static mapping reads remain replaceable native receivers.
export const FEAR_COMBO_FLAG_MASKS=Object.freeze([0x80028n,0x40028n]);
export function fearProjectileBuffCombos({manager,readFlagMasks=()=>FEAR_COMBO_FLAG_MASKS,isActive}){
 if(!manager||[readFlagMasks,isActive].some(fn=>typeof fn!=='function'))throw new TypeError('Fear combo mutation requires native manager, mapping and lifecycle callers');
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear combo mutation requires native Boolean results');return value;};
 const nonnull=value=>{if(value==null)throw new TypeError('Fear combo mutation dereferenced a null native object');return value;};
 const signed=value=>{if(typeof value!=='bigint'||value<-(1n<<63n)||value>=(1n<<63n))throw new TypeError('Fear combo mutation requires signed Int64 stored masks');return value;};
 const unsigned=value=>{if(typeof value!=='bigint'||value<0n||value>=(1n<<64n))throw new TypeError('Fear combo mutation requires UInt64 input masks');return value;};
 const cancelled=Symbol('cancelled'),check=()=>{if(!boolean(isActive()))throw cancelled;};
 const counter=(field,index,delta=0)=>{
  const values=nonnull(manager[field]);
  if(!Array.isArray(values))throw new TypeError('Fear combo mutation requires native Int16 arrays');
  if(index<0||index>=values.length)throw new RangeError('Fear combo counter is outside the native array');
  const value=values[index];if(!Number.isInteger(value)||value<-32768||value>32767)throw new TypeError('Fear combo mutation requires Int16 counters');
  if(delta!==0){values[index]=((value+delta+32768)&65535)-32768;check();return values[index];}
  return value;
 };
 const update=(index,bit)=>{
  const previous=signed(manager.m_abnormalComboMask);
  const active=counter('m_abnormalComboCounter',index)>0&&counter('m_abnormalComboImmuneCounter',index)<=0;
  if(((previous&bit)>0n)===active)return false;
  manager.m_abnormalComboMask=BigInt.asIntN(64,active?previous|bit:previous-(previous&bit));check();return true;
 };
 const mutate=(combo,immune,delta)=>{
  try{
   check();unsigned(combo);unsigned(immune);let changed=false;
   for(let index=0;index<2;index++){
    const bit=1n<<BigInt(index);let affected=false;
    if((combo&bit)>0n){counter('m_abnormalComboCounter',index,delta);affected=true;}
    if((immune&bit)>0n){counter('m_abnormalComboImmuneCounter',index,delta);affected=true;}
    if(affected){const result=update(index,bit);changed=result||changed;}
   }
   if(!changed)return;
   const current=signed(manager.m_abnormalComboMask);let flags=0n;
   for(let index=0;index<2;index++)if((current&(1n<<BigInt(index)))>0n){
    const values=readFlagMasks();check();nonnull(values);
    if(!Array.isArray(values))throw new TypeError('Fear combo mutation requires a native signed Int64 mapping array');
    if(index>=values.length)throw new RangeError('Fear combo mapping is outside the native array');
    flags=BigInt.asIntN(64,flags|signed(values[index]));
   }
   manager.m_abnormalFlagMask=flags;check();
  }catch(error){if(error===cancelled)return null;throw error;}
 };
 return Object.freeze({push:(combo,immune)=>mutate(combo,immune,1),pop:(combo,immune)=>mutate(combo,immune,-1)});
}
