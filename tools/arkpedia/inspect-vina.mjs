// SPDX-License-Identifier: GPL-3.0-or-later
// Inspect every pinned original Vina Victoria attack/skill event and facing clip.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseSkel } from '../assets/skel.mjs';
import { atlasInfo } from '../assets/atlas.mjs';
const id = 'char_1019_siege2';
const commit = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd';
const checkout = fileURLToPath(new URL('../../../arkpedia-sd-assets/.cache/arknights-resource/', import.meta.url));
const output = new URL('../../.cache/arkpedia/vina-source/', import.meta.url);
const models = { [id]: { commit } };
for (const face of ['Front', 'Back']) {
  const stem = `spine/${id}/${id}/${face}/${id}`;
  const skel = execFileSync('git', ['-C', checkout, 'show', `${commit}:${stem}.skel`], { maxBuffer: 16 * 1024 * 1024 });
  const atlas = execFileSync('git', ['-C', checkout, 'show', `${commit}:${stem}.atlas`], { encoding: 'utf8' });
  const parsed = parseSkel(skel, atlasInfo(atlas).regions, { includeEventPayloads: true });
  if (parsed.missingRegions.length) throw Error(`${face} missing attachments: ${parsed.missingRegions}`);
  models[id][face] = { path: `${stem}.skel`, sha256: createHash('sha256').update(skel).digest('hex'),
    bytes: skel.length, durations: parsed.durations, hits: parsed.hits, eventPayloads: parsed.eventPayloads };
  console.log(face, JSON.stringify({ hits: parsed.hits, durations: parsed.durations }));
}
await mkdir(output, { recursive: true });
await writeFile(new URL('models.json', output), `${JSON.stringify(models, null, 2)}\n`);
const sourceFile = new URL('golden-vows/sources.json', output);
const source = JSON.parse(await readFile(sourceFile, 'utf8'));
const token = 'token_10040_siege2_vlion', record = source.models[token];
const skel = await readFile(new URL(`golden-vows/front/${token}.skel`, output));
const atlas = await readFile(new URL(`golden-vows/front/${token}.atlas`, output), 'utf8');
const parsed = parseSkel(skel, atlasInfo(atlas).regions, { includeEventPayloads: true });
if (parsed.missingRegions.length) throw Error('Golden Vows has missing attachments');
Object.assign(record, { spineVersion: parsed.version, durations: parsed.durations,
  hits: parsed.hits, eventPayloads: parsed.eventPayloads, bounds: parsed.bounds,
  animationRoles: { idle: 'Idle', deploy: 'Start', die: 'Die_1', attack: 'Attack' } });
await writeFile(sourceFile, `${JSON.stringify(source, null, 2)}\n`);
console.log('Golden Vows', JSON.stringify({ hits: parsed.hits, durations: parsed.durations }));
