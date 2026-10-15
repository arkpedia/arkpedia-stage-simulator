// SPDX-License-Identifier: GPL-3.0-or-later
// Durable source receipt checks; independent pixels/mesh closure is audited from
// original bytes by verify-tragodia-effects.py, not inferred from this manifest.
import test from 'node:test';
import assert from 'node:assert/strict';
import art from '../data/arkpedia-tragodia-effects.json' with {type: 'json'};
import source from '../data/arkpedia-tragodia-prefabs.json' with {type: 'json'};
import mvp from '../data/arkpedia-mvp.json' with {type: 'json'};
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
const ID = 'char_1042_phatm2', bundle = 'battle/prefabs/effects/phatm2.ab';
const sha = value => assert.match(value, /^[a-f0-9]{64}$/);

test('all thirty kit effect names bind original roots, alongside back-facing and range inputs', () => {
  const names = new Set();
  function walk(value) {
    if (typeof value === 'string' && /^phatm2_(?:birth|attack|hit|token|skill_[0-9]+)_\w+$/.test(value)) names.add(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  }
  walk(source);
  assert.equal(names.size, 30);
  for (const name of names) assert.ok(art.roots[name], 'Missing original effect: ' + name);
  assert.deepEqual(Object.keys(art.roots).filter(n => !names.has(n)).sort(),
    ['phatm2_attack_start_01_back', 'phatm2_attack_start_02_back', 'phatm2_range_01']);
  assert.equal(new Set(Object.values(art.roots)).size, 33);
  for (const [name, root] of Object.entries(art.roots)) {
    assert.match(name, /^phatm2_\w+$/);
    assert.ok(root.startsWith(bundle + ':'));
    assert.match(root.slice(bundle.length + 1), /^-?\d+$/);
  }
  assert.equal(art.roots.phatm2_skill_03_prison_01, bundle + ':-1098253074569815829');
});

test('source effect recovery does not publish Tragodia or claim a rendered cage', () => {
  assert.equal(art.schemaVersion, 1);
  assert.equal(art.operator, ID);
  assert.deepEqual(art.scope.enabledOperators, []);
  assert.equal(art.scope.sourceInputsOnly, true);
  assert.equal(art.scope.rendererVerified, false);
  assert.equal(art.scope.compiledFrameParity, false);
  assert.equal(art.scope.pending.length, 3);
  assert.deepEqual(source.enabledOperators, []);
  assert.deepEqual(source.heldOperators, [ID]);
  assert.equal(REGULAR_OPERATORS[ID].mechanic, 'tragodia');
  assert.ok(mvp.operators[ID]);
  const cage = source.officialTokenSkeletonBindings.token_10055_phatm2_mndclv;
  assert.equal(cage.renderingKind, 'effect-only');
  assert.deepEqual(source.tokenModels.token_10055_phatm2_mndclv, {});
});

test('effect inputs retain original cage/skill geometry, particles and nine animation clips', () => {
  assert.deepEqual(art.counts, {AnimationClip: 9, Animator: 6, AnimatorController: 6,
    GameObject: 421, Material: 91, Mesh: 32, MeshCollider: 7, MeshFilter: 34,
    MeshRenderer: 34, MonoBehaviour: 61, ParticleSystem: 321,
    ParticleSystemRenderer: 321, Shader: 8, Texture2D: 72, Transform: 421});
  assert.equal(Object.values(art.counts).reduce((a, b) => a + b, 0), 1844);
  assert.equal(art.pack.path, 'native-effects.bin');
  assert.equal(art.pack.encoding, 'gzip-json');
  assert.ok(art.pack.bytes > 0 && art.pack.decodedBytes > art.pack.bytes);
  sha(art.pack.sha256); sha(art.pack.decodedSha256);
});

test('lossless texture receipts preserve all seventy-two distinct source RGBA identities', () => {
  assert.equal(Object.keys(art.textures).length, 72);
  assert.equal(new Set(Object.values(art.textures).map(t => t.path)).size, 72);
  for (const [key, texture] of Object.entries(art.textures)) {
    assert.match(key, /\.ab:-?\d+$/);
    assert.match(texture.path, /^textures\/[a-f0-9]{24}\.webp$/);
    assert.ok(Number.isInteger(texture.bytes) && texture.bytes > 0);
    assert.ok(Number.isInteger(texture.width) && texture.width > 0);
    assert.ok(Number.isInteger(texture.height) && texture.height > 0);
    sha(texture.sha256); sha(texture.pixelSha256);
  }
});

test('four missing resources remain explicit, including native cage dependencies', () => {
  assert.equal(Object.keys(art.unresolvedReferences).length, 4);
  const bundles = new Set(art.sources.map(s => s.path));
  let count = 0;
  for (const [key, entry] of Object.entries(art.unresolvedReferences)) {
    assert.equal(key, entry.foreignFile + ':' + entry.pathId);
    assert.match(entry.pathId, /^-?\d+$/);
    assert.ok(entry.references.length > 0);
    for (const ref of entry.references) {
      const separator = ref.record.lastIndexOf(':');
      assert.ok(bundles.has(ref.record.slice(0, separator)));
      assert.match(ref.record.slice(separator + 1), /^-?\d+$/);
      assert.ok(['m_Mesh', 'm_Materials', 'm_Texture'].includes(ref.field)); count++;
    }
  }
  assert.equal(count, 67);
  const builtin = art.unresolvedReferences['Library/unity default resources:10210'];
  assert.equal(builtin.references.length, 13);
  assert.ok(builtin.references.some(r => r.record === bundle + ':-924797961247844117'));
  assert.ok(builtin.references.some(r => r.record === bundle + ':615332410207049963'));
});

test('every bundle stays tied to the original frozen client manifest', () => {
  assert.equal(art.version, '26-09-23-17-49-43_b9cc4a');
  assert.equal(art.version, source.source.nativeClient);
  assert.equal(art.sources.length, 23);
  assert.equal(new Set(art.sources.map(s => s.path)).size, 23);
  const main = art.sources.find(s => s.path === bundle);
  assert.equal(main.bytes, 720267);
  assert.equal(main.md5, 'e2b7e7a235aeda5d3c71abaa142390cd');
  for (const entry of art.sources) {
    sha(entry.sha256); assert.match(entry.md5, /^[a-f0-9]{32}$/);
    assert.ok(Number.isInteger(entry.bytes) && entry.bytes > 0);
  }
});
