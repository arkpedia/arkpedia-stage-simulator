// SPDX-License-Identifier: GPL-3.0-or-later
import {particleRandom} from './native-particle-lifecycle.js';
import {sampleParticleCurve,integrateParticleCurve} from './native-particle-curves.js';
import {createParticleNoise} from './native-particle-noise.js';
import {particleForceImpulse} from './native-particle-force.js';
import {createParticleLinearVelocity} from './native-particle-linear-velocity.js';

// Original magnitude-limit/high-quality noise controls with an explicit local
// 60 Hz replay. Native module ordering, damping timestep, field scroll axis and
// permutation tables remain unverified. Unsupported controls are never dropped.
export function createParticleMotion(source,{seed=1}={}){
  const clamp=source.ClampVelocityModule,noise=source.NoiseModule,force=source.ForceModule;
  const inherited=!!source.InheritVelocityModule?.enabled&&source.moveWithTransform===1;
  const linear=createParticleLinearVelocity(source,{seed});
  if(!clamp?.enabled&&!noise?.enabled&&!inherited&&!force?.enabled&&!(linear&&(source.moveWithTransform===1||linear.inWorldSpace)))return null;
  if(![0,1].includes(source.moveWithTransform))throw Error('Native simulation space with particle turbulence needs review');
  const crossLinearFrame=!!linear&&(source.moveWithTransform===1?!linear.inWorldSpace:linear.inWorldSpace);
  if(force?.enabled){
    if(force.inWorldSpace!==false||force.randomizePerFrame!==false||source.moveWithTransform!==0)throw Error('Native force space/per-frame randomness needs review');
    for(const axis of['x','y','z'])for(const factor of[0,1])integrateParticleCurve(force[axis],0,1,factor);
  }
  if(clamp?.enabled){
    if(clamp.separateAxis||clamp.drag?.minMaxState!==0||clamp.drag.scalar!==0)throw Error('Native axis limit/drag needs review');
    if(!Number.isFinite(clamp.dampen)||clamp.dampen<0||clamp.dampen>1)throw Error('Invalid native particle dampen');
    sampleParticleCurve(clamp.magnitude,0);sampleParticleCurve(clamp.magnitude,1);
  }
  let field;
  if(noise?.enabled){
    if(noise.quality!==2||noise.separateAxes||noise.remapEnabled||noise.rotationAmount?.minMaxState!==0||noise.rotationAmount.scalar!==0||noise.sizeAmount?.minMaxState!==0||noise.sizeAmount.scalar!==0)throw Error('Native noise quality/axes/remap/rotation/size needs review');
    if(!Number.isInteger(noise.octaves)||noise.octaves<1||noise.octaves>8||!Number.isFinite(noise.frequency)||noise.frequency<=0||!Number.isFinite(noise.octaveMultiplier)||noise.octaveMultiplier<0||!Number.isFinite(noise.octaveScale)||noise.octaveScale<=0||typeof noise.damping!=='boolean')throw Error('Invalid native particle noise frequency/octaves');
    if(noise.scrollSpeed?.minMaxState!==0)throw Error('Varying native noise scroll needs integration');
    for(const curve of [noise.strength,noise.positionAmount,noise.scrollSpeed]){sampleParticleCurve(curve,0);sampleParticleCurve(curve,1);}
    field=createParticleNoise(seed);
  }
  const step=1/60;
  function flow(position,time,normalized,id){
    if(!field)return [0,0,0];
    const factor=particleRandom(id,20,seed),strength=sampleParticleCurve(noise.strength,normalized,factor)*sampleParticleCurve(noise.positionAmount,normalized,particleRandom(id,21,seed));
    const scroll=sampleParticleCurve(noise.scrollSpeed,0)*time,result=[0,0,0];let frequency=noise.frequency,amplitude=1;
    for(let octave=0;octave<noise.octaves;octave++){
      // Local inspection scroll is along field Z; the native axis/phase is not
      // exposed by the prefab. Frequency damping follows the documented units.
      const value=field.curl(position.map((v,i)=>v*frequency+(i===2?scroll:0)));
      const weight=strength*amplitude/(noise.damping?frequency:1);
      for(let i=0;i<3;i++)result[i]+=value[i]*weight;
      frequency*=noise.octaveScale;amplitude*=noise.octaveMultiplier;
    }
    return result;
  }
  function sample(particle,origin,initialVelocity,{inheritedVelocityAt,inheritanceMode=0,linearVelocityTransform}={}){
    if(![origin,initialVelocity].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))
      ||!Number.isFinite(particle.born)||!Number.isFinite(particle.lifetime)||particle.lifetime<=0
      ||!Number.isInteger(particle.id)||particle.id<0)throw Error('Invalid native particle motion frame');
    const position=origin.slice();let velocity=initialVelocity.slice(),elapsed=0;
    if(inheritedVelocityAt&&(typeof inheritedVelocityAt!=='function'||![0,1].includes(inheritanceMode)))throw Error('Invalid inherited particle motion mode');
    if(crossLinearFrame&&typeof linearVelocityTransform!=='function')throw Error('Linear particle velocity requires an explicit simulation frame');
    let inheritedAttenuation=1;
    if(!Number.isFinite(particle.age)||particle.age<0||particle.age/step>10000)throw Error('Native motion review clock exceeds step budget');
    while(elapsed<particle.age-1e-12){
      const dt=Math.min(step,particle.age-elapsed),normalized=(elapsed+dt)/particle.lifetime;
      // Local interpretation: integrate authored acceleration before damping.
      // Curve velocity increments are exact; position still uses the existing
      // bounded 60 Hz semi-implicit replay, not Unity native ordering/parity.
      if(force?.enabled)particleForceImpulse(force,particle,elapsed,elapsed+dt,seed).forEach((v,i)=>velocity[i]+=v);
      const inherited=inheritedVelocityAt?.(elapsed+dt)??[0,0,0];
      if(!Array.isArray(inherited)||inherited.length!==3||!inherited.every(Number.isFinite))throw Error('Invalid inherited particle motion velocity');
      // Initial momentum retains its accumulated attenuation. Current motion
      // follows the emitter afresh; stopping must not subtract an undamped old
      // velocity from already-limited momentum and send the particle backward.
      const inheritedDrift=inherited.map(v=>v*(inheritanceMode===0?inheritedAttenuation:1));
      const drift=flow(position,particle.born+elapsed,normalized,particle.id);
      const total=velocity.map((v,i)=>v+drift[i]+inheritedDrift[i]);let ratio=1;
      let linearDrift;
      if(linear){
        linearDrift=linear.average(particle,elapsed,elapsed+dt);
        if(crossLinearFrame)linearDrift=linearVelocityTransform(linearDrift,elapsed+dt);
        if(!Array.isArray(linearDrift)||linearDrift.length!==3||!linearDrift.every(Number.isFinite))throw Error('Invalid transformed linear particle velocity');
        total.forEach((v,i)=>total[i]=v+linearDrift[i]);
      }
      if(clamp?.enabled){
        const limit=sampleParticleCurve(clamp.magnitude,normalized,particleRandom(particle.id,19,seed));
        if(limit<0)throw Error('Invalid native particle speed limit');
        const speed=Math.hypot(...total),blend=1-(1-clamp.dampen)**(dt/step);
        if(speed>limit){ratio=(speed-(speed-limit)*blend)/speed;total.forEach((v,i)=>total[i]=v*ratio);}
      }
      position.forEach((v,i)=>position[i]=v+total[i]*dt);
      // Re-evaluate the curl field each step; do not accumulate it as an
      // invented acceleration. The limited residual retains base momentum.
      velocity=total.map((v,i)=>v-drift[i]-inheritedDrift[i]*ratio);
      // The lifetime module is a velocity contribution, not acceleration.
      // Retain the limited residual for the next existing replay tick rather
      // than adding the authored lifetime velocity to momentum repeatedly.
      if(linear)velocity=velocity.map((v,i)=>v-linearDrift[i]);
      if(inheritanceMode===0)inheritedAttenuation*=ratio;
      elapsed+=dt;
    }
    return position.map((v,i)=>v-origin[i]);
  }
  return {sample,flow,step,scope:{localReplay:true,compiledFrameParity:false}};
}
