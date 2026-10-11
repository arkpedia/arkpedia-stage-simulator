// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireTargets } from '../server/sim/ai.js';

test('source block-limited targeting caps all selected enemies and preserves current blocked priority',()=>{
  const enemies=Array.from({length:4},(_,i)=>({id:i+1,s:{taunt:0},travelled:i+1})),
    unit={s:{blockCnt:3,maxTargets:7},blocking:[enemies[0]],rangeKeys:[0]};
  enemies[0].blockedBy=unit;
  const battle={enemiesInKeys:()=>enemies.slice(),blockedTargets:()=>[enemies[0]],
    remainingDistance:e=>e.id,distSq:(u,e)=>e.id};
  assert.deepEqual(acquireTargets(battle,unit,{maxTargetsByBlock:true}),enemies.slice(0,3));
  unit.s.blockCnt=2;assert.equal(acquireTargets(battle,unit,{maxTargetsByBlock:true}).length,2);
  unit.s.blockCnt=0;assert.equal(acquireTargets(battle,unit,{maxTargetsByBlock:true}).length,1);
  assert.equal(acquireTargets(battle,unit,{maxTargetsByBlock:true,allowZeroBlockTargetLimit:true}).length,0);
  assert.equal(acquireTargets(battle,unit,{maxTargets:1}).length,4,'ordinary maxTargets modifiers remain unchanged');
});
