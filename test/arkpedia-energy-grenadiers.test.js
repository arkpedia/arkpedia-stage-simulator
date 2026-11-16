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
const ids=['enemy_1359_ekulsr','enemy_1359_ekulsr_2'];
function fixture(id=ids[0],blocked=false,compiled=true){
 const guard=chessRec({id:'energy_grenade_guard',stats:{maxHp:1e6,atk:0,def:0,blockCnt:blocked?5:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0]},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:10,col:6},{chessId:guard.chessId,row:11,col:7},{chessId:guard.chessId,row:10,col:8},{chessId:guard.chessId,row:9,col:6}],
  kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();
 h.b.addBuff(h.b.allyUnits[0],{key:'fixture:primary',mods:{taunt:1}});
 const e=h.b.spawnEnemy(id,{pos:[10,blocked?6:4]});h.b.addBuff(e,{key:'hold',flags:{noMove:true}});if(blocked)assert.equal(h.b._checkBlock(e),true);
 const hits=[],attacks=[];h.b.on('attack',c=>{if(c.attacker===e)attacks.push({time:h.b.time,clip:e.mem.regularFormVisual?.clip});});
 h.b.on('damaged',c=>{if(c.source===e)hits.push({unit:c.target,time:h.b.time,type:c.dmg.type,loss:c.hpLoss});});
 return{...h,e,guards:h.b.allyUnits,hits,attacks};
}
for(const id of ids){
 test(`${id}: the native ranged/melee body composes the shared meter, with separate acquisition and blast motion rules`,()=>{
  assert.ok(energyNative(records.enemies[id].levels[0],nativeComponents(evidence,id)));
  const p=withCompiledEnemyRuntime(records.enemies[id].levels[0]).runtimeFeatures;assert.deepEqual(p.entries.map(e=>e.ability?.kind),['nativeEnergyMeter','blockedMeleeProjectileModes']);
  const a=p.entries[1].ability.params;assert.equal(a.groundOnly,true);assert.equal(a.noAir,false);assert.equal(a.damageScale,.5);
 });
 test(`${id}: begins at 25/30, decays every five seconds, and uses the common overload duration`,()=>{
  const h=fixture(id);h.run(4.9);assert.equal(enemyEnergy(h.b,h.e).count,25);h.run(.2);assert.equal(enemyEnergy(h.b,h.e).count,24);
  changeEnemyEnergy(h.b,h.e,6);assert.equal(enemyEnergy(h.b,h.e).overloaded,true);h.run(10);assert.equal(enemyEnergy(h.b,h.e).count,30);h.run(10.2);assert.equal(enemyEnergy(h.b,h.e).count,0);assert.deepEqual(h.b.errors,[]);
 });
 test(`${id}: unblocked, a ground input receives the 50-percent projectile and the 3x3 collision box reaches nearby flyers`,()=>{
  for(const compiled of[false,true]){
   const h=fixture(id,false,compiled);h.guards[3].motion='FLY';assert.ok(h.runUntil(()=>h.hits.length===3,3));
   assert.equal(h.attacks[0].clip,'Attack');assert.ok(Math.abs(h.hits[0].time-h.attacks[0].time-(31/30+2/5))<h.b.dt*2);
   for(const g of h.guards)assert.equal(g.s.maxHp-g.hp,g.tileC===8?0:h.e.base.atk*3.5*.5);
   assert.ok(h.hits.every(hit=>hit.type==='phys'));assert.deepEqual(h.b.errors,[]);
  }
 });
 test(`${id}: a blocker receives the full native Combat hit with no grenade or collateral damage`,()=>{
  for(const compiled of[false,true]){
   const h=fixture(id,true,compiled);assert.ok(h.runUntil(()=>h.hits.length===1,2));assert.equal(h.attacks[0].clip,'Combat');
   assert.equal(h.hits[0].unit,h.guards[0]);assert.equal(h.hits[0].loss,h.e.base.atk*3.5);assert.ok(Math.abs(h.hits[0].time-h.attacks[0].time-25/30)<h.b.dt*1.2);
   assert.equal(h.b.projectiles.list.length,0);for(const g of h.guards.slice(1))assert.equal(g.hp,g.s.maxHp);assert.deepEqual(h.b.errors,[]);
  }
 });
}
test('an air-only input set does not trigger grenades, although a released blast supports air recipients',()=>{
 const h=fixture();for(const g of h.guards)g.motion='FLY';h.run(3);assert.equal(h.attacks.length,0);assert.equal(h.hits.length,0);assert.deepEqual(h.b.errors,[]);
});
test('a captured ranged cast stays ranged when the source becomes blocked before release',()=>{
 const h=fixture();assert.ok(h.runUntil(()=>h.attacks.length===1,1));h.run(.2);h.b.addBuff(h.guards[0],{key:'block',mods:{blockCnt:5}});h.e.x=6;h.e.y=10;assert.equal(h.b._checkBlock(h.e),true);
 assert.ok(h.runUntil(()=>h.hits.length===3,2));assert.equal(h.attacks[0].clip,'Attack');assert.ok(h.hits.every(hit=>hit.loss===h.e.base.atk*3.5*.5));assert.deepEqual(h.b.errors,[]);
});
test('released grenade damage survives source death; source death before release cancels the pending action',()=>{
 const h=fixture();assert.ok(h.runUntil(()=>h.b.projectiles.list.length>0,2));h.b.kill(h.e);assert.ok(h.runUntil(()=>h.hits.length===3,1));assert.ok(h.hits.every(hit=>hit.loss===h.e.base.atk*3.5*.5));assert.equal(enemyEnergy(h.b,h.e),null);assert.deepEqual(h.b.errors,[]);
 const pending=fixture();assert.ok(pending.runUntil(()=>pending.attacks.length===1,1));pending.b.kill(pending.e);pending.run(2);assert.equal(pending.hits.length,0);assert.equal(pending.b.projectiles.list.length,0);assert.deepEqual(pending.b.errors,[]);
});
test('native source gates reject changed half damage, input filters, blast recipients, geometry and range references',()=>{
 for(const id of ids){
  const n=nativeComponents(structuredClone(evidence),id),mode=n.$ref(n[id].find(v=>v._modes)._modes[0]);n.$ref(mode._attack)._atkScale=1;assert.equal(energyNative(records.enemies[id].levels[0],n),false);
  for(const edit of[
   rows=>{const r=rows.find(r=>JSON.parse(r.originalJson)._targetOptions),d=JSON.parse(r.originalJson);d._targetOptions.targetMotion=1;r.originalJson=JSON.stringify(d);},
   rows=>{const r=rows.find(r=>JSON.parse(r.originalJson).m_Size),d=JSON.parse(r.originalJson);d.m_Size.x=4;r.originalJson=JSON.stringify(d);},
   rows=>{const r=rows.find(r=>JSON.parse(r.originalJson)._rangeToLoad),d=JSON.parse(r.originalJson);d._rangeToLoad.m_FileID=1;r.originalJson=JSON.stringify(d);},
  ]){const changed=structuredClone(evidence);edit(changed.projectiles.projectile_enemy_ekulsr);assert.equal(energyNative(records.enemies[id].levels[0],nativeComponents(changed,id)),false);}
 }
});

test('the native blocking Combat input stays on its blocker despite a higher-taunt ranged target',()=>{
 const h=fixture(ids[0],true);h.b.addBuff(h.guards[1],{key:'fixture:foreign-taunt',mods:{taunt:100}});assert.ok(h.runUntil(()=>h.hits.length===1,2));
 assert.equal(h.hits[0].unit,h.guards[0]);assert.equal(h.attacks[0].clip,'Combat');assert.deepEqual(h.b.errors,[]);
});
test('selected runtime preparation rejects an invalid later grenade shape before any actor can attach its meter',async()=>{
 const {createEnemyRuntime}=await import('../server/sim/content/arkpedia-enemy-runtime.js');
 const r=withCompiledEnemyRuntime(records.enemies[ids[0]].levels[0]);r.runtimeFeatures.entries[1].ability.params.width=0;
 await assert.rejects(createEnemyRuntime().prepare({[ids[0]]:r}),/Invalid blocked projectile area/);
});
