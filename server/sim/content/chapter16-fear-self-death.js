// SPDX-License-Identifier: GPL-3.0-or-later
// Selected ON_ACTIVATE action order of fearpj_m0_t[switch_to_die]. Context
// binding, native status/mode/buff/kill effects remain explicit callers. Effect
// callbacks return the native action's Boolean, not an inferred buff receipt.
export function fearProjectileSelfDeathActivation(b,{owner,...callers}){
 // Buff.OnStart invokes event0 with set-target-to-owner=true. The caller's
 // prior context target cannot redirect this activation's TARGET actions.
 return fearProjectileSelfDeath(b,{...callers,buffOwner:owner,target:owner});
}

// Selected non-initial, non-forced Unit.SwitchMode body. Native mode/ability
// objects and effect implementations must be supplied from the bound graph;
// an attack/combat pair is not a substitute for UnitMode.m_abilities.
export function fearProjectileModeSwitch(b,{owner,nextMode,readCurrentMode,sameMode,isModeValid,
 readFacing,readBodyDirection,readAbilities,detachAbility,onInactivate,setModeActive,
 writeCurrentMode,readStartIniting,attachAbility,onActivate,onSwitchMode,faceTo,setBodyDirection}){
 const callers=[readCurrentMode,sameMode,isModeValid,readFacing,readBodyDirection,readAbilities,
  detachAbility,onInactivate,setModeActive,writeCurrentMode,readStartIniting,attachAbility,
  onActivate,onSwitchMode,faceTo,setBodyDirection];
 if(!owner||!Number.isInteger(owner.deploySeq)||!nextMode||callers.some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear mode switch requires a bound next mode, owner life and explicit native callers');
 const life=owner.deploySeq;let used=false,ended=false,endHandle=null,removeHandle=null;
 const release=()=>{ended=true;if(endHandle)b.off(endHandle);if(removeHandle)b.off(removeHandle);endHandle=removeHandle=null;};
 const active=()=>{if(!ended&&(b.finished||b._endReq||owner.removed||owner.deploySeq!==life))release();return!ended;};
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear mode switch requires native Boolean predicates');return value;};
 const vector=value=>{
  if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)||
   !Number.isFinite(Math.fround(value.x))||!Number.isFinite(Math.fround(value.y)))
   throw new TypeError('Fear mode switch requires native Vector2 pose values');
  return Object.freeze({x:Math.fround(value.x),y:Math.fround(value.y)});
 };
 // Unit uses the initialized m_abilities array, including duplicates. It reads
 // its live length each iteration and tests Unity validity before each call.
 const abilities=(mode,visit)=>{
  const list=readAbilities(mode);if(!active())return false;
  if(!Array.isArray(list))throw new TypeError('Fear mode switch requires the initialized native ability array');
  for(let index=0;index<list.length;index++){
   const ability=list[index],valid=isModeValid(ability);if(!active())return false;
   if(boolean(valid)){visit(ability);if(!active())return false;}
  }
  return true;
 };
 if(active()){
  endHandle=b.on('battleEnd',release);
  removeHandle=b.on('removed',({unit})=>{if(unit===owner)release();});
 }
 return Object.freeze({
  run(){
   if(used||!active())return null;
   used=true;
   try{
    const initialMode=readCurrentMode(owner);if(!active())return null;
    const same=sameMode(nextMode,initialMode);if(!active())return null;
    if(boolean(same))return false;
    const facingValue=readFacing(owner);if(!active())return null;
    const facing=vector(facingValue);if(!active())return null;
    const directionValue=readBodyDirection(owner);if(!active())return null;
    const direction=vector(directionValue);if(!active())return null;
    const oldMode=readCurrentMode(owner);if(!active())return null;
    const valid=isModeValid(oldMode);if(!active())return null;
    if(boolean(valid)){
     if(!abilities(oldMode,ability=>detachAbility(ability)))return null;
     onInactivate(oldMode);if(!active())return null;
     setModeActive(oldMode,false);if(!active())return null;
    }
    // Native code samples lastMode again after InactiveMode callbacks. It can
    // differ from the mode whose abilities were just detached.
    const lastMode=readCurrentMode(owner);if(!active())return null;
    writeCurrentMode(owner,nextMode);if(!active())return null;
    setModeActive(nextMode,true);if(!active())return null;
    const startIniting=readStartIniting(owner);if(!active())return null;
    if(boolean(startIniting)&&!abilities(nextMode,ability=>attachAbility(ability,owner)))return null;
    onActivate(nextMode,lastMode,{isInit:false});if(!active())return null;
    onSwitchMode(owner,nextMode,lastMode,{restartFSM:true});if(!active())return null;
    faceTo(owner,facing,{force:true});if(!active())return null;
    setBodyDirection(owner,direction,{force:true});return active()?true:null;
   }finally{release();}
  },
  release,
 });
}

// UnitMode._InitAbilities appends general, combat, attack, then invokes the
// reference-shared RemoveDuplicationsInplace routine. Its removal swaps in the
// last element and still advances j; a stable Set/filter is not equivalent.
// Unity validity and virtual Equals remain explicit native predicate inputs.
export function fearProjectileCollectModeAbilities({generalAbilities,combat,attack,isValid,equals}){
 if(!Array.isArray(generalAbilities)||typeof isValid!=='function'||typeof equals!=='function')
  throw new TypeError('Fear mode abilities require the original general array and native validity/equality predicates');
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear mode abilities require native Boolean predicates');return value;};
 const abilities=[];
 for(let i=0;i<generalAbilities.length;i++)if(boolean(isValid(generalAbilities[i])))abilities.push(generalAbilities[i]);
 if(boolean(isValid(combat)))abilities.push(combat);
 if(boolean(isValid(attack)))abilities.push(attack);
 for(let i=0;i<abilities.length;i++)for(let j=i+1;j<abilities.length;j++){
  if(boolean(equals(abilities[i],abilities[j]))){abilities[j]=abilities.at(-1);abilities.pop();}
 }
 return abilities;
}

