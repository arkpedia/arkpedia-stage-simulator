// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import {battle,keys}from'./helpers/ch17Harness.js';
const read=p=>JSON.parse(readFileSync(new URL('../data/'+p,import.meta.url)));
const native=read('candidates/arkpedia-ch16-native-abilities.json');
const templates=read('candidates/arkpedia-ch16-action-source.json').templates;
test('native miner healing copies live Medic ATK without a serialized scale or stat modifier',()=>{
 const t=JSON.parse(templates['mcreep_t[get_heal]'].originalJson),actions=JSON.parse(t.eventToActions._items.find(e=>e.key===2).value.SerializedState);
 const assign=actions.find(n=>n.$type.endsWith('+AssignAttributeToBB')),heal=actions.find(n=>n.$type.endsWith('+FixedValueHeal'));
 assert.equal(assign._attributeType,'ATK');assert.equal(assign._scaleVar,'');assert.equal(assign._blackboardKey,'value');assert.equal(heal._healValueKey,'value');
 const rows=native.prefabs['dyn/battle/prefabs/enemies/enemy_3010_mcreep.prefab'];
 const ability=JSON.parse(rows.find(r=>r.objectName==='GetHeal'&&!r.referenced).originalJson);
 assert.deepEqual(ability._buffs[0].attributes.attributeModifiers,[]);assert.deepEqual(ability._buffs[0].blackboard,[]);
 const validator=JSON.parse(rows.find(r=>r.pathId===ability._targetValidator.m_PathID).originalJson);
 assert.equal(validator._targetOptions.professionMask,8);assert.equal(ability._buffs[0].triggerInterval,1);
 const{h,e}=battle(keys[0],[{profession:'MEDIC',stats:{atk:400},rangeGrid:[[0,0],[0,1]]}]);
 e.hp=1000;h.run(.94);assert.equal(e.hp,1000);h.run(.1);assert.equal(e.hp,1400);
});
test('each in-range Medic contributes its current ATK independently of attacks or control',()=>{
 const{h,b,e}=battle(keys[0],[{profession:'MEDIC',stats:{atk:400},rangeGrid:[[0,0],[0,1]]},{profession:'MEDIC',stats:{atk:200},rangeGrid:[[0,0]]}]);
 e.hp=1000;h.run(1.01);assert.equal(e.hp,1600);
 const medic=h.allies()[0];b.addBuff(medic,{key:'live-atk',persist:true,mods:{atkFlat:100}});b.applyStatus(medic,'stun',5);
 h.run(1.01);assert.equal(e.hp,2300);assert.ok(h.allies().every(u=>u.stats.attacks===0));assert.deepEqual(b.errors,[]);
});
test('non-Medics, out-of-range and dead Medics supply no passive healing',()=>{
 for(const config of[{profession:'WARRIOR',rangeGrid:[[0,0],[0,1]]},{profession:'MEDIC',rangeGrid:[[0,0]]}]){
  const{h,e}=battle(keys[0],[{...config,stats:{atk:1000}}]);e.hp=1000;h.run(1.1);assert.equal(e.hp,1000);
 }
 const{h,b,e}=battle(keys[0],[{profession:'MEDIC',stats:{atk:400},rangeGrid:[[0,0],[0,1]]}]);e.hp=1000;b.kill(h.allies()[0],null);h.run(1.1);assert.equal(e.hp,1000);assert.deepEqual(b.errors,[]);
});
