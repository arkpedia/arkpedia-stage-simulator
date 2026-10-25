// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import data from'../data/arkpedia-mvp.json' with{type:'json'};
import source from'../data/candidates/arkpedia-predefined-tutorial-source.json' with{type:'json'};
import{StandardBattle}from'../server/sim/arkpedia.js';import{defaultBuild}from'../shared/arkpedia/loadout.js';
import{installStage17_16Dialogs}from'../server/sim/content/arkpedia-stage-17-16-dialogs.js';
import{installStage17_16Cards}from'../server/sim/content/arkpedia-stage-17-16-cards.js';
import{installViyPredefined}from'../server/sim/content/arkpedia-viy-predefined.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),dialog=source.actions.filter(r=>r.action.actionType==='DIALOG').map(r=>r.action),story=source.actions.find(r=>r.action.actionType==='STORY').action;
function fixture(){const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=1;const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));return{b,d};}
function finish(c){const kinds=[];for(let n=0;n<20&&c.state();n++){const state=c.state();kinds.push(state.instruction.kind);assert.ok(c.complete(state.receipt));assert.equal(c.complete(state.receipt),false);}assert.equal(c.state(),null);return kinds;}
test('a scheduled hold suspends all remaining combat work and preserves other same-time callbacks',()=>{
 const{b}=fixture();b.getPlayer('arkpedia').dp=99;const u=b.deployOperator('char_122_beagle',2,4,'RIGHT');u.atkCd=1000;u.skill.setSpTotal(0);b.getPlayer('arkpedia').dp=5;
 const buff=b.addBuff(u,{key:'fixture:timer',duration:10}),p=b.addProjectile({source:u,from:u,to:{x:9,y:2},speed:1}),e=b.spawnEnemy('enemy_1007_slime',{pos:[5,8]});let hold,called=0;
 const before={sp:u.skill.spTotal,dp:b.dp,buff:buff.timeLeft,x:p.x,y:p.y,ex:e.x,ey:e.y};
 b.after(0,()=>{hold=b.acquireSimulationHold({});});b.after(0,()=>called++);b.step();assert.ok(hold.active);assert.ok(b.simulationHeld);
 for(let n=0;n<100;n++)b.step();assert.equal(b.tickCount,0);near(b.time,0);assert.equal(called,0);
 assert.deepEqual({sp:u.skill.spTotal,dp:b.dp,buff:buff.timeLeft,x:p.x,y:p.y,ex:e.x,ey:e.y},before);assert.equal(b.runToEnd(1),null);
 assert.ok(hold.release());b.step();assert.equal(called,1);near(b.time,b.dt);assert.ok(b.dp>before.dp);assert.ok(u.skill.spTotal>before.sp);assert.ok(buff.timeLeft<before.buff);assert.ok(p.x>before.x);assert.deepEqual(b.errors,[]);
});
test('holds have independent ownership, stale releases cannot resume another owner, and forced end clears receipts',()=>{
 const{b}=fixture(),owner={},first=b.acquireSimulationHold(owner),second=b.acquireSimulationHold(owner);
 assert.ok(first.release());assert.equal(first.release(),false);b.step();near(b.time,0);assert.ok(second.active);assert.ok(b.simulationHeld);
 b.forceEnd();assert.ok(b.finished);assert.equal(b.simulationHeld,false);assert.equal(second.active,false);assert.equal(second.release(),false);assert.throws(()=>b.acquireSimulationHold(owner),/boundary/);
});
test('late combat-phase acquisition fails before a partially completed tick can be replayed',()=>{
 const{b}=fixture();let tried=0;b.on('tick',()=>{tried++;assert.throws(()=>b.acquireSimulationHold({}),/boundary/);});b.step();assert.equal(tried,1);near(b.time,b.dt);assert.equal(b.simulationHeld,false);assert.deepEqual(b.errors,[]);
});
test('a recurring scheduler hold preserves its next due time and callbacks waiting at the same boundary',()=>{
 const{b}=fixture();let count=0,other=0,hold;const task=b.every(.1,()=>{count++;if(count===1)hold=b.acquireSimulationHold({});});b.after(.1,()=>other++);
 for(let n=0;n<4;n++)b.step();near(b.time,.1);assert.equal(count,1);assert.equal(other,0);near(task.due,.2);
 hold.release();b.step();assert.equal(other,1);for(let n=0;n<3;n++)b.step();assert.equal(count,2);assert.deepEqual(b.errors,[]);
});
test('a source dialog holds combat through camera, every line and camera reset, with receipt-owned completion',()=>{
 const{b}=fixture(),c=installStage17_16Dialogs(b),result=c.receive(dialog[0]);assert.equal(result.status,'pending');assert.equal(c.state().instruction.kind,'cameraFocus');assert.ok(b.simulationHeld);
 const first=c.state().receipt;assert.equal(c.complete({}),false);for(let n=0;n<100;n++)b.step();near(b.time,0);assert.equal(c.receive(dialog[0]).state.receipt,first);
 assert.deepEqual(finish(c),['cameraFocus','dialogue','dialogue','dialogue','cameraReset']);assert.equal(b.simulationHeld,false);assert.equal(c.receive(dialog[0]).status,'already-complete');b.step();near(b.time,b.dt);
});
test('dialogs cannot overlap, and one dialog cannot release an unrelated suspension',()=>{
 const{b}=fixture(),c=installStage17_16Dialogs(b),other=b.acquireSimulationHold({});c.receive(dialog[0]);assert.throws(()=>c.receive(dialog[1]),/pending/);assert.throws(()=>c.receive(story),/pending/);
 finish(c);assert.ok(b.simulationHeld);other.release();c.receive(dialog[1]);assert.deepEqual(finish(c),['cameraFocus','dialogue','dialogue','dialogue','cameraFocus','dialogue','dialogue','dialogue','cameraReset']);assert.equal(b.simulationHeld,false);
});
test('the STORY instruction modifies only preset Viy without opening a dialog or replaying its SP action',()=>{
 const{b}=fixture(),viy=installViyPredefined(b),c=installStage17_16Dialogs(b);const result=c.receive(story);assert.equal(result.operation.after,49);assert.equal(c.state(),null);assert.equal(b.simulationHeld,false);
 viy.unit.skill.setSpTotal(0);assert.equal(c.receive(story).status,'already-complete');near(viy.unit.skill.spTotal,0);
});
test('the exact fragment actions compose in game time while presentation completion remains outside combat ticks',()=>{
 const{b,d}=fixture(),viy=installViyPredefined(b),cards=installStage17_16Cards(b,d),c=installStage17_16Dialogs(b),events=[];
 for(const{action}of source.actions)b.after(action.preDelay,()=>{
  events.push([action.actionType,b.time]);if(action.actionType==='ACTIVATE_PREDEFINED')cards.receive(action);else c.receive(action);
 });
 let pauses=0;for(let n=0;n<600&&b.time<14;n++){
  b.step();if(c.state()){pauses++;const time=b.time;for(let j=0;j<20;j++)b.step();near(b.time,time);finish(c);}
 }
 assert.equal(pauses,2);assert.equal(events.length,7);for(let i=0;i<events.length;i++)near(events[i][1],source.actions[i].action.preDelay);
 assert.ok(cards.cards().every(r=>r.active));near(viy.unit.skill.spTotal,49);assert.ok(b.activateOperator(viy.key));assert.deepEqual(b.errors,[]);
});
test('stopped/ended dialog sessions reject stale completion and do not strand owned holds',()=>{
 for(const ending of ['stop','end']){const{b}=fixture(),c=installStage17_16Dialogs(b);c.receive(dialog[0]);const receipt=c.state().receipt;if(ending==='stop')c.stop();else b.forceEnd();assert.equal(c.complete(receipt),false);assert.equal(c.state(),null);assert.equal(b.simulationHeld,false);assert.equal(c.receive(dialog[1]).status,'cancelled');}
});
test('changed actions, source scripts, duplicate installation and late installation fail closed',()=>{
 const{b}=fixture(),c=installStage17_16Dialogs(b);assert.throws(()=>c.receive({...dialog[0],preDelay:0}),/Unreviewed/);assert.throws(()=>c.receive(source.actions.at(-1).action),/Unreviewed/);assert.throws(()=>installStage17_16Dialogs(b),/fresh/);
 const altered=structuredClone(source);altered.scripts[dialog[0].key].instructions.pop();assert.throws(()=>installStage17_16Dialogs(fixture().b,{source:altered}),/Unreviewed/);
 const late=fixture().b;late.time=1;assert.throws(()=>installStage17_16Dialogs(late),/fresh/);assert.equal(b.simulationHeld,false);
});
test('the admitted dialog source is detached from later caller edits',()=>{
 const{b}=fixture(),input=structuredClone(source),c=installStage17_16Dialogs(b,{source:input});input.scripts[dialog[0].key].instructions=[];input.actions[0].action.preDelay=0;
 c.receive(dialog[0]);assert.equal(finish(c).length,5);assert.equal(b.simulationHeld,false);
});
