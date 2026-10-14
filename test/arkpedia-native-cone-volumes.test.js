// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{createParticleConeVolume}from'../shared/arkpedia/native-particle-cone-volume.js';
import f from'./fixtures/arkpedia-cone-volumes.json'with{type:'json'};import m from'../data/arkpedia-cone-volumes.json'with{type:'json'};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`),shape=()=>structuredClone(Object.values(f).find(r=>r.shape.angle===5).shape);
test('original volume inventory retains source hashes and unverified native distribution limits',()=>{
 const raw=readFileSync(new URL('./fixtures/arkpedia-cone-volumes.json',import.meta.url));assert.equal(raw.length,m.fixture.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),m.fixture.sha256);
 assert.deepEqual(m.counts,{profiles:7,sampled:4,held:3,points:108});assert.equal(m.scope.nativeEmissionParity,false);assert.equal(m.scope.compiledFrameParity,false);assert.deepEqual(m.scope.enabledOperators,[]);
});
for(const[id,row]of Object.entries(f))test(id+' retains volume depth, annular limits and its unsupported arc boundary',()=>{
 const s=structuredClone(row.shape),before=structuredClone(s);if(m.held[id]){assert.throws(()=>createParticleConeVolume(s),{message:m.held[id]});return;}
 const cone=createParticleConeVolume(s),p=cone.sample(.25,.4,.3),h=p.origin[2]/s.m_Scale.z/s.length;near(cone.fraction(h),.3);
 const radius=s.radius.value+h*s.length*Math.tan(s.angle*Math.PI/180),r=Math.hypot(p.origin[0]/s.m_Scale.x,p.origin[1]/s.m_Scale.y);
 near((r/radius)**2,(1-s.radiusThickness)**2+.25*(1-(1-s.radiusThickness)**2));near(Math.hypot(...p.direction),1);
 assert.deepEqual(cone.sample(.25,.4,.3),p);assert.deepEqual(s,before);
});
test('cylinder depth is uniform and radial density remains area-uniform through nonuniform reflected scale',()=>{
 const s=shape();s.angle=0;s.length=2;s.radiusThickness=.3;s.m_Scale={x:-2,y:3,z:.5};const cone=createParticleConeVolume(s),p=cone.sample(.5,.25,.3);
 near(p.origin[2],.3);near(p.origin[0],0);near(p.origin[1],3*s.radius.value*Math.sqrt(.7**2+.5*(1-.7**2)));assert.deepEqual(p.direction,[0,0,1]);
});
test('volume depth follows integrated cross-sectional area rather than a uniform axial shortcut',()=>{
 const s=shape();s.angle=45;s.length=2;s.radius.value=1;const cone=createParticleConeVolume(s),p=cone.sample(1,0,.5);
 const z=p.origin[2];near(((1+z)**3-1)/(27-1),.5);near(p.origin[0],1+z);assert.ok(z>1);near(p.direction[0],Math.SQRT1_2);near(p.direction[2],Math.SQRT1_2);
 s.radius.value=0;const apex=createParticleConeVolume(s).sample(.25,.25,.125);near(apex.origin[2],1);near(apex.origin[1],.5);
 s.angle=1e-12;s.radius.value=1;const shallow=createParticleConeVolume(s).sample(.5,.5,.3);near(shallow.origin[2],.6);
});
test('zero lengths, endpoint depths and malformed inputs cannot produce invented arc or surface distributions',()=>{
 const s=shape();s.length=0;const cone=createParticleConeVolume(s);near(cone.sample(1,0,1).origin[2],0);
 for(const mutate of[s=>s.arc.mode=3,s=>s.arc.spread=.1,s=>s.angle=90,s=>s.length=-1,s=>s.radiusThickness=0,s=>s.m_Mesh.m_PathID='1',s=>s.m_Scale.z=NaN]){const bad=shape();mutate(bad);assert.throws(()=>createParticleConeVolume(bad));}
 for(const a of[[-1,0,0],[.5,NaN,.5],[.5,.5,2]])assert.throws(()=>createParticleConeVolume(shape()).sample(...a));
 const ready=createParticleConeVolume(shape());near(ready.sample(.5,0,0).origin[2],0);near(ready.sample(.5,0,1).origin[2],shape().length);
});
