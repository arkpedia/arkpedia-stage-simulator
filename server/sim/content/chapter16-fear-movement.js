// SPDX-License-Identifier: GPL-3.0-or-later
// Internal selected arrival predicate. The caller must supply actual 3D native
// mount-point positions; unit tile coordinates do not establish that mapping.
// No movement registration, launch controller, frame parity or stage admission.
const f=Math.fround,tolerance=f(.1),toleranceSquared=f(tolerance*tolerance);
export function fearProjectileReached(position,targetPosition){
 if(!position||!targetPosition||!['x','y','z'].every(k=>Number.isFinite(position[k])&&Number.isFinite(targetPosition[k])))return false;
 const x=f(f(position.x)-f(targetPosition.x));
 const y=f(f(position.y)-f(targetPosition.y));
 const z=f(f(position.z)-f(targetPosition.z));
 // Torappu.Common MathUtil.CheckDistance, RVA0x5a40470: y²+x², then z²,
 // each scalar operation at float32 precision, inclusive tolerance comparison.
 return toleranceSquared>=f(f(f(y*y)+f(x*x))+f(z*z));
}
