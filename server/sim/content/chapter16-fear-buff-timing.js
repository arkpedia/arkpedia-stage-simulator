// SPDX-License-Identifier: GPL-3.0-or-later
// Selected PeriodicTimer operations called by Buff.Reset. Inputs are native
// signed Q32.32 values; scheduling and float/blackboard conversion stay explicit.
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
