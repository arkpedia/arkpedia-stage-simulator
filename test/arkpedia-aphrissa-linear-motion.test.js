// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import profiles from './fixtures/arkpedia-aphrissa-linear-motion.json' with {type:'json'};
import meta from '../data/arkpedia-aphrissa-linear-motion.json' with {type:'json'};
import effects from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import {createParticleLinearVelocity} from '../shared/arkpedia/native-particle-linear-velocity.js';
import {createParticleMotion} from '../shared/arkpedia/native-particle-motion.js';
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
import {DISCRETE_CONE_ARC_CONTRACT} from '../shared/arkpedia/native-particle-cone.js';
import {particleBirthFrame,particleLocalVelocity,particleWorldPosition} from '../shared/arkpedia/native-particle-render.js';
const constant=scalar=>({minMaxState:0,scalar}),identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  rotated=[0,1,0,0,-1,0,0,0,0,0,1,0,10,20,30,1],still={frameAt:()=>({birth:identity,movement:identity})};
const near=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-9,`${v} != ${b[i]}`));};
const curve=()=>({minMaxState:1,scalar:2,maxCurve:{m_PreInfinity:2,m_PostInfinity:2,m_Curve:[
  {time:0,value:0,inSlope:1,outSlope:1,weightedMode:0},{time:1,value:1,inSlope:1,outSlope:1,weightedMode:0}]}});
function controlled(space=0,world=false){
  const s=structuredClone(Object.values(profiles)[0].data);
  Object.assign(s,{lengthInSec:2,looping:false,prewarm:false,moveWithTransform:space,simulationSpeed:1,startDelay:constant(0)});
  s.ShapeModule.enabled=s.NoiseModule.enabled=s.ForceModule.enabled=s.InheritVelocityModule.enabled=false;
  Object.assign(s.InitialModule,{startLifetime:constant(2),startSpeed:constant(0)});
  Object.assign(s.EmissionModule,{enabled:true,rateOverTime:constant(0),rateOverDistance:constant(0),m_BurstCount:1,
    m_Bursts:[{time:0,cycleCount:1,repeatInterval:.1,probability:1,countCurve:constant(1)}]});
  Object.assign(s.VelocityModule,{enabled:true,inWorldSpace:world,x:constant(1),y:constant(0),z:constant(0)});
  Object.assign(s.ClampVelocityModule,{enabled:true,dampen:0,magnitude:constant(100)});
  return s;
}

test('all original combined motion profiles retain full source controls and explicit ordering limits',async()=>{
  const raw=await readFile(new URL('./fixtures/arkpedia-aphrissa-linear-motion.json',import.meta.url));
  assert.equal(raw.length,meta.fixture.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),meta.fixture.sha256);
  assert.equal(meta.sourcePackSha256,effects.pack.sha256);assert.deepEqual(meta.counts,{profiles:11,local:10,world:1,roots:6,serializedInactive:3,probes:352});
  assert.deepEqual(meta.scope,{originalProfiles:true,intervalAveragedLinearVelocity:true,explicitCrossSpaceFrames:true,localReplay:true,
    nativeModuleOrderVerified:false,nativeFrameParity:false,enabledOperators:[]});
  for(const row of Object.values(profiles)){
    assert.equal(row.data.VelocityModule.enabled,true);assert.equal(row.data.ClampVelocityModule.enabled,true);assert.equal(row.data.NoiseModule.enabled,false);
    assert.ok(createParticleMotion(row.data));
  }
});

test('Hermite interval velocity preserves lifetime units and is not accumulated as acceleration',()=>{
  const s=controlled(),p={id:7,born:0,lifetime:2,age:.37};s.VelocityModule.x=curve();
  const linear=createParticleLinearVelocity(s);near(linear.average(p,.25,.375),[.3125,0,0]);
  near(linear.average(p,.5,.5),[.5,0,0]);near(createParticleMotion(s).sample(p,[4,5,6],[0,0,0]),[p.age*p.age/2,0,0]);
  s.VelocityModule.x=constant(3);const motion=createParticleMotion(s);
  near(motion.sample({...p,age:1},[4,5,6],[2,0,0]),[5,0,0]);
  near(motion.sample({...p,age:1/120},[4,5,6],[2,0,0]),[5/120,0,0]);
});

test('the existing speed-limit replay damps total lifetime velocity and retains its residual across ticks',()=>{
  const s=controlled();s.VelocityModule.x=constant(3);s.ClampVelocityModule.dampen=.5;s.ClampVelocityModule.magnitude=constant(1);
  const m=createParticleMotion(s),p={id:0,born:0,lifetime:2};
  near(m.sample({...p,age:1/60},[0,0,0],[0,0,0]),[2/60,0,0]);
  near(m.sample({...p,age:2/60},[0,0,0],[0,0,0]),[3.5/60,0,0]);
  near(m.sample({...p,age:1/120},[0,0,0],[0,0,0]),[(1+2*Math.sqrt(.5))/120,0,0]);
  s.ClampVelocityModule.dampen=1;near(createParticleMotion(s).sample({...p,age:.5},[0,0,0],[0,0,0]),[.5,0,0]);
  s.ClampVelocityModule.dampen=0;near(createParticleMotion(s).sample({...p,age:.5},[0,0,0],[0,0,0]),[1.5,0,0]);
});

