// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import art from '../data/arkpedia-stainless-device-art.json' with { type: 'json' };
import source from '../data/arkpedia-stainless-prefabs.json' with { type: 'json' };

test('original device artwork remains artwork-only, separate from public approval and native effects/frame parity', () => {
  assert.equal(art.owner, 'char_4072_ironmn'); assert.equal(art.artworkOnly, true);
  assert.deepEqual(art.enabledOperators, []);
  for (const key of ['frameParity', 'nativeParticleSupport', 'nativeShaderParity']) assert.equal(art[key], false);
});

test('device artwork is bound to the immutable native receipt, bundle and avatar source', async () => {
  const bytes = await readFile(new URL('../data/arkpedia-stainless-prefabs.json', import.meta.url));
  assert.equal(art.foundation.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(art.sourceBundle.path, 'pkgrps/btl_pfb_tokens_0.ab');
  assert.equal(art.sourceBundle.resourceVersion, source.source.nativeClient);
  assert.equal(art.avatarSource.commit, 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd');
  assert.deepEqual(Object.keys(art.models), [1, 2, 3].map(n => `token_10027_ironmn_pile${n}`));
});

test('both platform aliases retain one original skeleton and literal End without invented attack roles', () => {
  for (const n of [1, 2]) {
    const id = `token_10027_ironmn_pile${n}`, r = art.models[id], binding = source.officialTokenSkeletonBindings[id];
    assert.equal(r.facings, undefined); assert.equal(r.directory, `${id}/single`);
    assert.equal(r.originalPathIds.textAssetPathId, binding.facings.Single.textAssetPathId);
    assert.equal(r.files[`${id}.skel`].sha256, binding.facings.Single.sha256);
    assert.deepEqual(r.textureDimensions, [512, 512]);
    assert.deepEqual(r.animationRoles, { idle: 'Idle', deploy: 'Start', die: 'End', attack: null, skill: null });
    assert.deepEqual(r.durations, source.tokenModels[id].Single.durations);
    assert.deepEqual(r.nativeAnimationBindings, binding.animationAliases);
    assert.equal(r.spineVersion, '3.8.99');
  }
});

test('the turret preserves three independent native skeletons despite identical source filenames', () => {
  const id = 'token_10027_ironmn_pile3', faces = art.models[id].facings;
  assert.deepEqual(Object.keys(faces), ['front', 'back', 'down']);
  assert.equal(new Set(Object.values(faces).map(r => r.files[`${id}.skel`].sha256)).size, 3);
  for (const [face, r] of Object.entries(faces)) {
    const binding = source.officialTokenSkeletonBindings[id].facings[face[0].toUpperCase() + face.slice(1)];
    assert.equal(r.directory, `${id}/${face}`);
    assert.equal(r.originalPathIds.textAssetPathId, binding.textAssetPathId);
    assert.equal(r.files[`${id}.skel`].sha256, binding.sha256);
    assert.deepEqual(r.textureDimensions, [256, 256]);
    assert.deepEqual(r.animationRoles, { idle: 'Idle', deploy: 'Start', die: 'Die', attack: 'Attack', skill: null });
    assert.deepEqual(r.durations, source.tokenModels[id][face[0].toUpperCase() + face.slice(1)].durations);
    assert.deepEqual(r.eventPayloads, source.tokenModels[id][face[0].toUpperCase() + face.slice(1)].eventPayloads);
    assert.equal(r.eventPayloads.Attack[0].time, .06666667014360428);
    assert.equal(r.originalPathIds.animatorPathId, source.officialTokenSkeletonBindings[id].animatorPathId);
  }
});
