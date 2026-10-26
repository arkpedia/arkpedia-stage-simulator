// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import base from '../data/arkpedia-mvp.json' with {type:'json'};
import source from '../data/candidates/arkpedia-stage-17-14-source.json' with {type:'json'};
import index from '../data/arkpedia-stages.json' with {type:'json'};
import {StandardBattle,createStage17_14MechanicsBattle as create} from '../server/sim/arkpedia.js';
import {stage17_14MechanicsPlan,assertStage17_14ClosurEnemies} from '../shared/arkpedia/stage17-14-mechanics.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {resolveStage} from '../shared/arkpedia/stages.js';
import {assertClosurEnemyCompatibility} from '../shared/arkpedia/closur-enemy-compatibility.js';
import {assertCandidatePredefines} from '../tools/arkpedia/candidate-predefines.mjs';
import {deployRegularSummon,regularSummonCards} from '../server/sim/content/arkpedia-summons.js';
import {installClosurPredefined,CLOSUR_PREDEFINED_CONTRACT} from '../server/sim/content/arkpedia-closur-predefined.js';
import {stage17_14Preparation} from '../server/sim/content/arkpedia-stage-17-14-mechanics.js';
import {workspaceStagePreparation,createWorkspaceBattle} from '../server/sim/arkpedia-stage-entry.js';
import {presetStagePreparationHtml} from '../public/arkpedia/fixed-stage-preparation.js';
const GUARD='char_122_beagle',ID='char_4228_closur',selection=()=>({operators:[defaultBuild(base.operators[GUARD])]});
const workspaceData=()=>({...structuredClone(base),stage:{...structuredClone(source.stage),testOnly:true,geometry:structuredClone(source.geometry),devices:structuredClone(source.devices),tokens:[],pathing:{moveScale:.5}}});
const entry=Object.freeze({id:'17-14',testOnly:true});

test('selectable preparation identifies the separate preset and source exclusion without replacing the chosen squad',()=>{
 const p=workspaceStagePreparation(workspaceData(),entry,{experimental:true});
 assert.equal(p.kind,'selected-with-preset');assert.equal(p.selectable,true);assert.equal(p.support,true);assert.deepEqual(p.excludedOperators,[ID]);assert.equal(p.visible.length,1);
 const v=p.visible[0];assert.equal(v.build.id,ID);assert.equal(v.build.level,90);assert.equal(v.build.skillRank,10);assert.equal(v.build.moduleLevel,3);assert.equal(v.build.potential,1);assert.equal(v.build.trust,100);assert.equal(v.skillNumber,3);assert.deepEqual([v.row,v.col,v.dir],[3,3,'RIGHT']);
 assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.visible)&&Object.isFrozen(v)&&Object.isFrozen(v.build)&&Object.isFrozen(p.excludedOperators));
 const html=presetStagePreparationHtml(p,{[ID]:{name:'Closure <script>'}});assert.ok(html.includes('Closure &lt;script&gt;'));assert.ok(html.includes('S3 M3'));assert.ok(html.includes('Module Lv 3'));assert.ok(html.includes('separately from your squad and support'));assert.ok(!html.includes('<select'));
});

test('workspace dispatch uses the selected squad and support while installing the separate exact source preset',()=>{
 const s={...selection(),support:{id:'char_002_amiya',skillId:base.operators.char_002_amiya.skills[0].id}},b=createWorkspaceBattle(workspaceData(),s,{entry,experimental:true,seed:23});
 assert.equal(b.seed,23);assert.equal(b.stageId,'17-14');assert.deepEqual(Object.keys(b.bench),[GUARD,'char_002_amiya']);assert.equal(b.deployedSlots(),1);assert.equal(b.dp,10);assert.equal(b.total,52);assert.ok(b.internalStageMechanics.closur.u.alive);assert.equal(s.operators.length,1);assert.deepEqual(b.errors,[]);
 assert.throws(()=>createWorkspaceBattle(workspaceData(),{operators:[defaultBuild(base.operators[ID])]},{entry,experimental:true}),/excludes/);
});

