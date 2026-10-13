// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{particlePivotMatrix,createParticlePivot}from'../shared/arkpedia/native-particle-pivot.js';
import f from'./fixtures/arkpedia-particle-pivots.json'with{type:'json'};import m from'../data/arkpedia-particle-pivots.json'with{type:'json'};
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const point=(matrix,v)=>[0,1,2].map(i=>matrix[i]*v[0]+matrix[4+i]*v[1]+matrix[8+i]*v[2]+matrix[12+i]);
test('original pivot inventory preserves source vectors and its unapproved native sign/order boundary',()=>{
 const raw=readFileSync(new URL('./fixtures/arkpedia-particle-pivots.json',import.meta.url));assert.equal(raw.length,m.fixture.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),m.fixture.sha256);
 assert.equal(Object.keys(f).length,64);assert.deepEqual(m.counts,{renderers:64,sampled:32,held:32,matrices:96});
 assert.equal(m.scope.nativeSignOrderVerified,false);assert.equal(m.scope.flipPlaying,false);assert.equal(m.scope.compiledFrameParity,false);assert.deepEqual(m.scope.enabledOperators,[]);
});
for(const[id,row]of Object.entries(f))test(id+' retains original pivot as a scaled rotation anchor or keeps its unsupported renderer held',()=>{
 const before=structuredClone(row.data);if(m.held[id]){assert.throws(()=>createParticlePivot(row.data),{message:m.held[id]});return;}
 const pivot=createParticlePivot(row.data),vector=['x','y','z'].map(k=>row.data.m_Pivot[k]);assert.deepEqual(pivot.pivot,vector);
 const frame=[0,2,0,0,-3,0,0,0,0,0,-4,0,5,6,7,1],result=pivot.sample(frame);
 const anchor=point(result,vector);anchor.forEach((v,i)=>near(v,frame[12+i]));assert.deepEqual(result.slice(0,12),frame.slice(0,12));
 assert.deepEqual(pivot.sample(identity),particlePivotMatrix(identity,vector));assert.deepEqual(pivot.sample(frame),result);assert.deepEqual(row.data,before);
});
test('half-diameter pivots anchor opposite mesh edges through rotation, nonuniform scale and reflection',()=>{
 const frame=[0,2,0,0,-3,0,0,0,0,0,-4,0,10,20,30,1],baseline=frame.slice();
 assert.deepEqual(point(particlePivotMatrix(frame,[.5,0,0]),[.5,0,0]),[10,20,30]);
 assert.deepEqual(point(particlePivotMatrix(frame,[-.5,0,0]),[-.5,0,0]),[10,20,30]);
 assert.deepEqual(point(particlePivotMatrix(frame,[0,.5,0]),[0,.5,0]),[10,20,30]);
 assert.deepEqual(point(particlePivotMatrix(frame,[0,0,-6.18]),[0,0,-6.18]),[10,20,30]);assert.deepEqual(frame,baseline);
});
test('particle size changes multiply pivot shifts without changing physics positions or geometry',()=>{
 const p=[.25,-.5,2],a=identity.slice(),b=identity.slice();b[0]=2;b[5]=3;b[10]=4;
 assert.deepEqual(particlePivotMatrix(a,p).slice(12,15),[-.25,.5,-2]);assert.deepEqual(particlePivotMatrix(b,p).slice(12,15),[-.5,1.5,-8]);
 const collapsed=identity.slice();collapsed[0]=collapsed[5]=collapsed[10]=0;assert.deepEqual(particlePivotMatrix(collapsed,p),collapsed);
 const unchanged=particlePivotMatrix(a,[0,0,0]);assert.deepEqual(unchanged,a);assert.notEqual(unchanged,a);
});
test('invalid frames, vectors, flips and modes cannot become a silent zero pivot',()=>{
 for(const p of[[NaN,0,0],[0,Infinity,0],[1],null])assert.throws(()=>particlePivotMatrix(identity,p),/pivot vector/);
 for(const change of[a=>a.pop(),a=>a[3]=1,a=>a[0]=NaN]){const frame=identity.slice();change(frame);assert.throws(()=>particlePivotMatrix(frame,[0,0,0]),/pivot frame/);}
 const huge=identity.slice();huge[0]=1e308;assert.throws(()=>particlePivotMatrix(huge,[1e308,0,0]),/precision/);
 const id=Object.keys(f).find(id=>!m.held[id]),original=structuredClone(f[id].data);
 for(const change of[s=>s.m_Pivot.x=NaN,s=>s.m_Flip.x=.5,s=>s.m_RenderMode=1,s=>s.m_RenderAlignment=4]){const bad=structuredClone(original);change(bad);assert.throws(()=>createParticlePivot(bad));}
});
