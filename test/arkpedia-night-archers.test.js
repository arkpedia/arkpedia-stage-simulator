// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {nightArcherNative} from '../shared/arkpedia/enemy-night-archer-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1179_aruarw','enemy_1179_aruarw_2'],key='enemy_aruarw_check';
function fixture(id=ids[0],compiled=true){
 const guard=chessRec({id:'night_mode_guard',stats:{maxHp:1e6,atk:0,def:1000,res:25,blockCnt:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0]},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:10,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
 const state={mask:0};h.b.environmentConditions={maskAt:()=>state.mask};h.b.start();
 const e=h.b.spawnEnemy(id,{pos:[10,5]}),g=h.b.allyUnits[0],hits=[],attacks=[];h.b.addBuff(e,{key:'hold',flags:{noMove:true}});
 h.b.on('damaged',c=>{if(c.source===e&&c.target===g)hits.push({time:h.b.time,amount:c.hpLoss,type:c.dmg.type});});
 h.b.on('attack',c=>{if(c.attacker===e)attacks.push({time:h.b.time,mode:e.mem.projectileModeIndex});});
 return{...h,e,g,state,hits,attacks};
}
const nextHit=h=>{const count=h.hits.length;assert.ok(h.runUntil(()=>h.hits.length>count,8));return h.hits[count];};
for(const id of ids){
 test(`${id}: source mode program and native packets compile through one selected projectile-mode component`,()=>{
  const r=records.enemies[id].levels[0];assert.ok(nightArcherNative(r,nativeComponents(evidence,id)));
  const p=withCompiledEnemyRuntime(r).runtimeFeatures;assert.ok(p.entries.some(e=>e.ability?.kind==='programmedProjectileModes'));
 });
 test(`${id}: the owner's visibility controls physical/Arts mode at attack boundaries`,()=>{
  for(const compiled of[false,true]){
   const h=fixture(id,compiled);h.b.environmentConditions={maskAt:u=>u===h.e?h.state.mask:8};
   const physical=nextHit(h);assert.equal(physical.type,'phys');assert.equal(physical.amount,Math.max(h.e.s.atk-h.g.s.def,h.e.s.atk*.05));
   assert.equal(h.e.mem.projectileModeIndex,1);h.state.mask=8;h.run(.1);assert.equal(h.e.mem.projectileModeIndex,1);
   const arts=nextHit(h);assert.equal(arts.type,'arts');assert.equal(arts.amount,h.e.s.atk*.75);assert.equal(h.e.mem.projectileModeIndex,0);
   h.state.mask=0;assert.equal(nextHit(h).type,'phys');assert.deepEqual(h.b.errors,[]);
  }
 });
 test(`${id}: silence disables future Arts casts while a captured, non-interruptible cast keeps its packet`,()=>{
  const h=fixture(id);h.state.mask=8;assert.ok(h.runUntil(()=>h.attacks.length===1,1));h.run(.2);
  h.b.applyStatus(h.e,'silence',{duration:10});assert.equal(h.e.mem.projectileModeIndex,1);
  assert.equal(nextHit(h).type,'arts');assert.equal(nextHit(h).type,'phys');assert.ok(h.e.findBuff(key));assert.deepEqual(h.b.errors,[]);
 });
}
test('parent-passive removal disables the mode program and cannot leave a permanent Arts override',()=>{
 const h=fixture();h.state.mask=8;assert.equal(nextHit(h).type,'arts');h.b.removeBuff(h.e,key);assert.equal(h.e.mem.projectileModeIndex,1);
 assert.equal(nextHit(h).type,'phys');assert.deepEqual(h.b.errors,[]);
});
test('native animation release uses the shared clock, death cancels pending shots, and released shots survive death',()=>{
 const h=fixture();h.state.mask=8;assert.ok(h.runUntil(()=>h.attacks.length===1,1));assert.ok(h.runUntil(()=>h.b.projectiles.list.length>0,1));
 assert.ok(Math.abs(h.b.time-h.attacks[0].time-.7)<h.b.dt*1.2);h.b.kill(h.e);assert.equal(nextHit(h).type,'arts');assert.deepEqual(h.b.errors,[]);
 const pending=fixture();pending.state.mask=8;assert.ok(pending.runUntil(()=>pending.attacks.length===1,1));pending.b.kill(pending.e);pending.run(2);
 assert.equal(pending.hits.length,0);assert.equal(pending.b.projectiles.list.length,0);assert.deepEqual(pending.b.errors,[]);
});
test('only the ordinary variant retains the native killed-result receipt',()=>{
 const ordinary=fixture();ordinary.b.kill(ordinary.e);assert.equal(ordinary.b.stageOutcomes?.counters.killed,1);
 const elite=fixture(ids[1]);elite.b.kill(elite.e);assert.equal(elite.b.stageOutcomes,undefined);
});
test('source admission refuses changed mode roles, parent silence scope, opaque FX gameplay and projectile lifetime',()=>{
 for(const id of ids)for(const edit of[
  n=>n.Passive.find(c=>'_buffs'in c)._buffs[0].isSilenceable=0,
  n=>{const root=n[id].find(c=>'_modes'in c);n.$ref(n.$ref(root._modes[0])._attack)._damageType=1;},
  n=>n.$template(key).eventToActions.ON_BUFF_DISABLE[1]._modeIndex=0,
  n=>n.NightBuff.find(c=>'_checker'in c)._buffs[0].attributes.abnormalFlags.push(9),
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n);assert.equal(nightArcherNative(records.enemies[id].levels[0],n),false);}
 const changed=nativeComponents(structuredClone(evidence),ids[0]);changed.$template('aruarw_night_buff_effect_holder').eventToActions.ON_BUFF_START[0]._buff.attributes.abnormalFlags.push('INVISIBLE');
 assert.equal(nightArcherNative(records.enemies[ids[0]].levels[0],changed),false);
});
test('separate owners sharing a compiled mode program retain independent current modes and packets',()=>{
 const h=fixture(),second=h.b.spawnEnemy(ids[0],{pos:[11,5]});h.b.addBuff(second,{key:'hold',flags:{noMove:true}});
 h.b.environmentConditions={maskAt:u=>u===second?8:0};const received=[];
 h.b.on('damaged',c=>{if(c.target===h.g&&[h.e,second].includes(c.source))received.push([c.source,c.dmg.type]);});
 h.run(1.2);assert.equal(h.e.mem.projectileModeIndex,1);assert.equal(second.mem.projectileModeIndex,0);
 assert.ok(received.some(([u,type])=>u===h.e&&type==='phys'));assert.ok(received.some(([u,type])=>u===second&&type==='arts'));
 assert.deepEqual(h.b.errors,[]);
});
