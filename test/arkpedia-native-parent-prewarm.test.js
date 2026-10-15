// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createParentParticleMotion } from '../shared/arkpedia/native-parent-particle-motion.js';
import { createChildEmissionSchedule } from '../shared/arkpedia/native-child-emission.js';
import { createMovingParticles } from '../shared/arkpedia/native-moving-particles.js';
import { createParticleTrails } from '../shared/arkpedia/native-particle-trails.js';
import { createParticleCone, DISCRETE_CONE_ARC_CONTRACT } from '../shared/arkpedia/native-particle-cone.js';
import parents from './fixtures/arkpedia-source-parent-motion.json' with { type: 'json' };
import children from './fixtures/arkpedia-child-particle-motion.json' with { type: 'json' };
const ID = 'battle/prefabs/effects/phatm2.ab:1554873112122431723';
const CHILD = 'battle/prefabs/effects/phatm2.ab:4040094038318586091';
const mat = (x = 0) => [1,0,0,0,0,1,0,0,0,0,1,0,x,0,0,1];
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function original() { return { records: {
  ...Object.fromEntries(Object.entries(parents).map(([id,r]) => [id,{type:'ParticleSystem',data:structuredClone(r.data),references:structuredClone(r.references)}])),
  ...Object.fromEntries(Object.entries(children).map(([id,r]) => [id,{type:'ParticleSystem',data:structuredClone(r.data)}])),
} }; }
function make() {
  const pack=original(),frames=[];
  const motion=createParentParticleMotion(pack,{parentIds:[ID],
    frameAt:(_id,t)=>({birth:mat(7+2*t),movement:mat(7+2*t)}),
    prewarmFrameAt:(id,t)=>{frames.push([id,t]);return {birth:mat(7),movement:mat(7)};},
    trailForParent:id=>createParticleTrails(pack.records[id].data),discreteArcContract:DISCRETE_CONE_ARC_CONTRACT});
  assert.equal(motion.parentReady(ID),true);
  return {pack,motion,frames,source:pack.records[ID].data};
}

test('original cage parent retains exact prewarm, trail and discrete arc fields without source edits',()=>{
  const f=make(),before=structuredClone(f.pack);
  assert.equal(f.source.prewarm,true);assert.equal(f.source.lengthInSec,5);assert.equal(f.source.TrailModule.enabled,true);
  assert.equal(f.source.ShapeModule.arc.spread,.10000000149011612);
  const records=f.motion.records(CHILD,0);assert.ok(records.some(p=>p.birthTime<0));
  assert.ok(f.motion.ready(CHILD));assert.deepEqual(f.pack,before);
  assert.equal(f.motion.scope.compiledFrameParity,false);assert.equal(f.motion.scope.prewarmSourceHistory,true);
});

test('accepted parent identities replay negative birth times with explicit frozen original frames',()=>{
  const f=make(),schedule=createChildEmissionSchedule(f.pack),sampler=createMovingParticles(f.source,
    {subEmitterSchedule:schedule,particleTrails:createParticleTrails(f.source),discreteArcContract:DISCRETE_CONE_ARC_CONTRACT});
  const birth=sampler.births(0)[0];assert.ok(birth.birthTime<0);
  for(const t of [birth.birthTime,birth.birthTime+.2,birth.birthTime+.5]) {
    const a=f.motion.sample(ID,birth.id,t);assert.ok(a.position.every(Number.isFinite));
    near(a.position[0],7+a.particle.position[0]);assert.ok(f.frames.some(([,time])=>time<0));
    const phase=(Math.atan2(a.particle.origin[1],a.particle.origin[0])+Math.PI*2)%(Math.PI*2);
    const slot=phase/(f.source.ShapeModule.arc.spread*Math.PI*2);near(slot,Math.round(slot));
  }
  const velocity=f.motion.parentAt(ID,birth.id,birth.birthTime).velocity;
  assert.ok(Math.hypot(...velocity)>0); // Prewarm momentum is not replaced by zero.
  assert.throws(()=>f.motion.sample(ID,birth.id,-5.1),/sample/);
  assert.throws(()=>f.motion.sample(ID,birth.id,birth.birthTime+birth.lifetime),/expired/);
});

