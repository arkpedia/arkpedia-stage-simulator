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
export function createParticleLifecycle(source,{seed=1,modules=[],spaces=[0],allowInitialSpeed=false,allowDistanceEmission=false,particleTrails=null,subEmitterSchedule=null}={}){
  const initial=source.InitialModule,emission=source.EmissionModule;
  if(!initial?.enabled||!emission)throw new Error('Missing native particle initial/emission module');
  const managedTrails=source.TrailModule?.enabled&&particleTrails?.ownsSource(source,seed)===true;
  const managedParent=source.SubModule?.enabled&&subEmitterSchedule?.ownsParent(source,seed)===true;
  const supported=new Set(['InitialModule','EmissionModule','ColorModule','SizeModule','CustomDataModule','RotationModule',...modules,...(managedTrails?['TrailModule']:[])]);
  for(const [name,module] of Object.entries(source))if(module?.enabled&&!supported.has(name))throw new Error(name+' lifecycle not playing');
  const constant=(curve,label)=>{
    if(curve.minMaxState!==0||!Number.isFinite(curve.scalar))throw new Error('Varying native '+label+' needs emission integration');
    return curve.scalar;
  };
  if(!spaces.includes(source.moveWithTransform)||source.ringBufferMode!==0)throw new Error('Nonlocal/ring-buffer particle lifecycle not playing');
  if((!allowInitialSpeed&&(![0,3].includes(initial.startSpeed.minMaxState)||sampleParticleCurve(initial.startSpeed,0,0)!==0||sampleParticleCurve(initial.startSpeed,0,1)!==0))||constant(initial.gravityModifier,'gravity')!==0)throw new Error('Moving particle lifecycle not playing');
  if(allowInitialSpeed)for(const time of [0,1])for(const factor of [0,1])sampleParticleCurve(initial.startSpeed,time,factor);
  const clock=createParticleBirthClock(source,{seed,allowDistanceEmission}),length=source.lengthInSec;
  // RandomColor samples one immutable per-particle factor, not an emitter or
  // lifetime clock. Time-varying birth Gradient/TwoGradients remain held.
  if(![0,2,4].includes(initial.startColor.minMaxState))throw new Error('Initial gradient clock needs review');
  for(const factor of [0,1])sampleParticleGradient(initial.startColor,0,factor);
  const startRotation=createParticleStartRotation(initial);
  const angularMotion=createParticleAngularMotion(source.RotationModule);
  const random=(id,salt)=>particleRandom(id,salt,seed);
  const customData=createParticleCustomData(source.CustomDataModule);
  function sampleRecords(records,{scheduled=false,time,trailHistory=false,parentHistory=false}={}){
    if(!Array.isArray(records)||records.length>100000||typeof scheduled!=='boolean')throw Error('Invalid native particle birth records');
    const prewarmHistory=(trailHistory&&managedTrails||parentHistory&&managedParent)
      &&source.prewarm&&source.looping;
    const minimum=prewarmHistory?(source.startDelay.scalar-source.lengthInSec)/source.simulationSpeed:0;
    if(scheduled&&(!Number.isFinite(time)||time<minimum-(prewarmHistory?1e-10:0)||records.length>initial.maxNumParticles))throw Error('Invalid native scheduled particle clock/capacity');
    const ids=new Set();
    return records.map(p=>{
      if(!Number.isSafeInteger(p?.id)||p.id<0||ids.has(p.id)||!Number.isFinite(p.born)||p.born<0
        ||!Number.isFinite(p.lifetime)||p.lifetime<=0||!Number.isFinite(p.age)||(scheduled?p.age<0:p.age<-1e-10)||p.age>=p.lifetime)
        throw Error('Invalid native particle birth record');
      ids.add(p.id);
      if(scheduled){
        if(!Number.isFinite(time)||!Number.isFinite(p.birthTime)||p.birthTime>time+1e-10
          ||Math.abs(p.age-Math.max(0,(time-p.birthTime)*source.simulationSpeed))>1e-8)
          throw Error('Invalid native scheduled particle clock');
      }
      const phase=(p.born%length)/length,startSize=sampleParticleCurve(initial.startSize,phase,random(p.id,1));
      if(scheduled&&Math.abs(p.lifetime-sampleParticleCurve(initial.startLifetime,phase,random(p.id,0)))>1e-8)
        throw Error('Scheduled particle lifetime differs from authored source');
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
      return {...original,...(scheduled?{birthTime}:{}),...rotation,age,size,color,...(angularMotion?angularMotion.sample({...original,...rotation,age},[random(p.id,35),random(p.id,36),random(p.id,37)]):{}),...(customData?{customData:customData.sample(age,p.lifetime,
        (stream,channel)=>random(p.id,24+stream*4+channel))}:{})};
    });
  }
  function sample(time,{history}={}){return sampleRecords(clock.sample(time,{history}));}
  // External schedulers own emission windows/capacity admission. `born` keeps
  // the child-local phase; `birthTime` and `time` are real effect seconds.
  return {sample,births:clock.births,cohort:clock.cohort,sampleRecords(records,time){return sampleRecords(records,{scheduled:true,time});},
    sampleTrailRecords(records,time,owner){if(!managedTrails||owner!==particleTrails||!owner.ownsSource(source,seed))throw Error('Particle trail history requires its source owner');return sampleRecords(records,{scheduled:true,time,trailHistory:true});},
    withParentHistory(owner,callback){
      if(!managedParent||owner!==subEmitterSchedule||!owner.ownsParent(source,seed)
        ||!source.prewarm||!source.looping||source.startDelay.minMaxState!==0||source.startDelay.scalar!==0
        ||typeof callback!=='function')throw Error('Prewarm parent history requires its source scheduler');
      let active=true;
      try{
        const result=callback((records,time)=>{
          if(!active)throw Error('Prewarm parent history scope has ended');
          return sampleRecords(records,{scheduled:true,time,parentHistory:true});
        });
        if(result?.then)throw Error('Prewarm parent history must be synchronous');
        return result;
      }finally{active=false;}
    },
    withTrailHistory(owner,callback){
      if(!managedTrails||owner!==particleTrails||!owner.ownsSource(source,seed)||typeof callback!=='function')throw Error('Particle trail history requires its source owner');
      let active=true;try{const result=callback((records,time)=>{if(!active)throw Error('Particle trail history scope has ended');return sampleRecords(records,{scheduled:true,time,trailHistory:true});});if(result?.then)throw Error('Particle trail history must be synchronous');return result;}finally{active=false;}
    }};
}
