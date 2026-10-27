// SPDX-License-Identifier: GPL-3.0-or-later
// Internal selected motion arithmetic. The caller must supply actual 3D native
// mount-point positions; unit tile coordinates do not establish that mapping.
// No movement registration, launch controller, frame parity or stage admission.
import {fearProjectileEntityReference} from './chapter16-fear-impact.js';
const f=Math.fround,tolerance=f(.1),toleranceSquared=f(tolerance*tolerance);
const normalizationEpsilon=f(1e-5),speed=f(10),axes=['x','y','z'];
function point(value){
 if(!value||!axes.every(k=>Number.isFinite(value[k])&&Number.isFinite(f(value[k]))))
  throw new TypeError('Fear motion requires explicit finite float32 3D mount-point coordinates');
 return Object.fromEntries(axes.map(k=>[k,f(value[k])]));
}

// MountPoint.m_entity and Projectile.m_source/m_traceTarget share the same
// ObjectPtr<Entity> type. The reader supplies the actual converted mount point.
export function fearProjectileMountReference(b,entity,readMountPosition){
 if(typeof readMountPosition!=='function')throw new TypeError('Fear mount reference requires an explicit position reader');
 const ref=fearProjectileEntityReference(b,entity);
 return Object.freeze({
  resolvePosition(){
   const owner=ref.resolveEntity();if(!owner||!ref.isBattleActive())return null;
   const raw=readMountPosition(owner);
   if(ref.resolveEntity()!==owner||!ref.isBattleActive())return null;
   const position=point(raw);
   return ref.resolveEntity()===owner&&ref.isBattleActive()?position:null;
  },
  release:ref.release,isBattleActive:ref.isBattleActive,
 });
}

// Internal carrier for supplied native coordinates. This does not choose mount
// transforms, effective time scale, finite expiry or final trace-target hits.
export function fearProjectileTraceMotion({from,initialTarget,resolveTargetPosition,isBattleActive}){
 if(typeof resolveTargetPosition!=='function'||typeof isBattleActive!=='function')
  throw new TypeError('Fear trace motion requires explicit position and lifecycle resolvers');
 let position=point(from),target=point(initialTarget),ended=false,reached=false,advancing=false;
 let resolve=resolveTargetPosition;
 const active=()=>{
  if(!ended&&!isBattleActive()){ended=true;resolve=null;}
  return!ended;
 };
 return Object.freeze({
  get position(){return{...position};},get destination(){return{...target};},
  advance(effectiveDt){
   if(advancing||reached||ended)return null;
   advancing=true;
   try{
    if(!active())return null;
    const current=resolve();if(!active())return null;
    const candidate=current===null?target:point(current);
    if(!active())return null;
    const next=fearProjectileMotionStep(position,candidate,effectiveDt);
    if(!active())return null;
    target=candidate;position=point(next);reached=next.reached;return{...next};
   }finally{advancing=false;}
  },
  release(){ended=true;resolve=null;},
 });
}
// This is the selected no-inertia, no-dynamic-speed speed-10 branch only.
// effectiveDt must already include the native movement time scale. Target
// sampling, stale-position ownership, expiry and arrival dispatch are separate.
export function fearProjectileMotionStep(position,targetPosition,effectiveDt){
 const start=point(position),target=point(targetPosition),dt=f(effectiveDt);
 if(!Number.isFinite(effectiveDt)||!Number.isFinite(dt)||effectiveDt<0)
  throw new TypeError('Fear motion requires a finite non-negative effective delta');
 const delta=Object.fromEntries(axes.map(k=>[k,f(target[k]-start[k])]));
 const squared=f(f(f(delta.y*delta.y)+f(delta.x*delta.x))+f(delta.z*delta.z));
 const magnitude=f(Math.sqrt(squared));
 if(!Number.isFinite(magnitude))throw new RangeError('Fear motion exceeds finite float32 distance');
 let next;
 if(f(speed*dt)>=magnitude)next=target;
 else{
  const direction=Object.fromEntries(axes.map(k=>[k,magnitude>normalizationEpsilon?f(delta[k]/magnitude):0]));
  next=Object.fromEntries(axes.map(k=>[k,f(start[k]+f(f(direction[k]*dt)*speed))]));
 }
 return{...next,reached:fearProjectileReached(next,target)};
}
export function fearProjectileReached(position,targetPosition){
 if(!position||!targetPosition||!['x','y','z'].every(k=>Number.isFinite(position[k])&&Number.isFinite(targetPosition[k])))return false;
 const x=f(f(position.x)-f(targetPosition.x));
 const y=f(f(position.y)-f(targetPosition.y));
 const z=f(f(position.z)-f(targetPosition.z));
 // Torappu.Common MathUtil.CheckDistance, RVA0x5a40470: y²+x², then z²,
 // each scalar operation at float32 precision, inclusive tolerance comparison.
 return toleranceSquared>=f(f(f(y*y)+f(x*x))+f(z*z));
}
