// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { createNativeEffectLibrary } from '../public/arkpedia/native-effect-player.js';
import effect from '../data/arkpedia-tragodia-effects.json' with {type:'json'};
import animation from '../data/arkpedia-tragodia-effect-animations.json' with {type:'json'};
import shader from '../data/arkpedia-tragodia-effect-shaders.json' with {type:'json'};
import builtinMeshes from '../data/arkpedia-unity-builtin-meshes.json' with {type:'json'};
const ROOT='phatm2_skill_03_prison_01',DIR='.cache/arkpedia/tragodia-source/effects/';
const PARENT='battle/prefabs/effects/phatm2.ab:1554873112122431723';
const CHILD='battle/prefabs/effects/phatm2.ab:4040094038318586091';
const CLIP='battle/prefabs/effects/phatm2.ab:7379801640911501129';
let original=null;
try {
  const bytes=await Promise.all([effect.pack,animation.artifact,shader.artifact].map(async e=>{
    const raw=await readFile(DIR+e.path);assert.equal(raw.length,e.bytes);
    assert.equal(createHash('sha256').update(raw).digest('hex'),e.sha256);return raw;
  }));
  original={pack:JSON.parse(gunzipSync(bytes[0])),animations:JSON.parse(bytes[1]),shaders:JSON.parse(bytes[2])};
} catch(e) {if(e.code!=='ENOENT')throw e;}
const native={skip:original===null?'Original effect cache unavailable':false};
const library=source=>createNativeEffectLibrary({three:T,...source,builtinMeshes,loadTexture:async()=>new T.Texture()});
function camera(){const c=new T.PerspectiveCamera(35,1,.001,100);c.position.set(0,2,3);c.lookAt(0,0,0);c.updateMatrixWorld(true);return c;}
const state=i=>i.draws.map(d=>({component:d.component,slot:d.materialSlot??0,particles:d.lastParticles??null,
  trail:d.trailData??null,matrices:(d.pool??[d.mesh]).filter(m=>m.visible).map(m=>Array.from(m.matrixWorld.elements))}));

test('original cage enters strict playback with native parent, child and both trail materials',native,async()=>{
  const lib=library(original),before=structuredClone(original.pack),cam=camera();
  try {
    const i=await lib.create(ROOT);assert.deepEqual(i.blocked,[]);assert.equal(i.draws.length,19);
    const p=i.draws.find(d=>d.particleId===PARENT),c=i.draws.find(d=>d.particleId===CHILD);
    const trail=i.draws.find(d=>d.sourceEntry===p&&d.materialSlot===1);
    assert.ok(p&&c&&trail);assert.equal(i.parentMotion.parentReady(PARENT),true);
    i.update(0,{camera:cam,clip:CLIP});i.group.updateMatrixWorld(true);
    assert.ok(p.lastParticles.some(p=>p.birthTime<0));assert.ok(c.lastParticles.some(p=>p.parentBirthTime<0));
    const zero=structuredClone(state(i));
    let trailFrames=0;
    for(const time of [.25,.5333333333,1,2,4,6]) {
      i.update(time,{camera:cam,clip:CLIP});i.group.updateMatrixWorld(true);
      assert.ok(c.lastParticles.length);if(trail.trailData.indices.length)trailFrames++;
      for(const d of [p,c])for(const part of d.pool)assert.ok(part.matrixWorld.elements.every(Number.isFinite));
    }
    assert.ok(trailFrames>0);
    i.update(0,{camera:cam,clip:CLIP});i.group.updateMatrixWorld(true);assert.deepEqual(state(i),zero);
    assert.deepEqual(original.pack,before);i.dispose();assert.equal(lib.instanceCount,0);
  }finally{lib.dispose();}
});

for(const [name,mutate]of [
  ['unsupported arc mode',s=>s.ShapeModule.arc.mode=1],
  ['invalid spread',s=>s.ShapeModule.arc.spread=NaN],
  ['delayed prewarm',s=>s.startDelay.scalar=1],
  ['unsupported child inheritance',s=>s.SubModule.subEmitters[0].properties=1],
])test(`changed cage ${name} cannot admit an orphan child or a partial strict effect`,native,async()=>{
  const source=structuredClone(original);mutate(source.pack.records[PARENT].data);const lib=library(source);
  try {
    await assert.rejects(lib.create(ROOT));assert.equal(lib.instanceCount,0);
    // Invalid graph contracts reject construction altogether; valid graphs with
    // unsupported parent physics can still be inspected without child dispatch.
    if(name==='unsupported child inheritance')return;
    const i=await lib.create(ROOT,{allowBlocked:true});
    assert.equal(i.parentMotion.parentReady(PARENT),false);
    assert.ok(i.blocked.some(b=>/parent dispatch/.test(b.reason)));
    assert.equal(i.draws.some(d=>d.particleId===CHILD),false);i.dispose();
  }finally{lib.dispose();}
});
