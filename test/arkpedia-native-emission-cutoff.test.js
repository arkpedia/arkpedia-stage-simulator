// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {createParticleBirthClock} from '../shared/arkpedia/native-particle-birth-clock.js';
import {createParticleLifecycle} from '../shared/arkpedia/native-particle-lifecycle.js';
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
const c=scalar=>({minMaxState:0,scalar}),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function source(){return{lengthInSec:1,looping:true,prewarm:false,moveWithTransform:0,ringBufferMode:0,scalingMode:1,
 simulationSpeed:1,startDelay:c(0),playOnAwake:true,InitialModule:{enabled:true,maxNumParticles:100,rotation3D:false,randomizeRotationDirection:0,size3D:false,
 startSpeed:c(0),gravityModifier:c(0),startLifetime:c(1),startSize:c(1),startRotation:c(0),startColor:{minMaxState:0,maxColor:{r:1,g:1,b:1,a:1}}},
 EmissionModule:{enabled:true,m_BurstCount:0,m_Bursts:[],rateOverTime:c(10),rateOverDistance:c(0)}};}
test('an exclusive finish boundary preserves earlier accepted IDs and ages through capacity rejection',()=>{
 const s=source();s.InitialModule.maxNumParticles=2;s.InitialModule.startLifetime=c(.25);const clock=createParticleBirthClock(s),before=structuredClone(s);
 assert.deepEqual(clock.births(1,{emissionUntil:.5}).map(p=>[p.id,p.born]),[[0,.1],[1,.2],[3,.4]]);
 const alive=clock.sample(.6,{emissionUntil:.5});assert.equal(alive.length,1);assert.equal(alive[0].id,3);near(alive[0].age,.2);
 assert.deepEqual(clock.sample(.7,{emissionUntil:.5}),[]);assert.deepEqual(clock.sample(.4,{emissionUntil:.5}),clock.sample(.4));
 const retained=clock.sample(.6,{emissionUntil:.5});clock.sample(100,{emissionUntil:.5});assert.deepEqual(clock.sample(.6,{emissionUntil:.5}),retained);
 assert.deepEqual(s,before);assert.deepEqual(clock.sample(.1,{emissionUntil:0}),[]);
});
test('cutoffs use real seconds while delay, simulation speed and lifetime remain source-local',()=>{
 const s=source();s.simulationSpeed=2;s.startDelay=c(.4);s.InitialModule.startLifetime=c(.5);s.EmissionModule.rateOverTime=c(5);
 const clock=createParticleBirthClock(s),births=clock.births(10,{emissionUntil:.5});assert.equal(births.length,2);
 near(births[0].birthTime,.3);near(births[1].birthTime,.4);const alive=clock.sample(.6,{emissionUntil:.5});assert.equal(alive.length,1);assert.equal(alive[0].id,1);near(alive[0].age,.4);
 assert.deepEqual(clock.sample(.2,{emissionUntil:.2}),[]);assert.deepEqual(clock.sample(.8,{emissionUntil:.5}),[]);
});
test('delayed prewarm is not fabricated after an earlier stop; its original virtual births survive a later stop',()=>{
 const s=source();s.prewarm=true;s.simulationSpeed=2;s.startDelay=c(.5);s.InitialModule.startLifetime=c(2);s.EmissionModule.rateOverTime=c(4);
 const clock=createParticleBirthClock(s);assert.deepEqual(clock.sample(1,{emissionUntil:.25}),[]);
 const births=clock.births(10,{emissionUntil:.251});assert.deepEqual(births.map(p=>p.id),[0,1,2,3]);
 births.forEach((p,i)=>near(p.birthTime,[-.125,0,.125,.25][i]));assert.equal(clock.sample(.7,{emissionUntil:.251}).length,4);
 assert.deepEqual(clock.sample(1.3,{emissionUntil:.251}),[]);
});
test('burst cohorts before the cutoff keep their original cohort, IDs and random identities',()=>{
 const s=source();s.EmissionModule.rateOverTime=c(0);s.EmissionModule.m_BurstCount=1;
 s.EmissionModule.m_Bursts=[{time:0,cycleCount:2,repeatInterval:.25,probability:1,countCurve:c(2)}];
 const clock=createParticleBirthClock(s),births=clock.births(.8,{emissionUntil:.25});assert.deepEqual(births.map(p=>[p.id,p.born]),[[0,0],[1,0]]);
 assert.deepEqual(clock.cohort(births[1]),{born:0,index:1,count:2});
 const e=createParticleLifecycle(s),actual=e.sample(.5,{emissionUntil:.25}),normal=e.sample(.5).filter(p=>p.id<2);assert.deepEqual(actual,normal);
 assert.deepEqual(e.sample(1.1,{emissionUntil:.25}),[]);
});
test('world distance emission truncates at the cutoff rather than resuming on a later movement segment',()=>{
 const s=source();s.moveWithTransform=1;s.EmissionModule.rateOverTime=c(0);s.EmissionModule.rateOverDistance=c(2);
 const clock=createParticleBirthClock(s,{allowDistanceEmission:true}),history=[{time:0,position:[0,0,0]},{time:.5,position:[1,0,0]},{time:1,position:[2,0,0]}];
 assert.deepEqual(clock.births(10,{history,emissionUntil:.5}).map(p=>p.born),[.25]);
 const p=clock.sample(.8,{history,emissionUntil:.6});assert.deepEqual(p.map(p=>p.born),[.25,.5]);near(p[0].age,.55);near(p[1].age,.3);
});
test('capacity-one fast scheduling retains the same final accepted birth and bounded replay after finish',()=>{
 const s=source();s.InitialModule.maxNumParticles=1;s.InitialModule.startLifetime=c(5);s.EmissionModule.rateOverTime=c(1000);
 const clock=createParticleBirthClock(s);assert.deepEqual(clock.sample(5.1,{emissionUntil:5.001}),[]);
 assert.deepEqual(clock.births(100,{emissionUntil:5.001}).map(p=>[p.id,p.born]),[[0,.001]]);
 assert.equal(clock.sample(5.1,{emissionUntil:5.002})[0].id,5000);
 assert.deepEqual(clock.sample(1e8,{emissionUntil:5.002}),[]);assert.throws(()=>clock.sample(1e8),/budget/);
});
test('moving particles keep simulating their accepted birth frame after emission stops',()=>{
 const s=source();s.moveWithTransform=1;s.InitialModule.startSpeed=c(2);
 const matrix=x=>[1,0,0,0,0,1,0,0,0,0,1,0,x,0,0,1],frames={frameAt:t=>({birth:matrix(t*10),movement:matrix(t*10)})},e=createMovingParticles(s);
 const p=e.sample(.6,{...frames,emissionUntil:.3});assert.deepEqual(p.map(p=>p.id),[0,1]);
 p.forEach((v,i)=>{near(v.position[0],(i+1));near(v.position[2],2*(.6-v.birthTime));});
 const original=e.sample(.6,frames).filter(p=>p.birthTime<.3);assert.deepEqual(p,original);
 e.sample(2,{...frames,emissionUntil:.3});assert.deepEqual(e.sample(.6,{...frames,emissionUntil:.3}),p);
});
test('invalid cutoff clocks never silently become unrestricted emission',()=>{
 const s=source(),clock=createParticleBirthClock(s),e=createParticleLifecycle(s),moving=createMovingParticles(s);
 for(const emissionUntil of [-1,NaN,Infinity,'1',false]){
  assert.throws(()=>clock.events(.5,{emissionUntil}),/cutoff/);assert.throws(()=>clock.sample(.5,{emissionUntil}),/cutoff/);
  assert.throws(()=>e.sample(.5,{emissionUntil}),/cutoff/);assert.throws(()=>moving.sample(.5,{emissionUntil}),/cutoff/);
 }
});
