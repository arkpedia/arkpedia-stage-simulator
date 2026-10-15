// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import art from '../data/arkpedia-closur-device-art.json' with { type: 'json' };
import native from '../data/arkpedia-native-operators/char_4228_closur.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
const owner = 'char_4228_closur', token = 'token_10066_closur_ourbase';

test('Closure art retains the exact CN bundle identity and cannot imply playable or native-renderer approval', () => {
  assert.equal(art.owner, owner); assert.equal(art.artworkOnly, true); assert.deepEqual(art.enabledOperators, []);
  for (const k of ['frameParity', 'nativeParticleSupport', 'nativeShaderParity']) assert.equal(art[k], false);
  const b = native.source.bundles.find(r => r.path === art.sourceBundle.path);
  for (const k of ['path', 'bytes', 'md5', 'sha256', 'url']) assert.equal(art.sourceBundle[k], b[k]);
  assert.equal(art.sourceBundle.client, 'cn'); assert.equal(art.sourceBundle.resourceVersion, native.source.nativeClient);
  assert.deepEqual(Object.keys(art.models), [token]); assert.equal(data.operators[owner], undefined);
  assert.deepEqual(native.enabledOperators, []);
});

test('command-center facings keep exact source pointers and events without fabricated attacks, Stun or Back Die', () => {
  for (const face of ['Front', 'Back']) {
    const r = art.models[token].facings[face.toLowerCase()], n = native.officialSkeletonBindings[token][face];
    for (const [k, v] of Object.entries(n).filter(([k]) => k.endsWith('PathId'))) assert.equal(r.originalPathIds[k], v);
    assert.ok(Object.values(r.originalPathIds).every(v => typeof v === 'string' && /^-?[1-9]\d*$/.test(v)));
    for (const k of ['durations', 'hits', 'eventPayloads']) assert.deepEqual(r[k], native.models[token][face][k]);
    assert.equal(r.animationRoles.attack, null); assert.equal(r.animationRoles.die, face === 'Front' ? 'Die' : null);
    assert.equal(r.durations.Attack, undefined); assert.equal(r.durations.Stun, undefined);
    assert.deepEqual(r.missingOptionalAliases, face === 'Front' ? [] : ['Die']);
    assert.equal(r.eventPayloads.Start[0].time, .4000000059604645);
  }
  assert.notEqual(art.models[token].facings.front.files[token + '.skel'].sha256,
    art.models[token].facings.back.files[token + '.skel'].sha256);
});

test('owner metadata enriches native continuous fire and PMA without rebinding its original files', () => {
  for (const face of ['Front', 'Back']) {
    const r = art.ownerModels[face.toLowerCase()], n = native.models[owner][face];
    assert.equal(r.files.skeleton.sha256, n.sha256); assert.equal(r.metadata.premultipliedAlpha, true);
    assert.equal(r.materialFloats._StraightAlphaInput, 0); assert.equal(r.source.commit, art.avatarSource.commit);
    assert.deepEqual(r.metadata.animations, n.durations); assert.deepEqual(r.metadata.hits, n.hits);
    assert.deepEqual(r.metadata.animationRoles.attack, { begin: 'Attack_Begin', loop: 'Attack_Loop', end: null });
    assert.equal(r.metadata.animationRoles.die, face === 'Front' ? 'Die' : null);
  }
});
