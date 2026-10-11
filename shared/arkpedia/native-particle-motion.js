// SPDX-License-Identifier: GPL-3.0-or-later
import {particleRandom} from './native-particle-lifecycle.js';
import {sampleParticleCurve} from './native-particle-curves.js';
import {createParticleNoise} from './native-particle-noise.js';

// Original magnitude-limit/high-quality noise controls with an explicit local
// 60 Hz replay. Native module ordering, damping timestep, field scroll axis and
// permutation tables remain unverified. Unsupported controls are never dropped.
export function createParticleMotion(source,{seed=1}={}){
  const clamp=source.ClampVelocityModule,noise=source.NoiseModule;
  if(!clamp?.enabled&&!noise?.enabled)return null;
  if(![0,1].includes(source.moveWithTransform)||source.VelocityModule?.enabled)throw Error('Native simulation space/linear velocity with particle turbulence needs review');
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
  function sample(particle,origin,initialVelocity){
    if(![origin,initialVelocity].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))
      ||!Number.isFinite(particle.born)||!Number.isFinite(particle.lifetime)||particle.lifetime<=0
      ||!Number.isInteger(particle.id)||particle.id<0)throw Error('Invalid native particle motion frame');
    const position=origin.slice();let velocity=initialVelocity.slice(),elapsed=0;
    if(!Number.isFinite(particle.age)||particle.age<0||particle.age/step>10000)throw Error('Native motion review clock exceeds step budget');
    while(elapsed<particle.age-1e-12){
      const dt=Math.min(step,particle.age-elapsed),normalized=(elapsed+dt)/particle.lifetime;
      const drift=flow(position,particle.born+elapsed,normalized,particle.id);
      const total=velocity.map((v,i)=>v+drift[i]);
      if(clamp?.enabled){
        const limit=sampleParticleCurve(clamp.magnitude,normalized,particleRandom(particle.id,19,seed));
        if(limit<0)throw Error('Invalid native particle speed limit');
        const speed=Math.hypot(...total),blend=1-(1-clamp.dampen)**(dt/step);
        if(speed>limit){const ratio=(speed-(speed-limit)*blend)/speed;total.forEach((v,i)=>total[i]=v*ratio);}
      }
      position.forEach((v,i)=>position[i]=v+total[i]*dt);
      // Re-evaluate the curl field each step; do not accumulate it as an
      // invented acceleration. The limited residual retains base momentum.
      velocity=total.map((v,i)=>v-drift[i]);elapsed+=dt;
    }
    return position.map((v,i)=>v-origin[i]);
  }
  return {sample,flow,step,scope:{localReplay:true,compiledFrameParity:false}};
}
