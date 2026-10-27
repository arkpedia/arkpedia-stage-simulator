// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear context stack dereferenced a null native receiver');return value;};
const count=(readCount,stack)=>{const value=readCount(nonnull(stack));if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear context stack requires native Int32 counts');return value;};

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
