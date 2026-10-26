// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import base from'../data/arkpedia-mvp.json' with{type:'json'};import tutorial from'../data/candidates/arkpedia-predefined-tutorial-source.json' with{type:'json'};
import{StandardBattle,createStage17_16MechanicsBattle as create}from'../server/sim/arkpedia.js';
import{defaultBuild,recordFor,catalogueFor}from'../shared/arkpedia/loadout.js';
import{battleSkillLevel,skillDescriptionText}from'../shared/arkpedia/battle-ui.js';
import{installClosurPredefined,CLOSUR_PREDEFINED_CONTRACT,CLOSUR_PREDEFINED_KEY}from'../server/sim/content/arkpedia-closur-predefined.js';
import{regularSummonCards,selectedRegularSummon,regularSummonOwnerEntry,deployRegularSummon,retreatRegularSummon,summonPlacementError}from'../server/sim/content/arkpedia-summons.js';
import{summonUnitId}from'../shared/arkpedia/summons.js';
import{skillSourceFor}from'../shared/arkpedia/skill-hud.js';
const ids=['char_473_mberry','char_128_plosis','char_4023_rfalcn','char_488_buildr'];

function closurField(){
 const d=structuredClone(base);d.stage.geometry.waves[0].spawns=[];
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const f=installClosurPredefined(b,{contract:CLOSUR_PREDEFINED_CONTRACT});return{b,f};
}

test('a preset command-center card and token inspect their actual owner without a player Closure card',()=>{
 const{b,f}=closurField(),card=regularSummonCards(b).find(c=>c.owner===f.u),entry=regularSummonOwnerEntry(b,card);
 assert.equal(entry.unit,f.u);assert.equal(entry.id,CLOSUR_PREDEFINED_KEY);assert.equal(entry.build.moduleLevel,3);assert.equal(b.bench.char_4228_closur,undefined);
 const dp=b.dp,slots=b.deployedSlots(),token=deployRegularSummon(b,card.key,3,4),state=selectedRegularSummon(b,summonUnitId(token));
 assert.equal(regularSummonOwnerEntry(b,state).record,f.u.def.raw);assert.equal(regularSummonOwnerEntry(b,state).unit,f.u);
 assert.equal(b.dp,dp);assert.equal(b.deployedSlots(),slots);assert.equal(skillSourceFor(token),token);assert.equal(token.skill.noSkill,true);assert.deepEqual(b.errors,[]);
 assert.equal(state.deck.canRetreat(token),false);for(let n=0;n<180&&!state.deck.canRetreat(token);n++)b.step();assert.equal(state.deck.canRetreat(token),true);
 retreatRegularSummon(b,summonUnitId(token));assert.equal(state.deck.canRetreat(token),false);assert.equal(token.mem.closurPoint.mode,'recharge');assert.equal(token.alive,true);assert.equal(regularSummonOwnerEntry(b,state).unit,f.u);
});

