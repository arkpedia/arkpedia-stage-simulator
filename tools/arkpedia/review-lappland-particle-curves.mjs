// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {sampleParticleCurve,sampleParticleGradient} from '../../shared/arkpedia/native-particle-curves.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),directory=path.join(root,'.cache/arkpedia/lappland-alter-source/effects');
const meta=JSON.parse(await readFile(path.join(root,'data/arkpedia-lappland-effects.json'))),raw=await readFile(path.join(directory,'native-effects.bin'));
const digest=createHash('sha256').update(raw).digest('hex');
if(digest!==meta.pack.sha256||raw.length!==meta.pack.bytes)throw Error('Changed original particle input pack');
const pack=JSON.parse(gunzipSync(raw)),curves=new Map(),gradients=new Map();
function walk(value,record,field){
 if(Array.isArray(value)){value.forEach((v,i)=>walk(v,record,[...field,String(i)]));}
 else if(value&&typeof value==='object'){
  if('scalar' in value&&'minMaxState' in value)curves.set(JSON.stringify(value),curves.get(JSON.stringify(value))??{record,field,value});
  if('maxGradient' in value&&'minMaxState' in value)gradients.set(JSON.stringify(value),gradients.get(JSON.stringify(value))??{record,field,value});
  for(const [k,v] of Object.entries(value))walk(v,record,[...field,k]);
 }
}
for(const [id,r] of Object.entries(pack.records))if(r.type==='ParticleSystem')walk(r.data,id,[]);
function samples(entry,type){
 const d=entry.value,times=new Set([-1,0,.125,.25,.5,.75,1,2]);
 if(type==='curve'){for(const slot of ['minCurve','maxCurve'])for(const key of d[slot].m_Curve)times.add(key.time);}
 else for(const slot of ['minGradient','maxGradient'])for(const [prefix,count] of [['c',d[slot].m_NumColorKeys],['a',d[slot].m_NumAlphaKeys]])for(let i=0;i<count;i++)times.add(d[slot][prefix+'time'+i]/65535);
 const sample=type==='curve'?sampleParticleCurve:sampleParticleGradient;
 return {record:entry.record,field:entry.field,samples:[...times].sort((a,b)=>a-b).flatMap(time=>[0,.25,.5,1].map(factor=>({time,factor,value:sample(d,time,factor)})))};
}
const report={schemaVersion:1,sourcePackSha256:digest,scope:{sourceSamplingOnly:true,compiledFrameParity:false},
 curves:[...curves.values()].map(e=>samples(e,'curve')),gradients:[...gradients.values()].map(e=>samples(e,'gradient'))};
await writeFile(path.join(directory,'native-particle-curve-samples.json'),JSON.stringify(report)+'\n');
console.log(JSON.stringify({curves:report.curves.length,gradients:report.gradients.length}));
