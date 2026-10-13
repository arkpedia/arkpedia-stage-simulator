// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {createNativeEffectLibrary,compileNativeEffectPrograms} from '../public/arkpedia/native-effect-player.js';
import {createEffectTrajectory} from '../shared/arkpedia/native-effect-trail.js';
import effects from '../data/arkpedia-lappland-effects.json' with {type:'json'};
import anim from '../data/arkpedia-lappland-effect-animations.json' with {type:'json'};
import shader from '../data/arkpedia-lappland-effect-shaders.json' with {type:'json'};
import builtinMeshes from '../data/arkpedia-unity-builtin-meshes.json' with {type:'json'};
const ROOT='whitw2_skill_03_token_trail_01',cache='.cache/arkpedia/lappland-alter-source/effects/';
let original=null;
try{
  const files=await Promise.all([effects.pack,anim.artifact,shader.artifact].map(async entry=>{
    const bytes=await readFile(cache+entry.path);assert.equal(bytes.length,entry.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);return bytes;
  }));
  original={pack:JSON.parse(gunzipSync(files[0])),animations:JSON.parse(files[1]),shaders:JSON.parse(files[2])};
}catch(error){if(error.code!=='ENOENT')throw error;}
const native={skip:original===null?'Original effect cache unavailable':false};
const empty={pack:{roots:{empty:'root'},records:{root:{data:{m_Name:'root',m_IsActive:true},references:[{field:'component',target:'tr'}]},
  tr:{type:'Transform',data:{m_LocalPosition:{x:0,y:0,z:0},m_LocalRotation:{x:0,y:0,z:0,w:1},m_LocalScale:{x:1,y:1,z:1}},references:[]}}},animations:{instances:[],clips:{}},shaders:{shaders:{}}};
const library=(source=empty,loadTexture=async()=>new T.Texture(),builtinMeshes=null)=>createNativeEffectLibrary({three:T,...source,loadTexture,builtinMeshes});
const camera=()=>{const c=new T.PerspectiveCamera(35,1,.001,100);c.position.set(.4,.8,3);c.lookAt(0,0,0);c.updateProjectionMatrix();c.updateMatrixWorld(true);return c;};
const trajectory=(x=0)=>createEffectTrajectory([{time:0,position:[x,0,0]},{time:1,position:[x+1,0,.5]},{time:2,position:[x+1,0,1]}]);
const state=i=>i.draws.map(d=>({component:d.component,particles:d.lastParticles??null,trail:d.trailData??null,
  colors:d.emitter&&!d.lastParticles?.length?null:[...d.mesh.geometry.getAttribute('in_COLOR0').array],
  uv:d.emitter&&!d.lastParticles?.length?null:[...d.mesh.geometry.getAttribute('in_TEXCOORD0').array]}));
