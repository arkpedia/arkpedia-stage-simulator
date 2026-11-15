// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {loadContentContext,planStage} from '../tools/arkpedia/content-inventory.mjs';
import {loadStageRuleReceipt} from '../tools/arkpedia/stage-rule-storage.mjs';
import {readOriginalLevel} from '../tools/arkpedia/original-level.mjs';
import {selectStaticDeviceInstances} from '../tools/arkpedia/stage-device-instances.mjs';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
const c=await loadContentContext();
test('3-6 Challenge removes the actual source Detectors while preserving map terrain and ordinary-stage devices',async()=>{
 const a=await planStage(c,'3-6'),p=await planStage(c,'3-6_challenge_mode');assert.deepEqual(a.blockers,[]);assert.deepEqual(p.blockers,[]);
 assert.equal(a.stage.devices.length,2);assert.ok(a.stage.devices.every(d=>d.key==='trap_005_sensor'));
 assert.deepEqual(p.stage.devices,[]);assert.deepEqual(p.stage.tokens,[]);assert.equal(p.stage.rules.excludePredefinedTraps,true);
 assert.deepEqual(p.stage.geometry.tileGrid,a.stage.geometry.tileGrid);assert.deepEqual(p.stage.geometry.tileLegend,a.stage.geometry.tileLegend);
 const make=s=>new StandardBattle({...c.mvp,stage:s,enemies:{...c.mvp.enemies,...s.enemies}},{operators:[defaultBuild(c.mvp.operators.char_123_fang)]});
 const normal=make(a.stage),challenge=make(p.stage);assert.equal(normal.manualStageDevices.entries.size,2);assert.equal(challenge.manualStageDevices.entries.size,0);
 assert.equal(challenge.units.some(u=>u.defId==='trap_005_sensor'),false);assert.ok(challenge.bench.char_123_fang);
 assert.deepEqual(challenge.errors,[]);assert.ok(p.localSources.some(s=>s.path.includes('original-level')));
});
test('predefined exclusion refuses unseen devices, supplied cards, activation schedules and ambiguous matching',async()=>{
 const p=await planStage(c,'3-6');const{receipt}=await loadStageRuleReceipt(c.root,'3-6_challenge_mode');const{level}=await readOriginalLevel(c.root,receipt);
 const devices=p.stage.devices.map(({instance,alias,...d})=>d),rules={excludePredefinedTraps:true};
 const before=structuredClone(level);assert.deepEqual(selectStaticDeviceInstances(devices,level,rules).devices,[]);assert.deepEqual(level,before);
 for(const change of [l=>l.predefines.tokenInsts[0].inst.characterKey='trap_unknown',l=>l.predefines.tokenCards.push({inst:{characterKey:'trap_001_crate'}}),
  l=>l.predefines.tokenInsts[0].overrideSkillBlackboard=[{key:'duration',value:99}],
  l=>l.waves[0].fragments[0].actions.push({key:'trap_005_sensor',actionType:'ACTIVATE_PREDEFINED'})]){
  const bad=structuredClone(level);change(bad);assert.throws(()=>selectStaticDeviceInstances(devices,bad,rules),/Unsupported|Unimplemented|Scheduled/);
 }
 assert.throws(()=>selectStaticDeviceInstances([devices[0],devices[0]],level,rules),/Unsupported/);
 assert.throws(()=>selectStaticDeviceInstances(devices.slice(1),level,rules),/Unsupported/);
});
