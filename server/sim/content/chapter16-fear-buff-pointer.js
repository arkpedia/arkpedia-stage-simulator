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

// Reset's ObjectPtr.Wrap<Entity/Ability/Projectile> shares the constructor
// above, but these contexts can be Unity objects. Keep native destruction and
// IPtrObject UID dispatch explicit, including their separate samples.
export function fearProjectileContextPointers({readUid,isDestroyedOrNull,isActive}){
 if([readUid,isDestroyedOrNull,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear context pointers require native UID, Unity validity and lifecycle callers');
 const uint=value=>{if(!Number.isInteger(value)||value<0||value>0xffffffff)throw new TypeError('Fear context pointer requires a native UInt32 UID');return value;};
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear context pointer requires native Boolean validity');return value;};
 const shape=pointer=>{
  if(!pointer||!Object.hasOwn(pointer,'obj')||!Object.hasOwn(pointer,'cachedUid'))throw new TypeError('Fear context pointer requires native obj/cachedUid fields');
 };
 const cancelled=Symbol('cancelled');let running=false;
 const check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 const run=fn=>{
  if(running)return null;running=true;
  try{check();return fn();}catch(error){if(error===cancelled)return null;throw error;}finally{running=false;}
 };
 const valid=pointer=>{
  shape(pointer);
  const first=pointer.obj??null;
  if(boolean(invoke(isDestroyedOrNull,first)))return false;
  // get_isValid rereads obj after the Unity check, then cachedUid after UID
  // dispatch. A by-reference pointer can change during either receiver.
  const current=pointer.obj;
  if(current==null)throw new TypeError('Fear context pointer dereferenced a null native object');
  const uid=uint(invoke(readUid,current));
  return uid===uint(pointer.cachedUid);
 };
 return Object.freeze({
  capture:obj=>run(()=>{
   if(obj==null||uint(invoke(readUid,obj))===0)return Object.freeze({obj:null,cachedUid:0});
   const destroyed=boolean(invoke(isDestroyedOrNull,obj));
   // Native construction retains obj even on this destroyed-object branch.
   const cachedUid=destroyed?0:uint(invoke(readUid,obj));
   return Object.freeze({obj,cachedUid});
  }),
  copy(pointer){shape(pointer);return Object.freeze({obj:pointer.obj??null,cachedUid:uint(pointer.cachedUid)});},
  isValid:pointer=>run(()=>valid(pointer)),
  lock:pointer=>run(()=>valid(pointer)?pointer.obj??null:null),
 });
}
