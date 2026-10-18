// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4223_botany.json' with {type:'json'};
import {selectedBotanyBuild as select,selectedBotanyInputs,botanyNativeInputs,botanySourceComponent,
  BOTANY_ID as ID} from '../server/sim/content/arkpedia-botany-source.js';
import {normalizeChess} from '../server/sim/simdata.js';
const build=more=>({elite:2,level:80,potential:1,trust:0,skillId:'skchr_botany_1',skillRank:10,module:'none',...more});
test('Botany retains complete held original source bytes, pointer roots and dependency closure',async()=>{
 const raw=await readFile(new URL('../data/arkpedia-native-operators/'+ID+'.json',import.meta.url));
 assert.equal(raw.length,281377);assert.equal(createHash('sha256').update(raw).digest('hex'),'dd8f7cccb8e291d0598ea8a4972377c967f790aa05820b3734eba9aeb2dfd6c7');
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);
 assert.equal(e.source.bundles.length,5);assert.equal(Object.keys(e.templates).length,5);assert.equal(Object.keys(e.projectiles).length,3);
 for(const key of['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[key],false);
 for(const group of['characters','artworkHierarchy','skills','projectiles'])for(const rows of Object.values(e[group]))
  for(const row of rows)for(const part of row.components)assert.equal(typeof part.pathId,'string');
});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)test(`Botany S${skill} rank${rank} retains its exact source row, SP account and selected blackboard`,()=>{
 for(const potential of[1,6])for(const trust of[0,200]){
  const r=select(build({skillId:`skchr_botany_${skill}`,skillRank:rank,potential,trust}));
  assert.deepEqual(r.source,e.tables.skills[`skchr_botany_${skill}`].levels[rank-1]);assert.equal(r.index,skill-1);
  assert.equal(r.source.skillType,skill===1?'AUTO':'MANUAL');assert.equal(r.source.spData.spType,'INCREASE_WITH_TIME');
  assert.equal(r.stats.baseAttackTime,1.6);assert.deepEqual(Object.keys(r.bb).sort(),r.source.blackboard.map(b=>b.key).sort());
 }
});
test('Botany source stats preserve promotion, trust and potential without silently granting talent ASPD',()=>{
 const lo=select(build({elite:0,level:50,skillRank:4})),hi=select(build({potential:6,trust:200}));
 assert.deepEqual([lo.stats.maxHp,lo.stats.atk,lo.stats.def,lo.stats.cost,lo.stats.magicResistance],[623,297,72,15,5]);
 assert.deepEqual([hi.stats.maxHp,hi.stats.atk,hi.stats.def,hi.stats.cost,hi.stats.magicResistance],[1320,501,108,14,15]);
 assert.deepEqual(lo.talentBb,[]);assert.deepEqual(hi.talentBb,[{attack_speed:7,max_stack_cnt:3}]);
 assert.equal(hi.stats.attackSpeed,100);assert.equal(hi.stats.respawnTime,70);
 assert.deepEqual(select(build({elite:1,level:70,skillRank:7})).talentBb,[{attack_speed:4,max_stack_cnt:3}]);
});
test('Botany rejects locked source skills, unsupported modules, invalid ranks and invented components',()=>{
 for(const change of[{elite:0,level:50,skillRank:4,skillId:'skchr_botany_2'},{elite:0,level:50,skillRank:5},
  {elite:3},{level:81},{potential:0},{potential:7},{trust:201},{skillRank:11},{skillId:'made-up'},{module:'botany-x'}])assert.throws(()=>select(build(change)));
 assert.throws(()=>botanySourceComponent('characters',ID,'0'),/Missing original/);
});
test('Botany normalized inputs reject altered stats, selected identity, blackboards, account and range',()=>{
 const b=build(),r=select(b);
 const fresh=()=>({rangeGrid:r.rangeGrid,def:normalizeChess({chessId:ID,charId:ID,stats:r.stats,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,
  skill:{...r.source,...r.source.spData,skillId:b.skillId,rangeGrid:r.skillRangeGrid},arkpedia:b})});
 assert.equal(selectedBotanyInputs(fresh()).index,0);
 for(const mutate of[u=>u.def.stats.atk++,u=>u.def.skill.bb.fake=1,u=>u.def.raw.arkpedia.skillId='skchr_botany_2',
  u=>u.def.skill.spCost++,u=>u.rangeGrid=[]]){
  const u=fresh();mutate(u);assert.throws(()=>selectedBotanyInputs(u),/Incomplete original/);
 }
});
test('Botany retains two original modes and distinct ordinary, automatic S1 and manual S2 abilities',()=>{
 const n=botanyNativeInputs();assert.equal(n.modes.length,2);
 assert.deepEqual(n.modes.map(m=>m.pathId),['-4384498169034042556','-5797461414541061308']);
 assert.equal(n.modes[0].attack._projectileKey,'projectile_chr_botany');assert.equal(n.modes[0].attack._elementDamageType,0);
 assert.equal(n.s1Attack._projectileKey,'projectile_chr_botany_s1');assert.equal(n.s1Attack._animKey,'Skill_1');
 assert.equal(n.s1Attack._activeBuffs[0].buffKey,'botany_s1_extra');assert.equal(n.s1Attack._activeBuffs[0].stripBlackboardParamsWithBuffKey,1);
 assert.equal(n.s1._recoverSpIfTargetDead,1);assert.equal(n.s1._allowSpRecoveryWhenAffecting,0);
 assert.equal(n.modes[1].attack._projectileKey,'projectile_chr_botany_s2');assert.equal(n.modes[1].attack._activeBuffs[0].buffKey,'botany_s2_extra');
 assert.equal(n.modes[1].abilities[0]._buffs[0].buffKey,'botany_s2_recover');
 assert.equal(n.s2._attackBlackboardModeIndex,1);assert.equal(n.s2._rangeIdModeIndex,1);
 assert.equal(n.s2._beginAnim,'Skill_2_Begin');assert.equal(n.s2._allowNoTarget,1);assert.equal(n.s2._allowSpRecoveryWhenAffecting,0);
});
test('Botany templates preserve WATER filters, conditional S1 magic/injury, S2 physical rider and nonderived burst gift',()=>{
 const n=botanyNativeInputs(),extra=n.templates.botany_s1_extra.eventToActions.ON_BUFF_START;
 assert.equal(extra[0].$type,'Torappu.Battle.Action.Nodes+CheckTargetEpIsFull, Assembly-CSharp');assert.equal(extra[0]._elementType,'WATER');
 assert.equal(extra[1]._damageType,'MAGICAL');assert.equal(extra[2]._elementDamageType,'WATER');
 const s2=n.templates.botany_s2_extra.eventToActions.ON_BUFF_START;assert.equal(s2.length,1);assert.equal(s2[0]._damageType,'PHYSICAL');
 const talent=n.templates.botany_t_1.eventToActions.ON_BEFORE_EP_BREAK_START;assert.equal(talent[0]._recoveryType,'WATER');
 assert.equal(talent[0]._skipInEPBreakRecoveryCheck,true);assert.equal(talent[1]._buffOwner,'BUFF_SOURCE');assert.equal(talent[1]._isDerivedBuff,false);
 for(const [key,rows]of Object.entries(n.projectiles)){
  const parts=rows.flatMap(row=>row.components).map(p=>p.data),body=parts.find(p=>'_lifeTime'in p),motion=parts.find(p=>'_speed'in p);
  assert.equal(body._lifeTime,10);assert.equal(body._maxHitNum,1);assert.equal(body._stopWhenSourceInvalid,0);
  assert.equal(motion._speed,key==='projectile_chr_botany'?10:12);
 }
});
