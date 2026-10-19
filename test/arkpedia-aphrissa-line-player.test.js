// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as T from 'three';
import effects from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import animationsMeta from '../data/arkpedia-aphrissa-effect-animations.json' with {type:'json'};
import shadersMeta from '../data/arkpedia-aphrissa-effect-shaders.json' with {type:'json'};
import lines from '../data/arkpedia-aphrissa-lines.json' with {type:'json'};
import {createNativeEffectLibrary} from '../public/arkpedia/native-effect-player.js';
const directory='.cache/arkpedia/aphrissa-source/effects/';
let source;
try{
  const bytes=await Promise.all([effects.pack,animationsMeta.artifact,shadersMeta.artifact].map(async meta=>{
    const b=await readFile(directory+meta.path);assert.equal(b.length,meta.bytes);
    assert.equal(createHash('sha256').update(b).digest('hex'),meta.sha256);return b;
  }));
  source={pack:JSON.parse(gunzipSync(bytes[0])),animations:JSON.parse(bytes[1]),shaders:JSON.parse(bytes[2])};
}catch(error){if(error.code!=='ENOENT')throw error;}
const native={skip:!source?'Original Aphrissa effect cache unavailable':false};
const camera=()=>{const c=new T.PerspectiveCamera(35,1,.001,100);c.position.set(3,3,10);c.lookAt(3,3,0);c.updateMatrixWorld(true);return c;};
const library=(globals={},loadTexture=async()=>new T.Texture())=>createNativeEffectLibrary({three:T,...source,loadTexture,shaderGlobals:globals});
const endpoints=(_id,t)=>[[1+t,2,3],[5+t,2+Math.sin(t),3]];
const snapshot=i=>JSON.stringify(i.draws.map(d=>({id:d.component,line:d.lineData,
  position:[...d.mesh.geometry.getAttribute('position').array],matrix:d.mesh.matrixWorld.elements,
  colors:[...d.mesh.geometry.getAttribute('in_COLOR0').array],uniforms:[d.mesh.material.uniforms._Amount?.value,
    d.mesh.material.uniforms._MainColor?.value.toArray(),d.mesh.material.uniforms._Time?.value.toArray()]})));

for(const root of Object.keys(lines.roots))test(root+' plays all eight original line layers with independent endpoints and source clocks',native,async()=>{
  const globals={_HG_UV_ROTATION:0},textures=[],lib=library(globals,async()=>{const t=new T.Texture();textures.push(t);return t;}),cam=camera();
  globals._HG_UV_ROTATION=1;
  try{
    let owner=true,bad=false;
    const a=await lib.inspectLines(root,{linePositions:(id,t)=>bad?undefined:owner?endpoints(id,t):null});
    const b=await lib.inspectLines(root,{linePositions:endpoints});
    assert.equal(a.inspection.fullEffect,false);assert.equal(a.shaderGlobals._HG_UV_ROTATION,0);
    assert.equal(a.draws.length,8);assert.deepEqual(a.blocked,[]);
    assert.deepEqual(a.draws.map(d=>d.component),lines.roots[root]);
    const clip=a.pose.instances.find(i=>source.animations.clips[i.clip].name===root).clip;
    a.update(.05,{camera:cam,clip});a.group.updateMatrixWorld(true);
    b.update(.02,{camera:cam,clip});b.group.updateMatrixWorld(true);
    const first=snapshot(a),other=snapshot(b);
    for(const d of a.draws){
      assert.ok(d.lineData.indices.length);assert.equal(d.mesh.geometry.getAttribute('position').count,4);
      d.mesh.matrixWorld.elements.forEach((v,i)=>assert.ok(Math.abs(v-(i%5===0?1:0))<1e-10));
      assert.equal(d.mesh.material.uniforms._HG_UV_ROTATION.value,0);
      assert.deepEqual(d.mesh.material.uniforms._Rotation0.value.toArray(),[0,0,0,0]);
      assert.equal(d.mesh.renderOrder,source.pack.records[d.component].data.m_SortingOrder);
    }
    a.update(.7,{camera:cam,clip});a.update(.05,{camera:cam,clip});a.group.updateMatrixWorld(true);
    assert.equal(snapshot(a),first);assert.equal(snapshot(b),other);
    owner=false;a.update(.05,{camera:cam,clip});assert.ok(a.draws.every(d=>!d.mesh.visible&&d.lineData.indices.length===0));
    owner=true;a.update(.05,{camera:cam,clip});a.group.updateMatrixWorld(true);assert.equal(snapshot(a),first);
    bad=true;assert.throws(()=>a.update(.05,{camera:cam,clip}),/explicit endpoints/);
    assert.ok(a.draws.every(d=>!d.mesh.visible&&d.lineData===null));
    let disposed=0;for(const d of a.draws)d.mesh.geometry.addEventListener('dispose',()=>disposed++);
    a.dispose();assert.equal(disposed,8);assert.equal(lib.instanceCount,1);assert.equal(snapshot(b),other);
    b.dispose();assert.equal(lib.instanceCount,0);
  }finally{lib.dispose();}
  assert.ok(textures.length>0);
});

