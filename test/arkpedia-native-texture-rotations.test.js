// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{createTextureRotations,textureRotationVector}from'../shared/arkpedia/native-texture-rotation.js';
import f from'./fixtures/arkpedia-texture-rotations.json'with{type:'json'};import m from'../data/arkpedia-texture-rotations.json'with{type:'json'};
const declarations=Array.from({length:4},(_,i)=>({name:'_Rotation'+i,type:'vec4',count:null})),animations={instances:[]};
function source(id){const row=f[id];return{records:{[id]:{type:'MonoBehaviour',data:structuredClone(row.data),references:structuredClone(row.references)},
 [row.component]:{type:'ParticleSystemRenderer',...structuredClone(row.renderer)},[row.gameObject]:{references:[{field:'component',target:id}]}},scriptBindings:{[id]:structuredClone(row.binding)}};}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`),lap=Object.keys(f).find(id=>f[id].source==='lappland-alter');
test('source texture rotations preserve all three scripts and do not certify native script execution',()=>{
 const raw=readFileSync(new URL('./fixtures/arkpedia-texture-rotations.json',import.meta.url));assert.equal(raw.length,m.fixture.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),m.fixture.sha256);
 assert.deepEqual(m.counts,{scripts:3,renderers:3,vectors:12,uvSamples:60});assert.equal(m.scope.nativeSignOrderVerified,false);assert.equal(m.scope.scriptLifecycleVerified,false);assert.equal(m.scope.compiledFrameParity,false);assert.deepEqual(m.scope.enabledOperators,[]);
});
for(const[id,row]of Object.entries(f))test(row.name+' binds source angles to the original renderer without mutating source records',()=>{
 const pack=source(id),before=structuredClone(pack),r=createTextureRotations(pack,row.component,declarations,animations);
 assert.equal(r.script,id);assert.deepEqual(r.angles,[row.data.angle1,row.data._angle2,row.data._angle3,row.data._angle4]);
 for(let i=0;i<4;i++){const v=r.values['_Rotation'+i],a=r.angles[i]*Math.PI/180;near(v[0],Math.cos(a));near(v[1],Math.sin(a));near(v[2],-Math.sin(a));near(v[3],Math.cos(a));}
 assert.equal(r.scope.nativeSignOrderVerified,false);assert.deepEqual(pack,before);
});
test('local quarter-turn rotates about the texture centre while zero turns retain identity',()=>{
 const v=textureRotationVector(90),apply=uv=>[(uv[0]-.5)*v[0]+(uv[1]-.5)*v[2]+.5,(uv[0]-.5)*v[1]+(uv[1]-.5)*v[3]+.5];
 for(const[a,b]of[[[0,0],[1,0]],[[1,0],[1,1]],[[.25,.75],[.25,.25]],[[.5,.5],[.5,.5]]])apply(a).forEach((x,i)=>near(x,b[i]));
 textureRotationVector(0).forEach((x,i)=>near(x,[1,0,0,1][i]));assert.deepEqual(textureRotationVector(450),v);textureRotationVector(-270).forEach((x,i)=>near(x,v[i]));
 for(const bad of[NaN,Infinity,null,'90'])assert.throws(()=>textureRotationVector(bad),/angle/);
});
test('unverified script identity, ownership, schema and animated inputs remain held',()=>{
 const row=f[lap];for(const mutate of[
  p=>delete p.scriptBindings[lap],p=>p.scriptBindings[lap].foreignFile='other',p=>p.scriptBindings[lap].pointer.m_PathID='0',
  p=>p.records[lap].data.m_Script.m_FileID=2,p=>p.records[lap].data._propertyName='_Other',p=>p.records[lap].data.m_Enabled=0,
  p=>p.records[lap].data.extra=1,p=>p.records[lap].data.angle1=NaN,p=>p.records[lap].data._rotateTex1=2,
  p=>p.records[lap].data._angle2=90,p=>p.records[lap].references.find(r=>r.field==='m_GameObject').target='other',
  p=>p.records[lap].data.m_GameObject.m_PathID='0',p=>p.records[lap].references.find(r=>r.field==='m_GameObject').pointer.m_FileID=1,
  p=>p.records[row.gameObject].references.push({field:'component',target:lap}),p=>p.records[row.gameObject].references=[]]){
  const p=source(lap);mutate(p);assert.throws(()=>createTextureRotations(p,row.component,declarations,animations));
 }
 assert.throws(()=>createTextureRotations(source(lap),row.component,declarations,{instances:[{bindings:[{component:lap}]}]}),/Animated/);
 assert.throws(()=>createTextureRotations(source(lap),row.component,declarations,{instances:[{bindings:[{gameObject:row.gameObject,property:'angle1'}]}]}),/Animated/);
 for(const ds of[declarations.slice(1),declarations.map((d,i)=>i?d:{...d,type:'float'}),declarations.map((d,i)=>i?d:{...d,count:4})])
  assert.throws(()=>createTextureRotations(source(lap),row.component,ds,animations),/uniforms/);
 assert.equal(createTextureRotations({},'unrelated',[],animations),null);
});
