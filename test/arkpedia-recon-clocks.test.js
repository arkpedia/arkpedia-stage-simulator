// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import e from '../data/arkpedia-native-operators/char_4215_buddy.json' with {type:'json'};
import clocks from '../data/arkpedia-recon-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/recon-clocks.mjs';
test('Exact Recon and Single Palamute clocks retain native identities, original aliases and no public approval',()=>{assert.equal(clocks.operator,e.operatorId);assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);assert.deepEqual(Object.keys(clocks.models),['Front','Back']);assert.deepEqual(Object.keys(clocks.tokens.token_10063_buddy_bddg.models),['Single']);for(const face of['Front','Back']){assert.equal(clocks.models[face].sha256,e.officialSkeletonBindings[e.operatorId][face].sha256);assert.equal(Math.round(clocks.models[face].exactDurations.Attack_A*1000)/1000,e.models[e.operatorId][face].durations.Attack_A);}const m=clocks.tokens.token_10063_buddy_bddg.models.Single;assert.equal(m.sha256,e.officialSkeletonBindings.token_10063_buddy_bddg.Single.sha256);assert.equal(m.exactDurations.Start,1);assert.equal(m.exactDurations.Born,undefined);});
test('Original cached Recon/Palamute bytes reproduce exact clocks while default parser metadata is unchanged',{skip:!existsSync(new URL('../.cache/arkpedia/cn-operators/char_4215_buddy/front.skel',import.meta.url))},async()=>assert.deepEqual(await recoverClocks(),clocks));
