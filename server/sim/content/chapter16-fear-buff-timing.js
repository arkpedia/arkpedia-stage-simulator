// SPDX-License-Identifier: GPL-3.0-or-later
// Selected PeriodicTimer operations called by Buff.Reset. Inputs are native
// signed Q32.32 values; scheduling and float/blackboard conversion stay explicit.
import {fearProjectileDivideRaw} from './chapter16-fear-cast-wait.js';
import {fearProjectileFloatToRaw} from './chapter16-fear-fixed-values.js';
export function fearProjectileBuffTimer(timer){
 const raw=value=>{
  if(typeof value!=='bigint'||value<-(1n<<63n)||value>(1n<<63n)-1n)
   throw new TypeError('Fear buff timer requires signed Q32.32 raw values');
  return value;
 };
 for(const key of ['m_periodTime','m_remainingTime']){
  const d=timer&&Object.getOwnPropertyDescriptor(timer,key);
  if(!d||!Object.hasOwn(d,'value')||!d.writable)throw new TypeError('Fear buff timer requires writable native timing data fields');
  raw(d.value);
 }
 return Object.freeze({
  reset(periodRaw,waitFirstTriggerInterval){
   raw(periodRaw);
   if(typeof waitFirstTriggerInterval!=='boolean')throw new TypeError('Fear buff timer requires a native Boolean initial-wait flag');
   timer.m_periodTime=periodRaw>0n?periodRaw:0n;
   timer.m_remainingTime=waitFirstTriggerInterval?timer.m_periodTime:0n;
  },
  markInvalid(){
   timer.m_remainingTime=-(1n<<32n);
   timer.m_periodTime=-(1n<<32n);
  },
  setRemainingTime(remainingRaw){
   raw(remainingRaw);const period=raw(timer.m_periodTime);
   timer.m_remainingTime=remainingRaw<period?remainingRaw:period;
  },
 });
}

// Trigger portion of Buff.Reset. The caller supplies native data/blackboard
// reads, float conversion, validity and the retained PeriodicTimer receivers.
export function fearProjectileResetBuffTriggers({buff,readData,getFpOrDefault,getIntOrDefault,floatToRaw=fearProjectileFloatToRaw,timer,setTriggerable,isActive}){
 if(!buff||[readData,getFpOrDefault,getIntOrDefault,floatToRaw,setTriggerable,isActive].some(fn=>typeof fn!=='function')||
  !timer||['reset','markInvalid','setRemainingTime'].some(key=>typeof timer[key]!=='function'))
  throw new TypeError('Fear trigger reset requires native data, blackboard, conversion and lifecycle callers');
 const field=Object.getOwnPropertyDescriptor(buff,'m_triggerCnt');
 if(!field||!Object.hasOwn(field,'value')||!field.writable)throw new TypeError('Fear trigger reset requires a writable native trigger count');
 const int=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear trigger reset requires native Int32 counts');return value;};
 const raw=value=>{if(typeof value!=='bigint'||value<-(1n<<63n)||value>(1n<<63n)-1n)throw new TypeError('Fear trigger reset requires signed Q32.32 values');return value;};
 const byte=value=>{if(!Number.isInteger(value)||value<0||value>255)throw new TypeError('Fear trigger reset requires a native byte trigger-life value');return value;};
 int(field.value);let running=false;
 const active=()=>{const value=isActive();if(typeof value!=='boolean')throw new TypeError('Fear trigger reset requires Boolean lifecycle validity');return value;};
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    if(!active())return null;
    let data=readData();if(!active())return null;
    const type=byte(data.triggerLifeType);
    buff.m_triggerCnt=type===0?0:type===2?-1:int(data.triggerCnt);
    data=readData();if(!active())return null;
    if(byte(data.triggerLifeType)===0){timer.markInvalid();if(!active())return null;}
    else{
     data=readData();if(!active())return null;
     const defaultPeriod=floatToRaw(data.triggerInterval);if(!active())return null;
     const interval=getFpOrDefault('interval',raw(defaultPeriod),false);if(!active())return null;raw(interval);
     const count=getIntOrDefault('trig_cnt',int(buff.m_triggerCnt),false);if(!active())return null;
     buff.m_triggerCnt=int(count);
     data=readData();if(!active())return null;
     if(typeof data.waitFirstTriggerInterval!=='boolean')throw new TypeError('Fear trigger reset requires a native Boolean initial-wait flag');
     timer.reset(interval,data.waitFirstTriggerInterval);if(!active())return null;
     data=readData();if(!active())return null;
     const defaultFirst=floatToRaw(data.firstTriggerInterval);if(!active())return null;
     const first=getFpOrDefault('first_trigger_interval',raw(defaultFirst),false);if(!active())return null;
     if(raw(first)>0n){timer.setRemainingTime(first);if(!active())return null;}
    }
    setTriggerable(int(buff.m_triggerCnt)>0);if(!active())return null;
   }finally{running=false;}
  },
 });
}

