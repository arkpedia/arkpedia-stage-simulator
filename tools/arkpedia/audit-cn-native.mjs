#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Reproduce the saved receipt and reject altered source/approval claims.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = new URL('../../', import.meta.url), cache = new URL('.cache/arkpedia/cn-native-source/audits/', root);
await mkdir(cache, { recursive: true });
const output = new URL('data/arkpedia-cn-native-source.json', root), before = await readFile(output);
execFileSync(process.execPath, [fileURLToPath(new URL('tools/arkpedia/cn-native-source.mjs', root))], { stdio: 'pipe' });
assert.equal(Buffer.compare(before, await readFile(output)), 0, 'Cached original bundle receipt did not reproduce');
const verify = fileURLToPath(new URL('tools/arkpedia/verify-cn-native.mjs', root));
execFileSync(process.execPath, [verify], { stdio: 'pipe' });
const receipt = JSON.parse(before);
const fixtures = [
  ['foreign-table-revision', r => { r.source.commit = '0'.repeat(40); }],
  ['moving-resource-version', r => { r.source.resourceVersion = 'latest'; }],
  ['foreign-publisher', r => { r.source.baseURL = 'https://invalid.example/'; }],
  ['changed-manifest-size', r => { r.source.manifestBytes++; }],
  ['changed-manifest-hash', r => { r.source.manifestSha256 = '0'.repeat(64); }],
  ['changed-prepared-table-hash', r => { r.source.preparedTableSha256 = '0'.repeat(64); }],
  ['changed-global-form-exclusion', r => { r.source.globalAlternateForms.formIds.pop(); }],
  ['missing-operator', r => { delete r.operators.char_4051_akkord; }],
  ['extra-operator', r => { r.operators.char_999999_unreviewed = r.operators.char_4051_akkord; }],
  ['missing-skill-rank', r => { r.operators.char_4051_akkord.skills[0].ranks--; }],
  ['changed-character-record', r => { r.operators.char_4051_akkord.sourceCharacterSha256 = '0'.repeat(64); }],
  ['swapped-owner-and-artwork', r => { r.operators.char_4051_akkord.bundles.reverse(); }],
  ['missing-native-bundle', r => { r.bundles.pop(); }],
  ['changed-bundle-md5', r => { r.bundles[0].md5 = '0'.repeat(32); }],
  ['changed-bundle-sha256', r => { r.bundles[0].sha256 = '0'.repeat(64); }],
  ['changed-archive-url', r => { r.bundles[0].url = 'https://invalid.example/other.dat'; }],
  ['changed-total-bytes', r => { r.summary.bytes++; }],
  ['changed-token-group-count', r => { r.summary.tokenGroups--; }],
  ['premature-kit-approval', r => { r.enabledOperators = ['char_4051_akkord']; }],
  ['premature-graph-approval', r => { r.graphClosureVerified = true; }],
  ['premature-animation-binding', r => { r.animationBindingsVerified = true; }],
  ['premature-frame-parity', r => { r.frameParity = true; }],
  ['premature-module-support', r => { r.moduleSupport = true; }],
  ['premature-native-particles', r => { r.nativeParticleSupport = true; }],
];
for (const [name, change] of fixtures) {
  const bad = structuredClone(receipt); change(bad);
  const file = new URL(name + '.json', cache); await writeFile(file, JSON.stringify(bad));
  const result = spawnSync(process.execPath, [verify, '--receipt', fileURLToPath(file)], { encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.notEqual(result.status, null, 'Verifier terminated without a result: ' + name);
  assert.notEqual(result.status, 0, 'Verifier accepted altered evidence: ' + name);
}
console.log(`Reproduced the complete 120-bundle receipt and rejected ${fixtures.length} changed-source/approval fixtures`);
