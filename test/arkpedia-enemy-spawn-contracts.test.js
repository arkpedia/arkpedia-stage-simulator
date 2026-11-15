// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import support from '../data/arkpedia-enemy-support.json' with {type:'json'};
import {compileEnemyRuntimePlan,withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {enemyRuntimeSpawnDependencies,validateEnemyRuntimePlan} from '../shared/arkpedia/enemy-runtime-plan.js';
import {auditEnemyRuntimePlans} from '../tools/arkpedia/enemy-runtime-plans.mjs';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle} from './helpers/battleHarness.js';
test('every admitted database level declares the children emitted by standard spawn primitives',()=>{
 for(const[id,entry]of Object.entries(records.enemies))if(support.enemies[id]?.policy)for(const row of Object.values(entry.levels)){
  for(const child of enemyRuntimeSpawnDependencies(compileEnemyRuntimePlan(row))){
   assert.ok(support.enemies[id].spawns.includes(child),`${id} -> ${child}`);assert.ok(support.enemies[child]?.policy,child);
  }
 }
});
test('compiled spawn primitives reject omitted or malformed enemy identities and counts',()=>{
 for(const kind of['deathSpawn','deathSpawnDelayed','periodicSpawn','seedSummoner']){
  const count=['periodicSpawn','seedSummoner'].includes(kind)?'count':'cnt',base={key:'enemy_child',[count]:1};
  const plan=params=>({schemaVersion:1,properties:{},entries:[{id:'native:spawnFixture',ability:{kind,params}}]});
  assert.deepEqual(enemyRuntimeSpawnDependencies(plan(base)),['enemy_child']);
  for(const params of[{[count]:1},{...base,key:''},{...base,key:'../enemy_child'},{...base,[count]:NaN},{...base,[count]:-1},{key:'enemy_child'}])
   assert.throws(()=>validateEnemyRuntimePlan(plan(params)),/Invalid enemy spawn parameters/);
  // A source may disable a spawn count while retaining the reviewed identity.
  assert.doesNotThrow(()=>validateEnemyRuntimePlan(plan({...base,[count]:0})));
 }
});
test('the build audit refuses a dropped standard dependency instead of publishing a partial record graph',()=>{
 const id='enemy_1162_magmot',source={[id]:records.enemies[id]};
 assert.throws(()=>auditEnemyRuntimePlans(source,{[id]:{...support.enemies[id],spawns:[]}}),/Undeclared enemy runtime spawn dependency/);
});
test('non-spawning Attack groups no longer synthesize incomplete death-spawn plans',()=>{
 for(const id of['enemy_1245_ltseal','enemy_1364_spnaxe','enemy_1364_spnaxe_2','enemy_1522_captan']){
  const p=compileEnemyRuntimePlan(records.enemies[id].levels[0]);
  assert.ok(!p.entries.some(e=>e.id==='talent:Attack'&&e.ability?.kind==='deathSpawn'),id);
 }
});
for(const[parent,child]of[['enemy_10077_mpbarr','enemy_10073_mpcar'],['enemy_10077_mpbarr_2','enemy_10073_mpcar_2']])
 test(`${parent}: its first periodic helper resolves from the declared compiled dependency`,()=>{
  assert.ok(support.enemies[parent].spawns.includes(child));
  const defs=Object.fromEntries([parent,child].map(id=>[id,withCompiledEnemyRuntime(records.enemies[id].levels[0])]));
  const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,defs:{enemies:defs},setup:installEnemyFeatures});
  h.b.start();const owner=h.b.spawnEnemy(parent,{pos:[9,6]});h.b.addBuff(owner,{key:'hold',flags:{noMove:true}});
  h.run(3.2);assert.equal(h.b.enemies.filter(e=>e.defId===child).length,1);assert.deepEqual(h.b.errors,[]);
 });

test('Withering Apostle carries its seed record and emits three children from that prepared graph',()=>{
 const parent='enemy_1321_wdarft',child='enemy_1269_nhfly';
 assert.ok(support.enemies[parent].spawns.includes(child));
 const defs=Object.fromEntries([parent,child].map(id=>[id,withCompiledEnemyRuntime(records.enemies[id].levels[0])]));
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,defs:{enemies:defs},setup:installEnemyFeatures});
 h.b.start();const owner=h.b.spawnEnemy(parent,{pos:[9,6]});h.b.addBuff(owner,{key:'hold',flags:{noMove:true}});
 const seeds=[];h.b.on('enemySpawn',({enemy})=>{if(enemy.defId===child)seeds.push(enemy);});
 h.run(9.9);assert.equal(seeds.length,0);h.run(.3);assert.equal(seeds.length,3);
 h.run(10);assert.equal(seeds.length,6);assert.deepEqual(h.b.errors,[]);
 assert.throws(()=>auditEnemyRuntimePlans({[parent]:records.enemies[parent]},{[parent]:{...support.enemies[parent],spawns:[]}}),/Undeclared enemy runtime spawn dependency/);
});
