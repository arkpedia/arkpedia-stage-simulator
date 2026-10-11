// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, writeFile } from 'node:fs/promises';
import { parseSkel } from '../assets/skel.mjs';
import { atlasInfo } from '../assets/atlas.mjs';
const root = new URL('../../.cache/arkpedia/ray-source/sandbeast-art/',import.meta.url);
const path = new URL('sources.json',root), source = JSON.parse(await readFile(path,'utf8'));
const id='token_10034_ray_sndbst',record=source.models[id];
const skel=await readFile(new URL(`${record.directory}/${id}.skel`,root));
const atlas=await readFile(new URL(`${record.directory}/${id}.atlas`,root),'utf8');
const parsed=parseSkel(skel,atlasInfo(atlas).regions,{includeEventPayloads:true});
if(parsed.missingRegions.length)throw Error('Sandbeast atlas has missing regions');
Object.assign(record,{spineVersion:parsed.version,durations:parsed.durations,hits:parsed.hits,
  eventPayloads:parsed.eventPayloads,bounds:parsed.bounds,
  animationRoles:{idle:'Idle',deploy:'Start',die:'Idle'}});
await writeFile(path,`${JSON.stringify(source,null,2)}\n`);
console.log(`Verified original Sandbeast Spine ${parsed.version} roles and attack events`);
