// SPDX-License-Identifier: GPL-3.0-or-later
import {sampleParticleCurve} from './native-particle-curves.js';
import {createEffectTrajectory} from './native-effect-trail.js';
import {particleRandom} from './native-particle-random.js';

// Emission clocks/capacity only: no claim that other active particle modules or
// renderer features play. Accepted births remain available after parent expiry.
export function createParticleBirthClock(source,{seed=1,allowDistanceEmission=false}={}){
  const initial=source.InitialModule,emission=source.EmissionModule;
  if(!initial?.enabled||!emission)throw Error('Missing native particle initial/emission module');
  if(source.ringBufferMode!==0)throw Error('Native ring-buffer birth scheduling needs review');
  const constant=(curve,label)=>{
    if(curve.minMaxState!==0||!Number.isFinite(curve.scalar))throw Error('Varying native '+label+' needs emission integration');
    return curve.scalar;
  };
  const delay=constant(source.startDelay,'start delay'),rate=constant(emission.rateOverTime,'emission rate');
  const distanceRate=constant(emission.rateOverDistance,'distance rate');
  if(distanceRate!==0&&(!allowDistanceEmission||source.moveWithTransform!==1))throw Error('Distance emission requires world-position history');
  const length=source.lengthInSec,speed=source.simulationSpeed,capacity=initial.maxNumParticles;
  if(!Number.isFinite(delay)||delay<0||!Number.isFinite(length)||length<=0||!Number.isFinite(speed)||speed<=0||!Number.isInteger(capacity)||capacity<1||rate<0||distanceRate<0||!Number.isSafeInteger(seed))throw Error('Invalid native particle clocks/capacity');
  if(emission.m_BurstCount!==emission.m_Bursts.length)throw Error('Incomplete native particle bursts');
  for(const burst of emission.m_Bursts){
    if(!Number.isFinite(burst.time)||burst.time<0||burst.time>=length||!Number.isInteger(burst.cycleCount)||burst.cycleCount<1||!Number.isFinite(burst.repeatInterval)||burst.repeatInterval<=0||burst.probability!==1)throw Error('Native probabilistic/indefinite burst needs review');
  }
  const random=(id,salt)=>particleRandom(id,salt,seed);
  function events(time,{history,optimizeCapacityOne=false,triggered=false,emissionUntil=null}={}){
    if(!Number.isFinite(time)||typeof optimizeCapacityOne!=='boolean'||typeof triggered!=='boolean')throw Error('Invalid native particle birth clock');
    if(emissionUntil!==null&&(!Number.isFinite(emissionUntil)||emissionUntil<0))throw Error('Invalid explicit particle emission cutoff');
    if(distanceRate>0&&!history)throw Error('Distance emission requires world-position history');
    const trajectory=distanceRate>0?createEffectTrajectory(history):null;
    // Half-open real effect seconds. A stopped emitter still exposes the
    // original accepted births; the caller samples their age at its live time.
    // Prewarm becomes visible at the delayed start, never after an earlier stop.
    if(emissionUntil!==null&&emissionUntil<=delay/speed)return [];
    time=emissionUntil===null?time:Math.min(time,emissionUntil);
    const sinceStart=time*speed-delay;
    if(sinceStart<0||!emission.enabled||(!triggered&&!source.playOnAwake))return [];
    const elapsed=sinceStart+(source.prewarm&&source.looping?length:0);
    const events=[],end=source.looping?elapsed:Math.min(elapsed,length);
    if(rate>0){
      const count=Math.floor(end*rate+1e-10);
      if(!Number.isSafeInteger(count))throw new Error('Particle review clock exceeds integer precision');
      if(optimizeCapacityOne&&distanceRate===0&&capacity===1&&emission.m_BurstCount===0&&initial.startLifetime.minMaxState===0){
        // The native head emits at 1000/s but can hold only one five-second
        // particle. Skip rejected emission attempts arithmetically; retain the
        // same birth tick and preview random identity as the general scheduler.
        const lifetime=constant(initial.startLifetime,'lifetime');
        if(lifetime<=0)throw new Error('Invalid native particle lifetime');
        const gap=Math.max(1,Math.ceil(lifetime*rate-1e-10));
        const lastTick=source.looping?count:Math.min(count,Math.ceil(length*rate)-1);
        if(lastTick>0){const tick=1+Math.floor((lastTick-1)/gap)*gap;events.push({born:tick/rate,count:1,firstId:tick-1});}
      }else{
        if(count>100000)throw new Error('Particle review clock exceeds event budget');
        for(let i=1;i<=count;i++){const born=i/rate;if(source.looping||born<length)events.push({born,count:1});}
      }
    }
    if(trajectory){
      const prewarm=source.prewarm&&source.looping?length:0,start=delay/speed;
      const stop=source.looping?time:Math.min(time,(length+delay)/speed);
      const times=trajectory.times(stop).filter(t=>t>start);times.unshift(start);
      let travelled=0,next=1;
      for(let i=1;i<times.length;i++){
        const a=times[i-1],b=times[i],from=trajectory.sample(a),to=trajectory.sample(b);
        const span=Math.hypot(...to.map((v,k)=>v-from[k]));
        const count=Math.floor((travelled+span)*distanceRate+1e-10);
        if(count>100000)throw new Error('Particle review clock exceeds distance event budget');
        for(;next<=count;next++){
          const u=Math.max(0,Math.min(1,(next/distanceRate-travelled)/span));
          const born=(a+(b-a)*u)*speed-delay+prewarm;
          if(source.looping||born<length)events.push({born,count:1});
        }
        travelled+=span;
      }
    }
    const loops=source.looping?Math.floor(elapsed/length)+1:1;
    if(loops>10000)throw new Error('Particle review clock exceeds loop budget');
    for(let cycle=0;cycle<loops;cycle++)for(const burst of emission.m_Bursts)for(let repeat=0;repeat<burst.cycleCount;repeat++){
      const local=burst.time+repeat*burst.repeatInterval,born=cycle*length+local;
      if(local>=length||born>elapsed)continue;
      const n=Math.floor(sampleParticleCurve(burst.countCurve,local/length,random(cycle,repeat)));
      if(n<0||n>100000)throw new Error('Invalid native burst count');
      events.push({born,count:n});
    }
    events.sort((a,b)=>a.born-b.born);
    const prewarm=source.prewarm&&source.looping?length:0;
    return emissionUntil===null?events:events.filter(e=>(e.born+delay-prewarm)/speed<emissionUntil);
  }
  function sample(time,{history,includeExpired=false,emissionUntil=null}={}){
    if(typeof includeExpired!=='boolean')throw Error('Invalid native accepted birth mode');
    const scheduled=events(time,{history,optimizeCapacityOne:!includeExpired,emissionUntil});
    const elapsed=time*speed-delay+(source.prewarm&&source.looping?length:0);
    let alive=[],accepted=[],id=0,total=0;
    for(const event of scheduled){
      if(event.firstId!==undefined)id=event.firstId;
      total+=event.count;if(total>100000)throw new Error('Particle review clock exceeds event budget');
      alive=alive.filter(p=>p.born+p.lifetime>event.born+1e-10);
      for(let i=0;i<event.count;i++,id++){
        if(alive.length>=capacity)continue;
        const phase=(event.born%length)/length,lifetime=sampleParticleCurve(initial.startLifetime,phase,random(id,0));
        if(!Number.isFinite(lifetime)||lifetime<=0)throw new Error('Invalid native particle lifetime');
        const particle={id,born:event.born,lifetime};alive.push(particle);accepted.push(particle);
      }
    }
    const particles=includeExpired?accepted:alive.filter(p=>p.born+p.lifetime>elapsed+1e-10);
    const prewarm=source.prewarm&&source.looping?length:0;
    return particles.map(p=>({...p,age:elapsed-p.born,birthTime:(p.born+delay-prewarm)/speed}));
  }
  function cohort(p){
    if(!Number.isSafeInteger(p?.id)||p.id<0||!Number.isFinite(p.born)||p.born<0||!Number.isFinite(p.lifetime)||p.lifetime<=0)
      throw Error('Invalid native particle cohort identity');
    // Source-local emission attempt IDs include attempts rejected at capacity.
    // Resolve membership at birth, never from the currently surviving set.
    // Prewarm is first exposed at the delayed start. A tiny lookup-only guard
    // avoids losing an exact source event in a floating clock round-trip.
    const time=Math.max(delay/speed,(p.born+delay-(source.prewarm&&source.looping?length:0))/speed)+1e-10/speed,
      accepted=sample(time,{includeExpired:true}).find(b=>b.id===p.id);
    if(!accepted||Math.abs(accepted.born-p.born)>1e-9||Math.abs(accepted.lifetime-p.lifetime)>1e-9)
      throw Error('Particle cohort is outside the original birth clock');
    let first=0;
    for(const event of events(time)){
      if(event.firstId!==undefined)first=event.firstId;
      if(p.id>=first&&p.id<first+event.count)return {born:event.born,index:p.id-first,count:event.count};
      first+=event.count;
    }
    throw Error('Missing original particle cohort');
  }
  return {sample,cohort,events(time,options){return events(time,options);},births(time,options){return sample(time,{...options,includeExpired:true}).map(p=>({...p,age:0}));},
    scope:{birthClocksOnly:true,compiledFrameParity:false}};
}
