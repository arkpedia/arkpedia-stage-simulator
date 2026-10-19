// SPDX-License-Identifier: GPL-3.0-or-later
// Build an isolated held snapshot; never writes the normal roster or snapshot.
import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {compileReviewedOperators} from './operator-source.mjs';
import {writeJSONAtomic} from './write-json.mjs';
import {APHRISSA_REVIEW_ID as ID, APHRISSA_REVIEW_OPERATOR} from '../../shared/arkpedia/aphrissa-review-operator.js';
const TOKEN = 'token_10070_aphris_pc', SD = '27341cba520c7612eb874d1b0f946715b95498d6';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const load = async path => JSON.parse(await readFile(new URL('../../'+path, import.meta.url)));
export async function aphrissaReviewData(normal, manifest) {
  assert.ok(!normal.operators[ID] && !normal.reviewCandidates, 'Require the normal published snapshot');
  const raw = await readFile(new URL('../../data/arkpedia-native-operators/'+ID+'.json', import.meta.url));
  assert.equal(sha(raw), '77207d3d44737940e6bc4aee4a4a57abea27a1490d3870168e9f1615527ca254');
  const e = JSON.parse(raw), art = await load('data/arkpedia-aphrissa-art.json'),
    tokenArt = await load('data/arkpedia-aphrissa-token-art.json'), avatar = await load('data/arkpedia-aphrissa-token-avatar.json'),
    ui = await load('data/arkpedia-aphrissa-interface-art.json');
  const op = compileReviewedOperators({registry: {[ID]: APHRISSA_REVIEW_OPERATOR}, cn: {
    characters: {[ID]: e.tables.character}, skills: e.tables.skills, ranges: e.tables.ranges}})[ID];
  assert.equal(e.source.commit, normal.sources['Kengxxiao/ArknightsGameData']);
  for (const proof of [art,tokenArt,avatar,ui]) {
    assert.deepEqual(proof.enabledOperators, []); assert.equal(proof.artworkOnly,true); assert.equal(proof.frameParity,false);
  }
  const d = structuredClone(normal); d.reviewCandidates = [ID]; d.operators[ID] = op; d.operatorSourceChannels[ID] = 'cn';
  const files = model => [model.skeleton, model.atlas, ...model.textures];
  for (const face of ['front', 'back']) {
    const key = `operator/${ID}/default/${face}`, model = manifest.models[key], proof = art.ownerModels[face];
    assert.ok(model, 'Missing original Aphrissa model');
    assert.deepEqual({skeleton:model.skeleton,atlas:model.atlas,textures:model.textures}, proof.files);
    assert.deepEqual(model.source, proof.source);
    for (const [field, value] of Object.entries(proof.metadata)) assert.deepEqual(model[field], value, field);
    d.sd.models[key] = model;
    const tokenKey = `operator/${TOKEN}/default/${face}`, t = manifest.models[tokenKey], p = tokenArt.models[TOKEN];
    assert.equal(t.source.facingAlias, 'single-original-model');
    assert.equal(t.premultipliedAlpha, true);
    assert.deepEqual(t.animations, p.durations); assert.deepEqual(t.animationRoles, p.animationRoles);
    assert.equal(t.spineVersion,p.spineVersion); assert.deepEqual(t.hits,p.hits); assert.deepEqual(t.bounds,p.bounds);
    for (const f of files(t)) {const bound = p.files[f.path.split('/').at(-1)]; assert.equal(f.sha256, bound.sha256); assert.equal(f.bytes, bound.bytes);}
    assert.equal(t.avatar.sha256, avatar.avatar.sha256); assert.equal(t.avatar.bytes, avatar.avatar.bytes);
    d.sd.models[tokenKey] = t;
  }
  d.sd.commit = SD;
  const c = e.tables.tokens[TOKEN], grid = candidate => candidate.rangeId
    ? {...candidate, rangeGrid: e.tables.ranges[candidate.rangeId].grids.map(p => [p.row,p.col])} : candidate;
  d.tokens[TOKEN] = {id: TOKEN, name: c.appellation, profession: c.profession,
    subProfessionId: c.subProfessionId, position: c.position,
    phases: c.phases.map(p => ({maxLevel: p.maxLevel, attributesKeyFrames: p.attributesKeyFrames,
      rangeGrid: e.tables.ranges[p.rangeId].grids.map(p => [p.row,p.col])})),
    trait: c.trait ? {...c.trait, candidates: c.trait.candidates.map(grid)} : null,
    talents: c.talents.map(t => ({...t,candidates:t.candidates.map(grid)})),
    skills: c.skills.map(s => ({id: s.skillId, unlockCondition: s.unlockCond, levels: []})),
    avatar: `https://raw.githubusercontent.com/arkpedia/arkpedia-sd-assets/${SD}/${manifest.models[`operator/${TOKEN}/default/front`].avatar.path}`};
  const bindings = d.interfaceAssets['arkpedia/arkpedia-image-assets'];
  for (const f of ui.files) {assert.equal(f.allDecodedRGBAEqual, true); bindings[f.path] = {commit: ui.assetCommit, bytes:f.bytes, sha256:f.sha256};}
  return d;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const normal = await load('data/arkpedia-mvp.json'), manifest = JSON.parse(execFileSync('git', ['show', SD+':manifest.json'],
    {cwd: new URL('../../../arkpedia-sd-assets/',import.meta.url),encoding:'utf8',maxBuffer:16*1024*1024}));
  const data = await aphrissaReviewData(normal, manifest), cache = new URL('../../.cache/arkpedia/', import.meta.url);
  await mkdir(cache, {recursive:true}); await writeJSONAtomic(new URL('arkpedia-aphrissa-candidate.json',cache),data);
  console.log(JSON.stringify({heldReviewOnly:true,operators:Object.keys(data.operators).length,models:Object.keys(data.sd.models).length,output:'.cache/arkpedia/arkpedia-aphrissa-candidate.json'}));
}
