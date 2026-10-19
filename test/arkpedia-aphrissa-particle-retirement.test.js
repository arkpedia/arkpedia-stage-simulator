// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {createNativeEffectLibrary} from '../public/arkpedia/native-effect-player.js';
import {createNativeStageCamera} from '../public/arkpedia/native-stage-camera.js';
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
import {sampleParticleGradient} from '../shared/arkpedia/native-particle-curves.js';
import {particleRandom} from '../shared/arkpedia/native-particle-random.js';
import effects from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import animationMeta from '../data/arkpedia-aphrissa-effect-animations.json' with {type:'json'};
import shaderMeta from '../data/arkpedia-aphrissa-effect-shaders.json' with {type:'json'};
import builtinMeshes from '../data/arkpedia-aphrissa-builtin-meshes.json' with {type:'json'};
const sha=b=>createHash('sha256').update(b).digest('hex'),identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  still={frameAt:()=>({birth:identity,movement:identity})},near=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8,`${v} != ${b[i]}`));};
let source=null;
try{
  const bytes=await Promise.all([effects.pack,animationMeta.artifact,shaderMeta.artifact].map(async entry=>{
    const b=await readFile('.cache/arkpedia/aphrissa-source/effects/'+entry.path);assert.equal(b.length,entry.bytes);assert.equal(sha(b),entry.sha256);return b;
  }));source={pack:JSON.parse(gunzipSync(bytes[0])),animations:JSON.parse(bytes[1]),shaders:JSON.parse(bytes[2])};
}catch(error){if(error.code!=='ENOENT')throw error;}
const native={skip:source===null?'Original effect cache unavailable':false},
  library=pack=>createNativeEffectLibrary({three:T,...source,...(pack?{pack}:{}),builtinMeshes,shaderGlobals:{_HG_UV_ROTATION:0},loadTexture:async()=>new T.Texture()}),
  camera=(x,y,z)=>{const c=new T.PerspectiveCamera(35,1,.001,100);c.position.set(x,y,z);c.lookAt(0,0,0);c.updateMatrixWorld(true);return c;};
import retirement from '../data/arkpedia-aphrissa-retirement.json' with {type:'json'};
import {recoverAphrissaRetirement} from '../tools/arkpedia/aphrissa-retirement-source.mjs';
import {APHRISSA_STATE_STYLES as styles} from '../shared/arkpedia/aphrissa-state-presentation.js';
test('authored drain metadata reproduces all 22 original roots with their geometry and speed-scaled lifetime gates',native,async()=>{
 assert.deepEqual(await recoverAphrissaRetirement(),retirement);assert.equal(Object.keys(retirement.roots).length,22);
 for(const root of ['aphris_skill_03_charge_01','aphris_skill_03_charge_01_end','aphris_skill_03_buff_02_front','aphris_skill_03_buff_02_back']){
  const r=retirement.roots[root];assert.equal(r.particleDrainSupported,true);assert.equal(r.nonParticleRenderers,0);assert.equal(r.drainBound,5);
 }
 assert.equal(retirement.roots.aphris_skill_01_buff_01.particleDrainSupported,false);assert.equal(retirement.roots.aphris_skill_03_buff_01.particleDrainSupported,false);
 assert.equal(retirement.scope.nativeFinishDispatchVerified,false);assert.deepEqual(retirement.scope.enabledOperators,[]);
});
for(const kind of ['charge','chargeEnd','wing'])for(const back of kind==='wing'?[false,true]:[false])test(`complete original ${kind}${back?' back':''} particles retain their birth state and drain without new emission`,native,async()=>{
 const root=back?styles[kind].back:styles[kind].root,lib=library(),i=await lib.create(root),full=await lib.create(root),cam=camera(2,3,5),
  clips=styles[kind].clips,cutoff=1.15,time=1.5,before=JSON.stringify(source.pack),
  update=(instance,time,emissionUntil=null)=>{instance.update(time,{camera:cam,clip:clips.length?clips:null,emissionUntil});instance.group.updateMatrixWorld(true);};
 try{
  update(i,.8);const count=i.draws.reduce((n,d)=>n+(d.lastParticles?.length??0),0);assert.ok(count>0);update(i,time,cutoff);update(full,time);
  let surviving=0;const snapshot=[];
  for(const [index,d]of i.draws.entries()){
   assert.ok(d.emitter);const raw=full.draws[index].lastParticles??[],expected=raw.filter(p=>(p.birthTime??time-p.age/d.particleSource.simulationSpeed)<cutoff),actual=d.lastParticles??[];
   assert.deepEqual(actual,expected);surviving+=actual.length;snapshot.push(structuredClone(actual));
   for(const p of actual)assert.ok((p.birthTime??time-p.age/d.particleSource.simulationSpeed)<cutoff);
  }
  assert.ok(surviving>0);update(i,cutoff+retirement.roots[root].drainBound+.1,cutoff);
  assert.ok(i.draws.every(d=>!d.lastParticles?.length&&d.pool.every(p=>!p.visible)));
  update(i,time,cutoff);assert.deepEqual(i.draws.map(d=>d.lastParticles??[]),snapshot);
  update(i,time);assert.deepEqual(i.draws.map(d=>d.lastParticles??[]),full.draws.map(d=>d.lastParticles??[]));
  for(const invalid of [-1,NaN,Infinity,false])assert.throws(()=>update(i,time,invalid),/cutoff/);
  assert.equal(JSON.stringify(source.pack),before);assert.equal(i.inspection,null);assert.deepEqual(i.blocked,[]);
 }finally{i.dispose();full.dispose();assert.equal(lib.instanceCount,0);lib.dispose();}
});
