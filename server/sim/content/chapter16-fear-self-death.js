// SPDX-License-Identifier: GPL-3.0-or-later
// Selected ON_ACTIVATE action order of fearpj_m0_t[switch_to_die]. Context
// binding, native status/mode/buff/kill effects remain explicit callers. Effect
// callbacks return the native action's Boolean, not an inferred buff receipt.
export function fearProjectileSuicide(b,{target,readAlive,markSuicide,setHpInternal}){
 if(!target||!Number.isInteger(target.deploySeq)||[readAlive,markSuicide,setHpInternal].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear suicide requires a target life and explicit native alive, suicide-mark and HP callers');
 const life=target.deploySeq;
 let used=false,ended=false,endHandle=null,removeHandle=null;
 const release=()=>{ended=true;if(endHandle)b.off(endHandle);if(removeHandle)b.off(removeHandle);endHandle=removeHandle=null;};
 const active=()=>{if(!ended&&(b.finished||b._endReq||target.removed||target.deploySeq!==life))release();return!ended;};
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear suicide requires a native Boolean alive result');return value;};
 if(active()){
  endHandle=b.on('battleEnd',release);
  removeHandle=b.on('removed',({unit})=>{if(unit===target)release();});
 }
 return Object.freeze({
  run(){
   if(used||!active())return null;
   used=true;
   try{
    const alive=readAlive(target);if(!active())return null;
    if(boolean(alive)){
     markSuicide(target);if(!active())return null;
     setHpInternal(target,{valueRaw:0n,force:true,noSource:false,skipReborn:false});
     if(!active())return null;
    }
    // InstantKill.Execute returns get_alive AFTER Suicide, rather than a kill
    // success receipt. A target that actually dies normally returns false.
    const remaining=readAlive(target);return active()?boolean(remaining):null;
   }finally{release();}
  },
  release,
 });
}

export function fearProjectileSelfDeath(b,{buffOwner,target,readAbnormalFlag,readAbnormalCombo,
 switchMode,createImmunityBuff,instantKill}){
 if(!buffOwner||!target||!Number.isInteger(buffOwner.deploySeq)||!Number.isInteger(target.deploySeq)||
  [readAbnormalFlag,readAbnormalCombo,switchMode,createImmunityBuff,instantKill].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear self-death requires captured buff-owner/target lives and explicit native action callers');
 const ownerLife=buffOwner.deploySeq,targetLife=target.deploySeq;
 let used=false,ended=false,endHandle=null,removeHandle=null;
 const release=()=>{ended=true;if(endHandle)b.off(endHandle);if(removeHandle)b.off(removeHandle);endHandle=removeHandle=null;};
 const active=()=>{
  if(!ended&&(b.finished||b._endReq||buffOwner.removed||target.removed||buffOwner.deploySeq!==ownerLife||target.deploySeq!==targetLife))release();
  return!ended;
 };
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear self-death action requires a native Boolean result');return value;};
 if(active()){
  endHandle=b.on('battleEnd',release);
  removeHandle=b.on('removed',({unit})=>{if(unit===buffOwner||unit===target)release();});
 }
 return Object.freeze({
  run(){
   if(used||!active())return null;
   used=true;
   try{
    for(const flag of ['LEVITATE','FROZEN','STUNNED']){
     const set=readAbnormalFlag(buffOwner,flag);if(!active())return null;
     if(boolean(set))return false;
    }
    const sleeping=readAbnormalCombo(buffOwner,'SLEEPING');if(!active())return null;
    if(boolean(sleeping))return false;
    const switched=switchMode(target,{modeIndex:1,loadModeFromBlackboard:false,restoreDefault:false,restartFSM:true});
    if(!active())return null;if(!boolean(switched))return false;
    const created=createImmunityBuff(buffOwner);if(!active())return null;
    boolean(created);
    // Default nodes require previous success, and failed condition dispatch
    // exits RunActions. Only this next node is AlwaysNext(condition0), returns
    // true, and thereby permits InstantKill even if immunity creation failed.
    return boolean(instantKill(target,{killSource:false,noSource:false,withdrawIfRallyPoint:false,
     resultIfInRallyPointMode:false,skipReborn:false,noReason:false,markReachExit:false,switchState:false}));
   }finally{release();}
  },
  release,
 });
}
