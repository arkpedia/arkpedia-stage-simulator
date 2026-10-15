// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import clocks from '../data/arkpedia-snhunt-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/snhunt-clocks.mjs';
let original=false;try{await access(new URL('../.cache/arkpedia/cn-operators/char_4211_snhunt/front.skel',import.meta.url));original=true;}catch{}
test('additive original clocks retain float32 precision and do not approve compiled/native frame parity',()=>{
 assert.equal(clocks.enabledOperators.length,0);assert.equal(clocks.frameParity,false);
 for(const m of Object.values(clocks.models)){
  assert.equal(m.exactDurations.Attack_Begin,.1666666716337204);
  assert.equal(m.exactDurations.Attack_Loop,1.600000023841858);
 }
});
test('original unrounded clocks reproduce from bound skeleton bytes; malformed skeleton or receipt is rejected',{skip:!original&&'Optional original-source cache not installed'},async()=>{
 assert.deepEqual(await recoverClocks(),clocks);
 for(const suffix of['front.skel','back.skel','char_4211_snhunt.json'])await assert.rejects(()=>recoverClocks({read:async path=>{
  const raw=await readFile(path);if(path.pathname.endsWith(suffix)){const altered=Buffer.from(raw);altered[altered.length-1]^=1;return altered;}return raw;
 }}));
});
