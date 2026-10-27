// SPDX-License-Identifier: GPL-3.0-or-later
// Default constructors only. Allocation supplies zeroed native fields;
// runtime metadata initialization and hotfix dispatch are not projected here.
export function fearProjectileAttributeDataConstructor({objectConstructor}){
 if(typeof objectConstructor!=='function')throw new TypeError('Fear attribute data constructor requires the native Object constructor');
 return attributes=>{objectConstructor(attributes);};
}

export function fearProjectileBuffDataConstructor({allocateAttributes,initializeAttributes,writeBarrier,objectConstructor}){
 if([allocateAttributes,initializeAttributes,writeBarrier,objectConstructor].some(fn=>typeof fn!=='function'))throw new TypeError('Fear BuffData constructor requires native attribute allocation, initialization, barrier and base callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear BuffData constructor dereferenced a null native object');return value;};
 return function initialize(data){
  const attributes=nonnull(allocateAttributes());initializeAttributes(attributes);
  nonnull(data).attributes=attributes;writeBarrier(data,'attributes');
  data.statusResistable=2;data.templateKey='empty';writeBarrier(data,'templateKey');
  data.maxStackCnt=1;data.maxValidStackCnt=-1;data.lifeTimeType=1;
  data.triggerInterval=-1;data.waitFirstTriggerInterval=true;data.firstTriggerInterval=-1;data.priority=-1;
  objectConstructor(data);
 };
}