test('17-14 workspace entry requires the explicit matching experimental entry and exact source stage mechanics',()=>{
 for(const[e,experimental]of [[undefined,true],[entry,false],[{id:'17-14',testOnly:false},true],[{id:'17-16',testOnly:true},true]])assert.throws(()=>workspaceStagePreparation(workspaceData(),e,{experimental}),/explicit experimental|disagree/);
 assert.throws(()=>workspaceStagePreparation(base,entry,{experimental:true}),/disagree/);
 for(const change of [d=>d.stage.battle.initial_dp=99,d=>d.stage.geometry.tileGrid=[],d=>delete d.stage.devices,d=>d.stage.tokens.push('extra'),d=>d.stage.pathing.moveScale=1,d=>d.stage.fixedSquad=[{unit_id:'extra'}],d=>d.stage.testOnly=false]){
  const d=workspaceData();change(d);assert.throws(()=>workspaceStagePreparation(d,entry,{experimental:true}),/workspace stage selection/);
 }
 const s=structuredClone(source);s.rawLevel.runes.pop();assert.throws(()=>stage17_14Preparation(workspaceData().stage,s),/stage source/);
 assert.throws(()=>resolveStage(index,'17-14',{experimental:true}),/Unknown stage/);
});

test('17-14 mechanics contract reproduces its canonical routes, source schedule and clock dependencies',()=>{
 const p=stage17_14MechanicsPlan();
 execFileSync(process.execPath,['tools/arkpedia/stage17-14-mechanics-contract.mjs','--check'],{stdio:'pipe'});
 for(const row of Object.values(p.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+row.path,import.meta.url))).digest('hex'),row.sha256);
 assert.equal(p.layout.spawns.length,52);assert.equal(p.actions.length,32);assert.equal(p.actions.filter(a=>a.action.actionType==='DISPLAY_ENEMY_INFO').length,2);
 assert.equal(p.clocks.enemy_10211_murad.unselectable,true);assert.equal(p.testOnly,true);assert.equal(p.admitted,false);
 for(const change of [p=>p.layout.spawns.pop(),p=>p.layout.routes[0].end[0]++,p=>p.records.enemy_10201_muinf_2.stats.atk++,p=>p.clocks.enemy_10211_murad.unselectable=false,p=>p.actions[0].time++]){
  const q=structuredClone(p);change(q);assert.throws(()=>stage17_14MechanicsPlan(q),/mechanics source/);
 }
});

test('exact internal 17-14 starts the separate unpaid preset, source device and untouched selected squad',()=>{
 const s=selection(),b=create(base,s,{seed:71}),m=b.internalStageMechanics,f=m.closur;
 assert.ok(b instanceof StandardBattle);assert.equal(b.stageId,'17-14');assert.equal(b.time,0);assert.ok(b.started);
 assert.equal(b.seed,71);assert.equal(b.life,3);assert.equal(b.total,52);assert.equal(b._pending.length,52);assert.equal(b.dp,10);assert.equal(b.unitLimit,9);assert.equal(b.timeLimit,Infinity);assert.equal(b.flags.moveScale,.5);
 assert.equal(b.deployedSlots(),1);assert.equal(b.predefinedOperators.size,1);assert.deepEqual(Object.keys(b.bench),[GUARD]);assert.equal(b.bench[GUARD].deployments,0);
 assert.equal(f.u.deploySeq,1);assert.equal(f.u.deployedAt,0);assert.deepEqual([f.u.y,f.u.x,f.u.dir],[3,3,'RIGHT']);assert.equal(b.unitAt(3,3),f.u);
 assert.equal(f.entry.build.skillId,'skchr_closur_3');assert.equal(f.entry.build.moduleLevel,3);assert.equal(f.entry.build.trust,100);assert.equal(f.entry.build.potential,1);
 assert.equal(f.u.base.maxHp,1942);assert.equal(f.u.base.atk,570);assert.equal(b.regularClosurRoster.floor,-5);assert.equal(b.regularClosurRoster.atk,.08);
 assert.equal(b.chapter16.rifts.length,1);assert.equal(b.chapter16.rifts[0].nativeMarker,true);
 assert.equal(regularSummonCards(b).length,1);assert.equal(b.withdrawOperator(f.u),false);assert.equal(b.viewport,'preview');
 assert.equal(m.admitted,false);assert.equal(m.testOnly,true);assert.deepEqual(b.errors,[]);assert.equal(s.operators.length,1);
});

