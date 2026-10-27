// SPDX-License-Identifier: GPL-3.0-or-later
// Default Attributes.AddModifier/RemoveModifier ordering. HashSet equality,
// interface dispatch, combo recalculation and dirty propagation stay explicit.
export function fearProjectileAttributeModifiers({attributes,addToSet,removeFromSet,readMask,pushCombo,popCombo,
 markAttributeDirty,calculateAbnormalDirty,isActive}){
 if(!attributes||[addToSet,removeFromSet,readMask,pushCombo,popCombo,markAttributeDirty,calculateAbnormalDirty,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear modifier mutation requires native attributes, sets, interface, combo and lifecycle callers');
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear modifier mutation requires native Boolean results');return value;};
 const nonnull=value=>{if(value==null)throw new TypeError('Fear modifier mutation dereferenced a null native object');return value;};
 const mask=value=>{if(typeof value!=='bigint'||value<0n||value>=(1n<<64n))throw new TypeError('Fear modifier mutation requires native UInt64 masks');return value;};
 const cancelled=Symbol('cancelled'),check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 const changeCounter=(field,index,delta)=>{
  const values=nonnull(attributes[field]);
  if(!Array.isArray(values))throw new TypeError('Fear modifier mutation requires native Int16 array projections');
  if(index>=values.length)throw new RangeError('Fear modifier counter is outside the native array');
  const value=values[index];if(!Number.isInteger(value)||value<-32768||value>32767)throw new TypeError('Fear modifier mutation requires native Int16 counters');
  values[index]=((value+delta+32768)&65535)-32768;
 };
 const mutate=(modifier,adding)=>{
  try{
   check();const mutateSet=adding?addToSet:removeFromSet;
   const changed=boolean(invoke(mutateSet,nonnull(attributes.m_abnormalFlagModifiers),modifier));
   nonnull(modifier);
   if(changed){
    const immune=mask(invoke(readMask,modifier,2)),anti=mask(invoke(readMask,modifier,3)),flags=mask(invoke(readMask,modifier,1));
    for(let index=0;index<44;index++){
     const bit=1n<<BigInt(index);
     for(const [value,field]of [[flags,'m_abnormalFlagsCounter'],[immune,'m_abnormalImmuneCounter'],[anti,'m_abnormalAntiCounter']]){
      if((value&bit)>0n){changeCounter(field,index,adding?1:-1);check();}
     }
    }
    const manager=attributes.m_abnormalComboMgr,combo=mask(invoke(readMask,modifier,4)),comboImmune=mask(invoke(readMask,modifier,5));
    invoke(adding?pushCombo:popCombo,nonnull(manager),combo,comboImmune);
   }
   const attributeMask=mask(invoke(readMask,modifier,0));
   for(let index=0;index<38;index++)if((attributeMask&(1n<<BigInt(index)))>0n){
    const sets=nonnull(attributes.m_attributeModifiers);
    if(!Array.isArray(sets))throw new TypeError('Fear modifier mutation requires native per-attribute set arrays');
    if(index>=sets.length)throw new RangeError('Fear modifier attribute is outside the native array');
    boolean(invoke(mutateSet,nonnull(sets[index]),modifier));
   }
   for(let index=0;index<38;index++)if((attributeMask&(1n<<BigInt(index)))>0n)invoke(markAttributeDirty,attributes,index);
   invoke(calculateAbnormalDirty,attributes,modifier);
  }catch(error){if(error===cancelled)return null;throw error;}
 };
 return Object.freeze({add:modifier=>mutate(modifier,true),remove:modifier=>mutate(modifier,false)});
}
