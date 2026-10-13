// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{createParticleBirthClock}from'../shared/arkpedia/native-particle-birth-clock.js';import{createSubEmitterGraph}from'../shared/arkpedia/native-sub-emitter-graph.js';
import{particleRandom}from'../shared/arkpedia/native-particle-lifecycle.js';import{particleRandom as sharedRandom}from'../shared/arkpedia/native-particle-random.js';
import f from'./fixtures/arkpedia-particle-birth-links.json'with{type:'json'};import meta from'../data/arkpedia-particle-birth-links.json'with{type:'json'};
const c=scalar=>({minMaxState:0,scalar}),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function pack(){return{records:{...Object.fromEntries(Object.entries(f.parents).map(([id,r])=>[id,{type:'ParticleSystem',data:{...r.clock,SubModule:r.module},references:r.references}])),
 ...Object.fromEntries(Object.entries(f.children).map(([id,r])=>[id,{type:'ParticleSystem',data:r.clock}]))}};}
function source(){const s=structuredClone(Object.values(f.parents)[0].clock);s.looping=true;s.prewarm=false;s.startDelay=c(0);s.lengthInSec=2;s.simulationSpeed=1;
 s.InitialModule.startLifetime=c(.3);s.InitialModule.maxNumParticles=1;s.EmissionModule.m_BurstCount=0;s.EmissionModule.m_Bursts=[];s.EmissionModule.rateOverTime=c(10);return s;}
