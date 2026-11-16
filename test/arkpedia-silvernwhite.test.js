// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {silvernwhiteNative} from '../shared/arkpedia/enemy-silvernwhite-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle} from './helpers/battleHarness.js';
const id='enemy_2047_smtree',row=records.enemies[id].levels[0],key='enemy_smtree_passive';
function fixture(compiled=true){
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(row):row}},setup:installEnemyFeatures});
 h.b.start();return{...h,spawn:()=>h.b.spawnEnemy(id,{pos:[10,6]}),count:()=>h.b.stageOutcomes?.counters.alive_cnt};
}
test('Silvernwhite Bulwark compiles its source passive through shared body and owned presence components',()=>{
 assert.ok(silvernwhiteNative(row,nativeComponents(evidence,id)));
 assert.deepEqual(withCompiledEnemyRuntime(row).runtimeFeatures.entries.filter(e=>e.ability).map(e=>e.ability.kind),['passiveEnemyBody','stagePresenceGauge']);
});
test('one-second birth holds targeting/damage without inventing a Spine Start clip; the body then remains passive',()=>{
 for(const compiled of[false,true]){
  const h=fixture(compiled),e=h.spawn(),hp=e.hp,pos=[e.x,e.y];let attacks=0;h.b.on('attack',c=>{if(c.attacker===e)attacks++;});
  assert.equal(e.mem.regularFormVisual??null,null);assert.equal(h.count(),1);assert.ok(e.s.flags.untargetable);
  h.b.dealDamage(null,e,{amount:1000,type:'true',sourceless:true});assert.equal(e.hp,hp);
  h.run(1.1);assert.equal(e.findBuff('ab:passiveBirth'),null);assert.ok(!e.s.flags.untargetable);assert.equal(e.s.taunt,1);
  assert.ok(e.s.flags.noMove);assert.ok(e.s.flags.noDisplace);h.b.addBuff(e,{key:'foreign:move',mods:{moveFlat:2}});h.run(.2);assert.deepEqual([e.x,e.y],pos);assert.equal(h.b.push(e,4,{dir:{x:1,y:0}}),0);
  h.b.dealDamage(null,e,{amount:1000,type:'true',sourceless:true});assert.equal(e.hp,hp-1000);h.run(3);
  assert.deepEqual([e.x,e.y],pos);assert.equal(attacks,0);assert.deepEqual(h.b.errors,[]);
 }
});
test('each passive owns its protection, taunt and live contribution; removal/death/leak cannot release twice',()=>{
 const h=fixture(),first=h.spawn(),second=h.spawn();assert.equal(h.count(),2);h.b.kill(first);assert.equal(h.count(),1);
 h.b.removeBuff(second,key);assert.equal(h.count(),0);assert.ok(!second.s.flags.noDisplace);assert.equal(second.s.taunt,0);
 h.b.kill(second);assert.equal(h.count(),0);const third=h.spawn();assert.equal(h.count(),1);h.b.leak(third);assert.equal(h.count(),0);
 assert.deepEqual(h.b.stageOutcomes.events.map(e=>e.value),[1,1,-1,-1,1,-1]);assert.deepEqual(h.b.errors,[]);
});
test('a rejected native passive does not create an alive contribution or leave its owned effects behind',()=>{
 const h=fixture();h.b.on('beforeBuff',c=>{if(c.buff.key===key)c.cancel=true;});const e=h.spawn();h.run(1.1);
 assert.equal(h.count(),undefined);assert.equal(e.findBuff(key),null);assert.ok(!e.s.flags.noDisplace);assert.equal(e.s.taunt,0);
 assert.deepEqual(h.b.errors,[]);
});
test('source admission refuses changed body scope, passive flags, taunt formula or signed result receipts',()=>{
 for(const edit of[
  n=>n[id].find(c=>'_modes'in c)._delayToBorn=0,
  n=>n.Passive.find(c=>'_buffs'in c)._buffs[0].attributes.abnormalFlags.pop(),
  n=>n.Passive.find(c=>'_buffs'in c)._buffs[0].attributes.attributeModifiers[0].value=2,
  n=>n.Passive.find(c=>'_buffs'in c)._buffs[0].isSilenceable=1,
  n=>n.$template('enemy_smtree_log').eventToActions.ON_BUFF_FINISH[0]._additionValue=1,
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n);assert.equal(silvernwhiteNative(row,n),false);}
});
