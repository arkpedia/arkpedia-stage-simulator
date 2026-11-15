// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import native from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {treeShieldNative} from '../shared/arkpedia/enemy-tree-shield-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_10069_ftlsj','enemy_10069_ftlsj_2'];
function fixture(id=ids[0],compiled=true){
 const guard=chessRec({id:'tree_guard',stats:{maxHp:1e6,atk:0,def:0},skill:null}),row=records.enemies[id].levels[0];
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(row):row},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:10,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,6]}),g=h.b.allyUnits[0],hits=[],attacks=[];
 h.b.addBuff(e,{key:'test:hold',flags:{noMove:true}});
 h.b.on('damaged',c=>{if(c.source===e&&c.target===g)hits.push({time:h.b.time,amount:c.hpLoss});});
 h.b.on('attack',c=>{if(c.attacker===e)attacks.push(h.b.time);});
 return{...h,e,g,hits,attacks};
}
for(const id of ids){
 test(`${id}: its original plain body compiles through shared landing and melee components`,()=>{
  const row=records.enemies[id].levels[0];assert.ok(treeShieldNative(row,nativeComponents(native,id)));
  const plan=withCompiledEnemyRuntime(row).runtimeFeatures;
  assert.deepEqual(plan.entries.filter(e=>e.ability).map(e=>e.ability.kind),['passiveEnemyBody','animatedMeleeAttack']);
 });
 test(`${id}: the idle birth pose loops for its two-second delay, then the native marker releases one melee hit`,()=>{
  for(const compiled of[false,true]){
   const h=fixture(id,compiled),hp=h.e.hp;
   assert.equal(h.e.mem.regularFormVisual.clip,'Idle');assert.equal(h.e.mem.regularFormVisual.loop,true);
   assert.equal(h.b._checkBlock(h.e),false);h.b.dealDamage(null,h.e,{amount:10000,type:'phys',sourceless:true});assert.equal(h.e.hp,hp);
   h.run(1.8);assert.equal(h.attacks.length,0);assert.equal(h.hits.length,0);assert.equal(h.e.mem.regularFormVisual.clip,'Idle');
   assert.ok(h.runUntil(()=>h.attacks.length===1,1));assert.equal(h.e.findBuff('ab:passiveBirth'),null);assert.equal(h.e.mem.regularFormVisual.clip,'Attack');
   assert.ok(h.runUntil(()=>h.hits.length===1,1));assert.equal(h.hits[0].amount,h.e.base.atk);
   assert.ok(Math.abs(h.hits[0].time-h.attacks[0]-17/30)<h.b.dt*1.2);assert.deepEqual(h.b.errors,[]);
  }
 });
 test(`${id}: source hit-rate stats use the ordinary damage pipeline`,()=>{
  const h=fixture(id);h.b.addBuff(h.g,{key:'test:dodge',mods:{dodgePhys:1}});
  assert.equal(h.e.s.hitRatePhys,1);h.run(4);assert.equal(h.hits.length,0);
  h.b.removeBuff(h.g,'test:dodge');assert.ok(h.runUntil(()=>h.hits.length===1,7));assert.equal(h.hits[0].amount,h.e.base.atk);
  assert.deepEqual(h.b.errors,[]);
 });
}
test('ordinary control cancels a Tree Shield wind-up without making a second damage loop',()=>{
 const h=fixture();assert.ok(h.runUntil(()=>h.attacks.length===1,4));h.b.applyStatus(h.e,'freeze',{duration:1});h.run(1);
 assert.equal(h.hits.length,0);assert.ok(h.runUntil(()=>h.hits.length===1,8));assert.deepEqual(h.b.errors,[]);
});
test('death during the idle birth phase cleans the visual and cannot emit a delayed melee hit',()=>{
 const h=fixture();h.run(.4);h.b.kill(h.e);h.run(4);
 assert.equal(h.e.mem.regularFormVisual,null);assert.equal(h.hits.length,0);assert.deepEqual(h.b.errors,[]);
});
test('native gates retain idle birth presentation, target-source binding and plain melee packets',()=>{
 for(const id of ids)for(const mutate of[
  n=>n[id].find(c=>'_modes'in c)._idleWhenBorn=0,
  n=>n[id].find(c=>'_modes'in c)._delayToBorn=0,
  n=>{const root=n[id].find(c=>'_modes'in c),mode=n.$ref(root._modes[0]);n.$ref(mode._combat)._selectTargetSource=2;},
  n=>{const root=n[id].find(c=>'_modes'in c),mode=n.$ref(root._modes[0]);n.$ref(mode._combat)._activeBuffs.push({unknown:true});},
 ]){const n=nativeComponents(structuredClone(native),id);mutate(n);assert.equal(treeShieldNative(records.enemies[id].levels[0],n),false);}
});
