// SPDX-License-Identifier: GPL-3.0-or-later
// Inspect every pinned original Ray and default Sandbeast attack/skill event and facing clip.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseSkel } from '../assets/skel.mjs';
import { atlasInfo } from '../assets/atlas.mjs';
const id = 'char_4117_ray';
const commit = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd';
const checkout = fileURLToPath(new URL('../../../arkpedia-sd-assets/.cache/arknights-resource/', import.meta.url));
const output = new URL('../../.cache/arkpedia/ray-source/', import.meta.url);
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
const token = 'token_10034_ray_sndbst';
const skel = await readFile(new URL(`sandbeast/${token}.skel`, output));
const atlas = await readFile(new URL(`sandbeast/${token}.atlas`, output), 'utf8');
const parsed = parseSkel(skel, atlasInfo(atlas).regions, { includeEventPayloads: true });
if (parsed.missingRegions.length) throw Error(`Sandbeast missing attachments: ${parsed.missingRegions}`);
models[token] = { Original: { bundle: 'pkgrps/btl_pfb_tokens_0.ab', sha256: createHash('sha256').update(skel).digest('hex'),
  bytes: skel.length, atlasSha256: createHash('sha256').update(atlas).digest('hex'),
  durations: parsed.durations, hits: parsed.hits, eventPayloads: parsed.eventPayloads } };
console.log('Sandbeast', JSON.stringify({ hits: parsed.hits, durations: parsed.durations }));
await writeFile(new URL('models.json', output), `${JSON.stringify(models, null, 2)}\n`);
