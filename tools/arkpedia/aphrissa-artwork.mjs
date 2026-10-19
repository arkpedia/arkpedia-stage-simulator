// SPDX-License-Identifier: GPL-3.0-or-later
// Exact original owner/relay artwork and interface pixels for the normal build.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export const APHRISSA_ID = 'char_4229_aphris', APHRISSA_TOKEN = 'token_10070_aphris_pc';
const load = async path => JSON.parse(await readFile(new URL('../../'+path, import.meta.url)));
const files = model => [model.skeleton, model.atlas, ...model.textures];
// models: SD manifest model records keyed like data.sd.models. Throws on any drift.
export async function verifyAphrissaArtwork(models) {
  const art = await load('data/arkpedia-aphrissa-art.json'), tokenArt = await load('data/arkpedia-aphrissa-token-art.json'),
    avatar = await load('data/arkpedia-aphrissa-token-avatar.json'), ui = await load('data/arkpedia-aphrissa-interface-art.json');
  for (const proof of [art, tokenArt, avatar, ui]) {
    assert.deepEqual(proof.enabledOperators, []); assert.equal(proof.artworkOnly, true); assert.equal(proof.frameParity, false);
  }
  for (const face of ['front', 'back']) {
    const model = models[`operator/${APHRISSA_ID}/default/${face}`], proof = art.ownerModels[face];
    assert.ok(model, 'Missing original Aphrissa model');
    assert.deepEqual({skeleton: model.skeleton, atlas: model.atlas, textures: model.textures}, proof.files);
    assert.deepEqual(model.source, proof.source);
    for (const [field, value] of Object.entries(proof.metadata)) assert.deepEqual(model[field], value, field);
    const t = models[`operator/${APHRISSA_TOKEN}/default/${face}`], p = tokenArt.models[APHRISSA_TOKEN];
    assert.ok(t, 'Missing original Aphrissa relay model');
    assert.equal(t.source.facingAlias, 'single-original-model');
    assert.equal(t.premultipliedAlpha, true);
    assert.deepEqual(t.animations, p.durations); assert.deepEqual(t.animationRoles, p.animationRoles);
    assert.equal(t.spineVersion, p.spineVersion); assert.deepEqual(t.hits, p.hits); assert.deepEqual(t.bounds, p.bounds);
    for (const f of files(t)) {const bound = p.files[f.path.split('/').at(-1)]; assert.equal(f.sha256, bound.sha256); assert.equal(f.bytes, bound.bytes);}
    assert.equal(t.avatar.sha256, avatar.avatar.sha256); assert.equal(t.avatar.bytes, avatar.avatar.bytes);
  }
  for (const f of ui.files) assert.equal(f.allDecodedRGBAEqual, true);
  return {repository: ui.assetRepository, interfaceAssets: Object.fromEntries(ui.files.map(f =>
    [f.path, {commit: ui.assetCommit, bytes: f.bytes, sha256: f.sha256}]))};
}
