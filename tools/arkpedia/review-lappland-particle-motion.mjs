// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createParticleMotion} from '../../shared/arkpedia/native-particle-motion.js';
import {createParticleNoise} from '../../shared/arkpedia/native-particle-noise.js';
import {particleBirthFrame} from '../../shared/arkpedia/native-particle-render.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),directory=path.join(root,'.cache/arkpedia/lappland-alter-source/effects');
const meta=JSON.parse(await readFile(path.join(root,'data/arkpedia-lappland-effects.json'))),raw=await readFile(path.join(directory,'native-effects.bin'));
const digest=createHash('sha256').update(raw).digest('hex');
if(digest!==meta.pack.sha256||raw.length!==meta.pack.bytes)throw Error('Changed original particle input pack');
const pack=JSON.parse(gunzipSync(raw)),components=[];
const fields=[1,17].map(seed=>{
 const field=createParticleNoise(seed);
 return {seed,probes:[[0,0,0],[.21,.31,.41],[-2.73,.37,1.13],[1,.75,2.31]].map(point=>({point,perlin:[0,1,2].map(c=>field.perlin(point,c)),curl:field.curl(point)}))};
});
for(const [record,r] of Object.entries(pack.records))if(r.type==='ParticleSystem'&&r.data.NoiseModule.enabled){
 const probes=[],worldFrames=[];let blocked=null;
 try{
  for(const seed of [1,17]){
   const motion=createParticleMotion(r.data,{seed});
   for(const age of [.05,.5]){
    const particle={id:7,born:.2,lifetime:2,age},origin=[.1,.2,.3],initialVelocity=[-3,0,0];
    probes.push({seed,particle,origin,initialVelocity,flow:motion.flow(origin,.2,age/2,7),displacement:motion.sample(particle,origin,initialVelocity)});
    if(r.data.moveWithTransform===1)for(const frame of [
      {birth:[1,0,0,0,0,1,0,0,0,0,1,0,1,2,3,1],movement:[1,0,0,0,0,1,0,0,0,0,1,0,1,2,3,1]},
      {birth:[0,2,0,0,-3,0,0,0,0,0,4,0,1,2,3,1],movement:[1,0,0,0,0,1,0,0,0,0,1,0,1,2,3,1]}
    ]){
      const born=particleBirthFrame(origin,initialVelocity,frame.birth,frame.movement);
      const displacement=motion.sample(particle,born.origin,born.velocity);
      worldFrames.push({seed,particle,origin,initialVelocity,frame,worldOrigin:born.origin,worldVelocity:born.velocity,displacement,position:born.origin.map((v,i)=>v+displacement[i])});
    }
   }
  }
 }catch(error){blocked=error.message;}
 components.push({record,simulationSpace:r.data.moveWithTransform===1?'world':'local',blocked,probes,worldFrames});
}
const report={schemaVersion:1,sourcePackSha256:digest,scope:{localReplay:true,compiledFrameParity:false,enabledOperators:[]},fields,components};
await writeFile(path.join(directory,'native-particle-motion-samples.json'),JSON.stringify(report)+'\n');
console.log(JSON.stringify({components:components.length,localReplay:components.filter(c=>!c.blocked).length,blocked:components.filter(c=>c.blocked).length}));
