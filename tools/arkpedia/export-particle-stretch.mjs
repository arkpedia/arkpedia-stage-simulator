// SPDX-License-Identifier: GPL-3.0-or-later
import{readFile,writeFile}from'node:fs/promises';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import{createParticleStretch}from'../../shared/arkpedia/native-particle-stretch.js';import{createParticlePivot}from'../../shared/arkpedia/native-particle-pivot.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const rows={},sources={},samples={};
const probes=[{position:[1,2,3],velocity:[0,2,0],size:[2,3,4],cameraPosition:[1,2,9],rotation:0},
 {position:[-3,1,2],velocity:[1,2,-3],size:[.5,2,-1],cameraPosition:[4,3,7],rotation:.3},
 {position:[0,0,0],velocity:[0,1,0],size:[1,1,1],cameraPosition:[0,8,0],rotation:0}];
for(const name of['tragodia','lappland-alter']){
 const bytes=await readFile(root+`.cache/arkpedia/${name}-source/effects/native-effects.bin`),meta=JSON.parse(await readFile(root+`data/arkpedia-${name==='lappland-alter'?'lappland':name}-effects.json`));
 if(sha(bytes)!==meta.pack.sha256)throw Error('Changed original stretched particle effect pack');
 const pack=JSON.parse(gunzipSync(bytes));sources[name]={operator:pack.operator,version:pack.version,sourcePackSha256:sha(bytes)};
 for(const[id,r]of Object.entries(pack.records))if(r.type==='ParticleSystemRenderer'&&r.data.m_RenderMode===1){
  const go=r.references.find(r=>r.field==='m_GameObject').target;
  rows[id]={source:name,name:pack.records[go].data.m_Name,data:r.data,serializedSha256:r.serializedSha256};
  const stretch=createParticleStretch(r.data),pivot=createParticlePivot(r.data,{stretch});
  samples[id]=probes.map(probe=>({probe,matrix:pivot.sample(stretch.sample(probe))}));
 }
}
const fixture='test/fixtures/arkpedia-particle-stretch.json',raw=Buffer.from(JSON.stringify(rows)+'\n');await writeFile(root+fixture,raw);
const output='.cache/arkpedia/lappland-alter-source/stretch-samples.json',data=Buffer.from(JSON.stringify(samples)+'\n');await writeFile(root+output,data);
const manifest={schemaVersion:1,sources,scope:{localVelocityBillboard:true,velocityAcquisition:'60HzOneSidedAtBirth',legacyHeadOnThinning:true,nativeBasisOrderVerified:false,compiledFrameParity:false,enabledOperators:[]},
 fixture:{path:fixture,bytes:raw.length,sha256:sha(raw)},samples:{path:output,bytes:data.length,sha256:sha(data)},
 counts:{renderers:Object.keys(rows).length,matrices:Object.keys(rows).length*probes.length}};
await writeFile(root+'data/arkpedia-particle-stretch.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.counts));
