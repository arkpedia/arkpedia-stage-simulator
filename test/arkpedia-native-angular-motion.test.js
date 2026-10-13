// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createParticleAngularMotion} from '../shared/arkpedia/native-particle-angular-motion.js';
import {createParticleLifecycle} from '../shared/arkpedia/native-particle-lifecycle.js';
import {createMovingParticles,integrateParticleCurve} from '../shared/arkpedia/native-moving-particles.js';
import {integrateParticleCurve as sharedIntegral} from '../shared/arkpedia/native-particle-curves.js';
import inherited from './fixtures/arkpedia-particle-inheritance.json' with {type:'json'};
import fixtures from './fixtures/arkpedia-particle-angular-motion.json' with {type:'json'};
import meta from '../data/arkpedia-particle-angular-motion.json' with {type:'json'};
const c=scalar=>({minMaxState:0,scalar}),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const particle={age:.5,lifetime:2,rotation:.3};
function linear(a,b){return {minMaxState:1,scalar:1,maxCurve:{m_PreInfinity:2,m_PostInfinity:2,m_Curve:[
 {time:0,value:a,inSlope:b-a,outSlope:b-a,weightedMode:0},{time:1,value:b,inSlope:b-a,outSlope:b-a,weightedMode:0}]}};}
test('angular inventory retains all 57 original velocity profiles and explicit fidelity limits',()=>{
 const bytes=readFileSync(new URL('./fixtures/arkpedia-particle-angular-motion.json',import.meta.url));
 assert.equal(bytes.length,meta.fixture.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.fixture.sha256);
 assert.equal(Object.keys(fixtures).length,57);assert.deepEqual(Object.keys(fixtures),Object.keys(meta.particles));
 assert.equal(Object.values(fixtures).filter(r=>r.source==='tragodia').length,15);assert.equal(Object.values(fixtures).filter(r=>r.source==='lappland-alter').length,42);
 assert.deepEqual(meta.scope,{sourceMapping:true,localReplay:true,units:'radiansPerSimulatedSecond',compiledFrameParity:false,enabledOperators:[]});
 assert.equal(integrateParticleCurve,sharedIntegral); // Retain the previous public import contract.
});
for(const[key,r]of Object.entries(fixtures))test(key+' integrates its original angular velocity without changing source fields',()=>{
 const before=structuredClone(r.module),m=createParticleAngularMotion(r.module);
 assert.equal(r.particleSha256,meta.particles[key].particleSha256);assert.equal(r.module.separateAxes,false);
 for(const lifetime of [1,2])for(const factor of [0,.25,1]){
  const a=m.sample({age:.25*lifetime,lifetime,rotation:0},[factor,factor,factor]);
  const b=m.sample({age:.25*lifetime*2,lifetime:lifetime*2,rotation:.7},[factor,factor,factor]);near(b.rotation-.7,a.rotation*2);
  assert.equal(a.rotation3D,undefined);assert.equal(m.sample({age:0,lifetime,rotation:.7},[factor,factor,factor]).rotation,.7);
 }
 assert.deepEqual(r.module,before);
});
test('angular velocity integrates simulated seconds rather than treating speed as an angle',()=>{
 const m=createParticleAngularMotion({enabled:true,separateAxes:false,curve:c(Math.PI)});
 near(m.sample(particle,[0,0,0]).rotation,.3+Math.PI/2);
 near(m.sample({...particle,lifetime:4},[0,0,0]).rotation,.3+Math.PI/2);
 near(m.sample({...particle,age:1},[0,0,0]).rotation,.3+Math.PI);
});
test('linearly reversing angular velocity returns to its birth angle at the full lifetime',()=>{
 const m=createParticleAngularMotion({enabled:true,separateAxes:false,curve:linear(2,-2)});
 near(m.sample({...particle,age:1},[0,0,0]).rotation,1.3);
 near(m.sample({...particle,age:2},[0,0,0]).rotation,.3);
 near(m.sample({...particle,age:.5},[0,0,0]).rotation,1.05);
});
test('three axes retain birth angles and independent stable random factors',()=>{
 const m=createParticleAngularMotion({enabled:true,separateAxes:true,x:{minMaxState:3,minScalar:-2,scalar:2},y:c(3),curve:c(-4)});
 const result=m.sample({...particle,rotation3D:[.1,.2,.3]},[.25,.7,.9]);
 result.rotation3D.forEach((v,i)=>near(v,[-.4,1.7,-1.7][i]));near(result.rotation,-1.7);
 const z=createParticleAngularMotion({enabled:true,separateAxes:false,curve:c(2)});
 assert.deepEqual(z.sample({...particle,rotation3D:[.1,.2,.3]},[0,0,0]),{rotation:1.3,rotation3D:[.1,.2,1.3]});
});
test('lifecycle retains angular motion through delays, half-speed simulation and reverse samples',()=>{
 const s=structuredClone(Object.values(inherited)[0].data);
 for(const[k,v]of Object.entries(s))if(v?.enabled&&!['InitialModule','EmissionModule'].includes(k))v.enabled=false;
 s.RotationModule={enabled:true,separateAxes:false,curve:c(2)};s.moveWithTransform=0;s.simulationSpeed=.5;s.startDelay=c(.25);
 s.InitialModule.startSpeed=c(0);s.InitialModule.startLifetime=c(4);s.InitialModule.startRotation=c(.2);
 s.EmissionModule.rateOverTime=c(4);s.EmissionModule.m_BurstCount=0;s.EmissionModule.m_Bursts=[];
 const e=createParticleLifecycle(s),before=structuredClone(s),p=e.sample(2);assert.equal(p.length,3);
 for(const v of p)near(v.rotation,.2+2*v.age);
 e.sample(5);assert.deepEqual(e.sample(2),p);assert.deepEqual(s,before);
 assert.deepEqual(createMovingParticles(s).sample(2).map(v=>v.rotation),p.map(v=>v.rotation));
});
test('unsupported axes, weighted curves, birth angles and angular clocks cannot be dropped',()=>{
 assert.equal(createParticleAngularMotion({enabled:false}),null);
 for(const module of [{enabled:true,separateAxes:1,curve:c(1)},
  {enabled:true,separateAxes:true,x:null,y:c(0),curve:c(0)},
  {enabled:true,separateAxes:false,curve:{...linear(0,1),maxCurve:{m_PreInfinity:2,m_PostInfinity:2,m_Curve:[{time:0,value:0,weightedMode:1}]}}}])assert.throws(()=>createParticleAngularMotion(module));
 const m=createParticleAngularMotion({enabled:true,separateAxes:false,curve:c(1)});
 for(const change of [{age:-1},{lifetime:0},{age:3},{rotation:NaN},{rotation3D:[0,Infinity,0]}])assert.throws(()=>m.sample({...particle,...change},[0,0,0]));
 for(const factor of [[],[0,NaN,0],[0,2,0]])assert.throws(()=>m.sample(particle,factor));
});
