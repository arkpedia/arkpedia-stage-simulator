// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import shaders from '../data/arkpedia-tragodia-effect-shaders.json' with {type:'json'};
import lappland from '../data/arkpedia-lappland-effect-shaders.json' with {type:'json'};
import effects from '../data/arkpedia-tragodia-effects.json' with {type:'json'};
import mvp from '../data/arkpedia-mvp.json' with {type:'json'};

test('Tragodia shader recovery retains three additional shader types and five exact shared originals',()=>{
  const shared=Object.keys(shaders.shaders).filter(key=>Object.hasOwn(lappland.shaders,key));
  assert.equal(shared.length,5);
  for(const key of shared)assert.deepEqual(shaders.shaders[key],lappland.shaders[key]);
  const additional=Object.keys(shaders.shaders).filter(key=>!Object.hasOwn(lappland.shaders,key));
  assert.deepEqual(additional.map(key=>shaders.shaders[key].name).sort(),[
    'Torappu/Particles/Dissolve/Dissolve(CustomData)',
    'Torappu/Particles/Ram/AlphaBlend',
    'Torappu/Particles/ZDistort/Disturb(CustomData)']);
  assert.deepEqual(additional.map(key=>Object.keys(shaders.shaders[key].programs).length).sort(),[2,3,4]);
});
test('all shader receipts stay tied to the original effects bundle and GLES programs',()=>{
  assert.equal(shaders.operator,effects.operator);assert.equal(shaders.version,effects.version);
  assert.deepEqual(shaders.sourceBundle,effects.sources.find(s=>s.path==='[uc]shaders.ab'));
  assert.deepEqual(shaders.counts,{shaders:8,programs:22});
  const programs=Object.values(shaders.shaders).flatMap(s=>Object.values(s.programs));
  assert.equal(programs.length,22);
  for(const program of programs){
    assert.equal(program.gpuProgramType,4);
    assert.ok(program.sourceBytes>0);
    assert.match(program.sourceSha256,/^[0-9a-f]{64}$/);
    assert.match(program.entrySha256,/^[0-9a-f]{64}$/);
  }
});
test('source shader recovery does not enable an incomplete Tragodia renderer or kit',()=>{
  assert.deepEqual(shaders.scope,{nativeSourceOnly:true,rendererVerified:false,
    compiledFrameParity:false,enabledOperators:[]});
  assert.equal(mvp.operators[shaders.operator],undefined);
  assert.equal(Object.keys(effects.unresolvedReferences).length,4);
});
