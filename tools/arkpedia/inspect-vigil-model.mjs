// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, writeFile } from 'node:fs/promises';
import { parseSkel } from '../assets/skel.mjs';
import { atlasInfo } from '../assets/atlas.mjs';
const root = new URL('../../.cache/arkpedia/vigil-source/wolfpack-art/',import.meta.url);
const path = new URL('sources.json',root), source = JSON.parse(await readFile(path,'utf8'));
const id='token_10028_vigil_wolf',record=source.models[id];
const skel=await readFile(new URL(`${record.directory}/${id}.skel`,root));
const atlas=await readFile(new URL(`${record.directory}/${id}.atlas`,root),'utf8');
const parsed=parseSkel(skel,atlasInfo(atlas).regions,{includeEventPayloads:true});
if(parsed.missingRegions.length)throw Error('Wolfpack atlas has missing regions');
Object.assign(record,{spineVersion:parsed.version,durations:parsed.durations,hits:parsed.hits,
  eventPayloads:parsed.eventPayloads,bounds:parsed.bounds,
  animationRoles:{idle:'Idle_1',deploy:'Start',die:'Die',attack:'Attack'}});
await writeFile(path,`${JSON.stringify(source,null,2)}\n`);
console.log(`Verified original Wolfpack Spine ${parsed.version} roles and attack events`);
