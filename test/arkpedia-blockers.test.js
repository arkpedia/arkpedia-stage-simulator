// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {blockerNative} from '../shared/arkpedia/enemy-blocker-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {createEnemyRuntime} from '../server/sim/content/arkpedia-enemy-runtime.js';
import {nativeCircleStatAura} from '../server/sim/content/arkpedia-enemy-circle-aura.js';
import {makeBattle} from './helpers/battleHarness.js';
const ids=['enemy_1355_mrfly','enemy_1355_mrfly_2'];
function fixture(compiled=true){
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:Object.fromEntries(ids.map(id=>[id,compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0]]))},setup:installEnemyFeatures});h.b.start();
 const spawn=(id,pos)=>{const e=h.b.spawnEnemy(id,{pos});h.b.addBuff(e,{key:'fixture:hold',flags:{noMove:true}});return e;};
 const target=(pos=[10,7])=>{const e=h.b.spawnEnemy('slug',{pos});h.b.addBuff(e,{key:'fixture:hold',flags:{noMove:true}});return e;};return{...h,spawn,target};
}
for(const id of ids){
 test(`${id}: native non-attacking flyer compiles to one selected circle aura`,()=>{
  assert.equal(blockerNative(records.enemies[id].levels[0],nativeComponents(evidence,id)),true);
  assert.deepEqual(withCompiledEnemyRuntime(records.enemies[id].levels[0]).runtimeFeatures.entries.map(e=>e.ability?.kind),['nativeCircleStatAura']);
 });
 test(`${id}: grants thirty RES to nearby allies of either motion, excludes itself and never attacks`,()=>{
  for(const compiled of[false,true]){const h=fixture(compiled),e=h.spawn(id,[10,6]),t=h.target(),air=h.target([11,6]);air.motion='FLY';const hits=[];h.b.on('attack',c=>{if(c.attacker===e)hits.push(c);});h.run(.1);
   assert.equal(t.s.res,t.base.res+30);assert.equal(air.s.res,air.base.res+30);assert.equal(e.s.res,e.base.res);assert.equal(h.b._checkBlock(e),false);h.run(3);assert.equal(hits.length,0);assert.deepEqual(h.b.errors,[]);}
 });
}
test('live radius follows both source and recipients; a leaving recipient loses only the aura',()=>{
 const h=fixture(),e=h.spawn(ids[0],[10,6]),inside=h.target([10,8.49]),outside=h.target([10,8.51]);const foreign=h.b.addBuff(inside,{key:'foreign',mods:{resFlat:7}});h.run(.1);
 assert.equal(inside.s.res,inside.base.res+37);assert.equal(outside.s.res,outside.base.res);inside.x=9;outside.x=7;h.run(.1);assert.equal(inside.s.res,inside.base.res+7);assert.ok(inside.buffs.includes(foreign));assert.equal(outside.s.res,outside.base.res+30);
 e.x=12;h.run(.1);assert.equal(outside.s.res,outside.base.res);assert.deepEqual(h.b.errors,[]);
});
test('same-key auras do not stack and retain a surviving owner through silence, death and leakage',()=>{
 for(const action of['silence','kill','leak']){const h=fixture(),a=h.spawn(ids[0],[10,6]),b=h.spawn(ids[1],[11,6]),t=h.target();h.run(.1);assert.equal(t.s.res,t.base.res+30);
  if(action==='silence')h.b.applyStatus(a,'silence',{duration:1});else h.b[action](a);h.run(.1);assert.equal(t.s.res,t.base.res+30);assert.equal(t.buffs.filter(x=>x.key==='add_magicdef').length,1);
  h.b.kill(b);h.run(.1);assert.equal(t.s.res,t.base.res);if(action==='silence'){h.run(1);assert.equal(t.s.res,t.base.res+30);}assert.deepEqual(h.b.errors,[]);}
});
test('source silence suppresses its aura, while stun does not; recipient silence does not suppress the grant',()=>{
 const h=fixture(),e=h.spawn(ids[0],[10,6]),t=h.target();h.b.applyStatus(t,'silence',{duration:5});h.b.applyStatus(e,'stun',{duration:5});h.run(.1);assert.equal(t.s.res,t.base.res+30);
 h.b.applyStatus(e,'silence',{duration:.5});assert.equal(t.s.res,t.base.res);h.run(.6);assert.equal(t.s.res,t.base.res+30);assert.deepEqual(h.b.errors,[]);
});
test('same-side target-free differs from isolation; hidden, sleeping, removed and opposite-side bodies are excluded',()=>{
 const h=fixture(),e=h.spawn(ids[0],[10,6]),t=h.target();h.b.addBuff(t,{key:'target-free',flags:{targetFree:true}});h.run(.1);assert.equal(t.s.res,t.base.res+30);
 for(const flag of['isolated','sleep','untargetable']){h.b.addBuff(t,{key:'deny',flags:{[flag]:true}});h.run(.1);assert.equal(t.s.res,t.base.res);h.b.removeBuff(t,'deny');h.run(.1);assert.equal(t.s.res,t.base.res+30);}
 t.hidden=true;h.run(.1);assert.equal(t.s.res,t.base.res);t.hidden=false;t.side='ally';h.run(.1);assert.equal(t.s.res,t.base.res);assert.deepEqual(h.b.errors,[]);
});
test('the native DEFAULT | TRAP_OR_ITEM category reaches same-side devices and excludes obstacles',()=>{
 const h=fixture(),e=h.spawn(ids[0],[10,6]),device=h.b.spawnDevice('enemy-battery',10,7,{side:'enemy'}),ally=h.b.spawnDevice('ally-battery',11,7),obstacle=h.b.spawnDevice('enemy-obstacle',9,7,{side:'enemy',obstacle:true});h.run(.1);
 assert.equal(device.s.res,device.base.res+30);assert.equal(ally.s.res,ally.base.res);assert.equal(obstacle.s.res,obstacle.base.res);h.b.kill(e);assert.equal(device.s.res,device.base.res);assert.deepEqual(h.b.errors,[]);
});
test('a source dying during a child attachment leaves no orphaned RES grants',()=>{
 const h=fixture(),t=h.target(),off=h.b.on('beforeBuff',c=>{if(c.buff.key==='add_magicdef')h.b.kill(c.buff.source);});const e=h.spawn(ids[0],[10,6]);h.b.off(off);h.run(.1);
 assert.equal(e.alive,false);assert.equal(t.s.res,t.base.res);assert.equal(t.findBuff('add_magicdef'),null);assert.deepEqual(h.b.errors,[]);
});
test('source gates reject changed categories, silence binding, formula, removal policy and local geometry',()=>{
 for(const edit of[
  n=>n.magdef_add.find(v=>v._buffs)._selfOption=1,
  n=>n.magdef_add.find(v=>v._buffs)._removeBuffWhenTargetLeave=0,
  n=>n.magdef_add.find(v=>v._buffs)._buffs[0].attributes.attributeModifiers[0].formulaItem=1,
  n=>n.$siblings(n.magdef_add.find(v=>v._buffs)).find(v=>'_isSilenceable'in v)._isSilenceable=0,
  n=>n.$ref(n.magdef_add.find(v=>v._buffs)._targetValidator)._targetOptions.targetCategory=1,
  n=>n.$siblings(n.magdef_add.find(v=>v._buffs)).find(v=>'m_Radius'in v).m_Radius=3,
 ]){const n=nativeComponents(structuredClone(evidence),ids[0]);edit(n);assert.equal(blockerNative(records.enemies[ids[0]].levels[0],n),false);}
});
test('selected runtime loads the aura module alone and rejects malformed modifiers before spawn',async()=>{
 const r=withCompiledEnemyRuntime(records.enemies[ids[0]].levels[0]),runtime=createEnemyRuntime();await runtime.prepare({[ids[0]]:r});assert.deepEqual(runtime.stats().loaded,['arkpedia-enemy-circle-aura']);
 r.runtimeFeatures.entries[0].ability.params.mods.resFlat=NaN;await assert.rejects(async()=>createEnemyRuntime().prepare({[ids[0]]:r}));
 const p=withCompiledEnemyRuntime(records.enemies[ids[0]].levels[0]).runtimeFeatures.entries[0].ability.params;p.radius=-1;assert.throws(()=>nativeCircleStatAura.validate(p),/Invalid native circle stat aura/);
});
