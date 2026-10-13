// SPDX-License-Identifier: GPL-3.0-or-later
import {createParticleBirthClock} from './native-particle-birth-clock.js';
import {createSubEmitterGraph} from './native-sub-emitter-graph.js';
import {sampleParticleCurve} from './native-particle-curves.js';
import {particleRandom} from './native-particle-random.js';

// Local Birth-emission windows follow accepted parent lifetimes. All attempts
// for a shared child system merge before its capacity/lifetime admission. This
// schedules particles only; parent motion, transforms, inheritance and renderer
// dispatch still need integration. Native event timing/RNG parity is unverified.
export function createChildEmissionSchedule(pack,{seed=1}={}){
  if(!Number.isSafeInteger(seed))throw Error('Invalid native child emission seed');
  const graph=createSubEmitterGraph(pack),parents=new Map(),children=new Map(),owned=new Map();
  for(const[id,r]of Object.entries(pack.records))if(r.type==='ParticleSystem'&&r.data.SubModule?.enabled){
    const links=graph.links(id);
    if(links.some(r=>r.type!==0||r.properties!==0||r.emitProbability!==1))throw Error('Native child event/inheritance/probability needs dispatch');
    parents.set(id,createParticleBirthClock(r.data,{seed}));
    owned.set(r.data,JSON.stringify({module:r.data.SubModule,links}));
    for(const link of links)if(!children.has(link.child)){
      const source=pack.records[link.child].data;
      if(source.SubModule?.enabled)throw Error('Nested native child emission needs dispatch');
      if(source.prewarm&&source.looping)throw Error('Native child prewarm requires a parent-motion contract');
      if(source.EmissionModule.rateOverDistance.scalar!==0)throw Error('Native child distance emission requires parent-motion history');
      for(const phase of [0,1])for(const factor of [0,1])sampleParticleCurve(source.InitialModule.startLifetime,phase,factor);
      children.set(link.child,{source,clock:createParticleBirthClock(source,{seed})});
    }
  }
  function triggersAt(time){
    if(!Number.isFinite(time))throw Error('Invalid native child emission clock');
    return [...parents].flatMap(([id,clock])=>graph.triggers(id,clock.births(time)));
  }
  function sample(child,time,{triggers=triggersAt(time),includeExpired=false}={}){
    if(!children.has(child)||!Number.isFinite(time)||typeof includeExpired!=='boolean'||!Array.isArray(triggers)||triggers.length>100000)
      throw Error('Invalid native child emission sample');
    const {source,clock}=children.get(child),speed=source.simulationSpeed,delay=source.startDelay.scalar;
    const attempts=[],seen=new Set();let scheduledCount=0;
    for(const trigger of triggers){
      const row=graph.links(trigger.parent).find(r=>r.slot===trigger.slot);
      if(!row||row.child!==trigger.child||row.type!==trigger.type||row.properties!==trigger.properties||row.emitProbability!==trigger.emitProbability
        ||!Number.isSafeInteger(trigger.particle)||trigger.particle<0||!Number.isFinite(trigger.time)||!Number.isFinite(trigger.parentDeathTime)
        ||trigger.parentDeathTime<=trigger.time)throw Error('Invalid native child birth trigger');
      const key=JSON.stringify([trigger.parent,trigger.particle,trigger.slot]);
      if(seen.has(key))throw Error('Duplicate native child birth trigger');seen.add(key);
      if(trigger.child!==child||trigger.time>time)continue;
      const elapsed=Math.min(time,trigger.parentDeathTime)-trigger.time;
      for(const[eventIndex,event]of clock.events(elapsed,{triggered:true}).entries()){
        const birthTime=trigger.time+(event.born+delay)/speed;
        // This local ordering expires the parent before emitting at its exact
        // death boundary. Child particles already born keep their own lifetime.
        if(birthTime>=trigger.parentDeathTime-1e-10||birthTime>time+1e-10)continue;
        scheduledCount+=event.count;
        if(scheduledCount>100000||attempts.length>=100000)throw Error('Native child emission exceeds event budget');
        attempts.push({eventIndex,...event,birthTime,trigger});
      }
    }
    const compare=(a,b)=>a<b?-1:a>b?1:0;
    attempts.sort((a,b)=>a.birthTime-b.birthTime||compare(a.trigger.parent,b.trigger.parent)
      ||a.trigger.particle-b.trigger.particle||a.trigger.slot-b.trigger.slot||a.eventIndex-b.eventIndex);
    let live=[],accepted=[],id=0,total=0;
    for(const event of attempts){
      total+=event.count;if(total>100000)throw Error('Native child emission exceeds event budget');
      live=live.filter(p=>(event.birthTime-p.birthTime)*speed<p.lifetime-1e-10);
      for(let index=0;index<event.count;index++,id++){
        if(live.length>=source.InitialModule.maxNumParticles)continue;
        const phase=(event.born%source.lengthInSec)/source.lengthInSec;
        const lifetime=sampleParticleCurve(source.InitialModule.startLifetime,phase,particleRandom(id,0,seed));
        if(!Number.isFinite(lifetime)||lifetime<=0)throw Error('Invalid native child particle lifetime');
        const particle={id,born:event.born,lifetime,birthTime:event.birthTime,parent:event.trigger.parent,
          parentParticle:event.trigger.particle,slot:event.trigger.slot,parentBirthTime:event.trigger.time,parentDeathTime:event.trigger.parentDeathTime};
        live.push(particle);accepted.push(particle);
      }
    }
    const result=includeExpired?accepted:live.filter(p=>(time-p.birthTime)*speed<p.lifetime-1e-10);
    return result.map(p=>({...p,age:includeExpired?0:Math.max(0,(time-p.birthTime)*speed)}));
  }
  return {triggers:triggersAt,sample,births(child,time,options){return sample(child,time,{...options,includeExpired:true});},
    ownsParent(source,requestedSeed=seed){
      if(requestedSeed!==seed||!owned.has(source))return false;
      const id=Object.keys(pack.records).find(id=>pack.records[id].data===source);
      return owned.get(source)===JSON.stringify({module:source.SubModule,links:createSubEmitterGraph(pack).links(id)});
    },
    scope:{childEmissionScheduling:true,parentLifetimeWindows:true,sharedChildCapacity:true,childMotionPlaying:false,compiledFrameParity:false}};
}
