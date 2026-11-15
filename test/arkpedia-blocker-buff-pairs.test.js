// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {blockerBuffPairsMatch} from '../server/sim/blocker-buff-pairs.js';
import {makeBattle,chessRec,enemyRec} from './helpers/battleHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
const params={blockerBuffKey:'test:permitted',blockeeBuffKey:'test:pairedEnemy',checkBuffKey:'test:pairCheck',interval:Math.fround(.1)};
function fixture(){
  const record={...enemyRec({key:'paired',atk:0,dmgType:'none',applyWay:'NONE',speed:0}),runtimeFeatures:{schemaVersion:1,properties:{},
    entries:[{id:'native:pairedFixture',ability:{kind:'pairedBlockerBuffs',params}}]}};
  const op=chessRec({id:'blocker',stats:{blockCnt:3,atk:0}});
  const h=makeBattle({content:'none',autoFinish:false,timeLimit:30,defs:{enemies:{paired:record,plain:enemyRec({key:'plain',atk:0,speed:0})},chess:{blocker:op}},
    units:[{chessId:'blocker',row:10,col:6}],setup:installEnemyFeatures});
  h.b.start();const blocker=h.b.allyUnits[0],spawn=key=>h.b.spawnEnemy(key,{pos:[10,6]});
  return{...h,blocker,spawn,allow:()=>h.b.addBuff(blocker,{key:params.blockerBuffKey})};
}
test('type-1 pairs require both markers and combine alternatives with OR',()=>{
  const owned=new Set(),held=new Set(),blocker={findBuff:key=>owned.has(key)},enemy={profile:{},findBuff:key=>held.has(key)};
  assert.equal(blockerBuffPairsMatch(blocker,enemy),true);
  enemy.profile.blockerBuffPairs=[{blockerBuffKey:'a',blockeeBuffKey:'b'}];
  assert.equal(blockerBuffPairsMatch(blocker,enemy),false);owned.add('a');assert.equal(blockerBuffPairsMatch(blocker,enemy),false);
  held.add('b');assert.equal(blockerBuffPairsMatch(blocker,enemy),true);owned.delete('a');assert.equal(blockerBuffPairsMatch(blocker,enemy),false);
  enemy.profile.blockerBuffPairs.push({blockerBuffKey:'c',blockeeBuffKey:'d'});owned.add('c');held.add('d');
  assert.equal(blockerBuffPairsMatch(blocker,enemy),true);
});
test('new block acquisition uses the paired requirement alongside ordinary capacity and noBlock',()=>{
  const h=fixture(),e=h.spawn('paired');assert.equal(h.b._checkBlock(e),false);
  h.allow();h.b.addBuff(h.blocker,{key:'test:noBlock',flags:{noBlock:true}});assert.equal(h.b._checkBlock(e),false);
  h.b.removeBuff(h.blocker,'test:noBlock');h.b.addBuff(h.blocker,{key:'test:noCapacity',mods:{blockCnt:-3}});
  assert.equal(h.b._checkBlock(e),false);h.b.removeBuff(h.blocker,'test:noCapacity');
  assert.equal(h.b._checkBlock(e),true);assert.equal(e.blockedBy,h.blocker);assert.deepEqual(h.b.errors,[]);
});
test('the blocker-side clock releases the enemy after permission expires even while the enemy is stunned',()=>{
  const h=fixture(),e=h.spawn('paired');h.allow();assert.ok(h.b._checkBlock(e));h.run(.2);
  h.b.applyStatus(e,'stun',{duration:5});h.b.removeBuff(h.blocker,params.blockerBuffKey);h.run(.15);
  assert.equal(e.blockedBy,null);assert.equal(h.blocker.findBuff(params.checkBuffKey),null);assert.deepEqual(h.b.errors,[]);
});
test('the explicit release check requires the enemy marker; existing relationships are not blindly re-evaluated',()=>{
  const h=fixture(),e=h.spawn('paired');h.allow();assert.ok(h.b._checkBlock(e));
  h.b.removeBuff(e,params.blockeeBuffKey);h.b.removeBuff(h.blocker,params.blockerBuffKey);h.run(.2);
  assert.equal(e.blockedBy,h.blocker);
  h.b.addBuff(e,{key:params.blockeeBuffKey});h.run(.15);assert.equal(e.blockedBy,null);
  h.allow();h.b.removeBuff(e,params.blockeeBuffKey);assert.equal(h.b._checkBlock(e),false);
});
test('multiple enemies own independent checker lifetimes without releasing an ordinary blocked enemy',()=>{
  const h=fixture(),a=h.spawn('paired'),b=h.spawn('paired'),plain=h.spawn('plain');h.allow();
  for(const e of[a,b,plain])assert.ok(h.b._checkBlock(e));
  assert.equal(h.blocker.buffs.filter(x=>x.key===params.checkBuffKey).length,2);
  h.b.kill(a);assert.equal(h.blocker.buffs.filter(x=>x.key===params.checkBuffKey).length,1);
  h.b.removeBuff(h.blocker,params.blockerBuffKey);h.run(.15);
  assert.equal(b.blockedBy,null);assert.equal(plain.blockedBy,h.blocker);
  assert.equal(h.blocker.buffs.filter(x=>x.key===params.checkBuffKey).length,0);assert.deepEqual(h.b.errors,[]);
});
test('blocker removal and re-acquisition do not retain a stale checker',()=>{
  const h=fixture(),e=h.spawn('paired');h.allow();assert.ok(h.b._checkBlock(e));
  h.b.releaseBlocked(h.blocker);assert.equal(h.blocker.findBuff(params.checkBuffKey),null);
  assert.ok(h.b._checkBlock(e));assert.equal(h.blocker.buffs.filter(x=>x.key===params.checkBuffKey).length,1);
  h.b.kill(e);assert.equal(h.blocker.findBuff(params.checkBuffKey),null);
});
