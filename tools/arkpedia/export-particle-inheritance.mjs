// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createParticleInheritance} from '../../shared/arkpedia/native-particle-inheritance.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const rows={},sources={};
for(const [name,count] of [['tragodia',9],['lappland-alter',0]]){
 const bytes=await readFile(root+`.cache/arkpedia/${name}-source/effects/native-effects.bin`);
 const meta=JSON.parse(await readFile(root+`data/arkpedia-${name==='lappland-alter'?'lappland':name}-effects.json`));
 if(sha(bytes)!==meta.pack.sha256)throw Error('Changed original effect pack');
 const pack=JSON.parse(gunzipSync(bytes));sources[name]={operator:pack.operator,version:pack.version,sourcePackSha256:sha(bytes)};
 let found=0;
 for(const [key,p]of Object.entries(pack.records))if(p.type==='ParticleSystem'&&p.data.InheritVelocityModule.enabled){
  const go=p.references.find(r=>r.field==='m_GameObject').target;
  const renderer=pack.records[go].references.map(r=>r.target).find(id=>pack.records[id]?.type==='ParticleSystemRenderer');
  rows[key]={source:name,name:pack.records[go].data.m_Name,particleSha256:p.serializedSha256,data:p.data,
   renderer:{id:renderer,sha256:pack.records[renderer].serializedSha256,data:pack.records[renderer].data}};found++;
 }
 if(found!==count)throw Error('Changed original inherited-velocity inventory');
}
const fixture='test/fixtures/arkpedia-particle-inheritance.json',bytes=Buffer.from(JSON.stringify(rows)+'\n');
await writeFile(root+fixture,bytes);
const velocityAt=t=>[t+1,2*t-1,3-t*t],samples={};
for(const [key,row]of Object.entries(rows)){
 const inherit=createParticleInheritance(row.data);
 samples[key]=[0,.25,1].flatMap(birth=>[0,.125,.5,1].map(age=>{
  const particle={id:7,age,lifetime:2},time=birth+age/row.data.simulationSpeed;
  return {birth,age,time,velocity:inherit.sample(particle,time,velocityAt)(age)};
 }));
}
await writeFile(root+'.cache/arkpedia/tragodia-source/inheritance-samples.json',JSON.stringify(samples)+'\n');
const manifest={schemaVersion:1,sources,scope:{sourceMapping:true,localReplay:true,velocityAcquisition:'explicitWorldVelocity',compiledFrameParity:false,enabledOperators:[]},
 fixture:{path:fixture,bytes:bytes.length,sha256:sha(bytes)},particles:Object.fromEntries(Object.entries(rows).map(([key,r])=>[key,
 {source:r.source,name:r.name,particleSha256:r.particleSha256,renderer:r.renderer.id,rendererSha256:r.renderer.sha256}]))};
await writeFile(root+'data/arkpedia-particle-inheritance.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({particles:Object.keys(rows).length,samples:Object.values(samples).reduce((n,s)=>n+s.length,0),bytes:bytes.length}));
