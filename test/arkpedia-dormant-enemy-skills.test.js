// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import {enemyFeature} from '../shared/arkpedia/enemy-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
function run(row,compiled){
  const guard=chessRec({id:'dormant_test',stats:{maxHp:1e6,atk:0,def:0},skill:null});
  const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,
    defs:{enemies:{[row.key]:compiled?withCompiledEnemyRuntime(row):row},chess:{[guard.chessId]:guard}},
    units:[{chessId:guard.chessId,row:9,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
  h.b.start();const e=h.b.spawnEnemy(row.key,{pos:[9,6]});e.profile.noAttack=true;
  h.b.addBuff(e,{key:'test:hold',flags:{noMove:true}});h.run(20);
  return {h,e,guard:h.b.allyUnits[0]};
}
for(const id of ['enemy_1174_duholy','enemy_1174_duholy_2'])test(`${id}: dormant Flame cannot attach burning timers or a death blast`,()=>{
  const row=records.enemies[id].levels[0],feature=enemyFeature('skill:Flame');
  assert.equal(feature.covers(row),true);assert.equal(feature.ability(row),null);
  for(const compiled of [false,true]){
    const {h,e,guard}=run(row,compiled);assert.equal(guard.hp,guard.s.maxHp);
    assert.equal(h.b._sched.length,0);assert.deepEqual(h.b.errors,[]);
    h.b.kill(e);assert.equal(guard.hp,guard.s.maxHp);
    if(compiled)assert.ok(!withCompiledEnemyRuntime(row).runtimeFeatures.entries.some(e=>e.ability?.kind==='flamerazer'));
  }
  const changed=structuredClone(row);changed.skills[0].bb.hit_interval=.25;assert.equal(feature.covers(changed),false);assert.throws(()=>withCompiledEnemyRuntime(changed),/Unmatched enemy runtime feature/);
});
test('actual Flamerazer registrations retain their ability and unrelated Flame names are refused',()=>{
  const feature=enemyFeature('skill:Flame');
  for(const id of ['enemy_1173_duspfr','enemy_1173_duspfr_2']){
    const row=records.enemies[id].levels[0];assert.equal(feature.covers(row),true);assert.equal(feature.ability(row).kind,'flamerazer');
  }
  const unrelated=structuredClone(records.enemies.enemy_1174_duholy.levels[0]);unrelated.prefabKey='enemy_unknown';assert.equal(feature.covers(unrelated),false);
});
