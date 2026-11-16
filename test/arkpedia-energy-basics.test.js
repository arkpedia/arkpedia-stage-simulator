// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {energyNative} from '../shared/arkpedia/enemy-energy-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemyEnergy,changeEnemyEnergy} from '../server/sim/content/arkpedia-enemy-energy.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1353_esabr','enemy_1353_esabr_2','enemy_1354_eghost','enemy_1354_eghost_2','enemy_1358_esheld','enemy_1358_esheld_2'];
function fixture(id,compiled=true){
 const guard=chessRec({id:'energy_guard',stats:{maxHp:1e6,atk:0,def:0,blockCnt:5},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0]},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:10,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();
 const e=h.b.spawnEnemy(id,{pos:[10,6]});h.b.addBuff(e,{key:'hold',flags:{noMove:true}});return{...h,e,g:h.b.allyUnits[0]};
}
for(const id of ids){
 test(`${id}: exact native meter, database modifiers, overload and ordinary body compile as components`,()=>{
  assert.ok(energyNative(records.enemies[id].levels[0],nativeComponents(evidence,id)));
  const entries=withCompiledEnemyRuntime(records.enemies[id].levels[0]).runtimeFeatures.entries;assert.ok(entries.some(e=>e.ability?.kind==='nativeEnergyMeter'));
  assert.equal(entries.filter(e=>e.ability?.kind==='animatedMeleeAttack').length,id.includes('eghost')?0:1);
 });
 test(`${id}: source initial energy, additive stack bonuses and overload lifetime are retained`,()=>{
  for(const compiled of[false,true]){
   const h=fixture(id,compiled),bb=records.enemies[id].levels[0].talents.bb,initial=bb['blacksteel_energy.init_stack_cnt']??0,capacity=bb['blacksteel_energy.max_stack_cnt'];
   assert.deepEqual(enemyEnergy(h.b,h.e),{count:initial,capacity,overloaded:false});assert.equal(h.e.s.atk,h.e.base.atk*(1+initial*.1));assert.equal(h.e.s.def,h.e.base.def*(1+initial*.2));
   h.b.applyStatus(h.e,'silence',{duration:40});changeEnemyEnergy(h.b,h.e,capacity);
   assert.deepEqual(enemyEnergy(h.b,h.e),{count:capacity,capacity,overloaded:true});assert.equal(h.e.s.def,h.e.base.def*(1+capacity*.2)*2);assert.equal(h.e.s.aspd,h.e.base.aspd+120);assert.equal(h.e.s.res,h.e.base.res+30);
   h.run(bb['over_energy.duration']+.1);assert.deepEqual(enemyEnergy(h.b,h.e),{count:0,capacity,overloaded:false});assert.equal(h.e.s.def,h.e.base.def);assert.deepEqual(h.b.errors,[]);
  }
 });
}
for(const id of ids.filter(id=>id.includes('esheld')))test(`${id}: native decay removes one stack after ten seconds without restarting on overload`,()=>{
 const h=fixture(id);h.b.applyStatus(h.e,'stun',{duration:40});h.run(9.9);assert.equal(enemyEnergy(h.b,h.e).count,15);h.run(.2);assert.equal(enemyEnergy(h.b,h.e).count,14);
 assert.equal(h.e.s.def,h.e.base.def*3.8);changeEnemyEnergy(h.b,h.e,6);h.run(10);assert.equal(enemyEnergy(h.b,h.e).count,20);h.run(10.2);assert.equal(enemyEnergy(h.b,h.e).count,0);assert.deepEqual(h.b.errors,[]);
});
for(const id of ids.filter(id=>id.includes('eghost')))test(`${id}: the source no-attack, unblockable body stays so even in overload`,()=>{
 const h=fixture(id),attacks=[];h.b.on('attack',c=>{if(c.attacker===h.e)attacks.push(c);});assert.equal(h.b._checkBlock(h.e),false);changeEnemyEnergy(h.b,h.e,5);h.run(2);
 assert.equal(h.e.blockedBy,null);assert.equal(attacks.length,0);assert.equal(h.g.hp,h.g.s.maxHp);assert.deepEqual(h.b.errors,[]);
});
for(const id of ids.filter(id=>!id.includes('eghost')))test(`${id}: melee uses its native release marker and current energy ATK`,()=>{
 const h=fixture(id),hits=[],attacks=[];changeEnemyEnergy(h.b,h.e,1);h.b.on('attack',c=>{if(c.attacker===h.e)attacks.push(h.b.time);});h.b.on('damaged',c=>{if(c.source===h.e)hits.push({time:h.b.time,type:c.dmg.type,loss:c.hpLoss});});
 assert.ok(h.runUntil(()=>hits.length===1,3));assert.equal(hits[0].type,'phys');assert.equal(hits[0].loss,h.e.base.atk*(1+(id.includes('esheld')?16:1)*.1));
 assert.ok(Math.abs(hits[0].time-attacks[0]-(id.includes('esheld')?.8:.4))<h.b.dt*1.2);assert.deepEqual(h.b.errors,[]);
});
test('source admission refuses different energy formulas, overflow policies, finish programs and decay guards',()=>{
 for(const id of ids)for(const edit of[
  n=>n.$buff('act28side_energy_buff').attributes.attributeModifiers[0].value=.2,
  n=>n.$buff('act28side_over_energy_buff').attributes.attributeModifiers[1].formulaItem='MULTIPLIER',
  n=>n.blacksteel_energy.find(v=>'_buff'in v)._overEnergied=0,
  n=>n.$template('enemy_esabr_clear_energy').eventToActions.ON_BUFF_START[1]._value=1,
  n=>n.$ref(n[id].find(v=>'_modes'in v)._commonAbilities[0])._buffs[0].attributes.abnormalFlags=[5],
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n);assert.equal(energyNative(records.enemies[id].levels[0],n),false);}
 const n=nativeComponents(structuredClone(evidence),ids[4]);n.$template('enemy_esheld_dec_energy[trigger]').eventToActions.ON_BUFF_TRIGGER[2].$type='Unknown';assert.equal(energyNative(records.enemies[ids[4]].levels[0],n),false);
});
