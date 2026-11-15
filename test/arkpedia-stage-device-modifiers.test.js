// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadContentContext,planStage} from '../tools/arkpedia/content-inventory.mjs';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {manualDeviceDefinition} from '../shared/arkpedia/stage-manual-devices.js';
import {turretDefinition} from '../shared/arkpedia/stage-turrets.js';
import {loadStageRuleReceipt} from '../tools/arkpedia/stage-rule-storage.mjs';
import {compileStageRules} from '../shared/arkpedia/stage-rules.js';
const c=await loadContentContext();
const setup=async id=>{
 const p=await planStage(c,id);assert.deepEqual(p.blockers,[],id);
 const b=new StandardBattle({...c.mvp,stage:p.stage,enemies:{...c.mvp.enemies,...p.stage.enemies}},
  {operators:[defaultBuild(c.mvp.operators.char_123_fang)]});b.life=1e6;
 return {p,b,advance:t=>{for(let i=0;i<Math.ceil(t/b.dt);i++)b.step()}};
};
test('CB-EX8 Challenge charges Command Terminals to 1.5 times their SP cost before activation',async()=>{
 const{p,b,advance}=await setup('cb-ex8_challenge_mode');
 const d=[...b.manualStageDevices.entries.values()].find(d=>d.key==='trap_008_farm');assert.ok(d);
 b.addBuff(d.unit,{key:'test:protect',flags:{invulnerable:true}});
 const placed=p.stage.devices.find(d=>d.key==='trap_008_farm');
 const original=manualDeviceDefinition(placed.key,placed.instance);
 assert.equal(d.spec.spCost,original.spCost*1.5);assert.equal(d.sp,original.initSp);
 assert.equal(d.spec.spPerSecond,original.spPerSecond);assert.equal(d.spec.dpCost,original.dpCost);
 advance((original.spCost-original.initSp)/original.spPerSecond);
 assert.match(b.manualStageDevices.error(d.id),/charging/);
 const slots=b.unitLimit;b.addDp('arkpedia',99);
 advance((d.spec.spCost-original.spCost)/original.spPerSecond+.1);
 assert.equal(b.manualStageDevices.error(d.id),null);
 b.manualStageDevices.activate(d.id);advance(2);
 assert.ok(b.unitLimit>slots);assert.deepEqual(b.errors,[]);
 assert.equal(manualDeviceDefinition(placed.key,placed.instance).spCost,original.spCost,'shared source remains unchanged');
});
test('BW-8 Challenge adds 300 ATK to each source Turret and uses the modified ATK on projectile impact',async()=>{
 const{p,b,advance}=await setup('bw-8_challenge_mode');const devices=[...b.stageTurrets.entries.values()];assert.ok(devices.length);
 for(const d of devices){const placed=p.stage.devices.find(x=>x.row===d.unit.tileR&&x.col===d.unit.tileC&&x.key==='trap_007_ballis');assert.equal(d.unit.s.atk,turretDefinition(placed.instance).atk+300);}
 const d=devices[0];d.spec.direction='RIGHT';d.unit.x=1;d.unit.y=2;
 const target=b.spawnDevice('test:target',2,3,{hp:10000,def:100,blockCnt:0});target.profile.enemyTargetableDevice=true;
 b.stageTurrets.fire(d);advance(.3);assert.equal(target.hp,10000-(d.unit.s.atk-100));assert.deepEqual(b.errors,[]);
});
test('additive device rules reject unreviewed character targets and stats',async()=>{
 const{receipt}=await loadStageRuleReceipt(c.root,'bw-8_challenge_mode');const source={id:receipt.stageId,variant:{kind:'challenge_mode',of_stage_id:receipt.parentStageId}};
 for(const change of [r=>r.blackboard.find(x=>x.key==='char').valueStr='char_123_fang',r=>r.blackboard.find(x=>x.key==='atk').key='max_hp',
  r=>r.blackboard.find(x=>x.key==='char').valueStr='trap_unknown',r=>r.buildableMask='MELEE']){
  const bad=structuredClone(receipt);change(bad.runes.find(r=>r.key==='char_attribute_add'));assert.throws(()=>compileStageRules(source,bad),/Unsupported additive/);
 }
});
