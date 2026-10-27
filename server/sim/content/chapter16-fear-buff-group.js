// SPDX-License-Identifier: GPL-3.0-or-later
// Selected default BuffContainer.EnsureOverrideGroup. PriorityQueue storage,
// construction, blackboard and dictionary effects remain explicit receivers.
export function fearProjectileEnsureOverrideGroup({buff,readGroups,readOverrideKey,tryGetGroup,readQueue,readQueueCount,
 clearQueue,createQueue,createGroup,readData,readBlackboard,getIntOrDefault,addGroup,isActive}){
 if(!buff||[readGroups,readOverrideKey,tryGetGroup,readQueue,readQueueCount,clearQueue,createQueue,createGroup,readData,
  readBlackboard,getIntOrDefault,addGroup,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear override group requires native buff, dictionary, queue, construction and lifecycle callers');
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear override group requires native Boolean results');return value;};
 const int=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear override group requires native Int32 fields');return value;};
 const nonnull=value=>{if(value==null)throw new TypeError('Fear override group dereferenced a null native object');return value;};
 const key=value=>{if(value!=null&&typeof value!=='string')throw new TypeError('Fear override group requires nullable native keys');return value??null;};
 let running=false;const cancelled=Symbol('cancelled');
 const check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 const initialize=group=>{
  const data=nonnull(invoke(readData,buff));group.m_type=int(data.overrideType);check();
  if(int(group.m_type)===1){
   const board=invoke(readBlackboard,buff),current=nonnull(invoke(readData,buff)),fallback=int(current.maxStackCnt);
   group.m_maxStackCnt=int(invoke(getIntOrDefault,nonnull(board),'max_stack_cnt',fallback,true));check();
  }else{group.m_maxStackCnt=1;check();}
  // The second branch tests the group's current field, not a cached type.
  if(int(group.m_type)===1){
   const board=invoke(readBlackboard,buff),current=nonnull(invoke(readData,buff)),fallback=int(current.maxValidStackCnt);
   group.m_maxValidStackCnt=int(invoke(getIntOrDefault,nonnull(board),'max_valid_stack_cnt',fallback,true));check();
  }else{group.m_maxValidStackCnt=-1;check();}
 };
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    check();const firstMap=invoke(readGroups),firstKey=key(invoke(readOverrideKey,buff));
    const found=invoke(tryGetGroup,nonnull(firstMap),firstKey);
    if(!found||typeof found.found!=='boolean'||!Object.hasOwn(found,'value'))throw new TypeError('Fear override group requires native found/out dictionary results');
    if(found.found){
     const group=nonnull(found.value),initial=invoke(readQueue,group);
     if(initial!=null&&int(invoke(readQueueCount,initial))!==0)return group;
     const current=invoke(readQueue,group);
     if(current==null){group.m_queue=nonnull(invoke(createQueue));check();}
     else invoke(clearQueue,current);
     initialize(group);return group;
    }
    const group=nonnull(invoke(createGroup)),queue=nonnull(invoke(createQueue));group.m_queue=queue;check();
    initialize(group);
    const map=invoke(readGroups),actualKey=key(invoke(readOverrideKey,buff));invoke(addGroup,nonnull(map),actualKey,group);
    return group;
   }catch(error){if(error===cancelled)return null;throw error;}finally{running=false;}
  },
 });
}

// Default OverrideGroup add/update dispatch. Queue storage/comparison and Buff
// duration, snapshot, stack and enable effects remain explicit native receivers.
// Calls may reenter: each update keeps its own selected-member flag.
export function fearProjectileOverrideGroup({group,readQueue,isQueueEmpty,readQueueCount,readQueueItem,addQueue,
 extendRemainingTime,fillRemainingTime,takeSnapshot,readData,readBlackboard,assignBlackboard,
 fillRemainingTimeWhenStackMax,addStack,readIsFinished,setIsEnabled,isActive}){
 const callers=[readQueue,isQueueEmpty,readQueueCount,readQueueItem,addQueue,extendRemainingTime,fillRemainingTime,
  takeSnapshot,readData,readBlackboard,assignBlackboard,fillRemainingTimeWhenStackMax,addStack,readIsFinished,setIsEnabled,isActive];
 if(!group||callers.some(fn=>typeof fn!=='function'))throw new TypeError('Fear group dispatch requires native group, queue, buff and lifecycle callers');
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear group dispatch requires native Boolean results');return value;};
 const int=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear group dispatch requires native Int32 fields');return value;};
 const nonnull=value=>{if(value==null)throw new TypeError('Fear group dispatch dereferenced a null native object');return value;};
 const cancelled=Symbol('cancelled');
 const check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 const queue=()=>nonnull(invoke(readQueue,group));
 const front=()=>nonnull(invoke(readQueueItem,queue(),0));
 const enqueue=(q,incoming)=>{invoke(addQueue,nonnull(q),incoming);return true;};
 const capFront=()=>{front().m_maxValidStackCnt=int(group.m_maxValidStackCnt);check();};
 return Object.freeze({
  add(incoming){
   try{
    check();const type=int(group.m_type);
    if(type===0)return enqueue(queue(),incoming);
    if(type===2)return boolean(invoke(isQueueEmpty,queue()))?enqueue(queue(),incoming):false;
    if(type===3||type===4){
     const empty=boolean(invoke(isQueueEmpty,queue())),current=invoke(readQueue,group);
     if(empty)return enqueue(current,incoming);
     const first=nonnull(invoke(readQueueItem,nonnull(current),0));
     if(type===4){invoke(extendRemainingTime,first,incoming);return false;}
     invoke(fillRemainingTime,first,incoming);
     const data=nonnull(invoke(readData,front()));
     if(!boolean(data.takeSnapshotWhenExtend))return false;
     invoke(takeSnapshot,front());
     if(invoke(readBlackboard,front())==null)return false;
     const destination=front();nonnull(incoming);
     const board=nonnull(invoke(readBlackboard,destination)),source=invoke(readBlackboard,incoming);
     invoke(assignBlackboard,board,source);return false;
    }
    if(type!==1)return false;
    if(boolean(invoke(isQueueEmpty,queue()))){enqueue(queue(),incoming);capFront();return true;}
    if(int(group.m_maxStackCnt)>=0){
     const next=(int(front().m_stackCnt)+1)|0;
     if(next>int(group.m_maxStackCnt)){
      if(int(front().m_stackCnt)!==int(group.m_maxStackCnt))return false;
      if(!boolean(front().m_refreshRemainingTimeWhenStackMax))return false;
      capFront();invoke(fillRemainingTimeWhenStackMax,front(),incoming);return false;
     }
    }
    capFront();invoke(addStack,front(),incoming);return false;
   }catch(error){if(error===cancelled)return null;throw error;}
  },
  update(){
   try{
    check();if(int(invoke(readQueueCount,queue()))===0)return;
    let current=queue(),selected=false,index=0;
    while(index<int(invoke(readQueueCount,current))){
     const member=nonnull(invoke(readQueueItem,queue(),index));let enabled=false;
     if(!selected&&!boolean(invoke(readIsFinished,member))){selected=true;enabled=true;}
     invoke(setIsEnabled,member,enabled);
     current=queue();index=(index+1)|0;
    }
   }catch(error){if(error===cancelled)return null;throw error;}
  },
 });
}
