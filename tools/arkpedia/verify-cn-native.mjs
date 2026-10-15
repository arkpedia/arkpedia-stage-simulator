#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Independent native-input verification. Does not import the plan/fetch generator.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root = new URL('../../', import.meta.url), cache = new URL('.cache/arkpedia/cn-native-source/', root);
const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
const jsonHash = value => hash('sha256', JSON.stringify(value));
const read = async p => JSON.parse(await readFile(new URL(p, root)));
const value = flag => { const n = process.argv.indexOf(flag); return n < 0 ? null : process.argv[n + 1]; };
const explicit = value('--receipt');
if (process.argv.indexOf('--receipt') >= 0 && !explicit) throw Error('--receipt needs a saved file');
const receipt = JSON.parse(await readFile(explicit ? pathToFileURL(explicit) : new URL('data/arkpedia-cn-native-source.json', root)));
const pin = receipt.source;
assert.equal(pin.repository, 'Kengxxiao/ArknightsGameData');
assert.equal(pin.commit, 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');
assert.equal(pin.clientVersion, '2.7.71'); assert.equal(pin.resourceVersion, '26-09-22-07-47-20_6c71fa');
const base = 'https://ak.hycdn.cn/assetbundle/official/Android/assets/26-09-22-07-47-20_6c71fa/';
assert.equal(pin.baseURL, base); assert.equal(pin.manifestURL, base + 'hot_update_list.json');
assert.equal(pin.manifestBytes, 3241788);
assert.equal(pin.manifestSha256, 'd1ac02a61d98e6e4c772335bb85dc44da4794a0a8bc915354b6f9ffbc7ec1f35');
const raw = await readFile(new URL('hot_update_list.json', cache)), hot = JSON.parse(raw);
assert.equal(raw.length, pin.manifestBytes); assert.equal(hash('sha256', raw), pin.manifestSha256);
assert.equal(hot.versionId, pin.resourceVersion); assert.equal(hot.manifestName, pin.manifestName);
assert.equal(hot.manifestVersion, pin.manifestVersion);
assert.equal(new Set(hot.abInfos.map(r => r.name)).size, hot.abInfos.length);
const cnBytes = await readFile(new URL('data/arkpedia-cn-source.json', root)), cn = JSON.parse(cnBytes);
assert.equal(hash('sha256', cnBytes), pin.preparedTableSha256); assert.deepEqual(pin.tableSource, cn.source);
const roster = await read('data/arkpedia-roster-target.json'); assert.equal(cn.source.commit, roster.source.commit);
assert.equal(cn.source.commit, pin.commit); assert.equal(cn.globalSource.commit, pin.globalAlternateForms.commit);
const patchBytes = await readFile(new URL('.cache/arkpedia/char_patch_table.json', root)), patch = JSON.parse(patchBytes);
assert.equal(hash('sha256', patchBytes), pin.globalAlternateForms.sha256);
assert.deepEqual(pin.globalAlternateForms.formIds.slice().sort(), Object.keys(patch.patchChars).sort());
const expectedIds = Object.keys(cn.tables.characters).filter(id => !patch.patchChars[id]).sort();
assert.deepEqual(Object.keys(receipt.operators).sort(), expectedIds);
assert.deepEqual(receipt.enabledOperators, []);
for (const k of ['frameParity', 'nativeParticleSupport', 'moduleSupport', 'graphClosureVerified', 'animationBindingsVerified'])
  assert.equal(receipt[k], false, 'Native input receipt cannot approve ' + k);
const paths = new Set(['battle/prefabs/[uc]skills.ab', 'battle/prefabs/[uc]projectiles.ab', 'config/buff_template_holder.ab']);
const skillIds = new Set(); let ranks = 0;
for (const id of expectedIds) {
  const c = cn.tables.characters[id], out = receipt.operators[id], target = roster.operators.find(row => row.id === id);
  assert.deepEqual(c.skills.map(s => s.skillId), target.skills);
  assert.equal(out.sourceName, c.name); assert.equal(out.appellation, c.appellation);
  assert.equal(out.rarity, c.rarity); assert.equal(out.archetype, c.subProfessionId);
  assert.equal(out.sourceCharacterSha256, jsonHash(c));
  assert.deepEqual(out.bundles, [`charpack/${id}.ab`, `chararts/${id}.ab`]);
  for (const p of out.bundles) paths.add(p);
  assert.deepEqual(out.skills.map(s => s.id), c.skills.map(s => s.skillId));
  for (const s of out.skills) {
    const table = cn.tables.skills[s.id]; assert.equal(s.ranks, 10); assert.equal(table.levels.length, 10);
    assert.equal(s.sha256, jsonHash(table));
    assert.deepEqual(s.prefabIds, [...new Set(table.levels.map(row => row.prefabId))].sort());
    skillIds.add(s.id); ranks += s.ranks;
  }
}
const groups = hot.abInfos.filter(r => /^pkgrps\/btl_pfb_tokens_[0-9]+\.ab$/.test(r.name));
assert.ok(groups.length); for (const r of groups) paths.add(r.name);
assert.deepEqual(receipt.bundles.map(r => r.path), [...paths].sort());
let totalBytes = 0;
for (const r of receipt.bundles) {
  const original = hot.abInfos.find(x => x.name === r.path); assert.ok(original);
  assert.equal(r.bytes, original.abSize); assert.equal(r.md5, original.md5);
  const filename = r.path.replaceAll('/', '_').replace(/\.ab$/, '.dat');
  assert.equal(r.archive, filename); assert.equal(r.url, base + encodeURIComponent(filename));
  assert.match(r.sha256, /^[a-f0-9]{64}$/); totalBytes += r.bytes;
}
assert.deepEqual(receipt.summary, { operatorForms: expectedIds.length, skills: skillIds.size, skillRanks: ranks,
  bundles: paths.size, bytes: totalBytes, tokenGroups: groups.length });
// Recheck the original complete source Git blobs, independently of the generator.
execFileSync(process.execPath, [fileURLToPath(new URL('tools/arkpedia/verify-cn-source.mjs', root))], { stdio: 'pipe' });
for (const r of receipt.bundles) {
  const bytes = await readFile(new URL('bundles/' + r.path, cache));
  assert.equal(bytes.length, r.bytes, r.path); assert.equal(hash('md5', bytes), r.md5, r.path);
  assert.equal(hash('sha256', bytes), r.sha256, r.path);
  assert.equal(bytes.subarray(0, 8).toString('ascii'), 'UnityFS\0', r.path);
}
console.log(`Verified ${expectedIds.length} CN owner/artwork pairs, ${skillIds.size} selected skills / ${ranks} ranks, ${paths.size} original bundle checksums (${totalBytes} bytes); no gameplay or rendering approval`);
