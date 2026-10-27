// SPDX-License-Identifier: GPL-3.0-or-later
const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear buff admission requires native Boolean results');return value;};
const nonnull=value=>{if(value==null)throw new TypeError('Fear buff admission dereferenced a null native object');return value;};
const int32=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear buff admission requires native Int32 values');return value;};

// The combo manager stores a signed Int64 mask. TEST/SETG rejects bit63 even
// when set; enum shifts use only their low six bits.
export function fearProjectileComboFlag(manager,flag){
 const mask=nonnull(manager).m_abnormalFlagMask;
 if(typeof mask!=='bigint'||mask<-(1n<<63n)||mask>=(1n<<63n))throw new TypeError('Fear combo query requires a native signed Int64 mask');
 return BigInt.asIntN(64,mask&(1n<<BigInt(int32(flag)&63)))>0n;
}

// Selected Attributes.GetAbnormalFlag/GetAbnormalAnti over native Int16-array
// projections. AbnormalComboMgr remains an explicit native receiver.
export function fearProjectileAttributeStatus({attributes,readComboFlag=fearProjectileComboFlag,isActive}){
 if(!attributes||[readComboFlag,isActive].some(fn=>typeof fn!=='function'))throw new TypeError('Fear attribute status requires native counters, combo and lifecycle callers');
 let running=false;const cancelled=Symbol('cancelled');
 const check=()=>{if(!boolean(isActive()))throw cancelled;};
 const counter=(values,index)=>{
  if(!Array.isArray(values))throw new TypeError('Fear attribute status requires native Int16 counter arrays');
  if(index<0||index>=values.length)throw new RangeError('Fear abnormal flag is outside the native counter array');
  const value=values[index];if(!Number.isInteger(value)||value<-32768||value>32767)throw new TypeError('Fear attribute status requires native signed Int16 counters');
  return value;
 };
 const run=fn=>{
  if(running)return null;running=true;
  try{check();return fn();}catch(error){if(error===cancelled)return null;throw error;}finally{running=false;}
 };
 return Object.freeze({
  getAbnormalAnti:flag=>run(()=>counter(attributes.m_abnormalAntiCounter,int32(flag))>0),
  getAbnormalFlag:flag=>run(()=>{
   const index=int32(flag);
   if(counter(attributes.m_abnormalImmuneCounter,index)<=0&&counter(attributes.m_abnormalFlagsCounter,index)>0)return true;
   const manager=nonnull(attributes.m_abnormalComboMgr),result=readComboFlag(manager,flag);check();return boolean(result);
  }),
 });
}

export function fearProjectileBuffAdmission({readFlags,isNullOrEmpty,containsFlag,openFlags,readOwnerAttributes,getAbnormalAnti,
 readOwner,asEnemy,isDestroyedOrNull,readRawMotionMode,readIsLevitate,readStatusResistable,getAbnormalFlag,isActive}){
 if([readFlags,isNullOrEmpty,containsFlag,openFlags,readOwnerAttributes,getAbnormalAnti,readOwner,asEnemy,isDestroyedOrNull,
  readRawMotionMode,readIsLevitate,readStatusResistable,getAbnormalFlag,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear buff admission requires native flag-list, owner, attribute, type and lifecycle callers');
 let running=false;const cancelled=Symbol('cancelled');
 const check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 const run=fn=>{
  if(running)return null;running=true;
  try{check();return fn();}catch(error){if(error===cancelled)return null;throw error;}finally{running=false;}
 };
 return Object.freeze({
  passesAbnormalAnti:data=>run(()=>{
   if(boolean(invoke(isNullOrEmpty,invoke(readFlags,data))))return true;
   const flags=nonnull(invoke(readFlags,data)),iterator=openFlags(flags);let passes=true;
   try{
    check();if(!iterator||['moveNext','current','dispose'].some(name=>typeof iterator[name]!=='function'))
     throw new TypeError('Fear abnormal anti requires a disposable native flag enumerator');
    while(boolean(invoke(()=>iterator.moveNext()))){
     const flag=int32(invoke(()=>iterator.current())),attributes=nonnull(invoke(readOwnerAttributes));
     if(boolean(invoke(getAbnormalAnti,attributes,flag))){passes=false;break;}
    }
   }finally{if(iterator&&typeof iterator.dispose==='function')iterator.dispose();}
   check();return passes;
  }),
  passesLevitate:data=>run(()=>{
   if(boolean(invoke(isNullOrEmpty,invoke(readFlags,data))))return true;
   if(!boolean(invoke(containsFlag,invoke(readFlags,data),25)))return true;
   const owner=invoke(readOwner),enemy=owner!=null&&invoke(asEnemy,owner)!=null?owner:null;
   if(boolean(invoke(isDestroyedOrNull,enemy)))return false;
   nonnull(enemy);if(int32(invoke(readRawMotionMode,enemy))!==0)return false;
   if(!boolean(invoke(readIsLevitate,enemy)))return true;
   return boolean(invoke(containsFlag,invoke(readFlags,data),36));
  }),
  passesStatusAnti:buff=>run(()=>{
   nonnull(buff);if(!boolean(invoke(readStatusResistable,buff)))return true;
   return!boolean(invoke(getAbnormalFlag,nonnull(invoke(readOwnerAttributes)),30));
  }),
 });
}
