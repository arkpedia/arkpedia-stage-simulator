// SPDX-License-Identifier: GPL-3.0-or-later
import {integrateParticleCurve} from './native-particle-curves.js';
import {particleRandom} from './native-particle-random.js';
// Authored acceleration impulse in its own source axes. Space conversion and
// damping/position update ordering are separate, explicitly local contracts.
export function particleForceImpulse(force,particle,from,to,seed=1){
 if(force?.inWorldSpace!==false||force.randomizePerFrame!==false||!Number.isSafeInteger(particle.id)||particle.id<0
  ||!Number.isFinite(particle.lifetime)||particle.lifetime<=0||!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<from||to>particle.lifetime+1e-10)
  throw Error('Unsupported native particle force impulse');
 return ['x','y','z'].map((axis,i)=>particle.lifetime*integrateParticleCurve(force[axis],from/particle.lifetime,to/particle.lifetime,particleRandom(particle.id,40+i,seed)));
}
