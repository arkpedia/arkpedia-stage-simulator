// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {flayerNative} from '../shared/arkpedia/enemy-flayer-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle,chessRec,enemyRec} from './helpers/battleHarness.js';
const ids=['enemy_1364_spnaxe','enemy_1364_spnaxe_2'],key='enemy_spnaxe_atk[stack]';
function fixture(id=ids[0],compiled=false){
 const source=records.enemies[id].levels[0],child=records.enemies.enemy_1367_dseed.levels[0];
 const guard=chessRec({id:'flayer_target',stats:{atk:0,maxHp:1e6,def:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:120,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(source):source,
  enemy_1367_dseed:compiled?withCompiledEnemyRuntime(child):child,victim:enemyRec({key:'victim',hp:1000,atk:0,speed:0})},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:9,col:6}],setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,6]});e.profile.noAttack=true;h.b.addBuff(e,{key:'hold',flags:{noMove:true}});e.hp=e.s.maxHp*.25;
 return{...h,e,guard:h.b.allyUnits[0],spawn:(pos=[10,7])=>h.b.spawnEnemy('victim',{pos})};
}
for(const id of ids)test(`${id}: nearby departures heal 15% and add permanent 10% ATK stacks in raw and compiled execution`,()=>{
 for(const compiled of[false,true]){
  const f=fixture(id,compiled),atk=f.e.s.atk,hp=f.e.hp,max=f.e.s.maxHp;
  f.b.kill(f.spawn());assert.equal(f.e.hp,hp+max*.15);assert.equal(f.e.findBuff(key).stacks,1);
  assert.ok(Math.abs(f.e.s.atk-atk*1.1)<1e-8);
  f.b._remove(f.guard,'retreat');assert.equal(f.e.hp,hp+max*.3);assert.equal(f.e.findBuff(key).stacks,2);
  f.b.leak(f.spawn());f.b._remove(f.spawn(),'expire');assert.equal(f.e.findBuff(key).stacks,4);
  assert.deepEqual(f.b.errors,[]);
 }
});
test('stack count caps at 15 while later departures can still heal; silence and stun do not suppress the passive',()=>{
 const f=fixture(ids[0],true),atk=f.e.s.atk;f.b.applyStatus(f.e,'silence',{duration:60});f.b.applyStatus(f.e,'stun',{duration:60});
 for(let i=0;i<20;i++)f.b.kill(f.spawn());assert.equal(f.e.findBuff(key).stacks,15);assert.ok(Math.abs(f.e.s.atk-atk*2.5)<1e-8);
 f.e.hp=f.e.s.maxHp*.5;f.b.kill(f.spawn());assert.equal(f.e.hp,f.e.s.maxHp*.65);assert.equal(f.e.findBuff(key).stacks,15);
 assert.deepEqual(f.b.errors,[]);
});
test('outside/hidden bodies, traps, tokens and the native explosive-cart marker cannot supply gains',()=>{
 const f=fixture(),hp=f.e.hp;f.b.kill(f.spawn([10,8]));
 const hidden=f.spawn();f.b._setHidden(hidden,true);f.b.kill(hidden);
 const excluded=f.spawn();f.b.addBuff(excluded,{key:'enemy_bmbcar2_passive'});f.b.kill(excluded);
 const trap=f.b.spawnDevice('fixture:trap',10,7,{hp:1000});f.b.kill(trap);
 f.guard.def={...f.guard.def,profession:'TOKEN'};f.b.kill(f.guard);
 assert.equal(f.e.hp,hp);assert.equal(f.e.findBuff(key),null);assert.deepEqual(f.b.errors,[]);
});
test('range exit before departure cannot retain a gain, and retired sources leave no active departure listener',()=>{
 const f=fixture(),victim=f.spawn(),hp=f.e.hp;victim.x+=3;f.b.kill(victim);assert.equal(f.e.hp,hp);
 f.b.kill(f.e);f.b.kill(f.spawn());assert.equal(f.e.findBuff(key),null);f.run(.1);
 assert.ok(!f.b._hooks.death.some(h=>h.owner===f.e&&!h.removed));assert.deepEqual(f.b.errors,[]);
});
test('source retirement inside the healing modifier cannot install a late permanent stack',()=>{
 const f=fixture();f.b.on('heal',c=>{if(c.target===f.e)f.b._remove(f.e,'expire');});
 f.b.kill(f.spawn());assert.equal(f.e.alive,false);assert.equal(f.e.findBuff(key),null);assert.deepEqual(f.b.errors,[]);
});
test('a retained listener cannot grant resources to a later deployment life of its source',()=>{
 const f=fixture(),hp=f.e.hp;f.e.deploySeq++;f.b.kill(f.spawn());
 assert.equal(f.e.hp,hp);assert.equal(f.e.findBuff(key),null);assert.deepEqual(f.b.errors,[]);
});
test('ordinary unblocked hits use half ATK and Attack_2, blocked hits use full ATK and Attack, and skill damage is separate',()=>{
 for(const id of ids)for(const compiled of[false,true]){
  const f=fixture(id,compiled),atk=f.e.s.atk;
  const before=()=>f.b.emit('beforeAttack',{attacker:f.e,targets:[f.guard]});
  before();assert.equal(f.e.profile.attackVisual,'Attack_2');
  assert.equal(f.b.dealDamage(f.e,f.guard,{amount:atk,type:'phys',isAttack:true}),atk*.5);
  f.e.blockedBy=f.guard;before();assert.equal(f.e.profile.attackVisual,'Attack');
  assert.equal(f.b.dealDamage(f.e,f.guard,{amount:atk,type:'phys',isAttack:true}),atk);
  f.e.blockedBy=null;assert.equal(f.b.dealDamage(f.e,f.guard,{amount:atk,type:'phys',isAttack:true,isSkill:true}),atk);
  assert.deepEqual(f.b.errors,[]);
 }
});
test('native contracts reject altered selectors, event reasons, excluded markers, stack attributes and attack mappings',()=>{
 for(const id of ids)assert.equal(flayerNative(records.enemies[id].levels[0],nativeComponents(native,id)),true);
 for(const edit of[
  n=>n.$ref(n.Attack.find(c=>'_targetValidator'in c)._targetValidator)._targetOptions.professionMask=1023,
  n=>n.Attack.find(c=>'_targetValidator'in c)._removeBuffWhenTargetLeave=0,
  n=>n.$template('enemy_spnaxe_buffs[mark]').eventToActions.ON_OWNER_KILLED=[],
  n=>n.$template('enemy_spnaxe_buffs[mark]').eventToActions.ON_OWNER_FINISH[0]._buffKeys=[],
  n=>n.$template('enemy_spnaxe_buffs[mark]').eventToActions.ON_OWNER_FINISH[4]._buff.attributes.attributeModifiers[0].formulaItem='FINAL_SCALER',
  n=>n.$ref(n.$ref(n.enemy_1364_spnaxe[0]._modes[0])._attack)._atkScaleKey='atk_scale',
  n=>n.$ref(n.enemy_1364_spnaxe[0]._animator)._animations.find(c=>c.animKey==='Attack_2').animName='Attack',
  n=>n.$siblings(n.Attack.find(c=>'_targetValidator'in c)).find(c=>'_attackBlackboardModeIndex'in c)._attackBlackboardModeIndex=0,
 ]){
  const n=nativeComponents(structuredClone(native),ids[0]);edit(n);assert.equal(flayerNative(records.enemies[ids[0]].levels[0],n),false);
 }
});
