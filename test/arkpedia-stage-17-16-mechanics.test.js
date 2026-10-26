// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import base from'../data/arkpedia-mvp.json' with{type:'json'};import source from'../data/candidates/arkpedia-stage-17-16-source.json' with{type:'json'};
import index from'../data/arkpedia-stages.json' with{type:'json'};
import{StandardBattle,createStage17_16MechanicsBattle as create}from'../server/sim/arkpedia.js';
import{selectedViyPredefined,VIY_PREDEFINED_KEY}from'../server/sim/content/arkpedia-viy-predefined.js';
import{stage17_16SchedulePlan}from'../server/sim/content/arkpedia-stage-17-16-schedule.js';
import{resolveStage}from'../shared/arkpedia/stages.js';import{assertCandidatePredefines}from'../tools/arkpedia/candidate-predefines.mjs';
import{workspaceStagePreparation,createWorkspaceBattle}from'../server/sim/arkpedia-stage-entry.js';
import{stage17_16Preparation}from'../server/sim/content/arkpedia-stage-17-16-mechanics.js';
import{fixedStagePreparationHtml}from'../public/arkpedia/fixed-stage-preparation.js';
import{defaultBuild}from'../shared/arkpedia/loadout.js';
const ids=['char_473_mberry','char_128_plosis','char_4023_rfalcn','char_488_buildr'];
function workspaceData(){return{...structuredClone(base),stage:{...structuredClone(source.stage),testOnly:true,geometry:structuredClone(source.geometry),devices:structuredClone(source.devices),tokens:[],pathing:{moveScale:source.rawLevel.options.moveMultiplier}}};}
const reviewEntry=Object.freeze({id:'17-16',testOnly:true});

test('fixed-stage preparation exposes only the source-deployed preset with no player or hidden-card selection',()=>{
 const d=workspaceData(),p=workspaceStagePreparation(d,reviewEntry,{experimental:true});assert.equal(p.kind,'stage-supplied');assert.equal(p.selectable,false);assert.equal(p.support,false);assert.equal(p.hasReinforcements,true);assert.equal(p.visible.length,1);
 const v=p.visible[0];assert.equal(v.build.id,'char_4226_veen');assert.equal(v.build.elite,2);assert.equal(v.build.level,90);assert.equal(v.build.potential,6);assert.equal(v.build.trust,200);assert.equal(v.build.skillRank,8);assert.equal(v.skillNumber,3);assert.equal(v.dir,'RIGHT');assert.deepEqual([v.row,v.col],[4,3]);
 assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.visible)&&Object.isFrozen(v)&&Object.isFrozen(v.build));for(const id of ids)assert.ok(!JSON.stringify(p).includes(id));
 const html=fixedStagePreparationHtml(p,{char_4226_veen:{name:'Viy <script>'}});assert.ok(html.includes('Viy &lt;script&gt;'));assert.ok(html.includes('S3 M1'));assert.ok(html.includes('Already deployed'));assert.ok(!html.includes('<select'));for(const id of ids)assert.ok(!html.includes(id));
});

test('workspace dispatch uses exact source construction and ignores supplied squad/support fields for the nonselectable level',()=>{
 const d=workspaceData(),selection={operators:[{id:'forged',stats:{maxHp:1e9}}],support:{id:'forged'}},b=createWorkspaceBattle(d,selection,{entry:reviewEntry,experimental:true,seed:23});
 assert.equal(b.seed,23);assert.equal(b.stageId,'17-16');assert.equal(b.internalStageMechanics.admitted,false);assert.deepEqual(Object.keys(b.bench),[]);assert.equal(b.deployedSlots(),1);assert.equal(b.dp,10);assert.equal(b.allyUnits[0].defId,'char_4226_veen');assert.equal(selection.operators.length,1);assert.deepEqual(b.errors,[]);
});

test('workspace preparation does not mint catalogue admission or accept wrong fixed-stage entry flags',()=>{
 const d=workspaceData();for(const [entry,experimental]of [[undefined,true],[reviewEntry,false],[{id:'17-16',testOnly:false},true],[{id:'17-14',testOnly:true},true]])assert.throws(()=>workspaceStagePreparation(d,entry,{experimental}),/explicit experimental|disagree/);
 assert.throws(()=>workspaceStagePreparation(base,reviewEntry,{experimental:true}),/disagree/);assert.throws(()=>resolveStage(index,'17-16',{experimental:true}),/Unknown stage/);
});

