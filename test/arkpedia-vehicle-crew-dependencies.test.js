// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import support from '../data/arkpedia-enemy-support.json' with {type:'json'};
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle} from './helpers/battleHarness.js';
const pairs=[['enemy_1162_magmot','enemy_1161_tidmag'],['enemy_1162_magmot_2','enemy_1161_tidmag_2'],
 ['enemy_1163_hvymot','enemy_1160_hvyslr'],['enemy_1163_hvymot_2','enemy_1160_hvyslr_2']];
for(const[parent,child]of pairs)test(`${parent}: the string-typed crew is compiled, declared and spawned once on a kill`,()=>{
 assert.deepEqual(support.enemies[parent].spawns,[child]);
 for(const compiled of[false,true]){
  const defs=Object.fromEntries([parent,child].map(id=>[id,compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0]]));
  const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,defs:{enemies:defs},setup:installEnemyFeatures});
  h.b.start();const route={start:[9,8],steps:[{t:'move',p:[9,3]}]},e=h.b.spawnEnemy(parent,{pos:[9,8],route});
  h.b.applyStatus(e,'silence',{duration:10});h.b.kill(e);h.b.kill(e);
  const children=h.b.enemies.filter(e=>e.defId===child);assert.equal(children.length,1);
  assert.equal(children[0].x,e.x);assert.equal(children[0].y,e.y);assert.ok(children[0].route.legs.length);
  const leaked=h.b.spawnEnemy(parent,{pos:[10,8],route});h.b.leak(leaked);
  const expired=h.b.spawnEnemy(parent,{pos:[11,8],route});h.b._remove(expired,'expire');
  assert.equal(h.b.enemies.filter(e=>e.defId===child).length,1);assert.deepEqual(h.b.errors,[]);
 }
});
