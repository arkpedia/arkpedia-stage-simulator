// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, writeFile } from 'node:fs/promises';
import { parseSkel } from '../assets/skel.mjs';
import { atlasInfo } from '../assets/atlas.mjs';
const id = 'char_1037_amiya3', out = new URL('../../.cache/arkpedia/amiya-medic-source/art/', import.meta.url);
const file = new URL('sources.json', out), source = JSON.parse(await readFile(file));
for (const [face, record] of Object.entries(source.models[id].facings)) {
 const parsed = parseSkel(await readFile(new URL(`${face}/${id}.skel`, out)),
  atlasInfo(await readFile(new URL(`${face}/${id}.atlas`, out), 'utf8')).regions, { includeEventPayloads: true });
 if (parsed.missingRegions.length) throw Error(`${face} has missing attachments`);
 Object.assign(record, { spineVersion: parsed.version, durations: parsed.durations, hits: parsed.hits,
  eventPayloads: parsed.eventPayloads, bounds: parsed.bounds, animationRoles: {
   idle: 'Idle', deploy: 'Start', ...(parsed.durations.Die ? { die: 'Die' } : {}),
   attack: 'Attack', skills: ['Skill_1_Attack', 'Skill_2_Attack'] } });
}
await writeFile(file, `${JSON.stringify(source, null, 2)}\n`);
console.log('Parsed both original Medic facing models and skill roles');
