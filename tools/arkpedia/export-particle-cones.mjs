// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createParticleCone} from '../../shared/arkpedia/native-particle-cone.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const rows={},sources={};
for(const [name,count] of [['tragodia',12],['lappland-alter',47]]){
 const bytes=await readFile(root+`.cache/arkpedia/${name}-source/effects/native-effects.bin`);
 const meta=JSON.parse(await readFile(root+`data/arkpedia-${name==='lappland-alter'?'lappland':name}-effects.json`));
 if(sha(bytes)!==meta.pack.sha256)throw Error('Changed original effect pack');
 const pack=JSON.parse(gunzipSync(bytes));sources[name]={operator:pack.operator,version:pack.version,sourcePackSha256:sha(bytes)};
 let found=0;
 for(const [key,p] of Object.entries(pack.records))if(p.type==='ParticleSystem'&&p.data.ShapeModule.enabled&&p.data.ShapeModule.type===4&&p.data.ShapeModule.angle!==0){
  const go=p.references.find(r=>r.field==='m_GameObject').target;
  rows[key]={source:name,name:pack.records[go].data.m_Name,particleSha256:p.serializedSha256,shape:p.data.ShapeModule};found++;
 }
 if(found!==count)throw Error('Changed original angled-cone inventory');
}
const fixture='test/fixtures/arkpedia-particle-cones.json',bytes=Buffer.from(JSON.stringify(rows)+'\n');
await writeFile(root+fixture,bytes);
const held={},samples={};
for(const [key,row] of Object.entries(rows)){
 let cone;try{cone=createParticleCone(row.shape);}catch(error){held[key]=error.message;continue;}
 samples[key]=[0,.25,1].flatMap(radial=>[0,.25,.75,1].map(azimuth=>({radial,azimuth,...cone.sample(radial,azimuth)})));
}
if(Object.keys(samples).length!==51||Object.keys(held).length!==8)throw Error('Changed original cone replay boundary');
await writeFile(root+'.cache/arkpedia/tragodia-source/cone-samples.json',JSON.stringify(samples)+'\n');
const manifest={schemaVersion:1,sources,scope:{sourceMapping:true,shapeModel:'geometricConeBase',nativeEmissionParity:false,compiledFrameParity:false,enabledOperators:[]},
 fixture:{path:fixture,bytes:bytes.length,sha256:sha(bytes)},held,
 particles:Object.fromEntries(Object.entries(rows).map(([key,r])=>[key,{source:r.source,name:r.name,particleSha256:r.particleSha256}]))};
await writeFile(root+'data/arkpedia-particle-cones.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({particles:Object.keys(rows).length,played:Object.keys(samples).length,held:Object.keys(held).length,bytes:bytes.length}));
