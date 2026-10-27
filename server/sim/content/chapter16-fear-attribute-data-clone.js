// SPDX-License-Identifier: GPL-3.0-or-later
// Selected default AttributeModifier/AttributeModifierData clones. Runtime
// list construction, allocation, array compatibility and barriers stay explicit.
export function fearProjectileAttributeModifierConstructor({objectConstructor}){
 if(typeof objectConstructor!=='function')throw new TypeError('Fear modifier constructor requires the native Object constructor');
 return value=>{if(value==null)throw new TypeError('Fear modifier constructor dereferenced a null native object');value.loadFromBlackboard=true;objectConstructor(value);};
}
export function fearProjectileAttributeModifierClone({allocateModifier,initializeModifier}){
 if([allocateModifier,initializeModifier].some(fn=>typeof fn!=='function'))throw new TypeError('Fear modifier clone requires native allocation and construction');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear modifier clone dereferenced a null native object');return value;},
  int=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear modifier clone requires native Int32 fields');return value;},
  bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear modifier clone requires native Boolean fields');return value;};
 return source=>{
  const target=nonnull(allocateModifier());initializeModifier(target);nonnull(source);
  target.attributeType=int(source.attributeType);target.formulaItem=int(source.formulaItem);
  const value=source.value;if(typeof value!=='number')throw new TypeError('Fear modifier clone requires a native Single field');target.value=Math.fround(value);
  target.loadFromBlackboard=bool(source.loadFromBlackboard);target.fetchBaseValueFromSourceEntity=bool(source.fetchBaseValueFromSourceEntity);return target;
 };
}
export function fearProjectileAttributeDataClone({allocateData,initializeData,isNullOrEmpty,allocateStatusList,initializeStatusList,allocateModifierArray,cloneModifier,canStoreModifier,writeBarrier}){
 if([allocateData,initializeData,isNullOrEmpty,allocateStatusList,initializeStatusList,allocateModifierArray,cloneModifier,canStoreModifier,writeBarrier].some(fn=>typeof fn!=='function'))throw new TypeError('Fear attribute data clone requires native allocation, construction, list, modifier, cast and barrier callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear attribute data clone dereferenced a null native object');return value;},
  array=value=>{nonnull(value);if(!Array.isArray(value))throw new TypeError('Fear attribute data clone requires native modifier array storage');return value;},
  bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear attribute data clone requires native Boolean results');return value;};
 return source=>{
  const target=nonnull(allocateData());initializeData(target);
  for(const [field,kind]of [['abnormalFlags','flag'],['abnormalImmunes','flag'],['abnormalAntis','flag'],['abnormalCombos','combo'],['abnormalComboImmunes','combo']]){
   if(!bool(isNullOrEmpty(nonnull(source)[field],kind))){
    const current=source[field],list=nonnull(allocateStatusList(kind));initializeStatusList(list,current,kind);target[field]=list;writeBarrier(target,field);
   }
  }
  if(!bool(isNullOrEmpty(source.attributeModifiers,'array'))){
   const count=array(source.attributeModifiers).length;target.attributeModifiers=allocateModifierArray(count);writeBarrier(target,'attributeModifiers');
   let current=array(source.attributeModifiers);
   for(let index=0;index<current.length;index++){
    const captured=target.attributeModifiers,entry=nonnull(current[index]),clone=cloneModifier(entry),destination=array(captured);
    if(clone!=null&&!bool(canStoreModifier(clone,destination)))throw new TypeError('Fear attribute data clone encountered native array type mismatch');
    if(index>=destination.length)throw new RangeError('Fear attribute data clone index is outside the native destination array');
    destination[index]=clone;writeBarrier(destination,index);current=array(source.attributeModifiers);
   }
  }
  return target;
 };
}