test('17-14 source exclusion covers both ordinary and support Closure before a player copy can install',()=>{
 const closure=defaultBuild(base.operators[ID]);
 for(const s of [{operators:[closure]},{...selection(),support:{id:ID,skillId:closure.skillId}},{operators:[...selection().operators,closure]}])assert.throws(()=>create(base,s),/excludes.*Closure/);
 assert.throws(()=>create(base,{operators:[]}),/Choose 1/);
 assert.throws(()=>create(base,{operators:[...selection().operators,...selection().operators]}),/distinct/);
 const invalid=selection();invalid.operators[0].level=999;assert.throws(()=>create(base,invalid),/Invalid level/);
 const supported=create(base,{...selection(),support:{id:'char_002_amiya',skillId:base.operators.char_002_amiya.skills[0].id}});
 assert.deepEqual(Object.keys(supported.bench),[GUARD,'char_002_amiya']);assert.equal(supported.bench.char_002_amiya.build.level,80);assert.equal(supported.bench.char_002_amiya.deployments,0);
});

test('internal enemy scope is the complete exact six-record set and never broadens the public Closure guard',()=>{
 const p=stage17_14MechanicsPlan();assert.doesNotThrow(()=>assertStage17_14ClosurEnemies({enemies:p.records}));
 assert.throws(()=>assertClosurEnemyCompatibility({enemies:p.records}),/native clock review/);
 for(const change of [r=>delete r.enemy_10211_murad,r=>r.enemy_future=r.enemy_10211_murad,r=>r.enemy_10203_mumag_2.skills[0].cooldown++,r=>r.enemy_10207_mubrut_2.stats.atk++,r=>r.enemy_10209_mubag_2.talents.bb['AoeDamage.interval']=99]){
  const records=structuredClone(p.records);change(records);assert.throws(()=>assertStage17_14ClosurEnemies({enemies:records}),/enemy scope/);
 }
 for(const records of [null,[],{},base.enemies])assert.throws(()=>assertStage17_14ClosurEnemies({enemies:records}),/enemy scope/);
});

test('a candidate stage option alone cannot authorize an ordinary or edited enemy field',()=>{
 const b=new StandardBattle(base,selection());
 for(const candidateStage of ['17-14','17-18',false])assert.throws(()=>installClosurPredefined(b,{contract:CLOSUR_PREDEFINED_CONTRACT,candidateStage}),/enemy scope/);
 assert.equal(b.predefinedOperators,undefined);assert.equal(b.regularClosurRoster,undefined);assert.equal(b.deployedSlots(),0);assert.deepEqual(b.errors,[]);
});

test('ordinary construction, source admission and caller options cannot mint a 17-14 internal capability',()=>{
 const p=stage17_14MechanicsPlan(),d={...structuredClone(base),enemies:p.records,stage:{...source.stage,geometry:source.geometry,devices:source.devices,pathing:{moveScale:.5}}};
 for(const options of [{internal:true},{selectableSquad:true},{internalStageMechanics:true},{layout:p.layout}])assert.throws(()=>new StandardBattle(d,selection(),options),/Unsupported regular-stage enemy/);
 for(const options of [null,[],{stage:'17-18'},{timeLimit:1},{seed:-1},{seed:NaN},{seed:2**32},{seed:1.1}])assert.throws(()=>create(base,selection(),options),/options|seed/);
 assert.equal(create(base,selection(),{seed:0}).seed,1);
 assert.throws(()=>resolveStage(index,'17-14',{experimental:true}),/Unknown stage/);assert.throws(()=>assertCandidatePredefines(source),/predefined operator/);
});

