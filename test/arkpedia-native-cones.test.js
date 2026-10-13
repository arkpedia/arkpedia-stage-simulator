// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createParticleCone} from '../shared/arkpedia/native-particle-cone.js';
import fixtures from './fixtures/arkpedia-particle-cones.json' with {type:'json'};
import meta from '../data/arkpedia-particle-cones.json' with {type:'json'};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
const cage=fixtures['battle/prefabs/effects/phatm2.ab:8025136846011308267'];
const shape=()=>({...structuredClone(cage.shape),angle:30,radius:{mode:0,spread:0,value:2},radiusThickness:0,m_Scale:{x:1,y:1,z:1}});
test('cone inventory preserves all 59 original shape profiles and holds eight arc controls',()=>{
 const bytes=readFileSync(new URL('./fixtures/arkpedia-particle-cones.json',import.meta.url));
 assert.equal(bytes.length,meta.fixture.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.fixture.sha256);
 assert.equal(Object.keys(fixtures).length,59);assert.deepEqual(Object.keys(fixtures),Object.keys(meta.particles));
 assert.equal(Object.values(fixtures).filter(r=>r.source==='tragodia').length,12);
 assert.equal(Object.values(fixtures).filter(r=>r.source==='lappland-alter').length,47);
 assert.equal(Object.keys(meta.held).length,8);
 assert.deepEqual(meta.scope,{sourceMapping:true,shapeModel:'geometricConeBase',nativeEmissionParity:false,compiledFrameParity:false,enabledOperators:[]});
 assert.equal(cage.shape.angle,25);assert.equal(cage.shape.radius.value,.5299999713897705);
});
for(const [id,row] of Object.entries(fixtures))test(row.source+' '+row.name+' preserves authored cone geometry or its arc blocker',()=>{
 assert.equal(row.particleSha256,meta.particles[id].particleSha256);
 const before=structuredClone(row.shape);
 if(meta.held[id]){assert.throws(()=>createParticleCone(row.shape),/cone angle\/arc mode/);assert.deepEqual(row.shape,before);return;}
 const cone=createParticleCone(row.shape),radius=row.shape.radius.value,inner=radius*(1-row.shape.radiusThickness);
 for(const radial of [0,.25,1])for(const azimuth of [0,.25,.75,1]){
  const p=cone.sample(radial,azimuth),r=Math.sqrt(inner**2+radial*(radius**2-inner**2)),phi=azimuth*Math.PI*2;
  near(p.origin[0],r*Math.cos(phi)*row.shape.m_Scale.x);near(p.origin[1],r*Math.sin(phi)*row.shape.m_Scale.y);assert.equal(p.origin[2],0);
  near(Math.hypot(...p.direction),1);
  if(row.shape.angle===90)assert.equal(p.direction[2],0);
  else{
   assert.ok(p.direction[2]>0);
   near(Math.hypot(p.direction[0],p.direction[1])/p.direction[2],r/radius*Math.tan(row.shape.angle*Math.PI/180));
  }
 }
 assert.deepEqual(row.shape,before);
});
test('outer ring rays preserve a known 30-degree angle in all quadrants',()=>{
 const cone=createParticleCone(shape());
 for(const [azimuth,origin,direction] of [[0,[2,0,0],[.5,0,Math.sqrt(3)/2]],
  [.25,[0,2,0],[0,.5,Math.sqrt(3)/2]],[.5,[-2,0,0],[-.5,0,Math.sqrt(3)/2]],[.75,[0,-2,0],[0,-.5,Math.sqrt(3)/2]]]){
  const p=cone.sample(.75,azimuth);p.origin.forEach((v,i)=>near(v,origin[i]));p.direction.forEach((v,i)=>near(v,direction[i]));
 }
});
test('area sampling respects hollow thickness and divergence varies with base radius',()=>{
 const s=shape();s.radiusThickness=1;const cone=createParticleCone(s),centre=cone.sample(0,0),half=cone.sample(.25,0),rim=cone.sample(1,0);
 assert.deepEqual(centre,{origin:[0,0,0],direction:[0,0,1]});near(half.origin[0],1);near(rim.origin[0],2);
 assert.ok(half.direction[0]<rim.direction[0]);assert.ok(half.direction[2]>rim.direction[2]);
 s.radiusThickness=.5;const hollow=createParticleCone(s);near(hollow.sample(0,0).origin[0],1);near(hollow.sample(1,0).origin[0],2);
});
test('zero angle retains straight emission and exact 90-degree limit remains planar',()=>{
 const s=shape();s.angle=0;s.radius.value=0;
 assert.deepEqual(createParticleCone(s).sample(.25,.25),{origin:[0,0,0],direction:[0,0,1]});
 s.angle=90;s.radius.value=2;s.radiusThickness=1;
 for(const r of [0,.25,1]){const p=createParticleCone(s).sample(r,.25);near(p.direction[0],0);near(p.direction[1],1);assert.equal(p.direction[2],0);}
});
test('shape scaling changes spawn geometry without inventing velocity scaling',()=>{
 const plain=shape(),s=shape();s.m_Scale={x:-2,y:0,z:3};
 for(const azimuth of [.1,.25,.7]){
  const a=createParticleCone(plain).sample(.5,azimuth),b=createParticleCone(s).sample(.5,azimuth);
  near(b.origin[0],-2*a.origin[0]);near(b.origin[1],0);assert.deepEqual(b.direction,a.direction);
 }
});
test('unsupported arc, point-cone, resource and direction controls are never silently ignored',()=>{
 const changes=[s=>s.type=8,s=>s.angle=91,s=>s.angle=-1,s=>s.angle=NaN,s=>s.radius.value=0,s=>s.radius.value=-1,
  s=>s.radius.mode=1,s=>s.radius.spread=.1,s=>s.radiusThickness=2,s=>s.arc.mode=3,s=>s.arc.value=180,s=>s.arc.spread=.1,
  s=>s.alignToDirection=true,s=>s.randomDirectionAmount=.1,s=>s.sphericalDirectionAmount=.1,s=>s.randomPositionAmount=.1,
  s=>s.m_Mesh.m_PathID='1',s=>s.m_Scale.x=Infinity];
 for(const change of changes){const s=shape();change(s);assert.throws(()=>createParticleCone(s));}
 const cone=createParticleCone(shape());
 for(const pair of [[-1,0],[0,2],[NaN,0],[0,Infinity]])assert.throws(()=>cone.sample(...pair),/sample/);
});
