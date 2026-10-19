// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createParticleLifecycle} from '../shared/arkpedia/native-particle-lifecycle.js';
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
const constant=scalar=>({minMaxState:0,scalar,minScalar:scalar});
const matrix=x=>[1,0,0,0,0,1,0,0,0,0,1,0,x,0,0,1];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function source(){return {lengthInSec:10,looping:true,prewarm:false,moveWithTransform:1,ringBufferMode:0,simulationSpeed:1,startDelay:constant(0),playOnAwake:true,
 InitialModule:{enabled:true,maxNumParticles:100,rotation3D:false,randomizeRotationDirection:0,size3D:false,startSpeed:constant(0),gravityModifier:constant(0),startLifetime:constant(20),startSize:constant(1),startRotation:constant(0),startColor:{minMaxState:0,maxColor:{r:1,g:1,b:1,a:1}}},
 EmissionModule:{enabled:true,m_BurstCount:0,m_Bursts:[],rateOverTime:constant(0),rateOverDistance:constant(2)}};}
const replay=s=>createParticleLifecycle(s,{spaces:[1],allowDistanceEmission:true});
const path=[{time:0,position:[0,0,0]},{time:1,position:[1,0,0]},{time:2,position:[1,1,0]},{time:3,position:[1,1,0]}];
test('distance births use accumulated world arclength across turns, stops and partial segments',()=>{
 const e=replay(source());assert.deepEqual(e.sample(.49,{history:path}),[]);
 assert.deepEqual(e.sample(3,{history:path}).map(p=>p.born),[.5,1,1.5,2]);
 assert.deepEqual(e.sample(1.75,{history:path}).map(p=>p.born),[.5,1,1.5]);
 const translated=path.map(p=>({...p,position:p.position.map(v=>v+100)}));assert.deepEqual(e.sample(3,{history:translated}),e.sample(3,{history:path}));
 assert.deepEqual(e.sample(100,{history:[{time:0,position:[5,6,7]}]}),[]);
});
test('distance counts depend on movement while delay, speed and prewarm determine birth clocks',()=>{
 const s=source();s.startDelay=constant(1);s.simulationSpeed=2;const e=replay(s);
 assert.deepEqual(e.sample(.49,{history:path}),[]);
 assert.deepEqual(e.sample(2,{history:path}).map(p=>p.born),[1,2,3]);
 const warm=source();warm.prewarm=true;const w=replay(warm);
 assert.deepEqual(w.sample(0,{history:path}),[]);
 const p=w.sample(1,{history:path});assert.deepEqual(p.map(p=>p.born),[10.5,11]);assert.deepEqual(p.map(p=>p.age),[.5,0]);
 const finite=source();finite.looping=false;finite.lengthInSec=1;
 assert.deepEqual(replay(finite).sample(3,{history:path}).map(p=>p.born),[.5]);
});
test('time, distance and burst events share capacity, lifetime and stable preview identities',()=>{
 const s=source();s.InitialModule.maxNumParticles=1;s.InitialModule.startLifetime=constant(.5);s.EmissionModule.rateOverTime=constant(2);
 s.EmissionModule.m_BurstCount=1;s.EmissionModule.m_Bursts=[{time:.5,cycleCount:1,repeatInterval:1,probability:1,countCurve:constant(1)}];
 const e=replay(s);const first=e.sample(.5,{history:path});assert.equal(first.length,1);assert.equal(first[0].id,0);
 const second=e.sample(1,{history:path});assert.equal(second.length,1);assert.equal(second[0].born,1);assert.equal(second[0].id,3);
 e.sample(3,{history:path});assert.deepEqual(e.sample(.5,{history:path}),first);
});
test('distance emission validates explicit history and preserves stationary lifecycle rejection',()=>{
 const s=source(),e=replay(s);assert.throws(()=>e.sample(1),/history/);
 for(const history of [[],[{time:1,position:[0,0,0]}],[path[0],path[0]],[path[0],{time:1,position:[NaN,0,0]}]])assert.throws(()=>e.sample(1,{history}));
 assert.throws(()=>createParticleLifecycle(s,{spaces:[1]}),/history/);
 assert.throws(()=>createParticleLifecycle({...s,moveWithTransform:0},{spaces:[0,1],allowDistanceEmission:true}),/history/);
 const varying=source();varying.EmissionModule.rateOverDistance={minMaxState:3,scalar:2,minScalar:1};assert.throws(()=>replay(varying),/integration/);
 const huge=source();huge.EmissionModule.rateOverDistance=constant(100001);assert.throws(()=>replay(huge).sample(1,{history:path}),/budget/);
});
function sphere(thickness=1){const s=source();s.EmissionModule.rateOverDistance=constant(0);s.EmissionModule.m_BurstCount=1;s.EmissionModule.m_Bursts=[{time:0,cycleCount:1,repeatInterval:1,probability:1,countCurve:constant(100)}];s.InitialModule.startSpeed=constant(2);
 s.ShapeModule={enabled:true,type:0,radius:{mode:0,spread:0,value:3},radiusThickness:thickness,alignToDirection:false,randomDirectionAmount:0,sphericalDirectionAmount:0,randomPositionAmount:0,m_Position:{x:0,y:0,z:0},m_Rotation:{x:0,y:0,z:0},m_Scale:{x:1,y:1,z:1}};
 for(const field of ['m_Texture','m_Mesh','m_MeshRenderer','m_SkinnedMeshRenderer','m_Sprite','m_SpriteRenderer'])s.ShapeModule[field]={m_PathID:'0'};return s;}
