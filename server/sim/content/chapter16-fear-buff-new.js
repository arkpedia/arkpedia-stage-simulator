// SPDX-License-Identifier: GPL-3.0-or-later
// One selected default BuffContainer.NewBuff invocation. Native anti/levitate,
// storage, activation and override-group effects must be supplied explicitly.
export function fearProjectileNewBuff({container,source,ability,extraBlackboard,extraBlackboard2,sourceProjectile,customOverrideEffectKey,
 readInputData,readInput,checkFinishedBuffs,passesAbnormalAnti,passesLevitate,isDestroyedOrNull,readEntityAttributes,hasFlag,readOwner,
 readPool,allocateBuff,recycleBuff,resetBuff,overrideEffectKey,passesStatusAnti,readBuffList,captureBuffPointer,addBuffPointer,
 readUidMap,readUid,registerUid,readOwnerInited,onStart,readAbnormalAntiMask,filterAbnormalAnti,readFinished,readStarted,
 finishAndRemove,readOverrideKey,setEnabled,ensureOverrideGroup,readGroupQueue,readQueueCount,readQueueItem,addToGroup,updateGroup,isActive}){
 const callers=[readInputData,readInput,checkFinishedBuffs,passesAbnormalAnti,passesLevitate,isDestroyedOrNull,readEntityAttributes,hasFlag,readOwner,
  readPool,allocateBuff,recycleBuff,resetBuff,overrideEffectKey,passesStatusAnti,readBuffList,captureBuffPointer,addBuffPointer,
  readUidMap,readUid,registerUid,readOwnerInited,onStart,readAbnormalAntiMask,filterAbnormalAnti,readFinished,readStarted,
  finishAndRemove,readOverrideKey,setEnabled,ensureOverrideGroup,readGroupQueue,readQueueCount,readQueueItem,addToGroup,updateGroup,isActive];
 if(!container||callers.some(fn=>typeof fn!=='function'))throw new TypeError('Fear NewBuff requires native container, configuration, pool, registration and lifecycle callers');
 let used=false;const cancelled=Symbol('cancelled');
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear NewBuff requires native Boolean results');return value;};
 const nonnull=value=>{if(value==null)throw new TypeError('Fear NewBuff dereferenced a null native object');return value;};
 const check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 const uint=value=>{if(!Number.isInteger(value)||value<0||value>0xffffffff)throw new TypeError('Fear NewBuff requires a native UInt32 UID');return value;};
 return Object.freeze({
  run(){
   if(used)return null;used=true;
   try{
    check();invoke(checkFinishedBuffs);
    const data=invoke(readInputData);
    if(!boolean(invoke(passesAbnormalAnti,data))||!boolean(invoke(passesLevitate,data)))return null;
    if(!boolean(invoke(isDestroyedOrNull,source))){
     nonnull(source);const attributes=nonnull(invoke(readEntityAttributes,source));
     if(boolean(invoke(hasFlag,attributes,37))){
      const owner=nonnull(invoke(readOwner)),ownerAttributes=nonnull(invoke(readEntityAttributes,owner));
      if(boolean(invoke(hasFlag,ownerAttributes,38)))return null;
     }
    }
    const buff=nonnull(invoke(allocateBuff,nonnull(invoke(readPool))));
    const current=nonnull(invoke(readInput)),config=Object.freeze({template:current.template,data:current.data});
    invoke(resetBuff,buff,config,Object.freeze({container,source,ability,extraBlackboard,extraBlackboard2,sourceProjectile}));
    if(customOverrideEffectKey!=null&&typeof customOverrideEffectKey!=='string')throw new TypeError('Fear NewBuff requires a nullable native effect override');
    if(customOverrideEffectKey!=null&&customOverrideEffectKey!=='')invoke(overrideEffectKey,buff,customOverrideEffectKey);
    if(!boolean(invoke(passesStatusAnti,buff))){invoke(recycleBuff,nonnull(invoke(readPool)),buff);return null;}
    const list=invoke(readBuffList),pointer=invoke(captureBuffPointer,buff);
    invoke(addBuffPointer,nonnull(list),pointer);
    const map=invoke(readUidMap),uid=uint(invoke(readUid,buff));
    invoke(registerUid,nonnull(map),uid,buff);
    const owner=nonnull(invoke(readOwner));
    if(boolean(invoke(readOwnerInited,owner)))invoke(onStart,buff);
    const mask=invoke(readAbnormalAntiMask,buff);
    if(typeof mask!=='bigint'||mask<0n||mask>=(1n<<64n))throw new TypeError('Fear NewBuff requires a native UInt64 abnormal-anti mask');
    invoke(filterAbnormalAnti,mask);
    if(boolean(invoke(readFinished,buff))){
     if(boolean(invoke(readStarted,buff))){invoke(finishAndRemove,buff);return null;}
     return buff;
    }
    const key=invoke(readOverrideKey,buff);
    if(key!=null&&typeof key!=='string')throw new TypeError('Fear NewBuff requires a nullable native override key');
    if(key==null||key===''){invoke(setEnabled,buff,true);return buff;}
    const group=nonnull(invoke(ensureOverrideGroup,buff));
    for(let index=0;;index++){
     const countQueue=invoke(readGroupQueue,group),count=countQueue==null?0:invoke(readQueueCount,countQueue);
     if(!Number.isInteger(count)||count<0||count>=2**31)throw new TypeError('Fear NewBuff requires a native nonnegative Int32 queue count');
     if(index>=count)break;
     const queue=nonnull(invoke(readGroupQueue,group)),member=invoke(readQueueItem,queue,index);
     if(member===buff)return buff;
    }
    if(!boolean(invoke(addToGroup,group,buff))){invoke(finishAndRemove,buff);return null;}
    invoke(updateGroup,group);return buff;
   }catch(error){if(error===cancelled)return null;throw error;}
  },
 });
}
