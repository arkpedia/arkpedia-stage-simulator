// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import receipt from '../data/stage-rules/5-4_challenge_mode.json' with {type:'json'};
import seNormal from '../data/stage-rules/se-5.json' with {type:'json'};
import seChallenge from '../data/stage-rules/se-5_challenge_mode.json' with {type:'json'};
import psChallenge from '../data/stage-rules/ps-3_challenge_mode.json' with {type:'json'};
import svChallenge from '../data/stage-rules/sv-1_challenge_mode.json' with {type:'json'};
import main55 from '../data/stage-rules/5-5.json' with {type:'json'};
import lkNormal from '../data/stage-rules/lk-dp-b.json' with {type:'json'};
import tbNormal from '../data/stage-rules/tb-db-1.json' with {type:'json'};
import normal from '../data/arkpedia-stage-5-4.json' with {type:'json'};
import mvp from '../data/arkpedia-mvp.json' with {type:'json'};
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import support from '../data/arkpedia-enemy-support.json' with {type:'json'};
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
import { compileStage } from '../tools/arkpedia/build-stage.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const source={code:'5-4',name:normal.name,id:'main_05-04#f#',stage_type:'main',battle:normal.battle,
 variant:{kind:'challenge_mode',of_stage_id:'main_05-04',shares_parent_level_file:true}};

test('environment-system blockers identify the shared controller instead of misreading its string key as a number', () => {
 const changed = structuredClone(receipt);
 changed.runes = [{ key: 'env_system_new', difficultyMask: 'ALL', professionMask: 'ALL', buildableMask: 'ALL',
  blackboard: [{ key: 'key', value: 0, valueStr: 'env_031_act43side' }] }];
 assert.throws(() => compileStageRules(source, changed), /Unsupported stage environment controller: env_031_act43side/);
 // The chapter-12 sight system is admitted once (stage-sight.js); a second one is refused.
 const sight = structuredClone(changed); sight.runes[0].blackboard[0].valueStr = 'env_005_mainline12_sightSystem';
 assert.doesNotThrow(() => compileStageRules(source, sight));
 sight.runes.push(structuredClone(sight.runes[0]));
 assert.throws(() => compileStageRules(source, sight), /Unsupported stage environment controller: env_005_mainline12_sightSystem/);
 changed.runes[0].blackboard.push(changed.runes[0].blackboard[0]);
 assert.throws(() => compileStageRules(source, changed), /Invalid stage environment controller identity/);
});

test('5-4 Challenge uses original life, HP, ATK and movement runes in a real battle',()=>{
 const original=records.enemies.enemy_1040_bombd.levels[0];const before=structuredClone(original);
 const stage=compileStage({source,geometry:normal.geometry,rules:receipt,mvp,records,support,tokenData:{tokens:{}}});
 assert.equal(stage.battle.max_life,1);
 for(const[id,r]of Object.entries(stage.enemies))for(const[key,multiplier]of Object.entries({maxHp:1.05,atk:1.05,def:1,moveSpeed:1.5}))
  assert.ok(Math.abs(r.stats[key]-normal.enemies[id].stats[key]*multiplier)<1e-6,`${id}.${key}`);
 assert.deepEqual(original,before,'source records are never mutated by a variant');
 const b=new StandardBattle({...mvp,stage,enemies:{...mvp.enemies,...stage.enemies}},
  {operators:[defaultBuild(mvp.operators.char_123_fang)]});
 assert.equal(b.life,1);
 const e=b.spawnEnemy('enemy_1040_bombd',{pos:[2,5]});
 assert.equal(e.s.maxHp,4200);assert.equal(e.s.atk,840);assert.ok(Math.abs(e.s.moveSpeed-.9)<1e-6);
 assert.deepEqual(b.errors,[]);
});

test('missing, mismatched and unimplemented variant rules never fall back to normal mode',()=>{
 assert.throws(()=>compileStageRules(source,null),/Missing executable/);
 assert.throws(()=>compileStageRules(source,{...receipt,stageId:'different'}),/incompatible/);
 assert.throws(()=>compileStageRules({...source,variant:null},receipt),/normal stage/);
 for(const edit of [r=>r.runes[0].key='unknown_rune',r=>r.runes[0].professionMask=1,
  r=>r.runes[0].blackboard[0].value=NaN,r=>r.runes[1].blackboard.push({key:'new_attribute',value:2}),
  r=>r.runes[1].blackboard.push({...r.runes[1].blackboard[0]})]){
  const bad=structuredClone(receipt);edit(bad);assert.throws(()=>compileStageRules(source,bad),/Unsupported|Invalid/);
 }
});

