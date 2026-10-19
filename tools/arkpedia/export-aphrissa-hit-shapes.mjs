// SPDX-License-Identifier: GPL-3.0-or-later
// Original hemisphere/burst-spread hit emitters and enabled dormant point systems.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {createEffectPose} from '../../shared/arkpedia/native-effect-pose.js';
import {createMovingParticles} from '../../shared/arkpedia/native-moving-particles.js';
import {createParticleBirthClock} from '../../shared/arkpedia/native-particle-birth-clock.js';
import {BURST_SPREAD_CONE_CONTRACT} from '../../shared/arkpedia/native-particle-cone.js';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex'),
  source=JSON.parse(await readFile(new URL('data/arkpedia-aphrissa-effects.json',root))),
  reference=JSON.parse(await readFile(new URL('data/arkpedia-aphrissa-surfaces.json',root))).reference,
  raw=await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-effects.bin',root));
assert.equal(sha(raw),source.pack.sha256);const pack=JSON.parse(gunzipSync(raw)),owners=new Map(),rows={},samples=[];
const animations=JSON.parse(await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-animations.json',root)));
assert.equal(animations.sourcePackSha256,source.pack.sha256);
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],still={frameAt:()=>({birth:identity,movement:identity})};
for(const name of Object.keys(pack.roots))for(const n of createEffectPose(pack,animations,name).nodes.values())
  for(const ref of pack.records[n.gameObject].references??[])if(pack.records[ref.target]?.type==='ParticleSystem'){
    assert.ok(!owners.has(ref.target));owners.set(ref.target,name);
  }
for(const [id,r] of Object.entries(pack.records)){
  if(r.type!=='ParticleSystem')continue;const s=r.data,
    hemisphere=s.ShapeModule.enabled&&s.ShapeModule.type===2,
    burst=s.ShapeModule.enabled&&s.ShapeModule.type===4&&s.ShapeModule.arc.mode===3,
    point=!s.ShapeModule.enabled&&!s.EmissionModule.enabled&&s.InitialModule.startSpeed.minMaxState===0&&s.InitialModule.startSpeed.scalar===5
      &&!['VelocityModule','UVModule','ClampVelocityModule','NoiseModule','InheritVelocityModule','ForceModule'].some(k=>s[k]?.enabled);
  if(!hemisphere&&!burst&&!point)continue;
  const go=r.references.find(ref=>ref.field==='m_GameObject').target,
    renderer=pack.records[go].references.find(ref=>pack.records[ref.target]?.type==='ParticleSystemRenderer')?.target;
  if(!renderer||!pack.records[renderer].data.m_Enabled)continue;
  assert.ok(owners.has(id));rows[id]={root:owners.get(id),kind:hemisphere?'hemisphere':burst?'burstSpread':'dormantPoint',
    name:pack.records[go].data.m_Name,serializedSha256:r.serializedSha256,data:s,
    gameObjectActive:pack.records[go].data.m_IsActive,gameObjectSha256:pack.records[go].serializedSha256,
    renderer,rendererSha256:pack.records[renderer].serializedSha256};
  for(const seed of [1,17])for(const time of [0,.15,.4,.8,1.4]){
    const emitter=createMovingParticles(s,{seed,burstSpreadContract:BURST_SPREAD_CONE_CONTRACT}),clock=createParticleBirthClock(s,{seed});
    const particles=emitter.sample(time,still).map(p=>({...Object.fromEntries(['id','born','birthTime','age','lifetime','origin','direction','initialVelocity'].map(k=>[k,p[k]])),
      ...(burst?{cohort:clock.cohort(p)}:{})}));
    samples.push({record:id,seed,time,particles});
  }
}
assert.equal(Object.keys(rows).length,12);assert.equal(samples.length,120);
const fixturePath='test/fixtures/arkpedia-aphrissa-hit-shapes.json',fixture=Buffer.from(JSON.stringify(rows)+'\n'),
  samplePath='.cache/arkpedia/aphrissa-source/effects/hit-shape-samples.json',sampleBytes=Buffer.from(JSON.stringify(samples)+'\n');
await writeFile(new URL(fixturePath,root),fixture);await writeFile(new URL(samplePath,root),sampleBytes);
const result={schemaVersion:1,operator:pack.operator,version:pack.version,sourcePackSha256:source.pack.sha256,reference,
  scope:{originalProfiles:true,positiveZHemisphere:true,explicitIdentityBirthFrames:true,originalBurstCohorts:true,burstSpreadContract:BURST_SPREAD_CONE_CONTRACT,
    dormantEmissionPreserved:true,nativeEmissionParity:false,compiledFrameParity:false,enabledOperators:[]},
  fixture:{path:fixturePath,bytes:fixture.length,sha256:sha(fixture)},samples:{path:samplePath,bytes:sampleBytes.length,sha256:sha(sampleBytes)},
  counts:{profiles:12,hemispheres:3,burstSpread:3,dormantPoints:6,roots:new Set(Object.values(rows).map(r=>r.root)).size,
    sourceInactive:Object.values(rows).filter(r=>!r.gameObjectActive).length,snapshots:samples.length}};
await writeFile(new URL('data/arkpedia-aphrissa-hit-shapes.json',root),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.counts));
