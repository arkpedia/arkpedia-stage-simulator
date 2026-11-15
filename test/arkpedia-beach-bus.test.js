// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle,chessRec,enemyRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { RegularDisplacement } from '../server/sim/regular-displacement.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport,nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { beachBusNative } from '../shared/arkpedia/enemy-beach-bus-features.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import index from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const ids=['enemy_1263_durbus','enemy_1263_durbus_2'],sniper='enemy_1117_liiprr';
function fixture(id=ids[0],block=0){
  const real=Object.fromEntries([...ids,sniper].map(id=>{const r=structuredClone(ENEMY_RECORDS.enemies[id].levels[0]);r.stats.moveSpeed=0;return[id,r];}));
  const op=chessRec({id:'bus_guard',stats:{maxHp:1e6,atk:0,blockCnt:block},skill:null});
  const h=makeBattle({content:'none',autoFinish:false,captureNoisy:true,timeLimit:300,defs:{enemies:{...real,
    cargo:enemyRec({key:'cargo',speed:0,hp:10000}),boss:enemyRec({key:'boss',rank:'BOSS',speed:0}),
    fly:enemyRec({key:'fly',motion:'FLY',speed:0})},chess:{[op.chessId]:op}},
    kits:{[op.chessId]:()=>({trait:{noAttack:true}})},units:[{chessId:op.chessId,row:9,col:4}],setup:b=>{b.regularDisplacement=new RegularDisplacement(b);installEnemyFeatures(b);}});
  h.b.start();const e=h.b.spawnEnemy(id,{pos:[9,4]}),a=e.mem.ab.list.find(a=>a.passengers);
  return{...h,e,a,container:a.passengers,op:h.b.allyUnits[0],spawn:(key='cargo',pos=[9,4.2])=>h.b.spawnEnemy(key,{pos})};
}
test('both buggies capture at most three existing identities and preserve HP, buffs, totals and removal credit',()=>{
  for(const id of ids){const f=fixture(id),cargo=Array.from({length:4},()=>f.spawn());cargo[0].hp=4321;f.b.addBuff(cargo[0],{key:'retained',mods:{atkFlat:20}});
    const total=f.b.total;f.run(.1);assert.equal(f.container.records.size,3);assert.equal(cargo.filter(u=>u.hidden).length,3);
    assert.equal(f.b.total,total);assert.equal(f.b.killed,0);assert.equal(cargo[0].hp,4321);assert.ok(cargo[0].findBuff('retained'));
    assert.equal(cargo[0].mem.enemyPassengerOf,f.e);assert.equal(cargo[3].hidden,false);assert.deepEqual(f.b.errors,[]);
  }
});
test('native selection excludes machines, bosses, flyers, sleeping/isolated bodies and distant candidates',()=>{
  const f=fixture(),machine=f.spawn(),boss=f.spawn('boss'),fly=f.spawn('fly'),sleep=f.spawn(),isolated=f.spawn(),far=f.spawn('cargo',[9,4.6]);
  machine.tags.add('machine');f.b.addBuff(sleep,{key:'sleeping',flags:{sleep:true}});f.b.addBuff(isolated,{key:'isolated',flags:{isolated:true}});
  f.run(.1);for(const u of[machine,boss,fly,sleep,isolated,far])assert.equal(u.hidden,false,u.defId);
  assert.equal(f.container.records.size,0);assert.deepEqual(f.b.errors,[]);
});
test('pickup releases an existing blocker and immediately cancels an unreleased native attack',()=>{
  const f=fixture(ids[0],2),u=f.spawn(sniper);u.base.atk=100;u.markDirty();f.run(.1);
  // Capture explicitly before another enemy tick, after installing an unfinished cast.
  assert.equal(u.hidden,true);f.b.kill(f.e);u.atkCd=0;f.run(.2);const a=u.mem.ab.list.find(a=>a.confine);assert.ok(a.cast);assert.equal(u.blockedBy,f.op);
  const carrier=f.b.spawnEnemy(ids[1],{pos:[u.y,u.x]});const c=carrier.mem.ab.list.find(a=>a.passengers).passengers;
  assert.equal(c.capture(u),true);assert.equal(u.blockedBy,null);assert.equal(f.op.blocking.includes(u),false);assert.equal(a.cast,null);
  f.run(2);assert.equal(u.stats.dmg,0);assert.deepEqual(f.b.errors,[]);
});
test('passenger attack/route clocks stay suspended while following a moving carrier',()=>{
  const f=fixture(),u=f.spawn();u.atkCd=2;f.run(.1);const leg=u.route.legIdx,cd=u.atkCd;
  f.e.x=7;f.e.y=10;f.run(2);assert.equal(u.x,7);assert.equal(u.y,10);assert.equal(u.route.legIdx,leg);assert.equal(u.atkCd,cd);
  assert.equal(u.canAct,false);assert.deepEqual(f.b.errors,[]);
});
test('boarding ends active displacement immediately, including release before the next tick',()=>{
  const f=fixture(),u=f.spawn();f.b.regularDisplacement.begin(u,{vx:5,vy:0,hard:.1,options:{}});assert.ok(u.mem.regularShift);
  assert.equal(f.container.capture(u),true);assert.equal(u.mem.regularShift,undefined);
  f.container.release();f.e.x=9;const x=u.x,y=u.y;f.run(.1);assert.equal(u.x,x);assert.equal(u.y,y);assert.deepEqual(f.b.errors,[]);
});
test('defeat unloads passengers on independent copies of the carrier remaining route without a second spawn',()=>{
  const f=fixture(),a=f.spawn(),b=f.spawn();f.run(.1);const count=f.b.total;
  f.e.route={legs:[{t:'move',r:10,c:8,final:false},{t:'wait',time:2},{t:'move',r:10,c:2,final:true}],legIdx:1,waitLeft:1,
    pts:null,ptIdx:0,suffix:null,version:-1};f.e.x=7;f.e.y=10;f.b.kill(f.e);
  assert.equal(a.hidden,false);assert.equal(b.hidden,false);assert.equal(a.mem.enemyPassengerOf,undefined);assert.equal(a.hp,a.s.maxHp);
  assert.equal(f.b.total,count);assert.equal(f.b.killed,1);assert.equal(a.route.legIdx,1);assert.equal(a.route.waitLeft,1);
  assert.notEqual(a.route,b.route);assert.notEqual(a.route.legs,b.route.legs);assert.deepEqual(a.route.legs,f.e.route.legs);
  assert.ok(Math.abs(a.x-7)<=.200001&&Math.abs(a.y-10)<=.200001);assert.deepEqual(f.b.errors,[]);
});
test('carrier exit accounts for every passenger once, while timeout keeps their original identities',()=>{
  const f=fixture(),a=f.spawn(),b=f.spawn();f.run(.1);f.b.leak(f.e);assert.equal(a.alive,false);assert.equal(b.alive,false);
  assert.equal(f.b.leakedCount,3);assert.equal(f.b._pp('p1').leaked.length,3);assert.equal(f.container.records.size,0);
  assert.deepEqual(f.b.errors,[]);
  const g=fixture(),u=g.spawn();g.run(.1);g.b.forceEnd('timeout');assert.equal(g.b._pp('p1').leaked.length,2);assert.equal(u.defId,'enemy_cargo');assert.deepEqual(g.b.errors,[]);
});
test('three-slot block volume consumes real capacity and prevents a second ordinary enemy from sharing a three-block guard',()=>{
  const f=fixture(ids[0],3);f.run(.1);assert.equal(f.e.blockedBy,f.op);assert.equal(f.e.blockWeight,3);
  const u=f.spawn('cargo',[9,4.7]);f.run(.1);assert.equal(u.blockedBy,null);assert.deepEqual(f.b.errors,[]);
});
test('admission refuses changed capacity, contact radius, eligibility or host-route policy',()=>{
  for(const id of ids)assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],index.prefabs,evidence).policy,id);
  for(const kind of['radius','rank','route']){const ev=structuredClone(evidence),rows=ev.prefabs[`dyn/battle/prefabs/enemies/${ids[0]}.prefab`];
    const key=kind==='radius'?'m_Radius':kind==='rank'?'_enemyLevelMask':'_useHostRoute';
    const row=rows.find(x=>key in JSON.parse(x.originalJson));const d=JSON.parse(row.originalJson);d[key]=0;row.originalJson=JSON.stringify(d);
    assert.equal(beachBusNative(ENEMY_RECORDS.enemies[ids[0]].levels[0],nativeComponents(ev,ids[0])),false,kind);
  }
});
test('original KR-2 and its challenge variant load the shared carrier and complete their full wave schedules',async()=>{
  const{loadContentContext,planStage}=await import('../tools/arkpedia/content-inventory.mjs');const{StandardBattle}=await import('../server/sim/arkpedia.js');const{defaultBuild}=await import('../shared/arkpedia/loadout.js');
  const c=await loadContentContext();for(const id of['kr-2','kr-2_challenge_mode']){const p=await planStage(c,id,{waves:true});assert.deepEqual(p.blockers,[]);
    const b=new StandardBattle({...c.mvp,stage:p.stage,enemies:{...c.mvp.enemies,...p.stage.enemies}},{operators:[defaultBuild(c.mvp.operators.char_123_fang)]});let buses=0;
    b.on('enemySpawn',({enemy})=>{if(ids.includes(enemy.defId))buses++;b.after(.5,()=>b.kill(enemy));});const life=b.life;b.start();b.runToEnd(600);
    assert.equal(b.reason,'cleared');assert.ok(buses>0);assert.equal(b.life,life);assert.deepEqual(b.errors,[]);}
});
