// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import fixtures from './fixtures/arkpedia-tragodia-effect-clips.json' with {type:'json'};
import meta from '../data/arkpedia-tragodia-effect-animations.json' with {type:'json'};
import source from '../data/arkpedia-tragodia-effects.json' with {type:'json'};
import mvp from '../data/arkpedia-mvp.json' with {type:'json'};
import {decodeEffectClip, sampleEffectClip} from '../shared/arkpedia/native-effect-animation.js';
const bundle='battle/prefabs/effects/phatm2.ab:', cage=bundle+'7379801640911501129';

test('all nine original clip fixtures remain bound to the exact effect export and native object digests',()=>{
  const bytes=readFileSync(new URL('./fixtures/arkpedia-tragodia-effect-clips.json',import.meta.url));
  assert.equal(meta.fixture.path,'test/fixtures/arkpedia-tragodia-effect-clips.json');
  assert.equal(bytes.length,meta.fixture.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.fixture.sha256);
  assert.equal(meta.sourcePackSha256,source.pack.sha256);
  assert.deepEqual(Object.keys(fixtures),Object.keys(meta.clips));
  assert.deepEqual(meta.counts,{clips:9,instances:9,bindings:476,channels:476,keys:238});
  assert.equal(meta.clips[cage].name,'phatm2_skill_03_prison_01_animation');
  assert.equal(meta.clips[cage].channels,72);
});

for(const [id,fixture] of Object.entries(fixtures))test(fixture.data.m_Name+' retains its full scalar channels and clamps at the authored end',()=>{
  const before=structuredClone(fixture),clip=decodeEffectClip(fixture.data),row=meta.clips[id];
  assert.equal(fixture.sourceSha256,row.sourceSha256);
  assert.equal(clip.name,row.name);assert.equal(clip.loop,false);
  assert.equal(clip.start,row.start);assert.equal(clip.stop,row.stop);
  assert.equal(clip.bindings.length,row.bindings);assert.equal(clip.channels.length,row.channels);
  assert.equal(clip.channels.reduce((n,c)=>n+(c.keys?.length??0),0),row.keys);
  assert.ok(clip.bindings.every(b=>[23,199].includes(b.typeID)&&b.customType===22&&b.size===1));
  for(const t of [clip.start-.25,clip.start,.25,clip.stop,clip.stop+.25])
    assert.ok(sampleEffectClip(clip,t).every(Number.isFinite));
  assert.deepEqual(sampleEffectClip(clip,clip.start-1),sampleEffectClip(clip,clip.start));
  assert.deepEqual(sampleEffectClip(clip,clip.stop+1),sampleEffectClip(clip,clip.stop));
  assert.deepEqual(sampleEffectClip(clip,clip.stop,{loop:true}),sampleEffectClip(clip,clip.start));
  assert.deepEqual(fixture,before);
});

test('source channels keep the two original missing-path clips explicit without narrowing clip inventory',()=>{
  assert.equal(meta.unresolvedBindings.length,8);
  const expectedClips=[bundle+'-7713096106645049908',bundle+'4789322998410703540'];
  assert.deepEqual([...new Set(meta.unresolvedBindings.map(b=>b.clip))].sort(),expectedClips.sort());
  for(const id of expectedClips){
    const entries=meta.unresolvedBindings.filter(b=>b.clip===id);
    assert.deepEqual(entries.map(b=>b.bindingIndex),[1,5,6,7]);
    for(const entry of entries){
      const binding=decodeEffectClip(fixtures[id].data).bindings[entry.bindingIndex];
      assert.equal(entry.reason,'missing-original-path');
      assert.equal(entry.pathHash,3711244079);assert.equal(entry.pathHash,binding.path);
      assert.equal(entry.typeID,binding.typeID);assert.equal(entry.attribute,binding.attribute);
      assert.equal(entry.animator,bundle+'5425053024947775554');
    }
  }
  assert.ok(meta.unresolvedBindings.every(b=>b.clip!==cage));
});

test('animation recovery preserves source-only scope and does not publish a partial Tragodia kit',()=>{
  assert.equal(meta.operator,'char_1042_phatm2');assert.equal(meta.version,source.version);
  assert.equal(meta.scope.sourceChannelsOnly,true);assert.equal(meta.scope.rendererVerified,false);
  assert.equal(meta.scope.compiledFrameParity,false);assert.deepEqual(meta.scope.enabledOperators,[]);
  assert.equal(meta.scope.pending.length,2);
  assert.equal(mvp.operators[meta.operator],undefined);
  assert.deepEqual(meta.properties,['material._MainColor.a','material._MainColor.b','material._MainColor.g',
    'material._MainColor.r','material._TintColor.a','material._TintColor.b','material._TintColor.g','material._TintColor.r']);
});
test('all twenty-eight distinct secondary material bindings retain their original source slot',()=>{
  assert.equal(meta.materialSlotBindings.length,28);
  const cageBindings=meta.materialSlotBindings.filter(b=>b.clip===cage);
  assert.deepEqual(cageBindings.map(b=>b.bindingIndex),[8,42,43,44]);
  assert.deepEqual(cageBindings.map(b=>b.property),['material._TintColor.a','material._TintColor.r',
    'material._TintColor.g','material._TintColor.b']);
  for(const entry of meta.materialSlotBindings){
    assert.deepEqual(entry.slots,[1]);
    assert.equal(entry.property.startsWith('material.'),true);
    assert.match(entry.component,/\.ab:-?\d+$/);
    const binding=decodeEffectClip(fixtures[entry.clip].data).bindings[entry.bindingIndex];
    assert.equal(binding.customType,22);
    assert.ok([23,199].includes(binding.typeID));
  }
});
