// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const foundationBytes = await readFile(new URL('../data/arkpedia-magallan-prefabs.json', import.meta.url));
const source = JSON.parse(foundationBytes);
const art = JSON.parse(await readFile(new URL('../data/arkpedia-magallan-drone-art.json', import.meta.url)));
test('Magallan artwork is bound to the verified foundation without enabling a public operator', () => {
  assert.equal(art.foundation.sha256, createHash('sha256').update(foundationBytes).digest('hex'));
  assert.equal(art.owner, 'char_248_mgllan');
  assert.equal(art.artworkOnly, true);
  assert.deepEqual(art.enabledOperators, []);
  for (const key of ['frameParity', 'nativeShaderParity', 'nativeParticleSupport']) assert.equal(art[key], false);
  const bundle = source.source.bundles.find(b => b.path === art.sourceBundle.path);
  assert.equal(art.sourceBundle.sha256, bundle.sha256);
  assert.equal(art.sourceBundle.md5, bundle.md5);
  assert.equal(art.sourceBundle.bytes, bundle.size);
  assert.deepEqual(Object.keys(art.models), Object.keys(source.officialTokenSkeletonBindings));
});
for (let n = 1; n <= 3; n++) test(`drone ${n} artwork preserves complete original aliases and source events`, () => {
  const id = `token_10005_mgllan_drone${n}`;
  const r = art.models[id], binding = source.officialTokenSkeletonBindings[id], original = source.tokenModels[id];
  assert.equal(r.files[id + '.skel'].sha256, binding.sha256);
  assert.equal(r.files[id + '.skel'].bytes, binding.byteLength);
  for (const [key, value] of Object.entries(binding).filter(([k]) => k.endsWith('PathId'))) assert.equal(r.originalPathIds[key], value);
  assert.deepEqual(r.nativeAnimationBindings, binding.animationAliases);
  assert.deepEqual(r.durations, original.durations);
  assert.deepEqual(r.hits, original.hits);
  assert.deepEqual(r.eventPayloads, original.eventPayloads);
  assert.equal(r.materialFloats._UseAlphaTex, 1);
  assert.deepEqual(r.textureDimensions, [128, 128]);
  assert.equal(r.animationRoles.die, 'Idle');
  assert.equal(r.animationRoles.attack, n === 1 ? null : 'Attack');
  assert.equal(r.animationRoles.skill, null);
});
