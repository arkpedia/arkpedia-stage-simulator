// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4218_aigis.json' with {type:'json'};
import {selectedAegisBuild as select,selectedAegisInputs,aegisNativeInputs,aegisSourceComponent,AEGIS_ID as ID} from '../server/sim/content/arkpedia-aegis-source.js';
import {normalizeChess} from '../server/sim/simdata.js';
const build=more=>({elite:2,level:80,potential:1,trust:0,skillId:'skchr_aigis_1',skillRank:10,module:'none',...more});
test('Aegis holds its original five-bundle dependency graph without combat or rendering approval',async()=>{
 const raw=await readFile(new URL('../data/arkpedia-native-operators/'+ID+'.json',import.meta.url));assert.equal(raw.length,592413);
 assert.equal(createHash('sha256').update(raw).digest('hex'),'a2e948ec33bbaa1b7b7b3cf1f9359570c45e2a5057e96e41cf2447b7fc3a982c');
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);
 assert.equal(e.source.bundles.length,5);assert.equal(Object.keys(e.templates).length,13);assert.equal(Object.keys(e.projectiles).length,8);assert.deepEqual(Object.keys(e.tokens??{}),[]);
 for(const key of['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[key],false);
 for(const group of['characters','artworkHierarchy','skills','projectiles'])for(const rows of Object.values(e[group]))for(const row of rows)for(const part of row.components)assert.equal(typeof part.pathId,'string');
});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)test(`Aegis S${skill} rank${rank} retains original selection, trigger, time-SP and blackboards`,()=>{
 for(const potential of[1,6])for(const trust of[0,200]){const r=select(build({skillId:`skchr_aigis_${skill}`,skillRank:rank,potential,trust}));
  assert.deepEqual(r.source,e.tables.skills[`skchr_aigis_${skill}`].levels[rank-1]);assert.equal(r.index,skill-1);assert.equal(r.source.skillType,'MANUAL');
  assert.equal(r.source.spData.spType,'INCREASE_WITH_TIME');assert.equal(r.stats.baseAttackTime,2.1);assert.deepEqual(Object.keys(r.bb).sort(),r.source.blackboard.map(b=>b.key).sort());
 }
});
test('Source promotion/trust/potential retain original printed stats and independently gated Physical talent',()=>{
 const low=select(build({elite:0,level:50,skillRank:4})),high=select(build({potential:6,trust:200}));
 assert.deepEqual([low.stats.maxHp,low.stats.atk,low.stats.def,low.stats.cost,low.stats.respawnTime],[939,573,155,20,70]);assert.deepEqual(low.talentBb,[{}]);
 assert.deepEqual([high.stats.maxHp,high.stats.atk,high.stats.def,high.stats.cost,high.stats.respawnTime],[1686,975,219,20,66]);
 assert.deepEqual(high.talentBb,[{},{damage_scale:1.12,damage_resistance:.12}]);
 assert.deepEqual(select(build({elite:1,level:70,skillRank:7})).talentBb,[{},{damage_scale:1.05,damage_resistance:.05}]);
});
test('Locked skills, unsupported modules, invalid builds and invented components reject',()=>{
 for(const more of[{elite:0,level:50,skillRank:4,skillId:'skchr_aigis_2'},{elite:0,level:50,skillRank:5},{elite:3},{level:81},{potential:0},{potential:7},{trust:201},{skillRank:11},{skillId:'unknown'},{module:'aigis-x'}])assert.throws(()=>select(build(more)));
 assert.throws(()=>aegisSourceComponent('characters',ID,'0'),/Missing original/);
});
test('Normalized source inputs reject changed identity, stats, blackboards, SP or range',()=>{
 const b=build(),r=select(b),fresh=()=>({rangeGrid:r.rangeGrid,def:normalizeChess({chessId:ID,charId:ID,stats:r.stats,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,
  skill:{...r.source,...r.source.spData,skillId:b.skillId,rangeGrid:r.skillRangeGrid},arkpedia:b})});assert.equal(selectedAegisInputs(fresh()).index,0);
 for(const mutate of[u=>u.def.stats.atk++,u=>u.def.skill.bb.fake=1,u=>u.def.raw.arkpedia.skillId='skchr_aigis_2',u=>u.def.skill.spCost++,u=>u.rangeGrid=[]]){
  const u=fresh();mutate(u);assert.throws(()=>selectedAegisInputs(u),/Incomplete original/);
 }
});
test('Four original modes preserve direct aerial ordinary damage, a separate S1 shell and source slowdown behavior',()=>{
 const n=aegisNativeInputs();assert.deepEqual(n.modes.map(m=>m.pathId),['2931423079368767493','3234597171207157765','4531254692266850309','-2557843868026914811']);
 assert.equal(n.ordinarySelector._targetMotion,2);assert.equal(n.ordinarySelector._maxNum,1);assert.equal(n.modes[0].attack._animKey,'Attack');
 assert.equal(n.modes[0].attack._projectileKey,undefined);assert.equal(n.modes[0].attack._affectedBySlowDown,1);assert.equal(n.modes[0].attack._forceFaceToDirection,1);
 assert.equal(n.modes[2].attack._projectileKey,'projectile_chr_aigis_s1');assert.equal(n.modes[2].attack._useCachedAtkOnly,0);assert.equal(n.modes[2].attack._affectedBySlowDown,1);
 assert.equal(n.s1._canCastDuringBorn,1);assert.equal(n.s1._allowNoTarget,1);assert.equal(n.s2._canCastDuringBorn,1);assert.equal(n.s2._allowNoTarget,0);
});
test('S2 retains six separately awaited missile events and an uncached distinct kick; triggerDelta zero is not a six-shot instant',()=>{
 const n=aegisNativeInputs();assert.equal(n.s2Missiles._animKey,'Skill_2_Begin');assert.equal(n.s2Missiles._additionalTimes,5);
 assert.equal(n.s2Missiles._waitAttackEventForAllAttacks,1);assert.equal(n.s2Missiles._triggerDelta,0);assert.equal(n.s2Missiles._useCachedAtkOnly,0);
 assert.equal(n.s2Missiles._affectedBySlowDown,1);assert.equal(n.s2Missiles._projectileKey,'projectile_chr_aigis_s2_1');
 for(let i=1;i<=6;i++)assert.ok(n.projectiles[`projectile_chr_aigis_s2_${i}`]);
 assert.equal(n.s2Kick._animKey,'Skill_2_Loop');assert.equal(n.s2Kick._projectileKey,'projectile_chr_aigis_s2_kick');assert.equal(n.s2Kick._useCachedAtkOnly,0);
 assert.equal(n.s2End._animKey,'Skill_2_End');assert.equal(n.s2End._endAnimKey,'Idle');
});
test('Takeoff and talent retain separate parent ownership, direct block command and typed output/incoming actions',()=>{
 const n=aegisNativeInputs(),trait=n.takeoff._buffs[0],talent=n.talent._buffs[0];assert.equal(trait.buffKey,'aigis_tr');assert.deepEqual(trait.attributes.abnormalFlags,[35]);
 assert.equal(trait.lifeTimeType,2);assert.equal(talent.buffKey,'aigis_t_1');assert.equal(talent.lifeTimeType,2);
 const t=n.templates.aigis_tr.eventToActions;assert.equal(t.ON_BUFF_START[0]._blockMode,'FLY');assert.equal(t.ON_OWNER_BORN[0]._OffsetKey,'height_offset');
 const output=n.templates.aigis_t_1.eventToActions;assert.equal(output.ON_OUTPUT_DAMAGE[0]._damageMask,'PHYSICAL');assert.equal(output.ON_OUTPUT_DAMAGE[0]._isOneMinus,false);
 assert.equal(output.ON_TAKE_DAMAGE[0]._damageMask,'PHYSICAL');assert.equal(output.ON_TAKE_DAMAGE[0]._isOneMinus,true);
 const walk=n.templates.aigis_s2_block_walk.eventToActions.ON_BUFF_FINISH;assert.equal(walk[1]._finishReason,'NORMAL_EXIT');assert.ok(walk[2].$type.includes('+IfNot,'));assert.equal(walk[3]._blockMode,'FLY');
});
