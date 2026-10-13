// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{createParentParticleMotion}from'../shared/arkpedia/native-parent-particle-motion.js';
import{createChildEmissionSchedule}from'../shared/arkpedia/native-child-emission.js';
import{createMovingParticles}from'../shared/arkpedia/native-moving-particles.js';
import f from'./fixtures/arkpedia-source-parent-motion.json'with{type:'json'};
import children from'./fixtures/arkpedia-child-particle-motion.json'with{type:'json'};
import meta from'../data/arkpedia-source-parent-motion.json'with{type:'json'};
const c=scalar=>({minMaxState:0,scalar}),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const mat=(x=0,y=0,z=0)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
function original(){return{records:{...Object.fromEntries(Object.entries(f).map(([id,r])=>[id,{type:'ParticleSystem',data:structuredClone(r.data),references:structuredClone(r.references)}])),
 ...Object.fromEntries(Object.entries(children).map(([id,r])=>[id,{type:'ParticleSystem',data:structuredClone(r.data)}]))}};}
const parentId=Object.keys(f).find(id=>meta.statuses[id].sampled),childId=f[parentId].references.find(r=>r.field==='emitter').target;
test('original parent inventory binds to source hashes and retains all nine physical/history holds',()=>{
 const raw=readFileSync(new URL('./fixtures/arkpedia-source-parent-motion.json',import.meta.url));assert.equal(raw.length,meta.fixture.bytes);
 assert.equal(createHash('sha256').update(raw).digest('hex'),meta.fixture.sha256);const p=original(),before=structuredClone(p);
 const motion=createParentParticleMotion(p,{frameAt:()=>({birth:mat(),movement:mat()})});assert.deepEqual(motion.statuses(),meta.statuses);
 assert.equal(Object.values(meta.statuses).filter(r=>r.sampled).length,6);assert.equal(Object.values(meta.statuses).filter(r=>r.held).length,9);
 assert.equal(meta.scope.syntheticParentMotion,false);assert.equal(meta.scope.compiledFrameParity,false);assert.deepEqual(meta.scope.enabledOperators,[]);assert.deepEqual(p,before);
});
for(const[id,row]of Object.entries(f))test(id+' owns validated emission while retaining original physical modules and source frame motion',()=>{
 const p=original(),before=structuredClone(p),motion=createParentParticleMotion(p,{frameAt:()=>({birth:mat(),movement:mat()})});
 if(meta.statuses[id].held){assert.throws(()=>motion.parentAt(id,0,.1),/motion held/);return;}
 for(const time of[.03,.1,.2,.44]){
  const sample=motion.sample(id,0,time),parent=motion.parentAt(id,0,time);
  assert.equal(sample.particle.id,0);assert.equal(sample.particle.parent,undefined);assert.ok(sample.position.every(Number.isFinite));
  near(sample.position[0]**2+(sample.position[1]/row.data.ShapeModule.m_Scale.y)**2,
   (sample.particle.origin[0])**2+(sample.particle.origin[1]/row.data.ShapeModule.m_Scale.y)**2);
  assert.deepEqual(parent.position,sample.position);assert.deepEqual(parent.velocity,[0,0,0]);
  const snapshot=structuredClone(sample);motion.sample(id,0,.1);assert.deepEqual(motion.sample(id,0,time),snapshot);
 }
 assert.throws(()=>motion.sample(id,0,.01),/not born/);assert.throws(()=>motion.sample(id,0,1),/expired/);assert.deepEqual(p,before);
});
test('SubModule is accepted only for the same original source and seed managed by its validated scheduler',()=>{
 const p=original(),source=p.records[parentId].data,schedule=createChildEmissionSchedule(p);
 assert.throws(()=>createMovingParticles(source),/SubModule/);assert.ok(createMovingParticles(source,{subEmitterSchedule:schedule}));
 assert.throws(()=>createMovingParticles(structuredClone(source),{subEmitterSchedule:schedule}),/SubModule/);
 assert.throws(()=>createMovingParticles(source,{seed:2,subEmitterSchedule:schedule}),/SubModule/);
 source.SubModule.subEmitters[0].properties=1;assert.throws(()=>createMovingParticles(source,{subEmitterSchedule:schedule}),/SubModule/);
});
test('parent initial momentum is retained at birth and real-clock velocity includes simulation speed',()=>{
 const p=original(),s=p.records[parentId].data;s.InitialModule.startSpeed=c(2);s.simulationSpeed=.5;
 const motion=createParentParticleMotion(p,{parentIds:[parentId],frameAt:()=>({birth:mat(),movement:mat()})});
 const birth=s.startDelay.scalar/s.simulationSpeed,at=motion.sample(parentId,0,birth),velocity=motion.parentAt(parentId,0,birth).velocity;
 for(let i=0;i<3;i++)near(velocity[i],at.particle.initialVelocity[i]*s.simulationSpeed);
 assert.ok(Math.hypot(...velocity)>.5);for(let i=0;i<3;i++)near(motion.parentAt(parentId,0,birth+.1).velocity[i],velocity[i]);
});
test('source emitter movement and scale contribute to parent particle world velocity',()=>{
 const p=original(),motion=createParentParticleMotion(p,{parentIds:[parentId],frameAt:(id,t)=>{
  const m=mat(3*t,-t,0);m[0]=2+t;m[5]=-3;return{birth:m,movement:m};}});
 const sample=motion.sample(parentId,0,.2),parent=motion.parentAt(parentId,0,.2),origin=sample.particle.origin;
 near(parent.position[0],3*.2+(2+.2)*origin[0]);near(parent.position[1],-.2-3*origin[1]);
 near(parent.velocity[0],3+origin[0]);near(parent.velocity[1],-1);near(parent.velocity[2],0);
});
test('child births use the actual parent shape offset and retain it after parent expiry',()=>{
 const p=original();p.records[childId].data.InitialModule.startLifetime=c(2);
 const motion=createParentParticleMotion(p,{parentIds:[parentId],frameAt:()=>({birth:mat(),movement:mat()})});
 const records=motion.records(childId,.1);assert.ok(records.length);assert.ok(motion.ready(childId));
 const bridge=motion.childFrames(childId,()=>({birth:mat(),movement:mat()})),record=records[0];
 const q={...record,age:(1-record.birthTime)*p.records[childId].data.simulationSpeed,origin:[1,2,3],displacement:[.5,0,0],velocitySpace:'local',simulationSpace:'local'};
 const parent=motion.parentAt(parentId,record.parentParticle,record.birthTime).position,expected=parent.map((v,i)=>v+[1.5,2,3][i]);
 assert.deepEqual(bridge.worldPosition(q,1),expected);
 assert.throws(()=>bridge.frameAt(record.birthTime,{...record,parent:'foreign'}),/Foreign/);
 assert.throws(()=>motion.records(Object.keys(children).find(id=>children[id].source==='tragodia'),1),/not supported/);
});
test('unsupported root selection, parent histories and invalid frames cannot dispatch children',()=>{
 const p=original();assert.throws(()=>createParentParticleMotion(p),/frames/);
 assert.throws(()=>createParentParticleMotion(p,{parentIds:['unknown'],frameAt:()=>null}),/selection/);
 const outside=createParentParticleMotion(p,{parentIds:[],frameAt:()=>null});assert.equal(outside.ready(childId),false);assert.throws(()=>outside.records(childId,.1),/not supported/);
 const bad=createParentParticleMotion(p,{parentIds:[parentId],frameAt:()=>({birth:[1],movement:mat()})});assert.throws(()=>bad.parentAt(parentId,0,.1),/matrix/);
 p.records[parentId].data.looping=true;p.records[parentId].data.prewarm=true;
 const held=createParentParticleMotion(p,{parentIds:[parentId],frameAt:()=>({birth:mat(),movement:mat()})});assert.equal(held.parentReady(parentId),false);assert.match(held.parentReason(parentId),/prewarm/);
});
