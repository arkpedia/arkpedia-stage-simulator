// SPDX-License-Identifier: GPL-3.0-or-later
// Selected ObjectPtr<Buff> semantics. Buff inherits System.Object, so the
// native Unity-object destroyed/null branch reduces to ordinary null here.
export function fearProjectileBuffPointers({readUid}){
 if(typeof readUid!=='function')throw new TypeError('Fear buff pointers require the native instance UID reader');
 const uint=value=>{
  if(!Number.isInteger(value)||value<0||value>0xffffffff)throw new TypeError('Fear buff pointer requires a native UInt32 UID');
  return value;
 };
 const copy=pointer=>{
  if(!pointer||!Object.hasOwn(pointer,'obj')||!Object.hasOwn(pointer,'cachedUid'))throw new TypeError('Fear buff pointer requires native obj/cachedUid values');
  return Object.freeze({obj:pointer.obj??null,cachedUid:uint(pointer.cachedUid)});
 };
 const capture=obj=>{
  if(obj==null||uint(readUid(obj))===0)return Object.freeze({obj:null,cachedUid:0});
  // The constructor checks UID!=0, stores obj, then reads UID again. This
  // second sample must not be replaced by the first getter's result.
  return Object.freeze({obj,cachedUid:uint(readUid(obj))});
 };
 const valid=pointer=>pointer.obj!=null&&uint(readUid(pointer.obj))===pointer.cachedUid;
 return Object.freeze({
  capture,copy,
  isValid(pointer){return valid(copy(pointer));},
  lock(pointer){const value=copy(pointer);return valid(value)?value.obj:null;},
 });
}
