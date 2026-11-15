// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceRuntime} from '../server/sim/content/arkpedia-device-runtime.js';
import {DEVICE_RUNTIME_INDEX} from '../server/sim/content/arkpedia-device-runtime-index.js';
const empty=()=>({devices:[],tokens:[],geometry:{tileGrid:[[0]],tileLegend:[{key:'tile_road'}]}});
test('controllers belong to the selected stage even when modules remain cached from a previous stage',async()=>{
  let loads=0,created=0;const runtime=createDeviceRuntime([{key:'device',selected:s=>s.device,exportName:'Controller',
    load:async()=>{loads++;return{Controller:class{}};},create:()=>{created++;return{owner:created};}}]);
  assert.throws(()=>runtime.assertPrepared({device:true}),/must be prepared/);
  await Promise.all([runtime.prepare({device:true}),runtime.prepare({device:true})]);assert.equal(loads,1);
  assert.deepEqual(runtime.create('device',{}, {device:true}),{owner:1});
  await runtime.prepare({device:false});assert.equal(runtime.create('device',{}, {device:false}),null);assert.equal(created,1);
  assert.deepEqual(runtime.create('device',{}, {device:true}),{owner:2});
});
test('device import and missing-export failures can retry',async()=>{
  let calls=0;const runtime=createDeviceRuntime([{key:'device',selected:()=>true,exportName:'Controller',create:m=>new m.Controller(),load:async()=>{
    if(++calls===1)throw Error('network');return calls===2?{}:{Controller:class{}};
  }}]);
  await assert.rejects(runtime.prepare({}),/network/);await assert.rejects(runtime.prepare({}),/Missing device runtime export/);
  assert.deepEqual(runtime.stats(),{loaded:[],pending:0});await runtime.prepare({});runtime.assertPrepared({});
  assert.ok(runtime.create('device',{},{}));assert.throws(()=>runtime.create('unknown',{},{}),/Unknown device runtime/);
});
test('device selection includes supplied coils and demolition, hidden scheduled devices and wooden stumps',async()=>{
  const chosen=stage=>DEVICE_RUNTIME_INDEX.filter(e=>e.selected(stage)).map(e=>e.key);
  assert.deepEqual(chosen(empty()),[]);
  assert.deepEqual(chosen({...empty(),tokens:[{unitId:'trap_019_electric',count:0}]}),['coils']);
  assert.deepEqual(chosen({...empty(),tokens:[{unitId:'trap_045_dublst',count:0}]}),['demolition']);
  const geometry={tileGrid:[[1]],tileLegend:[{key:'tile_road'},{key:'tile_wooden_wall'}]};
  assert.deepEqual(chosen({...empty(),geometry}),['scenery']);
  assert.deepEqual(chosen({...empty(),devices:[{name:"'Twigs That Crave'",key:'trap_086_larva',hidden:true}]}),['twigs']);
  assert.deepEqual(chosen({...empty(),devices:[{name:'Imprisonment Device',key:'trap_025_prison',hidden:false}]}),['manual']);
  const runtime=createDeviceRuntime();await runtime.prepare(empty());assert.deepEqual(runtime.stats().loaded,[]);
});
