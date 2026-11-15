// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-is-chests-animations.json' with {type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {loggedChestNative} from '../shared/arkpedia/enemy-logged-chest-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {stageOutcomeSummaries} from '../shared/arkpedia/stage-outcomes.js';
import {readStageOutcomes} from '../server/sim/content/arkpedia-stage-outcomes.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const specs=[['enemy_2035_sybox','trap_068_badbox',Math.fround(1.27)],['enemy_2059_smbox','trap_110_smbbox',Math.fround(1.1)]];
function fixture(id,compiled=false,level=0){
 const guard=chessRec({id:'logged_chest_guard',stats:{maxHp:1e6,atk:0,def:0},skill:null});
 const row=records.enemies[id].levels[level],h=makeBattle({content:'none',autoFinish:false,timeLimit:60,
  defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(row):row},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:9,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[9,6]});return{...h,e,g:h.b.allyUnits[0]};
}
for(const[id,key,delay]of specs){
 test(`${id}: original Start phase holds combat and expires into ordinary source-timed melee`,()=>{
  for(const compiled of[false,true]){
   const f=fixture(id,compiled),hp=f.g.hp;assert.equal(f.e.mem.regularFormVisual.clip,'Start');
   assert.ok(f.e.s.flags.invulnerable);assert.ok(f.e.s.flags.disarm);assert.ok(f.e.s.flags.unblockable);
   assert.equal(f.b.dealDamage(f.g,f.e,{amount:1000,type:'true'}),0);
   f.run(delay-.1);assert.equal(f.g.hp,hp);assert.ok(f.e.findBuff('ab:passiveBirth'));
   f.run(.2);assert.equal(f.e.findBuff('ab:passiveBirth'),null);assert.equal(f.e.mem.regularFormVisual,null);
   assert.deepEqual(f.e.def.attackAnim,{dur:1,hit:clocks.enemies[id].events.Attack[0].time});
   f.run(2);assert.ok(f.g.hp<hp);assert.deepEqual(f.b.errors,[]);
  }
 });
 test(`${id}: passive immunities survive silence and each kill records its own source result once`,()=>{
  const f=fixture(id);f.run(delay+.1);
  for(const status of['stun','freeze','silence'])assert.equal(f.b.applyStatus(f.e,status,{duration:3}),false);
  f.b.addBuff(f.e,{key:'test:forcedSilence',flags:{silence:true}});
  f.b.kill(f.e);f.b.kill(f.e);assert.deepEqual(readStageOutcomes(f.b).counters,{[key]:1});
  assert.equal(stageOutcomeSummaries(readStageOutcomes(f.b)).length,1);
  assert.ok(!stageOutcomeSummaries(readStageOutcomes(f.b))[0].includes(key));
  const next=f.b.spawnEnemy(id,{pos:[9,5]});f.b.kill(next);assert.equal(readStageOutcomes(f.b).counters[key],2);
  assert.deepEqual(f.b.errors,[]);
 });
 test(`${id}: leakage and expiry do not invent a killed result`,()=>{
  const f=fixture(id);f.b.leak(f.e);assert.deepEqual(readStageOutcomes(f.b).counters,{});
  const next=f.b.spawnEnemy(id,{pos:[9,5]});f.b._remove(next,'expire');assert.deepEqual(readStageOutcomes(f.b).counters,{});
 });
}
test('native chest admission rejects changed control immunities, log keys, counters and born bindings',()=>{
 for(const[id]of specs)assert.equal(loggedChestNative(records.enemies[id].levels[0],nativeComponents(evidence,id)),true);
 for(const edit of[
  n=>n.$ref(n.enemy_2035_sybox[0]._commonAbilities[0])._buffs[0].attributes.abnormalImmunes.push(25),
  n=>n.$template('enemy_sybox_t[logkilled]').eventToActions.ON_OWNER_KILLED[0]._additionValue=2,
  n=>n.$ref(n.enemy_2035_sybox[0]._animator)._animations.find(a=>a.animKey==='Born').animName='Attack',
  n=>n.enemy_2035_sybox[0]._delayToBorn=0,
 ]){const n=nativeComponents(structuredClone(evidence),specs[0][0]);edit(n);assert.equal(loggedChestNative(records.enemies[specs[0][0]].levels[0],n),false);}
});

test('all three source database levels retain their independent statistics and the same native body contract',()=>{
 for(const[id]of specs)for(const level of[0,1,2]){
  const row=records.enemies[id].levels[level];assert.equal(loggedChestNative(row,nativeComponents(evidence,id)),true);
  const f=fixture(id,true,level);assert.equal(f.e.s.atk,row.stats.atk);assert.equal(f.e.s.maxHp,row.stats.maxHp);
  f.run(2);assert.equal(f.e.findBuff('ab:passiveBirth'),null);assert.deepEqual(f.b.errors,[]);
 }
});
