// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readPinnedEffectBytes,loadTragodiaStageEffects} from '../public/arkpedia/tragodia-assets.js';
const raw=Buffer.from('{"original":"unchanged"}'),entry={path:'receipts/effects.json',bytes:raw.length,
 sha256:createHash('sha256').update(raw).digest('hex')};
test('native delivery reads exact pinned bytes and rejects failed or changed responses',async()=>{
 const calls=[],fetcher=async url=>{calls.push(url);return new Response(raw);};
 assert.deepEqual(Buffer.from(await readPinnedEffectBytes('/immutable/',entry,fetcher)),raw);
 assert.deepEqual(calls,['/immutable/receipts/effects.json']);
 await assert.rejects(readPinnedEffectBytes('/immutable/',entry,async()=>new Response('Unavailable',{status:503})),/unavailable/);
 await assert.rejects(readPinnedEffectBytes('/immutable/',entry,async()=>new Response('changed')),/Changed original/);
 const altered=Buffer.from(raw);altered[2]^=1;
 await assert.rejects(readPinnedEffectBytes('/immutable/',entry,async()=>new Response(altered)),/Changed original/);
});
test('invalid effect references reject before a network request',async()=>{
 const fetcher=()=>{throw Error('Unexpected request');};
 for(const change of [{path:'../effects.json'},{path:'/effects.json'},{path:'textures/../../other.webp'},
  {path:'https://elsewhere/effects.json'},{bytes:0},{bytes:Infinity},{sha256:'main'}])
  await assert.rejects(readPinnedEffectBytes('/immutable/',{...entry,...change},fetcher),/Invalid native effect file reference/);
});
test('public cage delivery requires the approved immutable asset descriptor',async()=>{
 for(const descriptor of [{},{repository:'elsewhere/assets',commit:'a'.repeat(40)},
  {repository:'arkpedia/arkpedia-sd-assets',commit:'main'},
  {repository:'arkpedia/arkpedia-sd-assets',commit:'a'.repeat(40),manifest:entry}])
  await assert.rejects(loadTragodiaStageEffects({descriptor}),/Unreviewed cage asset delivery/);
});
