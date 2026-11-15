// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {enemySupport} from '../shared/arkpedia/enemy-support.js';
import {enemyModelKey} from '../shared/arkpedia/facing.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
import mvp from '../data/arkpedia-mvp.json' with {type:'json'};
test('reviewed variants retain distinct source stats and reuse their exact native prefab and model',()=>{
 for(const[base,id,key,value]of [['enemy_2001_duckmi','enemy_2001_duckmi_2','run.attack@move_speed',3],
  ['enemy_2034_sythef','enemy_2034_sythef_2','Combat.attack@stun',3.5]]){
  const entry=ENEMY_RECORDS.enemies[id],r=entry.levels[0],ordinary=ENEMY_RECORDS.enemies[base].levels[0];
  assert.ok(enemySupport(entry,clocks.prefabs,evidence).policy);assert.equal(r.prefabKey,ordinary.prefabKey);
  assert.notEqual(r.stats.maxHp,ordinary.stats.maxHp);assert.equal(r.talents.bb[key],value);
  const model=enemyModelKey(id,r);assert.equal(model,enemyModelKey(base,ordinary));assert.ok(mvp.sd.models[model]);
  assert.equal(mvp.sd.models[`enemy/${id}/default/default`],undefined,'no duplicate model entry or body is needed');
  const changed=structuredClone(entry);changed.levels[0].talents.bb[key]=value+1;
  assert.equal(enemySupport(changed,clocks.prefabs,evidence).policy,null,'unknown variant parameters remain blocked');
  changed.levels[0].talents.bb[key]=value;changed.levels[0].prefabKey='enemy_unreviewed';
  assert.equal(enemySupport(changed,clocks.prefabs,evidence).policy,null,'a translated description cannot admit a different native prefab');
 }
});
