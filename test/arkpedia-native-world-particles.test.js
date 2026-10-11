// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
import {particleBirthFrame,particleWorldPosition} from '../shared/arkpedia/native-particle-render.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const matrix=(x=0,y=0,z=0)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
let pack=null;
try{
 const raw=await readFile('.cache/arkpedia/lappland-alter-source/effects/native-effects.bin');
 assert.equal(createHash('sha256').update(raw).digest('hex'),'4b3f9646b38f84eee29667053d265bde63a3756bd600e3f558fb28d97b94dbc5');pack=JSON.parse(gunzipSync(raw));
}catch(error){if(error.code!=='ENOENT')throw error;}
const source=()=>structuredClone(pack.records['battle/prefabs/effects/whitw2.ab:-1954971080203652391'].data),native={skip:pack===null?'Original native source cache unavailable':false};
test('world birth frames transform spawn points and velocity separately without translating velocity',()=>{
 const birth=[0,2,0,0,-3,0,0,0,0,0,4,0,10,20,30,1];
 assert.deepEqual(particleBirthFrame([1,2,3],[1,2,3],birth),{origin:[4,22,42],velocity:[-6,2,12]});
 assert.deepEqual(particleBirthFrame([1,2,3],[1,2,3],birth,matrix()),{origin:[4,22,42],velocity:[1,2,3]});
 assert.throws(()=>particleBirthFrame([NaN,0,0],[0,0,0],birth),/vector/);
 assert.throws(()=>particleBirthFrame([0,0,0],[0,0],birth),/vector/);
 assert.throws(()=>particleBirthFrame([0,0,0],[0,0,0],[]),/matrix/);
 const projection=matrix();projection[3]=1;assert.throws(()=>particleBirthFrame([0,0,0],[0,0,0],projection),/affine/);
});
test('world turbulence requires explicit birth matrices; zero noise/damping preserves independent straight-flight geometry',native,()=>{
 const s=source();s.NoiseModule.strength.scalar=s.NoiseModule.strength.minScalar=0;s.ClampVelocityModule.dampen=0;
 const e=createMovingParticles(s);assert.equal(e.worldMotion,true);assert.throws(()=>e.sample(.5),/birth frame/);
 assert.throws(()=>e.sample(.5,{frameAt:()=>({birth:matrix()})}),/spawn and movement/);
 const rotated=[0,2,0,0,-3,0,0,0,0,0,4,0,10,20,30,1],identity=e.sample(.5,{frameAt:()=>({birth:matrix(),movement:matrix()})});
 const result=e.sample(.5,{frameAt:()=>({birth:rotated,movement:rotated})});assert.ok(result.length>0);
 result.forEach((p,i)=>{
  const plain=identity[i];const expected=[10-3*plain.position[1],20+2*plain.position[0],30+4*plain.position[2]];
  p.worldPosition.forEach((v,k)=>near(v,expected[k]));assert.deepEqual(p.position,p.worldPosition);
  assert.equal(p.velocitySpace,'world');assert.equal(p.simulationSpace,'world');
  assert.deepEqual(particleWorldPosition(p,rotated,[...rotated.slice(0,12),100,200,300,1]),p.worldPosition);
 });
});
test('moving the emitter after birth leaves existing noise particles behind and affects newly born particles',native,()=>{
 const s=source(),before=structuredClone(s),e=createMovingParticles(s);
 const fixed=()=>({birth:matrix(),movement:matrix()}),moving=t=>({birth:matrix(t>.5?1:0),movement:matrix(t>.5?1:0)});
 const a=e.sample(1.1,{frameAt:fixed}),b=e.sample(1.1,{frameAt:moving});let old=0,fresh=0;
 for(const p of a){const q=b.find(v=>v.id===p.id);assert.ok(q);if(p.birthTime<=.5){assert.deepEqual(q.worldPosition,p.worldPosition);old++;}else{assert.notDeepEqual(q.worldPosition,p.worldPosition);fresh++;}}
 assert.ok(old>0&&fresh>0);e.sample(3,{frameAt:moving});assert.deepEqual(e.sample(1.1,{frameAt:moving}),b);assert.deepEqual(s,before);
 const shifted=e.sample(1.1,{frameAt:()=>({birth:matrix(1),movement:matrix(1)})});
 // Evaluate the same original curl field at world coordinates, not a local
 // simulation whose whole finished path is merely translated afterwards.
 assert.ok(shifted.some((p,i)=>Math.abs(p.worldPosition[1]-a[i].worldPosition[1])>1e-7));
});
test('four time-emitted world-noise profiles play the two S3 straight cones and explicitly retain two angled-cone blockers',native,()=>{
 const records=Object.values(pack.records).filter(r=>r.type==='ParticleSystem'&&r.data.NoiseModule.enabled&&r.data.moveWithTransform===1&&r.data.EmissionModule.rateOverDistance.scalar===0);
 assert.equal(records.length,4);
 const frameAt=t=>({birth:matrix(Math.max(0,t)/4),movement:matrix(Math.max(0,t)/4)});
 let played=0,blocked=0;
 for(const r of records){
  if(r.data.ShapeModule.angle!==0){assert.equal(r.data.ShapeModule.angle,90);assert.throws(()=>createMovingParticles(r.data),/angled cone/);blocked++;continue;}
  const e=createMovingParticles(r.data),p=e.sample(.5,{frameAt});assert.ok(p.length>0);played++;
  assert.ok(p.every(v=>v.worldPosition.every(Number.isFinite)&&v.color.every(Number.isFinite)&&v.sheet.frame>=0&&v.sheet.frame<4));
  e.sample(2,{frameAt});assert.deepEqual(e.sample(.5,{frameAt}),p);
 }
 assert.equal(played,2);assert.equal(blocked,2);
});
