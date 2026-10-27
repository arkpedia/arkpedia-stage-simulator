// SPDX-License-Identifier: GPL-3.0-or-later
// Selected _FinishAndRemoveBuff -> _FinishBuff flags. Native state/effect and
// next-frame queue callers are explicit; this never recycles a buff inline.
export function fearProjectileFinishAndRemoveBuff(b,{owner,buff,removeFromList,readUid,removeUidRegistration,
 markFinish,onFinish,captureBuffPointer,queueRecycleNextFrame}){
 if(!owner||!Number.isInteger(owner.deploySeq)||!buff||[removeFromList,readUid,removeUidRegistration,
  markFinish,onFinish,captureBuffPointer,queueRecycleNextFrame].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear buff finish requires an owner life, buff and native removal/finish/queue callers');
 const life=owner.deploySeq;let used=false,ended=false,endHandle=null,removeHandle=null;
 const release=()=>{ended=true;if(endHandle)b.off(endHandle);if(removeHandle)b.off(removeHandle);endHandle=removeHandle=null;};
 const active=()=>{if(!ended&&(b.finished||b._endReq||owner.removed||owner.deploySeq!==life))release();return!ended;};
 if(active()){
  endHandle=b.on('battleEnd',release);
  removeHandle=b.on('removed',({unit})=>{if(unit===owner)release();});
 }
 return Object.freeze({
  run(){
   if(used||!active())return null;used=true;
   try{
    // List.Remove and UID-map Remove return Booleans, but the native caller
    // does not branch on either result before finishing the buff.
    removeFromList(buff);if(!active())return null;
    const uid=readUid(buff);if(!active())return null;
    if(!Number.isInteger(uid)||uid<0||uid>0xffffffff)throw new TypeError('Fear buff finish requires native UInt32 instance UID');
    removeUidRegistration(uid);if(!active())return null;
    markFinish(buff,{updateOverrideMap:true});if(!active())return null;
    const finished=onFinish(buff,{immediatelyFinishEffect:false});if(!active())return null;
    if(typeof finished!=='boolean')throw new TypeError('Fear buff finish requires the native OnFinish Boolean');
    if(finished){
     const pointer=captureBuffPointer(buff);if(!active())return null;
     queueRecycleNextFrame(pointer);if(!active())return null;
    }
   }finally{release();}
  },
  release,
 });
}

// OverrideGroup.Remove has a separate member list and only updates the group
// after that list reports successful removal; primary-list UID matching must
// not be substituted for its native member equality semantics.
export function fearProjectileOverrideGroupRemove(b,{owner,group,buff,removeMember,updateInternal}){
 if(!owner||!Number.isInteger(owner.deploySeq)||!group||!buff||[removeMember,updateInternal].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear override removal requires an owner life, group, buff and native member/update callers');
 const life=owner.deploySeq;let used=false,ended=false,endHandle=null,removeHandle=null;
 const release=()=>{ended=true;if(endHandle)b.off(endHandle);if(removeHandle)b.off(removeHandle);endHandle=removeHandle=null;};
 const active=()=>{if(!ended&&(b.finished||b._endReq||owner.removed||owner.deploySeq!==life))release();return!ended;};
 if(active()){
  endHandle=b.on('battleEnd',release);
  removeHandle=b.on('removed',({unit})=>{if(unit===owner)release();});
 }
 return Object.freeze({
  run(){
   if(used||!active())return null;used=true;
   try{
    const removed=removeMember(group,buff);if(!active())return null;
    if(typeof removed!=='boolean')throw new TypeError('Fear override removal requires native member-removal Boolean');
    if(removed){updateInternal(group);if(!active())return null;}
   }finally{release();}
  },
  release,
 });
}
