// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import native from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {inspirationNative,isNativeInspiration,INSPIRATION_MARKER as marker} from '../shared/arkpedia/enemy-inspiration-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle,enemyRec} from './helpers/battleHarness.js';
const herald='enemy_1080_sotidp',leader='enemy_1080_sotidp_2',fighter='enemy_1078_sotisc',mortar='enemy_1082_soticn',siege='enemy_1083_sotiab',archer='enemy_1079_sotisp';
const ids=Object.entries(records.enemies).filter(([,e])=>isNativeInspiration(e.levels[0])).map(([id])=>id);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function fixture(compiled=true){
 const entries=[...ids,archer].map(id=>[id,compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0]]);
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,defs:{enemies:{...Object.fromEntries(entries),plain:enemyRec({key:'plain',atk:100,speed:0})}},setup:installEnemyFeatures});
 h.b.start();const spawn=id=>{const e=h.b.spawnEnemy(id,{pos:[10,6]});e.profile.noAttack=true;h.b.addBuff(e,{key:'test:hold',flags:{noMove:true}});return e;};
 return{...h,spawn};
}
test('every producer and stat receiver retains its native marker, stack, binding and quarter-second clock contract',()=>{
 for(const id of ids)assert.ok(inspirationNative(records.enemies[id].levels[0],nativeComponents(native,id)),id);
});
for(const compiled of[false,true])test(`Heralds reach all stat receivers and extra-target consumers (${compiled?'compiled':'raw'})`,()=>{
 const h=fixture(compiled),f=h.spawn(fighter),m=h.spawn(mortar),s=h.spawn(siege),a=h.spawn(archer);
 h.run(1.6);assert.equal(f.findBuff(marker),null);const source=h.spawn(herald);
 assert.ok(f.findBuff(marker));h.run(.1);assert.equal(f.findBuff('enemy_talent_strength[move_speed]'),null);h.run(.2);
 close(f.s.moveSpeed,f.base.moveSpeed*1.3);close(m.s.aspd,m.base.aspd+50);close(s.s.atk,s.base.atk*1.6);
 assert.equal(a.profile.maxTargets,2);assert.ok(source.findBuff(marker));assert.deepEqual(h.b.errors,[]);
});
test('two Heralds stack their stat grants while one marker and one receiver bonus survive a source death',()=>{
 const h=fixture(),u=h.spawn(siege);h.run(1.6);const a=h.spawn(herald),b=h.spawn(leader);h.run(.3);
 close(u.s.atk,u.base.atk*1.7);assert.equal(u.buffs.filter(v=>v.key===`${marker}[attribute]`).length,2);
 assert.equal(u.buffs.filter(v=>v.key===marker).length,1);assert.equal(u.buffs.filter(v=>v.key==='enemy_talent_strength[atk]').length,1);
 h.b.kill(a);close(u.s.atk,u.base.atk*1.6);assert.ok(u.findBuff(marker));assert.equal(u.findBuff(marker).source,b);
 h.b.kill(b);assert.equal(u.findBuff(marker),null);close(u.s.atk,u.base.atk*1.5);h.run(.3);close(u.s.atk,u.base.atk);
 assert.deepEqual(h.b.errors,[]);
});
test('recipients spawned after a Herald receive both grants without an artificial Inspiration marker',()=>{
 const h=fixture();h.spawn(herald);const u=h.spawn(fighter);assert.ok(u.findBuff(marker));h.run(.3);
 assert.ok(u.findBuff('enemy_talent_strength[move_speed]'));close(u.s.atk,u.base.atk*1.1);assert.deepEqual(h.b.errors,[]);
});
test('receiver listeners keep their native clocks through silence and freezing',()=>{
 const h=fixture(),u=h.spawn(fighter);h.b.applyStatus(u,'freeze',{duration:5});h.b.applyStatus(u,'silence',{duration:5});
 const s=h.spawn(herald);h.b.applyStatus(s,'silence',{duration:5});h.run(.3);close(u.s.moveSpeed,u.base.moveSpeed*1.3);
 h.b.kill(s);h.run(.3);close(u.s.moveSpeed,u.base.moveSpeed);assert.deepEqual(h.b.errors,[]);
});
test('a hidden source retains its global aura; isolated or hidden recipients release their owned grants',()=>{
 const h=fixture(),u=h.spawn(fighter),s=h.spawn(herald);h.run(.3);s.hidden=true;h.run(.1);assert.ok(u.findBuff(marker));
 h.b.addBuff(u,{key:'test:isolate',flags:{isolated:true}});h.run(.3);assert.equal(u.findBuff(marker),null);close(u.s.atk,u.base.atk);
 h.b.removeBuff(u,'test:isolate');h.run(.3);assert.ok(u.findBuff(marker));u.hidden=true;h.run(.3);assert.equal(u.findBuff(marker),null);
 assert.deepEqual(h.b.errors,[]);
});
test('a rejected marker does not create a receiver bonus merely because the stat grant succeeded',()=>{
 const h=fixture(),u=h.spawn(siege);h.run(1.6);h.b.on('beforeBuff',c=>{if(c.unit===u&&c.buff.key===marker)c.cancel=true;});
 h.spawn(herald);h.run(.4);assert.equal(u.findBuff(marker),null);assert.equal(u.findBuff('enemy_talent_strength[atk]'),null);
 close(u.s.atk,u.base.atk*1.1);assert.deepEqual(h.b.errors,[]);
});
test('old pinned private-marker strength plans remain executable after moving out of the legacy catalogue',()=>{
 const h=fixture(),u=h.spawn('plain');
 const plan={schemaVersion:1,properties:{},entries:[{id:'native:oldInspiration',ability:{kind:'strengthAura',params:{mode:'inspired',atkPct:.5}}}]};
 // Apply a historical plan directly to the already spawned plain fixture.
 return import('../server/sim/content/arkpedia-enemy-plan.js').then(async({applyCompiledEnemyFeatures})=>{
  const{strengthAura}=await import('../server/sim/content/arkpedia-enemy-inspiration.js');
  applyCompiledEnemyFeatures(h.b,u,plan,()=>strengthAura);h.b.addBuff(u,{key:'ab:inspired'});h.run(.1);
  close(u.s.atk,u.base.atk*1.5);assert.deepEqual(h.b.errors,[]);
 });
});
test('source admission refuses changed marker selectors, stacking, listener timing and hidden gameplay in child buffs',()=>{
 for(const[id,change]of[
  [herald,n=>n.Strength.find(c=>'_buffs'in c)._buffs[0].disableOverride=0],
  [herald,n=>n.Strength.find(c=>'_buffs'in c)._clearBuffsWhenDisappear=1],
  [fighter,n=>n.Strength.find(c=>'_buffs'in c)._buffs[0].triggerInterval=.5],
  [fighter,n=>n.$template('enemy_strength_talent_start_listener[move_speed]').eventToActions.ON_BUFF_TRIGGER[0]._buffKeys=['wrong']],
  [fighter,n=>n.$template('enemy_strength_talent_start_listener[move_speed]').eventToActions.ON_BUFF_TRIGGER[3]._buff.isSilenceable=true],
  [fighter,n=>n.$template('enemy_strength_talent_start_listener[move_speed]').eventToActions.ON_BUFF_TRIGGER[3]._buff.unknownMechanic=true],
 ]){const n=nativeComponents(structuredClone(native),id);change(n);assert.equal(inspirationNative(records.enemies[id].levels[0],n),false);}
});
