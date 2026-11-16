// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {funliveCasterNative} from '../shared/arkpedia/enemy-funlive-caster-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {programmedProjectileModes} from '../server/sim/content/arkpedia-enemy-programmed-projectiles.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const id='enemy_5021_tmagfd',key='tmagfd_npc_effect';
function fixture(compiled=true){
 const guard=chessRec({id:'funlive_guard',stats:{maxHp:1e6,atk:0,def:1000,res:25,blockCnt:5},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0]},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:10,col:6},{chessId:guard.chessId,row:10,col:7},{chessId:guard.chessId,row:11,col:6},{chessId:guard.chessId,row:11,col:7}],
  kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,6]});h.b.addBuff(e,{key:'hold',flags:{noMove:true}});
 return{...h,e,guards:h.b.allyUnits};
}
test('the scenario caster admits its exact timed empty passive and native shared-skeleton/projectile binding',()=>{
 assert.ok(funliveCasterNative(records.enemies[id].levels[0],nativeComponents(evidence,id)));
 const p=withCompiledEnemyRuntime(records.enemies[id].levels[0]).runtimeFeatures;
 assert.deepEqual(p.entries.map(e=>e.ability?.kind),['programmedProjectileModes']);
 assert.equal(p.entries[0].ability.params.parentDuration,5);
});
test('the actual native marker exists for five seconds, without reattaching after expiry',()=>{
 for(const compiled of[false,true]){const h=fixture(compiled);assert.ok(h.e.findBuff(key));h.run(4.9);assert.ok(h.e.findBuff(key));h.run(.2);assert.equal(h.e.findBuff(key),null);h.run(6);assert.equal(h.e.findBuff(key),null);assert.deepEqual(h.b.errors,[]);}
});
test('death, leakage and early removal clean only this owned passive',()=>{
 for(const reason of['kill','leak']){const h=fixture();h.b[reason](h.e);assert.equal(h.e.findBuff(key),null);assert.deepEqual(h.b.errors,[]);}
 const h=fixture(),foreign=h.b.addBuff(h.e,{key:'foreign'});h.b.removeBuff(h.e,key);h.run(.2);assert.ok(h.e.buffs.includes(foreign));assert.equal(h.e.findBuff(key),null);
});
test('zero native ATK remains zero; no invented damaging attack is supplied for the scenario actor',()=>{
 const h=fixture();h.run(2);assert.equal(h.e.s.atk,0);for(const g of h.guards)assert.equal(g.hp,g.s.maxHp);assert.deepEqual(h.b.errors,[]);
});
test('an external ATK grant exposes the actual Arts cross packet at the native release clock, excluding diagonal tiles',()=>{
 for(const compiled of[false,true]){
  const h=fixture(compiled),attacks=[],hits=[];h.b.addBuff(h.e,{key:'fixture:grant',mods:{atkFlat:300}});
  h.b.on('attack',c=>{if(c.attacker===h.e)attacks.push(h.b.time);});h.b.on('damaged',c=>{if(c.source===h.e)hits.push({unit:c.target,time:h.b.time,type:c.dmg.type});});
  assert.ok(h.runUntil(()=>hits.length>=3,3));assert.ok(Math.abs(hits[0].time-attacks[0]-(17/30))<h.b.dt*1.2);
  for(const g of h.guards){const diagonal=g.tileR===11&&g.tileC===7;assert.equal(g.s.maxHp-g.hp,diagonal?0:225);}
  assert.deepEqual(hits.map(h=>h.type),['arts','arts','arts']);assert.deepEqual(h.b.errors,[]);
 }
});
test('the marker expiring does not cancel a cast or change its native single-mode packet',()=>{
 const h=fixture();h.run(5.2);assert.equal(h.e.findBuff(key),null);h.b.addBuff(h.e,{key:'fixture:grant',mods:{atkFlat:300}});
 const hp=h.guards[0].hp;assert.ok(h.runUntil(()=>h.guards[0].hp<hp,3));assert.equal(h.e.mem.projectileModeIndex,0);assert.deepEqual(h.b.errors,[]);
});
test('source gates refuse an active child template, shifted grid, gameplay flags and a changed elemental ratio',()=>{
 for(const edit of[
  n=>n.NpcEffect.find(c=>'_buffs'in c)._buffs[0].lifeTime=6,
  n=>n.NpcEffect.find(c=>'_buffs'in c)._buffs[0].attributes.abnormalFlags=[5],
  n=>n.$template('empty').eventToActions.ON_BUFF_START=[{$type:'UnknownGameplay'}],
  n=>n.$range('x-5').grids.push({row:1,col:1}),
  n=>n.$ref(n.$ref(n[id].find(c=>'_modes'in c)._modes[0])._attack)._epDamageRatio=.1,
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n);assert.equal(funliveCasterNative(records.enemies[id].levels[0],n),false);}
});
test('mode transport refuses malformed tile grids and nonfinite parent lifetimes before spawn',()=>{
 const params=withCompiledEnemyRuntime(records.enemies[id].levels[0]).runtimeFeatures.entries[0].ability.params;
 for(const edit of[p=>p.parentDuration=Infinity,p=>p.modes[0].tileOffsets.push({row:0,col:0}),p=>p.modes[0].tileOffsets[0].row=.5,p=>p.modes[0].tileOffsets[0].hidden=true]){
  const p=structuredClone(params);edit(p);assert.throws(()=>programmedProjectileModes.validate(p));
 }
});
test('a released cross projectile retains its cached packet after source death',()=>{
 const h=fixture();h.b.addBuff(h.e,{key:'fixture:grant',mods:{atkFlat:300}});assert.ok(h.runUntil(()=>h.b.projectiles.list.length>0,2));
 h.b.kill(h.e);h.run(.2);for(const g of h.guards)assert.equal(g.s.maxHp-g.hp,g.tileR===11&&g.tileC===7?0:225);assert.deepEqual(h.b.errors,[]);
});
