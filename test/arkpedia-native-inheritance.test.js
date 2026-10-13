// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createParticleInheritance} from '../shared/arkpedia/native-particle-inheritance.js';
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
import {particleWorldPosition} from '../shared/arkpedia/native-particle-render.js';
import fixtures from './fixtures/arkpedia-particle-inheritance.json' with {type:'json'};
import meta from '../data/arkpedia-particle-inheritance.json' with {type:'json'};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`),c=scalar=>({minMaxState:0,scalar});
const original=fixtures['battle/prefabs/effects/phatm2.ab:-4119380815037304229'].data;
const matrix=(x=0,y=0,z=0)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const frameAt=t=>({birth:matrix(t,2*t,-t),movement:matrix(t,2*t,-t)});
function plain(){const s=structuredClone(original);s.ShapeModule.enabled=false;s.ClampVelocityModule.enabled=false;
 s.ColorModule.enabled=false;s.SizeModule.enabled=false;s.UVModule.enabled=false;
 s.startDelay=c(0);s.prewarm=false;s.looping=false;s.lengthInSec=3;s.simulationSpeed=1;
 s.InitialModule.startLifetime=c(4);s.EmissionModule.rateOverTime=c(4);s.EmissionModule.m_Bursts=[];s.EmissionModule.m_BurstCount=0;
 s.InheritVelocityModule.m_Curve=c(1);return s;}
test('inheritance inventory retains nine source particles/renderers and no premature operator approval',()=>{
 const bytes=readFileSync(new URL('./fixtures/arkpedia-particle-inheritance.json',import.meta.url));
 assert.equal(bytes.length,meta.fixture.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.fixture.sha256);
 assert.equal(Object.keys(fixtures).length,9);assert.deepEqual(Object.keys(fixtures),Object.keys(meta.particles));
 assert.deepEqual(meta.scope,{sourceMapping:true,localReplay:true,velocityAcquisition:'explicitWorldVelocity',compiledFrameParity:false,enabledOperators:[]});
 for(const [id,r]of Object.entries(fixtures)){
  assert.equal(r.particleSha256,meta.particles[id].particleSha256);assert.equal(r.renderer.sha256,meta.particles[id].rendererSha256);
  assert.equal(r.data.InheritVelocityModule.m_Mode,0);assert.equal(r.data.InheritVelocityModule.m_Curve.scalar,.10000000149011612);
  assert.equal(r.data.emitterVelocityMode,0);assert.equal(r.data.moveWithTransform,1);
  assert.equal(r.data.ShapeModule.type,0);assert.notEqual(r.data.ShapeModule.m_Mesh.m_PathID,'0');
 }
});
for(const [id,r]of Object.entries(fixtures))test(id+' retains source sphere, world inheritance, emission, limiting and sheet without mutating evidence',()=>{
 const before=structuredClone(r.data),emitter=createMovingParticles(r.data),particles=emitter.sample(1.8,{frameAt,emitterVelocityAt:()=>[1,2,-1]});
 assert.equal(emitter.worldMotion,true);
 if(r.data.EmissionModule.rateOverTime.scalar===0){
  assert.ok(r.data.EmissionModule.m_Bursts.every(b=>b.countCurve.minMaxState===0&&b.countCurve.scalar===0));
  assert.deepEqual(particles,[]); // Retain original zero emission; never invent particles.
 }else assert.ok(particles.length>0);
 for(const p of particles){
  assert.ok(p.worldPosition.every(Number.isFinite));assert.ok(p.sheet.frame>=0&&p.sheet.frame<4);
  p.inheritedVelocity.forEach((v,i)=>near(v,[1,2,-1][i]*r.data.InheritVelocityModule.m_Curve.scalar));
  assert.deepEqual(particleWorldPosition(p,matrix(),[0,2,0,0,-3,0,0,0,0,0,4,0,100,200,300,1]),p.worldPosition);
 }
 emitter.sample(3,{frameAt,emitterVelocityAt:()=>[1,2,-1]});assert.deepEqual(emitter.sample(1.8,{frameAt,emitterVelocityAt:()=>[1,2,-1]}),particles);
 assert.deepEqual(r.data,before);
});
test('Initial inheritance preserves birth velocity when the emitter later stops or turns',()=>{
 const s=plain(),e=createMovingParticles(s),v=t=>t<.5?[1,2,-1]:[-2,0,3];
 const particles=e.sample(1,{frameAt,emitterVelocityAt:v});assert.equal(particles.length,4);
 for(const p of particles){const born=v(p.birthTime);p.inheritedVelocity.forEach((x,i)=>near(x,born[i]));
  p.displacement.forEach((x,i)=>near(x,born[i]*p.age));}
 assert.notDeepEqual(particles[0].inheritedVelocity,particles.at(-1).inheritedVelocity);
});
test('Current inheritance reacts to an emitter stop and turn instead of keeping birth momentum',()=>{
 const s=plain();s.InheritVelocityModule.m_Mode=1;const e=createMovingParticles(s);
 // The explicit local replay samples the right endpoint of each 60 Hz step.
 const velocityAt=t=>t<=.5?[1,0,0]:[0,2,0],p=e.sample(1,{frameAt,emitterVelocityAt:velocityAt})[0];
 near(p.age,.75);near(p.displacement[0],.25);near(p.displacement[1],1);near(p.displacement[2],0);
 e.sample(2,{frameAt,emitterVelocityAt:velocityAt});assert.deepEqual(e.sample(1,{frameAt,emitterVelocityAt:velocityAt})[0],p);
});
test('simulation speed and delay use real birth time while movement integrates simulated age',()=>{
 const s=plain();s.simulationSpeed=.5;s.startDelay=c(.25);
 const particles=createMovingParticles(s).sample(2,{frameAt,emitterVelocityAt:t=>[t,0,0]});assert.equal(particles.length,3);
 for(const p of particles){near(p.birthTime,(p.born+.25)/.5);near(p.inheritedVelocity[0],p.birthTime);near(p.displacement[0],p.birthTime*p.age);}
});
test('authored lifetime multiplier curves change inheritance with a stable per-particle factor',()=>{
 const s=plain();s.InheritVelocityModule.m_Curve={minMaxState:1,scalar:2,maxCurve:{m_Curve:[
  {time:0,value:1,outSlope:-1,inSlope:-1,weightedMode:0},{time:1,value:0,inSlope:-1,outSlope:-1,weightedMode:0}],m_PreInfinity:2,m_PostInfinity:2}};
 const inherit=createParticleInheritance(s),p={id:3,age:1,lifetime:2};
 const sample=inherit.sample(p,2,()=>[2,-1,0]);assert.deepEqual(sample(0),[4,-2,0]);assert.deepEqual(sample(1),[2,-1,0]);assert.deepEqual(sample(2),[0,-0,0]);
 s.InheritVelocityModule.m_Curve={minMaxState:3,minScalar:.2,scalar:.8};
 const a=createParticleInheritance(s).sample(p,2,()=>[1,0,0]);near(a(0)[0],a(1)[0]);assert.ok(a(0)[0]>.2&&a(0)[0]<.8);
});
test('Initial inheritance is damped once rather than restored every integration tick',()=>{
 const s=plain();s.ClampVelocityModule={enabled:true,separateAxis:false,drag:c(0),dampen:1,magnitude:c(.2)};
 const p=createMovingParticles(s).sample(.5,{frameAt,emitterVelocityAt:()=>[3,4,0]})[0];
 near(p.displacement[0],.2*.6*.25);near(p.displacement[1],.2*.8*.25);
});
test('limited Current inheritance stops without an artificial reverse kick',()=>{
 const s=plain();s.InheritVelocityModule.m_Mode=1;
 s.ClampVelocityModule={enabled:true,separateAxis:false,drag:c(0),dampen:1,magnitude:c(.2)};
 const e=createMovingParticles(s),emitterVelocityAt=t=>t<=.5?[10,0,0]:[0,0,0];
 const p=e.sample(1,{frameAt,emitterVelocityAt})[0];
 near(p.displacement[0],.2*.25);near(p.displacement[1],0);near(p.displacement[2],0);
});
test('world inheritance adds after the authored velocity frame and is not scaled or rotated twice',()=>{
 const s=plain();s.InitialModule.startSpeed=c(2);
 const rotated=[0,2,0,0,-3,0,0,0,0,0,4,0,10,20,30,1],p=createMovingParticles(s).sample(.5,{frameAt:()=>({birth:rotated,movement:rotated}),emitterVelocityAt:()=>[1,-2,3]})[0];
 // Shape is disabled: its authored initial direction is local +Z, scaled to 8.
 [1,-2,11].forEach((v,i)=>near(p.displacement[i],v*p.age));
 [10,20,30].forEach((v,i)=>near(p.worldPosition[i],v+[1,-2,11][i]*p.age));
});
test('Local space has no inherited motion and external/unknown sources never default to zero',()=>{
 const s=plain();s.moveWithTransform=0;
 assert.equal(createParticleInheritance(s),null);const e=createMovingParticles(s);assert.ok(e.sample(1).every(p=>p.displacement.every(v=>v===0)));
 for(const change of [s=>s.emitterVelocityMode=1,s=>s.emitterVelocityMode=2,s=>s.InheritVelocityModule.m_Mode=2,s=>s.SubModule.enabled=true]){
  const source=plain();change(source);assert.throws(()=>createMovingParticles(source));}
 const emitter=createMovingParticles(plain());assert.throws(()=>emitter.sample(1,{frameAt}),/explicit world emitter/);
 for(const value of [[1,2],[0,NaN,0],[0,0,Infinity]])assert.throws(()=>emitter.sample(1,{frameAt,emitterVelocityAt:()=>value}),/Invalid inherited/);
 const active=plain();active.ShapeModule.type=6;active.ShapeModule.enabled=true;assert.throws(()=>createMovingParticles(active),/shape\/direction/);
 const texture=plain();texture.ShapeModule.enabled=true;texture.ShapeModule.m_Texture.m_PathID='1';assert.throws(()=>createMovingParticles(texture),/shape resource/);
});
