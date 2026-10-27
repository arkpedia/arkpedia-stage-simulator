// SPDX-License-Identifier: GPL-3.0-or-later
// Internal selected hit/stop composition. Area selection, the native FP lifetime
// clock, deferred stop scheduling and launcher/stage admission remain separate.
const maxHits=128;
export function fearProjectileHitLedger(b,{runHit,resolveTraceTarget,onStopped}){
 if([runHit,resolveTraceTarget,onStopped].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear hit ledger requires explicit hit, trace-reference and stop-action callers');
 let ended=false,stopped=false,traceHit=false,resolving=false,count=0,seen=new WeakMap(),endHandle=null;
 const release=()=>{ended=true;seen=new WeakMap();if(endHandle)b.off(endHandle);endHandle=null;};
 const active=()=>{
  if(!ended&&(b.finished||b._endReq))release();
  return!ended;
 };
 const hit=(target,forced)=>{
  if(!active()||!target||!Number.isInteger(target.deploySeq))return false;
  const life=target.deploySeq;
  let lives=seen.get(target);
  if(lives?.has(life))return false;
  if(!lives){lives=new Set();seen.set(target,lives);}
  // CheckTargetAlreadyHitAndUpdate runs before the normal count gate. Even a
  // cap-rejected identity remains reserved with keepAlreadyHitTime=-1.
  lives.add(life);
  if(!forced&&count>=maxHits)return false;
  runHit({target,forced});
  // Native DealHitTarget increments only after OnHitTarget returns.
  count++;return true;
 };
 const hitTraceTarget=()=>{
  if(!active()||traceHit||resolving)return false;
  resolving=true;
  try{
   const target=resolveTraceTarget();
   if(!active()||traceHit||!target)return false;
   traceHit=true;return hit(target,true);
  }finally{resolving=false;}
 };
 if(active())endHandle=b.on('battleEnd',release);
 return Object.freeze({
  get count(){return count;},get hasHitTraceTarget(){return traceHit;},
  hit:target=>hit(target,false),hitTraceTarget,
  stop({eliminated=false}={}){
   if(stopped||!active())return false;
   stopped=true;
   try{
    if(!eliminated)hitTraceTarget();
    // Selected alwaysReachInTheEnd=false: there is no area-arrival callback.
    if(active())onStopped();
    return true;
   }finally{release();}
  },
  release,
 });
}
