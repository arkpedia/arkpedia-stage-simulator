// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import native from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {siegebreakerNative} from '../shared/arkpedia/enemy-siegebreaker-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1083_sotiab','enemy_1083_sotiab_2'],herald='enemy_1080_sotidp';
function fixture(id=ids[0],compiled=true){
 const def=id=>compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0];
 const guard=chessRec({id:'landing_guard',stats:{maxHp:100000,atk:0,def:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,defs:{enemies:{[id]:def(id),[herald]:def(herald)},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:10,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,6]}),g=h.b.allyUnits[0],hits=[],attacks=[];
 h.b.addBuff(e,{key:'test:hold',flags:{noMove:true}});
 h.b.on('damaged',c=>{if(c.source===e&&c.target===g)hits.push({time:h.b.time,amount:c.hpLoss});});
 h.b.on('attack',c=>{if(c.attacker===e)attacks.push(h.b.time);});
 return{...h,e,g,hits,attacks};
}
for(const id of ids){
 test(`${id}: source-gated landing and attack are shared data components`,()=>{
  const row=records.enemies[id].levels[0];assert.ok(siegebreakerNative(row,nativeComponents(native,id)));
  const entries=withCompiledEnemyRuntime(row).runtimeFeatures.entries;
  assert.deepEqual(entries.filter(e=>e.ability).map(e=>e.ability.kind),['markerStatBonus','passiveEnemyBody','animatedMeleeAttack']);
 });
 test(`${id}: landing holds targeting/blocking/action for 1.5 seconds, then one native marker releases physical melee damage`,()=>{
  for(const compiled of[false,true]){
   const h=fixture(id,compiled),hp=h.e.hp;
   assert.equal(h.e.mem.regularFormVisual.clip,'Start');assert.equal(h.b._checkBlock(h.e),false);
   h.b.dealDamage(null,h.e,{amount:100,type:'phys',sourceless:true});assert.equal(h.e.hp,hp);
   h.run(1.4);assert.equal(h.hits.length,0);assert.equal(h.attacks.length,0);assert.ok(h.e.findBuff('ab:passiveBirth'));
   assert.ok(h.runUntil(()=>h.attacks.length===1,1));assert.equal(h.hits.length,0);assert.equal(h.e.findBuff('ab:passiveBirth'),null);
   assert.equal(h.e.mem.regularFormVisual.clip,'Attack');assert.ok(h.runUntil(()=>h.hits.length===1,1));
   assert.ok(Math.abs(h.hits[0].time-h.attacks[0]-13/30)<h.b.dt*1.2);
   assert.equal(h.hits[0].amount,h.e.base.atk);assert.deepEqual(h.b.errors,[]);
  }
 });
 test(`${id}: a Herald activates the variant's source value after landing`,()=>{
  const h=fixture(id);h.e.profile.noAttack=true;h.run(1.6);
  h.b.spawnEnemy(herald,{pos:[9,6]});h.run(.3);
  const ratio=id.endsWith('_2')?.8:.5;
  assert.ok(Math.abs(h.e.s.atk-h.e.base.atk*(1+.1+ratio))<1e-7);
  assert.ok(h.e.findBuff('enemy_talent_strength[atk]'));assert.deepEqual(h.b.errors,[]);
 });
}
test('control cancels the pending melee release and the next attack owns a fresh native clock',()=>{
 const h=fixture();assert.ok(h.runUntil(()=>h.attacks.length===1,3));h.b.applyStatus(h.e,'freeze',{duration:1});h.run(.8);
 assert.equal(h.hits.length,0);assert.ok(h.runUntil(()=>h.hits.length===1,4));assert.deepEqual(h.b.errors,[]);
});
test('death before the native release cancels the remaining cast',()=>{
 const h=fixture();assert.ok(h.runUntil(()=>h.attacks.length===1,3));h.b.kill(h.e);h.run(2);
 assert.equal(h.hits.length,0);assert.deepEqual(h.b.errors,[]);
});
test('a vanished captured deployment does not receive damage at the marker',()=>{
 const h=fixture();assert.ok(h.runUntil(()=>h.attacks.length===1,3));h.b.kill(h.g);h.run(1);
 assert.equal(h.hits.length,0);assert.deepEqual(h.b.errors,[]);
});
test('the ordinary melee release uses the shared slowdown-adjusted clock',()=>{
 const h=fixture();h.b.addBuff(h.e,{key:'test:slow',mods:{slowDownMul:.5}});
 assert.ok(h.runUntil(()=>h.attacks.length===1,3));assert.ok(h.runUntil(()=>h.hits.length===1,2));
 assert.ok(Math.abs(h.hits[0].time-h.attacks[0]-26/30)<h.b.dt*1.2);assert.deepEqual(h.b.errors,[]);
});
test('source admission rejects changed birth scope, combat packets, animation bindings and variant strength',()=>{
 for(const id of ids){
  for(const edit of[
   n=>n[id].find(c=>'_modes'in c)._delayToBorn=1,
   n=>n[id].find(c=>'_modes'in c)._onlyDelayToBornOnTileStart=1,
   n=>{const r=n[id].find(c=>'_modes'in c),m=n.$ref(r._modes[0]);n.$ref(m._combat)._waitForAttackEvent=0;},
   n=>{const r=n[id].find(c=>'_modes'in c),m=n.$ref(r._modes[0]);n.$ref(m._combat)._atkScale=2;},
   n=>{const r=n[id].find(c=>'_modes'in c);n.$ref(r._animator)._animations.find(a=>a.animKey==='Born').speed=2;},
  ]){const n=nativeComponents(structuredClone(native),id);edit(n);assert.equal(siegebreakerNative(records.enemies[id].levels[0],n),false);}
  const r=structuredClone(records.enemies[id].levels[0]);r.talents.bb['strength.atk']=1;
  assert.equal(siegebreakerNative(r,nativeComponents(native,id)),false);
 }
});

test('death during landing releases its owned visual without leaving a Start clip on the dead body',()=>{
 const h=fixture();h.run(.3);assert.equal(h.e.mem.regularFormVisual.clip,'Start');h.b.kill(h.e);h.run(2);
 assert.equal(h.e.mem.regularFormVisual,null);assert.equal(h.hits.length,0);assert.deepEqual(h.b.errors,[]);
});
