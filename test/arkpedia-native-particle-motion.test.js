// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createParticleNoise} from '../shared/arkpedia/native-particle-noise.js';
import {createParticleMotion} from '../shared/arkpedia/native-particle-motion.js';
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
const constant=scalar=>({minMaxState:0,scalar}),near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function source(){return {moveWithTransform:0,VelocityModule:{enabled:false},
 ClampVelocityModule:{enabled:true,separateAxis:false,drag:constant(0),dampen:.4,magnitude:constant(1)},
 NoiseModule:{enabled:true,quality:2,separateAxes:false,remapEnabled:false,rotationAmount:constant(0),sizeAmount:constant(0),frequency:.4,octaves:1,octaveMultiplier:.5,octaveScale:2,damping:true,strength:constant(.2),positionAmount:constant(1),scrollSpeed:constant(.2)}};}
test('analytic Perlin gradients agree with an independent finite-difference oracle at and between lattice cells',()=>{
 const field=createParticleNoise(17),epsilon=1e-5;
 for(const point of [[.25,.37,.71],[-.25,-1.6,2.9],[0,0,0],[1,-1,2],[.99999,1.00001,-.00001]])for(const channel of [0,1,2]){
  const value=field.perlin(point,channel);
  for(let axis=0;axis<3;axis++){
   const a=point.slice(),b=point.slice();a[axis]+=epsilon;b[axis]-=epsilon;
   near(value.gradient[axis],(field.perlin(a,channel).value-field.perlin(b,channel).value)/(2*epsilon));
  }
 }
});
test('curl field remains divergence-free and continuous rather than using sine wobble or normalizing curl',()=>{
 const field=createParticleNoise(1),epsilon=1e-5;
 for(const point of [[.21,.31,.41],[-2.73,.37,1.13],[.99999,.75,2.31]]){
  let divergence=0;
  for(let axis=0;axis<3;axis++){const a=point.slice(),b=point.slice();a[axis]+=epsilon;b[axis]-=epsilon;divergence+=(field.curl(a)[axis]-field.curl(b)[axis])/(2*epsilon);}
  near(divergence,0,1e-6);
 }
 const a=field.curl([1-1e-7,.3,.6]),b=field.curl([1+1e-7,.3,.6]);a.forEach((v,i)=>near(v,b[i],1e-5));
 assert.deepEqual(field.curl([.2,.3,.4]),createParticleNoise(1).curl([.2,.3,.4]));
 assert.notDeepEqual(field.curl([.2,.3,.4]),createParticleNoise(17).curl([.2,.3,.4]));
 assert.throws(()=>field.curl([Infinity,0,0]));assert.throws(()=>field.perlin([0,0,0],3));
});
test('speed damping preserves direction and uses a partial-tick fraction without clamping to a static template',()=>{
 const s=source();s.NoiseModule.enabled=false;const m=createParticleMotion(s),p={id:0,born:0,lifetime:2,age:1/60};
 const delta=m.sample(p,[0,0,0],[3,0,0]);near(delta[0],2.2/60);near(delta[1],0);
 const diagonal=m.sample(p,[0,0,0],[0,3,4]);near(diagonal[1]/diagonal[2],3/4);
 const small=m.sample({...p,age:1/120},[0,0,0],[3,0,0]);near(small[0],(3-2*(1-Math.sqrt(.6)))/120);
 s.ClampVelocityModule.dampen=1;near(createParticleMotion(s).sample(p,[0,0,0],[3,0,0])[0],1/60);
 s.ClampVelocityModule.dampen=0;near(createParticleMotion(s).sample(p,[0,0,0],[3,0,0])[0],3/60);
});
test('noise frequency damping, source strength, scrolling and octave controls each affect the field',()=>{
 const s=source(),m=createParticleMotion(s),point=[.7,.8,.9];
 const a=m.flow(point,.5,.25,1),scaled=structuredClone(s);scaled.NoiseModule.frequency*=2;
 const b=createParticleMotion(scaled).flow(point.map(v=>v/2),.5,.25,1);a.forEach((v,i)=>near(v,b[i]*2));
 const noDamping=structuredClone(s);noDamping.NoiseModule.damping=false;
 createParticleMotion(noDamping).flow(point,.5,.25,1).forEach((v,i)=>near(v,a[i]*.4));
 const inverse=structuredClone(s);inverse.NoiseModule.strength.scalar=-.2;
 createParticleMotion(inverse).flow(point,.5,.25,1).forEach((v,i)=>near(v,-a[i]));
 assert.notDeepEqual(m.flow(point,0,.25,1),a);
 const octaves=structuredClone(s);octaves.NoiseModule.octaves=2;
 assert.notDeepEqual(createParticleMotion(octaves).flow(point,.5,.25,1),a);
 const off=structuredClone(s);off.NoiseModule.positionAmount.scalar=0;assert.deepEqual(createParticleMotion(off).flow(point,.5,.25,1),[0,0,0]);
});
test('motion replay is independent of render sample order and both noise and limiting participate',()=>{
 const s=source(),baseline=structuredClone(s),m=createParticleMotion(s),p={id:3,born:.2,lifetime:2,age:.75};
 const a=m.sample(p,[.2,.3,0],[-4,0,0]);m.sample({...p,age:1.5},[.2,.3,0],[-4,0,0]);assert.deepEqual(m.sample(p,[.2,.3,0],[-4,0,0]),a);
 const plain=structuredClone(s);plain.NoiseModule.enabled=false;assert.notDeepEqual(createParticleMotion(plain).sample(p,[.2,.3,0],[-4,0,0]),a);
 const unlimited=structuredClone(s);unlimited.ClampVelocityModule.enabled=false;assert.notDeepEqual(createParticleMotion(unlimited).sample(p,[.2,.3,0],[-4,0,0]),a);
 assert.deepEqual(s,baseline);assert.deepEqual(m.scope,{localReplay:true,compiledFrameParity:false});
 assert.deepEqual(m.sample({...p,age:0},[.2,.3,0],[-4,0,0]),[0,0,0]);
 assert.throws(()=>m.sample({...p,age:1000},[0,0,0],[0,0,0]),/budget/);
});
test('unimplemented noise and speed-limit controls fail explicitly',()=>{
 for(const change of [s=>s.NoiseModule.quality=1,s=>s.NoiseModule.remapEnabled=true,s=>s.NoiseModule.separateAxes=true,
  s=>s.NoiseModule.rotationAmount=constant(1),s=>s.NoiseModule.sizeAmount=constant(1),s=>s.NoiseModule.frequency=0,
  s=>s.NoiseModule.octaves=0,s=>s.NoiseModule.scrollSpeed.minMaxState=3,s=>s.ClampVelocityModule.separateAxis=true,
  s=>s.ClampVelocityModule.drag=constant(1),s=>s.ClampVelocityModule.dampen=2,s=>s.VelocityModule.enabled=true,s=>s.moveWithTransform=1]){
  const s=source();change(s);assert.throws(()=>createParticleMotion(s));
 }
});
test('original straight-cone sparks retain authored source speed, collapsed shape, turbulence and grid frames',async t=>{
 let bytes;try{bytes=await readFile('.cache/arkpedia/lappland-alter-source/effects/native-effects.bin');}catch(e){if(e.code==='ENOENT'){t.skip('Original source cache unavailable');return;}throw e;}
 const meta=JSON.parse(await readFile('data/arkpedia-lappland-effects.json'));assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.pack.sha256);
 const pack=JSON.parse(gunzipSync(bytes)),s=pack.records['battle/prefabs/effects/whitw2.ab:8960755602368606957'].data,baseline=structuredClone(s);
 assert.equal(s.ShapeModule.angle,0);assert.equal(s.ShapeModule.m_Scale.x,0);assert.equal(s.ShapeModule.m_Rotation.y,-90);
 assert.equal(s.InitialModule.startSpeed.minScalar,1);assert.equal(s.InitialModule.startSpeed.scalar,6);assert.equal(s.NoiseModule.strength.scalar,-.20000000298023224);
 const e=createMovingParticles(s),snapshot=e.sample(.5);assert.ok(snapshot.length>0);
 for(const p of snapshot){near(p.origin[0],0);near(p.origin[2],0);assert.ok(Math.abs(p.origin[1])<=s.ShapeModule.radius.value);assert.ok(p.position.every(Number.isFinite));assert.ok(p.sheet.frame>=0&&p.sheet.frame<4);assert.equal(p.simulationSpace,'local');}
 e.sample(3);assert.deepEqual(e.sample(.5),snapshot);assert.deepEqual(s,baseline);
 const noNoise=structuredClone(s);noNoise.NoiseModule.enabled=false;assert.notDeepEqual(createMovingParticles(noNoise).sample(.5),snapshot);
 const straight=structuredClone(noNoise);straight.ClampVelocityModule.enabled=false;
 for(const p of createMovingParticles(straight).sample(.5)){
  assert.ok(p.displacement[0]<=-p.age+1e-8&&p.displacement[0]>=-6*p.age-1e-8);
  near(p.displacement[1],0);near(p.displacement[2],0);
 }
 const noLimit=structuredClone(s);noLimit.ClampVelocityModule.enabled=false;assert.notDeepEqual(createMovingParticles(noLimit).sample(.5),snapshot);
 const angled=structuredClone(s);angled.ShapeModule.angle=25;assert.throws(()=>createMovingParticles(angled),/angled cone/);
});
