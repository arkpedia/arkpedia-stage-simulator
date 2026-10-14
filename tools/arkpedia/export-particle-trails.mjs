// SPDX-License-Identifier: GPL-3.0-or-later
import{readFile,writeFile}from'node:fs/promises';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import{createParticleTrails}from'../../shared/arkpedia/native-particle-trails.js';import{particleForceImpulse}from'../../shared/arkpedia/native-particle-force.js';import{createParticleBirthClock}from'../../shared/arkpedia/native-particle-birth-clock.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const rows={},sources={},samples={};let trails=0,forces=0;
for(const name of['tragodia','lappland-alter']){
 const bytes=await readFile(root+`.cache/arkpedia/${name}-source/effects/native-effects.bin`),meta=JSON.parse(await readFile(root+`data/arkpedia-${name==='lappland-alter'?'lappland':name}-effects.json`));
 if(sha(bytes)!==meta.pack.sha256)throw Error('Changed original trail/force effect pack');const pack=JSON.parse(gunzipSync(bytes));sources[name]={operator:pack.operator,version:pack.version,sourcePackSha256:sha(bytes)};
 for(const[id,r]of Object.entries(pack.records))if(r.type==='ParticleSystem'&&(r.data.TrailModule.enabled||r.data.ForceModule.enabled)){
  const s=r.data,go=r.references.find(r=>r.field==='m_GameObject').target;
  rows[id]={source:name,name:pack.records[go].data.m_Name,data:s,serializedSha256:r.serializedSha256};const result=samples[id]={};
  if(s.TrailModule.enabled){
   trails++;const trail=createParticleTrails(s),clock=createParticleBirthClock(s);
   result.trails=[.1,.5,2].map(time=>({time,births:clock.births(time).slice(-3),data:trail.sample(time,clock.births(time).slice(-3),{
    stateAt(t,b){const age=(t-b.birthTime)*s.simulationSpeed;return{position:[age*5,b.id*.01,0],size:[.75,.75,.75],color:[1,.5,.25,.8]};},project:p=>p.position,camera:[0,0,10]
   })}));
  }
  if(s.ForceModule.enabled){forces++;result.forces=[.1,.5,1].map(age=>({particle:{id:3,lifetime:2},from:0,to:age,impulse:particleForceImpulse(s.ForceModule,{id:3,lifetime:2},0,age)}));}
 }
}
const fixture='test/fixtures/arkpedia-particle-trails.json',raw=Buffer.from(JSON.stringify(rows)+'\n');await writeFile(root+fixture,raw);
const output='.cache/arkpedia/lappland-alter-source/particle-trail-samples.json',data=Buffer.from(JSON.stringify(samples)+'\n');await writeFile(root+output,data);
const manifest={schemaVersion:1,sources,scope:{localParticleTrails:true,localForceBeforeDamping:true,syntheticAuditMotion:true,nativeRngVerified:false,compiledFrameParity:false,enabledOperators:[]},
 fixture:{path:fixture,bytes:raw.length,sha256:sha(raw)},samples:{path:output,bytes:data.length,sha256:sha(data)},counts:{sourceParticles:Object.keys(rows).length,trails,forces,forceImpulses:forces*3,trailSamples:trails*3}};
await writeFile(root+'data/arkpedia-particle-trails.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.counts));
