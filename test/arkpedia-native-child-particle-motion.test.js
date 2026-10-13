// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import{createHash}from'node:crypto';import{readFileSync}from'node:fs';
import{createMovingParticles}from'../shared/arkpedia/native-moving-particles.js';
import{createStationaryParticles}from'../shared/arkpedia/native-stationary-particles.js';
import{createParticleLifecycle}from'../shared/arkpedia/native-particle-lifecycle.js';
import{createChildEmissionSchedule}from'../shared/arkpedia/native-child-emission.js';
import{createChildParticleFrames}from'../shared/arkpedia/native-child-particle-frame.js';
import f from'./fixtures/arkpedia-child-particle-motion.json'with{type:'json'};
import links from'./fixtures/arkpedia-particle-birth-links.json'with{type:'json'};
import meta from'../data/arkpedia-child-particle-motion.json'with{type:'json'};
const c=scalar=>({minMaxState:0,scalar}),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const mat=(x=0,y=0,z=0)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const pack={records:{...Object.fromEntries(Object.entries(links.parents).map(([id,r])=>[id,{type:'ParticleSystem',data:{...r.clock,SubModule:r.module},references:r.references}])),
 ...Object.fromEntries(Object.entries(f).map(([id,r])=>[id,{type:'ParticleSystem',data:r.data}]))}};
const lineage={id:7,born:.1,birthTime:.5,age:.5,lifetime:2,parent:'parent',parentParticle:2,slot:0,parentBirthTime:0,parentDeathTime:.75};
function frames(){return createChildParticleFrames({parentAt:(parent,id,t)=>({position:[id*.01+t*.2,t*.1,-t*.3],velocity:[.2,.1,-.3]}),sourceFrameAt:()=>({birth:mat(),movement:mat(),parentOrigin:[0,0,0]})});}
function basic(){const s=structuredClone(Object.values(f)[0].data);for(const[k,v]of Object.entries(s))if(k.endsWith('Module'))v.enabled=false;
 s.InitialModule.enabled=true;s.EmissionModule.enabled=true;s.InitialModule.startSpeed=c(0);s.InitialModule.startLifetime=c(2);s.InitialModule.maxNumParticles=10;
 s.moveWithTransform=0;s.prewarm=false;s.looping=false;s.simulationSpeed=1;s.lengthInSec=4;s.startDelay=c(0);
 s.EmissionModule.rateOverTime=c(2);s.EmissionModule.m_Bursts=[];s.EmissionModule.m_BurstCount=0;return s;}
