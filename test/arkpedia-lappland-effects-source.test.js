// SPDX-License-Identifier: GPL-3.0-or-later
// CI checks the durable source manifest; native byte/pixel/geometry verification
// is performed separately by audit-lappland-effects.py with original bundles.
import test from 'node:test';
import assert from 'node:assert/strict';
import art from '../data/arkpedia-lappland-effects.json' with {type:'json'};
import source from '../data/arkpedia-lappland-alter-prefabs.json' with {type:'json'};
import mvp from '../data/arkpedia-mvp.json' with {type:'json'};
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
const ID='char_1038_whitw2',bundle='battle/prefabs/effects/whitw2.ab';
const sha=v=>assert.match(v,/^[a-f0-9]{64}$/);

test('every native kit effect has an original prefab binding, including all ordinary wolves and S3 cruise',()=>{
  const keys=new Set();
  function walk(v){
    if(typeof v==='string'&&/^whitw2_(?:birth|attack|hit|token|skill_[0-9]+)_\w+$/.test(v))keys.add(v);
    else if(v&&typeof v==='object')for(const x of Object.values(v))walk(x);
  }
  walk(source);
  assert.equal(keys.size,33);
  assert.equal(Object.keys(art.roots).length,35);
  for(const key of keys)assert.ok(art.roots[key],`Missing original kit effect: ${key}`);
  for(const [name,ref] of Object.entries(art.roots)){
    assert.match(name,/^whitw2_\w+$/);
    assert.ok(ref.startsWith(bundle+':'));
    assert.match(ref.slice(bundle.length+1),/^-?\d+$/);
  }
  assert.equal(new Set(Object.values(art.roots)).size,35);
});

test('source artwork remains unavailable until renderer and complete public-kit review',()=>{
  assert.equal(art.operator,ID);
  assert.equal(art.scope.sourceInputsOnly,true);
  assert.equal(art.scope.rendererVerified,false);
  assert.equal(art.scope.compiledFrameParity,false);
  assert.deepEqual(art.scope.enabledOperators,[]);
  assert.equal(art.scope.pending.length,3);
  assert.deepEqual(source.enabledOperators,[]);
  assert.ok(source.heldOperators.includes(ID));
  assert.equal(Object.hasOwn(REGULAR_OPERATORS,ID),false);
  assert.equal(Object.hasOwn(mvp.operators,ID),false);
});

test('source manifest preserves mesh, particle, trail and animation inputs with exact texture identities',()=>{
  assert.equal(art.schemaVersion,1);
  assert.equal(art.counts.GameObject,579);
  assert.equal(art.counts.Transform,579);
  assert.equal(art.counts.Mesh,20);
  assert.equal(art.counts.AnimationClip,10);
  assert.equal(art.counts.AnimatorController,10);
  assert.equal(art.counts.ParticleSystem,382);
  assert.equal(art.counts.ParticleSystemRenderer,382);
  assert.equal(art.counts.TrailRenderer,27);
  assert.equal(art.counts.Texture2D,90);
  assert.equal(Object.keys(art.textures).length,90);
  assert.equal(new Set(Object.values(art.textures).map(t=>t.path)).size,90);
  assert.equal(art.pack.encoding,'gzip-json');
  assert.equal(art.pack.path,'native-effects.bin');
  sha(art.pack.sha256);sha(art.pack.decodedSha256);
  for(const t of Object.values(art.textures)){
    assert.match(t.path,/^textures\/[a-f0-9]{24}\.webp$/);
    assert.ok(Number.isInteger(t.bytes)&&t.bytes>0);
    assert.ok(Number.isInteger(t.width)&&t.width>0);
    assert.ok(Number.isInteger(t.height)&&t.height>0);
    sha(t.sha256);sha(t.pixelSha256);
  }
});

test('foreign and builtin resources remain explicit instead of being replaced or silently omitted',()=>{
  assert.equal(Object.keys(art.unresolvedReferences).length,9);
  let count=0;
  const bundles=new Set(art.sources.map(s=>s.path));
  for(const [key,r] of Object.entries(art.unresolvedReferences)){
    assert.equal(key,r.foreignFile+':'+r.pathId);
    assert.match(r.pathId,/^-?\d+$/);
    assert.ok(r.references.length>0);
    for(const ref of r.references){
      const [name,pathId]=ref.record.split(':');
      assert.ok(bundles.has(name));assert.match(pathId,/^-?\d+$/);assert.ok(ref.field);count++;
    }
  }
  assert.equal(count,190);
  const builtin=art.unresolvedReferences['Library/unity default resources:10210'];
  assert.equal(builtin.references.length,120);
  assert.equal(art.sources.length,23);
  assert.equal(new Set(art.sources.map(s=>s.path)).size,23);
  const original=art.sources.find(s=>s.path===bundle);
  assert.equal(original.bytes,1849081);
  assert.equal(original.md5,'6165c99875777928f2d61498543ce964');
  assert.equal(art.version,'26-09-23-17-49-43_b9cc4a');
  assert.equal(art.version,source.source.nativeClient);
  for(const s of art.sources){sha(s.sha256);assert.match(s.md5,/^[a-f0-9]{32}$/);assert.ok(s.bytes>0);}
});