const disposedEvents=(i)=>{
  const counts={geometry:0,material:0};
  const gs=new Set(i.draws.flatMap(d=>(d.pool??[d.mesh]).map(p=>p.geometry))),ms=new Set(i.draws.map(d=>d.mesh.material));
  for(const g of gs)g.addEventListener('dispose',()=>counts.geometry++);
  for(const m of ms)m.addEventListener('dispose',()=>counts.material++);
  return {counts,geometries:gs.size,materials:ms.size};
};
test('player accepts a caller camera/clock without creating a renderer or changing scene ownership',async()=>{
  const lib=library(),i=await lib.create('empty'),scene=new T.Scene();scene.add(i.group);
  i.update(0,{camera:camera()});assert.equal(lib.instanceCount,1);assert.equal(i.group.parent,scene);
  assert.throws(()=>i.update(0,{camera:camera(),scheduledParticles:{records:[],frames:{}}}),/isolated inspection/);
  assert.throws(()=>i.update(NaN,{camera:camera()}),/clock/);assert.throws(()=>i.update(-1,{camera:camera()}),/clock/);
  assert.throws(()=>i.update(1),/camera/);assert.throws(()=>i.update(1,{camera:camera(),clip:'foreign'}),/outside/);
  scene.position.x=1;assert.throws(()=>i.update(0,{camera:camera()}),/original coordinate/);scene.position.x=0;
  i.group.position.x=NaN;assert.throws(()=>i.update(0,{camera:camera()}),/original coordinate/);i.group.position.x=0;
  i.dispose();assert.equal(i.group.parent,null);assert.equal(lib.instanceCount,0);assert.equal(i.disposed,true);
  assert.throws(()=>i.update(1,{camera:camera()}),/disposed/);i.dispose();lib.dispose();
});
test('closed libraries and invalid roots do not register orphan instances',async()=>{
  const lib=library();await assert.rejects(lib.create('unknown'),/Unknown original/);assert.equal(lib.instanceCount,0);
  const a=await lib.create('empty'),b=await lib.create('empty');lib.dispose();assert.equal(lib.instanceCount,0);
  assert.equal(a.disposed,true);assert.equal(b.disposed,true);assert.throws(()=>lib.create('empty'),/disposed/);lib.dispose();
});
test('six original hit roots dispatch child records from supported parent physics without isolated overrides',native,async()=>{
 const lib=library(original),cam=camera();
 try{for(let root=1;root<=6;root++){
  const i=await lib.create('whitw2_token_hit_0'+root,{allowBlocked:true});
  assert.equal(i.inspection,null);assert.equal(Object.values(i.parentMotion.statuses()).filter(r=>r.sampled).length,1);
  i.update(.1,{camera:cam});i.group.updateMatrixWorld(true);
  const selected=i.draws.filter(d=>d.lastParticles?.some(p=>p.parent));assert.ok(selected.length>=4);
  for(const d of selected)assert.deepEqual(d.lastParticles.map(p=>p.id),i.parentMotion.records(d.particleId,.1).map(p=>p.id));
  const snapshot=()=>JSON.stringify(selected.map(d=>({particles:d.lastParticles,matrices:d.pool.filter(p=>p.visible).map(p=>Array.from(p.matrixWorld.elements))})));
  const before=snapshot();i.update(.8,{camera:cam});i.update(.1,{camera:cam});i.group.updateMatrixWorld(true);assert.equal(snapshot(),before);
  assert.ok(i.blocked.length>0);i.dispose();
 }}finally{lib.dispose();}
 assert.equal(lib.instanceCount,0);
});
test('recovered original built-in mesh binds exact positions, normals, UVs and winding without changing source pointers',native,async()=>{
 const lib=library(original,async()=>new T.Texture(),builtinMeshes),cam=camera();
 const before=structuredClone(original.pack.unresolvedReferences);
 try{
  const i=await lib.create('whitw2_token_hit_05',{allowBlocked:true});i.update(.1,{camera:cam});i.group.updateMatrixWorld(true);
  assert.equal(i.draws.length,23);assert.equal(i.blocked.length,4);assert.ok(i.blocked.every(b=>!/mesh/.test(b.reason)));
  const parent=i.draws.find(d=>d.particleId&&d.particleSource.SubModule.enabled);assert.ok(parent);assert.equal(parent.lastParticles.length,1);
  const mesh=builtinMeshes.meshes['10210'].data,g=parent.mesh.geometry;
  assert.deepEqual([...g.index.array],mesh.submeshTriangles.flat(2));
  assert.deepEqual([...g.getAttribute('in_POSITION0').array],[...new Float32Array(mesh.positions.flat())]);
  assert.deepEqual([...g.getAttribute('in_NORMAL0').array],[...new Float32Array(mesh.normals.flat())]);
  assert.deepEqual([...g.getAttribute('in_TEXCOORD0').array],[...new Float32Array(mesh.uvChannels[0].flat())]);
  assert.deepEqual(original.pack.unresolvedReferences,before);i.dispose();
 }finally{lib.dispose();}
});
test('source pivots shift only rendered matrices and leave particle anchors, clocks and original meshes intact',native,async()=>{
 const lib=library(original,async()=>new T.Texture(),builtinMeshes),cam=camera();
 try{
  const i=await lib.create('whitw2_skill_03_buff_01',{allowBlocked:true});i.update(1.8,{camera:cam});i.group.updateMatrixWorld(true);
  const selected=i.draws.filter(d=>d.pivot?.pivot.some(v=>v!==0));assert.equal(selected.length,8);
  assert.ok([...new T.Box3().setFromObject(i.group).min.toArray(),...new T.Box3().setFromObject(i.group).max.toArray()].every(Number.isFinite));
  const collapsed=selected.filter(d=>d.mesh.parent.matrixWorld.determinant()===0);assert.equal(collapsed.length,3);
  for(const d of collapsed){assert.equal(d.mesh.visible,false);assert.equal(d.mesh.matrixWorld.elements[15],1);assert.ok(d.mesh.matrixWorld.elements.every(Number.isFinite));}
  const state=()=>JSON.stringify(selected.map(d=>({particles:d.lastParticles,matrices:d.pool.filter(p=>p.visible).map(p=>Array.from(p.matrixWorld.elements))})));
  for(const d of selected)for(const[index,part]of d.pool.entries())if(part.visible){
   const anchor=new T.Vector3(...d.pivot.pivot).applyMatrix4(part.matrixWorld),p=d.lastParticles[index];
   assert.ok(anchor.toArray().every(Number.isFinite));assert.equal(p.pivot,undefined);
   assert.ok(d.mesh.geometry.getAttribute('in_POSITION0').array.every(Number.isFinite));
  }
  const before=state();i.update(.3,{camera:cam});i.update(1.8,{camera:cam});i.group.updateMatrixWorld(true);assert.equal(state(),before);
  assert.equal(i.blocked.length,7);i.dispose();
 }finally{lib.dispose();}
});
test('explicit original particle inspection preserves parent links without altering the source root registry',native,async()=>{
 const id='battle/prefabs/effects/whitw2.ab:-1572538059954014246',lib=library(original),before=structuredClone(original.pack.records[id]);
 try{
  assert.throws(()=>lib.inspectParticle('missing'),/Unknown original particle/);
  const i=await lib.inspectParticle(id);
  assert.deepEqual(i.inspection,{particle:id,parents:['battle/prefabs/effects/whitw2.ab:-4329880431612217382'],fullEffect:false});
  assert.equal(Object.hasOwn(original.pack.roots,i.name),false);assert.deepEqual(original.pack.records[id],before);
  // This original renderer is disabled. Inspection preserves it rather than
  // inventing a visible mesh or pretending that the full parent effect plays.
  assert.equal(i.draws.length,0);assert.deepEqual(i.blocked,[]);assert.equal(lib.instanceCount,1);
  i.update(.2,{camera:camera()});i.dispose();assert.equal(lib.instanceCount,0);
 }finally{lib.dispose();}
});
test('original S3 instances use distinct clocks, materials, geometry and histories with shared textures',native,async()=>{
  let loads=0;const lib=library(original,async()=>{loads++;await Promise.resolve();return new T.Texture();});
  try{
    const [a,b]=await Promise.all([lib.create(ROOT),lib.create(ROOT)]),c=camera();
    assert.equal(a.draws.length,19);assert.equal(b.draws.length,19);assert.deepEqual(a.blocked,[]);assert.equal(lib.instanceCount,2);
    a.update(.5,{camera:c,trajectory:trajectory()});a.group.updateMatrixWorld(true);const before=state(a);
    b.update(1.1,{camera:c,trajectory:trajectory(4)});b.group.updateMatrixWorld(true);
    assert.deepEqual(state(a),before);assert.notDeepEqual(state(b),before);
    for(let n=0;n<a.draws.length;n++){
      assert.notEqual(a.draws[n].mesh.material,b.draws[n].mesh.material);assert.notEqual(a.draws[n].mesh.geometry,b.draws[n].mesh.geometry);
      const uniforms=a.draws[n].mesh.material.uniforms;
      for(const [name,u] of Object.entries(uniforms))if(u.value?.isTexture)assert.equal(u.value,b.draws[n].mesh.material.uniforms[name].value);
    }
    const used=new Set(a.draws.flatMap(d=>Object.values(d.mesh.material.uniforms).map(u=>u.value).filter(v=>v?.isTexture&&!(v instanceof T.DataTexture))));
    assert.equal(loads,used.size);
    for(const d of a.draws.filter(d=>d.emitter?.worldMotion))d.lastParticles.forEach((p,n)=>p.worldPosition.forEach((v,k)=>assert.ok(Math.abs(v-d.pool[n].matrixWorld.elements[k+12])<1e-8)));
    a.update(2,{camera:c,trajectory:trajectory()});a.update(.5,{camera:c,trajectory:trajectory()});assert.deepEqual(state(a),before);
  }finally{lib.dispose();}
});
test('retiring one live original root releases its particle clones without invalidating another',native,async()=>{
  const lib=library(original),a=await lib.create(ROOT),b=await lib.create(ROOT),c=camera();
  try{
    a.update(2,{camera:c,trajectory:trajectory()});b.update(.5,{camera:c,trajectory:trajectory(3)});const before=state(b),events=disposedEvents(a),scene=new T.Scene();scene.add(a.group,b.group);
    a.dispose();a.dispose();assert.deepEqual(events.counts,{geometry:events.geometries,material:events.materials});
    assert.equal(lib.instanceCount,1);assert.equal(a.group.children.length,0);assert.equal(b.group.parent,scene);
    b.update(.5,{camera:c,trajectory:trajectory(3)});assert.deepEqual(state(b),before);
  }finally{lib.dispose();}
});
test('library shutdown retires every root and disposes each shared original texture once',native,async()=>{
  const loaded=[];const lib=library(original,async()=>{const t=new T.Texture();let disposed=0;t.addEventListener('dispose',()=>disposed++);loaded.push(()=>disposed);return t;});
  const a=await lib.create(ROOT),b=await lib.create(ROOT);a.update(.5,{camera:camera(),trajectory:trajectory()});
  lib.dispose();lib.dispose();await Promise.resolve();assert.equal(a.disposed,true);assert.equal(b.disposed,true);assert.equal(lib.instanceCount,0);
  assert.ok(loaded.length>0);assert.ok(loaded.every(count=>count()===1));
});
test('shutdown while an original texture is loading rejects creation and releases the late decoded texture',native,async()=>{
  let resolve,entered;const started=new Promise(r=>entered=r);let disposed=0;
  const lib=library(original,()=>{entered();return new Promise(r=>resolve=r);});
  const pending=lib.create(ROOT);await started;assert.equal(lib.instanceCount,1);lib.dispose();
  const tex=new T.Texture();tex.addEventListener('dispose',()=>disposed++);resolve(tex);
  await assert.rejects(pending,/disposed/);assert.equal(disposed,1);assert.equal(lib.instanceCount,0);
});
test('strict playback rejects an unresolved original root while diagnostic inspection reports its blockers',native,async()=>{
  const lib=library(original);
  try{
    await assert.rejects(lib.create('whitw2_token_01'),/unplayed components/);assert.equal(lib.instanceCount,0);
    const i=await lib.create('whitw2_token_01',{allowBlocked:true});assert.equal(i.blocked.length,2);assert.equal(i.draws.length,11);
    i.update(.5,{camera:camera()});assert.ok(i.blocked.every(b=>/mesh/.test(b.reason)));
  }finally{lib.dispose();}
});
test('failed original texture decode can retry without retaining a failed instance',native,async()=>{
  let fail=true;const lib=library(original,async()=>{if(fail)throw Error('fixture: decode failed');return new T.Texture();});
  try{
    await assert.rejects(lib.create(ROOT),/decode failed/);assert.equal(lib.instanceCount,0);fail=false;
    const i=await lib.create(ROOT);assert.equal(i.draws.length,19);assert.deepEqual(i.blocked,[]);
  }finally{lib.dispose();}
});
test('unsupported sampler rejects its texture and cannot silently change original filtering',native,async()=>{
  const altered=structuredClone(original);for(const r of Object.values(altered.pack.records))if(r.type==='Texture2D')r.data.m_TextureSettings.m_FilterMode=0;
  let disposed=0;const lib=library(altered,async()=>{const t=new T.Texture();t.addEventListener('dispose',()=>disposed++);return t;});
  try{await assert.rejects(lib.create(ROOT),/sampler needs review/);assert.equal(lib.instanceCount,0);assert.ok(disposed>0);}finally{lib.dispose();}
});
test('matrix uniforms bind the camera used by the caller render pass, independently of other instances',native,async()=>{
  const lib=library(original),i=await lib.create(ROOT),a=camera(),b=camera();b.position.x=8;b.lookAt(0,0,0);b.updateMatrixWorld(true);
  try{
    i.update(.5,{camera:a,trajectory:trajectory()});i.group.updateMatrixWorld(true);
    const mesh=i.draws.find(d=>d.mesh.material.uniforms.hlslcc_mtx4x4unity_MatrixVP).mesh;
    mesh.onBeforeRender.call(mesh,null,null,a);const expectedA=new T.Matrix4().multiplyMatrices(a.projectionMatrix,a.matrixWorldInverse);
    assert.deepEqual([...mesh.material.uniforms.hlslcc_mtx4x4unity_MatrixVP.value],[...Float32Array.from(expectedA.elements)]);
    mesh.onBeforeRender.call(mesh,null,null,b);const expectedB=new T.Matrix4().multiplyMatrices(b.projectionMatrix,b.matrixWorldInverse);
    assert.deepEqual([...mesh.material.uniforms.hlslcc_mtx4x4unity_MatrixVP.value],[...Float32Array.from(expectedB.elements)]);
    assert.notDeepEqual(expectedA.elements,expectedB.elements);
  }finally{lib.dispose();}
});

