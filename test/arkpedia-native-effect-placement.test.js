// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {createEffectPlacement,isEffectPlacement} from '../shared/arkpedia/native-effect-placement.js';
import {createEffectTrajectory} from '../shared/arkpedia/native-effect-trail.js';
import {createNativeEffectLibrary} from '../public/arkpedia/native-effect-player.js';
import {createNativeStageCamera} from '../public/arkpedia/native-stage-camera.js';
import meta from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import animationMeta from '../data/arkpedia-aphrissa-effect-animations.json' with {type:'json'};
import shaderMeta from '../data/arkpedia-aphrissa-effect-shaders.json' with {type:'json'};
import builtinMeshes from '../data/arkpedia-aphrissa-builtin-meshes.json' with {type:'json'};
const sha=b=>createHash('sha256').update(b).digest('hex'),near=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8,`${v} != ${b[i]}`));},
  c=scalar=>({minMaxState:0,scalar}),rotation=angle=>[0,Math.sin(angle/2),0,Math.cos(angle/2)],
  frame=(time,position=[0,0,0],angle=0,scale=[1,1,1])=>({time,position,rotation:rotation(angle),scale});
test('explicit placement interpolates position, signed scale and the shortest quaternion arc without leaking caller changes',()=>{
  const samples=[frame(0,[1,2,3],0,[1,2,3]),frame(2,[5,6,7],Math.PI*1.5,[-1,0,5])],before=structuredClone(samples),p=createEffectPlacement(samples);
  const middle=p.sample(1);near(middle.position,[3,4,5]);near(middle.scale,[0,1,4]);
  near(new T.Vector3(1,0,0).applyQuaternion(new T.Quaternion().fromArray(middle.rotation)).toArray(),[Math.SQRT1_2,0,Math.SQRT1_2]);
  assert.equal(isEffectPlacement(p),true);assert.equal(isEffectPlacement({...p}),false);assert.equal(isEffectPlacement(null),false);
  assert.deepEqual(p.times(1),[0,1]);assert.deepEqual(p.times(3),[0,2,3]);assert.deepEqual(p.times(-1),[]);
  assert.deepEqual(p.sample(-1),p.sample(0));assert.deepEqual(p.sample(3),p.sample(2));assert.deepEqual(samples,before);
  samples[0].position[0]=999;middle.position[0]=999;assert.deepEqual(p.sample(1).position,[3,4,5]);
  assert.deepEqual(p.scope,{explicitWorldPlacement:true,linearPositionAndScale:true,shortestQuaternionArc:true,nativeMountMappingVerified:false,compiledFrameParity:false});
});
test('antipodal/nearby quaternions, reflected frames, collapsed axes and extreme finite positions remain finite',()=>{
  for(const end of [[0,0,0,-1],rotation(1e-8)]){
    const a=frame(0,[-Number.MAX_VALUE,0,0],0,[0,-2,1]),b={...frame(1,[Number.MAX_VALUE,0,0],0,[0,-4,1]),rotation:end},p=createEffectPlacement([a,b]);
    for(const time of [0,.25,.5,.75,1]){const s=p.sample(time);assert.ok([...s.position,...s.rotation,...s.scale].every(Number.isFinite));near([Math.hypot(...s.rotation)],[1]);}
    near(p.sample(.5).position,[0,0,0]);
  }
  for(const input of [[],[frame(1)],[frame(0),frame(0)],[frame(0),frame(-1)],
    [{...frame(0),rotation:[0,0,0,0]}],[{...frame(0),rotation:[0,0,0,2]}],[{...frame(0),scale:[1,2]}],[frame(0,[Infinity,0,0])],
    [frame(0,Array(3))],[{...frame(0),rotation:Array(4)}],[{...frame(0),scale:Array(3)}]])
    assert.throws(()=>createEffectPlacement(input));
  const p=createEffectPlacement([frame(0)]);assert.throws(()=>p.sample(NaN));assert.throws(()=>p.times(Infinity));
});
let source=null;
try{
  const bytes=await Promise.all([meta.pack,animationMeta.artifact,shaderMeta.artifact].map(async entry=>{
    const b=await readFile('.cache/arkpedia/aphrissa-source/effects/'+entry.path);assert.equal(b.length,entry.bytes);assert.equal(sha(b),entry.sha256);return b;
  }));source={pack:JSON.parse(gunzipSync(bytes[0])),animations:JSON.parse(bytes[1]),shaders:JSON.parse(bytes[2])};
}catch(error){if(error.code!=='ENOENT')throw error;}
const native={skip:source===null?'Original effect cache unavailable':false},id='battle/prefabs/effects/aphris.ab:181594443170011045',root='aphris_skill_03_charge_01',
  camera=()=>{const c=new T.PerspectiveCamera(35,1,.001,200);c.position.set(2,3,5);c.lookAt(0,0,0);c.updateMatrixWorld(true);return createNativeStageCamera(T).sync(c);},
  library=pack=>createNativeEffectLibrary({three:T,...source,...(pack?{pack}:{}),builtinMeshes,shaderGlobals:{_HG_UV_ROTATION:0},loadTexture:async()=>new T.Texture()});

