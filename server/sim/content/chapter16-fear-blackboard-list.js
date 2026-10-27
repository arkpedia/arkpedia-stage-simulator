// SPDX-License-Identifier: GPL-3.0-or-later
// Selected List<DataPair> constructor, get_Item, set_Item and Add bodies.
// Runtime type initialization, write barriers and AddWithResize stay explicit.
export function fearProjectileDataPairLists({objectConstructor,readEmptyArray,writeBarrier,addWithResize}){
 if([objectConstructor,readEmptyArray,writeBarrier,addWithResize].some(fn=>typeof fn!=='function'))throw new TypeError('Fear DataPair lists require native initialization, barrier and growth callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear DataPair list dereferenced a null native object');return value;},
  int32=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear DataPair list requires native Int32 values');return value;},
  copy=value=>{
   nonnull(value);const key=value.key,number=value.value,text=value.valueStr;
   if((key!=null&&typeof key!=='string')||typeof number!=='number'||(text!=null&&typeof text!=='string'))throw new TypeError('Fear DataPair list requires native DataPair fields');
   return{key:key??null,value:Math.fround(number),valueStr:text??null};
  },
  array=value=>{nonnull(value);if(!Array.isArray(value))throw new TypeError('Fear DataPair list requires native array storage');return value;},
  indexInList=(list,index)=>{nonnull(list);const at=int32(index);if((at>>>0)>=(int32(list._size)>>>0))throw new RangeError('Fear DataPair list index is outside the native list');return at;},
  arrayIndex=(items,index)=>{if((index>>>0)>=items.length)throw new RangeError('Fear DataPair list index is outside the native array');};
 return Object.freeze({
  initialize(list){objectConstructor(list);const items=readEmptyArray();nonnull(list)._items=items;writeBarrier(list,'_items');},
  readCount:list=>int32(nonnull(list)._size),
  getItem(list,index){const at=indexInList(list,index),items=array(list._items);arrayIndex(items,at);return copy(items[at]);},
  setItem(list,index,value){
   const at=indexInList(list,index),items=array(list._items);arrayIndex(items,at);items[at]=copy(value);writeBarrier(items,at);list._version=(int32(list._version)+1)|0;
  },
  add(list,value){
   nonnull(list);list._version=(int32(list._version)+1)|0;
   const stored=list._items,size=int32(list._size),items=array(stored);
   if((size>>>0)<items.length){list._size=(size+1)|0;arrayIndex(items,size);items[size]=copy(value);writeBarrier(items,size);}
   else addWithResize(list,copy(value));
  },
 });
}