test('missing endpoint owners and unknown game globals cannot silently enable beam playback',native,async()=>{
  const root=Object.keys(lines.roots)[0],lib=library();
  try{
    assert.throws(()=>lib.inspectLines(root),/explicit endpoint ownership/);
    await assert.rejects(lib.inspectLines(root,{linePositions:endpoints}),/global _HG_UV_ROTATION needs explicit binding/);
    assert.equal(lib.instanceCount,0);
    await assert.rejects(lib.create(root),/endpoints need explicit owner mapping/);
    assert.equal(lib.instanceCount,0);
    await assert.rejects(lib.inspectLines('common_char_birth_01_delay_01',{linePositions:endpoints}),/no line renderers/);
  }finally{lib.dispose();}
  const enabled=library({_HG_UV_ROTATION:1});
  try{await assert.rejects(enabled.inspectLines(root,{linePositions:endpoints}),/texture rotation script/);assert.equal(enabled.instanceCount,0);}
  finally{enabled.dispose();}
  for(const globals of [{_HG_UV_ROTATION:2},{_HG_UV_ROTATION:'0'},{_MainColor:[1,1,1,1]},null,[],42,''])
    assert.throws(()=>library(globals),/Unreviewed native shader global/);
});

test('world-space beams ignore singular editor transforms while retaining original activation',native,async()=>{
  const root=Object.keys(lines.roots)[0],altered=structuredClone(source),records=altered.pack.records;
  const go=altered.pack.roots[root],tr=records[go].references.find(r=>r.field==='component'&&records[r.target].type==='Transform').target;
  records[tr].data.m_LocalScale={x:0,y:0,z:0};records[tr].data.m_LocalPosition={x:100,y:200,z:300};
  const lib=createNativeEffectLibrary({three:T,...altered,shaderGlobals:{_HG_UV_ROTATION:0},loadTexture:async()=>new T.Texture()}),cam=camera();
  try{
    const i=await lib.inspectLines(root,{linePositions:endpoints});i.update(0,{camera:cam});i.group.updateMatrixWorld(true);
    const state=i.pose.sample(0);
    assert.ok(i.draws.some(d=>d.mesh.visible));
    assert.ok(i.draws.every(d=>d.mesh.visible===state.nodes.get(d.transform).visible));
    for(const d of i.draws)d.mesh.matrixWorld.elements.forEach((v,n)=>assert.ok(Math.abs(v-(n%5===0?1:0))<1e-12));
    i.dispose();
    records[go].data.m_IsActive=false;
    const inactive=await lib.inspectLines(root,{linePositions:endpoints});inactive.update(0,{camera:cam});
    assert.ok(inactive.draws.every(d=>!d.mesh.visible));inactive.dispose();
  }finally{lib.dispose();}
});
