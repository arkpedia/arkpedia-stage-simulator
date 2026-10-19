// SPDX-License-Identifier: GPL-3.0-or-later
// Native straight-world controls and explicit prewarm/birth-frame probes.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {createEffectPose} from '../../shared/arkpedia/native-effect-pose.js';
import {createMovingParticles} from '../../shared/arkpedia/native-moving-particles.js';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const meta=JSON.parse(await readFile(new URL('data/arkpedia-aphrissa-effects.json',root))),raw=await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-effects.bin',root));
assert.equal(sha(raw),meta.pack.sha256);const pack=JSON.parse(gunzipSync(raw)),rows={},owners=new Map(),samples=[];
const animations=JSON.parse(await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-animations.json',root)));
assert.equal(animations.sourcePackSha256,meta.pack.sha256);
for(const name of Object.keys(pack.roots))for(const n of createEffectPose(pack,animations,name).nodes.values())
  for(const ref of pack.records[n.gameObject].references??[])if(pack.records[ref.target]?.type==='ParticleSystem')owners.set(ref.target,name);
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function frame(mode,time){
  if(mode==='identity')return {birth:identity,movement:identity};
  time=Math.max(0,time);
  const matrix=time<.1?[0,2,0,0,-3,0,0,0,0,0,-4,0,10+2*time,20+3*time,30-time,1]
    :[1.5,0,0,0,0,-2,0,0,0,0,.5,0,-20+time,40-2*time,5+time,1];
  return {birth:matrix,movement:matrix};
}
for(const [id,r] of Object.entries(pack.records)){
  const s=r.data;
  if(r.type!=='ParticleSystem'||s.moveWithTransform!==1||['VelocityModule','ClampVelocityModule','NoiseModule','ForceModule','InheritVelocityModule'].some(k=>s[k]?.enabled))continue;
  const go=r.references.find(ref=>ref.field==='m_GameObject').target,
    renderer=pack.records[go].references.find(ref=>pack.records[ref.target]?.type==='ParticleSystemRenderer').target;
  assert.ok(owners.has(id));rows[id]={root:owners.get(id),name:pack.records[go].data.m_Name,serializedSha256:r.serializedSha256,data:s,
    gameObjectActive:pack.records[go].data.m_IsActive,gameObjectSha256:pack.records[go].serializedSha256,
    renderer,rendererSha256:pack.records[renderer].serializedSha256};
  if(s.ShapeModule.enabled)continue;
  for(const seed of [1,17])for(const time of [0,.15,.8,2])for(const mode of ['identity','affineChange']){
    const emitter=createMovingParticles(s,{seed});
    const particles=emitter.sample(time,{frameAt:t=>frame(mode,t)}).map(p=>Object.fromEntries([
      'id','born','birthTime','age','lifetime','origin','initialVelocity','displacement','position','worldPosition','velocitySpace','simulationSpace'].map(k=>[k,p[k]])));
    samples.push({record:id,seed,time,mode,particles});
  }
}
assert.equal(Object.keys(rows).length,6);assert.equal(samples.length,32);
const fixturePath='test/fixtures/arkpedia-aphrissa-world-birth.json',fixture=Buffer.from(JSON.stringify(rows)+'\n'),
  samplePath='.cache/arkpedia/aphrissa-source/effects/world-birth-samples.json',sampleBytes=Buffer.from(JSON.stringify(samples)+'\n');
await writeFile(new URL(fixturePath,root),fixture);await writeFile(new URL(samplePath,root),sampleBytes);
const result={schemaVersion:1,operator:pack.operator,version:pack.version,sourcePackSha256:sha(raw),
  scope:{originalProfiles:true,explicitBirthFrames:true,straightWorldKinematics:true,prewarmFramePolicy:'holdStartPose',nativePhaseVerified:false,compiledFrameParity:false,enabledOperators:[]},
  fixture:{path:fixturePath,bytes:fixture.length,sha256:sha(fixture)},samples:{path:samplePath,bytes:sampleBytes.length,sha256:sha(sampleBytes)},
  counts:{profiles:6,shapeDisabled:2,shapeEnabled:4,snapshots:samples.length}};
await writeFile(new URL('data/arkpedia-aphrissa-world-birth.json',root),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.counts));
