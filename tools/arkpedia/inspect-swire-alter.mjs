// SPDX-License-Identifier: GPL-3.0-or-later
// Inspect every pinned original Swire the Elegant Wit attack/skill event and facing clip.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseSkel } from '../assets/skel.mjs';
import { atlasInfo } from '../assets/atlas.mjs';
const id = 'char_1033_swire2';
const commit = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd';
const checkout = fileURLToPath(new URL('../../../arkpedia-sd-assets/.cache/arknights-resource/', import.meta.url));
const output = new URL('../../.cache/arkpedia/swire-alter-source/', import.meta.url);
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

const token = 'token_10031_swire2_gdtrap';
const dir = new URL('champagne/', output);
const source = JSON.parse(await readFile(new URL('sources.json',dir),'utf8'));
const parsedModels = { [token]: {} };
for (const face of ['front','back']) {
  const skel=await readFile(new URL(`${face}/${token}.skel`,dir));
  const atlas=await readFile(new URL(`${face}/${token}.atlas`,dir),'utf8');
  const p=parseSkel(skel,atlasInfo(atlas).regions,{includeEventPayloads:true});
  if(p.missingRegions.length)throw Error(`Champagne Bomb ${face} missing attachments`);
  parsedModels[token][face]={sha256:createHash('sha256').update(skel).digest('hex'),bytes:skel.length,
    durations:p.durations,hits:p.hits,eventPayloads:p.eventPayloads};
  Object.assign(source.models[token].facings[face],{spineVersion:p.version,durations:p.durations,hits:p.hits,bounds:p.bounds,
    animationRoles:{idle:'Idle',deploy:'Start',die:Object.hasOwn(p.durations,'Die')?'Die':null,attack:'Attack'}});
  console.log('Champagne Bomb '+face,JSON.stringify({hits:p.hits,durations:p.durations}));
}
await writeFile(new URL('models.json',dir),JSON.stringify(parsedModels,null,2)+'\n');
await writeFile(new URL('sources.json',dir),JSON.stringify(source,null,2)+'\n');
