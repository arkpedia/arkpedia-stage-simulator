// SPDX-License-Identifier: GPL-3.0-or-later
// Selected arrival TargetOptions only, after collider/layer/validity selection.
// Readers must expose native side, category, motion and target-free semantics;
// simulator flags or source death alone do not establish those mappings.
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
