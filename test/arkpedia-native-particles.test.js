// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleParticleCurve,sampleParticleGradient} from '../shared/arkpedia/native-particle-curves.js';
import {createStationaryParticles} from '../shared/arkpedia/native-stationary-particles.js';
const constant=value=>({minMaxState:0,scalar:value,minScalar:value});
const key=(time,value,inSlope=0,outSlope=0)=>({time,value,inSlope,outSlope,weightedMode:0});
const curve=keys=>({m_Curve:keys,m_PreInfinity:2,m_PostInfinity:2});
const color=(r,g,b,a)=>({r,g,b,a});
const solid=c=>({minMaxState:0,maxColor:c});
const gradient={m_Mode:0,m_NumColorKeys:2,m_NumAlphaKeys:3,ctime0:0,ctime1:65535,
  atime0:0,atime1:32768,atime2:65535,key0:color(1,0,0,0),key1:color(0,0,1,1),key2:color(0,0,0,0)};

test('source Hermite slopes use segment duration, retain endpoints and clamp clocks',()=>{
 const c={minMaxState:1,scalar:2,maxCurve:curve([key(2,1,0,4),key(4,3,-2,0)])};
 // Midpoint: average values + (out-in)*duration/8 = 3.5, then multiplier 2.
 assert.equal(sampleParticleCurve(c,3),7);
 assert.equal(sampleParticleCurve(c,-1),2);assert.equal(sampleParticleCurve(c,10),6);
 assert.equal(sampleParticleCurve(c,2),2);assert.equal(sampleParticleCurve(c,4),6);
 const a={...c,minMaxState:2,minCurve:curve([key(2,0),key(4,0)])};
 assert.equal(sampleParticleCurve(a,3,.25),1.75);
 assert.equal(sampleParticleCurve({minMaxState:3,scalar:8,minScalar:2},100,.25),3.5);
 assert.equal(sampleParticleCurve(constant(4),-10),4);
});
test('RGB and alpha gradient clocks remain independent and source HDR values are preserved',()=>{
 const g={minMaxState:1,maxGradient:gradient},t=32768/65535;
 const value=sampleParticleGradient(g,t);
 assert.equal(value[0],1-t);assert.equal(value[2],t);assert.equal(value[3],1);
 assert.deepEqual(sampleParticleGradient(g,-1),[1,0,0,0]);
 assert.deepEqual(sampleParticleGradient(g,2),[0,0,1,0]);
 assert.deepEqual(sampleParticleGradient(solid(color(2,.5,0,1)),.5),[2,.5,0,1]);
 const two={minMaxState:2,minColor:color(0,0,0,0),maxColor:color(2,1,0,1)};
 assert.deepEqual(sampleParticleGradient(two,.75,.25),[.5,.25,0,.25]);
 assert.deepEqual(sampleParticleGradient({...g,minMaxState:4},0,t),value);
 assert.deepEqual(sampleParticleGradient({...g,minMaxState:3,minGradient:gradient},t,.25),value);
});
test('unsupported weighted/wrapped/invalid source curves fail visibly',()=>{
 const c={minMaxState:1,scalar:1,maxCurve:curve([key(0,0),key(1,1)])};
 for(const bad of [{...c,minMaxState:99},{...c,maxCurve:{...c.maxCurve,m_PreInfinity:0}},
  {...c,maxCurve:curve([key(0,0),{...key(1,1),weightedMode:1}])},
  {...c,maxCurve:curve([key(0,0),key(0,1)])}])assert.throws(()=>sampleParticleCurve(bad,.5));
 assert.throws(()=>sampleParticleCurve(c,NaN));
 assert.throws(()=>sampleParticleGradient({minMaxState:1,maxGradient:{...gradient,m_Mode:1}},.5));
 assert.throws(()=>sampleParticleGradient(solid(color(0,0,0,1)),NaN));
});
function emitter(){return {lengthInSec:1,looping:true,prewarm:false,moveWithTransform:0,ringBufferMode:0,
 simulationSpeed:1,startDelay:constant(0),playOnAwake:true,
 InitialModule:{enabled:true,maxNumParticles:1,rotation3D:false,randomizeRotationDirection:0,size3D:false,
 startSpeed:constant(0),gravityModifier:constant(0),startLifetime:constant(1),startSize:constant(.2),
 startRotation:constant(0),startColor:solid(color(1,0,0,1))},
 EmissionModule:{enabled:true,m_BurstCount:0,m_Bursts:[],rateOverTime:constant(10),rateOverDistance:constant(0)}};}
