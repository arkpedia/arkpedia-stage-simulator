// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseSkel} from '../assets/skel.mjs';
import {pathToFileURL} from 'node:url';
import {recoverOriginalClocks} from './original-clocks.mjs';
const id='char_4230_mcnist',output=new URL('../../data/arkpedia-mcnist-clocks.json',import.meta.url);
export async function recoverClocks({read=readFile}={}){
 const receipt=new URL(`../../data/arkpedia-native-operators/${id}.json`,import.meta.url),cache=new URL(`../../.cache/arkpedia/cn-operators/${id}/`,import.meta.url);
 const owner=await recoverOriginalClocks({id,read,receipt,cache,sha256:'951f971e410a0ddea6b08424363a07627bb398d1efbe2d8971b90cdd3dd88317'});
 const e=JSON.parse(await read(receipt)),token='token_10069_mcnist_mcgraf',models={};
 for(const face of['Front','Back']){
  const binding=e.officialSkeletonBindings[token][face],raw=await read(new URL(`tokens/${token}/${face.toLowerCase()}.skel`,cache));
  assert.equal(raw.length,binding.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),binding.sha256);
  const legacy=parseSkel(raw,undefined,{includeEventPayloads:true}),exact=parseSkel(raw,undefined,{includeEventPayloads:true,includeExactDurations:true});
  assert.deepEqual(exact.durations,e.models[token][face].durations);assert.deepEqual(exact.eventPayloads,e.models[token][face].eventPayloads);
  const{exactDurations,...unchanged}=exact;assert.deepEqual(unchanged,legacy);models[face]={sha256:binding.sha256,bytes:binding.bytes,exactDurations};
 }
 return{...owner,tokens:{[token]:{models}}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const bytes=JSON.stringify(await recoverClocks(),null,2)+'\n';
 if(process.argv.includes('--write'))await writeFile(output,bytes);else assert.equal(await readFile(output,'utf8'),bytes);
 console.log('Mechanist owner and McGraf original exact animation clocks verified; source receipt and default parser unchanged.');
}
