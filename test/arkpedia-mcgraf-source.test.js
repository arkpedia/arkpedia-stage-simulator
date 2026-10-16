// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedMcGrafBuild} from '../server/sim/content/arkpedia-mcgraf-source.js';
import {REGULAR_SUMMONS,REGULAR_AUTOMATIC_TOKENS} from '../shared/arkpedia/summons.js';
const build=(more={})=>({elite:2,level:90,skillId:'skchr_mcnist_1',skillRank:10,potential:1,trust:0,module:'none',...more});
for(const elite of[1,2])for(let skill=1;skill<=elite+1;skill++)for(let rank=1;rank<=[4,7,10][elite];rank++)test(`McGraf selects E${elite} S${skill} rank ${rank} source row without inventing absent token levels`,()=>{
 const r=selectedMcGrafBuild(build({elite,level:[50,80,90][elite],skillId:`skchr_mcnist_${skill}`,skillRank:rank}));
 assert.equal(r.skillId,`sktok_mcgraf_${skill}`);assert.equal(r.skill.name,skill===3?'工程学十字星':'结构性原理');
 assert.equal(r.skillOverlay.duration,elite===1?20:30);assert.equal(r.skill.duration,skill===3?-1:0);assert.equal(r.skill.spData.spType,8);
 assert.deepEqual(r.bb,skill===3?{atk_scale:3}:{});assert.deepEqual(r.rangeGrid,[[0,0]]);
 assert.equal(r.deployment.slotCost,0);assert.equal(r.deployment.refundRatio,0);assert.equal(r.deployment.chooseFacing,true);assert.equal(r.deployment.limitByHostAttackRange,false);
});
test('McGraf maximum source stats stay independent from owner potential and trust',()=>{
 const e1=selectedMcGrafBuild(build({elite:1,level:80,skillRank:7}));assert.deepEqual([e1.stats.maxHp,e1.stats.atk,e1.stats.def],[2660,477,437]);
 const plain=selectedMcGrafBuild(build()),max=selectedMcGrafBuild(build({potential:6,trust:200}));assert.deepEqual([plain.stats.maxHp,plain.stats.atk,plain.stats.def],[3500,600,550]);assert.deepEqual(max.stats,plain.stats);
 assert.deepEqual([max.stats.cost,max.stats.respawnTime,max.stats.blockCnt,max.stats.baseAttackTime,max.stats.magicResistance],[10,40,3,1.5,0]);
 assert.equal(plain.talentBb.find(t=>'hp_ratio'in t).hp_ratio,.3);assert.equal(max.talentBb.find(t=>'hp_ratio'in t).hp_ratio,.4);
});
test('McGraf interpolates its own source phase and rounds only HP/ATK/DEF',()=>{
 const r=selectedMcGrafBuild(build({elite:1,level:40,skillRank:7}));assert.deepEqual([r.stats.maxHp,r.stats.atk,r.stats.def],[2417,416,392]);
});
test('McGraf retains the hidden S3 weaken operands as separate talent inputs',()=>{
 const r=selectedMcGrafBuild(build({skillId:'skchr_mcnist_3'}));assert.deepEqual(r.talentBb.at(-1),{atk:-.5,range_radius:1.5,interval:1,atk_interval:.025,atk_min:0});
});
test('McGraf source binding keeps original full-width pointers and does not add any public summon deck',()=>{
 const r=selectedMcGrafBuild(build());assert.equal(r.sourceBinding.rootPathId,'-7832074744968755917');assert.equal(r.sourceBinding.animatorPathId,'3830167749147247923');
 assert.equal(r.sourceBinding.bundle,'pkgrps/btl_pfb_tokens_5.ab');assert.ok(r.skeletonBinding);assert.equal(REGULAR_SUMMONS.char_4230_mcnist,undefined);assert.equal(REGULAR_AUTOMATIC_TOKENS.char_4230_mcnist,undefined);
});
test('McGraf rejects E0, locked owner skills, invalid ranks and unreviewed modules',()=>{
 for(const more of[{elite:0,level:50,skillRank:4},{elite:1,level:80,skillRank:7,skillId:'skchr_mcnist_3'},{skillRank:11},{level:91},{potential:0},{trust:201},{module:'mcnist-x'}])assert.throws(()=>selectedMcGrafBuild(build(more)));
});
