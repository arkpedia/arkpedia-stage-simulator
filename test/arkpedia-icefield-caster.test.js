// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {enemySupport} from '../shared/arkpedia/enemy-support.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const ids=['enemy_1192_krgscr','enemy_1192_krgscr_2'];
function fixture(id=ids[0]){
 const op=chessRec({id:'coldCasterGuard',stats:{maxHp:100000,atk:0,res:0,blockCnt:0},skill:{spType:'INCREASE_WHEN_TAKEN_DAMAGE',spCost:100}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{enemies:{[id]:ENEMY_RECORDS.enemies[id].levels[0]},chess:{[op.chessId]:op}},
  units:[{chessId:op.chessId,row:10,col:7},{chessId:op.chessId,row:11,col:6},{chessId:op.chessId,row:10,col:8}],setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,6],route:{start:[10,6],end:[10,12],steps:[]}});
 h.b.addBuff(e,{key:'fixtureHold',flags:{noMove:true}});return{...h,e};
}
test('both Icefield Casters preserve Yeti admission and reject altered native target/projectile contracts',()=>{
 for(const id of [...ids,'enemy_1068_snmage','enemy_1068_snmage_2','enemy_1241_ltmage','enemy_1241_ltmage_2'])assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
 for(const mode of ['targets','projectile','resistance']){
  const n=structuredClone(native),rows=n.prefabs[`dyn/battle/prefabs/enemies/${ids[0]}.prefab`];
  const row=rows.find(r=>{const c=JSON.parse(r.originalJson);return mode==='targets'?c._maxNum===2:mode==='projectile'?c._projectileKey==='projectile_enemy_krgscr _s1':c._buffs?.[0]?.buffKey==='status_resistance[inf]'});
  const c=JSON.parse(row.originalJson);if(mode==='targets')c._maxNum=3;else if(mode==='projectile')c._projectileKey='projectile_enemy_krgscr_s1';else c._buffs[0].blackboard[0].value=-.75;
  row.originalJson=JSON.stringify(c);assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]],clocks.prefabs,n).policy,null,mode);
 }
});
test('two hits charge only one attack worth of SP; the third volley applies five-second Cold to both recipients',()=>{
 const h=fixture(),hits=[],statuses=[];h.b.on('damaged',c=>{if(c.source===h.e)hits.push(c)});
 h.b.on('statusApplied',c=>{if(c.source===h.e&&c.status==='cold')statuses.push(c)});
 h.step();assert.equal(h.b.projectiles.list.length,2);h.run(.4);assert.equal(hits.length,2);assert.equal(statuses.length,0);
 h.run(4.5);assert.equal(hits.length,4);assert.equal(statuses.length,0);
 h.run(4.5);assert.equal(hits.length,6);assert.equal(statuses.length,2);
 assert.ok(hits.every(c=>c.dmg.type==='arts'&&c.dmg.isAttack));assert.ok(statuses.every(c=>c.duration===5));
 assert.equal(h.allies().reduce((n,u)=>n+u.skill.sp,0),6);assert.equal(h.b.resistOf(h.e),.5);assert.deepEqual(h.b.errors,[]);
});
test('ground targeting excludes recipients with flying motion, and released charged shots survive source death',()=>{
 const h=fixture();const a=h.allies();a[0].motion='FLY';
 h.e.mem.ab.list.find(a=>'charge'in a).charge=2;
 const statuses=[];h.b.on('statusApplied',c=>{if(c.source===h.e&&c.status==='cold')statuses.push(c)});
 h.step();assert.equal(h.b.projectiles.list.length,2);h.b.kill(h.e);h.run(.5);
 assert.equal(statuses.length,2);assert.ok(statuses.every(c=>c.target!==a[0]));assert.deepEqual(h.b.errors,[]);
});
