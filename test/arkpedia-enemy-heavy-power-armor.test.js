// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport} from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const ids=['enemy_1255_lybgpa','enemy_1255_lybgpa_2'];
function fixture(id=ids[0]){
  const guard=chessRec({id:'heavy_target',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:3},skill:null});
  const record=structuredClone(ENEMY_RECORDS.enemies[id].levels[0]);record.stats.moveSpeed=0;
  const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:record},chess:{[guard.chessId]:guard}},
    units:[{chessId:guard.chessId,row:10,col:5},{chessId:guard.chessId,row:10,col:6}],setup:installEnemyFeatures});
  h.b.start();const [target,other]=h.b.allyUnits;
  for(const u of [target,other])h.b.addBuff(u,{key:'hold',flags:{noMove:true,disarm:true}});
  const e=h.b.spawnEnemy(id,{pos:[10,4]}),hits=[];e.blockedBy=target;target.blocking.push(e);
  h.b.on('damaged',c=>{if(c.source===e)hits.push({time:h.b.time,target:c.target.id,loss:c.hpLoss,skill:c.dmg.isSkill})});
  return{...h,e,target,other,hits};
}
for(const id of ids)test(`${id}: releases its blocker and uses opening plus two-hit loops against the locked life`,()=>{
  const h=fixture(id),{b,e,target,hits,other}=h;h.run(.2);assert.equal(hits.length,0);assert.equal(e.blockedBy,null);
  assert.equal(e.mem.regularFormVisual.clip,'Skill_Begin');h.run(.2);assert.equal(hits.length,1);assert.equal(target.s.flags.stun,true);
  b.addBuff(other,{key:'taunt',mods:{taunt:100}});h.run(10.3);
  const skillHits=hits.filter(c=>c.skill);assert.equal(skillHits.length,11);
  for(const hit of skillHits){assert.equal(hit.target,target.id);assert.equal(hit.loss,e.s.atk*(id.endsWith('_2')?.5:.75));}
  assert.ok(Math.abs(skillHits[0].time-.3)<.04);assert.equal(e.mem.regularFormVisual.clip,'Skill_End');assert.equal(e.profile.noAttack,true);
  h.run(1.2);assert.equal(e.profile.noAttack,false);assert.deepEqual(b.errors,[]);
});
test('Silence or Freeze cancels future punches; target retreat cannot transfer the sequence to a replacement',()=>{
  for(const mode of ['silence','freeze','retreat']){
    const h=fixture(),{b,e,target,hits}=h;h.run(1.2);const n=hits.filter(c=>c.skill).length;assert.ok(n>0);
    if(mode==='retreat')b.retreat(target);else b.applyStatus(e,mode,{duration:10});
    h.run(5);assert.equal(hits.filter(c=>c.skill).length,n,mode);assert.deepEqual(b.errors,[]);
  }
});
test('Slow Down scales attack markers without extending the wall-clock loop eligibility mark',()=>{
  const h=fixture(),{b,e,hits}=h;b.addBuff(e,{key:'slow',mods:{slowDownMul:.5}});h.run(.5);assert.equal(hits.length,0);
  h.run(.2);assert.equal(hits.filter(c=>c.skill).length,1);assert.ok(hits[0].time>.59);
  h.run(14);assert.equal(e.profile.noAttack,false);assert.deepEqual(b.errors,[]);
});
test('heavy armour native admission rejects changed event sequence, loop lifetime and target release',()=>{
  for(const id of ids)assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
  const entry=structuredClone(ENEMY_RECORDS.enemies[ids[0]]);entry.levels[0].skills[0].bb.duration=11;
  assert.equal(enemySupport(entry,clocks.prefabs,native).policy,null);
  const n=structuredClone(native);n.templates['enemy_lybgpa[release_from_blocker]'].eventToActions.ON_BUFF_START=[];
  assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]],clocks.prefabs,n).policy,null);
});
test('heavy armour death logs its native counter exactly once',()=>{
  const {b,e}=fixture();b.kill(e);b.kill(e);assert.equal(b.stageOutcomes.counters.killed,1);assert.deepEqual(b.errors,[]);
});