// Reset captures this key before merging its blackboards; callers carry the
// selected key to the later duration lookup rather than rereading it there.
export function fearProjectileBuffDurationKey(value){
 if(value==null||value==='')return'duration';
 if(typeof value!=='string')throw new TypeError('Fear buff duration key requires a native string');
 return value;
}

export function fearProjectileResetBuffLifetime({buff,durationKey,tryGetDuration,readData,floatToRaw=fearProjectileFloatToRaw,modifyLifeTimeFinally,isActive}){
 if(!buff||typeof durationKey!=='string'||[tryGetDuration,readData,floatToRaw,modifyLifeTimeFinally,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear lifetime reset requires the captured duration key and native duration/lifecycle callers');
 const raw=value=>{if(typeof value!=='bigint'||value<-(1n<<63n)||value>(1n<<63n)-1n)throw new TypeError('Fear lifetime reset requires signed Q32.32 values');return value;};
 for(const key of ['m_lifeTime','m_remainingTime','m_existingTime']){
  const d=Object.getOwnPropertyDescriptor(buff,key);
  if(!d||!Object.hasOwn(d,'value')||!d.writable)throw new TypeError('Fear lifetime reset requires writable native timing data fields');
  raw(d.value);
 }
 let running=false;
 const active=()=>{const result=isActive();if(typeof result!=='boolean')throw new TypeError('Fear lifetime reset requires Boolean lifecycle validity');return result;};
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    if(!active())return null;
    const lookup=tryGetDuration(durationKey);if(!active())return null;
    if(!lookup||typeof lookup.found!=='boolean')throw new TypeError('Fear lifetime reset requires native found/out duration results');
    // The native out argument is the lifetime field itself, even on failure.
    buff.m_lifeTime=raw(lookup.valueRaw);
    if(!lookup.found){
     const data=readData();if(!active())return null;
     const fallback=floatToRaw(data.lifeTime);if(!active())return null;
     buff.m_lifeTime=raw(fallback);
    }
    const data=readData();if(!active())return null;
    const type=data.lifeTimeType;
    if(!Number.isInteger(type)||type<0||type>255)throw new TypeError('Fear lifetime reset requires a native byte lifetime type');
    if(type===0)buff.m_lifeTime=0n;
    else if(type===2)buff.m_lifeTime=-(1n<<32n);
    modifyLifeTimeFinally(buff);if(!active())return null;
    buff.m_remainingTime=raw(buff.m_lifeTime);
    buff.m_existingTime=0n;
   }finally{running=false;}
  },
 });
}

// Default _ModifyLifeTimeFinally: levitation lasts half as long for an Enemy
// with native massLevel>3. Type/Unity validity readers remain explicit.
export function fearProjectileModifyBuffLifetime({buff,readOwner,isDestroyedOrNull,asEnemy,hasLevitate,readMassLevel,isActive}){
 if(!buff||[readOwner,isDestroyedOrNull,asEnemy,hasLevitate,readMassLevel,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear lifetime modifier requires native owner, type, flag and lifecycle callers');
 const d=Object.getOwnPropertyDescriptor(buff,'m_lifeTime');
 if(!d||!Object.hasOwn(d,'value')||!d.writable)throw new TypeError('Fear lifetime modifier requires a writable native lifetime field');
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear lifetime modifier requires native Boolean results');return value;};
 let running=false;
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    if(!boolean(isActive()))return null;
    const first=readOwner();if(!boolean(isActive()))return null;
    const destroyed= isDestroyedOrNull(first);if(!boolean(isActive()))return null;if(boolean(destroyed))return;
    const second=readOwner();if(!boolean(isActive()))return null;
    const enemy=asEnemy(second);if(!boolean(isActive()))return null;
    const absent=isDestroyedOrNull(enemy);if(!boolean(isActive()))return null;if(boolean(absent))return;
    const levitate=hasLevitate();if(!boolean(isActive()))return null;if(!boolean(levitate))return;
    if(enemy==null)throw new TypeError('Fear lifetime modifier cannot read mass of a null Enemy');
    const mass=readMassLevel(enemy);if(!boolean(isActive()))return null;
    if(!Number.isInteger(mass)||mass<-(2**31)||mass>=2**31)throw new TypeError('Fear lifetime modifier requires native Int32 mass level');
    if(mass>3)buff.m_lifeTime=fearProjectileDivideRaw(buff.m_lifeTime,2n<<32n);
   }finally{running=false;}
  },
 });
}
