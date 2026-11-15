// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {auditNativeBuffPrograms} from '../tools/arkpedia/native-buff-programs.mjs';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
const prefab=(id,templateKey)=>[`dyn/battle/prefabs/enemies/${id}.prefab`,[{originalJson:JSON.stringify({_buffs:[{templateKey}]})}]];
test('audit propagates source consumers through child template edges without duplicating program payloads',()=>{
  const templates=Object.fromEntries(['bldrat_t_1[blood]','blood_dec'].map(k=>[k,evidence.templates[k]]));
  const source={templates,prefabs:Object.fromEntries([prefab('enemy_a','bldrat_t_1[blood]'),prefab('enemy_b','bldrat_t_1[blood]')])};
  const report=auditNativeBuffPrograms(source,{enemy_a:{policy:'reviewed'}});
  assert.equal(report.compiled,2);assert.equal(report.refused,0);
  assert.deepEqual(report.results[1].consumers,['enemy_a','enemy_b']);assert.deepEqual(report.results[1].unsupportedConsumers,['enemy_b']);
  assert.equal(report.results[0].templateCount,2);assert.match(report.results[0].programSha256,/^[a-f0-9]{64}$/);
  assert.equal(report.results[0].program,undefined);assert.deepEqual(auditNativeBuffPrograms(source,{enemy_a:{policy:'reviewed'}}),report);
});
test('audit records compiler refusals without treating unsupported consumers as admitted',()=>{
  const source={templates:{bad:{templateKey:'bad',effectKey:'',onEventPriority:'DEFAULT',eventToActions:{UNSUPPORTED:[]}}},
    prefabs:Object.fromEntries([prefab('enemy_unknown','bad')])};
  const report=auditNativeBuffPrograms(source);
  assert.equal(report.compiled,0);assert.equal(report.refused,1);assert.equal(report.results[0].compiled,false);
  assert.match(report.refusals[0].reason,/UNSUPPORTED/);assert.deepEqual(report.refusals[0].unsupportedConsumers,['enemy_unknown']);
});
