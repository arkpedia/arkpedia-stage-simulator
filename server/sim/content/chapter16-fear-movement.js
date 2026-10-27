// SPDX-License-Identifier: GPL-3.0-or-later
// Internal selected motion arithmetic. The caller must supply actual 3D native
// mount-point positions; unit tile coordinates do not establish that mapping.
// No movement registration, launch controller, frame parity or stage admission.
const f=Math.fround,tolerance=f(.1),toleranceSquared=f(tolerance*tolerance);
const normalizationEpsilon=f(1e-5),speed=f(10),axes=['x','y','z'];
function point(value){
 if(!value||!axes.every(k=>Number.isFinite(value[k])&&Number.isFinite(f(value[k]))))
  throw new TypeError('Fear motion requires explicit finite float32 3D mount-point coordinates');
 return Object.fromEntries(axes.map(k=>[k,f(value[k])]));
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
