// SPDX-License-Identifier: GPL-3.0-or-later
// Additive clocks: never rewrite the immutable original receipt or default parser output.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseSkel } from '../assets/skel.mjs';
const id='char_4211_snhunt';
const receipt=new URL(`../../data/arkpedia-native-operators/${id}.json`,import.meta.url);
const cache=new URL(`../../.cache/arkpedia/cn-operators/${id}/`,import.meta.url);
const output=new URL('../../data/arkpedia-snhunt-clocks.json',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function recoverClocks({read=readFile}={}){
 const bytes=await read(receipt),e=JSON.parse(bytes);
 assert.equal(hash(bytes),'37d0ab829cd389fe71eb180e858aa6d82bb43bea0f34bec1a70658ba361d95dd');
 const models={};
 for(const face of ['Front','Back']){
  const binding=e.officialSkeletonBindings[id][face],raw=await read(new URL(`${face.toLowerCase()}.skel`,cache));
  assert.equal(raw.length,binding.bytes);assert.equal(hash(raw),binding.sha256);
  const legacy=parseSkel(raw,undefined,{includeEventPayloads:true});
  const exact=parseSkel(raw,undefined,{includeEventPayloads:true,includeExactDurations:true});
  assert.deepEqual(exact.durations,e.models[id][face].durations);
  assert.deepEqual(exact.eventPayloads,e.models[id][face].eventPayloads);
  const {exactDurations,...unchanged}=exact;assert.deepEqual(unchanged,legacy);
  models[face]={sha256:binding.sha256,bytes:binding.bytes,exactDurations};
 }
 return {operator:id,receiptSha256:hash(bytes),models,enabledOperators:[],frameParity:false,
  scope:'Unrounded Spine animation durations only; compiled action clocks, reload fallback and game frame parity remain unverified.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const actual=JSON.stringify(await recoverClocks(),null,2)+'\n';
 if(process.argv.includes('--write'))await writeFile(output,actual);else assert.equal(await readFile(output,'utf8'),actual);
 console.log('Snow Hunter exact original animation clocks verified; default parser and source receipt unchanged.');
}
