// SPDX-License-Identifier: GPL-3.0-or-later
import {fearProjectileMultiplyRaw,fearProjectileRoundRawToInt} from './chapter16-fear-fixed-values.js';

// Default Attributes value/calculate/round paths. Provider enumeration and
// obscured-value conversion stay explicit native receivers.
export function fearProjectileAttributeValues({attributes,openModifiers,getModifierValue,decodeBaseValue,decodeCachedValue,encodeValue,isActive}){
 if(!attributes||[openModifiers,getModifierValue,decodeBaseValue,decodeCachedValue,encodeValue,isActive].some(fn=>typeof fn!=='function'))throw new TypeError('Fear attribute values require native attributes, enumeration, provider, conversion and lifecycle callers');
 const cancelled=Symbol('cancelled'),check=()=>{const active=isActive();if(typeof active!=='boolean')throw new TypeError('Fear attribute values require native Boolean lifecycle results');if(!active)throw cancelled;};
 const raw=value=>{if(typeof value!=='bigint'||value<-(1n<<63n)||value>=(1n<<63n))throw new TypeError('Fear attribute values require signed FP and Int64 masks');return value;};
 const int=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear attribute values require native Int32 indices');return value;};
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear attribute values require native Boolean results');return value;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 const item=(values,index)=>{
  if(values==null)throw new TypeError('Fear attribute values dereferenced a null native array');
  if(!Array.isArray(values))throw new TypeError('Fear attribute values require native array projections');
  if(index<0||index>=values.length)throw new RangeError('Fear attribute is outside the native array');return values[index];
 };
 const bytes=value=>{if(!(value instanceof Uint8Array)||value.length!==40)throw new TypeError('Fear attribute values require complete forty-byte ObscuredFP records');return value;};
 const add=(a,b)=>BigInt.asIntN(64,raw(a)+raw(b));
 const bound=(index,name)=>{
  const override=item(attributes.m_overrideDataRange,index);
  if(override==null)throw new TypeError('Fear attribute range requires a native nullable pair projection');
  const pair=boolean(override.hasValue)?override.value:item(attributes.m_dataRange,index);
  if(pair==null)throw new TypeError('Fear attribute range dereferenced a null native pair');return raw(pair[name]);
 };
 const calculate=index=>{
  let addition=0n,multiplier=1n<<32n,finalAddition=0n,finalScaler=1n<<32n;
  const out={addition:0n,multiplier:0n,finalAddition:0n,finalScaler:0n},set=item(attributes.m_attributeModifiers,index);
  if(set!=null){
   const iterator=openModifiers(set);
   try{
    check();if(!iterator||['moveNext','current','dispose'].some(name=>typeof iterator[name]!=='function'))throw new TypeError('Fear attribute values require disposable native modifier enumeration');
    while(boolean(invoke(()=>iterator.moveNext()))){
     const modifier=invoke(()=>iterator.current());if(modifier==null)throw new TypeError('Fear attribute values dereferenced a null native modifier');
     if(boolean(invoke(getModifierValue,modifier,index,out))){
      addition=add(addition,out.addition);multiplier=add(multiplier,out.multiplier);
      finalAddition=add(finalAddition,out.finalAddition);finalScaler=fearProjectileMultiplyRaw(finalScaler,raw(out.finalScaler));
     }
    }
   }finally{if(iterator&&typeof iterator.dispose==='function')iterator.dispose();}
   check();
  }
  const dirty=raw(attributes.m_dirtyMask),bit=1n<<BigInt(index&63);
  attributes.m_dirtyMask=BigInt.asIntN(64,dirty-(dirty&bit));check();
  const base=raw(invoke(decodeBaseValue,bytes(item(attributes.m_rawData,index))));
  const scaled=fearProjectileMultiplyRaw(add(base,addition),multiplier>0n?multiplier:0n);
  let value=fearProjectileMultiplyRaw(add(scaled,finalAddition),finalScaler);
  const minimum=bound(index,'minRaw'),maximum=bound(index,'maxRaw');
  if(value>maximum)value=maximum;if(value<minimum)value=minimum;
  // Native code captures this array before the conversion call, then checks it.
  const cache=attributes.m_cachedData,encoded=bytes(invoke(encodeValue,value));
  item(cache,index);cache[index]=new Uint8Array(encoded);check();return value;
 };
 const get=index=>{
  int(index);const dirty=raw(attributes.m_dirtyMask),bit=1n<<BigInt(index&63);
  if(BigInt.asIntN(64,dirty&bit)>0n)return calculate(index);
  return raw(invoke(decodeCachedValue,new Uint8Array(bytes(item(attributes.m_cachedData,index)))));
 };
 const run=fn=>{try{check();return fn();}catch(error){if(error===cancelled)return null;throw error;}};
 return Object.freeze({getValue:index=>run(()=>get(index)),getValueRoundToInt:index=>run(()=>fearProjectileRoundRawToInt(get(index)))});
}
