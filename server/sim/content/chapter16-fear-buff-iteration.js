// SPDX-License-Identifier: GPL-3.0-or-later
// Selected forward DoubleBufferedList iteration. Inputs are already ordered
// native ObjectPtr entries; sorting, UID locking and buff effects are separate.
export function fearProjectileBuffIteration(b,{owner,readInternalEntries,copyEntry,resolveEntry}){
 if(!owner||!Number.isInteger(owner.deploySeq)||[readInternalEntries,copyEntry,resolveEntry].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear buff iteration requires an owner life and native ordered-entry/lock readers');
 const life=owner.deploySeq,cursors=new Set();let ended=false,opening=false,count=0,buffer=[],endHandle=null,removeHandle=null;
 const release=()=>{
  if(ended)return;ended=true;
  for(const cursor of [...cursors])cursor.dispose();
  buffer=[];count=0;
  if(endHandle)b.off(endHandle);if(removeHandle)b.off(removeHandle);endHandle=removeHandle=null;
 };
 const active=()=>{if(!ended&&(b.finished||b._endReq||owner.removed||owner.deploySeq!==life))release();return!ended;};
 if(active()){
  endHandle=b.on('battleEnd',release);
  removeHandle=b.on('removed',({unit})=>{if(unit===owner)release();});
 }
 return Object.freeze({
  openIterator(){
   if(opening||!active())return null;
   opening=true;const previous=count;count=(count+1)&0xffff;
   try{
    if(previous===0){
     // Native GetEnumerator clears m_cachedBuffer, then AddRange copies the
     // internal list. Cursor lifetime, not action callbacks, owns this view.
     buffer=[];const entries=readInternalEntries();if(!active())return null;
     if(!Array.isArray(entries))throw new TypeError('Fear buff iteration requires an ordered native entry array');
     const copies=[];
     for(const entry of entries.slice()){
      const copy=copyEntry(entry);if(!active())return null;copies.push(copy);
     }
     buffer=copies;
    }
    let index=-1,disposed=false,reading=false;
    const cursor=Object.freeze({
     moveNext(){if(disposed||!active())return false;index=(index+1)|0;return index<buffer.length;},
     current(){
      if(reading||disposed||!active())return null;
      if(index<0||index>=buffer.length)throw new RangeError('Fear buff iterator has no current entry');
      reading=true;
      try{
       // get_Current returns T by value; Lock must not mutate the cached
       // ObjectPtr struct or alias a later update to the internal list entry.
       const copy=copyEntry(buffer[index]);if(!active()||disposed)return null;
       const entry=resolveEntry(copy);return active()&&!disposed?entry:null;
      }
      finally{reading=false;}
     },
     dispose(){if(disposed)return;disposed=true;cursors.delete(cursor);count=(count-1)&0xffff;},
    });
    cursors.add(cursor);return cursor;
   }catch(error){if(active())count=(count-1)&0xffff;throw error;}
   finally{opening=false;}
  },
  get openCount(){return count;},
  release,
 });
}
