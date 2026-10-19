// SPDX-License-Identifier: GPL-3.0-or-later
import {integrateParticleCurve,sampleParticleCurve} from './native-particle-curves.js';
import {particleRandom} from './native-particle-random.js';

// Original lifetime velocity in the module's own axes. An interval average
// preserves the exact supported Hermite displacement before replay damping.
// Space conversion and native module ordering are separate owner contracts.
export function createParticleLinearVelocity(source,{seed=1}={}){
  const module=source.VelocityModule;
  if(!module?.enabled)return null;
  if(!Number.isSafeInteger(seed))throw Error('Invalid native linear velocity seed');
  if(typeof module.inWorldSpace!=='boolean')throw Error('Invalid native velocity space');
  for(const field of ['orbitalX','orbitalY','orbitalZ','orbitalOffsetX','orbitalOffsetY','orbitalOffsetZ','radial']){
    if(module[field]?.minMaxState!==0||module[field].scalar!==0)throw Error('Native orbital/radial velocity needs review');
  }
  if(module.speedModifier?.minMaxState!==0||module.speedModifier.scalar!==1)throw Error('Native particle speed multiplier needs review');
  for(const axis of ['x','y','z'])for(const factor of [0,1])integrateParticleCurve(module[axis],0,1,factor);
  return {inWorldSpace:module.inWorldSpace,average(particle,from,to){
    if(!Number.isSafeInteger(particle.id)||particle.id<0||!Number.isFinite(particle.lifetime)||particle.lifetime<=0
      ||!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<from||to>particle.lifetime+1e-10)
      throw Error('Invalid native linear velocity interval');
    return ['x','y','z'].map((axis,i)=>{
      const factor=particleRandom(particle.id,13+i,seed);
      if([0,3].includes(module[axis].minMaxState))return sampleParticleCurve(module[axis],0,factor);
      return to===from?sampleParticleCurve(module[axis],from/particle.lifetime,factor):
        particle.lifetime*integrateParticleCurve(module[axis],from/particle.lifetime,to/particle.lifetime,factor)/(to-from);
    });
  }};
}
