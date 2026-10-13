// SPDX-License-Identifier: GPL-3.0-or-later
import{readFile,writeFile}from'node:fs/promises';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import{createTextureRotations}from'../../shared/arkpedia/native-texture-rotation.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const rows={},sources={},samples={};
const declarations=Array.from({length:4},(_,i)=>({name:'_Rotation'+i,type:'vec4',count:null}));
for(const name of['tragodia','lappland-alter']){
 const bytes=await readFile(root+`.cache/arkpedia/${name}-source/effects/native-effects.bin`),meta=JSON.parse(await readFile(root+`data/arkpedia-${name==='lappland-alter'?'lappland':name}-effects.json`));
 if(sha(bytes)!==meta.pack.sha256)throw Error('Changed original texture rotation effect pack');
 const pack=JSON.parse(gunzipSync(bytes));sources[name]={operator:pack.operator,version:pack.version,sourcePackSha256:sha(bytes)};
 for(const[id,r]of Object.entries(pack.records))if(r.type==='MonoBehaviour'&&Object.hasOwn(r.data,'_rotateTex1')){
  const go=r.references.find(r=>r.field==='m_GameObject').target;
  const renderers=pack.records[go].references.filter(r=>r.field==='component').map(r=>r.target).filter(k=>pack.records[k].type.endsWith('Renderer'));
  if(renderers.length!==1)throw Error('Ambiguous source rotation renderer');
  const component=renderers[0],renderer=pack.records[component];
  const row=rows[id]={source:name,name:pack.records[go].data.m_Name,data:r.data,references:r.references,serializedSha256:r.serializedSha256,
   binding:pack.scriptBindings[id],component,renderer:{data:renderer.data,references:renderer.references,serializedSha256:renderer.serializedSha256},gameObject:go};
  const rotation=createTextureRotations(pack,component,declarations,{instances:[]});
  const uvs=[[0,0],[1,0],[0,1],[1,1],[.25,.75]];
  samples[id]=Object.fromEntries(Object.entries(rotation.values).map(([name,vector])=>[name,{vector,uvs:uvs.map(uv=>({uv,rotated:[(uv[0]-.5)*vector[0]+(uv[1]-.5)*vector[2]+.5,(uv[0]-.5)*vector[1]+(uv[1]-.5)*vector[3]+.5]}))}]));
 }
}
const fixture='test/fixtures/arkpedia-texture-rotations.json',raw=Buffer.from(JSON.stringify(rows)+'\n');await writeFile(root+fixture,raw);
const output='.cache/arkpedia/lappland-alter-source/texture-rotation-samples.json',data=Buffer.from(JSON.stringify(samples)+'\n');await writeFile(root+output,data);
const manifest={schemaVersion:1,sources,scope:{sourceAngles:true,localCounterclockwiseBasis:true,nativeSignOrderVerified:false,scriptLifecycleVerified:false,compiledFrameParity:false,enabledOperators:[]},
 fixture:{path:fixture,bytes:raw.length,sha256:sha(raw)},samples:{path:output,bytes:data.length,sha256:sha(data)},
 counts:{scripts:Object.keys(rows).length,renderers:Object.keys(rows).length,vectors:Object.keys(rows).length*4,uvSamples:Object.keys(rows).length*4*5}};
await writeFile(root+'data/arkpedia-texture-rotations.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.counts));
