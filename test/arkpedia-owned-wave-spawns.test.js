// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import{makeBattle,enemyRec}from'./helpers/battleHarness.js';
const record=()=>enemyRec({key:'owned',hp:100,speed:0}),fixture=(opts={})=>makeBattle({content:'none',autoFinish:true,timeLimit:30,...opts});
const spawn=(time=0)=>({time,enemyKey:'owned',def:record(),pos:[10,7]});

test('reservation state is visible only to its exact battle, capability and owner',()=>{
 const h=fixture(),g=fixture(),owner={},batch=h.b.reserveEnemySpawns([spawn()],owner);
 assert.equal(h.b.enemySpawnReservationState(batch,owner),'dormant');assert.equal(h.b.enemySpawnReservationState({...batch},owner),null);assert.equal(h.b.enemySpawnReservationState(batch,{}),null);assert.equal(g.b.enemySpawnReservationState(batch,owner),null);
 batch.activate();assert.equal(h.b.enemySpawnReservationState(batch,owner),'active');batch.cancel();assert.equal(h.b.enemySpawnReservationState(batch,owner),'cancelled');
});
test('dormant waves count immediately and hold a clear without spawning until their actual activation boundary',()=>{
 const h=fixture(),b=h.b,one=b.reserveEnemySpawns([spawn(1)],{}),two=b.reserveEnemySpawns([spawn(2)],{});
 assert.equal(b.total,2);h.run(5);assert.equal(b.finished,false);assert.equal(b.enemies.length,0);assert.equal(one.pendingCount,1);
 const at=b.time;assert.ok(one.activate());assert.equal(one.activate(),false);h.run(.9);assert.equal(b.enemies.length,0);h.run(.2);assert.equal(b.enemies.length,1);assert.ok(Math.abs(b.enemies[0].deployedAt-at-1)<.05);assert.equal(b.total,2);assert.equal(one.pendingCount,0);assert.equal(one.spawned[0].unit,b.enemies[0]);assert.equal(one.spawned[0].unitLife,b.enemies[0].deploySeq);
 b.kill(b.enemies[0],null);h.run(1);assert.equal(b.finished,false);assert.ok(two.activate());h.run(2.1);assert.equal(b.total,2);b.kill(b.enemies[0],null);h.step();assert.equal(b.finished,true);assert.equal(b.killed,2);assert.deepEqual(b.errors,[]);
});
test('cancelling a batch removes only its unborn counts and cannot cancel another batch or its born body',()=>{
 const h=fixture(),b=h.b,owner={},one=b.reserveEnemySpawns([spawn(),spawn(10)],owner),two=b.reserveEnemySpawns([spawn()],owner);
 one.activate();h.step();assert.equal(b.total,3);assert.equal(b.enemies.length,1);assert.ok(one.cancel());assert.equal(one.cancel(),false);assert.equal(one.activate(),false);assert.equal(b.total,2);assert.equal(one.pendingCount,0);assert.equal(two.pendingCount,1);
 two.activate();h.step();assert.equal(b.enemies.length,2);assert.equal(b.total,2);assert.deepEqual(b.errors,[]);
});
test('reservation validates an entire batch before adding counters, and detaches inline records',()=>{
 const h=fixture(),b=h.b;
 for(const invalid of [{...spawn(),time:Infinity},{...spawn(),count:2},{time:0,enemyKey:'unknown'}])assert.throws(()=>b.reserveEnemySpawns([spawn(),invalid],{}));
 assert.equal(b.total,0);assert.equal(b._pending.length,0);const input=spawn(),batch=b.reserveEnemySpawns([input],{});input.def.stats.maxHp=9999;input.pos[1]=1;batch.activate();h.step();assert.equal(b.enemies[0].s.maxHp,100);assert.equal(b.enemies[0].spawnX,7);assert.deepEqual(b.errors,[]);
});
test('timeout removes dormant reservations as unspawned instead of leaking them or keeping their precounts',()=>{
 const h=fixture({timeLimit:1}),b=h.b,batch=b.reserveEnemySpawns([spawn()],{});h.run(1.1);assert.equal(b.reason,'timeout');assert.equal(b.total,0);assert.equal(b.leakedCount,0);assert.equal(batch.pendingCount,0);assert.equal(batch.activate(),false);assert.equal(batch.cancel(),false);assert.equal(b.result().unspawned[0].activationPending,true);assert.deepEqual(b.errors,[]);
});
test('deferred end blocks activation and cancellation before final counters are captured',()=>{
 const h=fixture(),b=h.b,batch=b.reserveEnemySpawns([spawn()],{});b.after(0,()=>{b.forceEnd();assert.equal(batch.activate(),false);assert.equal(batch.cancel(),false);assert.throws(()=>b.reserveEnemySpawns([spawn()],{}),/live owner/);});h.step();assert.ok(b.finished);assert.equal(b.result().total,1);assert.equal(b.enemies.length,0);assert.deepEqual(b.errors,[]);
});
test('an end request from the first spawn prevents other due reserved bodies from being born in that phase',()=>{
 const h=fixture(),b=h.b,batch=b.reserveEnemySpawns([spawn(),spawn()],{});b.on('enemySpawn',()=>b.forceEnd());batch.activate();h.step();
 assert.equal(batch.spawned.length,1);assert.equal(batch.pendingCount,1);assert.equal(b.enemies.length,1);assert.equal(b.result().total,2);assert.equal(b.reason,'forced');assert.deepEqual(b.errors,[]);
});
test('runtime overrides are rejected before any reservation in a batch can change counters',()=>{
 const h=fixture(),b=h.b;b.enemyOverrides.owned={stats:{maxHp:1}};assert.throws(()=>b.reserveEnemySpawns([spawn()],{}),/override/);assert.equal(b.total,0);assert.equal(b._pending.length,0);
});