test('all four lifetime/simulation space combinations use explicit direction frames without translating velocity',()=>{
  for(const space of [0,1])for(const world of [false,true]){
    const e=createMovingParticles(controlled(space,world)),frameAt=()=>({birth:rotated,movement:rotated});
    if(space===1||world)assert.throws(()=>e.sample(.5),/frame/);
    const p=e.sample(.5,{frameAt})[0];assert.ok(p);
    if(space===1)near(p.worldPosition,world?[10.5,20,30]:[10,20.5,30]);
    else{
      near(p.displacement,world?[0,-.5,0]:[.5,0,0]);
      near(particleWorldPosition(p,rotated,rotated),world?[10.5,20,30]:[10,20.5,30]);
      assert.equal(p.velocitySpace,'local');
    }
  }
  const e=createMovingParticles(controlled(1,false));
  const frameAt=t=>({birth:identity,movement:t>1/60?rotated:identity});
  near(e.sample(2/60,{frameAt})[0].worldPosition,[1/60,1/60,0]);
});

test('world-to-local velocity inversion preserves reflection and nonuniform/sheared axes while ignoring translations',()=>{
  const frame=[0,2,0,0,-3,0,0,0,0,0,-4,0,100,200,300,1];
  near(particleLocalVelocity([5,6,7],frame),[3,-5/3,-7/4]);
  for(const matrix of [frame,[2,.3,.1,0,.4,3,.2,0,.1,.2,4,0,-40,90,60,1]]){
    const local=particleLocalVelocity([5,6,7],matrix);near(particleBirthFrame([0,0,0],local,matrix).velocity,[5,6,7]);
  }
  const zero=identity.slice();zero[0]=0;assert.throws(()=>particleLocalVelocity([1,2,3],zero),/Singular/);
  assert.throws(()=>particleLocalVelocity([NaN,0,0],identity),/vector/);
});

test('all eleven original render paths preserve both lifetime velocity and limiting with their source shapes',()=>{
  let ready=0;
  for(const [id,row] of Object.entries(profiles)){
    const before=structuredClone(row.data);
    const e=createMovingParticles(row.data,{discreteArcContract:DISCRETE_CONE_ARC_CONTRACT}),a=e.sample(.3,still);e.sample(1,still);assert.deepEqual(e.sample(.3,still),a);
    assert.ok(a.every(p=>p.position.every(Number.isFinite)));assert.deepEqual(row.data,before);ready++;
  }
  assert.equal(ready,11);
  const replay=s=>createMovingParticles(s,{discreteArcContract:DISCRETE_CONE_ARC_CONTRACT});
  const s=structuredClone(profiles['battle/prefabs/effects/aphris.ab:7140871303917463449'].data),original=replay(s).sample(1,still);
  const noLinear=structuredClone(s);noLinear.VelocityModule.enabled=false;
  const noLimit=structuredClone(s);noLimit.ClampVelocityModule.enabled=false;
  assert.notDeepEqual(replay(noLinear).sample(1,still).map(p=>p.position),original.map(p=>p.position));
  assert.notDeepEqual(replay(noLimit).sample(1,still).map(p=>p.position),original.map(p=>p.position));
});

test('unsupported curves, orbital controls, frame ownership and invalid transforms cannot silently become zero motion',()=>{
  for(const change of [s=>s.VelocityModule.radial=constant(1),s=>s.VelocityModule.speedModifier=constant(2),
    s=>s.VelocityModule.inWorldSpace=2,s=>{s.VelocityModule.x=curve();s.VelocityModule.x.maxCurve.m_Curve[0].weightedMode=1;}]){
    const s=controlled();change(s);assert.throws(()=>createParticleMotion(s));
  }
  const s=controlled(1,false),m=createParticleMotion(s),p={id:0,born:0,lifetime:2,age:.1};
  assert.throws(()=>m.sample(p,[0,0,0],[0,0,0]),/explicit simulation frame/);
  for(const result of [undefined,[0,0],[NaN,0,0]])assert.throws(()=>m.sample(p,[0,0,0],[0,0,0],{linearVelocityTransform:()=>result}),/transformed/);
  for(const [from,to] of [[-.1,.2],[.3,.1],[0,Infinity],[0,3]])assert.throws(()=>createParticleLinearVelocity(s).average(p,from,to),/interval/);
});

test('zero lifetime velocity leaves existing coupled force, curl and speed damping unchanged',()=>{
  const s=controlled();s.VelocityModule.x=constant(0);s.ClampVelocityModule.dampen=.2;s.ClampVelocityModule.magnitude=constant(.7);
  Object.assign(s.NoiseModule,{enabled:true,quality:2,separateAxes:false,remapEnabled:false,rotationAmount:constant(0),sizeAmount:constant(0),
    frequency:.4,octaves:1,octaveMultiplier:.5,octaveScale:2,damping:true,strength:constant(.2),positionAmount:constant(1),scrollSpeed:constant(.2)});
  Object.assign(s.ForceModule,{enabled:true,inWorldSpace:false,randomizePerFrame:false,x:constant(.2),y:constant(-.3),z:constant(.1)});
  const without=structuredClone(s);without.VelocityModule.enabled=false;
  const p={id:7,born:.2,lifetime:2,age:.37};
  near(createParticleMotion(s).sample(p,[.1,.2,.3],[-3,0,0]),createParticleMotion(without).sample(p,[.1,.2,.3],[-3,0,0]));
  const nonzero=structuredClone(s);nonzero.VelocityModule.y=constant(.5);
  assert.notDeepEqual(createParticleMotion(nonzero).sample(p,[.1,.2,.3],[-3,0,0]),createParticleMotion(without).sample(p,[.1,.2,.3],[-3,0,0]));
});
