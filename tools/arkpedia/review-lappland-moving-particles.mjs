// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createMovingParticles} from '../../shared/arkpedia/native-moving-particles.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),directory=path.join(root,'.cache/arkpedia/lappland-alter-source/effects');
const meta=JSON.parse(await readFile(path.join(root,'data/arkpedia-lappland-effects.json'))),raw=await readFile(path.join(directory,'native-effects.bin'));
const digest=createHash('sha256').update(raw).digest('hex');
if(digest!==meta.pack.sha256||raw.length!==meta.pack.bytes)throw Error('Changed original particle input pack');
const pack=JSON.parse(gunzipSync(raw)),emitters=[];
for(const [record,r] of Object.entries(pack.records))if(r.type==='ParticleSystem'&&r.data.ShapeModule?.enabled&&r.data.ShapeModule.type===5){
  const samples=[1,17].flatMap(seed=>{
    const emitter=createMovingParticles(r.data,{seed});
    return [-1,0,.1,.25,.5,1,2,5,10].map(time=>({seed,time,particles:emitter.sample(time)}));
  });
  emitters.push({record,samples});
}
const report={schemaVersion:1,sourcePackSha256:digest,scope:{boxSourceSamplingOnly:true,rendererVerified:false,compiledFrameParity:false,enabledOperators:[]},emitters};
await writeFile(path.join(directory,'native-moving-particle-samples.json'),JSON.stringify(report)+'\n');
console.log(JSON.stringify({emitters:emitters.length,snapshots:emitters.reduce((n,e)=>n+e.samples.length,0)}));
