// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnemyRuntime} from '../server/sim/content/arkpedia-enemy-runtime.js';
import {ENEMY_RUNTIME_INDEX} from '../server/sim/content/arkpedia-enemy-runtime-index.js';
import {compileEnemyRuntimePlan} from '../shared/arkpedia/enemy-runtime-compiler.js';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
const record=(...kinds)=>({key:'test',runtimeFeatures:{schemaVersion:1,properties:{},entries:kinds.map(kind=>({id:`native:${kind}`,ability:{kind,params:{}}}))}});
test('selected preparation deduplicates concurrent module loads and includes all declared dependency records',async()=>{
  let first=0,second=0;
  const runtime=createEnemyRuntime([
    {key:'first',exports:{one:'one',two:'two'},load:async()=>{first++;return{one:()=>({}),two:()=>({})};}},
    {key:'second',exports:{child:'child'},load:async()=>{second++;return{child:()=>({})};}},
  ]);
  const source={host:record('one','two'),spawned:record('child')};
  assert.throws(()=>runtime.assertPrepared(source),/must be prepared/);
  await Promise.all([runtime.prepare(source),runtime.prepare(source)]);
  assert.equal(first,1);assert.equal(second,1);assert.equal(runtime.stats().pending,0);
  runtime.assertPrepared(source);await runtime.prepare({host:record('two')});assert.equal(first,1);
});
test('failed module and missing-export loads can retry without installing partial factories',async()=>{
  let calls=0;
  const runtime=createEnemyRuntime([{key:'flaky',exports:{one:'one',two:'two'},load:async()=>{
    if(++calls===1)throw Error('temporary network failure');
    return calls===2?{one:()=>({})}:{one:()=>({}),two:()=>({})};
  }}]);
  const source={e:record('one','two')};
  await assert.rejects(runtime.prepare(source),/network failure/);assert.equal(runtime.stats().pending,0);
  await assert.rejects(runtime.prepare(source),/Missing enemy runtime export/);
  assert.throws(()=>runtime.assertPrepared({e:record('one')}),/must be prepared/);
  assert.deepEqual(runtime.stats().loaded,[]);
  await runtime.prepare(source);runtime.assertPrepared(source);assert.equal(calls,3);
});
test('unknown plans and unprepared raw records fail before loading or constructing combat',async()=>{
  let loads=0;const runtime=createEnemyRuntime([{key:'one',exports:{one:'one'},load:async()=>{loads++;return{one:()=>({})};}}]);
  await assert.rejects(async()=>runtime.prepare({e:record('missing')}),/Unknown enemy runtime kind/);
  const raw=records.enemies.enemy_1007_slime.levels[0];
  await assert.rejects(async()=>runtime.prepare({e:raw}),/plan must be prepared/);
  assert.equal(loads,0);
  assert.throws(()=>createEnemyRuntime([{key:'one',exports:{one:'one'}},{key:'two',exports:{one:'two'}}]),/Duplicate enemy runtime kind/);
});
test('a selected modern family loads its fixed module while a simple enemy needs no behavior module',async()=>{
  const runtime=createEnemyRuntime();
  const simple=records.enemies.enemy_1007_slime.levels[0];
  await runtime.prepare({simple:{...simple,runtimeFeatures:compileEnemyRuntimePlan(simple)}});
  assert.deepEqual(runtime.stats().loaded,[]);
  const flying=records.enemies.enemy_1410_mmelee.levels[0];
  await runtime.prepare({flying:{...flying,runtimeFeatures:compileEnemyRuntimePlan(flying)}});
  assert.deepEqual(runtime.stats().loaded,['arkpedia-enemy-rope-reactions']);
  assert.ok(ENEMY_RUNTIME_INDEX.length>40);
});
test('standard child dependencies are required before module loading and their own adapters are prepared together',async()=>{
 let loads=0;
 const runtime=createEnemyRuntime([
  {key:'spawn',exports:{deathSpawn:'spawn'},load:async()=>{loads++;return{spawn:()=>({})};}},
  {key:'child',exports:{child:'child'},load:async()=>{loads++;return{child:()=>({})};}},
 ]);
 const parent=record('deathSpawn');parent.key='enemy_parent';
 parent.runtimeFeatures.entries[0].ability.params={key:'enemy_child',cnt:1};
 assert.throws(()=>runtime.prepare({enemy_parent:parent}),/Missing enemy runtime spawn dependency/);assert.equal(loads,0);
 assert.throws(()=>runtime.assertPrepared({enemy_parent:parent}),/Missing enemy runtime spawn dependency/);
 const source={enemy_parent:parent,enemy_child:record('child')};await runtime.prepare(source);assert.equal(loads,2);
 runtime.assertPrepared(source);
});

test('seed children are required before importing the summoner module',async()=>{
 let loads=0;const runtime=createEnemyRuntime([{key:'seeds',exports:{seedSummoner:'make'},load:async()=>{loads++;return{make:()=>({})};}}]);
 const parent=record('seedSummoner');parent.key='enemy_parent';parent.runtimeFeatures.entries[0].ability.params={key:'enemy_child',count:3};
 assert.throws(()=>runtime.prepare({enemy_parent:parent}),/Missing enemy runtime spawn dependency/);assert.equal(loads,0);
 assert.throws(()=>runtime.assertPrepared({enemy_parent:parent}),/Missing enemy runtime spawn dependency/);
 const source={enemy_parent:parent,enemy_child:record()};await runtime.prepare(source);runtime.assertPrepared(source);assert.equal(loads,1);
});