test('ordinary summoner cards and an owned Mon3tr still resolve their actual bench build and delegated skill owner',()=>{
 const d=structuredClone(base),id='char_003_kalts';d.stage.geometry.waves[0].spawns=[];const b=new StandardBattle(d,{operators:[defaultBuild(d.operators[id])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const tileFor=check=>{for(let r=b.rect.r0;r<=b.rect.r1;r++)for(let c=b.rect.c0;c<=b.rect.c1;c++)if(!check(r,c))return[r,c];throw Error('Missing legal test tile');};
 const owner=b.deployOperator(id,...tileFor((r,c)=>b.placementError(id,r,c)),'RIGHT'),card=regularSummonCards(b).find(c=>c.owner===owner);assert.ok(card);
 assert.equal(regularSummonOwnerEntry(b,card).build,b.bench[id].build);const token=deployRegularSummon(b,card.key,...tileFor((r,c)=>summonPlacementError(b,card.key,r,c))),state=selectedRegularSummon(b,summonUnitId(token));
 assert.equal(regularSummonOwnerEntry(b,state).unit,owner);assert.equal(skillSourceFor(token),owner);assert.deepEqual(b.errors,[]);
});

for(const stale of ['map','life','skill','def','foreign','owner','token'])test('summon owner inspection rejects stale/foreign preset ownership: '+stale,()=>{
 const{b,f}=closurField(),card=regularSummonCards(b).find(c=>c.owner===f.u),token=deployRegularSummon(b,card.key,3,4),state=selectedRegularSummon(b,summonUnitId(token));
 if(stale==='map')b.predefinedOperators.set(CLOSUR_PREDEFINED_KEY,{...f.entry});
 else if(stale==='life')f.u.deploySeq++;
 else if(stale==='skill')f.u.skill={...f.u.skill};
 else if(stale==='def')f.u.def={...f.u.def};
 else if(stale==='foreign'){const other=closurField();state.owner=other.f.u;}
 else if(stale==='owner')token.ownerUnit={...f.u};
 else token.mem.regularSummonCard='summon:foreign';
 assert.equal(regularSummonOwnerEntry(b,state),null);assert.deepEqual(b.errors,[]);
});
test('the source preset exposes its own authenticated field control without creating a player card',()=>{
 const b=create(base),m=b.internalStageMechanics;b.setViewport('fullscreen-workspace');const e=b.operatorEntry(m.viy.key);
 assert.ok(Object.isFrozen(e));assert.equal(e.unit,m.viy.unit);assert.equal(e.operatorId,'char_4226_veen');assert.equal(e.predefined,true);assert.equal(e.withdrawable,false);assert.equal(e.record,e.unit.def.raw);assert.equal(b.operatorControlId(e.unit),m.viy.key);
 assert.equal(b.operatorEntry(e.operatorId),null);assert.equal(b.operatorEntry(ids[0]),null);assert.deepEqual(Object.keys(b.bench),[]);m.viy.unit.skill.setSpTotal(49);
 assert.equal(b.activateOperator(e.operatorId),false);const hold=b.acquireSimulationHold({});assert.equal(b.operatorEntry(m.viy.key).unit,e.unit);assert.equal(b.activateOperator(m.viy.key),false);hold.release();assert.ok(b.activateOperator(m.viy.key));assert.deepEqual(b.errors,[]);
});
for(const mode of ['entry','body','skill','definition','death','end'])test('preset control refuses stale '+mode+' identity instead of adopting a matching alias',()=>{
 const b=create(base),m=b.internalStageMechanics,u=m.viy.unit;u.skill.setSpTotal(49);b.setViewport('fullscreen-workspace');
 if(mode==='entry')b.predefinedOperators.set(m.viy.key,{...m.viy});else if(mode==='body'){u.deploySeq++;m.viy.life=u.deploySeq;}else if(mode==='skill')u.skill={};else if(mode==='definition')u.def={...u.def};else if(mode==='death')b.kill(u,null);else b.forceEnd();
 assert.equal(b.operatorEntry(m.viy.key),null);assert.equal(b.operatorControlId(u),null);assert.equal(b.activateOperator(m.viy.key),false);
});
test('foreign preset entries and unregistered map entries cannot mint an operator control',()=>{
 const b=create(base),other=create(base),m=b.internalStageMechanics;b.setViewport('fullscreen-workspace');b.predefinedOperators.set(m.viy.key,other.internalStageMechanics.viy);b.predefinedOperators.set('predefined:forged',{...m.viy});
 assert.equal(b.operatorEntry(m.viy.key),null);assert.equal(b.operatorControlId(other.internalStageMechanics.viy.unit),null);assert.equal(b.activateOperator('predefined:forged'),false);
});
test('delivered cards inspect their exact module records without invoking public module selection or spending DP',()=>{
 const b=create(base),m=b.internalStageMechanics,dp=b.dp;
 for(const{action}of tutorial.actions)if(action.actionType==='ACTIVATE_PREDEFINED')m.cards.receive(action);
 const stats=[[1597,458,99],[1710,437,150],[2140,594,382],[2475,475,447]];
 for(const[i,id]of ids.entries()){
  const e=b.operatorEntry(id);assert.equal(e.unit,null);assert.equal(e.withdrawable,true);assert.equal(e.predefined,false);assert.equal(e.build.moduleLevel,3);assert.equal(e.record,b.data.rawChess(id));assert.deepEqual([e.record.stats.maxHp,e.record.stats.atk,e.record.stats.def],stats[i]);
  assert.throws(()=>recordFor(e.build,base),/module/i);assert.deepEqual(catalogueFor(base)[id].modules,[]);const fallback=base.operators[id].skills.find(s=>s.id===e.build.skillId).levels[e.build.skillRank-1],level=battleSkillLevel(e.record,fallback);
  assert.equal(level.spData.spCost,e.record.skill.spCost);assert.equal(level.skillId,e.build.skillId);assert.ok(skillDescriptionText(level));
 }
 assert.equal(b.dp,dp);assert.equal(b.deployedSlots(),1);b.setViewport('fullscreen-workspace');const u=b.deployOperator(ids[2],5,4,'RIGHT');assert.equal(b.operatorControlId(u),ids[2]);assert.equal(b.operatorEntry(ids[2]).unit,u);assert.deepEqual(b.errors,[]);
});
test('ordinary cards retain their selected record, live body and withdrawal behavior',()=>{
 const d=structuredClone(base);d.stage.geometry.waves[0].spawns=[];const id='char_122_beagle',b=new StandardBattle(d,{operators:[defaultBuild(d.operators[id])]});b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 assert.equal(b.operatorEntry(id).record,b.data.rawChess(id));assert.equal(b.operatorEntry(id).unit,null);let tile;for(let row=b.rect.r0;row<=b.rect.r1&&!tile;row++)for(let col=b.rect.c0;col<=b.rect.c1;col++)if(!b.placementError(id,row,col)){tile=[row,col];break;}assert.ok(tile);const u=b.deployOperator(id,...tile,'RIGHT');assert.equal(b.operatorControlId(u),id);assert.equal(b.operatorEntry(id).withdrawable,true);b.retreatOperator(id);assert.equal(b.operatorEntry(id).unit,null);assert.equal(b.operatorControlId(u),null);assert.deepEqual(b.errors,[]);
});
test('the exact Closure instance uses the same source-owned inspection and stale-entry rules',()=>{
 const d=structuredClone(base);d.stage.geometry.waves[0].spawns=[];const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const f=installClosurPredefined(b,{contract:CLOSUR_PREDEFINED_CONTRACT}),e=b.operatorEntry(CLOSUR_PREDEFINED_KEY);assert.equal(e.unit,f.u);assert.equal(e.build.moduleLevel,3);assert.equal(e.record,f.u.def.raw);assert.equal(e.withdrawable,false);assert.equal(b.operatorControlId(f.u),CLOSUR_PREDEFINED_KEY);
 b.predefinedOperators.set(CLOSUR_PREDEFINED_KEY,{...f.entry});assert.equal(b.operatorEntry(CLOSUR_PREDEFINED_KEY),null);assert.equal(b.operatorControlId(f.u),null);assert.deepEqual(b.errors,[]);
});
test('skill inspection retains source text and selected blackboards/SP while never inventing a missing skill',()=>{
 const record={skill:{skillId:'selected',name:'Selected',description:'Source {atk_scale:0%}',spCost:49,initSp:20,spType:'INCREASE_WITH_TIME',bb:{atk_scale:6}}},fallback={name:'Wrong',description:'Fallback',spData:{spCost:999},blackboard:[{key:'atk_scale',value:1}]};
 const level=battleSkillLevel(record,fallback);assert.equal(level.spData.spCost,49);assert.equal(level.spData.initSp,20);assert.equal(skillDescriptionText(level),'Source 600%');assert.equal(battleSkillLevel({skill:null},fallback),null);level.spData.spCost=1;assert.equal(record.skill.spCost,49);assert.equal(fallback.spData.spCost,999);
});
