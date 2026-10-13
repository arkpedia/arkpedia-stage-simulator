// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Euler,Matrix4,Vector3} from 'three';
import {createParticleStartRotation} from '../../shared/arkpedia/native-particle-start-rotation.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const rows={},sources={};
for(const [name,file,count] of [['tragodia','phatm2',4],['lappland-alter','whitw2',7]]){
 const bytes=await readFile(root+`.cache/arkpedia/${name}-source/effects/native-effects.bin`);
 const meta=JSON.parse(await readFile(root+`data/arkpedia-${name==='lappland-alter'?'lappland':name}-effects.json`));
 if(sha(bytes)!==meta.pack.sha256)throw Error('Changed original effect pack');
 const pack=JSON.parse(gunzipSync(bytes));sources[name]={operator:pack.operator,version:pack.version,sourcePackSha256:sha(bytes)};
 let found=0;
 for(const [key,p] of Object.entries(pack.records))if(p.type==='ParticleSystem'&&p.data.InitialModule.rotation3D){
  const go=p.references.find(r=>r.field==='m_GameObject').target;
  rows[key]={source:name,name:pack.records[go].data.m_Name,particleSha256:p.serializedSha256,initial:p.data.InitialModule};found++;
 }
 if(found!==count)throw Error('Changed original 3D start rotation inventory');
}
const fixture='test/fixtures/arkpedia-particle-start-rotation.json',bytes=Buffer.from(JSON.stringify(rows)+'\n');
await writeFile(root+fixture,bytes);
const samples=Object.fromEntries(Object.entries(rows).map(([key,row])=>{
 const rotation=createParticleStartRotation(row.initial);
 return [key,[0,.25,1].flatMap(phase=>[[0,0,0],[.25,.75,.5],[1,1,1]].map(factors=>{
  const value=rotation.sample(phase,factors),matrix=new Matrix4().makeRotationFromEuler(new Euler(...value.rotation3D,'YXZ'));
  return {phase,factors,...value,basis:[[1,0,0],[0,1,0],[0,0,1]].map(v=>new Vector3(...v).applyMatrix4(matrix).toArray())};
 }))];
}));
await writeFile(root+'.cache/arkpedia/tragodia-source/start-rotation-samples.json',JSON.stringify(samples)+'\n');
const manifest={schemaVersion:1,sources,scope:{sourceMapping:true,compiledFrameParity:false,enabledOperators:[]},
 fixture:{path:fixture,bytes:bytes.length,sha256:sha(bytes)},particles:Object.fromEntries(Object.entries(rows).map(([key,r])=>[key,{source:r.source,name:r.name,particleSha256:r.particleSha256}]))};
await writeFile(root+'data/arkpedia-particle-start-rotation.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({particles:Object.keys(rows).length,bytes:bytes.length}));