test('original World prewarm particles retain their own placed birth points while later births follow later owner frames',native,async()=>{
  const lib=library(),i=await lib.inspectParticles(root,{particles:[id]}),p=createEffectPlacement([
    frame(0,[10,20,30],Math.PI/2,[2,2,2]),frame(2,[30,40,50],Math.PI,[3,3,3])]),cam=camera(),d=i.draws[0],before=structuredClone(source.pack.records);
  const sample=time=>{
    i.update(time,{camera:cam,placement:p});i.group.updateMatrixWorld(true);
    for(const particle of d.lastParticles){near(particle.worldPosition,p.sample(Math.max(0,particle.birthTime)).position);near(particle.displacement,[0,0,0]);}
    assert.ok(d.pool.every(o=>o.matrixWorld.elements.every(Number.isFinite)));return structuredClone(d.lastParticles);
  };
  try{
    sample(0);const first=sample(.8);assert.ok(first.some(p=>p.birthTime<0)&&first.some(p=>p.birthTime>0));sample(2);assert.deepEqual(sample(.8),first);
    i.update(.8,{camera:cam});assert.ok(d.lastParticles.every(p=>p.worldPosition.every(v=>Math.abs(v)<1e-10)));
    assert.throws(()=>i.update(.8,{camera:cam,placement:{...p}}),/explicit placement/);
    assert.throws(()=>i.update(.8,{camera:cam,placement:p,trajectory:createEffectTrajectory([{time:0,position:[0,0,0]}])}),/one explicit/);
    assert.deepEqual(source.pack.records,before);
  }finally{i.dispose();lib.dispose();}
});

test('placement acts above the source hierarchy and preserves all three particle scaling modes and Local versus World movement',native,async()=>{
  const placement=createEffectPlacement([frame(0,[10,20,30],Math.PI/2,[2,2,2]),frame(1,[40,50,60],Math.PI,[4,4,4])]),cam=camera();
  for(const space of [0,1])for(const scalingMode of [0,1,2]){
    const pack=structuredClone(source.pack),s=pack.records[id].data;
    Object.assign(s,{moveWithTransform:space,scalingMode,looping:false,prewarm:false,lengthInSec:2,simulationSpeed:1,startDelay:c(0)});
    Object.assign(s.InitialModule,{startSpeed:c(3),startLifetime:c(2)});
    Object.assign(s.EmissionModule,{enabled:true,rateOverTime:c(0),rateOverDistance:c(0),m_BurstCount:1,
      m_Bursts:[{time:0,cycleCount:1,repeatInterval:1,probability:1,countCurve:c(1)}]});
    // Controlled source-frame case isolates placement/scaling from authored
    // ancestor quaternion precision; original pack records remain unchanged.
    for(const r of Object.values(pack.records))if(r.type==='Transform')r.data.m_LocalRotation={x:0,y:0,z:0,w:1};
    const lib=library(pack),i=await lib.inspectParticles(root,{particles:[id]}),d=i.draws[0],time=.25;
    try{
      i.update(time,{camera:cam});i.group.updateMatrixWorld(true);
      const pivot=pack.records[d.component].data.m_Pivot,at=()=>new T.Vector3(pivot.x,pivot.y,pivot.z).applyMatrix4(d.pool[0].matrixWorld),base=at();
      i.update(time,{camera:cam,placement});i.group.updateMatrixWorld(true);
      const owner=placement.sample(space===1?0:time),expected=base.clone().multiplyScalar(scalingMode===0?owner.scale[0]:1)
        .applyQuaternion(new T.Quaternion().fromArray(owner.rotation)).add(new T.Vector3().fromArray(owner.position));
      near(at().toArray(),expected.toArray());assert.equal(i.group.matrixWorld.determinant(),1);
    }finally{i.dispose();lib.dispose();}
  }
});

