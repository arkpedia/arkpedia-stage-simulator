// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Euler,Matrix4,Vector3} from 'three';
import {createParticleStartRotation} from '../shared/arkpedia/native-particle-start-rotation.js';
import {createStationaryParticles} from '../shared/arkpedia/native-stationary-particles.js';
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
import fixtures from './fixtures/arkpedia-particle-start-rotation.json' with {type:'json'};
import meta from '../data/arkpedia-particle-start-rotation.json' with {type:'json'};
const constant=scalar=>({minMaxState:0,scalar}),range=(a,b)=>({minMaxState:3,minScalar:a,scalar:b});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
const initial=()=>({rotation3D:true,randomizeRotationDirection:0,startRotationX:constant(Math.PI/2),startRotationY:constant(Math.PI/2),startRotation:constant(Math.PI/2)});
test('original start rotation fixtures retain all four Tragodia and seven Lappland objects',()=>{
 const bytes=readFileSync(new URL('./fixtures/arkpedia-particle-start-rotation.json',import.meta.url));
 assert.equal(bytes.length,meta.fixture.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.fixture.sha256);
 assert.equal(Object.keys(fixtures).length,11);assert.deepEqual(Object.keys(fixtures),Object.keys(meta.particles));
 assert.equal(Object.values(fixtures).filter(r=>r.source==='tragodia').length,4);
 assert.equal(Object.values(fixtures).filter(r=>r.source==='lappland-alter').length,7);
 assert.deepEqual(meta.scope,{sourceMapping:true,compiledFrameParity:false,enabledOperators:[]});
 for(const [key,row] of Object.entries(fixtures))assert.equal(row.particleSha256,meta.particles[key].particleSha256);
});
test('radians and fixed-axis Z-X-Y order rotate a noncommuting three-axis basis',()=>{
 const axes=createParticleStartRotation(initial()).sample(0,[0,0,0]).rotation3D;
 const matrix=new Matrix4().makeRotationFromEuler(new Euler(...axes,'YXZ'));
 // Z: X -> Y; X: Y -> Z; Y: Z -> X. Y -> Z and Z -> -Y.
 for(const [input,wanted] of [[[1,0,0],[1,0,0]],[[0,1,0],[0,0,1]],[[0,0,1],[0,-1,0]]]){
  const actual=new Vector3(...input).applyMatrix4(matrix).toArray();actual.forEach((v,i)=>near(v,wanted[i]));
 }
 const wrong=new Matrix4().makeRotationFromEuler(new Euler(...axes,'ZXY'));
 assert.notDeepEqual(new Vector3(1,0,0).applyMatrix4(wrong).toArray(),new Vector3(1,0,0).applyMatrix4(matrix).toArray());
});
test('each axis retains its own range factor, including reversed source ranges',()=>{
 const s={...initial(),startRotationX:range(2,-2),startRotationY:range(0,4),startRotation:range(-1,1)},before=structuredClone(s);
 const sampler=createParticleStartRotation(s);
 assert.deepEqual(sampler.sample(.25,[.25,.75,.5]),{rotation:0,rotation3D:[1,3,0]});
 assert.deepEqual(sampler.sample(.75,[.25,.75,.5]),sampler.sample(.25,[.25,.75,.5]));assert.deepEqual(s,before);
 const scalar={...s,rotation3D:false};delete scalar.startRotationX;delete scalar.startRotationY;
 assert.deepEqual(createParticleStartRotation(scalar).sample(.25,[0,0,.75]),{rotation:.5});
});
test('start rotation curves sample emission phase and remain fixed over particle lifetime',()=>{
 const key=(time,value)=>({time,value,inSlope:2,outSlope:2,weightedMode:0});
 const curve={minMaxState:1,scalar:1,maxCurve:{m_Curve:[key(0,0),key(1,2)],m_PreInfinity:2,m_PostInfinity:2}};
 const s={lengthInSec:1,looping:true,prewarm:false,moveWithTransform:0,ringBufferMode:0,simulationSpeed:2,startDelay:constant(.5),playOnAwake:true,
 InitialModule:{...initial(),enabled:true,maxNumParticles:10,size3D:false,startSize:constant(1),startSpeed:constant(0),gravityModifier:constant(0),startLifetime:constant(2),
 startRotationX:curve,startRotationY:constant(0),startRotation:constant(0),startColor:{minMaxState:0,maxColor:{r:1,g:1,b:1,a:1}}},
 EmissionModule:{enabled:true,m_BurstCount:0,m_Bursts:[],rateOverTime:constant(2),rateOverDistance:constant(0)}};
 const e=createStationaryParticles(s);assert.deepEqual(e.sample(.249),[]);
 const p=e.sample(.5)[0];assert.equal(p.born,.5);assert.deepEqual(p.rotation3D,[1,0,0]);
 const older=e.sample(.8).find(q=>q.id===p.id);assert.ok(older.age>p.age);assert.deepEqual(older.rotation3D,p.rotation3D);
 e.sample(3);assert.deepEqual(e.sample(.5)[0],p);
});
const packs={};
for(const name of Object.keys(meta.sources)){
 try{
  const bytes=readFileSync(`.cache/arkpedia/${name}-source/effects/native-effects.bin`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sources[name].sourcePackSha256);packs[name]=JSON.parse(gunzipSync(bytes));
 }catch(error){if(error.code!=='ENOENT')throw error;}
}
for(const [id,row] of Object.entries(fixtures))test(row.source+' '+row.name+' retains start axes and unrelated source blockers',
 {skip:packs[row.source]?false:'Original native source cache unavailable'},()=>{
 const source=packs[row.source].records[id].data,before=structuredClone(source);
 assert.deepEqual(source.InitialModule,row.initial);
 const sampler=createParticleStartRotation(row.initial),sample=sampler.sample(.25,[.25,.75,.5]);
 assert.equal(sample.rotation,sample.rotation3D[2]);assert.equal(sample.rotation3D.length,3);
 // These source profiles also contain unsupported shape controls. Sampling
 // their start angles does not certify or flatten their full particle motion.
 if(row.source==='lappland-alter'){
  assert.ok([25,90].includes(source.ShapeModule.angle));
  assert.throws(()=>createMovingParticles(source),/angled cone/);assert.deepEqual(source,before);return;
 }
 if(row.name==='line_01'){
  assert.equal(source.ShapeModule.type,8);
  assert.throws(()=>createMovingParticles(source),/shape\/direction/);assert.deepEqual(source,before);return;
 }
 const e=createMovingParticles(source),clock=(source.startDelay.scalar+1)/source.simulationSpeed,snapshot=e.sample(clock);assert.ok(snapshot.length>0);
 for(const p of snapshot){
  assert.equal(p.rotation,p.rotation3D[2]);
  for(const [axis,field] of ['startRotationX','startRotationY','startRotation'].entries()){
   const c=row.initial[field],min=c.minMaxState===0?c.scalar:Math.min(c.scalar,c.minScalar),max=c.minMaxState===0?c.scalar:Math.max(c.scalar,c.minScalar);
   assert.ok(p.rotation3D[axis]>=min&&p.rotation3D[axis]<=max);
  }
 }
 e.sample(clock+3);assert.deepEqual(e.sample(clock),snapshot);assert.deepEqual(source,before);
});
test('flip, malformed axes, invalid factors and unsupported curves stay held',()=>{
 for(const patch of [{rotation3D:1},{randomizeRotationDirection:.5},{startRotationY:null}])assert.throws(()=>createParticleStartRotation({...initial(),...patch}));
 const sampler=createParticleStartRotation(initial());
 for(const factors of [[],[0,0],[0,0,NaN],[0,0,2]])assert.throws(()=>sampler.sample(0,factors),/sample/);
 assert.throws(()=>sampler.sample(NaN,[0,0,0]),/sample/);
 const bad={minMaxState:1,scalar:1,maxCurve:{m_Curve:[{time:0,value:0,weightedMode:1},{time:1,value:1,weightedMode:1}],m_PreInfinity:2,m_PostInfinity:2}};
 assert.throws(()=>createParticleStartRotation({...initial(),startRotationX:bad}),/Weighted/);
});
test('sampling start angles does not silently enable rotation over lifetime',
 {skip:packs.tragodia?false:'Original native source cache unavailable'},()=>{
 const source=structuredClone(packs.tragodia.records['battle/prefabs/effects/phatm2.ab:8060690848342612203'].data);
 source.RotationModule.enabled=true;
 assert.throws(()=>createMovingParticles(source),/RotationModule lifecycle not playing/);
});
