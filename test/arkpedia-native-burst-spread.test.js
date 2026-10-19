// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {createParticleBirthClock} from '../shared/arkpedia/native-particle-birth-clock.js';
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
import {createParticleCone,BURST_SPREAD_CONE_CONTRACT} from '../shared/arkpedia/native-particle-cone.js';
import rows from './fixtures/arkpedia-aphrissa-hit-shapes.json' with {type:'json'};
const c=scalar=>({minMaxState:0,scalar}),near=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-9,`${v} != ${b[i]}`));},
  identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],still={frameAt:()=>({birth:identity,movement:identity})},options={burstSpreadContract:BURST_SPREAD_CONE_CONTRACT};
function source(kind='burstSpread'){
  const s=structuredClone(Object.values(rows).find(r=>r.kind===kind).data);
  Object.assign(s,{lengthInSec:1,looping:false,prewarm:false,simulationSpeed:1,startDelay:c(0),playOnAwake:true});
  s.InitialModule.startLifetime=c(.1);s.InitialModule.maxNumParticles=2;
  Object.assign(s.EmissionModule,{enabled:true,rateOverTime:c(0),rateOverDistance:c(0),m_BurstCount:2,
    m_Bursts:[0,.2].map(time=>({time,countCurve:c(5),cycleCount:1,repeatInterval:.1,probability:1}))});
  return s;
}

test('burst cohort membership keeps original attempt slots after expiry, capacity rejection and reverse clocks',()=>{
  const s=source(),clock=createParticleBirthClock(s),births=clock.births(.3);
  assert.deepEqual(births.map(p=>p.id),[0,1,5,6]);assert.deepEqual(clock.sample(.3),[]);
  assert.deepEqual(births.map(p=>clock.cohort(p)),[{born:0,index:0,count:5},{born:0,index:1,count:5},
    {born:.2,index:0,count:5},{born:.2,index:1,count:5}]);
  const e=createMovingParticles(s,options),first=e.sample(.01,still);e.sample(.25,still);assert.deepEqual(e.sample(.01,still),first);
  for(const [index,p] of first.entries()){
    const phase=Math.atan2(p.origin[1],p.origin[0]);near([phase],[index*2*Math.PI/5]);
  }
  for(const p of [{...births[0],id:2},{...births[0],lifetime:99},{...births[0],lifetime:0},{...births[0],born:.01},{...births[0],id:NaN}])assert.throws(()=>clock.cohort(p),/cohort/);
});

test('looping prewarm and scaled delay clocks resolve cohorts at physical birth without compacting their identities',()=>{
  const s=source();s.looping=true;s.prewarm=true;s.simulationSpeed=2;s.startDelay=c(.2);s.InitialModule.maxNumParticles=100;
  const clock=createParticleBirthClock(s),births=clock.births(.8);assert.ok(births.some(p=>p.birthTime<0));
  assert.ok(births.some(p=>p.born>=1));
  for(const p of births){const cohort=clock.cohort(p);assert.equal(cohort.count,5);assert.equal(cohort.index,p.id%5);near([cohort.born],[p.born]);}
});

test('source burst-spread cone uses distinct equal angular slots and cannot silently become random emission',()=>{
  const shape=source().ShapeModule,cone=createParticleCone(shape,options),count=12,angles=[];
  for(let index=0;index<count;index++){
    const a=cone.sample(.2,.01,{cohort:{index,count}}),b=cone.sample(.2,.99,{cohort:{index,count}});assert.deepEqual(a,b);
    near(a.origin,[shape.radius.value*Math.cos(index*2*Math.PI/count),shape.radius.value*Math.sin(index*2*Math.PI/count),0]);
    near([Math.hypot(...a.direction)],[1]);angles.push(Math.atan2(a.direction[1],a.direction[0]));
  }
  assert.equal(new Set(angles).size,12);assert.throws(()=>createParticleCone(shape),/arc/);
  assert.throws(()=>createParticleCone(shape,{burstSpreadContract:{...BURST_SPREAD_CONE_CONTRACT}}),/arc/);
  for(const cohort of [null,{index:0,count:0},{index:-1,count:5},{index:5,count:5},{index:.5,count:5}])assert.throws(()=>cone.sample(.5,.5,{cohort}),/cohort/);
  const s=source();s.EmissionModule.rateOverTime=c(1);assert.throws(()=>createMovingParticles(s,options),/burst-only/);
  s.EmissionModule.rateOverTime=c(0);s.ShapeModule.arc.spread=.1;assert.throws(()=>createMovingParticles(s,options),/arc/);
});

test('hemisphere births occupy only positive local Z and retain radial speed through the source shell thickness',()=>{
  const s=source('hemisphere');s.InitialModule.maxNumParticles=1000;s.InitialModule.startLifetime=c(2);s.InitialModule.startSpeed=c(3);
  s.EmissionModule.m_BurstCount=1;s.EmissionModule.m_Bursts=[{time:0,countCurve:c(500),cycleCount:1,repeatInterval:1,probability:1}];
  for(const thickness of [0,.1,1]){
    s.ShapeModule.radiusThickness=thickness;const before=structuredClone(s),e=createMovingParticles(s),ps=e.sample(.2,still),radius=s.ShapeModule.radius.value,
      inner=radius*(1-thickness);
    assert.equal(ps.length,500);
    for(const p of ps){
      assert.ok(p.origin[2]>=0&&p.direction[2]>=0);const r=Math.hypot(...p.origin);
      assert.ok(r>=inner-1e-9&&r<=radius+1e-9);near([Math.hypot(...p.initialVelocity)],[3]);
      assert.ok(p.origin.every((v,i)=>Math.abs(v-r*p.direction[i])<1e-9));
    }
    const mean=ps.reduce((v,p)=>v+p.direction[2],0)/ps.length;assert.ok(mean>.45&&mean<.55);
    e.sample(.8,still);assert.deepEqual(e.sample(.2,still),ps);assert.deepEqual(s,before);
  }
  const bare=structuredClone(s);bare.ShapeModule.type=0;
  assert.ok(createMovingParticles(bare).sample(.2,still).some(p=>p.direction[2]<0));
});