test('original animated World birth transforms compose with the owner frame at birth, including the reflected stage camera',native,async()=>{
  const lib=library(),i=await lib.inspectParticles(root,{particles:[id]}),d=i.draws[0],clip=i.pose.instances[0].clip,cam=camera(),
    placement=createEffectPlacement([frame(0,[2,3,-1],Math.PI/2,[2,1,3]),frame(2,[6,4,2],Math.PI,[1,2,1])]);
  assert.equal(source.animations.clips[clip].name,'aphris_skill_03_charge_start');
  const expectedAt=time=>{
    time=Math.max(0,time);const pose=i.pose.sample(time,clip),chain=[],owner=placement.sample(time),
      matrix=new T.Matrix4().compose(new T.Vector3().fromArray(owner.position),new T.Quaternion().fromArray(owner.rotation),new T.Vector3().fromArray(owner.scale));
    for(let id=d.transform;id;id=pose.nodes.get(id).parent)chain.unshift(id);
    for(const id of chain){
      const n=pose.nodes.get(id),q=n.euler?new T.Quaternion().setFromEuler(new T.Euler(...n.euler.map(v=>v*Math.PI/180),'YXZ')):new T.Quaternion().fromArray(n.rotation);
      matrix.multiply(new T.Matrix4().compose(new T.Vector3().fromArray(n.position),q,new T.Vector3().fromArray(n.scale)));
    }
    return new T.Vector3().setFromMatrixPosition(matrix).toArray();
  };
  const sample=time=>{
    i.update(time,{camera:cam,clip,placement});i.group.updateMatrixWorld(true);
    const pivot=source.pack.records[d.component].data.m_Pivot;
    for(const [index,p]of d.lastParticles.entries()){
      near(p.worldPosition,expectedAt(p.birthTime));
      near(new T.Vector3(pivot.x,pivot.y,pivot.z).applyMatrix4(d.pool[index].matrixWorld).toArray(),p.worldPosition);
    }
    return structuredClone(d.lastParticles);
  };
  try{sample(0);const first=sample(.8);sample(2);assert.deepEqual(sample(.8),first);}
  finally{i.dispose();lib.dispose();}
});

test('all complete original roots retain renderer ownership under placement and explicit World line endpoints are never placed twice',native,async()=>{
  const lib=library(),placement=createEffectPlacement([frame(0,[7,3,9],Math.PI/2,[2,-1,3])]),cam=camera();
  try{
    for(const name of Object.keys(source.pack.roots)){
      const i=await lib.create(name,{linePositions:()=>[[-1,0,0],[1,0,0]]});
      try{
        assert.deepEqual(i.blocked,[]);i.update(.15,{camera:cam});const lines=i.draws.filter(d=>d.line).map(d=>structuredClone(d.lineData));
        const sample=time=>{
          i.update(time,{camera:cam,placement});i.group.updateMatrixWorld(true);
          for(const d of i.draws)assert.ok((d.pool??[d.mesh]).every(p=>p.matrixWorld.elements.every(Number.isFinite)));
          return JSON.stringify(i.draws.map(d=>({id:d.component,particles:d.lastParticles,line:d.lineData})));
        };
        const first=sample(.15);assert.deepEqual(i.draws.filter(d=>d.line).map(d=>d.lineData),lines);sample(.8);assert.equal(sample(.15),first);
      }finally{i.dispose();}
    }
    assert.equal(lib.instanceCount,0);
  }finally{lib.dispose();}
});
