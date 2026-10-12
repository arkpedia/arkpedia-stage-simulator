// SPDX-License-Identifier: GPL-3.0-or-later
// Verify the receipt against a pinned original, including malformed fixtures.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = new URL('../../', import.meta.url);
const tool = fileURLToPath(new URL('tools/arkpedia/muelsyse-copy-source.mjs', root));
const directory = new URL('.cache/arkpedia/muelsyse-source/copy-negative-fixtures/', root);
await mkdir(directory, { recursive: true });
const paths = ['data/arkpedia-muelsyse-copy-source.json', 'data/arkpedia-muelsyse-prefabs.json'];
const hashes = async () => Promise.all(paths.map(async p => createHash('sha256').update(await readFile(new URL(p, root))).digest('hex')));
const invoke = args => spawnSync(process.execPath, [tool, ...args], { cwd: fileURLToPath(root), encoding: 'utf8' });
const before = await hashes(), reproduced = invoke([]);
assert.equal(reproduced.status, 0, reproduced.stderr);
assert.deepEqual(await hashes(), before, 'Re-extraction changed the donor receipt or native foundation');
const source = JSON.parse(await readFile(new URL(paths[0], root)));
const fixture = async (name, data) => {
  const path = fileURLToPath(new URL(`${name}.json`, directory));
  await writeFile(path, JSON.stringify(data));
  return invoke(['--verify', path]);
};
const control = await fixture('control', source);
assert.equal(control.status, 0, control.stderr);
console.log('Accepted original control and byte-identical re-extraction');
const changes = [
  ['repository', d => { d.source.repository = 'example/other'; }],
  ['commit', d => { d.source.commit = '0'.repeat(40); }],
  ['git-path', d => { d.source.gitBlob.path = 'other.json'; }],
  ['git-sha', d => { d.source.gitBlob.sha = '0'.repeat(40); }],
  ['git-size', d => { d.source.gitBlob.size--; }],
  ['original-hash', d => { d.source.sha256 = '0'.repeat(64); }],
  ['foundation-hash', d => { d.source.foundationSha256 = '0'.repeat(64); }],
  ['healer-damage', d => { d.subProfessionDamageTypePairs.physician = 'MAGICAL'; }],
  ['craftsman-damage', d => { d.subProfessionDamageTypePairs.craftsman = 'MAGICAL'; }],
  ['missing-phalanx', d => { delete d.subProfessionDamageTypePairs.phalanx; }],
  ['invented-subprofession', d => { d.subProfessionDamageTypePairs.invented = 'PHYSICAL'; }],
  ['public-approval', d => { d.enabledOperators.push('char_249_mlyss'); }],
  ['frame-parity', d => { d.frameParity = true; }],
  ['module-support', d => { d.moduleSupport = true; }],
  ['schema-version', d => { d.schemaVersion = 2; }],
];
for (const [name, change] of changes) {
  const altered = structuredClone(source); change(altered);
  const result = await fixture(name, altered);
  assert.notEqual(result.status, 0, `Accepted altered fixture: ${name}`);
  assert.match(result.stderr, /Donor metadata differs from original pinned constants/);
  console.log(`Rejected ${name}`);
}
assert.deepEqual(await hashes(), before);
console.log(`Rejected ${changes.length} altered donor metadata fixtures`);
