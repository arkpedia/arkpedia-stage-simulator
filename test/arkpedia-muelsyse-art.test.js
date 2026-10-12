// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import art from '../data/arkpedia-muelsyse-device-art.json' with { type: 'json' };
import foundation from '../data/arkpedia-muelsyse-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
const ID = 'char_249_mlyss', TOKEN = 'token_10030_mlyss_wtrman', m = art.models[TOKEN];

test('Flowing Shape artwork is separate from playable combat and native shader approval', () => {
  assert.equal(art.owner, ID); assert.equal(art.artworkOnly, true);
  assert.deepEqual(art.enabledOperators, []); assert.equal(data.operators[ID], undefined);
  for (const k of ['frameParity', 'nativeParticleSupport', 'nativeShaderParity']) assert.equal(art[k], false);
  assert.equal(art.foundation.sha256, createHash('sha256').update(readFileSync(new URL('../data/arkpedia-muelsyse-prefabs.json', import.meta.url))).digest('hex'));
});

test('single original skeleton preserves source aliases, three forms and static recovery', () => {
  assert.deepEqual(Object.keys(art.models), [TOKEN]); assert.equal(m.facings, undefined);
  assert.deepEqual(m.nativeAnimationBindings, foundation.officialTokenSkeletonBindings[TOKEN].animationAliases);
  assert.deepEqual(m.durations, foundation.tokenModels[TOKEN].Single.durations);
  assert.deepEqual(m.eventPayloads, foundation.tokenModels[TOKEN].Single.eventPayloads);
  assert.deepEqual(m.animationRoles, { idle: 'Idle_1', deploy: 'Start', die: 'Die', attack: 'Attack', skill: null });
  assert.equal(m.nativeAnimationAliases.Idle, undefined); assert.equal(m.nativeAnimationAliases.ReBorn, 'Start');
  for (const clip of ['A_Attack', 'A_Combat', 'B_Attack', 'B_Attack_2', 'B_Combat']) assert.equal(m.durations[clip], .8);
  for (const clip of ['A_Start', 'B_Start', 'A_Idle', 'B_Idle']) assert.equal(m.durations[clip], 1);
  assert.equal(m.durations.Idle_2, 0); assert.equal(m.durations.Default, 0);
  assert.equal(m.durations.Change_A, .667); assert.equal(m.durations.Change_B, .667);
});

test('delivered texture metadata uses the actual separate-alpha native material', () => {
  assert.deepEqual(m.textureDimensions, [512, 512]); assert.equal(m.spineVersion, '3.8.99');
  assert.equal(m.materialFloats._UseAlphaTex, 1); assert.equal(m.materialFloats._StraightAlphaInput, 0);
  assert.equal(m.originalPathIds.rgbTexturePathId, '-3152131553628916044');
  assert.equal(m.originalPathIds.alphaTexturePathId, '-5105136353530260667');
  assert.equal(m.originalPathIds.materialPathId, '-3323982459809044147');
  assert.equal(art.avatarSource.commit, foundation.source.modelCommit);
  assert.match(art.sourceBundle.transforms[0], /RGB clamped to alpha/);
});

test('native attack events preserve the ranged repeat and ordinary form clocks', () => {
  assert.deepEqual(m.eventPayloads.B_Attack_2.filter(e => e.name === 'OnAttack').map(e => e.time),
    [.30000001192092896, .3333333432674408]);
  for (const clip of ['Attack', 'A_Attack', 'B_Attack']) {
    assert.deepEqual(m.eventPayloads[clip], foundation.tokenModels[TOKEN].Single.eventPayloads[clip]);
    assert.equal(m.eventPayloads[clip].filter(e => e.name === 'OnAttack').length, 1);
  }
});
