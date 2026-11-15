// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {awakenDamageShareNative} from '../shared/arkpedia/enemy-awaken-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {makeDamageInfo} from '../server/sim/damage.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const id='enemy_1531_bbrain',driver='enemy_1251_lysyta',other='enemy_1007_slime';
function fixture(level=0){
 const record=structuredClone(ENEMY_RECORDS.enemies[id].levels[level]);
 record.talents={bb:{'DamageSplit.damage_resistance':.5},bbStr:{},groups:{DamageSplit:['damage_resistance']}};
 record.abilities=[];record.skills=[];
 const h=makeBattle({content:'none',autoFinish:false,units:[],defs:{enemies:{[id]:record,
  [driver]:ENEMY_RECORDS.enemies[driver].levels[0],[other]:ENEMY_RECORDS.enemies[other].levels[0]}},setup:installEnemyFeatures});
 h.b.start();const spawn=(key=driver)=>h.b.spawnEnemy(key,{pos:[9,6]});return {...h,spawn,boss:spawn(id)};
}
for(const level of [0,1])test(`Awaken damage share level ${level}: mitigation once, equal HP loss and unchanged kill attribution`,()=>{
 const {b,boss,spawn}=fixture(level),a=spawn(),z=spawn(),unmarked=spawn(other);
 const hp=[boss.hp,a.hp,z.hp,unmarked.hp],amount=boss.s.def+1000;
 const damage=b.dealDamage(null,boss,{amount,type:'phys',canDodge:false});
 assert.equal(damage,500);assert.equal(hp[0]-boss.hp,500);assert.equal(hp[1]-a.hp,250);assert.equal(hp[2]-z.hp,250);
 assert.equal(unmarked.hp,hp[3]);
 const deaths=[];b.on('death',c=>deaths.push(c));a.hp=1;
 b.dealDamage(unmarked,boss,{amount:1000,type:'true'});
 assert.equal(a.alive,false);assert.equal(deaths.find(c=>c.unit===a).killer,unmarked);
 assert.equal(hp[2]-z.hp,500,'dying recipients do not reallocate their excess share');assert.deepEqual(b.errors,[]);
});
test('sharing follows live grounded markers and leaves full damage when none qualify',()=>{
 const {b,boss,spawn}=fixture(),a=spawn(),z=spawn();
 a.hidden=true;z.motion='FLY';let hp=boss.hp;b.dealDamage(null,boss,{amount:1000,type:'true'});assert.equal(hp-boss.hp,1000);
 a.hidden=false;hp=a.hp;b.dealDamage(null,boss,{amount:1000,type:'true'});assert.equal(hp-a.hp,500);
 b.removeBuff(a,'lypa[driver_mark]');hp=boss.hp;b.dealDamage(null,boss,{amount:1000,type:'true'});assert.equal(hp-boss.hp,1000);
 b.addBuff(a,{key:'lypa[driver_mark]'});b.addBuff(a,{key:'protected',flags:{invulnerable:true}});
 hp=boss.hp;b.dealDamage(null,boss,{amount:1000,type:'true'});assert.equal(hp-boss.hp,1000);assert.deepEqual(b.errors,[]);
});
test('HP loss, cancelled damage and explicitly classified execution damage never transfer',()=>{
 const {b,boss,spawn}=fixture(),a=spawn(),hp=a.hp;
 b.loseHp(boss,100);b.dealDamage(null,boss,{amount:100,type:'true',instantKillLike:true});
 b.addBuff(boss,{key:'protected',flags:{invulnerable:true}});b.dealDamage(null,boss,{amount:100,type:'true'});
 assert.equal(a.hp,hp);assert.equal(makeDamageInfo({instantKillLike:true}).instantKillLike,true);
 assert.equal(makeDamageInfo({instantKillLike:1}).instantKillLike,false);assert.deepEqual(b.errors,[]);
});
test('the independent source contract refuses changed selectors and transfer semantics; full boss remains blocked',()=>{
 const entry=ENEMY_RECORDS.enemies[id];
 for(const r of Object.values(entry.levels))assert.equal(awakenDamageShareNative(r,nativeComponents(native,id)),true);
 assert.equal(enemySupport(entry,clocks.prefabs,native).policy,null);
 for(const mutate of [
  n=>n.templates['enemy_bbrain[damage_split]'].eventToActions.ON_TAKE_DAMAGE[0]._isUnset=false,
  n=>n.templates['enemy_bbrain[damage_split]'].eventToActions.ON_TAKE_DAMAGE[1]._buffKey='wrong',
  n=>n.templates['enemy_bbrain[buff_mark]'].eventToActions.ON_BUFF_START[0]._buffOwner='BUFF_OWNER',
  n=>{const row=n.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`].find(r=>r.pathId==='-6166552565171886500');
    const c=JSON.parse(row.originalJson);c._targetMotion=3;row.originalJson=JSON.stringify(c)},
 ]){const n=structuredClone(native);mutate(n);assert.equal(awakenDamageShareNative(entry.levels[0],nativeComponents(n,id)),false);}
});
