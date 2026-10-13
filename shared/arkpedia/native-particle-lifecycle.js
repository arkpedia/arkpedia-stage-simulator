// SPDX-License-Identifier: GPL-3.0-or-later
import {sampleParticleCurve,sampleParticleGradient} from './native-particle-curves.js';
import {createParticleBirthClock} from './native-particle-birth-clock.js';
import {particleRandom} from './native-particle-random.js';
export {particleRandom} from './native-particle-random.js';
import {createParticleCustomData} from './native-particle-custom-data.js';
import {createParticleStartRotation} from './native-particle-start-rotation.js';
import {createParticleAngularMotion} from './native-particle-angular-motion.js';

// Shared source emission clocks, capacity and lifetime/color/size sampling.
// Callers whitelist the active modules they actually implement. Event ordering
// and the deterministic preview random stream are not Unity RNG/frame parity.
export function createParticleLifecycle(source,{seed=1,modules=[],spaces=[0],allowInitialSpeed=false,allowDistanceEmission=false}={}){
  const initial=source.InitialModule,emission=source.EmissionModule;
  if(!initial?.enabled||!emission)throw new Error('Missing native particle initial/emission module');
  const supported=new Set(['InitialModule','EmissionModule','ColorModule','SizeModule','CustomDataModule','RotationModule',...modules]);
  for(const [name,module] of Object.entries(source))if(module?.enabled&&!supported.has(name))throw new Error(name+' lifecycle not playing');
  const constant=(curve,label)=>{
    if(curve.minMaxState!==0||!Number.isFinite(curve.scalar))throw new Error('Varying native '+label+' needs emission integration');
    return curve.scalar;
  };
  if(!spaces.includes(source.moveWithTransform)||source.ringBufferMode!==0)throw new Error('Nonlocal/ring-buffer particle lifecycle not playing');
  if((!allowInitialSpeed&&(![0,3].includes(initial.startSpeed.minMaxState)||sampleParticleCurve(initial.startSpeed,0,0)!==0||sampleParticleCurve(initial.startSpeed,0,1)!==0))||constant(initial.gravityModifier,'gravity')!==0)throw new Error('Moving particle lifecycle not playing');
  if(allowInitialSpeed)for(const time of [0,1])for(const factor of [0,1])sampleParticleCurve(initial.startSpeed,time,factor);
  const clock=createParticleBirthClock(source,{seed,allowDistanceEmission}),length=source.lengthInSec;
  if(![0,2].includes(initial.startColor.minMaxState))throw new Error('Initial gradient clock needs review');
  const startRotation=createParticleStartRotation(initial);
  const angularMotion=createParticleAngularMotion(source.RotationModule);
  const random=(id,salt)=>particleRandom(id,salt,seed);
  const customData=createParticleCustomData(source.CustomDataModule);
  function sample(time,{history}={}){
    return clock.sample(time,{history}).map(p=>{
      const phase=(p.born%length)/length,startSize=sampleParticleCurve(initial.startSize,phase,random(p.id,1));
      const size=initial.size3D?[startSize,sampleParticleCurve(initial.startSizeY,phase,random(p.id,2)),sampleParticleCurve(initial.startSizeZ,phase,random(p.id,3))]:[startSize,startSize,startSize];
      const rotation=startRotation.sample(phase,[random(p.id,32),random(p.id,33),random(p.id,4)]);
      const color=sampleParticleGradient(initial.startColor,phase,random(p.id,5)),age=p.age,t=age/p.lifetime;
      if(source.SizeModule?.enabled){
        const m=source.SizeModule;
        const factors=m.separateAxes?[m.curve,m.y,m.z].map((c,i)=>sampleParticleCurve(c,t,random(p.id,6+i))):Array(3).fill(sampleParticleCurve(m.curve,t,random(p.id,6)));
        size.forEach((v,i)=>size[i]=v*factors[i]);
      }
      if(source.ColorModule?.enabled){const factor=sampleParticleGradient(source.ColorModule.gradient,t,random(p.id,9));color.forEach((v,i)=>color[i]=v*factor[i]);}
      const {birthTime,...original}=p;
      return {...original,...rotation,age,size,color,...(angularMotion?angularMotion.sample({...original,...rotation,age},[random(p.id,35),random(p.id,36),random(p.id,37)]):{}),...(customData?{customData:customData.sample(age,p.lifetime,
        (stream,channel)=>random(p.id,24+stream*4+channel))}:{})};
    });
  }
  return {sample,births:clock.births};
}
