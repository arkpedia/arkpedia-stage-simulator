#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Independent comparison against complete cached Git blobs; does not use the generator.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const evidence = await read('../../data/arkpedia-cn-source.json');
const roster = await read('../../data/arkpedia-roster-target.json');
const tree = await read('../../.cache/arkpedia/cn-coverage/table-tree.json');
assert.equal(evidence.source.repository, roster.source.repository);
assert.equal(evidence.source.commit, roster.source.commit);
assert.equal(tree.sha, roster.source.commit);
assert.equal(tree.truncated, false);
const raw = {};
for (const row of evidence.source.tables) {
  const name = row.path.split('/').at(-1);
  const bytes = await readFile(new URL(`../../.cache/arkpedia/cn-coverage/${name}`, import.meta.url));
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(blob, row.gitBlob);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
  assert.equal(bytes.length, row.bytes);
  assert.equal(tree.tree.find(r => r.path === row.path)?.sha, blob);
  const targetRow = roster.source.tables.find(r => r.path === row.path);
  if (targetRow) assert.equal(targetRow.sha256, row.sha256);
  raw[name] = JSON.parse(bytes);
}
const globalBytes = await readFile(new URL('../../.cache/arkpedia/character_table.json', import.meta.url));
assert.equal(createHash('sha256').update(globalBytes).digest('hex'), evidence.globalSource.characterTableSha256);
const global = JSON.parse(globalBytes);
const expected = roster.operators.filter(row => !global[row.id]).map(row => row.id);
assert.deepEqual(Object.keys(evidence.tables.characters), expected);
const complete = { ...raw['character_table.json'], ...raw['char_patch_table.json'].patchChars };
const skillIds = new Set(), rangeIds = new Set();
for (const id of expected) {
  const c = complete[id];
  assert.deepEqual(evidence.tables.characters[id], c, id);
  for (const s of c.skills) {
    skillIds.add(s.skillId);
    for (const rank of raw['skill_table.json'][s.skillId].levels) if (rank.rangeId) rangeIds.add(rank.rangeId);
  }
  for (const p of c.phases) rangeIds.add(p.rangeId);
  for (const t of [...(c.trait?.candidates ?? []), ...c.talents.flatMap(t => t.candidates ?? [])])
    if (t.rangeId) rangeIds.add(t.rangeId);
}
assert.deepEqual(new Set(Object.keys(evidence.tables.skills)), skillIds);
assert.deepEqual(new Set(Object.keys(evidence.tables.ranges)), rangeIds);
for (const id of skillIds) assert.deepEqual(evidence.tables.skills[id], raw['skill_table.json'][id], id);
for (const id of rangeIds) assert.deepEqual(evidence.tables.ranges[id], raw['range_table.json'][id], id);
assert.deepEqual(evidence.enabledOperators, []);
assert.equal(evidence.summary.operatorForms, expected.length);
assert.equal(evidence.summary.skills, skillIds.size);
assert.equal(evidence.summary.skillRanks, [...skillIds].reduce((n, id) => n + raw['skill_table.json'][id].levels.length, 0));
console.log(`Verified ${expected.length} forms, ${skillIds.size} skills, ${evidence.summary.skillRanks} ranks and four pinned CN Git blobs`);
