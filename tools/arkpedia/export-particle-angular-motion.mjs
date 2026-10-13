// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {createParticleAngularMotion} from '../../shared/arkpedia/native-particle-angular-motion.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const rows={},sources={};
for(const [name,count]of [['tragodia',15],['lappland-alter',42]]){
 const bytes=await readFile(root+`.cache/arkpedia/${name}-source/effects/native-effects.bin`);
 const meta=JSON.parse(await readFile(root+`data/arkpedia-${name==='lappland-alter'?'lappland':name}-effects.json`));
 if(sha(bytes)!==meta.pack.sha256)throw Error('Changed original effect pack');
 const pack=JSON.parse(gunzipSync(bytes));sources[name]={operator:pack.operator,version:pack.version,sourcePackSha256:sha(bytes)};
 let found=0;
 for(const[key,r]of Object.entries(pack.records))if(r.type==='ParticleSystem'&&r.data.RotationModule.enabled){
  const go=r.references.find(r=>r.field==='m_GameObject').target;
  rows[key]={source:name,name:pack.records[go].data.m_Name,particleSha256:r.serializedSha256,module:r.data.RotationModule};found++;
 }
 if(found!==count)throw Error('Changed original angular-motion inventory');
}
const fixture='test/fixtures/arkpedia-particle-angular-motion.json',bytes=Buffer.from(JSON.stringify(rows)+'\n');
await writeFile(root+fixture,bytes);
const samples={};for(const[key,r]of Object.entries(rows)){
 const motion=createParticleAngularMotion(r.module);
 samples[key]=[1,2].flatMap(lifetime=>[0,.125,.5,1].flatMap(phase=>[0,.25,1].map(factor=>({lifetime,phase,factor,
  ...motion.sample({age:phase*lifetime,lifetime,rotation:0},[factor,factor,factor])}))));
}
await writeFile(root+'.cache/arkpedia/tragodia-source/angular-motion-samples.json',JSON.stringify(samples)+'\n');
const manifest={schemaVersion:1,sources,scope:{sourceMapping:true,localReplay:true,units:'radiansPerSimulatedSecond',compiledFrameParity:false,enabledOperators:[]},
 fixture:{path:fixture,bytes:bytes.length,sha256:sha(bytes)},particles:Object.fromEntries(Object.entries(rows).map(([key,r])=>[key,
 {source:r.source,name:r.name,particleSha256:r.particleSha256}]))};
await writeFile(root+'data/arkpedia-particle-angular-motion.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({particles:Object.keys(rows).length,samples:Object.values(samples).reduce((n,s)=>n+s.length,0),bytes:bytes.length}));