// UnitMode callbacks, separate from Unit's static ability loop. Dynamic
// entries are the ability keys of m_dynaimcAbilites, not m_abilities.
export function fearProjectileModeEffects(b,{owner,mode,operation,isInit=false,readTalents,readDynamicAbilities,
 isTalentValid,isTalentAttached,attachTalent,detachTalent,attachAbility,detachAbility}){
 if(!owner||!Number.isInteger(owner.deploySeq)||!mode||!['activate','inactivate'].includes(operation)||typeof isInit!=='boolean'||
  [readTalents,readDynamicAbilities,isTalentValid,isTalentAttached,attachTalent,detachTalent,attachAbility,detachAbility].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear mode effects require a bound mode, owner life, operation and native effect callers');
 const life=owner.deploySeq;let used=false,ended=false,endHandle=null,removeHandle=null;
 const release=()=>{ended=true;if(endHandle)b.off(endHandle);if(removeHandle)b.off(removeHandle);endHandle=removeHandle=null;};
 const active=()=>{if(!ended&&(b.finished||b._endReq||owner.removed||owner.deploySeq!==life))release();return!ended;};
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear mode effects require native Boolean predicates');return value;};
 const array=value=>{if(!Array.isArray(value))throw new TypeError('Fear mode effects require initialized native talent/dynamic arrays');return value;};
 if(active()){
  endHandle=b.on('battleEnd',release);
  removeHandle=b.on('removed',({unit})=>{if(unit===owner)release();});
 }
 return Object.freeze({
  run(){
   if(used||!active())return null;used=true;
   try{
    if(operation==='inactivate'||!isInit){
     let talents=readTalents(mode);if(!active())return null;talents=array(talents);
     for(let index=0;index<talents.length;index++){
      let talent=talents[index];const valid=isTalentValid(talent);if(!active())return null;
      if(boolean(valid)){
       if(operation==='activate'){
        talents=readTalents(mode);if(!active())return null;talents=array(talents);
        if(index>=talents.length)throw new RangeError('Fear mode talent index changed during activation');
        talent=talents[index];
       }
       const attached=isTalentAttached(talent);if(!active())return null;
       if(boolean(attached)===(operation==='inactivate')){
        if(operation==='activate'){
         talents=readTalents(mode);if(!active())return null;talents=array(talents);
         if(index>=talents.length)throw new RangeError('Fear mode talent index changed during activation');
         attachTalent(talents[index],owner);
        }else detachTalent(talent);
        if(!active())return null;
       }
      }
      talents=readTalents(mode);if(!active())return null;talents=array(talents);
     }
    }
    let dynamic=readDynamicAbilities(mode);if(!active())return null;dynamic=array(dynamic);
    for(let index=0;index<dynamic.length;index++){
     // Native dynamic entries are not filtered through Unity validity here.
     if(dynamic[index]==null)throw new TypeError('Fear mode dynamic ability cannot be null');
     if(operation==='activate')attachAbility(dynamic[index],owner);else detachAbility(dynamic[index]);
     if(!active())return null;
     dynamic=readDynamicAbilities(mode);if(!active())return null;dynamic=array(dynamic);
    }
    return true;
   }finally{release();}
  },
  release,
 });
}

export function fearProjectileModeFsmRestart(b,{owner,isRunning,readState,stop,start}){
 if(!owner||!Number.isInteger(owner.deploySeq)||[isRunning,readState,stop,start].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear mode FSM restart requires an owner life and explicit native state-machine callers');
 const life=owner.deploySeq;let used=false,ended=false,endHandle=null,removeHandle=null;
 const release=()=>{ended=true;if(endHandle)b.off(endHandle);if(removeHandle)b.off(removeHandle);endHandle=removeHandle=null;};
 const active=()=>{if(!ended&&(b.finished||b._endReq||owner.removed||owner.deploySeq!==life))release();return!ended;};
 if(active()){
  endHandle=b.on('battleEnd',release);
  removeHandle=b.on('removed',({unit})=>{if(unit===owner)release();});
 }
 return Object.freeze({
  run(){
   if(used||!active())return null;
   used=true;
   try{
    const running=isRunning(owner);if(!active())return null;
    if(typeof running!=='boolean')throw new TypeError('Fear mode FSM requires a native Boolean running state');
    if(!running)return false;
    const state=readState(owner);if(!active())return null;
    if(!Number.isInteger(state)||state<-2147483648||state>2147483647)
     throw new TypeError('Fear mode FSM requires a native Int32 current state');
    stop(owner);if(!active())return null;
    start(owner,state);return true;
   }finally{release();}
  },
  release,
 });
}

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
    const killed=instantKill(target,{killSource:false,noSource:false,withdrawIfRallyPoint:false,
     resultIfInRallyPointMode:false,skipReborn:false,noReason:false,markReachExit:false,switchState:false});
    return active()?boolean(killed):null;
   }finally{release();}
  },
  release,
 });
}
