// SPDX-License-Identifier: GPL-3.0-or-later
// Selected BattleController delayed-buff queue. Native frame sampling and pool
// effects stay explicit; this does not infer a frame from elapsed float time.
export function fearProjectileBuffRecycleQueue(b,{readFixedFrame,copyPointer,isPointerValid,lockPointer,recycleBuff}){
 if([readFixedFrame,copyPointer,isPointerValid,lockPointer,recycleBuff].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear buff recycle queue requires native frame, pointer and pool callers');
 const buckets=new Map();let ended=false,enqueuing=false,updating=false,flushing=false,version=0,endHandle=null;
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
    let bucket=buckets.get(target);if(!bucket){bucket={entries:[],version:0};buckets.set(target,bucket);version=(version+1)|0;}
    bucket.version=(bucket.version+1)|0;bucket.entries.push(copied);
   }finally{enqueuing=false;}
  },
  update(){
   if(updating||flushing||!active())return null;updating=true;
   try{
    const sampled=readFixedFrame();if(!active())return null;
    const bucket=buckets.get(frame(sampled));if(!bucket)return;
    const bucketVersion=bucket.version;
    for(let index=0;;index++){
     // Native List<T>.Enumerator rejects list mutation even on the final
     // MoveNext. Queueing into a future bucket does not mutate this list.
     if(bucket.version!==bucketVersion)throw new Error('Fear buff recycle list changed during enumeration');
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
    if(buckets.delete(frame(removalFrame)))version=(version+1)|0;
   }finally{updating=false;}
  },
  // Explicit controller cleanup phase, before local battleEnd cancellation.
  // Native code enumerates the ListDict's stored pairs, then each value list,
  // without sampling frame keys. Both list versions remain observable.
  flushImmediately(){
   if(updating||flushing||!active())return null;flushing=true;
   try{
    if(!buckets.size)return;
    const outerVersion=version,iterator=buckets.values();
    for(;;){
     if(version!==outerVersion)throw new Error('Fear buff recycle bucket list changed during enumeration');
     const next=iterator.next();if(next.done)break;
     const bucket=next.value,innerVersion=bucket.version;
     for(let index=0;;index++){
      if(bucket.version!==innerVersion)throw new Error('Fear buff recycle list changed during enumeration');
      if(index>=bucket.entries.length)break;
      const pointer=copyPointer(bucket.entries[index]);if(!active())return null;
      const valid=isPointerValid(pointer);if(!active())return null;
      if(typeof valid!=='boolean')throw new TypeError('Fear buff recycle queue requires native Boolean pointer validity');
      if(!valid)continue;
      const buff=lockPointer(pointer);if(!active())return null;
      recycleBuff(buff);if(!active())return null;
     }
    }
    // Native List.Clear follows successful enumeration, never a finally.
    buckets.clear();version=(version+1)|0;
   }finally{flushing=false;}
  },
  get pendingCount(){if(!active())return 0;let count=0;for(const bucket of buckets.values())count+=bucket.entries.length;return count;},
  release,
 });
}

// Selected default ClearRunTimeData orchestration. Receivers perform the actual
// native subsystem effects; this runs before the local battleEnd cancellation.
export function fearProjectileClearRuntimeData(b,{clearLogger,clearRunes,readGlobalBuffCount,readGlobalBuff,
 isDestroyedOrNull,recycleGlobalBuff,clearGlobalBuffList,resetGlobalBlackboard,removeAllGlobalEnvironments,
 resetAllSpineShaders,clearResourcesInHolder,flushDelayedBuffs,clearStaticVariables}){
 if([clearLogger,clearRunes,readGlobalBuffCount,readGlobalBuff,isDestroyedOrNull,recycleGlobalBuff,clearGlobalBuffList,
  resetGlobalBlackboard,removeAllGlobalEnvironments,resetAllSpineShaders,clearResourcesInHolder,flushDelayedBuffs,
  clearStaticVariables].some(fn=>typeof fn!=='function'))throw new TypeError('Fear runtime cleanup requires native subsystem and global-buff callers');
 let ended=false,running=false,endHandle=null;
 const release=()=>{ended=true;if(endHandle)b.off(endHandle);endHandle=null;};
 const active=()=>{if(!ended&&(b.finished||b._endReq))release();return!ended;};
 const count=()=>{
  const n=readGlobalBuffCount();if(!active())return null;
  if(!Number.isInteger(n)||n<0||n>0x7fffffff)throw new TypeError('Fear runtime cleanup requires a native nonnegative Int32 list count');
  return n;
 };
 if(active())endHandle=b.on('battleEnd',release);
 return Object.freeze({
  run(){
   if(running||!active())return null;running=true;
   try{
    clearLogger();if(!active())return null;
    clearRunes();if(!active())return null;
    let size=count();if(!active())return null;
    for(let index=0;index<size;index=(index+1)|0){
     const buff=readGlobalBuff(index);if(!active())return null;
     const destroyed=isDestroyedOrNull(buff);if(!active())return null;
     if(typeof destroyed!=='boolean')throw new TypeError('Fear runtime cleanup requires native Boolean object validity');
     if(!destroyed){
      if(buff==null)throw new TypeError('Fear runtime cleanup cannot recycle a null global buff');
      recycleGlobalBuff(buff);if(!active())return null;
     }
     size=count();if(!active())return null;
    }
    for(const effect of [clearGlobalBuffList,resetGlobalBlackboard,removeAllGlobalEnvironments,resetAllSpineShaders,
     clearResourcesInHolder,flushDelayedBuffs,clearStaticVariables]){
     effect();if(!active())return null;
    }
   }finally{running=false;}
  },
  release,
 });
}
