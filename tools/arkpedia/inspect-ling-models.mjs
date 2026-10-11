// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSkel } from '../assets/skel.mjs';
import { atlasInfo } from '../assets/atlas.mjs';
const root = new URL('../../.cache/arkpedia/ling-source/dragon-art/', import.meta.url);
const metadata = JSON.parse(await readFile(new URL('sources.json', root), 'utf8'));
const source = JSON.parse(await readFile(new URL('../../data/arkpedia-ling-prefabs.json', import.meta.url), 'utf8'));
for (const [id, record] of Object.entries(metadata.models)) {
  const prefix = record.directory + '/' + id;
  const parsed = parseSkel(await readFile(new URL(prefix + '.skel', root)),
    atlasInfo(await readFile(new URL(prefix + '.atlas', root), 'utf8')).regions,
    { includeEventPayloads: true });
  assert.deepEqual(parsed.missingRegions, []);
  assert.equal(parsed.version, '3.8.99');
  for (const clip of Object.values(record.nativeAnimationAliases)) assert.ok(Object.hasOwn(parsed.durations, clip));
  for (const key of ['durations', 'hits', 'eventPayloads']) assert.deepEqual(parsed[key], source.tokenModels[id][key]);
  const aliases = record.nativeAnimationAliases;
  Object.assign(record, { spineVersion: parsed.version, durations: parsed.durations,
    hits: parsed.hits, eventPayloads: parsed.eventPayloads, bounds: parsed.bounds,
    animationRoles: { idle: aliases.Idle, deploy: aliases.Born, die: aliases.Die,
      attack: aliases.Attack ?? null, skill: aliases.Skill ?? null } });
  console.log(JSON.stringify({ id, clips: parsed.durations, hits: parsed.hits, roles: record.animationRoles }));
}
await writeFile(new URL('sources.json', root), `${JSON.stringify(metadata, null, 2)}\n`);
await writeFile(new URL('../../data/arkpedia-ling-dragon-art.json', import.meta.url),
  `${JSON.stringify({ schemaVersion: 1, owner: 'char_2023_ling', artworkOnly: true, enabledOperators: [],
    frameParity: false, nativeParticleSupport: false, nativeShaderParity: false,
    ...metadata }, null, 2)}\n`);
