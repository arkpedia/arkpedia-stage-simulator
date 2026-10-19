// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import artifact from '../data/arkpedia-aphrissa-builtin-meshes.json' with {type:'json'};
import effects from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import {createBuiltinMeshResolver} from '../shared/arkpedia/native-builtin-mesh.js';
const hash=Object.keys(artifact.supportedEffectPacks)[0];
const reference=r=>({field:'m_Mesh',pointer:r.pointer,unresolved:{foreignFile:'Library/unity default resources',pathId:r.mesh}});
test('Aphrissa retains the original two meshes, second Cube UV channel and limited official-player provenance',()=>{
 assert.deepEqual(Object.keys(artifact.supportedEffectPacks),[effects.pack.sha256]);
 const raw=readFileSync(new URL('./fixtures/arkpedia-aphrissa-builtin-meshes.json',import.meta.url));
 assert.equal(raw.length,artifact.fixture.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),artifact.fixture.sha256);
 assert.equal(artifact.scope.sourceInputsOnly,true);assert.equal(artifact.scope.exactGameClientVerified,false);assert.equal(artifact.scope.wholePackageVerified,false);assert.equal(artifact.scope.compiledFrameParity,false);assert.deepEqual(artifact.scope.enabledOperators,[]);
 assert.equal(artifact.client.unityVersion,'2021.3.39f1');assert.equal(artifact.resource.unityVersion,'2021.3.38f1');assert.equal(artifact.client.platform,13);
 const cube=artifact.meshes['10202'],quad=artifact.meshes['10210'];assert.equal(cube.name,'Cube');assert.equal(cube.serializedBytes,1816);assert.equal(cube.data.positions.length,24);assert.equal(cube.data.submeshTriangles[0].length,12);assert.equal(cube.data.uvChannels[1].length,24);assert.equal(cube.data.vertexChannels[5].offset,48);
 assert.equal(quad.name,'Quad');assert.equal(quad.data.positions.length,4);assert.equal(quad.data.submeshTriangles[0].length,2);assert.equal(quad.data.uvChannels[1],null);
});
for(const [key,row] of Object.entries(artifact.references))test(key+' resolves its original mesh while retaining source ownership',()=>{
 const before=structuredClone(artifact),r=createBuiltinMeshResolver(artifact,hash),input=reference(row),result=r.resolve(key,input);
 assert.equal(result,artifact.meshes[row.mesh].data);assert.deepEqual(artifact,before);
 for(const changed of [{...input,field:'m_Mesh1'},{...input,target:'invented'},
  {...input,pointer:{...row.pointer,m_PathID:row.mesh==='10202'?'10210':'10202'}},
  {...input,pointer:{...row.pointer,m_FileID:row.pointer.m_FileID+1}},
  {...input,unresolved:{foreignFile:'arbitrary.ab',pathId:row.mesh}}])assert.throws(()=>r.resolve(key,changed),/pointer/);
 assert.throws(()=>r.resolve('unknown',input),/pointer/);
});
test('Unreviewed primitives, wrong engine identity, malformed secondary UVs and false provenance remain held',()=>{
 for(const change of [a=>a.scope.exactGameClientVerified=true,a=>a.client.unityVersion='2022.3.0f1',a=>a.meshes['10202'].serializedSha256='0'.repeat(64),a=>a.meshes['10202'].serializedBytes=604,a=>a.meshes['10202'].name='GeneratedCube',a=>a.meshes['10202'].data.uvChannels[1][0][0]=Infinity,a=>a.meshes['10202'].data.positions[0][0]=NaN,a=>a.meshes['10202'].data.submeshTriangles[0][0][0]=24,a=>a.meshes['10202'].data.uvChannels[1].pop(),a=>a.meshes['10203']=structuredClone(a.meshes['10202']),a=>a.meshes={constructor:{data:structuredClone(a.meshes['10202'].data)}}]){
  const bad=structuredClone(artifact);change(bad);assert.throws(()=>createBuiltinMeshResolver(bad,hash));
 }
 assert.throws(()=>createBuiltinMeshResolver(artifact,'unknown'),/identity/);
});
