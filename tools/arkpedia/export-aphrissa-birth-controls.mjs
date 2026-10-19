// SPDX-License-Identifier: GPL-3.0-or-later
// Original RandomColor/Fixed palettes and ordinary three-axis billboard births.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {Euler,Matrix4,Vector3} from 'three';
import {createEffectPose} from '../../shared/arkpedia/native-effect-pose.js';
import {sampleParticleGradient} from '../../shared/arkpedia/native-particle-curves.js';
import {createParticleStartRotation} from '../../shared/arkpedia/native-particle-start-rotation.js';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex'),
  source=JSON.parse(await readFile(new URL('data/arkpedia-aphrissa-effects.json',root))),
  raw=await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-effects.bin',root));
assert.equal(sha(raw),source.pack.sha256);const pack=JSON.parse(gunzipSync(raw)),owners=new Map(),rows={},samples=[];
const animations=JSON.parse(await readFile(new URL('.cache/arkpedia/aphrissa-source/effects/native-animations.json',root)));
assert.equal(animations.sourcePackSha256,source.pack.sha256);
for(const name of Object.keys(pack.roots))for(const n of createEffectPose(pack,animations,name).nodes.values())
  for(const ref of pack.records[n.gameObject].references??[])if(pack.records[ref.target]?.type==='ParticleSystem'){
    assert.ok(!owners.has(ref.target));owners.set(ref.target,name);
  }
for(const [id,r] of Object.entries(pack.records)){
  if(r.type!=='ParticleSystem')continue;const s=r.data,go=r.references.find(ref=>ref.field==='m_GameObject').target,
    renderer=pack.records[go].references.find(ref=>pack.records[ref.target]?.type==='ParticleSystemRenderer')?.target;
  if(!renderer||!pack.records[renderer].data.m_Enabled)continue;
  const color=s.InitialModule.startColor.minMaxState===4,
    rotation=s.InitialModule.rotation3D&&pack.records[renderer].data.m_RenderMode===0;
  if(!color&&!rotation)continue;assert.ok(!(color&&rotation));assert.ok(owners.has(id));
  rows[id]={root:owners.get(id),kind:color?'randomFixedColor':'billboard3D',name:pack.records[go].data.m_Name,
    serializedSha256:r.serializedSha256,data:s,gameObjectActive:pack.records[go].data.m_IsActive,
    gameObjectSha256:pack.records[go].serializedSha256,renderer,rendererSha256:pack.records[renderer].serializedSha256,
    rendererData:pack.records[renderer].data};
  if(color){
    const g=s.InitialModule.startColor.maxGradient,factors=new Set([0,.25,.5,.75,1]);
    for(const [prefix,count] of [['c',g.m_NumColorKeys],['a',g.m_NumAlphaKeys]])for(let i=0;i<count;i++)
      for(const delta of [-1e-10,0,1e-10])factors.add(Math.max(0,Math.min(1,g[prefix+'time'+i]/65535+delta)));
    for(const time of [0,.5,1])for(const factor of [...factors].sort((a,b)=>a-b))
      samples.push({record:id,time,factor,color:sampleParticleGradient(s.InitialModule.startColor,time,factor)});
  }else{
    const sampler=createParticleStartRotation(s.InitialModule);
    for(const phase of [0,.25,1])for(const factors of [[0,0,0],[.25,.75,.5],[1,1,1]]){
      const value=sampler.sample(phase,factors),m=new Matrix4().makeRotationFromEuler(new Euler(...value.rotation3D,'YXZ'));
      samples.push({record:id,phase,factors,...value,basis:[[1,0,0],[0,1,0],[0,0,1]].map(v=>new Vector3(...v).applyMatrix4(m).toArray())});
    }
  }
}
assert.equal(Object.keys(rows).length,8);
const fixturePath='test/fixtures/arkpedia-aphrissa-birth-controls.json',fixture=Buffer.from(JSON.stringify(rows)+'\n'),
  samplePath='.cache/arkpedia/aphrissa-source/effects/birth-control-samples.json',sampleBytes=Buffer.from(JSON.stringify(samples)+'\n');
await writeFile(new URL(fixturePath,root),fixture);await writeFile(new URL(samplePath,root),sampleBytes);
const reference={repository:'Unity-Technologies/UnityCsReference',commit:'b052b1fe38b45d5aefa609a115c626ed2e74f3a6',files:[
  {path:'Modules/ParticleSystem/Managed/ParticleSystemEnums.cs',bytes:14635,sha256:'cc34dc3bfc5e8abcf7f2654ac37bbdec2709728bcd604918cf55919b980cdb93'},
  {path:'Runtime/Export/Math/Gradient.bindings.cs',bytes:4453,sha256:'55e3b0c9cf2f4553e9431be11f2668240bb0c3e6d1bb8047afed2172efee5c35'}],documents:[
  {url:'https://docs.unity3d.com/2021.3/Documentation/ScriptReference/GradientMode.html',bytes:15314,sha256:'badabec9579bcf404617538e5887bf30c67785ae9ca8e652e257fee0e3d025b4'},
  {url:'https://docs.unity3d.com/2021.3/Documentation/Manual/PartSysRendererModule.html',bytes:43111,sha256:'3ad64ef6a821ac523a83e415021d9417f33c7733e0d7a4e43752891ef6ca4e2a'}]};
const result={schemaVersion:1,operator:pack.operator,version:pack.version,sourcePackSha256:source.pack.sha256,reference,
  scope:{originalProfiles:true,fixedFirstStrictlyLaterKey:true,stableRandomBirthColor:true,ordinaryBillboard3D:true,
    stretchedBillboard3D:false,nativeRngParity:false,compiledFrameParity:false,enabledOperators:[]},
  fixture:{path:fixturePath,bytes:fixture.length,sha256:sha(fixture)},samples:{path:samplePath,bytes:sampleBytes.length,sha256:sha(sampleBytes)},
  effectRoots:Object.keys(pack.roots).sort(),
  counts:{profiles:8,randomFixedColors:4,billboards3D:4,roots:3,sourceInactive:4,probes:samples.length}};
await writeFile(new URL('data/arkpedia-aphrissa-birth-controls.json',root),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.counts));
