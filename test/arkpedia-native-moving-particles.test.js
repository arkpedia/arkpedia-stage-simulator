// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createMovingParticles,integrateParticleCurve} from '../shared/arkpedia/native-moving-particles.js';
import {particleWorldPosition,particleSheetUV} from '../shared/arkpedia/native-particle-render.js';
import {sampleParticleCurve} from '../shared/arkpedia/native-particle-curves.js';
const constant=scalar=>({minMaxState:0,scalar}),range=(a,b)=>({minMaxState:3,minScalar:a,scalar:b});
const key=(time,value,inSlope=0,outSlope=0)=>({time,value,inSlope,outSlope,weightedMode:0});
const keys=values=>({m_Curve:values,m_PreInfinity:2,m_PostInfinity:2});
const zero={x:0,y:0,z:0};
function source(){return {lengthInSec:1,looping:true,prewarm:false,moveWithTransform:1,ringBufferMode:0,scalingMode:1,
 simulationSpeed:1,startDelay:constant(0),playOnAwake:true,
 InitialModule:{enabled:true,maxNumParticles:100,rotation3D:false,randomizeRotationDirection:0,size3D:false,
 startSpeed:range(0,0),gravityModifier:constant(0),startLifetime:constant(2),startSize:constant(.1),startRotation:constant(0),startColor:{minMaxState:0,maxColor:{r:1,g:0,b:0,a:1}}},
 EmissionModule:{enabled:true,m_BurstCount:0,m_Bursts:[],rateOverTime:constant(5),rateOverDistance:constant(0)},
 ShapeModule:{enabled:true,type:5,alignToDirection:false,randomDirectionAmount:0,sphericalDirectionAmount:0,randomPositionAmount:0,
 m_Position:{...zero},m_Rotation:{...zero},m_Scale:{x:2,y:4,z:0},...Object.fromEntries(['m_Texture','m_Mesh','m_MeshRenderer','m_SkinnedMeshRenderer','m_Sprite','m_SpriteRenderer'].map(k=>[k,{m_PathID:'0'}]))},
 VelocityModule:{enabled:true,inWorldSpace:false,x:constant(-.5),y:constant(.25),z:constant(0),speedModifier:constant(1),
 ...Object.fromEntries(['orbitalX','orbitalY','orbitalZ','orbitalOffsetX','orbitalOffsetY','orbitalOffsetZ','radial'].map(k=>[k,constant(0)]))},
 UVModule:{enabled:true,mode:0,animationType:0,timeMode:0,flipU:0,flipV:0,tilesX:2,tilesY:2,cycles:1,uvChannelMask:-1,startFrame:constant(0),
 frameOverTime:{minMaxState:1,scalar:1,maxCurve:keys([key(0,0,1,1),key(1,1,1,1)])}}};}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('lifetime velocity integral preserves Hermite tangents, min/max factors and clamped tails',()=>{
 const c={minMaxState:1,scalar:2,maxCurve:keys([key(.2,1,-2,4),key(.6,3,-2,1),key(.9,-1,3,2)])};
 // Independent composite Simpson integration of the sampled velocity, with
 // subintervals split at every source key so clamped tails remain independent.
 const simpson=(a,b,curve,factor)=>{
  const n=1000,h=(b-a)/n;let sum=sampleParticleCurve(curve,a,factor)+sampleParticleCurve(curve,b,factor);
  for(let i=1;i<n;i++)sum+=(i%2?4:2)*sampleParticleCurve(curve,a+i*h,factor);
  return sum*h/3;
 };
 for(const q of [c,{...c,minMaxState:2,minCurve:keys([key(.2,-2),key(.9,1)])}])for(const f of [0,.25,1]){
  const edges=[-1,.2,.6,.9,2],expected=edges.slice(1).reduce((sum,b,i)=>sum+simpson(edges[i],b,q,f),0);
  near(integrateParticleCurve(q,-1,2,f),expected);near(integrateParticleCurve(q,2,-1,f),-expected);
 }
 near(integrateParticleCurve(range(2,8),.1,.6,.25),1.75);
 assert.throws(()=>integrateParticleCurve({...c,maxCurve:{...c.maxCurve,m_PreInfinity:0}},0,1));
 assert.throws(()=>integrateParticleCurve(c,0,NaN));
});
test('box births stay within original volume; velocity is integrated over particle age',()=>{
 const s=source(),baseline=structuredClone(s),e=createMovingParticles(s),p=e.sample(.5);
 assert.equal(p.length,2);assert.equal(p[0].born,.2);near(p[0].age,.3);
 for(const part of p){
  assert.ok(part.origin[0]>=-1&&part.origin[0]<=1);assert.ok(part.origin[1]>=-2&&part.origin[1]<=2);assert.equal(part.origin[2],0);
  near(part.displacement[0],-.5*part.age);near(part.displacement[1],.25*part.age);near(part.position[0],part.origin[0]+part.displacement[0]);
  near(part.birthTime,part.born);assert.equal(part.simulationSpace,'world');
 }
 e.sample(5);assert.deepEqual(e.sample(.5),p);assert.deepEqual(s,baseline);
});
test('shape rotation and offset affect births without rotating lifetime velocity axes',()=>{
 const a=source(),b=structuredClone(a);b.ShapeModule.m_Rotation.z=90;b.ShapeModule.m_Position={x:10,y:20,z:30};
 const p=createMovingParticles(a).sample(.25)[0],q=createMovingParticles(b).sample(.25)[0];
 near(q.origin[0],10-p.origin[1]);near(q.origin[1],20+p.origin[0]);near(q.origin[2],30);
 assert.deepEqual(q.displacement,p.displacement);
});
test('prewarm and simulation speed retain physical birth times for world emission',()=>{
 const s=source();s.prewarm=true;s.simulationSpeed=2;s.startDelay=constant(.5);
 const e=createMovingParticles(s);assert.deepEqual(e.sample(.249),[]);
 for(const p of e.sample(.5))near(p.birthTime,.5-p.age/2);
 assert.ok(e.sample(.5).some(p=>p.birthTime<0));
});
test('normalized grid clocks select top-to-bottom frames and wrap cycles',()=>{
 const s=source();s.EmissionModule.rateOverTime=constant(0);s.EmissionModule.m_BurstCount=1;
 s.EmissionModule.m_Bursts=[{time:0,cycleCount:1,repeatInterval:.1,probability:1,countCurve:constant(1)}];
 const e=createMovingParticles(s);
 for(const [t,frame,offset] of [[0,0,[0,.5]],[.5,1,[.5,.5]],[1,2,[0,0]],[1.5,3,[.5,0]]]){
  const p=e.sample(t)[0];assert.equal(p.sheet.frame,frame);assert.deepEqual(p.sheet.offset,offset);
 }
 const firstRow=e.sample(.5)[0].sheet;
 s.UVModule.startFrame=constant(.9999);const shifted=createMovingParticles(s);
 assert.equal(shifted.sample(0)[0].sheet.frame,3);assert.equal(shifted.sample(.5)[0].sheet.frame,0);
 s.UVModule.startFrame=constant(0);s.UVModule.cycles=2;assert.equal(createMovingParticles(s).sample(1)[0].sheet.frame,0);
 assert.deepEqual([...particleSheetUV([0,1,1,1,0,0,1,0],firstRow)],[.5,1,1,1,.5,.5,1,.5]);
});
const matrix=(x=0,y=0,z=0)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
test('world particles remain at their birth origin when the emitter translates; local particles follow it',()=>{
 const p={simulationSpace:'world',velocitySpace:'local',origin:[1,2,0],displacement:[-.5,.25,0]};
 assert.deepEqual(particleWorldPosition(p,matrix(10,20),matrix(100,200)),[10.5,22.25,0]);
 assert.deepEqual(particleWorldPosition({...p,simulationSpace:'local'},matrix(10,20),matrix(100,200)),[100.5,202.25,0]);
 const scaled=matrix(100,200);scaled[0]=2;assert.throws(()=>particleWorldPosition(p,matrix(10,20),scaled),/integration/);
 const shapeScale=matrix(10,20);shapeScale[0]=3;shapeScale[5]=4;
 assert.deepEqual(particleWorldPosition(p,shapeScale,shapeScale,matrix()),[12.5,28.25,0]);
 const rotated=[0,1,0,0,-1,0,0,0,0,0,1,0,0,0,0,1];
 assert.deepEqual(particleWorldPosition(p,rotated,rotated),[-2.25,.5,0]);
 assert.deepEqual(particleWorldPosition({...p,velocitySpace:'world'},rotated,rotated),[-2.5,1.25,0]);
});
test('unimplemented modules and source formats stay explicit instead of losing their behavior',()=>{
 for(const patch of [{NoiseModule:{enabled:true}},{ClampVelocityModule:{enabled:true}},{TrailModule:{enabled:true}}])assert.throws(()=>createMovingParticles({...source(),...patch}));
 const changes=[s=>s.ShapeModule.type=4,s=>s.ShapeModule.randomPositionAmount=.1,s=>s.ShapeModule.m_Texture.m_PathID='123',
  s=>s.VelocityModule.radial=constant(1),s=>s.VelocityModule.speedModifier=constant(2),s=>{s.moveWithTransform=0;s.VelocityModule.inWorldSpace=true;},
  s=>s.UVModule.timeMode=2,s=>s.UVModule.tilesX=0,s=>s.UVModule.flipU=1,s=>s.UVModule.animationType=1];
 for(const change of changes){const s=source();change(s);assert.throws(()=>createMovingParticles(s));}
 assert.throws(()=>particleWorldPosition({origin:[0,0,0]},[],matrix()));
 assert.throws(()=>particleSheetUV([1],null));
});
test('pinned original wolf motes use source ranges, lifespan, color, UV grid and reversed velocity range',async t=>{
 let bytes;try{bytes=await readFile('.cache/arkpedia/lappland-alter-source/effects/native-effects.bin');}catch(e){if(e.code==='ENOENT'){t.skip('Original source cache unavailable');return;}throw e;}
 const manifest=JSON.parse(await readFile('data/arkpedia-lappland-effects.json'));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.pack.sha256);
 const pack=JSON.parse(gunzipSync(bytes));
 const s=pack.records['battle/prefabs/effects/whitw2.ab:-4709374192333049107'].data,baseline=structuredClone(s);
 assert.equal(s.VelocityModule.x.minScalar,-.25);assert.equal(s.VelocityModule.x.scalar,-.5);
 const e=createMovingParticles(s),snapshot=e.sample(.5);assert.ok(snapshot.length>0);
 for(const p of snapshot){
  assert.ok(p.lifetime>=.1&&p.lifetime<=2);assert.equal(p.origin[2],0);
  assert.ok(Math.abs(p.origin[0])<=.6700000166893005/2);assert.ok(Math.abs(p.origin[1])<=.23000000417232513/2);
  assert.ok(p.displacement[0]<=-.25*p.age+1e-9&&p.displacement[0]>=-.5*p.age-1e-9);
  assert.ok(p.displacement[1]>=.25*p.age-1e-9&&p.displacement[1]<=.5*p.age+1e-9);
  assert.ok(p.sheet.frame>=0&&p.sheet.frame<4);assert.ok(p.color.every(Number.isFinite));assert.equal(p.simulationSpace,'world');
 }
 e.sample(10);assert.deepEqual(e.sample(.5),snapshot);assert.deepEqual(s,baseline);
});
