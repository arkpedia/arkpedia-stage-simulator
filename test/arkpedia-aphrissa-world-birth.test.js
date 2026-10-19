// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import rows from './fixtures/arkpedia-aphrissa-world-birth.json' with {type:'json'};
import meta from '../data/arkpedia-aphrissa-world-birth.json' with {type:'json'};
import effects from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
import {particleWorldPosition} from '../shared/arkpedia/native-particle-render.js';
const constant=scalar=>({minMaxState:0,scalar}),identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  a=[0,2,0,0,-3,0,0,0,0,0,-4,0,10,20,30,1],b=[1.5,0,0,0,0,-2,0,0,0,0,.5,0,-20,40,5,1];
const near=(x,y)=>{assert.equal(x.length,y.length);x.forEach((v,i)=>assert.ok(Math.abs(v-y[i])<1e-9,`${v} != ${y[i]}`));};
const original=()=>structuredClone(rows['battle/prefabs/effects/aphris.ab:181594443170011045'].data);
function controlled(){
  const s=original();Object.assign(s,{lengthInSec:2,prewarm:false,looping:false,simulationSpeed:1,startDelay:constant(0)});
  Object.assign(s.InitialModule,{startLifetime:constant(2),startSpeed:constant(3)});
  Object.assign(s.EmissionModule,{rateOverTime:constant(0),m_BurstCount:1,
    m_Bursts:[{time:0,cycleCount:1,repeatInterval:1,probability:1,countCurve:constant(1)}]});
  return s;
}

test('all original straight World profiles preserve their source controls and explicit prewarm/frame limits',async()=>{
  const raw=await readFile(new URL('./fixtures/arkpedia-aphrissa-world-birth.json',import.meta.url));
  assert.equal(raw.length,meta.fixture.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),meta.fixture.sha256);
  assert.equal(meta.sourcePackSha256,effects.pack.sha256);assert.deepEqual(meta.counts,{profiles:6,shapeDisabled:2,shapeEnabled:4,snapshots:32});
  assert.deepEqual(meta.scope,{originalProfiles:true,explicitBirthFrames:true,straightWorldKinematics:true,prewarmFramePolicy:'holdStartPose',
    nativePhaseVerified:false,compiledFrameParity:false,enabledOperators:[]});
  for(const r of Object.values(rows)){
    assert.equal(r.data.moveWithTransform,1);
    for(const k of ['VelocityModule','ClampVelocityModule','NoiseModule','ForceModule','InheritVelocityModule'])assert.equal(r.data[k].enabled,false);
    if(r.data.ShapeModule.enabled)assert.throws(()=>createMovingParticles(r.data),/Initial gradient clock/);
    else assert.equal(createMovingParticles(r.data).worldMotion,true);
  }
});

test('unforced particles retain the original birth point and movement velocity when the emitter changes afterwards',()=>{
  const s=controlled(),before=structuredClone(s),e=createMovingParticles(s);
  assert.throws(()=>e.sample(.5),/birth frame/);
  const frameAt=t=>({birth:t<=0?a:b,movement:t<=0?a:b}),p=e.sample(.5,{frameAt})[0];
  near(p.worldPosition,[10,20,24]);near(p.displacement,[0,0,-6]);assert.equal(p.velocitySpace,'world');
  near(particleWorldPosition(p,a,b),[10,20,24]);assert.deepEqual(s,before);
  // Shape-only scaling supplies separate spawn and movement matrices.
  const shapeOnly=e.sample(.5,{frameAt:()=>({birth:a,movement:identity})})[0];near(shapeOnly.worldPosition,[10,20,31.5]);
  const local=structuredClone(s);local.moveWithTransform=0;
  const q=createMovingParticles(local).sample(.5)[0];assert.equal(q.velocitySpace,'local');
  near(particleWorldPosition(q,a,b),[-20,40,5.75]);
});

test('original prewarm particles use the explicit start pose while later births use their own later frame',()=>{
  const s=original(),before=structuredClone(s),e=createMovingParticles(s),frameAt=t=>{
    t=Math.max(0,t);return {birth:t<.1?a:b,movement:t<.1?a:b};
  };
  const first=e.sample(0,{frameAt}),later=e.sample(.8,{frameAt});assert.ok(first.length>0&&first.every(p=>p.birthTime<0));
  const old=later.filter(p=>p.birthTime<.1),fresh=later.filter(p=>p.birthTime>=.1);assert.ok(old.length>0&&fresh.length>0);
  for(const p of old)near(p.worldPosition,[10,20,30]);for(const p of fresh)near(p.worldPosition,[-20,40,5]);
  e.sample(2,{frameAt});assert.deepEqual(e.sample(.8,{frameAt}),later);assert.deepEqual(e.sample(0,{frameAt}),first);assert.deepEqual(s,before);
});

test('collapsed birth transforms stay finite without taking an inverse or moving old particles to a later emitter',()=>{
  const s=controlled(),collapsed=[0,0,0,0,0,0,0,0,0,0,0,0,10,20,30,1],e=createMovingParticles(s),
    p=e.sample(.5,{frameAt:t=>({birth:t<=0?collapsed:b,movement:t<=0?collapsed:b})})[0];
  near(p.worldPosition,[10,20,30]);near(p.displacement,[0,0,0]);
  assert.throws(()=>e.sample(.5,{frameAt:()=>({birth:a})}),/spawn and movement/);
  const bad=a.slice();bad[3]=1;assert.throws(()=>e.sample(.5,{frameAt:()=>({birth:bad,movement:a})}),/affine/);
  const fresh=e.sample(.5,{frameAt:()=>({birth:a,movement:a})});fresh[0].worldPosition[0]=999;
  near(e.sample(.5,{frameAt:()=>({birth:a,movement:a})})[0].worldPosition,[10,20,24]);
});
