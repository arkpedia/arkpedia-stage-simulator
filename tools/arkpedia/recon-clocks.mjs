// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {parseSkel} from '../assets/skel.mjs';
import {recoverOriginalClocks} from './original-clocks.mjs';
const id='char_4215_buddy',token='token_10063_buddy_bddg',output=new URL('../../data/arkpedia-recon-clocks.json',import.meta.url);
export async function recoverClocks({read=readFile}={}){
 const receipt=new URL(`../../data/arkpedia-native-operators/${id}.json`,import.meta.url),cache=new URL(`../../.cache/arkpedia/cn-operators/${id}/`,import.meta.url);
 const owner=await recoverOriginalClocks({id,receipt,cache,read,sha256:'6079b999b374af72232b70f30f79fb37b0c121e61797716bb5a63aa0b0259c21'}),e=JSON.parse(await read(receipt)),models={};
 // The native companion has one Single facing. Do not invent Front/Back copies.
 assert.deepEqual(Object.keys(e.officialSkeletonBindings[token]),['Single']);
 for(const [face,binding]of Object.entries(e.officialSkeletonBindings[token])){
  const raw=await read(new URL(`tokens/${token}/${face.toLowerCase()}.skel`,cache));assert.equal(raw.length,binding.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),binding.sha256);
  const legacy=parseSkel(raw,undefined,{includeEventPayloads:true}),exact=parseSkel(raw,undefined,{includeEventPayloads:true,includeExactDurations:true});
  assert.deepEqual(exact.durations,e.models[token][face].durations);assert.deepEqual(exact.eventPayloads,e.models[token][face].eventPayloads);const{exactDurations,...unchanged}=exact;assert.deepEqual(unchanged,legacy);models[face]={sha256:binding.sha256,bytes:binding.bytes,exactDurations};
 }
 return{...owner,tokens:{[token]:{models}}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const bytes=JSON.stringify(await recoverClocks(),null,2)+'\n';if(process.argv.includes('--write'))await writeFile(output,bytes);else assert.equal(await readFile(output,'utf8'),bytes);console.log('Recon and original Single-facing Palamute clocks verified; no playable admission.');}
