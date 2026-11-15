// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport} from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const ids=['enemy_1250_lyengs','enemy_1250_lyengs_2'];
function fixture(id=ids[0]){
  const record=structuredClone(ENEMY_RECORDS.enemies[id].levels[0]);record.stats.moveSpeed=0;
  const h=makeBattle({content:'none',autoFinish:false,timeLimit:100,defs:{enemies:{[id]:record}},setup:installEnemyFeatures});
  h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,4]}),targets=[];
  for(const col of [5,6]){const t=h.b.spawnDevice('repair_target',10,col,{side:'enemy',hp:20000,blockCnt:0});
    h.b.addBuff(t,{key:'lypa[car_mark]',persist:true});t.hp=2000;targets.push(t);}
  return{...h,e,targets};
}
for(const id of ids)test(`${id}: after 5 s the nearest damaged armour receives ten target-max-HP repair pulses`,()=>{
  const h=fixture(id),{b,e,targets:[near,far]}=h,heals=[];b.on('healed',c=>{if(c.source===e)heals.push(c)});
  h.run(4.8);assert.equal(near.hp,2000);assert.equal(b.projectiles.list.length,0);
  h.run(10.5);assert.equal(near.hp,12000);assert.equal(far.hp,2000);assert.equal(heals.length,10);
  assert.equal(e.profile.noAttack,true);h.run(.8);assert.equal(e.profile.noAttack,false);assert.deepEqual(b.errors,[]);
});
test('full HP interrupts repair at the source poll; healing uses the target HP, not the Engineer HP',()=>{
  const h=fixture(),{b,e,targets:[near]}=h;near.hp=near.s.maxHp-500;
  h.run(5.4);assert.equal(near.hp,near.s.maxHp);assert.equal(e.profile.noAttack,false);
  h.run(10);assert.equal(b.projectiles.list.filter(p=>p.data?.powerArmorRepair).length,0);assert.deepEqual(b.errors,[]);
});
test('Silence, stun, source death and target activation stop a live link without further healing',()=>{
  for(const mode of ['silence','stun','death','activation']){
    const h=fixture(),{b,e,targets:[near]}=h;h.run(5.4);const hp=near.hp;assert.ok(hp>2000);
    if(mode==='death')b.kill(e);else if(mode==='activation')b.removeBuff(near,'lypa[car_mark]');
    else b.applyStatus(e,mode,{duration:20});
    h.run(2);assert.equal(near.hp,hp,mode);assert.deepEqual(b.errors,[]);
  }
});
test('repair ignores full, unmarked and out-of-range devices and does not start while silenced',()=>{
  const h=fixture(),{b,e,targets:[near,far]}=h;near.hp=near.s.maxHp;b.removeBuff(far,'lypa[car_mark]');
  h.run(6);assert.equal(b.projectiles.list.length,0);
  near.hp=2000;b.applyStatus(e,'silence',{duration:2});h.run(1);assert.equal(near.hp,2000);
  h.run(2);assert.ok(near.hp>2000);assert.deepEqual(b.errors,[]);
});
test('source contract rejects changed heal semantics, channel timing and target markers',()=>{
  for(const id of ids)assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
  const n=structuredClone(native);n.templates['enemy_lyengs[modify_hp]'].eventToActions.ON_BUFF_START[0]._getMaxHpFromTarget=true;
  assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]],clocks.prefabs,n).policy,null);
  const e=structuredClone(ENEMY_RECORDS.enemies[ids[0]]);e.levels[0].skills[0].bb.hit_duration=12;
  assert.equal(enemySupport(e,clocks.prefabs,native).policy,null);
});
