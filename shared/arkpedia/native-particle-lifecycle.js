// SPDX-License-Identifier: GPL-3.0-or-later
import {sampleParticleCurve,sampleParticleGradient} from './native-particle-curves.js';

// Shared source emission clocks, capacity and lifetime/color/size sampling.
// Callers whitelist the active modules they actually implement. Event ordering
// and the deterministic preview random stream are not Unity RNG/frame parity.
export function createParticleLifecycle(source,{seed=1,modules=[],spaces=[0]}={}){
  const initial=source.InitialModule,emission=source.EmissionModule;
  if(!initial?.enabled||!emission)throw new Error('Missing native particle initial/emission module');
  const supported=new Set(['InitialModule','EmissionModule','ColorModule','SizeModule',...modules]);
  for(const [name,module] of Object.entries(source))if(module?.enabled&&!supported.has(name))throw new Error(name+' lifecycle not playing');
  const constant=(curve,label)=>{
    if(curve.minMaxState!==0||!Number.isFinite(curve.scalar))throw new Error('Varying native '+label+' needs emission integration');
    return curve.scalar;
  };
  if(!spaces.includes(source.moveWithTransform)||source.ringBufferMode!==0)throw new Error('Nonlocal/ring-buffer particle lifecycle not playing');
  if(![0,3].includes(initial.startSpeed.minMaxState)||sampleParticleCurve(initial.startSpeed,0,0)!==0||sampleParticleCurve(initial.startSpeed,0,1)!==0||constant(initial.gravityModifier,'gravity')!==0)throw new Error('Moving particle lifecycle not playing');
  const delay=constant(source.startDelay,'start delay'),rate=constant(emission.rateOverTime,'emission rate');
  if(constant(emission.rateOverDistance,'distance rate')!==0)throw new Error('Distance emission not playing');
  const length=source.lengthInSec,speed=source.simulationSpeed,capacity=initial.maxNumParticles;
  if(!Number.isFinite(delay)||delay<0||!Number.isFinite(length)||length<=0||!Number.isFinite(speed)||speed<=0||!Number.isInteger(capacity)||capacity<1||rate<0||!Number.isSafeInteger(seed))throw new Error('Invalid native particle clocks/capacity');
  if(![0,2].includes(initial.startColor.minMaxState))throw new Error('Initial gradient clock needs review');
  if(initial.rotation3D||initial.randomizeRotationDirection!==0)throw new Error('3D/randomized rotation not playing');
  if(emission.m_BurstCount!==emission.m_Bursts.length)throw new Error('Incomplete native particle bursts');
  for(const burst of emission.m_Bursts){
    if(!Number.isFinite(burst.time)||burst.time<0||burst.time>=length||!Number.isInteger(burst.cycleCount)||burst.cycleCount<1||!Number.isFinite(burst.repeatInterval)||burst.repeatInterval<=0||burst.probability!==1)throw new Error('Native probabilistic/indefinite burst needs review');
  }
  const random=(id,salt)=>particleRandom(id,salt,seed);
  function sample(time){
    if(!Number.isFinite(time))throw new Error('Invalid native particle sample clock');
    const sinceStart=time*speed-delay;
    if(sinceStart<0||!emission.enabled||!source.playOnAwake)return [];
    const elapsed=sinceStart+(source.prewarm&&source.looping?length:0);
    const events=[],end=source.looping?elapsed:Math.min(elapsed,length);
    if(rate>0){
      const count=Math.floor(end*rate+1e-10);
      if(!Number.isSafeInteger(count))throw new Error('Particle review clock exceeds integer precision');
      if(capacity===1&&emission.m_BurstCount===0&&initial.startLifetime.minMaxState===0){
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
    let alive=[],id=0,total=0;
    for(const event of events){
      if(event.firstId!==undefined)id=event.firstId;
      total+=event.count;if(total>100000)throw new Error('Particle review clock exceeds event budget');
      alive=alive.filter(p=>p.born+p.lifetime>event.born+1e-10);
      for(let i=0;i<event.count;i++,id++){
        if(alive.length>=capacity)continue;
        const phase=(event.born%length)/length,lifetime=sampleParticleCurve(initial.startLifetime,phase,random(id,0));
        if(!Number.isFinite(lifetime)||lifetime<=0)throw new Error('Invalid native particle lifetime');
        const size=sampleParticleCurve(initial.startSize,phase,random(id,1));
        alive.push({id,born:event.born,lifetime,
          size:initial.size3D?[size,sampleParticleCurve(initial.startSizeY,phase,random(id,2)),sampleParticleCurve(initial.startSizeZ,phase,random(id,3))]:[size,size,size],
          rotation:sampleParticleCurve(initial.startRotation,phase,random(id,4)),color:sampleParticleGradient(initial.startColor,phase,random(id,5))});
      }
    }
    return alive.filter(p=>p.born+p.lifetime>elapsed+1e-10).map(p=>{
      const age=elapsed-p.born,t=age/p.lifetime,size=p.size.slice(),color=p.color.slice();
      if(source.SizeModule?.enabled){
        const m=source.SizeModule;
        const factors=m.separateAxes?[m.curve,m.y,m.z].map((c,i)=>sampleParticleCurve(c,t,random(p.id,6+i))):Array(3).fill(sampleParticleCurve(m.curve,t,random(p.id,6)));
        size.forEach((v,i)=>size[i]=v*factors[i]);
      }
      if(source.ColorModule?.enabled){const factor=sampleParticleGradient(source.ColorModule.gradient,t,random(p.id,9));color.forEach((v,i)=>color[i]=v*factor[i]);}
      return {...p,age,size,color};
    });
  }
  return {sample};
}

// Stable per-particle factors; modules use separate salts and retain factors
// across lifetime samples. This deliberately does not claim Unity RNG parity.
export function particleRandom(id,salt,seed=1){
  let x=Math.imul((id+1)^seed,0x45d9f3b)^Math.imul(salt+1,0x27d4eb2d);
  x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/0x100000000;
}