test('caller stage and enemy edits cannot replace the exact level, preset or source records',()=>{
 const input=structuredClone(base);input.stage.battle.initial_dp=999;input.stage.geometry.tileGrid=[];input.enemies={};
 const b=create(input,selection()),p=stage17_14MechanicsPlan();
 assert.equal(b.dp,10);assert.equal(b.total,52);assert.equal(b.grid.stage.rows.length,8);assert.deepEqual(b.data.raw.enemies,p.records);assert.equal(b.internalStageMechanics.closur.u.base.maxHp,1942);
 input.stage.code='17-18';assert.equal(b.stageId,'17-14');assert.deepEqual(b.errors,[]);
});

test('source-bound command center and preset controls use legal field commands and retire on battle end',()=>{
 const b=create(base,selection()),f=b.internalStageMechanics.closur,key=f.entry.key;
 assert.throws(()=>deployRegularSummon(b,`summon:${ID}`,3,6,'RIGHT'),/fullscreen/);
 b.setViewport('fullscreen-workspace');const t=deployRegularSummon(b,`summon:${ID}`,3,6,'RIGHT');assert.ok(t);assert.equal(b.dp,10);assert.equal(b.deployedSlots(),1);
 let guard=0;while(!f.point.active()&&guard++<100)b.step();assert.ok(f.point.active());
 b.forceEnd();assert.equal(b.finished,true);assert.equal(f.controller.stopped,true);assert.equal(f.point.stopped,true);assert.equal(regularSummonCards(b).length,0);assert.equal(b.activateOperator(key),false);assert.deepEqual(b.errors,[]);
});

const strategy=[['char_151_myrtle',1,1,6,'DOWN'],['char_293_thorns',3,1,7,'DOWN'],['char_202_demkni',1,3,4,'LEFT'],['char_128_plosis',2,4,2,'RIGHT'],['char_180_amgoat',2,3,7,'LEFT'],['char_4133_logos',1,2,7,'DOWN'],['char_4064_mlynar',3,2,4,'DOWN'],['char_1020_reed2',3,2,5,'DOWN']];
for(const[seed,life,killed]of [[1,3,52],[71,2,51]])test(`unmodified 17-14 naturally finishes all 52 source enemies using legal player builds and commands, seed ${seed}`,()=>{
 const builds=strategy.map(([id,skill])=>({...defaultBuild(base.operators[id]),skillId:base.operators[id].skills[skill-1].id,skillRank:10}));
 const b=create(base,{operators:builds},{seed}),f=b.internalStageMechanics.closur,deployed=new Set(),slowed=new Set();b.setViewport('fullscreen-workspace');
 const t=deployRegularSummon(b,`summon:${ID}`,3,6,'RIGHT');assert.ok(t);
 let nativeStarts=0,leakSlows=0;b.on('ch17BagFeedingStart',()=>nativeStarts++);
 while(!b.finished&&b.time<650){
  for(const[id,,r,c,dir]of strategy)if(!b.bench[id].unit?.alive&&!b.placementError(id,r,c)){assert.ok(b.deployOperator(id,r,c,dir));deployed.add(id);}
  for(const id of Object.keys(b.bench))if(!b.bench[id].unit?.skill.active)b.activateOperator(id);
  if(!f.u.skill.active)b.activateOperator(f.entry.key);
  b.step();
  for(const e of b.enemies)if(e.buffs.some(x=>x.data?.nativeSlowDown)){slowed.add(e.defId);if(e.defId==='enemy_10211_murad')leakSlows++;}
 }
 assert.equal(b.reason,'cleared');assert.equal(b.life,life);assert.equal(b.killed,killed);assert.equal(b.total,52);assert.equal(b._pending.length,0);assert.equal(deployed.size,8);
 assert.ok(b.enemies.filter(e=>e.counted).every(e=>!e.alive||!e.deployed));
 assert.ok(b.time>300&&b.time<650);assert.ok(slowed.size>0);assert.equal(leakSlows,0);assert.ok(nativeStarts>0);assert.deepEqual(b.errors,[]);
});
