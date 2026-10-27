// SPDX-License-Identifier: GPL-3.0-or-later
// Selected Windows BuffData.DeepClone. Allocation/constructor, nested clones,
// array cast, blackboard construction and write barriers stay explicit.
const scalarFields=[
 ['buffKey','string'],['loadFromDB','bool'],['isDurableBuff','bool'],['isDamageMissable','bool'],['isSilenceable','bool'],['isStunnable','bool'],['isFreezable','bool'],['isLevitatable','bool'],['statusResistable','byte'],
 ['templateKey','string'],['disableOverride','bool'],['overrideKey','string'],['overrideType','int'],['maxStackCnt','int'],['refreshRemainingTimeWhenStackMax','bool'],['clearAllStackCntWhenTimeUp','bool'],['maxValidStackCnt','int'],['independentCharacterSource','bool'],
 ['overrideEffectKey','string'],['overrideOnEventPriority','bool'],['onEventPriority','int'],['audioSignal','string'],['lifeTimeType','byte'],['takeSnapshotWhenExtend','bool'],['durationKey','string'],['lifeTime','float'],['triggerLifeType','byte'],['triggerCnt','int'],['triggerInterval','float'],['waitFirstTriggerInterval','bool'],['firstTriggerInterval','float'],['priority','int'],
];
export function fearProjectileBuffDataClone({allocateData,initializeData,cloneAttributes,clonePriorityKeys,castPriorityKeys,isNullOrEmpty,allocateBlackboard,initializeBlackboard,writeBarrier}){
 if([allocateData,initializeData,cloneAttributes,clonePriorityKeys,castPriorityKeys,isNullOrEmpty,allocateBlackboard,initializeBlackboard,writeBarrier].some(fn=>typeof fn!=='function'))throw new TypeError('Fear BuffData clone requires native constructor, clone, cast, blackboard and barrier callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear BuffData clone dereferenced a null native object');return value;},
  boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear BuffData clone requires native Boolean values');return value;},
  scalar=(value,kind)=>{
   if(kind==='bool')return boolean(value);
   if(kind==='string'){if(value!=null&&typeof value!=='string')throw new TypeError('Fear BuffData clone requires nullable native strings');return value??null;}
   if(kind==='float'){if(typeof value!=='number')throw new TypeError('Fear BuffData clone requires native Single values');return Math.fround(value);}
   if(!Number.isInteger(value)||value<(kind==='byte'?0:-(2**31))||value>(kind==='byte'?255:2**31-1))throw new TypeError('Fear BuffData clone requires native integer values');return value;
  };
 return function clone(source){
  const target=nonnull(allocateData());initializeData(target);
  target.attributes=cloneAttributes(nonnull(nonnull(source).attributes));writeBarrier(target,'attributes');
  for(const [name,kind]of scalarFields){target[name]=scalar(source[name],kind);if(kind==='string')writeBarrier(target,name);}
  const keys=source.priorityBBKeys;let copiedKeys=null;
  if(keys!=null){const raw=clonePriorityKeys(keys);if(raw!=null){copiedKeys=castPriorityKeys(raw);if(copiedKeys==null)throw new TypeError('Fear BuffData clone priority keys failed native array cast');}}
  target.priorityBBKeys=copiedKeys;writeBarrier(target,'priorityBBKeys');
  target.stripBlackboardParamsWithBuffKey=boolean(source.stripBlackboardParamsWithBuffKey);
  target.enableInitDirectionFromSource=boolean(source.enableInitDirectionFromSource);
  if(!boolean(isNullOrEmpty(source.blackboard))){
   const board=source.blackboard,copy=nonnull(allocateBlackboard());initializeBlackboard(copy,board);target.blackboard=copy;writeBarrier(target,'blackboard');
  }
  return target;
 };
}
