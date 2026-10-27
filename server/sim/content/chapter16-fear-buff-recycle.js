// SPDX-License-Identifier: GPL-3.0-or-later
// Selected BattleController delayed-buff queue. Native frame sampling and pool
// effects stay explicit; this does not infer a frame from elapsed float time.
export function fearProjectileBuffRecycleQueue(b,{readFixedFrame,copyPointer,isPointerValid,lockPointer,recycleBuff}){
 if([readFixedFrame,copyPointer,isPointerValid,lockPointer,recycleBuff].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear buff recycle queue requires native frame, pointer and pool callers');
 const buckets=new Map();let ended=false,enqueuing=false,updating=false,endHandle=null;
 const release=()=>{if(ended)return;ended=true;buckets.clear();if(endHandle)b.off(endHandle);endHandle=null;};
 const active=()=>{if(!ended&&(b.finished||b._endReq))release();return!ended;};
 const frame=value=>{if(!Number.isInteger(value)||value<0||value>0xffffffff)throw new TypeError('Fear buff recycle queue requires native UInt32 fixedFrameCnt');return value;};
 if(active())endHandle=b.on('battleEnd',release);
 return Object.freeze({
  enqueue(pointer){
   if(enqueuing||!active())return null;enqueuing=true;
   try{
    const sampled=readFixedFrame();if(!active())return null;
    const target=(frame(sampled)+1)>>>0;
    const copied=copyPointer(pointer);if(!active())return null;
    let bucket=buckets.get(target);if(!bucket){bucket={entries:[],version:0};buckets.set(target,bucket);}
    bucket.version=(bucket.version+1)|0;bucket.entries.push(copied);
   }finally{enqueuing=false;}
  },
  update(){
   if(updating||!active())return null;updating=true;
   try{
    const sampled=readFixedFrame();if(!active())return null;
    const bucket=buckets.get(frame(sampled));if(!bucket)return;
    const version=bucket.version;
    for(let index=0;;index++){
     // Native List<T>.Enumerator rejects list mutation even on the final
     // MoveNext. Queueing into a future bucket does not mutate this list.
     if(bucket.version!==version)throw new Error('Fear buff recycle list changed during enumeration');
     if(index>=bucket.entries.length)break;
     const pointer=copyPointer(bucket.entries[index]);if(!active())return null;
     const valid=isPointerValid(pointer);if(!active())return null;
     if(typeof valid!=='boolean')throw new TypeError('Fear buff recycle queue requires native Boolean pointer validity');
     if(!valid)continue;
     const buff=lockPointer(pointer);if(!active())return null;
     // Native code passes Lock's result to the pool without a second null
     // branch. The actual pool's null handling belongs to recycleBuff.
     recycleBuff(buff);if(!active())return null;
    }
    // The native removal samples fixedFrameCnt again after enumeration.
    const removalFrame=readFixedFrame();if(!active())return null;
    buckets.delete(frame(removalFrame));
   }finally{updating=false;}
  },
  get pendingCount(){if(!active())return 0;let count=0;for(const bucket of buckets.values())count+=bucket.entries.length;return count;},
  release,
 });
}