test('fixed-stage preparation rejects edited level mechanics, hidden/selectable flags and source overrides before starting',()=>{
 for(const change of [d=>d.stage.battle.initial_dp=99,d=>d.stage.geometry.tileGrid=[],d=>delete d.stage.devices,d=>d.stage.tokens.push('extra'),d=>d.stage.pathing.moveScale=1,d=>d.stage.fixedSquad=[{unit_id:'extra'}],d=>d.stage.testOnly=false]){const d=workspaceData();change(d);assert.throws(()=>workspaceStagePreparation(d,reviewEntry,{experimental:true}),/workspace stage selection/);}
 for(const change of [s=>s.rawLevel.options.isPredefinedCardsSelectable=true,s=>s.rawLevel.predefines.characterCards[0].hidden=false,s=>s.rawLevel.predefines.characterInsts[0].skillIndex=0]){const s=structuredClone(source);change(s);assert.throws(()=>stage17_16Preparation(workspaceData().stage,s),/construction source/);}
});

test('ordinary workspace dispatch preserves selected squad validation and StandardBattle construction',()=>{
 const id='char_122_beagle',selection={operators:[defaultBuild(base.operators[id])]},entry={id:'0-1'},b=createWorkspaceBattle(base,selection,{entry,seed:7});
 assert.equal(workspaceStagePreparation(base,entry),null);assert.ok(b instanceof StandardBattle);assert.equal(b.internalStageMechanics,undefined);assert.deepEqual(Object.keys(b.bench),[id]);assert.equal(b.seed,7);assert.equal(b.dp,base.stage.battle.initial_dp);assert.throws(()=>createWorkspaceBattle(base,{operators:[]},{entry}),/Choose 1/);assert.deepEqual(b.errors,[]);
});
test('the exact internal constructor starts one unpaid preset with no selected or prematurely visible card',()=>{
 const b=create(base),m=b.internalStageMechanics,expected=selectedViyPredefined();assert.ok(b instanceof StandardBattle);assert.equal(b.stageId,'17-16');assert.ok(b.started);assert.equal(b.time,0);
 assert.equal(b.allyUnits.length,1);assert.equal(b.getPlayer('arkpedia').units.length,1);assert.equal(b.predefinedOperators.size,1);assert.equal(m.viy.key,VIY_PREDEFINED_KEY);assert.deepEqual(m.viy.build,expected.build);
 assert.equal(m.viy.unit.deploySeq,1);assert.equal(b._deploySeq,1);assert.equal(m.viy.unit.deployedAt,0);assert.equal(m.viy.unit.dir,'RIGHT');assert.equal(m.viy.unit.x,3);assert.equal(m.viy.unit.y,4);assert.equal(b.deployedSlots(),1);
 assert.deepEqual(Object.keys(b.bench),[]);assert.ok(m.cards.cards().every(r=>!r.active));for(const id of ids){assert.equal(b.cost(id),Infinity);assert.equal(b.data.getChess(id).raw.arkpedia.moduleLevel,3);}
 assert.equal(b.dp,10);assert.equal(b.life,3);assert.equal(b.total,14);assert.equal(b.unitLimit,9);assert.equal(b.timeLimit,Infinity);assert.equal(b.viewport,'preview');assert.equal(m.admitted,false);assert.equal(m.testOnly,true);
 assert.throws(()=>{b.internalStageMechanics={};},TypeError);assert.deepEqual(b.errors,[]);
});
test('only exact reviewed operator snapshots and seed options can enter internal construction',()=>{
 for(const id of ids){const input=structuredClone(base);input.operators[id].name+=' changed';assert.throws(()=>create(input),/operator snapshot/);delete input.operators[id];assert.throws(()=>create(input),/operator snapshot/);}
 for(const options of [null,[],()=>{}, {operators:[]},{stage:'17-18'},{timeLimit:1},{source:stage17_16SchedulePlan()},{seed:NaN},{seed:-1},{seed:2**32},{seed:1.5}])assert.throws(()=>create(base,options),/options|seed/);
 // Keep the shared RNG's established zero-to-one seed normalization.
 assert.equal(create(base,{seed:0}).seed,1);assert.equal(create(base,{seed:0xffffffff}).seed,0xffffffff);
});
test('source construction and registered records stay detached from later edits to caller catalogues and stage data',()=>{
 const input=structuredClone(base),b=create(input),record=structuredClone(b.data.rawChess(ids[0])),models=JSON.stringify(b.regularModels);
 input.stage.battle.initial_dp=999;input.stage.geometry.tileGrid=[];input.operators[ids[0]].phases=[];const modelKey=Object.keys(input.sd.models)[0];input.sd.models[modelKey].animations={fixture:999};
 assert.equal(b.dp,10);assert.deepEqual(b.data.rawChess(ids[0]),record);assert.equal(JSON.stringify(b.regularModels),models);assert.equal(b.grid.stage.rows.length,9);assert.equal(b.stageId,'17-16');assert.deepEqual(b.errors,[]);
});
test('ordinary construction, candidate compilation and stage resolution cannot forge the private construction capability',()=>{
 const p=stage17_16SchedulePlan(),d={...structuredClone(base),stage:{...structuredClone(source.stage),geometry:structuredClone(source.geometry)},enemies:p.records};
 for(const options of [{internal:true},{internalStageMechanics:true},{internal:p},{seed:1,layout:p.layout}])assert.throws(()=>new StandardBattle(d,{operators:[]},options),/Unsupported regular-stage enemy/);
 assert.throws(()=>new StandardBattle(base,{operators:[]},{internalStageMechanics:true}),/Choose 1/);
 assert.throws(()=>assertCandidatePredefines(source),/predefined operator/);assert.throws(()=>resolveStage(index,'17-16',{experimental:true}),/Unknown stage/);
});
test('ending or stopping the constructed stage retires its receivers and prevents stale dialog or card actions',()=>{
 for(const mode of ['end','stop']){const b=create(base),m=b.internalStageMechanics;if(mode==='end')b.forceEnd();else m.schedule.stop();assert.ok(b.finished);assert.equal(b.reason,'forced');assert.equal(m.schedule.state().active,false);assert.equal(b.simulationHeld,false);assert.equal(m.dialogs.state(),null);assert.equal(m.dialogs.complete({}),false);assert.deepEqual(b.errors,[]);}
});
test('the source zero maxPlayTime does not inherit the ordinary constructor 300-second timeout',()=>{
 const b=create(base),m=b.internalStageMechanics;b.on('enemySpawn',({enemy})=>{enemy.base.moveSpeed=0;enemy.markDirty();});
 for(let n=0;n<9030&&!b.finished;n++)b.step();assert.ok(b.time>300);assert.equal(b.finished,false);assert.equal(m.schedule.state().wave,0);assert.equal(m.schedule.spawned().length,11);assert.equal(m.schedule.state().pendingSpawns,3);assert.equal(b.total,14);assert.deepEqual(b.errors,[]);b.forceEnd();
});
for(const seed of [1,71])test('unmodified internal field completes with natural DP and legal fixed-card commands, seed '+seed,()=>{
 const b=create(base,{seed});b.setViewport('fullscreen-workspace');const m=b.internalStageMechanics,paid=[],casts=[];let first=false,second=false,acknowledgements=0;
 const placements=[[ids[0],2,2,'RIGHT'],[ids[1],6,2,'RIGHT'],[ids[2],5,4,'RIGHT'],[ids[3],3,4,'RIGHT']];
 for(let n=0;n<10000&&!b.finished;n++){
  b.step();while(m.dialogs.state()){assert.ok(m.dialogs.complete(m.dialogs.state().receipt));acknowledgements++;}
  if(!first&&b.killed>=2&&m.schedule.state().wave===0&&m.viy.unit.skill.spTotal>=49){first=b.activateOperator(m.viy.key);if(first)casts.push(b.time);}
  if(!second&&m.schedule.state().history.some(r=>r.kind==='STORY')&&m.viy.unit.alive){second=b.activateOperator(m.viy.key);if(second)casts.push(b.time);}
  for(const[id,row,col,dir]of placements)if(b.bench[id]&&!b.bench[id].deployments){const before=b.dp,cost=b.cost(id);const u=b.deployOperator(id,row,col,dir);assert.ok(u.alive);assert.ok(Math.abs(before-b.dp-cost)<1e-6);paid.push({id,cost});}
 }
 assert.equal(b.reason,'cleared');assert.equal(b.life,3);assert.equal(b.total,14);assert.equal(b.killed+b.leakedCount,14);assert.equal(m.schedule.state().reason,'complete');assert.equal(m.schedule.spawned().length,14);
 assert.equal(acknowledgements,14);assert.equal(casts.length,2);assert.equal(paid.length,4);assert.deepEqual(paid.map(r=>r.id),ids);assert.equal(paid.find(r=>r.id===ids[2]).cost,9);
 assert.ok(m.schedule.state().history.find(r=>r.kind==='wave-finish'&&r.wave===0).time>58);assert.ok(b.allyUnits.every(u=>u.defId==='char_4226_veen'||ids.includes(u.defId)));assert.deepEqual(b.errors,[]);
});
