// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import data from'../data/arkpedia-mvp.json' with{type:'json'};
import tables from'../data/candidates/arkpedia-stage-predefined-module-tables.json' with{type:'json'};
import native from'../data/candidates/arkpedia-stage-predefined-module-native.json' with{type:'json'};
import{StandardBattle}from'../server/sim/arkpedia.js';
import{normalizeChess}from'../server/sim/simdata.js';
import{defaultBuild,catalogueFor}from'../shared/arkpedia/loadout.js';
import{kestrelStageBuild,kestrelStageRecord,verifyKestrelStageModule}from'../server/sim/content/arkpedia-kestrel-stage-module.js';
const ID='char_4023_rfalcn',build=kestrelStageBuild(),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function advance(b,t){for(let i=0;i<Math.ceil(t/b.dt-1e-8);i++)b.step();assert.deepEqual(b.errors,[]);}
function fixture(){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const b=new StandardBattle(d,{operators:[{...build,module:null},defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 // Internal content fixture only: inject the exact record after public
 // constructor validation. This is not hidden-card activation or admission.
 const def=normalizeChess(kestrelStageRecord(build,d)),get=b.data.getChess.bind(b.data);
 b.data.getChess=(id,...args)=>id===ID?def:get(id,...args);b.bench[ID].build={...build};
 const deploy=({free=false}={})=>{b.getPlayer('arkpedia').dp=free?0:99;const u=free?b.redeployOperatorFromSkill(ID,2,7,'RIGHT'):b.deployOperator(ID,2,7,'RIGHT');u.atkCd=1000;return u;};
 return{b,def,deploy};
}
test('the exact card gains module stats and retains crit plus the separately gated sandbox talent',()=>{
 const r=kestrelStageRecord(build,data);near(r.stats.maxHp,2140);near(r.stats.atk,594);near(r.stats.def,382);near(r.stats.cost,13);
 assert.deepEqual(r.talents.map(t=>t.bb),[{prob:.2,atk_scale:1.4},{sp_recovery_per_sec:.3},{runtime_cost:-4}]);
 assert.deepEqual(catalogueFor(data)[ID].modules,[]);assert.throws(()=>new StandardBattle(structuredClone(data),{operators:[build]}));
 for(const change of [{level:79},{potential:2},{trust:200},{skillRank:10},{moduleLevel:2},{stage:'17-14'},{skillId:'skcom_charge_cost[3]'}])assert.throws(()=>kestrelStageRecord({...build,...change},data),/Unreviewed/);
});
test('first deployment pays nine, later costs scale from the undiscounted base, and withdrawals use captured payments',()=>{
 const f=fixture();
 for(const expected of [9,19,26]){
  f.b.bench[ID].readyAt=f.b.time;near(f.b.cost(ID),expected);const u=f.deploy();near(f.b.bench[ID].lastCost,expected);near(f.b.dp,99-expected);near(u.base.cost,13);
  f.b.getPlayer('arkpedia').dp=0;f.b.retreatOperator(ID);near(f.b.dp,Math.floor(expected/2));assert.ok(f.b.bench[ID].readyAt>f.b.time);
 }
 assert.equal(f.b.bench[ID].deployments,3);assert.deepEqual(f.b.errors,[]);
});
test('unaffordable, illegal and invalid-facing requests do not consume the first deployment reduction',()=>{
 const f=fixture();f.b.getPlayer('arkpedia').dp=8;assert.throws(()=>f.b.deployOperator(ID,2,7,'RIGHT'),/DP/);f.b.getPlayer('arkpedia').dp=99;
 assert.throws(()=>f.b.deployOperator(ID,-1,7,'RIGHT'));assert.throws(()=>f.b.deployOperator(ID,2,7,'INVALID'));
 assert.equal(f.b.bench[ID].deployments,0);near(f.b.cost(ID),9);f.deploy();near(f.b.bench[ID].lastCost,9);
});
test('deploying another card cannot consume Kestrel\'s own-card reduction',()=>{
 const f=fixture();f.b.getPlayer('arkpedia').dp=99;f.b.deployOperator('char_122_beagle',2,6,'RIGHT');near(f.b.cost(ID),9);assert.equal(f.b.bench[ID].deployments,0);
});
test('a free skill delivery consumes first deployment but cannot manufacture a refund',()=>{
 const f=fixture(),u=f.deploy({free:true});near(f.b.dp,0);near(f.b.bench[ID].lastCost,0);near(u.mem.regularCostAttribute,9);near(f.b.cost(ID),19);
 f.b.retreatOperator(ID);near(f.b.dp,0);f.b.bench[ID].readyAt=f.b.time;f.deploy();near(f.b.bench[ID].lastCost,19);
});
test('ordinary 17-16 mechanics do not grant the sandbox SP aura and retain S2 lockout',()=>{
 const f=fixture(),u=f.deploy();assert.deepEqual(u.mem.kestrelStageModule,{sandboxExcluded:true});near(u.s.spRecovery,1);u.skill.setSpTotal(0);advance(f.b,1);near(u.skill.spTotal,1);
 f.b.addBuff(u,{key:'fixture:personal',mods:{spRecoveryFlat:.2}});advance(f.b,1);near(u.skill.spTotal,2.2);near(u.s.spRecovery,1.2);
 u.skill.setSpTotal(u.skill.spCost);assert.ok(f.b.activateOperator(ID));assert.equal(u.skill.gainSp(10,'fixture'),0);advance(f.b,1);near(u.skill.spTotal,0);assert.equal(u.findBuff('rfalcn_e_t_2'),null);
});
test('sandbox mode and altered deployment counters fail closed instead of silently granting normal-stage support',()=>{
 const f=fixture(),tags=f.b.mapTags;f.b.mapTags=[...tags,'sandbox_1'];assert.throws(()=>f.b.cost(ID),/mode/);f.b.mapTags=tags;
 for(const n of [-1,.5,NaN]){f.b.bench[ID].deployments=n;assert.throws(()=>f.b.cost(ID),/deployment count/);}
});
test('changed module, native first-cost/sandbox fields and hidden source card are rejected',()=>{
 const t=structuredClone(tables);t.modules.uniequip_002_rfalcn.phase.parts[1].addOrOverrideTalentDataBundle.candidates[0].blackboard[0].value=-5;assert.throws(()=>verifyKestrelStageModule(t,native),/Unreviewed/);
 const card=structuredClone(tables);card.stages['17-16'].predefines.characterCards.find(c=>c.inst.characterKey===ID).hidden=false;assert.throws(()=>verifyKestrelStageModule(card,native),/Unreviewed/);
 for(const k of ['rfalcn_equip_1_3_p1','rfalcn_equip_1_3_p2']){const n=structuredClone(native);n.prefabs[k].components[0].pathId='changed';assert.throws(()=>verifyKestrelStageModule(tables,n),/Unreviewed/);}
});
