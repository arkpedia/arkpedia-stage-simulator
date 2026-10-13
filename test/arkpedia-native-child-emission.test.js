// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';import{createChildEmissionSchedule}from'../shared/arkpedia/native-child-emission.js';
import{createParticleBirthClock}from'../shared/arkpedia/native-particle-birth-clock.js';
import f from'./fixtures/arkpedia-particle-birth-links.json'with{type:'json'};import meta from'../data/arkpedia-child-emission.json'with{type:'json'};
const c=scalar=>({minMaxState:0,scalar}),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function original(){return{records:{...Object.fromEntries(Object.entries(f.parents).map(([id,r])=>[id,{type:'ParticleSystem',data:{...r.clock,SubModule:r.module},references:r.references}])),
 ...Object.fromEntries(Object.entries(f.children).map(([id,r])=>[id,{type:'ParticleSystem',data:r.clock}]))}};}
function synthetic(){const source=structuredClone(Object.values(f.parents)[0].clock),child=structuredClone(Object.values(f.children)[0].clock);
 for(const s of[source,child]){s.prewarm=false;s.looping=false;s.startDelay=c(0);s.lengthInSec=4;s.simulationSpeed=1;s.InitialModule.startLifetime=c(2);s.InitialModule.maxNumParticles=10;
  s.EmissionModule.rateOverDistance=c(0);s.EmissionModule.rateOverTime=c(0);s.EmissionModule.m_BurstCount=1;
  s.EmissionModule.m_Bursts=[{time:0,countCurve:c(1),probability:1,cycleCount:1,repeatInterval:.1}];}
 const slot={type:0,properties:0,emitProbability:1,emitter:{m_FileID:0,m_PathID:'child'}};
 source.SubModule={enabled:true,subEmitters:[slot]};
 return{records:{parent:{type:'ParticleSystem',data:source,references:[{field:'emitter',pointer:slot.emitter,target:'child'}]},child:{type:'ParticleSystem',data:child}}};}
