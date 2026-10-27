// SPDX-License-Identifier: GPL-3.0-or-later
// Selected List<DataPair> growth chain. Array allocation/copy, runtime empty
// array initialization and write barriers remain explicit native receivers.
export function fearProjectileDataPairListGrowth({allocateArray,copyArray,readEmptyArray,writeBarrier}){
 if([allocateArray,copyArray,readEmptyArray,writeBarrier].some(fn=>typeof fn!=='function'))throw new TypeError('Fear DataPair growth requires native array, initialization and barrier callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear DataPair growth dereferenced a null native object');return value;},
  int32=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear DataPair growth requires native Int32 values');return value;},
  array=value=>{nonnull(value);if(!Array.isArray(value))throw new TypeError('Fear DataPair growth requires native array storage');return value;},
  copy=value=>{nonnull(value);const key=value.key,number=value.value,text=value.valueStr;
   if((key!=null&&typeof key!=='string')||typeof number!=='number'||(text!=null&&typeof text!=='string'))throw new TypeError('Fear DataPair growth requires native DataPair fields');
   return{key:key??null,value:Math.fround(number),valueStr:text??null};};
 const setCapacity=(list,capacity)=>{
  nonnull(list);int32(capacity);if(capacity<int32(list._size))throw new RangeError('Fear DataPair capacity is below the native list size');
  const current=array(list._items);if(capacity===current.length)return;
  if(capacity>0){
   const replacement=allocateArray(capacity),count=int32(list._size);
   if(count>0)copyArray(list._items,0,replacement,0,count);
   list._items=replacement;
  }else list._items=readEmptyArray();
  writeBarrier(list,'_items');
 };
 const ensureCapacity=(list,minimum)=>{
  nonnull(list);int32(minimum);const items=array(list._items),length=int32(items.length);if(length>=minimum)return;
  let capacity=length===0?4:(length+length)|0;
  if(length!==0&&(capacity>>>0)>0x7fefffff)capacity=0x7fefffff;
  if(capacity<minimum)capacity=minimum;setCapacity(list,capacity);
 };
 return Object.freeze({setCapacity,ensureCapacity,
  addWithResize(list,value){
   nonnull(list);const index=int32(list._size),next=(index+1)|0;ensureCapacity(list,next);
   const stored=list._items;list._size=next;const items=array(stored);
   if((index>>>0)>=items.length)throw new RangeError('Fear DataPair growth index is outside the native array');
   items[index]=copy(value);writeBarrier(items,index);
  },
 });
}