test('prewarmed child world positions retain source parent lineage and reverse deterministically',()=>{
  const f=make(),frames=f.motion.childFrames(CHILD,()=>({birth:mat(7),movement:mat(7)}));
  const sampler=createMovingParticles(f.pack.records[CHILD].data);
  const sample=t=>sampler.sampleRecords(f.motion.records(CHILD,t),t,frames)
    .map(p=>({particle:p,world:frames.worldPosition(p,t)}));
  const atZero=sample(0);assert.ok(atZero.length);assert.ok(atZero.some(p=>p.particle.birthTime<0));
  assert.ok(atZero.every(p=>p.world.every(Number.isFinite)));
  sample(1);assert.deepEqual(sample(0),atZero);
  for(const {particle} of atZero)assert.equal(particle.parent,ID);
});

test('negative replay remains scoped to the same managed source and cannot escape synchronously',()=>{
  const f=make(),schedule=createChildEmissionSchedule(f.pack),sampler=createMovingParticles(f.source,
    {subEmitterSchedule:schedule,particleTrails:createParticleTrails(f.source),discreteArcContract:DISCRETE_CONE_ARC_CONTRACT});
  const birth=sampler.births(0)[0],t=birth.birthTime+.2,p={...birth,age:.2};
  assert.throws(()=>sampler.sampleRecords([p],t),/clock/);
  let escaped;const options={frameAt:()=>({birth:mat(7),movement:mat(7)})};
  const accepted=sampler.withParentHistory(replay=>{escaped=replay;return replay([p],t,options);});
  assert.equal(accepted.length,1);assert.throws(()=>escaped([p],t,options),/scope has ended/);
  assert.throws(()=>sampler.withParentHistory(replay=>replay([p],-6,options)),/clock/);
  assert.throws(()=>sampler.withParentHistory(()=>Promise.resolve()),/synchronous/);
  f.source.SubModule.subEmitters[0].properties=1;
  assert.throws(()=>sampler.withParentHistory(replay=>replay([p],t,options)),/source scheduler/);
});

test('missing prewarm frames and nonzero-delay history stay held',()=>{
  const p=original(),common={parentIds:[ID],frameAt:()=>({birth:mat(),movement:mat()}),
    trailForParent:id=>createParticleTrails(p.records[id].data),discreteArcContract:DISCRETE_CONE_ARC_CONTRACT};
  const held=createParentParticleMotion(p,common);assert.equal(held.parentReady(ID),false);assert.match(held.parentReason(ID),/source-history/);
  p.records[ID].data.startDelay.scalar=1;
  const delayed=createParentParticleMotion(p,{...common,prewarmFrameAt:()=>({birth:mat(),movement:mat()})});
  assert.equal(delayed.parentReady(ID),false);assert.match(delayed.parentReason(ID),/zero-delay/);
});

test('random discrete arcs require the explicit local contract and retain ten source sectors',()=>{
  const shape=parents[ID].data.ShapeModule,before=structuredClone(shape);
  assert.throws(()=>createParticleCone(shape),/arc/);
  assert.throws(()=>createParticleCone(shape,{discreteArcContract:{...DISCRETE_CONE_ARC_CONTRACT}}),/arc/);
  const cone=createParticleCone(shape,{discreteArcContract:DISCRETE_CONE_ARC_CONTRACT});
  for(let slot=0;slot<10;slot++) {
    const azimuth=(slot+.5)*shape.arc.spread,p=cone.sample(.5,azimuth);
    const expected=slot*shape.arc.spread*Math.PI*2;
    near(p.origin[0]/Math.hypot(p.origin[0],p.origin[1]),Math.cos(expected));
    near(p.origin[1]/Math.hypot(p.origin[0],p.origin[1]),Math.sin(expected));
  }
  assert.deepEqual(cone.sample(.5,1),cone.sample(.5,0));assert.deepEqual(shape,before);
  for(const spread of [-.1,1.1,NaN,Infinity,Number.MIN_VALUE])assert.throws(()=>createParticleCone({...shape,arc:{...shape.arc,spread}},
    {discreteArcContract:DISCRETE_CONE_ARC_CONTRACT}),/arc/);
});
