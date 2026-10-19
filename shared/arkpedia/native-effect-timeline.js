// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit clip transitions on one continuing particle clock. No Animator FSM.
const owners=new WeakSet();
export const isEffectTimeline=value=>value!==null&&typeof value==='object'&&owners.has(value);
export function createEffectTimeline(transitions){
  if(!Array.isArray(transitions)||!transitions.length||transitions.length>20000)throw Error('Invalid effect clip timeline');
  const records=Array.from(transitions,(r,i)=>{
    if(!Number.isFinite(r?.time)||r.time<0||i&&r.time<=transitions[i-1].time
      ||r.clip!==null&&(typeof r.clip!=='string'||!r.clip))throw Error('Invalid effect clip transition');
    return {time:r.time,clip:r.clip};
  });
  if(records[0].time!==0)throw Error('Effect clip timeline must start at zero');
  const result={clips:Object.freeze([...new Set(records.map(r=>r.clip))]),sample(time){
    if(!Number.isFinite(time))throw Error('Invalid effect clip clock');
    time=Math.max(0,time);let lo=0,hi=records.length;
    while(lo+1<hi){const mid=(lo+hi)>>1;if(records[mid].time<=time)lo=mid;else hi=mid;}
    return {clip:records[lo].clip,time:time-records[lo].time};
  },scope:Object.freeze({explicitTransitions:true,continuousParticleClock:true,nativeDispatchVerified:false})};
  owners.add(result);return Object.freeze(result);
}
