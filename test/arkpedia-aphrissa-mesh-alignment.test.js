// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {createNativeEffectLibrary} from '../public/arkpedia/native-effect-player.js';
import {createNativeStageCamera} from '../public/arkpedia/native-stage-camera.js';
import {createEffectTrajectory} from '../shared/arkpedia/native-effect-trail.js';
import {createParticlePivot} from '../shared/arkpedia/native-particle-pivot.js';
import meta from '../data/arkpedia-aphrissa-mesh-alignment.json' with {type:'json'};
import profiles from './fixtures/arkpedia-aphrissa-mesh-alignment.json' with {type:'json'};
import effects from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import animationMeta from '../data/arkpedia-aphrissa-effect-animations.json' with {type:'json'};
import shaderMeta from '../data/arkpedia-aphrissa-effect-shaders.json' with {type:'json'};
import builtinMeshes from '../data/arkpedia-aphrissa-builtin-meshes.json' with {type:'json'};
const sha=b=>createHash('sha256').update(b).digest('hex');
let source=null;
try{
  const bytes=await Promise.all([effects.pack,animationMeta.artifact,shaderMeta.artifact].map(async entry=>{
    const raw=await readFile('.cache/arkpedia/aphrissa-source/effects/'+entry.path);
    assert.equal(raw.length,entry.bytes);assert.equal(sha(raw),entry.sha256);return raw;
  }));
  source={pack:JSON.parse(gunzipSync(bytes[0])),animations:JSON.parse(bytes[1]),shaders:JSON.parse(bytes[2])};
}catch(error){if(error.code!=='ENOENT')throw error;}
const native={skip:source===null?'Original effect cache unavailable':false};
const library=()=>createNativeEffectLibrary({three:T,...source,builtinMeshes,shaderGlobals:{_HG_UV_ROTATION:0},loadTexture:async()=>new T.Texture()});
const camera=(x,y,z)=>{const c=new T.PerspectiveCamera(35,1,.001,100);c.position.set(x,y,z);c.lookAt(0,0,0);c.updateMatrixWorld(true);return c;};
const localBasis=(mesh,c)=>new T.Matrix4().multiplyMatrices(c.matrixWorldInverse,mesh.matrixWorld).elements.filter((_,i)=>i<12);
const near=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8,`${v} != ${b[i]} at ${i}`));};

test('all 82 original mesh/view profiles retain source identity and explicit fidelity limits',async()=>{
  const raw=await readFile(new URL(meta.fixture.path.replace('test/','./'),import.meta.url));
  assert.equal(raw.length,meta.fixture.bytes);assert.equal(sha(raw),meta.fixture.sha256);
  assert.equal(meta.sourcePackSha256,effects.pack.sha256);assert.deepEqual(meta.counts,{renderers:82,roots:16});
  assert.deepEqual(meta.scope,{originalProfiles:true,meshViewMapping:true,nativeFrameParity:false,fullEffectDispatchVerified:false,enabledOperators:[]});
  for(const row of Object.values(profiles)){
    assert.equal(row.data.m_RenderMode,4);assert.equal(row.data.m_RenderAlignment,0);
    assert.ok(row.references.some(r=>r.field==='m_Mesh'&&r.target));
    const before=structuredClone(row.data);createParticlePivot(row.data);assert.deepEqual(row.data,before);
    for(const alignment of [1,3,4])assert.throws(()=>createParticlePivot({...row.data,m_RenderAlignment:alignment}),/alignment/);
  }
});

test('all original mesh/view layers render original geometry with their source particle motion',native,async()=>{
  const lib=library(),seen=new Set(),before=structuredClone(source.pack.records);
  try{
    for(const root of new Set(Object.values(profiles).map(r=>r.root))){
      const i=await lib.create(root,{allowBlocked:true});
      try{
        i.update(.15,{camera:camera(1,2,5)});
        for(const [key,row] of Object.entries(profiles).filter(([,r])=>r.root===root)){
          seen.add(key);const draw=i.draws.find(d=>d.component===key),blocked=i.blocked.find(b=>b.component===key);
          assert.ok(!!draw,key);assert.equal(blocked,undefined);assert.equal(draw.alignment,0);assert.ok(draw.emitter);
          const meshRef=row.references.find(r=>r.field==='m_Mesh').target,original=source.pack.meshes[meshRef];
          assert.ok(original);assert.deepEqual([...draw.mesh.geometry.getAttribute('in_POSITION0').array],Array.from(new Float32Array(original.positions.flat())));
          assert.deepEqual([...draw.mesh.geometry.index.array],original.submeshTriangles.flat(2));
          assert.ok(draw.pool.every(p=>p.matrix.elements.every(Number.isFinite)));
        }
      }finally{i.dispose();}
    }
    assert.equal(seen.size,82);assert.equal(lib.instanceCount,0);assert.deepEqual(source.pack.records,before);
  }finally{lib.dispose();}
});

