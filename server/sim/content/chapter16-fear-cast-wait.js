// SPDX-License-Identifier: GPL-3.0-or-later
// Selected attack-event wait with interuptIfTargetDead=false. Frame conversion
// uses supplied native duration/deltaPlayTime; coroutine resumes remain caller
// inputs. This component does not manufacture an animation event or launch.
const minRaw=-(1n<<63n),maxRaw=(1n<<63n)-1n,one=1n<<32n,mask=(1n<<64n)-1n;
const u64=value=>BigInt.asUintN(64,value);
// Literal integer path of FP.op_Division, including its extra quotient bit and
// reserved overflow values. A direct JS seconds division loses these steps.
function divide(a,b){
 if(b===0n)return-one;
 const negative=(a<0n)!==(b<0n);
 let remainder=u64(a<0n?-a:a),divider=u64(b<0n?-b:b),quotient=0n,bit=33;
 while((divider&15n)===0n&&bit>=4){divider>>=4n;bit-=4;}
 while(remainder!==0n&&bit>=0){
  const shift=Math.min(64-remainder.toString(2).length,bit);
  remainder=u64(remainder<<BigInt(shift));bit-=shift;
  const portion=remainder/divider;remainder%=divider;
  quotient=u64(quotient+u64(portion<<BigInt(bit)));
  if((portion&u64(~(mask>>BigInt(bit))))!==0n)return negative?minRaw+2n:maxRaw-1n;
  remainder=u64(remainder<<1n);bit--;
 }
 const magnitude=u64(quotient+1n)>>1n;
 return BigInt.asIntN(64,negative?-magnitude:magnitude);
}
export function fearProjectileWaitFrameCount(cachedDurationRaw,deltaPlayTime){
 if(typeof cachedDurationRaw!=='bigint'||cachedDurationRaw<minRaw||cachedDurationRaw>maxRaw)
  throw new TypeError('Fear wait duration requires a signed Q32.32 raw value');
 const scaled=Math.fround(Math.fround(deltaPlayTime)*2**32);
 if(!Number.isFinite(deltaPlayTime)||!Number.isFinite(scaled)||scaled<-(2**63)||scaled>=2**63)
  throw new TypeError('Fear wait requires a finite native float32 deltaPlayTime convertible to FP');
 const divisor=BigInt(Math.trunc(scaled)),ratio=divide(cachedDurationRaw,divisor);
 const fraction=BigInt.asUintN(32,ratio);
 let rounded=BigInt.asIntN(64,ratio&(-one));
 if(fraction>one/2n||(fraction===one/2n&&(rounded&one)!==0n))rounded=BigInt.asIntN(64,rounded+one);
 // MathUtil.RoundToInt returns the signed low32 after the arithmetic shift.
 return Math.max(1,Number(BigInt.asIntN(32,rounded>>32n)));
}

export function fearProjectileAttackWait(b,{owner,cachedDurationRaw,readDeltaPlayTime,isCastActive,subscribeAttackEvent,onReady}){
 if(!owner||!Number.isInteger(owner.deploySeq)||typeof cachedDurationRaw!=='bigint'||cachedDurationRaw<minRaw||cachedDurationRaw>maxRaw||
  [readDeltaPlayTime,isCastActive,subscribeAttackEvent,onReady].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear cast wait requires an owner life, cached native duration, deltaPlayTime and lifecycle/event callers');
 const life=owner.deploySeq;
 let ended=false,started=false,received=false,resuming=false,index=0,frameCount=null,unsubscribe=null,endHandle=null,removeHandle=null;
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
     const deltaPlayTime=readDeltaPlayTime();if(!active())return null;
     frameCount=fearProjectileWaitFrameCount(cachedDurationRaw,deltaPlayTime);
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
