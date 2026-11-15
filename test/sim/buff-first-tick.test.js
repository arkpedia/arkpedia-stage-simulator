// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,enemyRec} from '../helpers/battleHarness.js';
function pulses(firstTickDelay){
  const h=makeBattle({content:'none',autoFinish:false,timeLimit:10,defs:{enemies:{clock:enemyRec({key:'clock',speed:0})}}});
  h.b.start();const unit=h.b.spawnEnemy('clock',{pos:[9,6]}),times=[];
  h.b.addBuff(unit,{key:'test:clock',duration:4,interval:1,firstTickDelay,onTick:()=>times.push(h.b.time)});
  h.run(2.6);assert.deepEqual(h.b.errors,[]);return{times,dt:h.b.dt};
}
for(const[firstDelay,expected]of[[undefined,[1,2]],[Math.fround(.1),[.1,1.1,2.1]],[1.5,[1.5,2.5]],[-1,[1,2]]])
  test(`periodic buff first delay ${firstDelay} preserves its subsequent one-second clock`,()=>{
    const {times,dt}=pulses(firstDelay);assert.equal(times.length,expected.length);
    for(let i=0;i<times.length;i++)assert.ok(Math.abs(times[i]-expected[i])<=dt+1e-8,`${times[i]} near ${expected[i]}`);
  });
