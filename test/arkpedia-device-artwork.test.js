// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeDeviceArtwork} from '../tools/arkpedia/device-artwork.mjs';
import {buildOperatorLibrary} from '../tools/arkpedia/operator-library.mjs';
import {createOperatorLibrary} from '../shared/arkpedia/operator-library.js';
import {regularModelKey} from '../shared/arkpedia/facing.js';
const key='device/trap_example/default/default';
const model={kind:'device',id:'trap_example',variant:'default',facing:'default',assetsCommit:'1'.repeat(40),
  spineVersion:'3.8.84',premultipliedAlpha:true,animations:{Default:1,Start:2},animationRoles:{idle:'Default'}};

test('a device body has its own identity and cannot become an enemy or duplicated operator facing',()=>{
 const registry={schemaVersion:1,models:{[key]:model}},original={existing:{keep:true}};
 assert.deepEqual(mergeDeviceArtwork(original,registry),{...original,[key]:model});assert.deepEqual(original,{existing:{keep:true}});
 for(const change of [{kind:'enemy'},{id:'enemy_example'},{facing:'front'},{assetsCommit:'HEAD'}])
  assert.throws(()=>mergeDeviceArtwork({}, {...registry,models:{[key]:{...model,...change}}}),/Unreviewed/);
 for(const side of ['ally','enemy'])assert.equal(regularModelKey({kind:'device',side,defId:'trap_example'}),key);
 assert.equal(regularModelKey({kind:'device',side:'enemy',defId:'trap_example',mem:{regularModelFacing:'back'}}),'operator/trap_example/default/back');
});

test('stage device models load on demand, once per body, without loading the rest of the device catalogue',async()=>{
 const source=JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json',import.meta.url)));
 const otherKey='device/trap_other/default/default',other={...model,id:'trap_other'};
 const {bootstrap,objects}=buildOperatorLibrary({...source,operators:{char_123_fang:source.operators.char_123_fang},tokens:{},sd:{...source.sd,models:{[key]:model,[otherKey]:other}}});
 const requests=[];const loader=createOperatorLibrary(bootstrap,async url=>{requests.push(url);return new Response(objects.get(url.split('/').at(-1).slice(0,-5)))});
 loader.data.stage={devices:[{key:'trap_example'},{key:'trap_example'}]};
 assert.deepEqual(loader.data.sd.models,{});await loader.ensureModels([]);await loader.ensureModels([]);
 assert.equal(requests.length,1);assert.deepEqual(loader.data.sd.models,{[key]:model});
 loader.data.stage={devices:[{key:'trap_other'}]};await loader.ensureModels([]);
 assert.equal(requests.length,2);assert.deepEqual(loader.data.sd.models[otherKey],other);
});
