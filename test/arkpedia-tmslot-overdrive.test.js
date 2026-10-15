// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import receipt from '../data/arkpedia-tmslot-overdrive-source.json' with {type:'json'};
import {recoverTimeslotOverdrive} from '../tools/arkpedia/tmslot-overdrive.mjs';
let original=false;try{await access(new URL('../.cache/arkpedia/cn-operators/char_4236_tmslot/gamedata_const.json',import.meta.url));original=true;}catch{}
test('Timeslot retains the original two-bar, halfway-effect term and explicit local accounting limits',()=>{
 assert.equal(receipt.source.commit,'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');assert.equal(receipt.source.gitBlob,'ab3b249f3116650c630859104c97f18289fb1a54');
 assert.equal(receipt.term.description,'技能持续拥有两段计量槽，技能进行到一半时触发额外效果');assert.equal(receipt.frameParity,false);assert.deepEqual(receipt.enabledOperators,[]);
 assert.match(receipt.mapping,/explicit local mappings/);
});
test('Timeslot overdrive term reproduces from independently pinned bytes and rejects altered native inputs',{skip:!original&&'Optional original-source term cache not installed'},async()=>{
 assert.deepEqual(await recoverTimeslotOverdrive(),receipt);
 for(const mutate of[b=>Buffer.concat([b,Buffer.from(' ')]),b=>{b[b.length-1]^=1;return b;}])await assert.rejects(()=>recoverTimeslotOverdrive({read:async p=>mutate(Buffer.from(await readFile(p)))}));
});
