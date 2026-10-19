// SPDX-License-Identifier: GPL-3.0-or-later
// Original combined velocity/limit controls and explicit component probes.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {createParticleMotion} from '../../shared/arkpedia/native-particle-motion.js';
import {createEffectPose} from '../../shared/arkpedia/native-effect-pose.js';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const meta=JSON.parse(await readFile(new URL('data/arkpedia-aphrissa-effects.json',root))),
  raw=await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-effects.bin',root));
assert.equal(sha(raw),meta.pack.sha256);const pack=JSON.parse(gunzipSync(raw)),rows={},samples=[];
const animations=JSON.parse(await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-animations.json',root))),owners=new Map();
assert.equal(animations.sourcePackSha256,meta.pack.sha256);
for(const name of Object.keys(pack.roots))for(const node of createEffectPose(pack,animations,name).nodes.values())
  for(const ref of pack.records[node.gameObject].references??[])if(pack.records[ref.target]?.type==='ParticleSystem'){
    assert.ok(!owners.has(ref.target));owners.set(ref.target,name);
  }
const frames=[[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  [0,2,0,0,-3,0,0,0,0,0,-4,0,100,200,300,1]];
for(const [id,r] of Object.entries(pack.records)){
  const s=r.data;
  if(r.type!=='ParticleSystem'||!s.VelocityModule.enabled||![s.ClampVelocityModule,s.NoiseModule,s.ForceModule].some(m=>m?.enabled))continue;
  const go=r.references.find(ref=>ref.field==='m_GameObject').target,
    renderer=pack.records[go].references.find(ref=>pack.records[ref.target]?.type==='ParticleSystemRenderer').target;
  assert.ok(owners.has(id));
  rows[id]={root:owners.get(id),name:pack.records[go].data.m_Name,gameObjectActive:pack.records[go].data.m_IsActive,
    gameObjectSha256:pack.records[go].serializedSha256,serializedSha256:r.serializedSha256,data:s,
    renderer,rendererSha256:pack.records[renderer].serializedSha256};
  for(const seed of [1,17])for(const index of [0,7])for(const age of [0,.05,.37,1.1])for(const movement of frames){
    const motion=createParticleMotion(s,{seed}),particle={id:index,born:.2,lifetime:2,age},origin=[.1,.2,.3],initialVelocity=[-.4,.3,.2];
    const linearVelocityTransform=(v,_age)=>[0,1,2].map(i=>movement[i]*v[0]+movement[4+i]*v[1]+movement[8+i]*v[2]);
    samples.push({record:id,seed,particle,origin,initialVelocity,movement,
      displacement:motion.sample(particle,origin,initialVelocity,{linearVelocityTransform})});
  }
}
assert.equal(Object.keys(rows).length,11);
const fixturePath='test/fixtures/arkpedia-aphrissa-linear-motion.json',fixture=Buffer.from(JSON.stringify(rows)+'\n'),
  samplesPath='.cache/arkpedia/aphrissa-source/effects/linear-motion-samples.json',sampleBytes=Buffer.from(JSON.stringify(samples)+'\n');
await writeFile(new URL(fixturePath,root),fixture);await writeFile(new URL(samplesPath,root),sampleBytes);
const result={schemaVersion:1,operator:pack.operator,version:pack.version,sourcePackSha256:sha(raw),
  scope:{originalProfiles:true,intervalAveragedLinearVelocity:true,explicitCrossSpaceFrames:true,localReplay:true,
    nativeModuleOrderVerified:false,nativeFrameParity:false,enabledOperators:[]},
  fixture:{path:fixturePath,bytes:fixture.length,sha256:sha(fixture)},samples:{path:samplesPath,bytes:sampleBytes.length,sha256:sha(sampleBytes)},
  counts:{profiles:Object.keys(rows).length,local:Object.values(rows).filter(r=>r.data.moveWithTransform===0).length,
    world:Object.values(rows).filter(r=>r.data.moveWithTransform===1).length,roots:new Set(Object.values(rows).map(r=>r.root)).size,
    serializedInactive:Object.values(rows).filter(r=>!r.gameObjectActive).length,probes:samples.length}};
await writeFile(new URL('data/arkpedia-aphrissa-linear-motion.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.counts));
