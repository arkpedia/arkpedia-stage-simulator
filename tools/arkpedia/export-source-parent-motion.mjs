// SPDX-License-Identifier: GPL-3.0-or-later
import{readFile,writeFile}from'node:fs/promises';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import{createParentParticleMotion}from'../../shared/arkpedia/native-parent-particle-motion.js';
import{createMovingParticles}from'../../shared/arkpedia/native-moving-particles.js';
import{createStationaryParticles}from'../../shared/arkpedia/native-stationary-particles.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const childMeta=JSON.parse(await readFile(root+'data/arkpedia-child-particle-motion.json')),
 links=JSON.parse(await readFile(root+'data/arkpedia-particle-birth-links.json'));
const originalChildren=await readFile(root+childMeta.fixture.path);if(sha(originalChildren)!==childMeta.fixture.sha256)throw Error('Changed original child motion fixture');
const rows={},parents={},children={},statuses={};let sampledChildren=0,particles=0;
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],frameAt=()=>({birth:identity,movement:identity});
for(const name of['tragodia','lappland-alter']){
 const bytes=await readFile(root+`.cache/arkpedia/${name}-source/effects/native-effects.bin`);
 if(sha(bytes)!==links.sources[name].sourcePackSha256)throw Error('Changed original parent motion pack');
 const pack=JSON.parse(gunzipSync(bytes)),motion=createParentParticleMotion(pack,{frameAt});
 Object.assign(statuses,motion.statuses());
 for(const[id,r]of Object.entries(pack.records))if(r.type==='ParticleSystem'&&r.data.SubModule.enabled){
  const data=Object.fromEntries(Object.entries(r.data).filter(([k,v])=>!k.endsWith('Module')||v.enabled||k==='EmissionModule'));
  rows[id]={source:name,particleSha256:r.serializedSha256,data,references:r.references};
  if(motion.parentReady(id))parents[id]=[.03,.1,.2,.44].map(time=>({time,...motion.sample(id,0,time),velocity:motion.parentAt(id,0,time).velocity}));
 }
 for(const[id,ref]of Object.entries(links.children).filter(([,r])=>r.source===name)){
  if(!motion.ready(id)||childMeta.admission[id].held)continue;
  const s=pack.records[id].data,e=childMeta.admission[id].sampler==='moving'?createMovingParticles(s):createStationaryParticles(s),frames=motion.childFrames(id,frameAt);
  children[id]=[0,.03,.1,.5,1,2,4].map(time=>({time,particles:e.sampleRecords(motion.records(id,time),time,frames).map(p=>{
   const q=p.position?p:{...p,origin:[0,0,0],displacement:[0,0,0],simulationSpace:'local',velocitySpace:'local'};particles++;
   return{...p,sourceParentWorldPosition:frames.worldPosition(q,time)};
  })}));sampledChildren++;
 }
}
const fixture='test/fixtures/arkpedia-source-parent-motion.json',raw=Buffer.from(JSON.stringify(rows)+'\n');await writeFile(root+fixture,raw);
const output='.cache/arkpedia/lappland-alter-source/source-parent-motion-samples.json',sampleBytes=Buffer.from(JSON.stringify({parents,children})+'\n');await writeFile(root+output,sampleBytes);
const manifest={schemaVersion:1,sources:links.sources,childFixture:childMeta.fixture,
 scope:{sourceParentParticleMotion:true,sourceChildScheduling:true,syntheticParentMotion:false,sourceFrames:'identityDiagnostic',velocityAcquisition:'local60HzOneSidedAtBirth',compiledFrameParity:false,enabledOperators:[]},
 fixture:{path:fixture,bytes:raw.length,sha256:sha(raw)},samples:{path:output,bytes:sampleBytes.length,sha256:sha(sampleBytes)},statuses,
 counts:{parents:Object.keys(rows).length,sampledParents:Object.keys(parents).length,heldParents:Object.keys(rows).length-Object.keys(parents).length,sampledChildren,particles}};
await writeFile(root+'data/arkpedia-source-parent-motion.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.counts));
