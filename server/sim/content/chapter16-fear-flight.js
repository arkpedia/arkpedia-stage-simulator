// SPDX-License-Identifier: GPL-3.0-or-later
// Internal selected flight composition. Native coordinate/query/UID/filter and
// deferred scheduler callers remain mandatory; no launcher or stage admission.
import {fearProjectileLifetime} from './chapter16-fear-clock.js';
import {fearProjectileTraceMotion} from './chapter16-fear-movement.js';
import {fearProjectileHitLedger} from './chapter16-fear-delivery.js';
import {fearProjectileAreaDelivery} from './chapter16-fear-area.js';

export function fearProjectileFlight(b,{from,initialTarget,resolveTargetPosition,resolveTraceTarget,
 area,runHit,onStopped,scheduleCompletion}){
 if([resolveTargetPosition,resolveTraceTarget,runHit,onStopped,scheduleCompletion].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear flight requires explicit trace, impact, stop and deferred scheduler callers');
 let ended=false,stopping=false,advancing=false,reached=false,traceCleared=false,endHandle=null,cancel=null;
 let clock,motion,ledger,arrival;
 const release=()=>{
  if(ended)return;
  ended=true;clock?.release();motion?.release();ledger?.release();arrival?.release();
  if(endHandle)b.off(endHandle);endHandle=null;
  const dispose=cancel;cancel=null;if(dispose)dispose();
 };
 const active=()=>{if(!ended&&(b.finished||b._endReq))release();return!ended;};
 const stop=({eliminated=false}={})=>{
  if(stopping||!active())return false;
  stopping=true;
  try{return ledger.stop({eliminated});}finally{release();}
 };
 try{
  motion=fearProjectileTraceMotion({from,initialTarget,resolveTargetPosition,isBattleActive:active});
  ledger=fearProjectileHitLedger(b,{runHit,resolveTraceTarget:()=>traceCleared?null:resolveTraceTarget(),onStopped});
  arrival=fearProjectileAreaDelivery(b,{...area,hitTarget:ledger.hit});
  clock=fearProjectileLifetime({isBattleActive:active,onExpire:()=>stop()});
  if(active())endHandle=b.on('battleEnd',release);
 }catch(error){release();throw error;}
 return Object.freeze({
  get position(){return motion.position;},get reached(){return reached;},
  get ended(){return!active();},get elapsedRaw(){return clock.elapsedRaw;},
  get count(){return ledger.count;},get traceCleared(){return traceCleared;},
  advance(deltaRaw,movementScaleRaw){
   if(advancing||stopping||!active())return null;
   advancing=true;
   try{
    const timing=clock.advance(deltaRaw,movementScaleRaw);
    if(!timing||timing.expired||!active())return timing;
    const step=motion.advance(timing.effectiveDt);
    if(!step||!active())return null;
    let delivery=null;
    if(step.reached&&!reached){
     // Native reached guard precedes arrival callbacks. Preserve trace through
     // their return, then EnsureLifeTime(0) and clear it before scheduling stop.
     reached=true;delivery=arrival.deliver();
     if(active()){
      clock.ensureLifeTime(0n);traceCleared=true;
      let scheduling=true;
      const dispose=scheduleCompletion(()=>{
       if(!active())return false;
       if(scheduling)throw new Error('Fear completion scheduler must defer its callback');
       return stop();
      });
      scheduling=false;
      if(typeof dispose!=='function')throw new TypeError('Fear completion scheduler must return a cancellation function');
      if(active())cancel=dispose;else dispose();
     }
    }
    return{...timing,motion:step,delivery};
   }catch(error){release();throw error;}finally{advancing=false;}
  },
  stop,release,
 });
}