const still={frameAt:()=>({birth:matrix(0),movement:matrix(0)})};
test('sphere births occupy the source volume or shell and move radially at original speed',()=>{
 for(const thickness of [0,.5,1]){
  const s=sphere(thickness),before=structuredClone(s),e=createMovingParticles(s),particles=e.sample(.25,still);
  assert.equal(particles.length,100);for(const p of particles){const radius=Math.hypot(...p.origin);assert.ok(radius>=3*(1-thickness)-1e-10&&radius<=3+1e-10);near(Math.hypot(...p.displacement),.5);near(p.origin.reduce((sum,v,i)=>sum+v*p.displacement[i],0),radius*.5);}
  if(thickness===1){const sorted=particles.map(p=>Math.hypot(...p.origin)**3/27).sort((a,b)=>a-b);assert.ok(sorted[25]>.1&&sorted[25]<.4&&sorted[75]>.6&&sorted[75]<.9);}
  assert.deepEqual(s,before);
 }
});
test('sphere shape scale changes spawn volume without changing radial speed or adding offset to velocity',()=>{
 const plain=createMovingParticles(sphere()).sample(.25,still),s=sphere();s.ShapeModule.m_Scale={x:2,y:3,z:4};s.ShapeModule.m_Position={x:10,y:20,z:30};s.ShapeModule.m_Rotation.z=90;
 const result=createMovingParticles(s).sample(.25,still);result.forEach((p,i)=>{const a=plain[i];[10-3*a.origin[1],20+2*a.origin[0],30+4*a.origin[2]].forEach((v,k)=>near(p.origin[k],v));[-a.displacement[1],a.displacement[0],a.displacement[2]].forEach((v,k)=>near(p.displacement[k],v));});
});
let pack=null;try{const raw=await readFile('.cache/arkpedia/lappland-alter-source/effects/native-effects.bin');assert.equal(createHash('sha256').update(raw).digest('hex'),'4b3f9646b38f84eee29667053d265bde63a3756bd600e3f558fb28d97b94dbc5');pack=JSON.parse(gunzipSync(raw));}catch(error){if(error.code!=='ENOENT')throw error;}
test('all four original S3 distance layers replay source modules with recorded birth frames', {skip:pack===null?'Original native source cache unavailable':false},()=>{
 for(const id of ['-3504556670392880423','-5181076683376119079','1485163943745729241','943210857955701465']){
  const s=pack.records['battle/prefabs/effects/whitw2.ab:'+id].data,before=structuredClone(s),e=createMovingParticles(s);
  const history=[{time:0,position:[0,0,0]},{time:1,position:[2,0,0]}],frameAt=t=>({birth:matrix(2*Math.max(0,t)),movement:matrix(2*Math.max(0,t))});
  const a=e.sample(.5,{history,frameAt});assert.ok(a.length>0);assert.ok(a.every(p=>p.worldPosition.every(Number.isFinite)&&p.color.every(Number.isFinite)&&p.size.every(Number.isFinite)));
  const staticParticles=e.sample(.5,{history:[history[0]],frameAt:()=>({birth:matrix(0),movement:matrix(0)})});assert.ok(a.length>staticParticles.length);
  e.sample(2,{history,frameAt});assert.deepEqual(e.sample(.5,{history,frameAt}),a);assert.deepEqual(s,before);
 }
});