test('original hidden-group runes add challenge enemies without changing the normal wave',()=>{
 const geometry=structuredClone(normal.geometry);geometry.hasConditionalSpawns=true;
 const conditional=[{enemy_id:'enemy_1040_bombd',count:2,time:2,route:0,wave:0,source:'wave',condition:{hidden_group:'raid'}}];
 const build=(variant,rules)=>compileStage({source:{...source,id:rules.stageId,variant},geometry,
  conditional,rules,mvp,records,support,tokenData:{tokens:{}}});
 const base=build(null,seNormal);
 const challenge=build({kind:'challenge_mode',of_stage_id:seChallenge.parentStageId},seChallenge);
 const count=stage=>stage.geometry.waves.flatMap(w=>w.spawns).reduce((sum,s)=>sum+s.count,0);
 assert.equal(count(base),count(normal));assert.equal(count(challenge),count(normal)+2);
 assert.equal(base.geometry.hiddenGroupsMerged,0);assert.equal(challenge.geometry.hiddenGroupsMerged,1);
 assert.equal(base.battle.max_life,source.battle.max_life);assert.equal(challenge.battle.max_life,1);
 assert.equal(base.enemies.enemy_1040_bombd.stats.atk,800);
 assert.equal(challenge.enemies.enemy_1040_bombd.stats.atk,960);
 assert.equal(geometry.hasConditionalSpawns,true,'compilation does not mutate source geometry');
 const numeric=compileStageRules({id:psChallenge.stageId,variant:{kind:'challenge_mode',of_stage_id:psChallenge.parentStageId}},psChallenge);
 assert.equal(numeric.hiddenGroups.raid,true);assert.equal(numeric.enemies.maxHp,1.1);
 const invalid=structuredClone(seChallenge);invalid.runes.at(-1).blackboard[0].valueStr='';
 assert.throws(()=>compileStageRules({...source,id:invalid.stageId,variant:{kind:'challenge_mode',of_stage_id:invalid.parentStageId}},invalid),/hidden-group/);
});

test('SV-1 Challenge adds three weight levels to actual enemy displacement weight',()=>{
 const stage=compileStage({source:{...source,id:svChallenge.stageId,variant:{kind:'challenge_mode',of_stage_id:svChallenge.parentStageId}},
  geometry:normal.geometry,rules:svChallenge,mvp,records,support,tokenData:{tokens:{}}});
 const b=new StandardBattle({...mvp,stage,enemies:{...mvp.enemies,...stage.enemies}},
  {operators:[defaultBuild(mvp.operators.char_123_fang)]});
 const e=b.spawnEnemy('enemy_1040_bombd',{pos:[2,5]});
 assert.equal(e.weight,normal.enemies.enemy_1040_bombd.stats.massLevel+3);
 assert.equal(e.s.maxHp,4400);assert.ok(Math.abs(e.s.atk-880)<1e-6);
 assert.deepEqual(b.errors,[]);
});

test('normal difficulty retains null or inactive original runes without admitting unsupported challenge effects',()=>{
 for(const original of [main55,lkNormal,tbNormal]){
  const compiled=compileStageRules({id:original.stageId},original);
  assert.deepEqual(compiled.battle,{});assert.deepEqual(compiled.enemies,{});assert.deepEqual(compiled.enemyAdd,{});
 }
 const challenge={...main55,stageId:main55.stageId+'#f#',parentStageId:main55.stageId};
 assert.deepEqual(compileStageRules({id:challenge.stageId,variant:{kind:'challenge_mode',of_stage_id:main55.stageId}},challenge).allyCards,
  [{attribute:'respawnTime',professionMask:1023,buildableMask:3,scale:2}]);
 assert.throws(()=>compileStageRules({id:tbNormal.stageId},{...tbNormal,runes:undefined}),/Invalid/);
});

