// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseSkel} from '../assets/skel.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function recoverOriginalClocks({id,receipt,cache,sha256,read=readFile}){
 const bytes=await read(receipt),e=JSON.parse(bytes);assert.equal(hash(bytes),sha256);assert.equal(e.operatorId,id);
 const models={};
 for(const face of['Front','Back']){
  const binding=e.officialSkeletonBindings[id][face],raw=await read(new URL(`${face.toLowerCase()}.skel`,cache));
  assert.equal(raw.length,binding.bytes);assert.equal(hash(raw),binding.sha256);
  const legacy=parseSkel(raw,undefined,{includeEventPayloads:true});
  const exact=parseSkel(raw,undefined,{includeEventPayloads:true,includeExactDurations:true});
  assert.deepEqual(exact.durations,e.models[id][face].durations);assert.deepEqual(exact.eventPayloads,e.models[id][face].eventPayloads);
  const{exactDurations,...unchanged}=exact;assert.deepEqual(unchanged,legacy);
  models[face]={sha256:binding.sha256,bytes:binding.bytes,exactDurations};
 }
 return {operator:id,receiptSha256:hash(bytes),models,enabledOperators:[],frameParity:false,
  scope:'Unrounded Spine animation durations only; compiled action clocks, reload fallback and game frame parity remain unverified.'};
}
