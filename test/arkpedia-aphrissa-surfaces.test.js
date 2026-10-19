// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {createNativeEffectLibrary} from '../public/arkpedia/native-effect-player.js';
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
import {createNativeStageCamera} from '../public/arkpedia/native-stage-camera.js';
import {createEffectTrajectory} from '../shared/arkpedia/native-effect-trail.js';
import rows from './fixtures/arkpedia-aphrissa-surfaces.json' with {type:'json'};
import meta from '../data/arkpedia-aphrissa-surfaces.json' with {type:'json'};
import effects from '../data/arkpedia-aphrissa-effects.json' with {type:'json'};
import animationMeta from '../data/arkpedia-aphrissa-effect-animations.json' with {type:'json'};
import shaderMeta from '../data/arkpedia-aphrissa-effect-shaders.json' with {type:'json'};
import builtinMeshes from '../data/arkpedia-aphrissa-builtin-meshes.json' with {type:'json'};
const sha=b=>createHash('sha256').update(b).digest('hex'),identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  still={frameAt:()=>({birth:identity,movement:identity})};
let source=null;
try{
  const bytes=await Promise.all([effects.pack,animationMeta.artifact,shaderMeta.artifact].map(async entry=>{
    const raw=await readFile('.cache/arkpedia/aphrissa-source/effects/'+entry.path);
    assert.equal(raw.length,entry.bytes);assert.equal(sha(raw),entry.sha256);return raw;
  }));source={pack:JSON.parse(gunzipSync(bytes[0])),animations:JSON.parse(bytes[1]),shaders:JSON.parse(bytes[2])};
}catch(error){if(error.code!=='ENOENT')throw error;}
const native={skip:source===null?'Original effect cache unavailable':false};

test('all 28 original Circle and BoxShell sources retain full controls, activation and explicit source fidelity limits',async()=>{
  const raw=await readFile(new URL('./fixtures/arkpedia-aphrissa-surfaces.json',import.meta.url));
  assert.equal(raw.length,meta.fixture.bytes);assert.equal(sha(raw),meta.fixture.sha256);assert.equal(meta.sourcePackSha256,effects.pack.sha256);
  assert.deepEqual(meta.counts,{profiles:28,circles:4,boxShells:24,roots:16,rendererEnabled:26,sourceInactive:8,probes:756});
  assert.deepEqual(meta.scope,{originalProfiles:true,uniformArea:true,nativeEmissionParity:false,compiledFrameParity:false,fullEffectDispatchVerified:false,enabledOperators:[]});
  let supported=0,gradient=0;
  for(const row of Object.values(rows)){
    const before=structuredClone(row.data);
    if(![0,2,4].includes(row.data.InitialModule.startColor.minMaxState)){
      assert.throws(()=>createMovingParticles(row.data),/Initial gradient clock/);gradient++;
    }else{
      const e=createMovingParticles(row.data),a=e.sample(.3,still);e.sample(2,still);assert.deepEqual(e.sample(.3,still),a);
      assert.ok(a.every(p=>p.origin.every(Number.isFinite)&&p.position.every(Number.isFinite)));supported++;
    }
    assert.deepEqual(row.data,before);
  }
  assert.equal(supported,28);assert.equal(gradient,0);
});

test('original surface components render through their full source hierarchy without enabling inactive or disabled objects',native,async()=>{
  const lib=createNativeEffectLibrary({three:T,...source,builtinMeshes,shaderGlobals:{_HG_UV_ROTATION:0},loadTexture:async()=>new T.Texture()}),
    c=new T.PerspectiveCamera(35,1,.001,100),trajectory=createEffectTrajectory([{time:0,position:[0,0,0]},{time:2,position:[2,1,0]}]);
  c.position.set(2,3,5);c.lookAt(0,0,0);c.updateMatrixWorld(true);const camera=createNativeStageCamera(T).sync(c);
  const counts={rendered:0,disabled:0,gradient:0};
  try{
    for(const [id,row] of Object.entries(rows)){
      // JSON recipes canonicalize signed zero; the native byte hash remains
      // separately pinned and independently checked against the bundle.
      const record=source.pack.records[id];assert.equal(JSON.stringify(record.data),JSON.stringify(row.data));assert.equal(record.serializedSha256,row.serializedSha256);
      if(![0,2,4].includes(row.data.InitialModule.startColor.minMaxState)){
        await assert.rejects(lib.inspectParticles(row.root,{particles:[id]}),/Initial gradient clock/);counts.gradient++;continue;
      }
      const i=await lib.inspectParticles(row.root,{particles:[id]});
      try{
        assert.equal(i.inspection.fullEffect,false);assert.deepEqual(i.blocked,[]);
        if(!row.rendererEnabled){assert.equal(i.draws.length,0);counts.disabled++;continue;}
        assert.equal(i.draws.length,1);const d=i.draws[0];assert.equal(d.component,row.renderer);
        const visible=part=>{for(let n=part;n;n=n.parent)if(!n.visible)return false;return true;};
        const sample=(time,clip)=>{
          i.update(time,{camera,clip,trajectory});i.group.updateMatrixWorld(true);
          assert.ok(d.pool.every(p=>p.matrixWorld.elements.every(Number.isFinite)));
          if(!row.gameObjectActive)assert.ok(d.pool.every(p=>!visible(p)));
          return JSON.stringify(d.lastParticles);
        };
        for(const clip of [null,...new Set(i.pose.instances.map(c=>c.clip))]){
          const first=sample(.15,clip);sample(.6,clip);assert.equal(sample(.15,clip),first);
        }
        counts.rendered++;
      }finally{i.dispose();}
    }
    assert.deepEqual(counts,{rendered:26,disabled:2,gradient:0});assert.equal(lib.instanceCount,0);
  }finally{lib.dispose();}
});

test('the original complete charge root now retains every enabled renderer while unrelated full roots still reject their remaining holds',native,async()=>{
  const lib=createNativeEffectLibrary({three:T,...source,builtinMeshes,shaderGlobals:{_HG_UV_ROTATION:0},loadTexture:async()=>new T.Texture()}),
    i=await lib.create('aphris_skill_03_charge_01'),c=new T.PerspectiveCamera(35,1,.001,100);
  c.position.set(2,3,5);c.lookAt(0,0,0);c.updateMatrixWorld(true);
  try{
    assert.equal(i.inspection,null);assert.deepEqual(i.blocked,[]);
    const enabled=[...i.pose.renderers].filter(([,r])=>r.enabled).map(([id])=>id).sort();
    assert.deepEqual(i.draws.map(d=>d.component).sort(),enabled);assert.ok(enabled.length>1);
    const sample=time=>{
      i.update(time,{camera:c,clip:i.pose.instances[0].clip});i.group.updateMatrixWorld(true);
      assert.ok(i.draws.every(d=>d.pool.every(p=>p.matrixWorld.elements.every(Number.isFinite))));
      return JSON.stringify(i.draws.map(d=>({id:d.component,particles:d.lastParticles})));
    };
    const first=sample(.15);sample(2);assert.equal(sample(.15),first);
    await assert.rejects(lib.create('aphris_attack_01_line_01'),/unplayed components/);
  }finally{i.dispose();lib.dispose();}
});
