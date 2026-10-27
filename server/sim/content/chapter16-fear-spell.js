// SPDX-License-Identifier: GPL-3.0-or-later
// Selected single-spell continuation after the bounded pre-delay wait. The
// native default CheckAnotherSpell returns false. Launch, event5 receivers and
// post-delay scheduling are explicit callers; this does not register the enemy.
export function fearProjectileSpell(b,{owner,onSpellStart,isCasting,emitSpellEnd,mayBeginPostDelay,beginPostDelay}){
 if(!owner||!Number.isInteger(owner.deploySeq)||
  [onSpellStart,isCasting,emitSpellEnd,mayBeginPostDelay,beginPostDelay].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear spell requires an owner life and explicit launch, casting, spell-end and post-delay callers');
 const life=owner.deploySeq;let ended=false,used=false,endHandle=null,removeHandle=null;
 const release=()=>{ended=true;if(endHandle)b.off(endHandle);if(removeHandle)b.off(removeHandle);endHandle=removeHandle=null;};
 const active=()=>{if(!ended&&(b.finished||b._endReq||owner.deploySeq!==life||owner.removed))release();return!ended;};
 if(active()){
  endHandle=b.on('battleEnd',release);
  removeHandle=b.on('removed',({unit})=>{if(unit===owner)release();});
 }
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear spell reader requires a native Boolean');return value;};
 return Object.freeze({
  run(){
   if(used||!active())return null;
   used=true;
   try{
    const started=onSpellStart();
    if(!active())return null;
    if(!boolean(started))return{started:false,spellEnd:false,postDelay:false};
    const casting=isCasting();
    if(!active())return null;
    if(!boolean(casting))return{started:true,spellEnd:false,postDelay:false};
    // The single spell has completed. Native event5 precedes owner validity /
    // action checks and post-delay; its receiver may remove the owner itself.
    emitSpellEnd({event:5,spellCount:1});
    if(!active())return{started:true,spellEnd:true,postDelay:false};
    const canPost=mayBeginPostDelay();
    if(!active())return{started:true,spellEnd:true,postDelay:false};
    if(!boolean(canPost))return{started:true,spellEnd:true,postDelay:false};
    beginPostDelay();return{started:true,spellEnd:true,postDelay:true};
   }finally{release();}
  },
  release,
 });
}