test('mesh/view particles keep their source rotation and size in the camera basis across orbit, reflection and reverse time',native,async()=>{
  const lib=library();
  await assert.rejects(lib.create('aphris_attack_01_line_01'),/unplayed components/);
  const i=await lib.inspectMeshParticles('aphris_skill_03_charge_01',{allowBlocked:true}),cameras=[camera(1,2,5),camera(-4,1,3)];
  assert.deepEqual(i.inspection,{meshParticles:true,fullEffect:false});
  assert.ok(i.draws.every(d=>source.pack.records[d.component].type==='ParticleSystemRenderer'&&source.pack.records[d.component].data.m_RenderMode===4));
  cameras.push(createNativeStageCamera(T).sync(camera(2,3,4)));
  const sample=(time,c)=>{
    i.update(time,{camera:c});i.group.updateMatrixWorld(true);
    return i.draws.filter(d=>profiles[d.component]&&d.emitter).flatMap(d=>d.pool.filter((_,n)=>d.lastParticles[n]).map((p,n)=>({
      id:d.component+':'+n,basis:localBasis(p,c),particles:structuredClone(d.lastParticles[n]),
      colors:[...p.geometry.getAttribute('in_COLOR0').array],uv:[...p.geometry.getAttribute('in_TEXCOORD0').array]
    })));
  };
  try{
    const first=sample(.15,cameras[0]);assert.ok(first.length>0);
    for(const c of cameras.slice(1)){
      const next=sample(.15,c);assert.deepEqual(next.map(x=>x.id),first.map(x=>x.id));
      next.forEach((x,n)=>{near(x.basis,first[n].basis);assert.deepEqual(x.particles,first[n].particles);assert.deepEqual(x.colors,first[n].colors);assert.deepEqual(x.uv,first[n].uv);});
    }
    sample(.8,cameras[0]);assert.deepEqual(sample(.15,cameras[0]),first);
    const geometry=new Set(i.draws.flatMap(d=>(d.pool??[d.mesh]).map(p=>p.geometry))),materials=new Set(i.draws.map(d=>d.mesh.material));
    let gs=0,ms=0;for(const g of geometry)g.addEventListener('dispose',()=>gs++);for(const m of materials)m.addEventListener('dispose',()=>ms++);
    i.dispose();assert.equal(gs,geometry.size);assert.equal(ms,materials.size);assert.equal(lib.instanceCount,0);
  }finally{i.dispose();lib.dispose();}
});

test('the original three-axis end-ring rotates around fixed Z, X then Y after camera alignment',native,async()=>{
  const lib=library(),i=await lib.inspectMeshParticles('aphris_skill_03_charge_01_end',{allowBlocked:true}),c=camera(-2,3,5);
  try{
    i.update(.15,{camera:c});i.group.updateMatrixWorld(true);
    const d=i.draws.find(d=>d.component==='battle/prefabs/effects/aphris.ab:-790063424196322789'),particle=d.lastParticles[0];
    assert.equal(d.particleSource.InitialModule.rotation3D,true);assert.equal(particle.rotation3D.length,3);
    assert.ok(particle.rotation3D.every(v=>Number.isFinite(v)&&Math.abs(v)>1e-4));
    const [x,y,z]=particle.rotation3D,actual=localBasis(d.pool[0],c);
    for(let axis=0;axis<3;axis++){
      const v=[0,0,0];v[axis]=1;
      const a=[Math.cos(z)*v[0]-Math.sin(z)*v[1],Math.sin(z)*v[0]+Math.cos(z)*v[1],v[2]],
        b=[a[0],Math.cos(x)*a[1]-Math.sin(x)*a[2],Math.sin(x)*a[1]+Math.cos(x)*a[2]],
        expected=[Math.cos(y)*b[0]+Math.sin(y)*b[2],b[1],-Math.sin(y)*b[0]+Math.cos(y)*b[2]],
        column=actual.slice(axis*4,axis*4+3),length=Math.hypot(...column);
      assert.ok(length>0);near(column.map(v=>v/length),expected);
    }
  }finally{i.dispose();lib.dispose();}
});

test('selected particles retain their original ancestors and authored inactivity without bypassing root ownership',native,async()=>{
  const lib=library(),id='battle/prefabs/effects/aphris.ab:-2723189773097744130',root='aphris_skill_03_start_01';
  try{
    assert.throws(()=>lib.inspectParticles(root,{particles:[]}),/selection/);
    assert.throws(()=>lib.inspectParticles(root,{particles:[id,id]}),/selection/);
    await assert.rejects(lib.inspectParticles('aphris_skill_03_charge_01',{particles:[id]}),/outside/);
    assert.equal(lib.instanceCount,0);
    const i=await lib.inspectParticles(root,{particles:[id]});
    assert.deepEqual(i.inspection,{particles:[id],fullEffect:false});assert.equal(i.draws.length,1);
    assert.ok(i.pose.nodes.size>1);assert.ok(i.pose.renderers.size>i.draws.length);assert.equal(i.pose.instances.length,0);
    const go=source.pack.records[id].references.find(r=>r.field==='m_GameObject').target;
    assert.equal(source.pack.records[go].data.m_IsActive,false);
    const visible=part=>{for(let o=part;o;o=o.parent)if(!o.visible)return false;return true;};
    for(const time of [.15,.6,.15]){
      i.update(time,{camera:camera(1,2,5)});i.group.updateMatrixWorld(true);
      assert.ok(i.draws[0].lastParticles.length>0);assert.ok(i.draws[0].pool.every(p=>!visible(p)));
      assert.equal(source.pack.records[go].data.m_IsActive,false);
    }
    i.dispose();assert.equal(lib.instanceCount,0);
  }finally{lib.dispose();}
});

