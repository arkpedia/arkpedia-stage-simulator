// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import art from '../data/arkpedia-mitm-device-art.json' with { type: 'json' };
import source from '../data/arkpedia-mitm-prefabs.json' with { type: 'json' };
const token = 'token_10037_mitm_trshrb', model = art.models[token];

test('Cherry-3 artwork is held separately from public combat and native shader/effect parity', () => {
  assert.equal(art.owner, 'char_4147_mitm'); assert.equal(art.artworkOnly, true);
  assert.deepEqual(art.enabledOperators, []);
  for (const key of ['frameParity', 'nativeParticleSupport', 'nativeShaderParity']) assert.equal(art[key], false);
});

test('Cherry-3 source receipt pins the bundle and the immutable native skeleton chain', async () => {
  const raw = await readFile(new URL('../data/arkpedia-mitm-prefabs.json', import.meta.url));
  assert.equal(art.foundation.sha256, createHash('sha256').update(raw).digest('hex'));
  assert.equal(art.sourceBundle.path, source.officialTokenSkeletonBindings[token].bundle);
  assert.equal(art.sourceBundle.resourceVersion, source.source.nativeClient);
  assert.deepEqual(Object.keys(art.models), [token]);
  const binding = source.officialTokenSkeletonBindings[token];
  assert.equal(model.facings, undefined); assert.equal(model.directory, `${token}/single`);
  for (const key of ['rootPathId', 'controllerPathId', 'animatorPathId', 'faceSwitcherPathId'])
    assert.equal(model.originalPathIds[key], binding[key]);
  for (const [key, value] of Object.entries(binding.facings.Single).filter(([key]) => key.endsWith('PathId')))
    assert.equal(model.originalPathIds[key], value);
  assert.equal(model.files[`${token}.skel`].sha256, binding.facings.Single.sha256);
});

test('literal ReBorn, Idle_1 and zero-duration wreckage/rest clips remain intact', () => {
  assert.deepEqual(model.nativeAnimationBindings, source.officialTokenSkeletonBindings[token].animationAliases);
  assert.equal(model.nativeAnimationAliases.ReBorn, 'Start');
  assert.equal(model.nativeAnimationAliases.Born, undefined);
  assert.equal(model.nativeAnimationAliases.Idle, 'Idle_1');
  assert.equal(model.durations.Idle, undefined);
  for (const clip of ['Waste', 'Idle_2', 'Stun_2', 'Stun_3']) assert.equal(model.durations[clip], 0);
  assert.deepEqual(model.durations, source.tokenModels[token].Single.durations);
  assert.deepEqual(model.eventPayloads, source.tokenModels[token].Single.eventPayloads);
  assert.equal(model.eventPayloads.Attack[0].time, .46666666865348816);
  assert.deepEqual(model.animationRoles, { idle: 'Idle_1', deploy: 'Start', die: 'Die', attack: 'Attack', skill: 'Skill_Loop' });
});

test('embedded-alpha page preserves native material selection instead of inventing split alpha', () => {
  assert.deepEqual(model.textureDimensions, [276, 276]);
  assert.equal(model.materialFloats._UseAlphaTex, 0);
  assert.equal(model.materialFloats._StraightAlphaInput, 0);
  assert.equal(model.originalPathIds.alphaTexturePathId, '0');
  assert.equal(model.originalPathIds.rgbTexturePathId, '2194246625555547790');
  assert.equal(model.spineVersion, '3.8.99');
  assert.equal(art.avatarSource.commit, 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd');
});
