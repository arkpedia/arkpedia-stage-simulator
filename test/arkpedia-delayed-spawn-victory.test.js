// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import support from '../data/arkpedia-enemy-support.json' with {type:'json'};
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle} from './helpers/battleHarness.js';
const cases=Object.entries(records.enemies).filter(([id])=>support.enemies[id]?.policy).flatMap(([id,entry])=>
  Object.values(entry.levels).flatMap(row=>{
    const record=withCompiledEnemyRuntime(row),spawn=record.runtimeFeatures.entries.find(e=>e.ability?.kind==='deathSpawnDelayed');
    return spawn?[{id,record,params:spawn.ability.params}]:[];
  }));
function fixture(row,{timeLimit=60,params={}}={}){
  const record=structuredClone(row.record),entry=record.runtimeFeatures.entries.find(e=>e.ability?.kind==='deathSpawnDelayed');
  Object.assign(entry.ability.params,params);
  const child=entry.ability.params.key,defs={[row.id]:record,[child]:withCompiledEnemyRuntime(records.enemies[child].levels[0])};
  const h=makeBattle({content:'none',autoFinish:true,timeLimit,defs:{enemies:defs},setup:installEnemyFeatures});
  h.b.start();const born=[];
  h.b.on('enemySpawn',({enemy})=>{if(enemy.defId===child){born.push(enemy);h.b.addBuff(enemy,{key:'test:hold',flags:{noMove:true}});}});
  const parent=h.b.spawnEnemy(row.id,{pos:[9,6]});return{...h,parent,born};
}
for(const row of cases)test(`${row.id}/${row.record.level}: the last parent's death waits for its children and their defeat`,()=>{
  const h=fixture(row);h.b.kill(h.parent);h.b.kill(h.parent);
  h.run(row.params.delay-h.b.dt*2);
  assert.equal(h.b.finished,false,'a delayed child prevents premature victory');assert.equal(h.born.length,0);
  h.run(h.b.dt*4);
  assert.equal(h.born.length,row.params.cnt);assert.equal(h.b.finished,false,'live children retain victory ownership');
  for(const child of h.born)h.b.kill(child);
  h.run(h.b.dt*2);assert.equal(h.b.reason,'cleared');assert.deepEqual(h.b.errors,[]);
});
test('escaping does not create a death-spawn victory blocker',()=>{
  const h=fixture(cases[0]);h.b.leak(h.parent);h.run(h.b.dt*2);
  assert.equal(h.b.reason,'cleared');assert.equal(h.born.length,0);assert.deepEqual(h.b.errors,[]);
});
test('a delayed child cannot override an earlier battle deadline or run after the battle ends',()=>{
  const row=cases.find(row=>row.params.delay===1),h=fixture(row,{timeLimit:.1});h.b.kill(h.parent);h.run(2);
  assert.equal(h.b.reason,'timeout');assert.equal(h.born.length,0);
  for(let i=0;i<60;i++)h.b.step();assert.equal(h.born.length,0);assert.deepEqual(h.b.errors,[]);
});
test('disabled counts do not retain victory and immediate children need no timer',()=>{
  const disabled=fixture(cases[0],{params:{cnt:0}});disabled.b.kill(disabled.parent);disabled.run(disabled.b.dt*2);
  assert.equal(disabled.b.reason,'cleared');assert.equal(disabled.born.length,0);
  const immediate=fixture(cases[0],{params:{delay:0}});immediate.b.kill(immediate.parent);
  assert.equal(immediate.born.length,cases[0].params.cnt);immediate.run(immediate.b.dt*2);assert.equal(immediate.b.finished,false);
  for(const child of immediate.born)immediate.b.kill(child);immediate.run(immediate.b.dt*2);assert.equal(immediate.b.reason,'cleared');
});
