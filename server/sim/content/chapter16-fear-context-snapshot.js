// SPDX-License-Identifier: GPL-3.0-or-later
// Context.TakeSnapshot/_DuplicateAll. These synchronous context operations
// finish once entered; guard callers own lifecycle checks and cleanup.
export function fearProjectileContextSnapshots({context,peekReference,peekModifier,peekAttackInfo,copyModifier,copyAttackInfo,
 pushPointer,pushReferenceValue,pushModifier,pushAttackInfo}){
 if(!context||[peekReference,peekModifier,peekAttackInfo,copyModifier,copyAttackInfo,pushPointer,pushReferenceValue,pushModifier,pushAttackInfo].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear context snapshots require native context, stack, value-copy and push callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear context snapshots dereferenced a null native object');return value;};
 const copy=snapshot=>{
  nonnull(snapshot);
  return{source:snapshot.source,target:snapshot.target,buff:snapshot.buff,ability:snapshot.ability,
   modifier:copyModifier(snapshot.modifier),projectile:snapshot.projectile,tile:snapshot.tile,mainTarget:snapshot.mainTarget,
   atkInfo:copyAttackInfo(snapshot.atkInfo),mainBuff:snapshot.mainBuff};
 };
 const capture=()=>{
  const result={};
  for(const [field,name,kind]of [['m_source','source',0],['m_target','target',0],['m_buff','buff',0],['m_ability','ability',0],
   ['m_modifier','modifier',1],['m_projectile','projectile',0],['m_tile','tile',0],['m_atkInfo','atkInfo',2],['m_mainTarget','mainTarget',0],['m_mainBuff','mainBuff',0]]){
   const stack=nonnull(context[field]);
   result[name]=kind===1?copyModifier(peekModifier(stack)):kind===2?copyAttackInfo(peekAttackInfo(stack)):peekReference(stack);
  }
  return result;
 };
 return Object.freeze({takeSnapshot:capture,copySnapshot:copy,
  duplicateAll(){
   const result=copy(capture());
   for(const [field,name,kind]of [['m_source','source',0],['m_target','target',0],['m_buff','buff',0],['m_ability','ability',1],
    ['m_modifier','modifier',2],['m_projectile','projectile',0],['m_tile','tile',0],['m_mainTarget','mainTarget',1],['m_atkInfo','atkInfo',3],['m_mainBuff','mainBuff',0]]){
    // The native receiver is captured before copying the value passed to Push.
    const stack=context[field],snapshot=copy(result),value=snapshot[name];
    [pushPointer,pushReferenceValue,pushModifier,pushAttackInfo][kind](nonnull(stack),value);
   }
   return result;
  },
 });
}