test('easy and six-star rules are inactive for normal and challenge, while unknown difficulty masks fail closed', () => {
 const original = structuredClone(receipt);
 for (const difficultyMask of ['EASY', 'SIX_STAR']) original.runes.push({ difficultyMask, key: 'unimplemented_mode_rule',
  professionMask: 1, buildableMask: 'RANGED', blackboard: [] });
 assert.deepEqual(compileStageRules(source, original), compileStageRules(source, receipt));
 const normalReceipt = { ...original, stageId: source.variant.of_stage_id }; delete normalReceipt.parentStageId;
 assert.deepEqual(compileStageRules({ id: normalReceipt.stageId }, normalReceipt).battle, {});
 original.runes.at(-1).difficultyMask = 'UNKNOWN';
 assert.throws(() => compileStageRules(source, original), /Unsupported rune targeting/);
});

test('six-star variants require the original parent mapping and apply only their difficulty rules', () => {
 const sixSource = { ...source, id: source.variant.of_stage_id + '#s',
  variant: { ...source.variant, kind: 'six_star' } };
 const original = structuredClone(receipt);
 original.stageId = sixSource.id;
 original.source.stageTable = { stageId: source.variant.of_stage_id, levelId: 'Obt/Main/level_main_05-04' };
 original.source.path = 'zh_CN/gamedata/levels/obt/main/level_main_05-04.json';
 original.runes = [
  { difficultyMask: 'ALL', key: 'enemy_attribute_mul', professionMask: 1023, buildableMask: 'ALL', blackboard: [{ key: 'atk', value: 1.1 }] },
  { difficultyMask: 'SIX_STAR', key: 'enemy_attribute_mul', professionMask: 1023, buildableMask: 'ALL', blackboard: [{ key: 'atk', value: 1.2 }] },
  { difficultyMask: 'SIX_STAR', key: 'global_lifepoint', professionMask: 1023, buildableMask: 'ALL', blackboard: [{ key: 'value', value: 1 }] },
  { difficultyMask: 'FOUR_STAR', key: 'unknown_four_star_rule', professionMask: 1023, buildableMask: 'ALL', blackboard: [] },
 ];
 const rules = compileStageRules(sixSource, original);
 assert.equal(rules.battle.max_life, 1);
 assert.ok(Math.abs(rules.enemies.atk - 1.32) < 1e-9);
 for (const mutate of [r => r.source.stageTable.stageId = 'wrong', r => r.source.path = 'wrong', r => r.runes = []]) {
  const bad = structuredClone(original); mutate(bad);
  assert.throws(() => compileStageRules(sixSource, bad), /incompatible/);
 }
 original.runes.at(-1).difficultyMask = 'SIX_STAR';
 assert.throws(() => compileStageRules(sixSource, original), /Unsupported stage rune/);
});

test('Integrated Strategies variations use their own level with normal difficulty rules', () => {
 const id = 'obt/roguelike/ro4/levelreplacers/level_rogue4_1-1_r1';
 const variant = { kind: 'variation', of_stage_id: 'obt/roguelike/ro4/level_rogue4_1-1', shares_parent_level_file: false };
 const original = { ...structuredClone(receipt), stageId: id, parentStageId: variant.of_stage_id,
  source: { ...receipt.source, path: `zh_CN/gamedata/levels/${id}.json` },
  runes: [{ difficultyMask: 'NORMAL', key: 'global_lifepoint', professionMask: 1023,
   buildableMask: 'ALL', blackboard: [{ key: 'value', value: 2 }] }] };
 const source = { id, stage_type: 'integrated_strategies', variant };
 assert.equal(compileStageRules(source, original).battle.max_life, 2);
 assert.doesNotThrow(() => compileStageRules(source, { ...original, runes: null }));
 for (const invalid of [{ ...source, stage_type: 'main' },
  { ...source, variant: { ...variant, shares_parent_level_file: true } }])
  assert.throws(() => compileStageRules(invalid, original), /incompatible/);
 assert.throws(() => compileStageRules(source, { ...original,
  source: { ...original.source, path: `zh_CN/gamedata/levels/${variant.of_stage_id}.json` } }), /incompatible/);
});
