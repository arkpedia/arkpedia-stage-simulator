// SPDX-License-Identifier: GPL-3.0-or-later
import {integrateParticleCurve} from './native-particle-curves.js';

// Authored angular velocity is radians per simulated second. Integrate each
// active curve over normalized age, then add the original birth angle. This is
// a local Euler replay, not compiled Unity frame or random-order parity.
export function createParticleAngularMotion(module){
  if(!module?.enabled)return null;
  if(typeof module.separateAxes!=='boolean')throw Error('Invalid native angular motion axes');
  const curves=module.separateAxes?[module.x,module.y,module.curve]:[module.curve];
  for(const curve of curves)for(const factor of [0,1])integrateParticleCurve(curve,0,1,factor);
  return {sample(particle,factors){
    if(!Number.isFinite(particle.age)||particle.age<0||!Number.isFinite(particle.lifetime)||particle.lifetime<=0
      ||particle.age>particle.lifetime+1e-10||!Number.isFinite(particle.rotation)
      ||!Array.isArray(factors)||factors.length!==3||factors.some(v=>!Number.isFinite(v)||v<0||v>1))
      throw Error('Invalid native angular motion sample');
    const base=particle.rotation3D??[0,0,particle.rotation];
    if(!Array.isArray(base)||base.length!==3||!base.every(Number.isFinite))throw Error('Invalid native angular birth rotation');
    const to=particle.age/particle.lifetime,delta=(curve,axis)=>particle.lifetime*integrateParticleCurve(curve,0,to,factors[axis]);
    const rotation=particle.rotation+delta(module.curve,2);
    return {rotation,...(particle.rotation3D||module.separateAxes?{rotation3D:[
      base[0]+(module.separateAxes?delta(module.x,0):0),
      base[1]+(module.separateAxes?delta(module.y,1):0),rotation]}:{})};
  }};
}
