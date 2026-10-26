// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import{makeBattle}from'./helpers/battleHarness.js';import{stepBattleFrame as frame}from'../public/arkpedia/battle-frame.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('a source hold within a frame advances only completed combat ticks and discards held catch-up time',()=>{
 const{b}=makeBattle({content:'none',autoFinish:false});let hold;b.after(.1,()=>hold=b.acquireSimulationHold({}));
 const first=frame(b,0,.2,2);near(b.time,.1);near(first.dt,.1);near(first.accumulator,0);assert.equal(b.tickCount,3);
 for(let n=0;n<50;n++){const held=frame(b,0,1,2);near(held.dt,0);near(held.accumulator,0);}near(b.time,.1);assert.equal(b.tickCount,3);
 hold.release();const half=frame(b,0,b.dt/2,1);near(half.dt,0);const next=frame(b,half.accumulator,b.dt/2,1);near(next.dt,b.dt);near(b.time,.1+b.dt);assert.deepEqual(b.errors,[]);
});
test('ordinary speed and fractional-frame accumulation retain their previous tick behavior',()=>{
 const{b}=makeBattle({content:'none',autoFinish:false}),first=frame(b,0,.05,2);near(first.dt,.1);near(b.time,.1);near(first.accumulator,0);
 const half=frame(b,first.accumulator,b.dt/2,1);near(half.dt,0);near(half.accumulator,b.dt/2);assert.deepEqual(b.errors,[]);
});
test('a scheduled end with no completed tick does not invent visual combat delta',()=>{
 const{b}=makeBattle({content:'none',autoFinish:false});b.after(0,()=>b.forceEnd());const ended=frame(b,0,.1,1);assert.ok(b.finished);near(ended.dt,0);near(ended.accumulator,0);near(b.time,0);assert.equal(b.tickCount,0);assert.deepEqual(b.errors,[]);
});
