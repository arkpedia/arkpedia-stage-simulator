// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear context stack dereferenced a null native receiver');return value;};
const count=(readCount,stack)=>{const value=readCount(nonnull(stack));if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear context stack requires native Int32 counts');return value;};

// Array.Copy's entry guards and fast-copy dispatch. The fallback receiver must
// perform the remaining native bounds, type, conversion and exception behavior.
export function fearProjectileManagedArrayCopy({readRank,tryFastCopy,copyFallback}){
 if([readRank,tryFastCopy,copyFallback].some(fn=>typeof fn!=='function'))throw new TypeError('Fear array copy requires native rank, fast-copy and fallback callers');
 const rank=value=>{const result=readRank(value);if(!Number.isInteger(result)||result<0||result>255)throw new TypeError('Fear array copy requires native byte ranks');return result;};
 return(source,sourceIndex,destination,destinationIndex,length)=>{
  for(const value of [sourceIndex,destinationIndex,length])if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear array copy requires native Int32 indices and length');
  if(source==null)throw new TypeError('Fear array copy source is null');
  if(destination==null)throw new TypeError('Fear array copy destination is null');
  if(length<0)throw new RangeError('Fear array copy length is negative');
  const sourceRank=rank(source),destinationRank=rank(destination);
  if(sourceRank!==destinationRank)throw new TypeError('Fear array copy ranks differ');
  if(sourceIndex<0)throw new RangeError('Fear array copy source index is negative');
  if(destinationIndex<0)throw new RangeError('Fear array copy destination index is negative');
  const copied=tryFastCopy(source,sourceIndex,destination,destinationIndex,length);
  if(typeof copied!=='boolean')throw new TypeError('Fear array fast-copy requires native Boolean result');
  if(!copied)copyFallback(source,sourceIndex,destination,destinationIndex,length);
 };
}

// Selected Array.Resize<T> wrapper over a byref stack array field. Allocation
// includes the selected array class initialization; Array.Copy stays explicit.
export function fearProjectileManagedArrayResize({allocateArray,copyArray}){
 if([allocateArray,copyArray].some(fn=>typeof fn!=='function'))throw new TypeError('Fear array resize requires native allocation and Array.Copy callers');
 return(stack,newSize)=>{
  if(!Number.isInteger(newSize)||newSize<-(2**31)||newSize>=2**31)throw new TypeError('Fear array resize requires native Int32 size');
  if(newSize<0)throw new RangeError('Fear array resize requires nonnegative size');
  nonnull(stack);const old=stack._array;
  if(old==null){stack._array=allocateArray(newSize);return;}
  if(old.length===newSize)return;
  const replacement=allocateArray(newSize),length=Math.min(old.length,newSize);
  copyArray(old,0,replacement,0,length);
  stack._array=replacement;
 };
}

// Canonical Stack<Object> storage only. Array.Resize remains an explicit byref
// caller; value structs and ObjectPtr structs require their own specializations.
export function fearProjectileManagedReferenceStacks({resizeArray}){
 if(typeof resizeArray!=='function')throw new TypeError('Fear managed reference stack requires native Array.Resize caller');
 const array=stack=>nonnull(nonnull(stack)._array);
 const index=(value,storage)=>{if((value>>>0)>=storage.length)throw new RangeError('Fear managed stack array bounds');return value;};
 const top=(size,storage)=>{const next=(size-1)|0;if((next>>>0)>=storage.length)throw new RangeError('Fear managed stack is empty');return next;};
 const pushWithResize=(stack,value)=>{
  const old=array(stack),capacity=old.length===0?4:(old.length*2)|0;
  resizeArray(stack,capacity);
  const storage=array(stack),at=index(stack._size,storage);
  storage[at]=value;stack._version=(stack._version+1)|0;stack._size=(stack._size+1)|0;
 };
 return Object.freeze({
  count:stack=>count(value=>value._size,stack),
  peek(stack){const storage=array(stack),size=stack._size;return storage[top(size,storage)];},
  pop(stack){
   nonnull(stack);const size=stack._size,storage=array(stack),at=top(size,storage);
   stack._version=(stack._version+1)|0;stack._size=at;
   const value=storage[index(at,storage)];storage[index(at,storage)]=null;return value;
  },
  push(stack,value){
   nonnull(stack);const size=stack._size,storage=array(stack);
   if((size>>>0)>=storage.length){pushWithResize(stack,value);return;}
   storage[size]=value;stack._version=(stack._version+1)|0;stack._size=(size+1)|0;
  },pushWithResize,
 });
}

// Selected native Stack<Modifier>/Stack<AttackInfo>/Stack<ObjectPtr> storage. Copy/default
// receivers implement typed value semantics, including embedded references;
// they must not substitute a recursive clone for the native struct layout.
export function fearProjectileManagedValueStacks({specialization,resizeArray,copyValue,defaultValue}){
 if(!['Modifier','AttackInfo','ObjectPtr'].includes(specialization))throw new TypeError('Fear managed value stack requires a reviewed specialization');
 if([resizeArray,copyValue,defaultValue].some(fn=>typeof fn!=='function'))throw new TypeError('Fear managed value stack requires typed copy/default and native Array.Resize callers');
 const array=stack=>nonnull(nonnull(stack)._array);
 const index=(value,storage)=>{if((value>>>0)>=storage.length)throw new RangeError('Fear managed stack array bounds');return value;};
 const top=(size,storage)=>{const next=(size-1)|0;if((next>>>0)>=storage.length)throw new RangeError('Fear managed stack is empty');return next;};
 const pushWithResize=(stack,value)=>{
  const old=array(stack);resizeArray(stack,old.length===0?4:(old.length*2)|0);
  const storage=array(stack),at=index(stack._size,storage);
  storage[at]=copyValue(value);stack._version=(stack._version+1)|0;stack._size=(stack._size+1)|0;
 };
 return Object.freeze({
  count:stack=>count(value=>value._size,stack),
  peek(stack){const storage=array(stack),size=stack._size;return copyValue(storage[top(size,storage)]);},
  pop(stack){
   nonnull(stack);const size=stack._size,storage=array(stack),at=top(size,storage);
   stack._version=(stack._version+1)|0;stack._size=at;
   const value=copyValue(storage[index(at,storage)]);
   if(specialization!=='AttackInfo'){storage[index(at,storage)]=defaultValue();return copyValue(value);}
   return value;
  },
  push(stack,value){
   const storage=array(stack),size=stack._size;
   if((size>>>0)>=storage.length){pushWithResize(stack,copyValue(value));return;}
   storage[size]=copyValue(value);stack._version=(stack._version+1)|0;stack._size=(size+1)|0;
  },pushWithResize,
 });
}

export function fearProjectileManagedPointerStacks({resizeArray,copyPointer}){
 return fearProjectileManagedValueStacks({specialization:'ObjectPtr',resizeArray,copyValue:copyPointer,
  defaultValue:()=>({obj:null,cachedUid:0})});
}

// Default reference-shared ContextPtrStack operations. Pointer construction,
// UID/Unity locking and underlying Stack storage stay explicit.
export function fearProjectileContextPointerStacks({readCount,peekStored,popStored,pushStored,wrapPointer,copyPointer,lockPointer}){
 if([readCount,peekStored,popStored,pushStored,wrapPointer,copyPointer,lockPointer].some(fn=>typeof fn!=='function'))throw new TypeError('Fear pointer context stack requires native storage, pointer and lock callers');
 const peek=stack=>count(readCount,stack)>0?lockPointer(copyPointer(peekStored(stack))):null;
 return Object.freeze({peek,getValue:peek,
  pop:stack=>count(readCount,stack)>0?lockPointer(copyPointer(popStored(stack))):null,
  push(stack,value){const pointer=wrapPointer(value);nonnull(stack);pushStored(stack,copyPointer(pointer));},
 });
}

// Default ContextValueStack Peek/Pop. Class specializations use null/identity;
// value specializations provide zero-initialized structs and by-value copies.
export function fearProjectileContextValueStacks({readCount,peekStored,popStored,defaultValue,copyValue}){
 if([readCount,peekStored,popStored,defaultValue,copyValue].some(fn=>typeof fn!=='function'))throw new TypeError('Fear value context stack requires native storage, defaults and value-copy callers');
 const peek=stack=>count(readCount,stack)>0?copyValue(peekStored(stack)):defaultValue();
 return Object.freeze({peek,getValue:peek,pop:stack=>count(readCount,stack)>0?copyValue(popStored(stack)):defaultValue()});
}
