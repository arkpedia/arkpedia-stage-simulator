// SPDX-License-Identifier: GPL-3.0-or-later
// Inspect every pinned original Pozëmka attack/skill event and facing clip.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseSkel } from '../assets/skel.mjs';
import { atlasInfo } from '../assets/atlas.mjs';
const id = 'char_4055_bgsnow';
const commit = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd';
const checkout = fileURLToPath(new URL('../../../arkpedia-sd-assets/.cache/arknights-resource/', import.meta.url));
const output = new URL('../../.cache/arkpedia/pozemka-source/', import.meta.url);
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

const sourceFile = new URL('typewriter/sources.json', output);
const source = JSON.parse(await readFile(sourceFile, 'utf8'));
const token = 'token_10026_bgsnow_subbow';
for (const [face, record] of Object.entries(source.models[token].facings)) {
 const skel = await readFile(new URL(`typewriter/${face}/${token}.skel`,output));
 const atlas = await readFile(new URL(`typewriter/${face}/${token}.atlas`,output),'utf8');
 const parsed=parseSkel(skel,atlasInfo(atlas).regions,{includeEventPayloads:true});
 if(parsed.missingRegions.length)throw Error(`Typewriter ${face} missing attachments`);
 Object.assign(record,{spineVersion:parsed.version,durations:parsed.durations,hits:parsed.hits,
  eventPayloads:parsed.eventPayloads,bounds:parsed.bounds,
  animationRoles:{idle:'Idle',deploy:'Start',die:'Idle',attack:'Attack'}});
 console.log('Typewriter '+face,JSON.stringify({hits:parsed.hits,durations:parsed.durations}));
}
await writeFile(sourceFile,`${JSON.stringify(source,null,2)}\n`);
