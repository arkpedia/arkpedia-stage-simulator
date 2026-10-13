// SPDX-License-Identifier: GPL-3.0-or-later
import{readFile,writeFile}from'node:fs/promises';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import{createMovingParticles}from'../../shared/arkpedia/native-moving-particles.js';
import{createStationaryParticles}from'../../shared/arkpedia/native-stationary-particles.js';
import{createChildEmissionSchedule}from'../../shared/arkpedia/native-child-emission.js';
import{createChildParticleFrames}from'../../shared/arkpedia/native-child-particle-frame.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const links=JSON.parse(await readFile(root+'data/arkpedia-particle-birth-links.json')),rows={},samples={},admission={};
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
// Deliberately synthetic recorded parent motion and source frames for module
// diagnostics. These are not original game parent trajectories or dispatch.
const diagnosticFrames=()=>createChildParticleFrames({
 parentAt:(parent,id,t)=>({position:[id*.01+t*.2,t*.1,-t*.3],velocity:[.2,.1,-.3]}),
 sourceFrameAt:()=>({birth:identity,movement:identity,parentOrigin:[0,0,0]})});
for(const name of['tragodia','lappland-alter']){
 const bytes=await readFile(root+`.cache/arkpedia/${name}-source/effects/native-effects.bin`);
 if(sha(bytes)!==links.sources[name].sourcePackSha256)throw Error('Changed original child motion pack');
 const pack=JSON.parse(gunzipSync(bytes)),schedule=createChildEmissionSchedule(pack);
 for(const[id,ref]of Object.entries(links.children).filter(([,r])=>r.source===name)){
  const record=pack.records[id],source=record.data;
  // Retain all active modules, the authored clock and non-module fields.
  // Dormant module bodies remain unchanged in the pinned original source pack.
  const data=Object.fromEntries(Object.entries(source).filter(([k,v])=>!k.endsWith('Module')||v.enabled||k==='EmissionModule'));
  rows[id]={source:name,particleSha256:record.serializedSha256,data};
  if(rows[id].particleSha256!==ref.particleSha256)throw Error('Changed original child particle');
  const moving=['ShapeModule','VelocityModule','UVModule','ClampVelocityModule','NoiseModule','InheritVelocityModule'].some(k=>data[k]?.enabled)||data.moveWithTransform===1;
  let sampler;
  try{sampler=moving?createMovingParticles(data):createStationaryParticles(data);}
  catch(error){if(error.message!=='Native cone angle/arc mode needs review')throw error;admission[id]={held:error.message};continue;}
  admission[id]={sampler:moving?'moving':'stationary'};const frames=diagnosticFrames();
  samples[id]=[0,.03,.1,.5,1,2,4].map(time=>({time,particles:sampler.sampleRecords(schedule.sample(id,time),time,frames).map(p=>{
   const positioned=p.position?p:{...p,origin:[0,0,0],displacement:[0,0,0],velocitySpace:'local',simulationSpace:data.moveWithTransform===1?'world':'local'};
   return{...p,diagnosticWorldPosition:frames.worldPosition(positioned,time)};
  })}));
 }
}
const fixture='test/fixtures/arkpedia-child-particle-motion.json',raw=Buffer.from(JSON.stringify(rows)+'\n');await writeFile(root+fixture,raw);
const output='.cache/arkpedia/tragodia-source/child-motion-samples.json',sampleBytes=Buffer.from(JSON.stringify(samples)+'\n');await writeFile(root+output,sampleBytes);
const manifest={schemaVersion:1,sources:links.sources,birthFixture:links.fixture,
 scope:{sourceMapping:true,scheduledParticleSampling:true,explicitParentMotion:true,syntheticParentMotion:true,nativeParentMotion:false,childEmissionPlaying:false,compiledFrameParity:false,enabledOperators:[]},
 fixture:{path:fixture,bytes:raw.length,sha256:sha(raw)},samples:{path:output,bytes:sampleBytes.length,sha256:sha(sampleBytes)},admission,
 counts:{children:Object.keys(rows).length,sampled:Object.keys(samples).length,held:Object.keys(rows).length-Object.keys(samples).length,particles:Object.values(samples).flat().reduce((n,s)=>n+s.particles.length,0)}};
await writeFile(root+'data/arkpedia-child-particle-motion.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.counts));
