// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import support from '../data/arkpedia-enemy-support.json' with {type:'json'};
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {nativeComponents,prefabPath} from '../shared/arkpedia/enemy-support.js';
import {zealousExtraNative} from '../shared/arkpedia/enemy-zealous-extra-features.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_10095_crgst','enemy_10095_crgst_2'];
for(const id of ids)test(`${id}: its source-gated body is blockable only by a marked ally and never attacks`,()=>{
  const record=withCompiledEnemyRuntime(records.enemies[id].levels[0]),op=chessRec({id:'extra_blocker',stats:{atk:0}});
  assert.ok(support.enemies[id].policy);assert.ok(zealousExtraNative(record,nativeComponents(native,id)));
  const h=makeBattle({content:'none',autoFinish:false,timeLimit:30,defs:{enemies:{[id]:record},chess:{[op.chessId]:op}},
    units:[{chessId:op.chessId,row:10,col:6}],setup:installEnemyFeatures});
  h.b.start();const enemy=h.b.spawnEnemy(id,{pos:[10,6]}),ally=h.b.allyUnits[0];
  h.b.addBuff(enemy,{key:'test:hold',flags:{noMove:true}});
  assert.equal(h.b._checkBlock(enemy),false);h.b.addBuff(ally,{key:'env_act43side[shooting]'});
  assert.equal(h.b._checkBlock(enemy),true);h.run(2);assert.equal(enemy.stats.attacks,0);assert.equal(enemy.blockedBy,ally);
  h.b.removeBuff(ally,'env_act43side[shooting]');h.run(.15);assert.equal(enemy.blockedBy,null);
  assert.equal(ally.findBuff('enemy_crgst[blocker]'),null);assert.deepEqual(h.b.errors,[]);
});
test('native admission refuses changed pair semantics, marker, checker, combat and release target',()=>{
  const id=ids[0],path=prefabPath(id),record=records.enemies[id].levels[0];
  for(const mutation of['conditionType','pair','combat','marker','clock','owner','release']){
    const evidence={...native,prefabs:{[path]:structuredClone(native.prefabs[path])},templates:{...native.templates,
      'enemy_crgst[blocker]':structuredClone(native.templates['enemy_crgst[blocker]']),
      'enemy_crgst[blockee]':structuredClone(native.templates['enemy_crgst[blockee]'])}};
    for(const entry of evidence.prefabs[path]){const c=JSON.parse(entry.originalJson);
      if(mutation==='conditionType'&&'_modes'in c)c._specialBlockCondition._type=2;
      if(mutation==='pair'&&'_modes'in c)c._specialBlockCondition._buffKeyPairs[0].blockerBuffKey='different';
      if(mutation==='combat'&&entry.objectName==='Combat')c.m_Script.m_PathID='4381884627089348317';
      if(mutation==='marker'&&entry.objectName==='unblockable'&&c._buffs)c._buffs[0].attributes.abnormalFlags=[3];
      if(mutation==='clock'&&c._buffsToBlockee)c._buffsToBlockee[0].triggerInterval=1;
      entry.originalJson=JSON.stringify(c);
    }
    if(mutation==='owner')evidence.templates['enemy_crgst[blocker]'].eventToActions.ON_BUFF_TRIGGER[0]._conditionNode._targetType='BUFF_SOURCE';
    if(mutation==='release')evidence.templates['enemy_crgst[blockee]'].eventToActions.ON_BUFF_START[0]._target='BUFF_SOURCE';
    assert.equal(zealousExtraNative(record,nativeComponents(evidence,id)),false,mutation);
  }
});
