// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createParticleCustomData,createParticleVertexLayout} from '../../shared/arkpedia/native-particle-custom-data.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const bytes=await readFile(root+'.cache/arkpedia/tragodia-source/effects/native-effects.bin');
const pack=JSON.parse(gunzipSync(bytes)),source=JSON.parse(await readFile(root+'data/arkpedia-tragodia-effects.json'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(sha(bytes)!==source.pack.sha256)throw Error('Changed original effect pack');
const refs=(key,field)=>pack.records[key].references.filter(r=>r.field===field).map(r=>r.target);
const rows={};
function walk(go){
 const components=refs(go,'component');
 for(const key of components){
  const r=pack.records[key];if(r.type!=='ParticleSystemRenderer'||!r.data.m_UseCustomVertexStreams||!r.data.m_Enabled)continue;
  const particle=components.find(k=>pack.records[k].type==='ParticleSystem'),p=pack.records[particle];
  const keys=['lengthInSec','simulationSpeed','startDelay','moveWithTransform','ringBufferMode','prewarm','looping','playOnAwake',
   'InitialModule','EmissionModule','ColorModule','SizeModule','CustomDataModule'];
  rows[key]={name:pack.records[go].data.m_Name,rendererSha256:r.serializedSha256,particle,particleSha256:p.serializedSha256,
   streams:r.data.m_VertexStreams,source:Object.fromEntries(keys.map(k=>[k,p.data[k]]))};
 }
 const transform=components.find(k=>pack.records[k].type==='Transform');
 for(const child of refs(transform,'m_Children'))walk(refs(child,'m_GameObject')[0]);
}
walk(pack.roots.phatm2_skill_03_prison_01);
if(Object.keys(rows).length!==8)throw Error('Changed original cage custom stream inventory');
const fixtureBytes=Buffer.from(JSON.stringify(rows)+'\n'),fixture='test/fixtures/arkpedia-tragodia-custom-streams.json';
await writeFile(root+fixture,fixtureBytes);
const samples=Object.fromEntries(Object.entries(rows).map(([key,row])=>{
 const data=createParticleCustomData(row.source.CustomDataModule),layout=createParticleVertexLayout(row.streams);
 return [key,[0,.125,.25,.5,.75,1,1.25].map(age=>{
  const custom=data.sample(age,1,()=>.25);
  return {age,custom,packed:layout.sample([.2,.8],custom)};
 })];
}));
await writeFile(root+'.cache/arkpedia/tragodia-source/custom-stream-samples.json',JSON.stringify(samples)+'\n');
const metadata={schemaVersion:1,operator:pack.operator,version:pack.version,sourcePackSha256:sha(bytes),
 scope:{sourceMapping:true,compiledFrameParity:false,enabledOperators:[]},
 fixture:{path:fixture,bytes:fixtureBytes.length,sha256:sha(fixtureBytes)},
 renderers:Object.fromEntries(Object.entries(rows).map(([key,row])=>[key,{name:row.name,rendererSha256:row.rendererSha256,
  particle:row.particle,particleSha256:row.particleSha256,streams:row.streams}]))};
await writeFile(root+'data/arkpedia-tragodia-custom-streams.json',JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify({renderers:8,bytes:fixtureBytes.length}));
