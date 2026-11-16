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
import {createEnemyRuntime} from '../server/sim/content/arkpedia-enemy-runtime.js';
import {applyCompiledEnemyFeatures} from '../server/sim/content/arkpedia-enemy-plan.js';
import {nativeEnergySiphon} from '../server/sim/content/arkpedia-enemy-energy-siphon.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1357_erob','enemy_1357_erob_2'],donorId='enemy_1353_esabr';
function fixture(id=ids[0],compiled=true,guard=false){
 const g=chessRec({id:'energy_siphon_guard',stats:{maxHp:1e6,atk:0,def:0,blockCnt:5},skill:null});
 const defs=Object.fromEntries([...ids,donorId].map(k=>[k,compiled?withCompiledEnemyRuntime(records.enemies[k].levels[0]):records.enemies[k].levels[0]]));
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:defs,chess:{[g.chessId]:g}},units:guard?[{chessId:g.chessId,row:10,col:6}]:[],kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();
 const spawn=(key,pos)=>{const e=h.b.spawnEnemy(key,{pos});h.b.addBuff(e,{key:'hold',flags:{noMove:true}});return e;};
 const e=spawn(id,[10,6]);return{...h,e,spawn,donor:(pos=[10,7],energy=4)=>{const u=spawn(donorId,pos);changeEnemyEnergy(h.b,u,energy);return u;}};
}
for(const id of ids){
 test(`${id}: checked source composes meter, siphon and native melee clock`,()=>{
  assert.equal(energyNative(records.enemies[id].levels[0],nativeComponents(evidence,id)),true);
  const p=withCompiledEnemyRuntime(records.enemies[id].levels[0]).runtimeFeatures;
  assert.deepEqual(p.entries.map(e=>e.ability.kind),['nativeEnergyMeter','nativeEnergySiphon','animatedMeleeAttack']);
  assert.equal(p.entries[2].ability.params.animation.releases[0],Math.fround(40/30));
 });
 test(`${id}: first pulse waits two seconds and drains each eligible donor, updating both actors' stats`,()=>{
  for(const compiled of[false,true]){const h=fixture(id,compiled),a=h.donor(),b=h.donor([11,6]);h.run(1.9);assert.equal(enemyEnergy(h.b,h.e).count,0);h.run(.2);
   assert.equal(enemyEnergy(h.b,h.e).count,2);assert.equal(enemyEnergy(h.b,a).count,3);assert.equal(enemyEnergy(h.b,b).count,3);
   assert.equal(h.e.s.atk,h.e.base.atk*1.2);assert.equal(a.s.def,a.base.def*1.6);assert.deepEqual(h.b.errors,[]);}
 });
 test(`${id}: melee uses the retained animation event and current energy attack`,()=>{
  const h=fixture(id,true,true),hits=[],casts=[];changeEnemyEnergy(h.b,h.e,1);
  h.b.on('attack',c=>{if(c.attacker===h.e)casts.push(h.b.time);});h.b.on('damaged',c=>{if(c.source===h.e)hits.push({time:h.b.time,loss:c.hpLoss});});
  assert.ok(h.runUntil(()=>hits.length===1,3));assert.equal(hits[0].loss,h.e.base.atk*1.1);assert.ok(Math.abs(hits[0].time-casts[0]-40/30)<h.b.dt*1.2);assert.deepEqual(h.b.errors,[]);
 });
}
test('radius is evaluated from current positions; unmarked, overloaded and immune donors are excluded',()=>{
 const h=fixture(),near=h.donor([10,8.19]),far=h.donor([10,8.21]),empty=h.donor([11,6],0),over=h.donor([9,6],10),unmarked=h.donor([10,5]),immune=h.spawn(ids[1],[11,7]);
 changeEnemyEnergy(h.b,immune,4);h.b.removeBuff(immune,'enemy_erob_steal_energy_ability');h.b.removeBuff(unmarked,'blacksteel_energy[mark]');h.run(2.1);
 assert.equal(enemyEnergy(h.b,h.e).count,1);for(const u of[far,unmarked,immune])assert.equal(enemyEnergy(h.b,u).count,4);
 assert.equal(enemyEnergy(h.b,empty).count,0);assert.equal(enemyEnergy(h.b,over).count,10);assert.equal(enemyEnergy(h.b,near).count,3);
 far.x=7;h.run(2);assert.equal(enemyEnergy(h.b,h.e).count,3);assert.deepEqual(h.b.errors,[]);
});
test('literal all-motion selector accepts a marked airborne donor; pulse ignores silence and stun',()=>{
 const h=fixture(),d=h.donor();d.motion='FLY';h.b.applyStatus(h.e,'silence',{duration:10});h.b.applyStatus(h.e,'stun',{duration:10});h.run(2.1);
 assert.equal(enemyEnergy(h.b,h.e).count,1);assert.equal(enemyEnergy(h.b,d).count,3);assert.deepEqual(h.b.errors,[]);
});
test('a captured pulse completes at capacity, while later pulses are suppressed by overload',()=>{
 const h=fixture(),a=h.donor(),b=h.donor([11,6]);changeEnemyEnergy(h.b,h.e,19);h.run(2.1);
 assert.deepEqual(enemyEnergy(h.b,h.e),{count:20,capacity:20,overloaded:true});assert.equal(enemyEnergy(h.b,a).count,3);assert.equal(enemyEnergy(h.b,b).count,3);
 h.run(2);assert.equal(enemyEnergy(h.b,a).count,3);assert.equal(enemyEnergy(h.b,b).count,3);assert.deepEqual(h.b.errors,[]);
});
test('parent removal, death and leakage stop siphoning; separate battles retain separate ownership',()=>{
 for(const action of['remove','kill','leak']){const h=fixture(),d=h.donor();if(action==='remove')h.b.removeBuff(h.e,'enemy_erob_steal_energy_ability');else h.b[action](h.e);
 h.run(2.1);assert.equal(enemyEnergy(h.b,d).count,4);if(action!=='remove')assert.equal(h.e.findBuff('erob_immune_steal'),null);assert.deepEqual(h.b.errors,[]);}
 const a=fixture(),b=fixture();a.donor();a.run(2.1);assert.equal(enemyEnergy(a.b,a.e).count,1);assert.equal(enemyEnergy(b.b,b.e).count,0);
});
test('source gates refuse altered motion, receiver binding, transfer signs and immunity guards',()=>{
 for(const template of ['enemy_erob_steal_energy_ability','enemy_erob_steal_energy']){
  const n=nativeComponents(structuredClone(evidence),ids[0]);n.$template(template).eventToActions.ON_BUFF_TRIGGER?.push({$type:'unhandled'});
  if(template.endsWith('energy'))n.$template(template).eventToActions.ON_BUFF_START[2]._buffKeys=['wrong'];
  assert.equal(energyNative(records.enemies[ids[0]].levels[0],n),false);
 }
 const n=nativeComponents(structuredClone(evidence),ids[0]);n.steal_energy.find(v=>v._buffs)._buffs[0].isSilenceable=1;assert.equal(energyNative(records.enemies[ids[0]].levels[0],n),false);
});
test('selected loading refuses absent or late energy providers before any trait mutates the actor',async()=>{
 for(const reverse of[false,true]){const r=withCompiledEnemyRuntime(records.enemies[ids[0]].levels[0]);if(reverse)r.runtimeFeatures.entries.reverse();else r.runtimeFeatures.entries.shift();
  await assert.rejects(createEnemyRuntime().prepare({[ids[0]]:r}),/Missing earlier enemy runtime service/);
  const plan={schemaVersion:1,properties:{},entries:[{id:'native:probe',trait:{flags:{unblockable:true}},ability:r.runtimeFeatures.entries.find(e=>e.ability.kind==='nativeEnergySiphon').ability}]};let touched=false;
  assert.throws(()=>applyCompiledEnemyFeatures({addBuff:()=>{touched=true;}},{},plan,()=>nativeEnergySiphon),/Missing earlier enemy runtime service/);assert.equal(touched,false);
 }
});
test('a source killed by an attachment callback leaves no new siphon or immunity behind',()=>{
 for(const key of['erob_immune_steal','enemy_erob_steal_energy_ability']){
  const h=fixture(),donor=h.donor(),off=h.b.on('beforeBuff',c=>{if(c.buff.key===key&&c.unit!==donor)h.b.kill(c.unit);});
  const e=h.spawn(ids[1],[11,6]);h.b.off(off);assert.equal(e.alive,false);assert.equal(e.findBuff('erob_immune_steal'),null);assert.equal(e.findBuff('enemy_erob_steal_energy_ability'),null);
  h.run(2.1);assert.equal(enemyEnergy(h.b,donor).count,3);assert.deepEqual(h.b.errors,[]);
 }
});
