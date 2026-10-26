// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import data from'../data/arkpedia-mvp.json' with{type:'json'};
import{StandardBattle}from'../server/sim/arkpedia.js';import{defaultBuild}from'../shared/arkpedia/loadout.js';
import{installViyPredefined}from'../server/sim/content/arkpedia-viy-predefined.js';
import{summonPlacementError,retreatRegularSummon}from'../server/sim/content/arkpedia-summons.js';
test('presentation holds reject player deployment, withdrawal, skills and field actions without consuming resources',()=>{
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];const b=new StandardBattle(d,{operators:['char_122_beagle','char_208_melan'].map(id=>defaultBuild(d.operators[id]))});b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.getPlayer('arkpedia').dp=99;
 const u=b.deployOperator('char_122_beagle',2,4,'RIGHT'),viy=installViyPredefined(b);viy.unit.skill.setSpTotal(49);let actions=0;b.stageDeviceActions=new Map([['fixture',{state:{activate:()=>++actions}}]]);u.mem.regularSecondaryAction={available:()=>true,run:()=>++actions};
 const hold=b.acquireSimulationHold({}),before={dp:b.dp,slots:b.deployedSlots(),sp:viy.unit.skill.spTotal,seq:b._deploySeq,deployments:b.bench.char_208_melan.deployments};
 assert.throws(()=>b.deployOperator('char_208_melan',2,5,'RIGHT'),/presentation/);assert.throws(()=>b.retreatOperator('char_122_beagle'),/inactive/);assert.throws(()=>b.deployToken('none',2,6),/presentation/);
 assert.equal(b.activateOperator(viy.key),false);assert.equal(b.activateStageDevice('fixture'),false);assert.equal(b.secondaryActionOperator('char_122_beagle'),false);assert.match(summonPlacementError(b,'none',2,6),/presentation/);assert.throws(()=>retreatRegularSummon(b,'none'),/inactive/);
 assert.equal(actions,0);assert.ok(u.alive);assert.deepEqual({dp:b.dp,slots:b.deployedSlots(),sp:viy.unit.skill.spTotal,seq:b._deploySeq,deployments:b.bench.char_208_melan.deployments},before);
 hold.release();assert.ok(b.activateOperator(viy.key));assert.ok(b.activateStageDevice('fixture'));assert.ok(b.secondaryActionOperator('char_122_beagle'));assert.equal(actions,2);assert.ok(b.deployOperator('char_208_melan',2,5,'RIGHT'));b.retreatOperator('char_122_beagle');assert.equal(u.alive,false);assert.deepEqual(b.errors,[]);
});