test('shader compile failure releases program/shader handles and restores a borrowed renderer context',()=>{
  let reset=0,programs=0,shaders=0;
  const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,createProgram:()=>({}),createShader:()=>({}),
    shaderSource(){},compileShader(){},getShaderParameter:()=>false,getShaderInfoLog:()=> 'fixture: compile failure',
    deleteShader(){shaders++;},deleteProgram(){programs++;}};
  const stage='#define UNITY_LOCATION(x) layout(location = x)\n#define UNITY_BINDING(x) layout(binding = x, std140)\nvoid main(){}\n';
  const program={source:'#ifdef VERTEX\n#version 300 es\n'+stage+'\n#endif\n#ifdef FRAGMENT\n#version 300 es\n'+stage+'\n#endif\n'};
  const renderer={getContext:()=>gl,resetState(){reset++;}},source={shaders:{fixture:{programs:{fixture:program}}}};
  assert.throws(()=>compileNativeEffectPrograms(renderer,source),/compile failure/);
  assert.equal(reset,1);assert.equal(programs,1);assert.equal(shaders,1);
});
test('distinct particle material slots cannot be silently reduced to the first source material',native,async()=>{
  const altered=structuredClone(original),probe=library(altered),i=await probe.create(ROOT);
  const renderer=i.draws.find(d=>altered.pack.records[d.component].type==='ParticleSystemRenderer').component;
  const slots=altered.pack.records[renderer].references.filter(r=>r.field==='m_Materials');
  slots[1].target=[...i.pose.renderers.values()].flatMap(r=>r.materials).find(m=>m&&m.id!==slots[0].target).id;
  // A different, valid source material must not silently disappear when the
  // caller requests strict playback of the whole original effect.
  probe.dispose();const lib=library(altered);
  try{await assert.rejects(lib.create(ROOT),/trail\/multi-material renderer/);assert.equal(lib.instanceCount,0);}finally{lib.dispose();}
});
test('3D billboard start angles remain rejected instead of being flattened to a camera quad',native,async()=>{
  const altered=structuredClone(original),probe=library(altered),instance=await probe.create(ROOT);
  const draw=instance.draws.find(d=>altered.pack.records[d.component].type==='ParticleSystemRenderer'
    &&altered.pack.records[d.component].data.m_RenderMode===0);
  assert.ok(draw);
  const go=altered.pack.records[draw.component].references.find(r=>r.field==='m_GameObject').target;
  const particle=altered.pack.records[go].references.find(r=>altered.pack.records[r.target]?.type==='ParticleSystem').target;
  altered.pack.records[particle].data.InitialModule.rotation3D=true;
  probe.dispose();const lib=library(altered);
  try{await assert.rejects(lib.create(ROOT),/3D billboard start rotation needs review/);assert.equal(lib.instanceCount,0);}finally{lib.dispose();}
});
