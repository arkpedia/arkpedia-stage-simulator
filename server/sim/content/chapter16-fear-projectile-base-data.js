// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear base ability data dereferenced a null native object');return value;};
const integer=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear base ability data requires native Int32 values');return value;};
const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear base ability data requires native Boolean values');return value;};
const calls=options=>{if(Object.values(options).some(fn=>typeof fn!=='function'))throw new TypeError('Fear base ability data requires native pointer, value-copy, blackboard and behaviour callers');};
export function fearProjectileSetAbilityBlackboard({writeBarrier}){calls({writeBarrier});return(ability,board)=>{nonnull(ability).board=board;writeBarrier(ability,'board',board);};}
export function fearProjectileBaseAbilityData({captureOwnerPointer,copyPointer,writeBarrier,copyOptionsTail,copyOptions,allocateBlackboard,
 constructEmptyBlackboard,constructCopyBlackboard,isNullOrEmpty,generatePrefixBlackboard,setBlackboard,readBlackboard,isValidUnity,setSelectorData}){
 calls({captureOwnerPointer,copyPointer,writeBarrier,copyOptionsTail,copyOptions,allocateBlackboard,constructEmptyBlackboard,constructCopyBlackboard,
  isNullOrEmpty,generatePrefixBlackboard,setBlackboard,readBlackboard,isValidUnity,setSelectorData});
 return(ability,owner,options)=>{
  nonnull(ability);nonnull(options);ability.m_owner=copyPointer(captureOwnerPointer(owner));writeBarrier(ability,'m_owner',ability.m_owner);
  const absent=options.blackboard==null;copyOptionsTail(options);let board;
  if(absent){board=nonnull(allocateBlackboard());constructEmptyBlackboard(board);}
  else if(!boolean(isNullOrEmpty(ability._metadata.blackboardPrefix))){
   copyOptionsTail(options);const source=nonnull(options.blackboard),prefix=ability._metadata.blackboardPrefix;board=generatePrefixBlackboard(source,prefix);
  }else{
   const copied=copyOptions(options);board=nonnull(allocateBlackboard());constructCopyBlackboard(board,copied.blackboard);
  }
  setBlackboard(ability,board);const current=readBlackboard(ability);options.blackboard=current;writeBarrier(options,'blackboard',current);
  const stored=copyOptions(options);ability.options=stored;writeBarrier(ability,'options',stored);
  const selector=ability._selector;
  if(boolean(isValidUnity(selector))){const selected=ability._selector,selectedBoard=readBlackboard(ability);setSelectorData(nonnull(selected),selectedBoard);}
 };
}
export function fearProjectileStandardAbilityData({copyOptions,baseDoSetData,readLength,readElement,readBlackboard,setBehaviourData,generatePurposeMask}){
 calls({copyOptions,baseDoSetData,readLength,readElement,readBlackboard,setBehaviourData,generatePurposeMask});
 return(ability,owner,options)=>{
  nonnull(ability);baseDoSetData(ability,owner,copyOptions(nonnull(options)));
  let boundary=nonnull(ability.m_behaviours),index=0;
  while(index<integer(readLength(boundary))){
   const array=nonnull(ability.m_behaviours),length=integer(readLength(array));if((index>>>0)>=(length>>>0))throw new RangeError('Fear base ability data native behaviour array bounds');
   const behaviour=readElement(array,index),board=readBlackboard(ability);setBehaviourData(nonnull(behaviour),board);
   boundary=nonnull(ability.m_behaviours);index++;
  }
  ability.m_purposeMask=integer(generatePurposeMask(ability));
 };
}