test('the original animated S3 charge loop renders World particles at their own original clip/birth poses',native,async()=>{
  const lib=library(),id='battle/prefabs/effects/aphris.ab:181594443170011045',
    i=await lib.inspectParticles('aphris_skill_03_charge_01',{particles:[id]}),clip=i.pose.instances[0].clip,
    trajectory=createEffectTrajectory([{time:0,position:[0,0,0]},{time:2,position:[4,1,2]}]),
    cam=createNativeStageCamera(T).sync(camera(2,3,5)),d=i.draws[0];
  assert.equal(source.animations.clips[clip].name,'aphris_skill_03_charge_start');
  assert.equal(d.emitter.worldMotion,true);assert.equal(d.particleSource.moveWithTransform,1);
  assert.equal(d.particleSource.InitialModule.startSpeed.scalar,0);
  const expectedAt=time=>{
    time=Math.max(0,time);const state=i.pose.sample(time,clip),chain=[];
    for(let id=d.transform;id;id=state.nodes.get(id).parent)chain.unshift(id);
    const matrix=new T.Matrix4(),offset=trajectory.sample(time);
    for(const id of chain){
      const n=state.nodes.get(id),position=n.position.map((v,axis)=>v+(n.parent?0:offset[axis])),
        q=n.euler?new T.Quaternion().setFromEuler(new T.Euler(...n.euler.map(v=>v*Math.PI/180),'YXZ')):new T.Quaternion().fromArray(n.rotation);
      matrix.multiply(new T.Matrix4().compose(new T.Vector3().fromArray(position),q,new T.Vector3().fromArray(n.scale)));
    }
    return new T.Vector3().setFromMatrixPosition(matrix).toArray();
  };
  const sample=time=>{
    i.update(time,{camera:cam,clip,trajectory});i.group.updateMatrixWorld(true);
    const pivot=source.pack.records[d.component].data.m_Pivot;
    for(const [n,p] of d.lastParticles.entries()){
      near(p.worldPosition,expectedAt(p.birthTime));near(p.displacement,[0,0,0]);
      assert.ok(d.pool[n].matrixWorld.elements.every(Number.isFinite));
      if(d.pool[n].visible)near(new T.Vector3(pivot.x,pivot.y,pivot.z).applyMatrix4(d.pool[n].matrixWorld).toArray(),p.worldPosition);
    }
    return d.lastParticles.map(p=>({id:p.id,birthTime:p.birthTime,position:p.worldPosition}));
  };
  try{
    sample(0);const first=sample(.8);assert.ok(first.length>0);assert.ok(first.some(p=>p.birthTime<0)&&first.some(p=>p.birthTime>0));
    sample(2);assert.deepEqual(sample(.8),first);assert.equal(i.inspection.fullEffect,false);
    i.dispose();assert.equal(lib.instanceCount,0);
  }finally{i.dispose();lib.dispose();}
});

test('the original World end-loop remains inactive through its recovered transform/material clip',native,async()=>{
  const lib=library(),id='battle/prefabs/effects/aphris.ab:-3347359679414150629',
    i=await lib.inspectParticles('aphris_skill_03_charge_01_end',{particles:[id]}),d=i.draws[0],
    go=source.pack.records[id].references.find(r=>r.field==='m_GameObject').target;
  const visible=part=>{for(let n=part;n;n=n.parent)if(!n.visible)return false;return true;};
  try{
    assert.equal(source.pack.records[go].data.m_IsActive,false);assert.ok(i.pose.instances.length>0);
    assert.ok(i.pose.instances.every(c=>c.bindings.every(b=>b.gameObject!==go||b.property!=='m_IsActive')));
    for(const clip of [null,...i.pose.instances.map(c=>c.clip)])for(const time of [0,.15,.6,2,.15]){
      i.update(time,{camera:camera(1,2,5),clip});i.group.updateMatrixWorld(true);
      assert.ok(d.lastParticles.length>0);assert.ok(d.pool.every(p=>!visible(p)));
      assert.ok(d.lastParticles.every(p=>p.worldPosition.every(Number.isFinite)));
    }
    assert.equal(source.pack.records[go].data.m_IsActive,false);assert.equal(i.inspection.fullEffect,false);
  }finally{i.dispose();lib.dispose();}
});