test('all 69 source children retain explicit scheduling and movement boundaries',()=>{
 assert.equal(Object.keys(meta.children).length,69);assert.deepEqual(meta.children,Object.fromEntries(Object.entries(f.children).map(([id,r])=>[id,{source:r.source,particleSha256:r.particleSha256}])));
 assert.deepEqual(meta.scope,{sourceMapping:true,childEmissionScheduling:true,parentLifetimeWindows:true,sharedChildCapacity:true,childEmissionPlaying:false,childMotionPlaying:false,compiledFrameParity:false,enabledOperators:[]});
});
for(const[child,r]of Object.entries(f.children))test(child+' merges original child clocks and preserves lineage, expiry and reverse samples',()=>{
 const pack=original(),before=structuredClone(pack),s=createChildEmissionSchedule(pack),births=s.births(child,4),alive=s.sample(child,4);
 const rate=r.clock.EmissionModule.rateOverTime.scalar,bursts=r.clock.EmissionModule.m_Bursts;
 if(rate===0&&bursts.every(b=>b.countCurve.scalar===0))assert.deepEqual(births,[]);else assert.ok(births.length>0);
 for(const p of births){assert.equal(p.age,0);assert.ok(p.birthTime>=p.parentBirthTime);assert.ok(p.birthTime<p.parentDeathTime);assert.equal(f.parents[p.parent].references[p.slot].target,child);}
 for(const p of alive){near(p.age,(4-p.birthTime)*r.clock.simulationSpeed);assert.ok(p.age<p.lifetime);}
 s.sample(child,8);assert.deepEqual(s.births(child,4),births);assert.deepEqual(s.sample(child,4),alive);assert.deepEqual(pack,before);
});
test('child bursts start at parent birth plus authored child delay',()=>{
 const pack=synthetic();pack.records.parent.data.startDelay=c(.3);pack.records.child.data.startDelay=c(.2);
 const s=createChildEmissionSchedule(pack);assert.deepEqual(s.births('child',.49),[]);const p=s.births('child',.5)[0];near(p.birthTime,.5);near(p.parentBirthTime,.3);
});
test('continuous child emission stops at parent death while existing children retain their own lifetimes',()=>{
 const pack=synthetic(),p=pack.records.parent.data,ch=pack.records.child.data;p.InitialModule.startLifetime=c(.75);
 ch.EmissionModule.rateOverTime=c(4);ch.EmissionModule.m_Bursts=[];ch.EmissionModule.m_BurstCount=0;ch.InitialModule.startLifetime=c(2);
 const s=createChildEmissionSchedule(pack),births=s.births('child',2);assert.deepEqual(births.map(p=>p.birthTime),[.25,.5]);
 assert.equal(s.sample('child',1).length,2);assert.equal(s.sample('child',2.5).length,0);
});
test('half-speed child clocks use real emission times and simulated particle ages',()=>{
 const pack=synthetic(),ch=pack.records.child.data;ch.simulationSpeed=.5;ch.startDelay=c(.1);
 ch.EmissionModule.rateOverTime=c(2);ch.EmissionModule.m_Bursts=[];ch.EmissionModule.m_BurstCount=0;
 const s=createChildEmissionSchedule(pack),births=s.births('child',1.5);assert.equal(births.length,1);near(births[0].birthTime,1.2);near(s.sample('child',1.5)[0].age,.15);
});
test('shared capacity combines concurrent parent branches before admission and retains rejected IDs',()=>{
 const pack=synthetic(),p=pack.records.parent.data,ch=pack.records.child.data;
 p.EmissionModule.m_Bursts[0].countCurve=c(2);p.InitialModule.startLifetime=c(1);
 ch.InitialModule.maxNumParticles=1;ch.InitialModule.startLifetime=c(.2);ch.EmissionModule.rateOverTime=c(4);ch.EmissionModule.m_Bursts=[];ch.EmissionModule.m_BurstCount=0;
 const births=createChildEmissionSchedule(pack).births('child',1);
 assert.deepEqual(births.map(p=>p.id),[0,2,4]);assert.deepEqual(births.map(p=>p.parentParticle),[0,0,0]);assert.deepEqual(births.map(p=>p.birthTime),[.25,.5,.75]);
});
test('shared child targets preserve deterministic tie order independent of trigger input ordering',()=>{
 const pack=synthetic();pack.records.other=structuredClone(pack.records.parent);
 const s=createChildEmissionSchedule(pack),triggers=s.triggers(.5),a=s.births('child',.5,{triggers}),b=s.births('child',.5,{triggers:[...triggers].reverse()});
 assert.deepEqual(a,b);assert.deepEqual(a.map(p=>p.parent),['other','parent']);
});
test('combined branch attempts are budgeted before growing an unbounded merged queue',()=>{
 const pack=synthetic(),p=pack.records.parent.data,ch=pack.records.child.data;
 p.EmissionModule.m_Bursts[0].countCurve=c(2);ch.EmissionModule.rateOverTime=c(50001);
 ch.EmissionModule.m_BurstCount=0;ch.EmissionModule.m_Bursts=[];
 assert.throws(()=>createChildEmissionSchedule(pack).births('child',1),/child emission exceeds event budget/);
});
test('triggered emission overrides Play On Awake without changing original emission flags',()=>{
 const pack=synthetic();pack.records.child.data.playOnAwake=false;
 const clock=createParticleBirthClock(pack.records.child.data);assert.deepEqual(clock.events(1),[]);assert.equal(clock.events(1,{triggered:true})[0].count,1);
 assert.equal(createChildEmissionSchedule(pack).births('child',.5).length,1);pack.records.child.data.EmissionModule.enabled=false;
 assert.deepEqual(createChildEmissionSchedule(pack).births('child',.5),[]);
});
test('prewarmed parent windows do not invent a child prewarm policy',()=>{
 const pack=synthetic(),p=pack.records.parent.data;p.looping=true;p.prewarm=true;p.lengthInSec=1;p.EmissionModule.m_Bursts=[];p.EmissionModule.m_BurstCount=0;p.EmissionModule.rateOverTime=c(2);
 const s=createChildEmissionSchedule(pack),births=s.births('child',0);assert.ok(births.some(p=>p.parentBirthTime<0));assert.ok(births.every(p=>p.birthTime<=0));
 pack.records.child.data.prewarm=true;pack.records.child.data.looping=true;assert.throws(()=>createChildEmissionSchedule(pack),/child prewarm/);
});
test('unsupported nested, distance, non-Birth or inherited-property paths and malformed triggers never silently play',()=>{
 for(const change of[p=>p.records.child.data.SubModule={enabled:true,subEmitters:[]},p=>p.records.child.data.EmissionModule.rateOverDistance=c(1),
  p=>p.records.parent.data.SubModule.subEmitters[0].type=2,p=>p.records.parent.data.SubModule.subEmitters[0].properties=1]){
  const pack=synthetic();change(pack);assert.throws(()=>createChildEmissionSchedule(pack));}
 const s=createChildEmissionSchedule(synthetic()),trigger=s.triggers(1)[0];
 for(const changed of[{...trigger,child:'unknown'},{...trigger,parentDeathTime:trigger.time},{...trigger,particle:NaN},{...trigger,slot:2}])assert.throws(()=>s.sample('child',1,{triggers:[changed]}),/birth trigger/);
 assert.throws(()=>s.sample('child',1,{triggers:[trigger,trigger]}),/Duplicate/);assert.throws(()=>s.sample('unknown',1));assert.throws(()=>s.sample('child',NaN));
});
