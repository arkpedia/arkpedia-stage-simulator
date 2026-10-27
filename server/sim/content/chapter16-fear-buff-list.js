// SPDX-License-Identifier: GPL-3.0-or-later
// Selected SortedDoubleBufferedBuffList mutation plus forward iteration.
// Native ObjectPtr copy/validity/Lock and buff field readers stay explicit.
import {fearProjectileBuffIteration} from './chapter16-fear-buff-iteration.js';

export function fearProjectileBuffList(b,{owner,copyEntry,isEntryValid,resolveEntry,readPriority,readUid}){
 if(!owner||!Number.isInteger(owner.deploySeq)||[copyEntry,isEntryValid,resolveEntry,readPriority,readUid].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear buff list requires an owner life and native pointer/priority/UID callers');
 const life=owner.deploySeq,entries=[];let ended=false,mutating=false,endHandle=null,removeHandle=null,iteration;
 const release=()=>{
  if(ended)return;ended=true;iteration?.release();entries.length=0;
  if(endHandle)b.off(endHandle);if(removeHandle)b.off(removeHandle);endHandle=removeHandle=null;
 };
 const active=()=>{if(!ended&&(b.finished||b._endReq||owner.removed||owner.deploySeq!==life))release();return!ended;};
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear buff list requires native Boolean validity');return value;};
 const int32=value=>{if(!Number.isInteger(value)||value<-2147483648||value>2147483647)throw new TypeError('Fear buff list requires native Int32 priority');return value;};
 const uid=value=>{if(!Number.isInteger(value)||value<0||value>0xffffffff)throw new TypeError('Fear buff list requires native UInt32 UID');return value;};
 const copy=entry=>copyEntry(entry);
 iteration=fearProjectileBuffIteration(b,{owner,copyEntry,resolveEntry,readInternalEntries:()=>entries});
 if(active()){
  endHandle=b.on('battleEnd',release);
  removeHandle=b.on('removed',({unit})=>{if(unit===owner)release();});
 }
 return Object.freeze({
  add(value){
   if(mutating||!active())return null;mutating=true;
   try{
    const entry=copy(value);if(!active())return null;
    const valid=isEntryValid(entry);if(!active())return null;
    if(!boolean(valid)){entries.push(entry);return;}
    const incoming=resolveEntry(entry);if(!active())return null;
    for(let index=entries.length-1;index>=0;index--){
     const candidate=copy(entries[index]);if(!active())return null;
     const candidateValid=isEntryValid(candidate);if(!active())return null;
     if(!boolean(candidateValid))continue;
     if(incoming==null)throw new TypeError('Fear buff list valid incoming pointer did not lock');
     const priority=readPriority(incoming);if(!active())return null;
     const priorityValue=int32(priority);
     const target=resolveEntry(candidate);if(!active())return null;
     if(target==null)throw new TypeError('Fear buff list valid candidate pointer did not lock');
     const other=readPriority(target);if(!active())return null;
     if(priorityValue<=int32(other)){entries.splice(index+1,0,entry);return;}
    }
    entries.unshift(entry);
   }finally{mutating=false;}
  },
  remove(buff){
   if(mutating||!active())return null;if(buff==null)return false;mutating=true;
   try{
    for(let index=entries.length-1;index>=0;index--){
     const candidate=copy(entries[index]);if(!active())return null;
     const valid=isEntryValid(candidate);if(!active())return null;
     if(!boolean(valid))continue;
     const target=resolveEntry(candidate);if(!active())return null;
     if(target==null)throw new TypeError('Fear buff list valid removal pointer did not lock');
     const currentUid=readUid(target);if(!active())return null;
     const currentValue=uid(currentUid),requestedUid=readUid(buff);if(!active())return null;
     if(currentValue===uid(requestedUid)){entries.splice(index,1);return true;}
    }
    return false;
   }finally{mutating=false;}
  },
  clearInvalidElementsIfNotLoop(){
   if(mutating||!active())return null;if(iteration.openCount!==0)return;mutating=true;
   try{
    for(let index=entries.length-1;index>=0;index--){
     const entry=copy(entries[index]);if(!active())return null;
     const valid=isEntryValid(entry);if(!active())return null;
     if(!boolean(valid))entries.splice(index,1);
    }
   }finally{mutating=false;}
  },
  openIterator(){return active()?iteration.openIterator():null;},
  openReverseIterator(){return active()?iteration.openReverseIterator():null;},
  get count(){return active()?entries.length:0;},
  get openCount(){return iteration.openCount;},
  release,
 });
}
