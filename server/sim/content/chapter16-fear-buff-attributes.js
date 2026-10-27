// SPDX-License-Identifier: GPL-3.0-or-later
import {fearProjectileFloatToRaw,fearProjectileMultiplyRaw} from './chapter16-fear-fixed-values.js';

// Selected default Buff._LoadAttributesModifier. Canonical enum values, source
// ObjectPtr/Unity validity, attribute lookup and snapshot effects stay explicit.
export function fearProjectileLoadBuffAttributes({buff,attributes,stackCount,tryGetFP,getBlackboardKey,readSource,
 isDestroyedOrNull,readSourceAttribute,captureSnapshot,isActive}){
 if(!buff||!attributes||[tryGetFP,getBlackboardKey,readSource,isDestroyedOrNull,readSourceAttribute,captureSnapshot,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear attribute loading requires native data, source, blackboard and lifecycle callers');
 const cancelled=Symbol('cancelled');let running=false;
 const bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear attribute loading requires native Boolean results');return value;};
 const int=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear attribute loading requires native Int32 values');return value;};
 const raw=value=>{if(typeof value!=='bigint'||value<-(1n<<63n)||value>(1n<<63n)-1n)throw new TypeError('Fear attribute loading requires signed Q32.32 values');return value;};
 int(stackCount);
 const check=()=>{if(!bool(isActive()))throw cancelled;};
 const call=(fn,...args)=>{const value=fn(...args);check();return value;};
 const mask=values=>{
  if(values==null)return 0n;
  if(!Array.isArray(values))throw new TypeError('Fear abnormal masks require native enum-list projections');
  let result=0n;
  for(let index=0;index<values.length;index++){result|=1n<<BigInt(int(values[index])&63);check();}
  return result;
 };
 const put=(name,index,value)=>{
  const array=buff[name];
  if(!Array.isArray(array))throw new TypeError('Fear attribute loading requires native modifier-array projections');
  if(index<0||index>=array.length)throw new RangeError('Fear attribute index is outside the native modifier array');
  array[index]=raw(value);
 };
 const add=(name,index,value)=>{
  const array=buff[name];
  if(!Array.isArray(array)||index<0||index>=array.length)throw new RangeError('Fear attribute index is outside the native modifier array');
  put(name,index,BigInt.asIntN(64,raw(array[index])+value));
 };
 const scale=value=>value>=0n?value:BigInt.asIntN(64,(1n<<32n)+value);
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    check();
    for(const[source,target]of [['abnormalFlags','abnormalFlagMask'],['abnormalImmunes','abnormalImmuneMask'],['abnormalAntis','abnormalAntiMask'],
     ['abnormalCombos','abnormalComboMask'],['abnormalComboImmunes','abnormalComboImmuneMask']]){buff[target]=mask(attributes[source]);check();}
    buff.attributeMask=0n;
    for(let index=0;index<38;index++){
     put('m_attributeAdditions',index,0n);put('m_attributeFinalAdditions',index,0n);
     put('m_attributeMultipliers',index,0n);put('m_attributeFinalScalers',index,1n<<32n);check();
    }
    for(let index=0;;index++){
     const modifiers=attributes.attributeModifiers;
     if(modifiers==null)break;
     if(!Array.isArray(modifiers))throw new TypeError('Fear attribute loading requires a native modifier-list projection');
     if(index>=modifiers.length)break;
     const modifier=modifiers[index];if(!modifier)throw new TypeError('Fear attribute modifier cannot be null');
     let value=fearProjectileFloatToRaw(modifier.value);
     if(bool(modifier.loadFromBlackboard)){
      const key=call(getBlackboardKey,int(modifier.attributeType));
      const lookup=call(tryGetFP,key);
      if(!lookup||typeof lookup.found!=='boolean')throw new TypeError('Fear attribute lookup requires native found/out FP results');
      value=lookup.found?raw(lookup.valueRaw):fearProjectileFloatToRaw(modifier.value);
     }
     value=fearProjectileMultiplyRaw(value,BigInt(stackCount)<<32n);
     const formula=int(modifier.formulaItem);
     let target;
     if(bool(modifier.fetchBaseValueFromSourceEntity)){
      const source=call(readSource),destroyed=call(isDestroyedOrNull,source);
      if(bool(destroyed))continue;
      if(source==null)throw new TypeError('Fear source attribute lookup requires a nonnull source');
      const base=raw(call(readSourceAttribute,source,int(modifier.attributeType)));
      if(formula===0||formula===2)value=BigInt.asIntN(64,base+value);
      else if(formula===1)value=fearProjectileMultiplyRaw(base,value);
      else if(formula===3)value=fearProjectileMultiplyRaw(base,scale(value));
      if(formula===0||formula===1)target='m_attributeAdditions';
      else if(formula===2||formula===3)target='m_attributeFinalAdditions';
     }else{
      target=['m_attributeAdditions','m_attributeMultipliers','m_attributeFinalAdditions','m_attributeFinalScalers'][formula];
     }
     const attribute=int(modifier.attributeType);
     if(target==='m_attributeFinalScalers'){
      const array=buff[target];if(!Array.isArray(array)||attribute<0||attribute>=array.length)throw new RangeError('Fear attribute index is outside the native modifier array');
      put(target,attribute,fearProjectileMultiplyRaw(raw(array[attribute]),scale(value)));
     }else if(target)add(target,attribute,value);
     buff.attributeMask|=1n<<BigInt(int(modifier.attributeType)&63);check();
    }
    const source=call(readSource),destroyed=call(isDestroyedOrNull,source);
    if(!bool(destroyed)){
     if(source==null)throw new TypeError('Fear attribute snapshot requires a nonnull source');
     call(captureSnapshot,source,buff);
    }
   }catch(error){if(error===cancelled)return null;throw error;}
   finally{running=false;}
  },
 });
}
