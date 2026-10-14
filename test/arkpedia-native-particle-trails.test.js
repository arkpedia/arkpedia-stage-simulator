// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{createParticleTrails}from'../shared/arkpedia/native-particle-trails.js';import{particleForceImpulse}from'../shared/arkpedia/native-particle-force.js';import{createMovingParticles}from'../shared/arkpedia/native-moving-particles.js';import{createParticleMotion}from'../shared/arkpedia/native-particle-motion.js';
import f from'./fixtures/arkpedia-particle-trails.json'with{type:'json'};import m from'../data/arkpedia-particle-trails.json'with{type:'json'};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`),base=()=>structuredClone(Object.values(f).find(r=>r.source==='lappland-alter'&&r.data.TrailModule.enabled).data);
const stateAt=(t,b)=>({position:[(t-b.birthTime)*5,0,0],size:[2,2,2],color:[1,.5,.25,.8]}),options={stateAt,project:p=>p.position,camera:[0,0,10]};
test('original trail and force inventory retains source hashes and synthetic-probe fidelity limits',()=>{
 const raw=readFileSync(new URL('./fixtures/arkpedia-particle-trails.json',import.meta.url));assert.equal(raw.length,m.fixture.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),m.fixture.sha256);
 assert.deepEqual(m.counts,{sourceParticles:29,trails:16,forces:21,forceImpulses:63,trailSamples:48});assert.equal(m.scope.syntheticAuditMotion,true);assert.equal(m.scope.compiledFrameParity,false);assert.equal(m.scope.nativeRngVerified,false);assert.deepEqual(m.scope.enabledOperators,[]);
});
for(const[id,row]of Object.entries(f)){
 if(row.data.TrailModule.enabled)test(id+' retains original trail controls and deterministic geometry from explicit motion',()=>{
  const s=structuredClone(row.data),before=structuredClone(s),trail=createParticleTrails(s),b={id:0,born:0,birthTime:0,lifetime:2};
  const result=trail.sample(.5,[b],options);assert.ok(result.positions.every(Number.isFinite));assert.deepEqual(trail.sample(.5,[b],options),result);
  assert.deepEqual(s,before);assert.equal(trail.ownsSource(s),true);assert.equal(trail.ownsSource(structuredClone(s)),false);assert.equal(trail.ownsSource(s,2),false);
 });
 if(row.data.ForceModule.enabled)test(id+' samples the original acceleration curves without certifying space or native frame ordering',()=>{
  const s=row.data.ForceModule,p={id:3,lifetime:2},a=particleForceImpulse(s,p,0,.25),b=particleForceImpulse(s,p,.25,.5),all=particleForceImpulse(s,p,0,.5);
  a.forEach((v,i)=>near(v+b[i],all[i]));assert.ok(all.every(Number.isFinite));assert.deepEqual(particleForceImpulse(s,p,0,.5),all);
 });
}
test('particle lifetime multiplier, simulated clocks and death policy retain or expire independent ribbons',()=>{
 const s=base(),t=s.TrailModule;s.prewarm=false;t.dieWithParticles=false;t.lifetime={...t.lifetime,minMaxState:0,scalar:.5};t.ratio=1;
 const b={id:0,born:0,birthTime:0,lifetime:2},trail=createParticleTrails(s),alive=trail.sample(1,[b],options);
 for(const p of alive.trails[0].points)near(p.expires-p.time,1);
 const dead=trail.sample(2.2,[b],options);assert.equal(dead.trails[0].alive,false);assert.ok(dead.indices.length>0);
 assert.equal(trail.sample(3,[b],options).indices.length,0);t.dieWithParticles=true;assert.equal(createParticleTrails(s).sample(2.2,[b],options).indices.length,0);
 t.dieWithParticles=false;s.simulationSpeed=.5;const slow=createParticleTrails(s).sample(2,[b],options);for(const p of slow.trails[0].points)near(p.expires-p.time,2);
});
test('size, inherited color, normalized UVs and local emitter projection use separate source controls',()=>{
 const s=base(),t=s.TrailModule;t.ratio=1;t.dieWithParticles=false;t.sizeAffectsWidth=true;t.sizeAffectsLifetime=true;t.inheritParticleColor=true;
 t.widthOverTrail={...t.widthOverTrail,minMaxState:0,scalar:.25};t.lifetime={...t.lifetime,minMaxState:0,scalar:.5};
 for(const k of['colorOverLifetime','colorOverTrail'])t[k]={...t[k],minMaxState:0,maxColor:{r:1,g:1,b:1,a:1}};
 const data=createParticleTrails(s).sample(.5,[{id:0,born:0,birthTime:0,lifetime:2}],{...options,widthScale:3,project:p=>p.position.map((v,i)=>v+(i===0?10:0))});
 assert.ok(data.indices.length>0);data.trails[0].widths.forEach(w=>near(w,1.5));assert.deepEqual(data.colors.slice(0,4),[1,.5,.25,.8]);
 for(const p of data.trails[0].points)near(p.expires-p.time,2);assert.equal(data.uvs[0],0);near(data.uvs.at(-2),1);assert.ok(data.positions[0]>9);
});
test('owned negative prewarm history, scoped caches and rewind do not weaken ordinary scheduled samples',()=>{
 const s=base(),trail=createParticleTrails(s),emitter=createMovingParticles(s,{particleTrails:trail}),birth=emitter.births(0).find(b=>b.birthTime<0&&b.birthTime+b.lifetime>0);assert.ok(birth);
 const time=birth.birthTime+.01,records=[{...birth,age:.01}];assert.throws(()=>emitter.sampleRecords(records,time),/scheduled/);
 assert.throws(()=>emitter.sampleRecords(records,-1e-11),/scheduled/);
 const physical=emitter.sampleTrailRecords(records,time);let escaped;
 emitter.withTrailHistory(replay=>{escaped=replay;assert.deepEqual(replay(records,time),physical);const copy=replay(records,time);copy[0].position[0]=999;assert.deepEqual(replay(records,time),physical);});
 emitter.withTrailHistory(replay=>{const tagged=replay([{...records[0],optional:undefined}],time);assert.ok(Object.hasOwn(tagged[0],'optional'));assert.equal(tagged[0].optional,undefined);});
 assert.throws(()=>escaped(records,time),/scope has ended/);assert.throws(()=>emitter.withTrailHistory(async()=>1),/synchronous/);
 const b=emitter.births(.5),replay=t=>emitter.withTrailHistory(sample=>trail.sample(t,emitter.births(t),{stateAt(t,p){return sample([{...p,age:(t-p.birthTime)*s.simulationSpeed}],t)[0];},project:p=>p.position,camera:[0,0,10]}));
 const before=replay(.5);replay(.8);assert.deepEqual(replay(.5),before);assert.ok(before.indices.length>0);
 s.TrailModule.ratio=.2;assert.throws(()=>emitter.withTrailHistory(()=>1),/source owner/);emitter.clearTrailHistoryCache();
});
test('force integrates acceleration before local damping while unknown spaces/randomization remain held',()=>{
 const s=base();s.NoiseModule.enabled=false;s.ClampVelocityModule.enabled=false;s.ForceModule.x={...s.ForceModule.x,minMaxState:0,scalar:4};
 s.ForceModule.y={...s.ForceModule.y,minMaxState:0,scalar:0};s.ForceModule.z={...s.ForceModule.z,minMaxState:0,scalar:0};
 const motion=createParticleMotion(s),p={id:0,born:0,lifetime:2,age:1};near(motion.sample(p,[0,0,0],[0,0,0])[0],2+1/30);
 s.ForceModule.inWorldSpace=true;assert.throws(()=>createParticleMotion(s),/force space/);s.ForceModule.inWorldSpace=false;s.ForceModule.randomizePerFrame=true;assert.throws(()=>createParticleMotion(s),/force space/);
});
test('unsupported trail modes, malformed ledgers and replay budgets cannot silently become particle-only rendering',()=>{
 for(const mutate of[s=>s.TrailModule.mode=1,s=>s.TrailModule.worldSpace=true,s=>s.TrailModule.generateLightingData=true,s=>s.TrailModule.textureMode=1,s=>s.TrailModule.ratio=2,s=>s.scalingMode=2]){const s=base();mutate(s);assert.throws(()=>createParticleTrails(s));}
 const s=base();s.TrailModule.ratio=1;const trail=createParticleTrails(s),b={id:0,born:0,birthTime:0,lifetime:2};
 assert.throws(()=>trail.sample(.5,[b,b],options),/ledger/);assert.throws(()=>trail.sample(.5,[b],{...options,stateAt:()=>({position:[NaN,0,0]})}));
 assert.throws(()=>trail.sample(1000,[{...b,lifetime:2000}],options),/budget/);
 assert.throws(()=>createMovingParticles(base()),/TrailModule/);assert.throws(()=>createMovingParticles(base(),{particleTrails:trail}),/TrailModule/);
});
