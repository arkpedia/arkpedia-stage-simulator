// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear context stack dereferenced a null native receiver');return value;};
const count=(readCount,stack)=>{const value=readCount(nonnull(stack));if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear context stack requires native Int32 counts');return value;};

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
