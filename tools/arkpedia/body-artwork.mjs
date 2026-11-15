// SPDX-License-Identifier: GPL-3.0-or-later
// Add exact single-body artwork from an immutable shared SD release. Existing models
// and all combat data are preserved; one ID is a valid independent addition.
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {resolve,posix} from 'node:path';
import {parseSkel} from '../assets/skel.mjs';
import {atlasInfo} from '../assets/atlas.mjs';
import {writeJSONAtomic} from './write-json.mjs';
import {buildOperatorLibrary,publishOperatorLibrary} from './operator-library.mjs';
const run=promisify(execFile),sha=/^[a-f0-9]{40}$/;
export const bodyArtworkScope=kind=>`Shared original ${kind} body artwork; combat support, alternate forms, effects and frame/pixel parity are reviewed separately.`;
const bodyKind=kind=>{if(!['enemy','device'].includes(kind))throw Error('Unsupported body artwork kind');return kind==='enemy'?/^enemy_\w+$/:/^trap_\w+$/;};

const bodyIdentity=model=>{
  const {assetsCommit,assetAlias,...body}=model;
  const identity=file=>{const {path,...rest}=file;return rest;};
  return {...body,skeleton:identity(body.skeleton),atlas:identity(body.atlas),textures:body.textures.map(identity)};
};
export function mergeBodyArtwork(models,registry,{reuseFiles=false,kind='enemy'}={}) {
  const idPattern=bodyKind(kind);
  if(registry.schemaVersion!==1||!registry.models||Array.isArray(registry.models))throw Error(`Invalid ${kind} artwork registry`);
  const merged={...models};
  for(const [key,model] of Object.entries(registry.models)) {
    if(model.kind!==kind||!idPattern.test(model.id)||model.variant!=='default'||model.facing!=='default'
      ||key!==`${kind}/${model.id}/default/default`||!sha.test(model.assetsCommit??'')
      ||!/^3\.8\.\d+$/.test(model.spineVersion)||model.premultipliedAlpha!==true
      ||typeof model.animationRoles?.idle!=='string'||!Object.hasOwn(model.animations??{},model.animationRoles.idle))
      throw Error(`Unreviewed ${kind} artwork: ${key}`);
    if(merged[key]&&!isDeepStrictEqual(merged[key],model)
      && !(reuseFiles&&typeof model.assetAlias==='string'&&isDeepStrictEqual(bodyIdentity(merged[key]),bodyIdentity(model))))
      throw Error('Existing artwork differs: '+key);
    merged[key]=model;
  }
  return merged;
}

export async function prepareBodyArtwork({assetRoot,commit,ids,reuseFiles=false,kind='enemy',registry={schemaVersion:1,scope:bodyArtworkScope(kind),models:{}}}) {
  const idPattern=bodyKind(kind);
  if(!sha.test(commit??''))throw Error(`${kind} artwork requires a full immutable commit`);
  if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!idPattern.test(id)))
    throw Error(`Expected unique explicit ${kind} IDs`);
  const git=async args=>(await run('git',args,{cwd:assetRoot,encoding:'buffer',maxBuffer:32*1024*1024})).stdout;
  const manifest=JSON.parse(await git(['show',`${commit}:manifest.json`]));
  const additions={};
  for(const id of ids) {
    const key=`${kind}/${id}/default/default`,model=manifest.models[key];
    if(!model)throw Error(`Missing shared ${kind} artwork: ${id}`);
    const candidate={...model,assetsCommit:commit};
    mergeBodyArtwork({}, {schemaVersion:1,models:{[key]:candidate}},{kind});
    const files=new Map();
    for(const file of [model.skeleton,model.atlas,...model.textures]) {
      if(!file||!/^models\/(enemy|device)\/[\w./-]+\.(skel|atlas|png)$/.test(file.path)||!file.path.startsWith(`models/${kind}/`)
        ||file.path.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Invalid shared model file: '+id);
      const bytes=await git(['show',`${commit}:${file.path}`]);
      if(bytes.length!==file.bytes||createHash('sha256').update(bytes).digest('hex')!==file.sha256)
        throw Error('Changed shared model file: '+file.path);
      files.set(file.path,bytes);
    }
    const atlas=atlasInfo(files.get(model.atlas.path).toString('utf8'));
    const pages=atlas.pages.map(page=>posix.join(posix.dirname(model.atlas.path),page)).sort();
    if(!isDeepStrictEqual(pages,model.textures.map(file=>file.path).sort()))throw Error('Incomplete shared atlas pages: '+id);
    const parsed=parseSkel(files.get(model.skeleton.path),atlas.regions,{includeExactDurations:true});
    if(parsed.version!==model.spineVersion||parsed.missingRegions.length||!isDeepStrictEqual(parsed.durations,model.animations))
      throw Error('Changed shared animation metadata: '+id);
    const previous=registry.models[key];
    additions[key]=previous&&isDeepStrictEqual({...previous,assetsCommit:commit},candidate)?previous:candidate;
  }
  return {...registry,models:mergeBodyArtwork(registry.models,{schemaVersion:1,models:additions},{reuseFiles,kind})};
}

/** Publish the lazy client's model graph as part of the same content addition.
 * Build first; a rejected snapshot must not change either registry. */
export async function publishBodyArtwork(snapshot, registry, destination, {kind='enemy'}={}) {
  bodyKind(kind);
  const library = buildOperatorLibrary(snapshot);
  await writeJSONAtomic(resolve(destination,`data/arkpedia-${kind}-artwork.json`),registry);
  await writeJSONAtomic(resolve(destination,'data/arkpedia-mvp.json'),snapshot);
  await publishOperatorLibrary(library,destination);
}

