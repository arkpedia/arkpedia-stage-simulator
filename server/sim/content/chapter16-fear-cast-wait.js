// SPDX-License-Identifier: GPL-3.0-or-later
// Selected attack-event wait with interuptIfTargetDead=false. Native duration /
// deltaPlayTime -> RoundToInt frame conversion and coroutine resumes are caller
// inputs; this component does not manufacture an animation event or launch.
export function fearProjectileAttackWait(b,{owner,frameCount,isCastActive,subscribeAttackEvent,onReady}){
 if(!owner||!Number.isInteger(owner.deploySeq)||!Number.isInteger(frameCount)||frameCount<1||frameCount>0x7fffffff||
  [isCastActive,subscribeAttackEvent,onReady].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear cast wait requires an owner life, native frame count, lifecycle and event callers');
 const life=owner.deploySeq;
 let ended=false,started=false,received=false,resuming=false,index=0,unsubscribe=null,endHandle=null,removeHandle=null;
 const release=()=>{
  if(ended)return false;
  ended=true;
  if(endHandle)b.off(endHandle);if(removeHandle)b.off(removeHandle);endHandle=removeHandle=null;
  const dispose=unsubscribe;unsubscribe=null;if(dispose)dispose();return true;
 };
 const active=()=>{
  if(!ended&&(b.finished||b._endReq||owner.deploySeq!==life||owner.removed))release();
  return!ended;
 };
 if(active()){
  endHandle=b.on('battleEnd',release);
  removeHandle=b.on('removed',({unit})=>{if(unit===owner)release();});
 }
 return Object.freeze({
  get started(){return started;},get framesWaited(){return index;},
  resume(){
   if(resuming||!active())return null;
   resuming=true;
   try{
    const casting=isCastActive(owner);if(!active())return null;
    if(typeof casting!=='boolean')throw new TypeError('Fear cast lifecycle reader requires a native Boolean');
    if(!casting){release();return null;}
    if(!started){
     started=true;received=false;
     const dispose=subscribeAttackEvent({owner,event:19,onEvent:()=>{if(active())received=true;}});
     if(typeof dispose!=='function')throw new TypeError('Fear cast event caller must return an unsubscribe function');
     if(!active()){dispose();return null;}
     unsubscribe=dispose;
     // Both selected FP and float waiters yield at index0 before checking the
     // predicate. An event during subscription still cannot finish this resume.
     return{waiting:true,index,frameCount};
    }
    let cause=null;
    if(received)cause='event';
    else if(++index>=frameCount)cause='timeout';
    if(cause){
     // WaitForNextEvent unregisters the event handler and clears its receipt
     // before its caller resumes the cast sequence.
     release();received=false;onReady({cause});return{waiting:false,cause};
    }
    return{waiting:true,index,frameCount};
   }catch(error){release();throw error;}finally{resuming=false;}
  },
  release,
 });
}
