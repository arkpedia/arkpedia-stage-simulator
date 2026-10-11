// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, writeFile } from 'node:fs/promises';
import { parseSkel } from '../assets/skel.mjs';
import { atlasInfo } from '../assets/atlas.mjs';
const id = 'token_10056_angel2_target';
const root = new URL('../../.cache/arkpedia/exusiai-covenant-source/coordinates-art/', import.meta.url);
const metadata = JSON.parse(await readFile(new URL('sources.json', root), 'utf8'));
const record = metadata.models[id];
const parsed = parseSkel(await readFile(new URL(`original/${id}.skel`, root)),
  atlasInfo(await readFile(new URL(`original/${id}.atlas`, root), 'utf8')).regions,
  { includeEventPayloads: true });
if (parsed.missingRegions.length) throw Error(`Missing coordinate attachments: ${parsed.missingRegions}`);
for (const clip of Object.values(record.nativeAnimationAliases)) {
  if (!Object.hasOwn(parsed.durations, clip)) throw Error(`Missing native coordinate clip: ${clip}`);
}
Object.assign(record, { spineVersion: parsed.version, durations: parsed.durations,
  hits: parsed.hits, eventPayloads: parsed.eventPayloads, bounds: parsed.bounds,
  animationRoles: { idle: 'Idle', deploy: 'Start', die: 'Die', attack: null, skill: null } });
await writeFile(new URL('sources.json', root), `${JSON.stringify(metadata, null, 2)}\n`);
await writeFile(new URL('../../data/arkpedia-exusiai-covenant-coordinates-art.json', import.meta.url),
  `${JSON.stringify({ schemaVersion: 1, token: id, artworkOnly: true, enabledOperators: [],
    frameParity: false, nativeParticleSupport: false, nativeShaderParity: false,
    ...metadata }, null, 2)}\n`);
console.log(JSON.stringify({ clips: parsed.durations, hits: parsed.hits, events: parsed.eventPayloads,
  bounds: parsed.bounds, missingRegions: parsed.missingRegions }));
