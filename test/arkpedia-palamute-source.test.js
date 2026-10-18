// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-native-operators/char_4215_buddy.json' with {type:'json'};
import {selectedPalamuteBuild as select} from '../server/sim/content/arkpedia-palamute-source.js';
const build=(more={})=>({elite:0,level:30,potential:1,trust:0,skillId:null,skillRank:null,module:'none',...more});
for(let potential=1;potential<=6;potential++)for(const trust of[0,200])test(`Palamute P${potential}/trust ${trust} keeps independent original stats and recovery inputs`,()=>{const r=select(build({potential,trust}));assert.deepEqual([r.stats.maxHp,r.stats.atk,r.stats.def,r.stats.blockCnt,r.stats.cost,r.stats.baseAttackTime],[1095,175,180,0,0,1.25]);assert.equal(r.duration,60);assert.equal(r.interval,60);assert.equal(r.talentBb[2].atk_scale,2);assert.equal(r.talentBb[2].max_target,3);assert.equal(r.talentBb[2].force,0);assert.deepEqual(r.deployment,{slotCost:0,chooseFacing:false,refundRatio:0,limitByHostAttackRange:true});assert.equal(r.skillId,null);});
for(const level of[1,9,17,29])test(`Palamute level ${level} interpolates its own phase without owner trust/potential stats`,()=>{const r=select(build({level,trust:200,potential:6})),[lo,hi]=e.tables.tokens.token_10063_buddy_bddg.phases[0].attributesKeyFrames;for(const key of['maxHp','atk','def'])assert.equal(r.stats[key],Math.round(lo.data[key]+(hi.data[key]-lo.data[key])*(level-1)/29));});
test('Palamute inputs refuse invented active skill/rank, promotion and modules',()=>{for(const more of[{elite:1},{skillId:'invented'},{skillRank:1},{module:'palamute-x'},{level:31}])assert.throws(()=>select(build(more)));});
