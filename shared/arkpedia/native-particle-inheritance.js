// SPDX-License-Identifier: GPL-3.0-or-later
import {sampleParticleCurve} from './native-particle-curves.js';
import {particleRandom} from './native-particle-lifecycle.js';

// Authored Initial/Current inheritance applied to explicit world velocity.
// Velocity acquisition and module ordering are local replay contracts, not
// recovered Unity frame dispatch. Rigidbody/custom/sub-emitter paths stay held.
export function createParticleInheritance(source,{seed=1}={}){
  const module=source.InheritVelocityModule;
  if(!module?.enabled)return null;
  if(![0,1].includes(module.m_Mode))throw Error('Native inherited velocity mode needs review');
  if(source.emitterVelocityMode!==0)throw Error('Native emitter velocity source needs review');
  if(source.SubModule?.enabled)throw Error('Native sub-emitter inheritance needs review');
  for(const t of [0,1])for(const factor of [0,1])sampleParticleCurve(module.m_Curve,t,factor);
  // Unity documents this module as having no effect in Local simulation space.
  if(source.moveWithTransform===0)return null;
  if(source.moveWithTransform!==1)throw Error('Native inherited velocity simulation space needs review');
  if(!Number.isFinite(source.simulationSpeed)||source.simulationSpeed<=0)throw Error('Invalid inherited velocity simulation speed');
  const mode=module.m_Mode,speed=source.simulationSpeed;
  return {sample(particle,time,velocityAt){
    if(typeof velocityAt!=='function')throw Error('Inherited velocity requires explicit world emitter velocity');
    if(!Number.isFinite(time)||!Number.isFinite(particle.age)||particle.age<0
      ||!Number.isFinite(particle.lifetime)||particle.lifetime<=0||!Number.isInteger(particle.id)||particle.id<0)
      throw Error('Invalid inherited velocity particle clock');
    const birth=time-particle.age/speed,factor=particleRandom(particle.id,34,seed);
    const read=t=>{
      const value=velocityAt(t);
      if(!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite))throw Error('Invalid inherited world emitter velocity');
      return value.slice();
    };
    const initial=mode===0?read(birth):null;
    return age=>{
      if(!Number.isFinite(age)||age<0||age>particle.lifetime+1e-10)throw Error('Invalid inherited velocity age');
      const velocity=initial??read(birth+age/speed),multiplier=sampleParticleCurve(module.m_Curve,age/particle.lifetime,factor);
      return velocity.map(v=>v*multiplier);
    };
  },scope:{localReplay:true,compiledFrameParity:false}};
}
