// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport} from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const ids=['enemy_1256_lyacpa','enemy_1256_lyacpa_2'];
function fixture(id=ids[0]){
  const guard=chessRec({id:'armor_target',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:3},skill:null});
  const record=structuredClone(ENEMY_RECORDS.enemies[id].levels[0]);record.stats.moveSpeed=0;
  const h=makeBattle({content:'none',autoFinish:false,timeLimit:120,defs:{enemies:{[id]:record},chess:{[guard.chessId]:guard}},
    units:[[9,6],[10,6],[11,6],[9,7],[10,7],[11,7],[10,8]].map(([row,col])=>({chessId:guard.chessId,row,col})),setup:installEnemyFeatures});
  const b=h.b;b.start();const units=b.allyUnits;
  for(const [i,u]of units.entries())b.addBuff(u,{key:'hold',mods:{taunt:i},flags:{noMove:true,disarm:true,noBlock:true}});
  const e=b.spawnEnemy(id,{pos:[10,4]}),hits=[];b.on('damaged',c=>{if(c.source===e)hits.push(c)});
  return {...h,e,units,hits};
}
for(const id of ids)test(`${id}: four ground targets receive travelling half-ATK hits in normal target priority`,()=>{
  const h=fixture(id),{b,e,units,hits}=h;units[6].motion='FLY';
  assert.ok(h.runUntil(()=>b.projectiles.list.length===4,2));assert.equal(hits.length,0);
  assert.ok(h.runUntil(()=>hits.length===4,1));
  assert.deepEqual(hits.map(c=>c.target.id).sort(),units.slice(2,6).map(u=>u.id).sort());
  for(const c of hits){assert.equal(c.hpLoss,e.s.atk*.5);assert.equal(c.dmg.applyWay,'ranged')}
  assert.ok(h.eventsOf('atk').every(ev=>ev[4]==='Attack'));assert.deepEqual(b.errors,[]);
});
test('blocked power armor hits only its blocker with full melee damage and the original melee clip',()=>{
  const h=fixture(),{b,e,units,hits}=h,blocker=units[0];
  b.removeBuff(blocker,'hold');b.addBuff(blocker,{key:'hold',flags:{noMove:true,disarm:true,camou:true}});
  e.blockedBy=blocker;blocker.blocking.push(e);h.run(.1);
  assert.equal(hits.length,1);assert.equal(hits[0].target,blocker);assert.equal(hits[0].hpLoss,e.s.atk);
  assert.equal(hits[0].dmg.applyWay,'melee');assert.equal(b.projectiles.list.length,0);
  assert.equal(h.eventsOf('atk')[0][4],'Attack_2');
  b._unblock(e);e.atkCd=0;h.run(.1);assert.equal(b.projectiles.list.length,4);
  assert.equal(h.eventsOf('atk').at(-1)[4],'Attack');assert.deepEqual(b.errors,[]);
});
test('released ranged shots keep their half scale after blocking or shooter death, without splash',()=>{
  for(const dead of [false,true]){
    const h=fixture(),{b,e,units,hits}=h;units[6].motion='FLY';
    assert.ok(h.runUntil(()=>b.projectiles.list.length===4,2));const amount=e.s.atk*.5;
    if(dead)b.kill(e);else{b.removeBuff(units[0],'hold');e.blockedBy=units[0];units[0].blocking.push(e)}
    h.run(.6);assert.equal(hits.length,4);for(const c of hits)assert.equal(c.hpLoss,amount);
    assert.equal(hits.some(c=>c.target===units[0]||c.target===units[6]),false);assert.deepEqual(b.errors,[]);
  }
});
test('Silence does not erase basic attack modes; stealth and camouflage remain ordinary ranged selection exclusions',()=>{
  const h=fixture(),{b,e,units,hits}=h;b.applyStatus(e,'silence',{duration:10});
  b.addBuff(units[6],{key:'hidden',flags:{stealth:true}});b.addBuff(units[5],{key:'camo',flags:{camou:true}});
  h.run(.8);assert.equal(hits.length,4);assert.equal(hits.some(c=>units.slice(5).includes(c.target)),false);
  assert.deepEqual(b.errors,[]);
});
test('native source contracts cover both records and reject changed targeting, damage, transport and kill actions',()=>{
  for(const id of ids)assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
  const entry=structuredClone(ENEMY_RECORDS.enemies[ids[0]]);entry.levels[0].talents.bb['Passive.attack@ranged.atk_scale']=.4;
  assert.equal(enemySupport(entry,clocks.prefabs,native).policy,null);
  for(const change of ['selector','damage','speed','lifetime','log']){
    const n=structuredClone(native),rows=n.prefabs[`dyn/battle/prefabs/enemies/${ids[0]}.prefab`];
    if(change==='log')n.templates.log_killed.eventToActions.ON_OWNER_KILLED.push({$type:'unreviewed'});
    else{
      const list=['speed','lifetime'].includes(change)?n.projectiles.projectile_enemy_lyacpa:rows;
      const key={selector:'_maxNum',damage:'_projectileKey',speed:'_speed',lifetime:'_lifeTime'}[change];
      const row=list.find(r=>Object.hasOwn(JSON.parse(r.originalJson),key)),data=JSON.parse(row.originalJson);
      if(change==='selector')data._maxNum=5;else if(change==='damage')data._atkScale=2;
      else data[key]=20;row.originalJson=JSON.stringify(data);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]],clocks.prefabs,n).policy,null,change);
  }
});
test('active armour logs the native generic killed counter exactly once, never on escape',()=>{
  for(const method of ['kill','leak']){
    const {b,e}=fixture();b[method](e);b[method](e);
    assert.equal(b.stageOutcomes?.counters.killed,method==='kill'?1:undefined);assert.deepEqual(b.errors,[]);
  }
});