test('source inventory keeps 63 sampled profiles and six explicit arc holds without enabling game dispatch',()=>{
 const raw=readFileSync(new URL('./fixtures/arkpedia-child-particle-motion.json',import.meta.url));assert.equal(raw.length,meta.fixture.bytes);
 assert.equal(createHash('sha256').update(raw).digest('hex'),meta.fixture.sha256);assert.equal(Object.keys(f).length,69);
 assert.deepEqual(meta.scope,{sourceMapping:true,scheduledParticleSampling:true,explicitParentMotion:true,syntheticParentMotion:true,nativeParentMotion:false,childEmissionPlaying:false,compiledFrameParity:false,enabledOperators:[]});
 assert.equal(Object.values(meta.admission).filter(v=>v.sampler).length,63);assert.equal(Object.values(meta.admission).filter(v=>v.held).length,6);
});
for(const[id,row]of Object.entries(f))test(id+' retains scheduled lineage, source physics, lifetime and deterministic reverse sampling',()=>{
 assert.equal(row.particleSha256,links.children[id].particleSha256);
 const s=row.data,before=structuredClone(s),admission=meta.admission[id];
 if(admission.held){assert.throws(()=>createMovingParticles(s),{message:'Native cone angle/arc mode needs review'});return;}
 const sampler=admission.sampler==='moving'?createMovingParticles(s):createStationaryParticles(s),schedule=createChildEmissionSchedule(pack),bridge=frames();
 let count=0;
 for(const time of[0,.03,.1,.5,1,2,4]){
  const records=schedule.sample(id,time),particles=sampler.sampleRecords(records,time,bridge);assert.equal(particles.length,records.length);
  for(const[pIndex,p]of particles.entries()){
   for(const k of['id','born','birthTime','parent','parentParticle','parentBirthTime','parentDeathTime','slot','age','lifetime'])assert.equal(p[k],records[pIndex][k]);
   assert.ok(p.size.every(Number.isFinite)&&p.color.every(Number.isFinite));near(p.age,(time-p.birthTime)*s.simulationSpeed);
   if(p.inheritedVelocity)for(let i=0;i<3;i++)near(p.inheritedVelocity[i],[.2,.1,-.3][i]*s.InheritVelocityModule.m_Curve.scalar);
   const positioned=p.position?p:{...p,origin:[0,0,0],displacement:[0,0,0],simulationSpace:'local',velocitySpace:'local'};
   assert.ok(bridge.worldPosition(positioned,time).every(Number.isFinite));count++;
  }
  sampler.sampleRecords(schedule.sample(id,8),8,bridge);assert.deepEqual(sampler.sampleRecords(records,time,bridge),particles);
 }
 if(id==='battle/prefabs/effects/phatm2.ab:-4119380815037304229')assert.equal(count,0);else assert.ok(count>0);
 assert.deepEqual(s,before);
});
test('external births preserve ordinary lifecycle sampling and use child-local phase rather than global time',()=>{
 const s=basic();s.InitialModule.startSize={minMaxState:1,scalar:1,maxCurve:{m_PreInfinity:2,m_PostInfinity:2,m_Curve:[
  {time:0,value:1,inSlope:2,outSlope:2,weightedMode:0},{time:1,value:3,inSlope:2,outSlope:2,weightedMode:0}]}};
 const e=createParticleLifecycle(s),normal=e.sample(1),records=normal.map(p=>({id:p.id,born:p.born,lifetime:p.lifetime,age:p.age,birthTime:1-p.age}));
 for(const p of normal)for(const value of p.size)near(value,1+2*p.born/s.lengthInSec);
 assert.deepEqual(e.sampleRecords(records,1).map(({birthTime,...p})=>p),normal);
 const shifted=records.map(p=>({...p,birthTime:p.birthTime+20}));assert.deepEqual(e.sampleRecords(shifted,21).map(({birthTime,...p})=>p),normal);
});
test('malformed external clocks, identities, lifetime and capacity fail even for empty samples',()=>{
 const s=basic(),e=createParticleLifecycle(s),p={id:0,born:.1,lifetime:2,age:.5,birthTime:.5};
 for(const changed of[null,{...p,id:NaN},{...p,born:-1},{...p,age:-.1},{...p,age:.4},{...p,birthTime:2},{...p,lifetime:3}])assert.throws(()=>e.sampleRecords([changed],1));
 assert.throws(()=>e.sampleRecords([p,p],1),/birth record/);assert.throws(()=>e.sampleRecords([],NaN),/clock/);assert.throws(()=>e.sampleRecords([],-1),/clock/);
 assert.throws(()=>e.sampleRecords(Array.from({length:11},(_,id)=>({...p,id})),1),/capacity/);
});
test('world birth frames retain authored offset, reflected scale and distinct parent identity',()=>{
 const source=mat(10,20,30);source[0]=-2;source[5]=3;
 const seen=[],b=createChildParticleFrames({parentAt:(parent,id,t)=>{seen.push([parent,id,t]);return{position:[12+id,24,35],velocity:[1,2,3]};},
  sourceFrameAt:()=>({birth:source,movement:mat(10,20,30),parentOrigin:[10,20,30]})});
 const p={...lineage,origin:[1,2,3],displacement:[.5,1,2],simulationSpace:'world',velocitySpace:'local'};
 assert.deepEqual(b.worldPosition(p,1),[12.5,31,40]);assert.deepEqual(b.worldPosition({...p,parentParticle:3},1),[13.5,31,40]);
 assert.ok(seen.every(([parent,id,time])=>parent==='parent'&&time===.5));assert.deepEqual(b.emitterVelocityAt(.6,p),[1,2,3]);
 assert.deepEqual(source,[-2,0,0,0,0,3,0,0,0,0,1,0,10,20,30,1]);
});
test('local children follow original emitter frames after parent expiry without querying a dead parent',()=>{
 const seen=[],b=createChildParticleFrames({parentAt:(parent,id,t)=>{seen.push(t);assert.equal(t,.5);return{position:[16,24,30],velocity:[0,0,0]};},
  sourceFrameAt:t=>{const m=mat(t===.5?10:100,20,30);if(t===.5){m[0]=0;m[1]=2;m[4]=-4;m[5]=0;}else{m[0]=3;m[5]=5;}
   return{birth:m,movement:mat(),parentOrigin:[10,20,30]};}});
 // At birth the parent delta [6,4,0] maps to [2,-1.5,0] in
 // the rotated, nonuniform source frame. Later source scaling applies to it.
 const p={...lineage,origin:[1,2,0],displacement:[.5,1,0],simulationSpace:'local',velocitySpace:'local'};
 assert.deepEqual(b.worldPosition(p,2),[109.5,23.5,30]);assert.deepEqual(seen,[.5]);
});
test('singular frames cannot invent a birth offset; zero delta and pre-integrated world paths remain explicit',()=>{
 const source=mat();source[0]=0;
 const bridge=position=>createChildParticleFrames({parentAt:()=>({position,velocity:[0,0,0]}),sourceFrameAt:()=>({birth:source,movement:mat(),parentOrigin:[0,0,0]})});
 const p={...lineage,origin:[0,0,0],displacement:[0,0,0],simulationSpace:'local',velocitySpace:'local'};
 assert.throws(()=>bridge([1,0,0]).worldPosition(p,1),/Singular/);assert.deepEqual(bridge([0,0,0]).worldPosition(p,1),[0,0,0]);
 const integrated=[1,2,3];assert.deepEqual(bridge([1,0,0]).worldPosition({...p,worldPosition:integrated},1),integrated);
 assert.notEqual(bridge([1,0,0]).worldPosition({...p,worldPosition:integrated},1),integrated);
});
test('missing motion, malformed lineage/matrices and unsupported mixed spaces remain held',()=>{
 assert.throws(()=>createChildParticleFrames({}),/explicit/);
 const b=frames();for(const changed of[{...lineage,parent:''},{...lineage,parentParticle:-1},{...lineage,parentDeathTime:.4}])assert.throws(()=>b.frameAt(.5,changed),/lineage/);
 const empty=createChildParticleFrames({parentAt:()=>null,sourceFrameAt:()=>null});assert.throws(()=>empty.frameAt(.5,lineage),/unavailable/);
 const bad=createChildParticleFrames({parentAt:()=>({position:[0,0,0],velocity:[0,0,0]}),sourceFrameAt:()=>({birth:[1],movement:mat(),parentOrigin:[0,0,0]})});assert.throws(()=>bad.frameAt(.5,lineage),/source frame/);
 assert.throws(()=>b.worldPosition({...lineage,origin:[0,0,0],displacement:[0,0,0],simulationSpace:'local',velocitySpace:'world'},1),/integration/);
 assert.throws(()=>b.worldPosition({...lineage,origin:[0,0,0],displacement:[0,0,0],simulationSpace:'world',velocitySpace:'unknown'},1),/velocity space/);
 assert.throws(()=>b.worldPosition({...lineage,birthTime:2},1),/render clock/);
});
