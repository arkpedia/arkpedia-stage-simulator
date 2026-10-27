// SPDX-License-Identifier: GPL-3.0-or-later
// Field projection of the retained 136-byte Modifier and 40-byte AttackInfo.
// FP fields are signed Int64 raw values; object/list references keep identity.
// Padding, native addresses and GC state are outside this field projection.
const modifierFp=['m_value','realDelta','extraData','<originAtk>k__BackingField','<originValue>k__BackingField'];
const modifierInts=['sharedFlagMask','ignoreMissFlag','ignoreCancelReasonMask','<targetType>k__BackingField','<deltaType>k__BackingField',
 '<damageType>k__BackingField','<applyWay>k__BackingField','<cancelReason>k__BackingField','<attackType>k__BackingField','<elementType>k__BackingField','<playerSide>k__BackingField'];
const attackFp=['originAtk','atk','atkScale','atkAddition'];
const int32=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear context value requires native Int32 fields');return value;};
const fp=value=>{if(typeof value!=='bigint'||BigInt.asIntN(64,value)!==value)throw new TypeError('Fear context value requires signed Int64 raw FP fields');return value;};
const requireFields=(value,fields)=>{if(value==null||fields.some(field=>!Object.hasOwn(value,field)))throw new TypeError('Fear context value requires complete native fields');return value;};
const copyPointer=value=>{
 requireFields(value,['obj','cachedUid']);const uid=value.cachedUid;
 if(!Number.isInteger(uid)||uid<0||uid>0xffffffff)throw new TypeError('Fear context value requires native UInt32 pointer UIDs');
 return{obj:value.obj??null,cachedUid:uid};
};
export function fearProjectileContextStructValues(){
 const zeroPointer=()=>({obj:null,cachedUid:0}),zeroModifier=()=>{
  const result={m_source:zeroPointer(),m_target:zeroPointer(),ignoreForSp:false,customKeys:null};
  for(const field of modifierFp)result[field]=0n;for(const field of modifierInts)result[field]=0;return result;
 },zeroAttackInfo=()=>({damageType:0,originAtk:0n,atk:0n,atkScale:0n,atkAddition:0n});
 return Object.freeze({zeroModifier,zeroAttackInfo,
  copyModifier(value){
   requireFields(value,['m_source','m_target','ignoreForSp','customKeys',...modifierFp,...modifierInts]);
   const result={m_source:copyPointer(value.m_source),m_target:copyPointer(value.m_target)};
   for(const field of modifierFp)result[field]=fp(value[field]);
   if(typeof value.ignoreForSp!=='boolean')throw new TypeError('Fear context value requires native Boolean fields');
   result.ignoreForSp=value.ignoreForSp;for(const field of modifierInts)result[field]=int32(value[field]);result.customKeys=value.customKeys;return result;
  },
  copyAttackInfo(value){requireFields(value,['damageType',...attackFp]);const result={damageType:int32(value.damageType)};for(const field of attackFp)result[field]=fp(value[field]);return result;},
 });
}
