// SPDX-License-Identifier: GPL-3.0-or-later
import{readFile,writeFile}from'node:fs/promises';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import{createParticlePivot}from'../../shared/arkpedia/native-particle-pivot.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const rows={},sources={},samples={},held={};
const frames=[
 [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
 [0,2,0,0,-3,0,0,0,0,0,-4,0,5,6,7,1],
 [1.5,.2,.3,0,.4,-2,.1,0,.3,.4,2.5,0,-10,20,30,1]
];
for(const name of['tragodia','lappland-alter']){
 const bytes=await readFile(root+`.cache/arkpedia/${name}-source/effects/native-effects.bin`),meta=JSON.parse(await readFile(root+`data/arkpedia-${name==='lappland-alter'?'lappland':name}-effects.json`));
 if(sha(bytes)!==meta.pack.sha256)throw Error('Changed original pivot effect pack');
 const p=JSON.parse(gunzipSync(bytes));sources[name]={operator:p.operator,version:p.version,sourcePackSha256:sha(bytes)};
 for(const[id,r]of Object.entries(p.records))if(r.type==='ParticleSystemRenderer'&&Object.values(r.data.m_Pivot).some(v=>v!==0)){
  const go=r.references.find(r=>r.field==='m_GameObject').target;
  const data=Object.fromEntries(['m_RenderMode','m_RenderAlignment','m_Pivot','m_Flip','m_Enabled'].map(k=>[k,r.data[k]]));
  rows[id]={source:name,name:p.records[go].data.m_Name,serializedSha256:r.serializedSha256,data};
  let pivot;try{pivot=createParticlePivot(data);}catch(error){held[id]=error.message;continue;}
  samples[id]=frames.map(frame=>({frame,matrix:pivot.sample(frame)}));
 }
}
const fixture='test/fixtures/arkpedia-particle-pivots.json',raw=Buffer.from(JSON.stringify(rows)+'\n');await writeFile(root+fixture,raw);
const output='.cache/arkpedia/lappland-alter-source/pivot-samples.json',data=Buffer.from(JSON.stringify(samples)+'\n');await writeFile(root+output,data);
const manifest={schemaVersion:1,sources,scope:{sourceMapping:true,localPivotMapping:true,anchorConvention:'positionMinusRotatedScaledPivot',nativeSignOrderVerified:false,flipPlaying:false,compiledFrameParity:false,enabledOperators:[]},
 fixture:{path:fixture,bytes:raw.length,sha256:sha(raw)},samples:{path:output,bytes:data.length,sha256:sha(data)},held,
 counts:{renderers:Object.keys(rows).length,sampled:Object.keys(samples).length,held:Object.keys(held).length,matrices:Object.values(samples).reduce((n,r)=>n+r.length,0)}};
await writeFile(root+'data/arkpedia-particle-pivots.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.counts));
