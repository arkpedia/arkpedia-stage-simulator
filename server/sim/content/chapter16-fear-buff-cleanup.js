// SPDX-License-Identifier: GPL-3.0-or-later
// Selected BuffContainer._CheckFinishedBuffs pass. Native finish/pool and
// override-group effects remain callers; this does not grant enemy support.
export function fearProjectileFinishedBuffs(b,{owner,openReverseIterator,isFinished,finishAndRemoveBuff,
 readOverrideKey,tryGetOverrideGroup,removeFromOverrideGroup,clearInvalidElementsIfNotLoop}){
 if(!owner||!Number.isInteger(owner.deploySeq)||[openReverseIterator,isFinished,finishAndRemoveBuff,readOverrideKey,
  tryGetOverrideGroup,removeFromOverrideGroup,clearInvalidElementsIfNotLoop].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear finished-buff pass requires an owner life and native cleanup/override callers');
 const life=owner.deploySeq;let used=false,ended=false,endHandle=null,removeHandle=null;
 const release=()=>{ended=true;if(endHandle)b.off(endHandle);if(removeHandle)b.off(removeHandle);endHandle=removeHandle=null;};
 const active=()=>{if(!ended&&(b.finished||b._endReq||owner.removed||owner.deploySeq!==life))release();return!ended;};
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear finished-buff pass requires native Boolean results');return value;};
 if(active()){
  endHandle=b.on('battleEnd',release);
  removeHandle=b.on('removed',({unit})=>{if(unit===owner)release();});
 }
 return Object.freeze({
  run(){
   if(used||!active())return null;used=true;
   try{
    let sawNull=false;
    const iterator=openReverseIterator();
    if(!active()){if(iterator&&typeof iterator.dispose==='function')iterator.dispose();return null;}
    if(!iterator||typeof iterator.dispose!=='function')throw new TypeError('Fear finished-buff pass requires a disposable reverse iterator');
    try{
     if(typeof iterator.moveNext!=='function'||typeof iterator.current!=='function')throw new TypeError('Fear finished-buff pass requires native iterator moveNext/current');
     for(;;){
      const moved=iterator.moveNext();if(!active())return null;if(!boolean(moved))break;
      const buff=iterator.current();if(!active())return null;
      if(buff==null){sawNull=true;continue;}
      const finished=isFinished(buff);if(!active())return null;if(!boolean(finished))continue;
      finishAndRemoveBuff(buff);if(!active())return null;
      const firstKey=readOverrideKey(buff);if(!active())return null;
      if(firstKey==null||firstKey==='')continue;
      if(typeof firstKey!=='string')throw new TypeError('Fear finished-buff override key must be a native string');
      // The native getter is called again for TryGetValue after IsNullOrEmpty.
      const key=readOverrideKey(buff);if(!active())return null;
      if(typeof key!=='string')throw new TypeError('Fear finished-buff override lookup requires a nonnull native string');
      const lookup=tryGetOverrideGroup(key);if(!active())return null;
      if(!lookup||typeof lookup!=='object')throw new TypeError('Fear finished-buff override lookup requires native found/group results');
      const found=lookup.found;if(!active())return null;
      if(boolean(found)){
       const group=lookup.group;if(!active())return null;
       if(group==null)throw new TypeError('Fear finished-buff override group cannot be null after a successful lookup');
       removeFromOverrideGroup(group,buff);if(!active())return null;
      }
     }
    }finally{iterator.dispose();}
    if(!active())return null;
    if(sawNull){clearInvalidElementsIfNotLoop();if(!active())return null;}
   }finally{release();}
  },
  release,
 });
}
