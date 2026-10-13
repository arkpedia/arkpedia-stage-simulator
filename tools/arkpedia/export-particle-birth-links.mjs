// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {createParticleBirthClock} from '../../shared/arkpedia/native-particle-birth-clock.js';
import {createSubEmitterGraph} from '../../shared/arkpedia/native-sub-emitter-graph.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const rows={parents:{},children:{}},sources={},samples={};
const clocks=s=>({InitialModule:{enabled:s.InitialModule.enabled,maxNumParticles:s.InitialModule.maxNumParticles,startLifetime:s.InitialModule.startLifetime},
 EmissionModule:s.EmissionModule,startDelay:s.startDelay,lengthInSec:s.lengthInSec,simulationSpeed:s.simulationSpeed,looping:s.looping,prewarm:s.prewarm,playOnAwake:s.playOnAwake,moveWithTransform:s.moveWithTransform,ringBufferMode:s.ringBufferMode});
for(const[name,count,linkCount]of [['tragodia',9,9],['lappland-alter',6,60]]){
 const bytes=await readFile(root+`.cache/arkpedia/${name}-source/effects/native-effects.bin`),meta=JSON.parse(await readFile(root+`data/arkpedia-${name==='lappland-alter'?'lappland':name}-effects.json`));
 if(sha(bytes)!==meta.pack.sha256)throw Error('Changed original effect pack');
 const pack=JSON.parse(gunzipSync(bytes)),graph=createSubEmitterGraph(pack);sources[name]={operator:pack.operator,version:pack.version,sourcePackSha256:sha(bytes)};
 let found=0,links=0;
 for(const[id,r]of Object.entries(pack.records))if(r.type==='ParticleSystem'&&r.data.SubModule.enabled){
  const go=r.references.find(r=>r.field==='m_GameObject').target;
  rows.parents[id]={source:name,name:pack.records[go].data.m_Name,particleSha256:r.serializedSha256,clock:clocks(r.data),module:r.data.SubModule,
   references:r.references.filter(r=>r.field==='emitter')};found++;
  for(const row of graph.links(id)){
   const child=pack.records[row.child];rows.children[row.child]={source:name,particleSha256:child.serializedSha256,clock:clocks(child.data)};links++;
  }
  const clock=createParticleBirthClock(r.data);
  samples[id]=[0,.03,.1,.5,1,2,4].map(time=>{const births=clock.births(time);return{time,births,triggers:graph.triggers(id,births)};});
 }
 if(found!==count||links!==linkCount)throw Error('Changed original birth-link inventory');
}
const fixture='test/fixtures/arkpedia-particle-birth-links.json',bytes=Buffer.from(JSON.stringify(rows)+'\n');await writeFile(root+fixture,bytes);
await writeFile(root+'.cache/arkpedia/tragodia-source/birth-link-samples.json',JSON.stringify(samples)+'\n');
const manifest={schemaVersion:1,sources,scope:{sourceMapping:true,birthScheduling:true,childEmissionPlaying:false,compiledFrameParity:false,enabledOperators:[]},
 fixture:{path:fixture,bytes:bytes.length,sha256:sha(bytes)},parents:Object.fromEntries(Object.entries(rows.parents).map(([id,r])=>[id,
 {source:r.source,name:r.name,particleSha256:r.particleSha256,children:r.references.map(ref=>ref.target)}])),
 children:Object.fromEntries(Object.entries(rows.children).map(([id,r])=>[id,{source:r.source,particleSha256:r.particleSha256}]))};
await writeFile(root+'data/arkpedia-particle-birth-links.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({parents:Object.keys(rows.parents).length,children:Object.keys(rows.children).length,bytes:bytes.length,
 triggers:Object.values(samples).flatMap(rows=>rows).reduce((n,s)=>n+s.triggers.length,0)}));
