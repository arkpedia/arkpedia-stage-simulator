// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport} from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const ids=['enemy_1251_lysyta','enemy_1251_lysyta_2','enemy_1252_lysytb','enemy_1252_lysytb_2','enemy_1253_lysytc','enemy_1253_lysytc_2'];
function fixture(id){
  const guard=chessRec({id:'driver_target',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:3},skill:null});
  const record=structuredClone(ENEMY_RECORDS.enemies[id].levels[0]);record.stats.moveSpeed=0;
  const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:record},chess:{[guard.chessId]:guard}},
    units:[{chessId:guard.chessId,row:10,col:6}],setup:installEnemyFeatures});
  h.b.start();const target=h.b.allyUnits[0];h.b.addBuff(target,{key:'hold',flags:{noMove:true,noBlock:true,disarm:true}});
  return {...h,target,e:h.b.spawnEnemy(id,{pos:[10,4]})};
}
for(const id of ids)test(`${id}: source SP transfers only once to a marked killer`,()=>{
  const {b,e,target}=fixture(id),gains=[];target.skill={gainSp:(...args)=>gains.push(args)};
  b.addBuff(target,{key:'lypa[car_mark]',persist:true});b.applyStatus(e,'silence',{duration:10});
  assert.ok(e.findBuff('lypa[driver_mark]'));b.kill(e,target);b.kill(e,target);
  assert.deepEqual(gains,[[id.includes('lysytc')?100:50,'powerArmorDriver']]);assert.deepEqual(b.errors,[]);
});
test('ordinary kills, leaks and expiry do not charge armour',()=>{
  for(const reason of ['ordinary','leak','expired']){
    const {b,e,target}=fixture(ids[0]),gains=[];target.skill={gainSp:n=>gains.push(n)};
    if(reason!=='ordinary')b.addBuff(target,{key:'lypa[car_mark]',persist:true});
    if(reason==='leak')b.leak(e);else if(reason==='expired')b._remove(e,'expired',target);else b.kill(e,target);
    assert.deepEqual(gains,[]);assert.deepEqual(b.errors,[]);
  }
});
test('Bionic Sanctuary halves Physical and Arts damage, excludes true damage and disappears while blocked',()=>{
  const {b,e,target,run}=fixture('enemy_1253_lysytc');b.applyStatus(e,'silence',{duration:10});
  b.addBuff(e,{key:'zero-defense',mods:{defFlat:-e.s.def,resFlat:-e.s.res}});
  const hit=type=>{const hp=e.hp;b.dealDamage(target,e,{amount:100,type});return hp-e.hp};
  assert.equal(hit('phys'),50);assert.equal(hit('arts'),50);assert.equal(hit('true'),100);
  b.applyStatus(e,'sanctuary',{key:'weaker',source:e,value:.3});assert.equal(hit('arts'),50);
  e.blockedBy=target;target.blocking.push(e);b.emit('blocked',{enemy:e,blocker:target});
  assert.equal(hit('arts'),70);b.removeBuff(e,'weaker');assert.equal(hit('arts'),100);
  b._unblock(e);run(.1);assert.equal(hit('arts'),50);assert.deepEqual(b.errors,[]);
});
test('Replica uses travelling physical shots and immediate blocked melee',()=>{
  const h=fixture('enemy_1252_lysytb'),{b,e,target}=h,hits=[];b.on('damaged',c=>{if(c.source===e)hits.push(c)});
  assert.ok(h.runUntil(()=>b.projectiles.list.length===1,2));assert.equal(hits.length,0);
  assert.ok(h.runUntil(()=>hits.length===1,1));assert.equal(hits[0].hpLoss,e.s.atk);assert.equal(hits[0].dmg.applyWay,'ranged');
  b.removeBuff(target,'hold');b.addBuff(target,{key:'hold',flags:{noMove:true,disarm:true}});
  e.blockedBy=target;target.blocking.push(e);e.atkCd=0;h.run(.1);
  assert.equal(hits.at(-1).dmg.applyWay,'melee');assert.equal(b.projectiles.list.length,0);assert.deepEqual(b.errors,[]);
});
test('native admission rejects changed SP, conditional protection and projectile transport',()=>{
  for(const id of ids)assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
  const entry=structuredClone(ENEMY_RECORDS.enemies[ids[0]]);entry.levels[0].talents.bb['Driver.sp']=51;
  assert.equal(enemySupport(entry,clocks.prefabs,native).policy,null);
  const n=structuredClone(native);n.templates['enemy_lysytc[toggle_damage_resistance]'].eventToActions.ON_BUFF_START=[];
  assert.equal(enemySupport(ENEMY_RECORDS.enemies['enemy_1253_lysytc'],clocks.prefabs,n).policy,null);
  const p=structuredClone(native),row=p.projectiles.projectile_enemy_magic_ball.find(x=>'_speed'in JSON.parse(x.originalJson));
  const obj=JSON.parse(row.originalJson);obj._speed=11;row.originalJson=JSON.stringify(obj);
  assert.equal(enemySupport(ENEMY_RECORDS.enemies['enemy_1252_lysytb'],clocks.prefabs,p).policy,null);
});
