// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {nightCrawlerNative} from '../shared/arkpedia/enemy-night-crawler-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle} from './helpers/battleHarness.js';
const ids=['enemy_1178_dscorp','enemy_1178_dscorp_2'];
function fixture(id=ids[0],compiled=true){
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0]}},setup:installEnemyFeatures});
 h.b.start();const context={mask:0};h.b.environmentConditions={maskAt:()=>context.mask};const e=h.b.spawnEnemy(id,{pos:[10,6]});
 h.b.addBuff(e,{key:'hold',flags:{noMove:true}});return{...h,e,context};
}
for(const id of ids){
 test(`${id}: native visibility condition and additive movement modifier compile as reusable data`,()=>{
  assert.ok(nightCrawlerNative(records.enemies[id].levels[0],nativeComponents(evidence,id)));
  assert.ok(withCompiledEnemyRuntime(records.enemies[id].levels[0]).runtimeFeatures.entries.some(e=>e.ability?.kind==='environmentStatBonus'));
 });
 test(`${id}: condition bit eight enables one owned 30-percent speed bonus and clears when visibility returns`,()=>{
  for(const compiled of[false,true]){
   const h=fixture(id,compiled),base=h.e.s.moveSpeed;h.run(.2);assert.equal(h.e.s.moveSpeed,base);
   h.context.mask=8;h.run(.2);assert.equal(h.e.s.moveSpeed,base*1.3);h.run(1);
   assert.equal(h.e.buffs.filter(b=>b.key==='dscorp_night_buff').length,1);
   h.b.addBuff(h.e,{key:'other-speed',mods:{movePct:.2}});assert.equal(h.e.s.moveSpeed,base*1.5);
   h.context.mask=1;h.run(.2);assert.equal(h.e.s.moveSpeed,base*1.2);assert.equal(h.e.findBuff('dscorp_night_buff'),null);
   h.context.mask=9;h.run(.2);assert.equal(h.e.s.moveSpeed,base*1.5);assert.deepEqual(h.b.errors,[]);
  }
 });
 test(`${id}: silence disables the source-silenceable benefit; ordinary control does not`,()=>{
  const h=fixture(id),base=h.e.s.moveSpeed;h.context.mask=8;h.run(.1);assert.equal(h.e.s.moveSpeed,base*1.3);
  h.b.applyStatus(h.e,'silence',{duration:.5});h.run(.1);assert.equal(h.e.s.moveSpeed,base);
  h.run(.6);assert.equal(h.e.s.moveSpeed,base*1.3);h.b.applyStatus(h.e,'freeze',{duration:.5});h.run(.1);
  assert.equal(h.e.s.moveSpeed,base*1.3);h.context.mask=0;h.run(.1);assert.equal(h.e.findBuff('dscorp_night_buff'),null);
  assert.deepEqual(h.b.errors,[]);
 });
}
test('an absent stage provider supplies no invented darkness; the source cleans only its own bonus at death',()=>{
 const h=fixture(),base=h.e.s.moveSpeed;delete h.b.environmentConditions;h.run(.2);assert.equal(h.e.s.moveSpeed,base);
 h.b.environmentConditions={maskAt:()=>8};h.run(.1);assert.ok(h.e.findBuff('dscorp_night_buff'));h.b.kill(h.e);assert.equal(h.e.findBuff('dscorp_night_buff'),null);
});
test('only the ordinary variant has the source killed-result passive; leakage and the elite do not invent one',()=>{
 const h=fixture();h.b.kill(h.e);assert.equal(h.b.stageOutcomes?.counters.killed,1);h.b.kill(h.e);assert.equal(h.b.stageOutcomes.counters.killed,1);
 const elite=fixture(ids[1]);elite.b.kill(elite.e);assert.equal(elite.b.stageOutcomes,undefined);
 const leak=fixture();leak.b._remove(leak.e,'leak');assert.equal(leak.b.stageOutcomes,undefined);
});
test('source admission rejects different condition bits, silence scope, stat formula or logging scope',()=>{
 for(const id of ids)for(const edit of[
  n=>n.$ref(n.NightBuff.find(c=>'_checker'in c)._checker)._condition._toggleOnMask=4,
  n=>n.NightBuff.find(c=>'_checker'in c)._buffs[0].isSilenceable=0,
  n=>n.NightBuff.find(c=>'_checker'in c)._buffs[0].attributes.attributeModifiers[0].formulaItem=2,
  n=>n[id].find(c=>'_modes'in c)._commonAbilities.push({m_FileID:0,m_PathID:'unknown'}),
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n);assert.equal(nightCrawlerNative(records.enemies[id].levels[0],n),false);}
});
