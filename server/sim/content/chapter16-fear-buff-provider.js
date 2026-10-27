// SPDX-License-Identifier: GPL-3.0-or-later
// Default Buff.GetValue provider. Registration selects relevant attributes;
// this method checks actual enable state and reads four native value arrays.
export function fearProjectileBuffAttributeProvider({buff,readIsEnabled=value=>value.m_isActuallyEnabled,isActive}){
 if(!buff||[readIsEnabled,isActive].some(fn=>typeof fn!=='function'))throw new TypeError('Fear buff provider requires native buff, enable and lifecycle callers');
 const cancelled=Symbol('cancelled'),check=()=>{const active=isActive();if(typeof active!=='boolean')throw new TypeError('Fear buff provider requires native Boolean lifecycle results');if(!active)throw cancelled;};
 const raw=value=>{if(typeof value!=='bigint'||value<-(1n<<63n)||value>=(1n<<63n))throw new TypeError('Fear buff provider requires signed FP values');return value;};
 return Object.freeze({getValue(index,out){
  try{
   check();if(!Number.isInteger(index)||index<-(2**31)||index>=2**31)throw new TypeError('Fear buff provider requires native Int32 attributes');
   const enabled=readIsEnabled(buff);check();if(typeof enabled!=='boolean')throw new TypeError('Fear buff provider requires native Boolean enable results');
   const write=(name,value)=>{
    if(out==null||typeof out!=='object')throw new TypeError('Fear buff provider dereferenced null native output storage');
    out[name]=raw(value);check();
   };
   if(!enabled){write('finalAddition',0n);write('multiplier',0n);write('addition',0n);write('finalScaler',1n<<32n);return false;}
   for(const [field,name]of [['m_attributeAdditions','addition'],['m_attributeMultipliers','multiplier'],
    ['m_attributeFinalAdditions','finalAddition'],['m_attributeFinalScalers','finalScaler']]){
    const array=buff[field];if(array==null)throw new TypeError('Fear buff provider dereferenced a null native value array');
    if(!Array.isArray(array))throw new TypeError('Fear buff provider requires native value arrays');
    if(index<0||index>=array.length)throw new RangeError('Fear buff provider attribute is outside the native array');
    write(name,array[index]);
   }
   return true;
  }catch(error){if(error===cancelled)return null;throw error;}
 }});
}
