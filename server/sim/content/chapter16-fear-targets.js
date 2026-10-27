// SPDX-License-Identifier: GPL-3.0-or-later
// Selected arrival TargetOptions only, after collider/layer/validity selection.
// Readers must expose native side, category, motion and target-free semantics;
// simulator flags or source death alone do not establish those mappings.
export function fearProjectileSourceMotion(b,{source,resolveSource,readMotionMode,isValidAndAliveOrDying}){
 if([resolveSource,readMotionMode,isValidAndAliveOrDying].some(fn=>typeof fn!=='function')||
  (source!=null&&!Number.isInteger(source.deploySeq)))
  throw new TypeError('Fear source motion requires an explicit native reference, motion and alive-or-dying predicate');
 const life=source?.deploySeq;
 let snapshot=2,ended=false,reading=false,endHandle=null;
 const release=()=>{ended=true;if(endHandle)b.off(endHandle);endHandle=null;};
 const active=()=>{if(!ended&&(b.finished||b._endReq))release();return!ended;};
 const mode=unit=>{
  const value=readMotionMode(unit);
  if(!Number.isInteger(value)||value<-2147483648||value>2147483647)
   throw new TypeError('Fear source motion requires a native Int32 motion mode');
  return value;
 };
 if(active())endHandle=b.on('battleEnd',release);
 try{
  if(source&&active()){
   snapshot=mode(source);
   if(source.deploySeq!==life)throw new Error('Fear source motion changed identity during snapshot capture');
  }
 }catch(error){release();throw error;}
 return Object.freeze({
  get capturedMotionMode(){return snapshot;},
  readSourceMotionMode(){
   if(reading||!active())return null;
   reading=true;
   try{
    const current=resolveSource();if(!active())return null;
    if(!current||current!==source||current.deploySeq!==life)return snapshot;
    const valid=isValidAndAliveOrDying(current);if(!active())return null;
    if(typeof valid!=='boolean')throw new TypeError('Fear source motion requires a native Boolean alive-or-dying result');
    if(!valid)return snapshot;
    // Native ValidAndAliveOrDying resolves the PtrObjRef, then the successful
    // caller gets it again. Reentrant local readers cannot donate a new life.
    const resolved=resolveSource();if(!active())return null;
    if(resolved!==current||current.deploySeq!==life)return null;
    const value=mode(current);
    if(!active()||current.deploySeq!==life)return null;
    const unchanged=resolveSource()===current;
    return active()&&unchanged&&current.deploySeq===life?value:null;
   }finally{reading=false;}
  },
  release,
 });
}

export function fearProjectileTargetVerifier(b,{sourceSide,readMotionMode,readCategory,readSide,
 isTargetFree,isAllyTargetFree,readSourceMotionMode,isStillMotionTargetFree}){
 const readers=[readMotionMode,readCategory,readSide,isTargetFree,isAllyTargetFree,
  readSourceMotionMode,isStillMotionTargetFree];
 const integer=value=>Number.isInteger(value)&&value>=-2147483648&&value<=2147483647;
 if(!integer(sourceSide)||readers.some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear target verifier requires a native source-side snapshot and explicit target readers');
 let ended=false,verifying=false,endHandle=null;
 const release=()=>{ended=true;if(endHandle)b.off(endHandle);endHandle=null;};
 const active=()=>{if(!ended&&(b.finished||b._endReq))release();return!ended;};
 if(active())endHandle=b.on('battleEnd',release);
 return Object.freeze({
  verifyTarget(target){
   if(verifying||!active()||!target||!Number.isInteger(target.deploySeq))return false;
   const life=target.deploySeq,stable=()=>active()&&target.deploySeq===life;
   verifying=true;
   const read=(fn,...args)=>{
    if(!stable())return null;
    const value=fn(target,...args);return stable()?value:null;
   };
   const intRead=fn=>{const value=read(fn);if(value!==null&&!integer(value))throw new TypeError('Fear target reader requires a native Int32 value');return value;};
   const boolRead=(fn,...args)=>{const value=read(fn,...args);if(value!==null&&typeof value!=='boolean')throw new TypeError('Fear target reader requires a native Boolean value');return value;};
   try{
    const motion=intRead(readMotionMode);if(motion===null||((1<<(motion&31))&1)<=0)return false;
    const category=intRead(readCategory);if(category===null||(category&1)<=0)return false;
    if(sourceSide!==0){
     const side=intRead(readSide);if(side===null)return false;
     if(side!==sourceSide){
      const free=boolRead(isTargetFree);if(free===null||free)return false;
      const sourceMotion=read(readSourceMotionMode);if(sourceMotion===null)return false;
      if(!integer(sourceMotion))throw new TypeError('Fear source motion reader requires a native Int32 value');
      // Native slot84 receives flag44, combo2 and the source motion snapshot.
      const motionFree=boolRead(isStillMotionTargetFree,{flags:44,combo:2,sourceMotion});
      if(motionFree===null||motionFree)return false;
     }
     const allyFree=boolRead(isAllyTargetFree);if(allyFree===null)return false;
     if(allyFree){const side=intRead(readSide);if(side===null||side===sourceSide)return false;}
    }
    // Selected checkUnitType/exclude/contain/purpose are disabled. Its zero
    // profession mask passes CheckProfessionMask(mask, profession, true).
    return stable();
   }finally{verifying=false;}
  },
  release,
 });
}