test('birth evidence retains 15 original parents, 69 exact child links and a clock-only scope',()=>{
 const bytes=readFileSync(new URL('./fixtures/arkpedia-particle-birth-links.json',import.meta.url));assert.equal(bytes.length,meta.fixture.bytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.fixture.sha256);assert.equal(particleRandom,sharedRandom);
 assert.equal(Object.keys(f.parents).length,15);assert.equal(Object.keys(f.children).length,69);assert.deepEqual(Object.keys(f.parents),Object.keys(meta.parents));
 assert.deepEqual(meta.scope,{sourceMapping:true,birthScheduling:true,childEmissionPlaying:false,compiledFrameParity:false,enabledOperators:[]});
 for(const[id,r]of Object.entries(f.parents)){assert.equal(r.particleSha256,meta.parents[id].particleSha256);assert.deepEqual(r.references.map(ref=>ref.target),meta.parents[id].children);}
});
for(const[id,r]of Object.entries(f.parents))test(id+' preserves all accepted birth triggers after parent expiry and reverse scrubbing',()=>{
 const original=structuredClone(r),g=createSubEmitterGraph(pack()),clock=createParticleBirthClock(r.clock),births=clock.births(4),events=g.triggers(id,births);
 assert.ok(births.length>0);assert.equal(events.length,births.length*r.module.subEmitters.length);
 for(const p of births){assert.equal(p.age,0);const e=events.filter(e=>e.particle===p.id);assert.equal(e.length,r.module.subEmitters.length);
  for(const[slot,event]of e.entries()){assert.equal(event.child,r.references[slot].target);near(event.time,p.birthTime);near(event.parentDeathTime,p.birthTime+p.lifetime/r.clock.simulationSpeed);}}
 clock.births(8);assert.deepEqual(clock.births(4),births);assert.deepEqual(r,original);
 assert.deepEqual(clock.scope,{birthClocksOnly:true,compiledFrameParity:false});
});
test('capacity rejects births without reusing IDs, while expired accepted births remain scheduled',()=>{
 const clock=createParticleBirthClock(source()),births=clock.births(1);
 assert.deepEqual(births.map(p=>p.id),[0,3,6,9]);births.forEach((p,i)=>near(p.birthTime,.1+.3*i));
 assert.deepEqual(clock.sample(1).map(p=>p.id),[9]);assert.equal(births.length,4);
});
test('simultaneous bursts respect live capacity and preserve skipped random identities',()=>{
 const s=source();s.InitialModule.maxNumParticles=2;s.InitialModule.startLifetime=c(.1);s.EmissionModule.rateOverTime=c(0);
 const burst=time=>({time,countCurve:c(5),cycleCount:1,probability:1,repeatInterval:.1});s.EmissionModule.m_BurstCount=2;s.EmissionModule.m_Bursts=[burst(0),burst(.2)];
 const clock=createParticleBirthClock(s);assert.deepEqual(clock.births(.3).map(p=>p.id),[0,1,5,6]);assert.deepEqual(clock.sample(.3),[]);
});
test('delay and simulation speed retain real accepted birth times after particles die',()=>{
 const s=source();s.looping=false;s.lengthInSec=.3;s.simulationSpeed=.5;s.startDelay=c(.25);
 s.InitialModule.maxNumParticles=10;
 const clock=createParticleBirthClock(s),births=clock.births(2);assert.deepEqual(clock.sample(2),[]);assert.equal(births.length,2);
 near(births[0].birthTime,.7);near(births[1].birthTime,.9);
});
test('prewarm retains negative real births without inventing motion or replaying a future event',()=>{
 const s=source();s.prewarm=true;s.looping=true;s.lengthInSec=1;s.simulationSpeed=2;s.startDelay=c(.2);
 s.InitialModule.maxNumParticles=10;s.InitialModule.startLifetime=c(.5);s.EmissionModule.rateOverTime=c(2);
 const clock=createParticleBirthClock(s);assert.deepEqual(clock.births(0),[]);const births=clock.births(.1);assert.equal(births.length,2);
 near(births[0].birthTime,-.15);near(births[1].birthTime,.1);clock.births(3);assert.deepEqual(clock.births(.1),births);
});
test('unsupported physical modules do not become playable merely because their birth clocks can be indexed',()=>{
 const s=source();s.SubModule={enabled:true};s.CollisionModule={enabled:true};
 const c=createParticleBirthClock(s);assert.ok(c.births(1).length>0);assert.equal(c.scope.birthClocksOnly,true);
 s.playOnAwake=false;assert.deepEqual(createParticleBirthClock(s).births(1),[]);
});
test('ring-buffer replacement cannot silently use capacity-rejection birth scheduling',()=>{
 for(const mode of [undefined,1,2]){const s=source();s.ringBufferMode=mode;assert.throws(()=>createParticleBirthClock(s),/ring-buffer birth/);}
});
test('malformed, ambiguous and cyclic source relationships cannot be silently remapped',()=>{
 const parent=Object.keys(f.parents)[0],child=f.parents[parent].references[0].target;
 for(const change of [p=>delete p.records[child],p=>p.records[child].type='Mesh',p=>p.records[parent].references[0].target='unknown',
  p=>p.records[parent].data.SubModule.subEmitters[0].type=9,p=>p.records[parent].data.SubModule.subEmitters[0].emitProbability=NaN,
  p=>p.records[parent].references.push({...p.records[parent].references[0],target:Object.keys(f.children)[1]})]){
  const p=structuredClone(pack());change(p);assert.throws(()=>createSubEmitterGraph(p));}
 const cycle=structuredClone(pack());cycle.records[child].data.SubModule={enabled:true,subEmitters:[{...cycle.records[parent].data.SubModule.subEmitters[0],emitter:{m_FileID:0,m_PathID:'parent'}}]};
 cycle.records[child].references=[{field:'emitter',pointer:{m_FileID:0,m_PathID:'parent'},target:parent}];assert.throws(()=>createSubEmitterGraph(cycle),/Cyclic/);
});
test('unsupported triggers, probability and inherited flags remain indexed but cannot dispatch as Birth',()=>{
 const parent=Object.keys(f.parents)[0];
 for(const change of [slot=>slot.type=2,slot=>slot.properties=1,slot=>slot.emitProbability=.5]){
  const p=structuredClone(pack());change(p.records[parent].data.SubModule.subEmitters[0]);const graph=createSubEmitterGraph(p);
  assert.equal(graph.parents(f.parents[parent].references[0].target)[0],parent);assert.throws(()=>graph.triggers(parent,[]),/needs dispatch/);}
 const graph=createSubEmitterGraph(pack()),birth={id:0,age:0,birthTime:0,lifetime:1};
 for(const births of [[{...birth,id:NaN}],[{...birth,age:1}],[{...birth,lifetime:0}],[birth,birth],[{...birth,birthTime:1},{...birth,id:1}]])assert.throws(()=>graph.triggers(parent,births),/accepted parent birth/);
});
