// SPDX-License-Identifier: GPL-3.0-or-later
// Original Circle / BoxShell sources and explicit geometric component probes.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {createEffectPose} from '../../shared/arkpedia/native-effect-pose.js';
import {createParticleSurface} from '../../shared/arkpedia/native-particle-surface.js';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex'),
  source=JSON.parse(await readFile(new URL('data/arkpedia-aphrissa-effects.json',root))),
  mesh=JSON.parse(await readFile(new URL('data/arkpedia-aphrissa-mesh-alignment.json',root))),
  raw=await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-effects.bin',root));
assert.equal(sha(raw),source.pack.sha256);const pack=JSON.parse(gunzipSync(raw)),rows={},owners=new Map(),samples=[];
const animations=JSON.parse(await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-animations.json',root)));
assert.equal(animations.sourcePackSha256,source.pack.sha256);
for(const name of Object.keys(pack.roots))for(const n of createEffectPose(pack,animations,name).nodes.values())
  for(const ref of pack.records[n.gameObject].references??[])if(pack.records[ref.target]?.type==='ParticleSystem'){
    assert.ok(!owners.has(ref.target));owners.set(ref.target,name);
  }
for(const [id,r] of Object.entries(pack.records)){
  const s=r.data;if(r.type!=='ParticleSystem'||!s.ShapeModule.enabled||![10,15].includes(s.ShapeModule.type))continue;
  const go=r.references.find(ref=>ref.field==='m_GameObject').target,
    renderer=pack.records[go].references.find(ref=>pack.records[ref.target]?.type==='ParticleSystemRenderer').target;
  assert.ok(owners.has(id));rows[id]={root:owners.get(id),name:pack.records[go].data.m_Name,serializedSha256:r.serializedSha256,data:s,
    gameObjectActive:pack.records[go].data.m_IsActive,gameObjectSha256:pack.records[go].serializedSha256,
    renderer,rendererSha256:pack.records[renderer].serializedSha256,rendererEnabled:pack.records[renderer].data.m_Enabled};
  const surface=createParticleSurface(s.ShapeModule);
  for(const a of [0,.25,1])for(const b of [0,.25,.75])for(const face of [0,.5,1])
    samples.push({record:id,factors:[a,b,face],...surface.sample(a,b,face)});
}
assert.equal(Object.keys(rows).length,28);assert.equal(samples.length,756);
const fixturePath='test/fixtures/arkpedia-aphrissa-surfaces.json',fixture=Buffer.from(JSON.stringify(rows)+'\n'),
  samplePath='.cache/arkpedia/aphrissa-source/effects/surface-samples.json',sampleBytes=Buffer.from(JSON.stringify(samples)+'\n');
await writeFile(new URL(fixturePath,root),fixture);await writeFile(new URL(samplePath,root),sampleBytes);
const result={schemaVersion:1,operator:pack.operator,version:pack.version,sourcePackSha256:source.pack.sha256,
  reference:{repository:mesh.reference.repository,commit:mesh.reference.commit,
    files:mesh.reference.files.filter(f=>f.path.endsWith('/ParticleSystemEnums.cs'))},
  scope:{originalProfiles:true,uniformArea:true,nativeEmissionParity:false,compiledFrameParity:false,fullEffectDispatchVerified:false,enabledOperators:[]},
  fixture:{path:fixturePath,bytes:fixture.length,sha256:sha(fixture)},samples:{path:samplePath,bytes:sampleBytes.length,sha256:sha(sampleBytes)},
  counts:{profiles:28,circles:Object.values(rows).filter(r=>r.data.ShapeModule.type===10).length,
    boxShells:Object.values(rows).filter(r=>r.data.ShapeModule.type===15).length,
    roots:new Set(Object.values(rows).map(r=>r.root)).size,rendererEnabled:Object.values(rows).filter(r=>r.rendererEnabled).length,
    sourceInactive:Object.values(rows).filter(r=>!r.gameObjectActive).length,probes:samples.length}};
await writeFile(new URL('data/arkpedia-aphrissa-surfaces.json',root),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.counts));
