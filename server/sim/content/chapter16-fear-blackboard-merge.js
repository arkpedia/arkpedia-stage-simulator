// SPDX-License-Identifier: GPL-3.0-or-later
// Default Blackboard.MergeTo(ref List<DataPair>, List<DataPair>). Native
// list storage and culture-aware String.Compare remain explicit receivers.
export function fearProjectileBlackboardMerge({allocateList,initializeList,readCount,readItem,setItem,addItem,compareIgnoreCase}){
 if([allocateList,initializeList,readCount,readItem,setItem,addItem,compareIgnoreCase].some(fn=>typeof fn!=='function'))throw new TypeError('Fear blackboard merge requires native list and comparison callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear blackboard merge dereferenced a null native object');return value;},
  int32=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear blackboard merge requires native Int32 values');return value;},
  copy=value=>{
   nonnull(value);const key=value.key,number=value.value,text=value.valueStr;
   if((key!=null&&typeof key!=='string')||typeof number!=='number'||(text!=null&&typeof text!=='string'))throw new TypeError('Fear blackboard merge requires native DataPair fields');
   return{key:key??null,value:Math.fround(number),valueStr:text??null};
  };
 return function merge(to,from){
  if(from==null)return;
  if(nonnull(to).value==null){const list=nonnull(allocateList());initializeList(list);to.value=list;}
  for(let sourceIndex=0;sourceIndex<int32(readCount(from));sourceIndex++){
   const pair=copy(readItem(from,sourceIndex));let targetIndex=0;
   for(;;targetIndex++){
    const target=nonnull(to.value);
    if(targetIndex>=int32(readCount(target))){addItem(target,copy(pair));break;}
    const existing=copy(readItem(target,targetIndex));
    if(int32(compareIgnoreCase(existing.key,pair.key,true))===0){setItem(nonnull(to.value),targetIndex,copy(pair));break;}
   }
  }
 };
}