test('stationary emission observes capacity, expiry and reproducible backwards scrubbing',()=>{
 const source=emitter(),original=structuredClone(source),e=createStationaryParticles(source);
 assert.deepEqual(e.sample(0),[]);assert.equal(e.sample(.099).length,0);
 const p=e.sample(.1)[0];assert.equal(p.born,.1);assert.equal(p.age,0);assert.deepEqual(p.size,[.2,.2,.2]);
 assert.equal(e.sample(1)[0].born,.1);
 assert.equal(e.sample(1.1)[0].born,1.1);
 assert.deepEqual(e.sample(.25),e.sample(.25));
 e.sample(3);assert.deepEqual(e.sample(.1),[p]);assert.deepEqual(source,original);
});
test('source delay, simulation speed, prewarm and nonloop ending affect particle clocks',()=>{
 const s=emitter();s.startDelay=constant(.5);s.simulationSpeed=2;
 const e=createStationaryParticles(s);assert.deepEqual(e.sample(.249),[]);assert.equal(e.sample(.3)[0].born,.1);
 const warm=createStationaryParticles({...emitter(),prewarm:true});assert.equal(warm.sample(0)[0].age,.9);
 assert.deepEqual(warm.sample(-.25),[]);
 const finite=createStationaryParticles({...emitter(),looping:false});
 assert.equal(finite.sample(1)[0].born,.1);assert.deepEqual(finite.sample(1.2),[]);
 assert.deepEqual(createStationaryParticles({...emitter(),playOnAwake:false}).sample(1),[]);
});
test('single-particle high-rate scheduling agrees with ordinary event scheduling at birth/death boundaries',()=>{
 const a=emitter();a.InitialModule.startLifetime=constant(5);a.EmissionModule.rateOverTime=constant(1000);
 const b=structuredClone(a);b.InitialModule.startLifetime={minMaxState:3,scalar:5,minScalar:5};
 const fast=createStationaryParticles(a),reference=createStationaryParticles(b);
 for(const t of [0,.00099,.001,4.999,5,5.001,9.999,10.001])assert.deepEqual(fast.sample(t),reference.sample(t));
 assert.equal(fast.sample(1000)[0].born,995.001);
});
test('native bursts and lifetime gradients update 3D size and color without leaking between samples',()=>{
 const s=emitter();s.looping=false;s.EmissionModule.rateOverTime=constant(0);
 s.EmissionModule.m_BurstCount=1;s.EmissionModule.m_Bursts=[{time:0,cycleCount:1,repeatInterval:.1,probability:1,countCurve:constant(1)}];
 s.InitialModule.size3D=true;s.InitialModule.startSizeY=constant(.5);s.InitialModule.startSizeZ=constant(1);
 s.SizeModule={enabled:true,separateAxes:false,curve:{minMaxState:1,scalar:1,maxCurve:curve([key(0,1,0,-1),key(1,0,-1,0)])}};
 s.ColorModule={enabled:true,gradient:{minMaxState:1,maxGradient:gradient}};
 const e=createStationaryParticles(s),p=e.sample(.5)[0];
 assert.deepEqual(p.size,[.1,.25,.5]);assert.equal(p.color[0],.5);assert.equal(p.color[2],0);
 assert.ok(p.color[3]>.9999);assert.deepEqual(e.sample(1),[]);
 assert.equal(e.sample(0)[0].color[3],0);
});
test('unsupported active particle behavior is explicit rather than replaced with stationary art',()=>{
 for(const patch of [{ShapeModule:{enabled:true}},{moveWithTransform:1},{ringBufferMode:1}])assert.throws(()=>createStationaryParticles({...emitter(),...patch}));
 const s=emitter();s.InitialModule.startSpeed=constant(1);assert.throws(()=>createStationaryParticles(s),/Moving/);
 const r=emitter();r.EmissionModule.rateOverTime={minMaxState:3,scalar:2,minScalar:1};assert.throws(()=>createStationaryParticles(r),/integration/);
 assert.throws(()=>createStationaryParticles(emitter()).sample(Infinity));
});
