// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {surfingInstructorNative} from '../shared/arkpedia/enemy-surfing-instructor-features.js';
import {isCartStoppingEnemy,CART_STOPPER_PREFABS} from '../shared/arkpedia/enemy-cart-interactions.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
function fixture(id,compiled=false){
 const guard=chessRec({id:'surfing_test',stats:{maxHp:1e6,atk:0,def:0},skill:null}),row=records.enemies[id].levels[0];
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(row):row},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:9,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[9,4]});e.profile.noAttack=true;
 h.b.addBuff(e,{key:'test:hold',flags:{noMove:true},mods:{defFlat:-e.s.def,resFlat:-e.s.res}});
 const g=h.b.allyUnits[0],hit=type=>h.b.dealDamage(g,e,{amount:100,type,canDodge:false});return{...h,e,g,hit};
}
for(const id of CART_STOPPER_PREFABS)test(`${id}: unblocked protection is immediate, Physical/Arts only and independently owned`,()=>{
 for(const compiled of[false,true]){
  const f=fixture(id,compiled),reduction=records.enemies[id].levels[0].talents.bb['Resist.damage_resistance'];
  assert.equal(f.hit('phys'),100*(1-reduction));assert.equal(f.hit('arts'),100*(1-reduction));assert.equal(f.hit('true'),100);
  f.e.blockedBy=f.g;f.g.blocking.push(f.e);f.b.emit('blocked',{enemy:f.e,blocker:f.g});
  assert.equal(f.hit('phys'),100);assert.equal(f.hit('arts'),100);assert.equal(f.e.findBuff('enemy_durplc_t'),null);
  f.b._unblock(f.e);assert.equal(f.hit('arts'),100*(1-reduction));
  f.b.applyStatus(f.e,'sanctuary',{key:'other',value:.9,source:f.g});assert.ok(Math.abs(f.hit('arts')-10)<1e-6);
  f.e.blockedBy=f.g;f.g.blocking.push(f.e);f.b.emit('blocked',{enemy:f.e,blocker:f.g});assert.ok(f.e.findBuff('other'));
  assert.ok(Math.abs(f.hit('arts')-10)<1e-6);assert.deepEqual(f.b.errors,[]);
 }
});
test('native silence immunity rejects ordinary silence; forced silence toggles the source binding while stun preserves it',()=>{
 const f=fixture(CART_STOPPER_PREFABS[0]);assert.equal(f.b.applyStatus(f.e,'silence',{duration:3}),false);
 assert.equal(f.b.applyStatus(f.e,'stun',{duration:1}),true);assert.equal(f.hit('arts'),50);
 f.b.addBuff(f.e,{key:'forced',flags:{silence:true}});f.run(.1);assert.equal(f.hit('arts'),100);
 f.b.removeBuff(f.e,'forced');f.run(.1);assert.equal(f.hit('arts'),50);assert.deepEqual(f.b.errors,[]);
});
test('cart stopping follows the native prefab list, including stage aliases, rather than a broad machine tag',()=>{
 for(const id of CART_STOPPER_PREFABS){assert.equal(isCartStoppingEnemy(id),true);assert.equal(isCartStoppingEnemy({def:{raw:{key:'stage:alias',prefabKey:id}}}),true);}
 assert.equal(isCartStoppingEnemy({defId:'enemy_1263_durbus',tags:new Set(['machine'])}),false);
});
test('admission rejects a changed block checker, damage mask, stacking rule or cart identity filter',()=>{
 for(const id of CART_STOPPER_PREFABS)assert.equal(surfingInstructorNative(records.enemies[id].levels[0],nativeComponents(evidence,id)),true);
 for(const edit of[
  n=>n.$ref(n.Resist.find(c=>'_checker'in c)._checker)._blockMaxCnt=1,
  n=>n.$template('damage_resistance').eventToActions.ON_TAKE_DAMAGE[0]._damageMask='ALL',
  n=>n.$template('damage_resistance').eventToActions.ON_TAKE_DAMAGE[0]._isStackable=true,
  n=>n.$template('enemy_durcar_hit_blocker').eventToActions.ON_BUFF_START[0]._conditionNode._filterIds.push('other'),
 ]){const n=nativeComponents(structuredClone(evidence),CART_STOPPER_PREFABS[0]);edit(n);assert.equal(surfingInstructorNative(records.enemies[CART_STOPPER_PREFABS[0]].levels[0],n),false);}
});
test('original DC-3 becomes available and resolves its complete wave program',async()=>{
 const {loadContentContext,planStage}=await import('../tools/arkpedia/content-inventory.mjs');
 const {StandardBattle}=await import('../server/sim/arkpedia.js');const {defaultBuild}=await import('../shared/arkpedia/loadout.js');
 const c=await loadContentContext(),p=await planStage(c,'dc-3',{waves:true});assert.deepEqual(p.blockers,[]);
 const b=new StandardBattle({...c.mvp,stage:p.stage,enemies:p.stage.enemies},{operators:[defaultBuild(c.mvp.operators.char_123_fang)]});let count=0;
 b.on('enemySpawn',({enemy})=>{if(isCartStoppingEnemy(enemy))count++;});
 b.on('tick',()=>{for(const e of b.enemies)if(e.alive&&!e.s.flags.reborn)b.kill(e);});
 const life=b.life;b.start();b.runToEnd(600);assert.equal(b.reason,'cleared');assert.ok(count>0);assert.equal(b.life,life);assert.deepEqual(b.errors,[]);
});
