#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Prepare the missing roster's tables at the existing CN target revision.
// This is source preparation, not combat registration or native asset support.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { compileOperatorRecord } from './operator-source.mjs';
import { writeJSONAtomic } from './write-json.mjs';
const cache = new URL('../../.cache/arkpedia/cn-coverage/', import.meta.url);
const output = new URL('../../data/arkpedia-cn-source.json', import.meta.url);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const gitBlob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const paths = ['character_table', 'char_patch_table', 'skill_table', 'range_table']
  .map(name => `zh_CN/gamedata/excel/${name}.json`);

export function prepareCNSource({ roster, globalCharacters, characters, patchCharacters, skills, ranges, source, globalSource }) {
  const ids = roster.operators.filter(row => !globalCharacters[row.id]).map(row => row.id);
  const selected = {}, selectedSkills = {}, selectedRanges = {};
  const merged = { ...characters, ...patchCharacters };
  for (const id of ids) {
    const c = merged[id], row = roster.operators.find(row => row.id === id);
    if (!c || c.isNotObtainable || ['TOKEN', 'TRAP'].includes(c.profession)
      || JSON.stringify(c.skills.map(s => s.skillId)) !== JSON.stringify(row.skills))
      throw Error(`CN candidate differs from the target roster: ${id}`);
    selected[id] = c;
    for (const s of c.skills) {
      if (!skills[s.skillId]) throw Error(`Missing CN skill: ${id} (${s.skillId})`);
      if (skills[s.skillId].levels?.length !== 10) throw Error(`Incomplete CN skill ranks: ${id} (${s.skillId})`);
      selectedSkills[s.skillId] = skills[s.skillId];
    }
    const rangeIds = [
      ...c.phases.map(p => p.rangeId),
      ...(c.trait?.candidates ?? []).map(t => t.rangeId),
      ...c.talents.flatMap(t => (t.candidates ?? []).map(v => v.rangeId)),
      ...c.skills.flatMap(s => skills[s.skillId].levels.map(l => l.rangeId)),
    ].filter(Boolean);
    for (const rangeId of rangeIds) {
      if (!ranges[rangeId]) throw Error(`Missing CN range: ${id} (${rangeId})`);
      selectedRanges[rangeId] = ranges[rangeId];
    }
    // Validate every phase, talent range and rank through the real battle compiler.
    compileOperatorRecord(id, { characters: merged, skills, ranges });
  }
  return { schemaVersion: 1,
    scope: 'Pinned CN tables for forms absent from the older Global snapshot. No combat kits are enabled by this file.',
    source, globalSource, enabledOperators: [],
    summary: { operatorForms: ids.length, skills: Object.keys(selectedSkills).length,
      skillRanks: Object.values(selectedSkills).reduce((n, s) => n + s.levels.length, 0) },
    tables: { characters: selected, skills: selectedSkills, ranges: selectedRanges } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const roster = JSON.parse(await readFile(new URL('../../data/arkpedia-roster-target.json', import.meta.url), 'utf8'));
  const { repository, commit } = roster.source;
  if (!/^[a-f0-9]{40}$/.test(commit)) throw Error('Missing immutable CN target revision');
  await mkdir(cache, { recursive: true });
  const treeFile = new URL('table-tree.json', cache);
  if (process.argv.includes('--fetch')) {
    const tree = execFileSync('gh', ['api', `repos/${repository}/git/trees/${commit}?recursive=1`],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    await writeFile(treeFile, tree);
    // Fetch only new tables. Existing roster tables must still match their pin.
    for (const path of paths.slice(2)) {
      const r = await fetch(`https://raw.githubusercontent.com/${repository}/${commit}/${path}`,
        { signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw Error(`Pinned CN table unavailable: ${path} (${r.status})`);
      await writeFile(new URL(path.split('/').at(-1), cache), Buffer.from(await r.arrayBuffer()));
    }
  }
  const tree = JSON.parse(await readFile(treeFile, 'utf8'));
  if (tree.truncated || tree.sha !== commit) throw Error('CN Git tree does not match the roster pin');
  const texts = await Promise.all(paths.map(path => readFile(new URL(path.split('/').at(-1), cache))));
  const tables = paths.map((path, i) => {
    const bytes = texts[i], entry = tree.tree.find(row => row.path === path);
    if (entry?.type !== 'blob' || gitBlob(bytes) !== entry.sha || bytes.length !== entry.size)
      throw Error(`CN table differs from pinned Git blob: ${path}`);
    const prior = roster.source.tables.find(row => row.path === path);
    if (prior && prior.sha256 !== sha256(bytes)) throw Error(`CN roster hash mismatch: ${path}`);
    return { path, gitBlob: entry.sha, bytes: bytes.length, sha256: sha256(bytes) };
  });
  const globalBytes = await readFile(new URL('../../.cache/arkpedia/character_table.json', import.meta.url));
  const pins = JSON.parse(await readFile(new URL('../../.cache/arkpedia/pins.json', import.meta.url), 'utf8'));
  const baseline = JSON.parse(await readFile(new URL('../../data/arkpedia-entelechia-prefabs.json', import.meta.url), 'utf8'));
  if (baseline.source.commit !== pins[baseline.source.repository]
    || baseline.source.tableHashes.character_table !== sha256(globalBytes)) throw Error('Global source hash mismatch');
  const [characters, patch, skills, ranges] = texts.map(bytes => JSON.parse(bytes));
  const result = prepareCNSource({ roster, globalCharacters: JSON.parse(globalBytes), characters,
    patchCharacters: patch.patchChars, skills, ranges, source: { repository, commit, tables },
    globalSource: { repository: baseline.source.repository, commit: baseline.source.commit,
      characterTableSha256: sha256(globalBytes) } });
  await writeJSONAtomic(output, result);
  console.log(JSON.stringify(result.summary));
}
