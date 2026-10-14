// SPDX-License-Identifier: GPL-3.0-or-later
import{readFile,writeFile}from'node:fs/promises';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import{createParticleConeVolume}from'../../shared/arkpedia/native-particle-cone-volume.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex'),rows={},sources={},samples={},held={};
for(const name of['tragodia','lappland-alter']){
 const bytes=await readFile(root+`.cache/arkpedia/${name}-source/effects/native-effects.bin`),meta=JSON.parse(await readFile(root+`data/arkpedia-${name==='lappland-alter'?'lappland':name}-effects.json`));
 if(sha(bytes)!==meta.pack.sha256)throw Error('Changed original cone-volume effect pack');const p=JSON.parse(gunzipSync(bytes));sources[name]={operator:p.operator,version:p.version,sourcePackSha256:sha(bytes)};
 for(const[id,r]of Object.entries(p.records))if(r.type==='ParticleSystem'&&r.data.ShapeModule.enabled&&r.data.ShapeModule.type===8){
  const go=r.references.find(r=>r.field==='m_GameObject').target;rows[id]={source:name,name:p.records[go].data.m_Name,particleSha256:r.serializedSha256,shape:r.data.ShapeModule};
  let volume;try{volume=createParticleConeVolume(r.data.ShapeModule);}catch(e){held[id]=e.message;continue;}
  samples[id]=[0,.25,1].flatMap(radial=>[0,.4,1].flatMap(azimuth=>[0,.3,1].map(depth=>({radial,azimuth,depth,...volume.sample(radial,azimuth,depth)}))));
 }
}
const fixture='test/fixtures/arkpedia-cone-volumes.json',raw=Buffer.from(JSON.stringify(rows)+'\n');await writeFile(root+fixture,raw);
const path='.cache/arkpedia/lappland-alter-source/cone-volume-samples.json',data=Buffer.from(JSON.stringify(samples)+'\n');await writeFile(root+path,data);
const meta={schemaVersion:1,sources,scope:{uniformFrustumVolume:true,nativeEmissionParity:false,compiledFrameParity:false,enabledOperators:[]},
 fixture:{path:fixture,bytes:raw.length,sha256:sha(raw)},samples:{path,bytes:data.length,sha256:sha(data)},held,counts:{profiles:Object.keys(rows).length,sampled:Object.keys(samples).length,held:Object.keys(held).length,points:Object.values(samples).reduce((n,v)=>n+v.length,0)}};
await writeFile(root+'data/arkpedia-cone-volumes.json',JSON.stringify(meta,null,2)+'\n');console.log(JSON.stringify(meta.counts));
