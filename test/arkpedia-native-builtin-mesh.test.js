// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{createBuiltinMeshResolver}from'../shared/arkpedia/native-builtin-mesh.js';
import f from'../data/arkpedia-unity-builtin-meshes.json'with{type:'json'};
const entries=Object.entries(f.references),sha=Object.keys(f.supportedEffectPacks)[0];
const reference=r=>({field:'m_Mesh',pointer:r.pointer,unresolved:{foreignFile:'Library/unity default resources',pathId:'10210'}});
test('original built-in object retains player/resource versions, raw object identity and source bytes',()=>{
 assert.equal(f.client.unityVersion,'2021.3.39f1');assert.equal(f.resource.unityVersion,'2021.3.38f1');assert.equal(f.client.platform,13);assert.equal(f.resource.platform,13);
 assert.equal(f.resource.sha256,'ea2ce64646b2a83bcd5fc8ff40ab1a8eb6abbbf225798c865fbbfabe1f45fc22');
 const raw=readFileSync(new URL('./fixtures/arkpedia-unity-builtin-mesh.json',import.meta.url));assert.equal(raw.length,f.fixture.bytes);
 assert.equal(createHash('sha256').update(raw).digest('hex'),f.fixture.sha256);assert.equal(f.meshes['10210'].serializedBytes,604);
 assert.equal(f.scope.wholePackageVerified,false);assert.equal(f.scope.compiledFrameParity,false);assert.deepEqual(f.scope.enabledOperators,[]);
 assert.deepEqual(f.meshes['10210'].data.submeshTriangles,[[[0,3,1],[3,0,2]]]);
 assert.ok(f.meshes['10210'].data.positions.some(v=>v[2]!==0));assert.ok(f.meshes['10210'].data.normals.every(v=>v[2]===-1));
});
for(const[id,r]of entries)test(id+' resolves only its recorded source pack and original foreign pointer',()=>{
 const before=structuredClone(f),resolver=createBuiltinMeshResolver(f,r.sourcePackSha256);
 assert.deepEqual(resolver.resolve(id,reference(r)),f.meshes['10210'].data);assert.deepEqual(f,before);
 for(const changed of[{...reference(r),field:'m_Mesh1'}, {...reference(r),target:'invented'},
  {...reference(r),pointer:{...r.pointer,m_FileID:r.pointer.m_FileID+1}}, {...reference(r),pointer:{...r.pointer,m_PathID:'10202'}},
  {...reference(r),unresolved:{foreignFile:'arbitrary.ab',pathId:'10210'}}])assert.throws(()=>resolver.resolve(id,changed),/pointer/);
 assert.throws(()=>resolver.resolve('unknown',reference(r)),/pointer/);
});
test('unknown packs, engine/platform mismatch, unreviewed objects and invalid buffers remain held',()=>{
 assert.throws(()=>createBuiltinMeshResolver(f,'unknown'),/identity/);
 for(const change of[x=>x.client.unityVersion='2022.3.0f1',x=>x.resource.platform=1,x=>x.scope.originalBuiltinMesh=false,x=>x.scope.wholePackageVerified=true,
  x=>x.meshes['10210'].name='Cube',x=>x.meshes['10210'].serializedSha256='changed',x=>x.meshes['10210'].data.positions[0][0]=NaN,
  x=>x.meshes['10210'].data.normals.pop(),x=>x.meshes['10210'].data.submeshTriangles[0][0][0]=4,x=>x.meshes['10210'].data.uvChannels[0][0][0]=Infinity]){
  const bad=structuredClone(f);change(bad);assert.throws(()=>createBuiltinMeshResolver(bad,sha));
 }
 const other=entries.find(([,r])=>r.sourcePackSha256!==sha);assert.throws(()=>createBuiltinMeshResolver(f,sha).resolve(other[0],reference(other[1])),/pointer/);
});
