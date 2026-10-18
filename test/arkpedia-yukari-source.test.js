// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4219_yukari.json' with{type:'json'};
import {selectedYukariBuild as select,selectedYukariInputs,yukariNativeInputs,YUKARI_ID as ID,yukariSourceComponent} from '../server/sim/content/arkpedia-yukari-source.js';
import {normalizeChess} from '../server/sim/simdata.js';
const build=more=>({elite:2,level:80,potential:1,trust:0,skillId:'skchr_yukari_1',skillRank:10,module:'none',...more});
test('Yukari retains the complete original five-bundle source graph without public combat/model approval',async()=>{
 const raw=await readFile(new URL('../data/arkpedia-native-operators/'+ID+'.json',import.meta.url));assert.equal(raw.length,326073);assert.equal(createHash('sha256').update(raw).digest('hex'),'eb4b2640253141e8a0cae32a5712348258cba08da239c16eae53bf7726a710f9');
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);assert.equal(e.source.bundles.length,5);assert.equal(Object.keys(e.templates).length,10);assert.equal(Object.keys(e.projectiles).length,3);assert.deepEqual(Object.keys(e.tokens??{}),[]);
 let components=0;for(const group of['characters','skills','projectiles'])for(const rows of Object.values(e[group]))for(const row of rows)for(const part of row.components){components++;assert.equal(typeof part.pathId,'string');}assert.equal(components,103);
 for(const key of['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[key],false);
});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)test(`Yukari S${skill} rank${rank} preserves manual time-SP and its exact selected blackboard`,()=>{
 for(const potential of[1,6])for(const trust of[0,200]){const r=select(build({skillId:`skchr_yukari_${skill}`,skillRank:rank,potential,trust}));assert.deepEqual(r.source,e.tables.skills[`skchr_yukari_${skill}`].levels[rank-1]);assert.equal(r.index,skill-1);assert.equal(r.source.skillType,'MANUAL');assert.equal(r.source.spData.spType,'INCREASE_WITH_TIME');assert.equal(r.stats.baseAttackTime,2.1);assert.deepEqual(Object.keys(r.bb).sort(),r.source.blackboard.map(b=>b.key).sort());}
});
test('Promotion/potential/trust retain printed stats and source talent availability independently',()=>{
 const low=select(build({elite:0,level:50,skillRank:4})),mid=select(build({elite:1,level:70,skillRank:7})),high=select(build({potential:6,trust:200}));
 assert.deepEqual([low.stats.maxHp,low.stats.atk,low.stats.def,low.stats.cost,low.stats.respawnTime],[870,501,134,14,70]);assert.deepEqual(low.talentBb,[]);
 assert.deepEqual([high.stats.maxHp,high.stats.atk,high.stats.def,high.stats.cost,high.stats.respawnTime],[1810,835,200,14,60]);assert.deepEqual(mid.talentBb,[{max_target:2,heal_scale:.5}]);assert.deepEqual(high.talentBb,[{max_target:3,heal_scale:1}]);
});
test('Locked skills, unsupported modules/builds and invented native components reject',()=>{
 for(const more of[{elite:0,level:50,skillRank:4,skillId:'skchr_yukari_2'},{elite:0,level:50,skillRank:5},{elite:3},{level:81},{potential:0},{potential:7},{trust:201},{skillRank:11},{skillId:'unknown'},{module:'yukari-x'}])assert.throws(()=>select(build(more)));
 assert.throws(()=>yukariSourceComponent('characters',ID,'0'),/Missing original/);
});
test('Normalized selected identity rejects altered stats, range, talent, blackboard, SP or skill binding',()=>{
 const b=build(),r=select(b),fresh=()=>({rangeGrid:r.rangeGrid,def:normalizeChess({chessId:ID,charId:ID,stats:r.stats,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,skill:{...r.source,...r.source.spData,skillId:b.skillId,rangeGrid:r.skillRangeGrid},arkpedia:b})});assert.equal(selectedYukariInputs(fresh()).index,0);
 for(const mutate of[u=>u.def.stats.atk++,u=>u.def.skill.bb.fake=1,u=>u.def.raw.arkpedia.skillId='skchr_yukari_2',u=>u.def.skill.spCost++,u=>u.rangeGrid=[],u=>u.def.talents[0].bb.heal_scale=9]){const u=fresh();mutate(u);assert.throws(()=>selectedYukariInputs(u),/Incomplete original/);}
});
test('Ordinary native input is a single Physical arrow; S1 separately waits for all four events and hooks a distinct final payload',()=>{
 const n=yukariNativeInputs();assert.equal(n.root._modes.length,1);assert.equal(n.ordinary._damageType,1);assert.equal(n.ordinary._projectileKey,'projectile_chr_yukari');assert.equal(n.ordinary._animKey,'Attack_Loop');assert.equal(n.ordinarySelector._targetMotion,3);assert.equal(n.ordinarySelector._maxNum,1);
 assert.equal(n.s1Attack._damageType,2);assert.equal(n.s1Attack._additionalTimes,3);assert.equal(n.s1Attack._waitAttackEventForAllAttacks,1);assert.equal(n.s1Attack._triggerDelta,0);assert.equal(n.s1Attack._hookTheLastProjectile,'projectile_chr_yukari_s1_final');assert.equal(n.s1Attack._selectTargetTiming,2);assert.equal(n.s1Attack._useCachedAtkOnly,0);assert.equal(n.s1Attack._affectedBySlowDown,1);
});
test('The source talent heals on skill finish with its explicit withdrawal exclusion; S2 uses a separate Magical output template',()=>{
 const n=yukariNativeInputs(),finish=n.templates.yukari_t.eventToActions.ON_SKILL_FINISH;assert.equal(finish[0]._finishReason,'WITHDRAW');assert.ok(finish[1].$type.includes('+IfNot,'));assert.equal(finish[3]._abilityName,'HealWrapper');assert.equal(finish[3]._buff.templateKey,'yukari_t[heal]');assert.equal(finish[3]._isDerivedBuff,false);
 const heal=n.templates['yukari_t[heal]'].eventToActions.ON_BUFF_START[0];assert.equal(heal._healScaleKey,'heal_scale');assert.equal(heal._ignoreHealFree,false);const damage=n.templates['damage_scale[out_mag]'].eventToActions.ON_OUTPUT_DAMAGE[0];assert.equal(damage._damageMask,'MAGICAL');assert.equal(damage._isStackable,false);assert.equal(n.s2Grant._animKey,'Skill_2');assert.equal(n.s2Grant._selectTargetTiming,0);
});
