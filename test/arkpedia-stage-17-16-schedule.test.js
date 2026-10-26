// SPDX-License-Identifier: GPL-3.0-or-later
// Source-field integration with controlled enemy retirement, not a native clear.
import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
import base from'../data/arkpedia-mvp.json' with{type:'json'};import source from'../data/candidates/arkpedia-stage-17-16-source.json' with{type:'json'};
import{StandardBattle,createStage17_16MechanicsBattle}from'../server/sim/arkpedia.js';import{defaultBuild}from'../shared/arkpedia/loadout.js';import{sourceBoundRoutePath}from'../shared/arkpedia/stage-path.js';
import{installViyPredefined}from'../server/sim/content/arkpedia-viy-predefined.js';import{installStage17_16Cards}from'../server/sim/content/arkpedia-stage-17-16-cards.js';import{installStage17_16Dialogs}from'../server/sim/content/arkpedia-stage-17-16-dialogs.js';
import{installStage17_16Schedule as install,stage17_16SchedulePlan as plan}from'../server/sim/content/arkpedia-stage-17-16-schedule.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function fixture({park=true,schedule=true}={}){
 if(schedule){
  const b=createStage17_16MechanicsBattle(base),{viy,cards,dialogs,schedule:scheduler}=b.internalStageMechanics;b.setViewport('fullscreen-workspace');
  b.addBuff(viy.unit,{key:'fixture:durability',mods:{hpFlat:1e6},persist:true});viy.unit.hp=viy.unit.s.maxHp;
  if(park)b.on('enemySpawn',({enemy:e})=>{e.base.moveSpeed=0;e.markDirty();});return{b,viy,cards,dialogs,scheduler};
 }
 const d=structuredClone(base),paths={};for(const[i,r]of source.geometry.routes.entries())if(source.geometry.waves.some(w=>w.spawns.some(s=>s.route===i)))paths[i]=sourceBoundRoutePath(r,source.rawLevel.routes);
 // Negative receiver-installation tests deliberately assemble receivers by
 // hand. Positive integration above uses the exact internal constructor.
 d.enemies={};d.stage={...structuredClone(source.stage),geometry:{...structuredClone(source.geometry),waves:[],suppliedUnits:{}},pathing:{paths,moveScale:.5},devices:[]};
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.setViewport('fullscreen-workspace');
 const viy=installViyPredefined(b);b.addBuff(viy.unit,{key:'fixture:durability',mods:{hpFlat:1e6},persist:true});viy.unit.hp=viy.unit.s.maxHp;
 const cards=installStage17_16Cards(b,d),dialogs=installStage17_16Dialogs(b);
 if(park)b.on('enemySpawn',({enemy:e})=>{e.base.moveSpeed=0;e.markDirty();});
 const scheduler=schedule?install(b,{dialogs,cards}):null;return{b,d,viy,cards,dialogs,scheduler};
}
function until(f,predicate,seconds=300){for(let n=0;n<Math.ceil(seconds/f.b.dt)&&!predicate()&&!f.b.finished;n++)f.b.step();assert.ok(predicate());}
function advance(f,seconds){const to=f.b.time+seconds;until(f,()=>f.b.time>=to-1e-8,seconds+1);}
function finishDialog(f){let n=0;while(f.dialogs.state()){assert.ok(++n<=20);const{receipt}=f.dialogs.state();assert.ok(f.dialogs.complete(receipt));assert.equal(f.dialogs.complete(receipt),false);}return n;}
function finishFirstWave(f){until(f,()=>f.scheduler.spawned().length===11,60);for(const r of f.scheduler.spawned())f.b.kill(r.unit,null);until(f,()=>f.scheduler.state().wave===1,1);}

test('schedule source reproduces the canonical routes, records and complete ordered action records',()=>{
 const p=plan();for(const pin of Object.values(p.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+pin.path,import.meta.url))).digest('hex'),pin.sha256);
 execFileSync(process.execPath,['tools/arkpedia/stage17-16-schedule-contract.mjs','--check'],{stdio:'pipe'});
 assert.deepEqual(p.waves.map(w=>w.actions.length),[11,10]);assert.deepEqual(p.waves.map(w=>w.duration),[58,13.3]);
 for(const[w,wave]of p.waves.entries())for(const r of wave.actions)assert.deepEqual(r.action,source.rawLevel.waves[w].fragments[r.fragment].actions[r.actionIndex]);
 const changed=plan();changed.waves[0].waitForManagedEnemies=false;assert.throws(()=>plan(changed),/Unreviewed/);changed.records.enemy_10210_muwiz_2.stats.maxHp=1;assert.equal(plan().records.enemy_10210_muwiz_2.stats.maxHp,20000);
});
test('the second wave cannot start at flattened 58 seconds while a managed first-wave enemy remains',()=>{
 const f=fixture();assert.equal(f.b.total,14);assert.equal(f.scheduler.state().pendingSpawns,14);advance(f,90);
 assert.equal(f.scheduler.spawned().length,11);assert.equal(f.scheduler.state().wave,0);assert.ok(f.cards.cards().every(r=>!r.active));assert.equal(f.dialogs.state(),null);
 const born=f.scheduler.spawned();for(const r of born.slice(1))f.b.kill(r.unit,null);advance(f,5);assert.equal(f.scheduler.state().wave,0);
 const at=f.b.time;f.b.kill(born[0].unit,null);until(f,()=>f.scheduler.state().wave===1,1);near(f.scheduler.state().waveStartedAt,at);assert.equal(f.b.finished,false);assert.equal(f.b.total,14);assert.deepEqual(f.b.errors,[]);
});
test('both source waves compose real enemies, owned dialogs, Viy SP and four cards on canonical terrain',()=>{
 const f=fixture();finishFirstWave(f);const boundary=f.scheduler.state().waveStartedAt;until(f,()=>!!f.dialogs.state(),4);near(f.b.time-boundary,3);
 const paused=f.b.time;for(let n=0;n<100;n++)f.b.step();near(f.b.time,paused);assert.equal(f.scheduler.spawned().length,11);assert.equal(finishDialog(f),5);
 until(f,()=>f.scheduler.spawned().length===14,7);const casters=f.scheduler.spawned().slice(11);assert.deepEqual(casters.map(r=>r.unit.defId),Array(3).fill('enemy_10210_muwiz_2'));
 for(const[r,offset]of casters.map((r,i)=>[r,[6,9,9][i]]))near(r.time-boundary,offset);assert.ok(casters.every(r=>r.unit.mem.ab?.list?.length===1));
 until(f,()=>!!f.dialogs.state(),4);near(f.b.time-boundary,12);assert.equal(finishDialog(f),9);f.viy.unit.skill.setSpTotal(0);
 until(f,()=>f.cards.cards().every(r=>r.active),2);near(f.viy.unit.skill.spTotal,49);assert.ok(f.b.activateOperator(f.viy.key));
 const history=f.scheduler.state().history;assert.deepEqual(history.filter(r=>!r.kind.startsWith('wave-')).map(r=>r.kind),['DIALOG','DIALOG','STORY',...Array(4).fill('ACTIVATE_PREDEFINED')]);
 for(const r of history.filter(r=>r.offset!==undefined))near(r.time-boundary,r.offset);
 for(const r of casters)f.b.kill(r.unit,null);until(f,()=>f.b.finished,1);assert.equal(f.scheduler.state().reason,'complete');assert.equal(f.b.reason,'cleared');assert.equal(f.b.total,14);assert.equal(f.b.killed,14);assert.deepEqual(f.b.errors,[]);
});
test('the first source route walks into its retained three-second wait without modified enemy speed',()=>{
 const f=fixture({park:false});f.viy.unit.profile.noAttack=true;until(f,()=>f.scheduler.spawned()[0]?.unit.route.waitLeft!==null&&!!f.scheduler.spawned()[0],8);
 const e=f.scheduler.spawned()[0].unit;near(e.y,5);near(e.x,10);assert.ok(e.route.waitLeft>2.9);assert.deepEqual(f.b.errors,[]);f.scheduler.stop();
});
test('stopping during a dialog releases suspension and cancels unborn work without reporting a clear',()=>{
 const f=fixture();finishFirstWave(f);until(f,()=>!!f.dialogs.state(),4);const receipt=f.dialogs.state().receipt;f.scheduler.stop();
 assert.equal(f.b.simulationHeld,false);assert.equal(f.dialogs.complete(receipt),false);assert.equal(f.scheduler.state().active,false);assert.equal(f.scheduler.state().reason,'cancelled');assert.equal(f.b.reason,'forced');assert.equal(f.scheduler.state().pendingSpawns,0);assert.ok(f.cards.cards().every(r=>!r.active));assert.deepEqual(f.b.errors,[]);
});
test('foreign, stopped, late and duplicate receivers and changed layout or source cannot admit a schedule',()=>{
 const f=fixture({schedule:false}),other=fixture({schedule:false});assert.throws(()=>install(f.b),/fresh/);assert.throws(()=>install(f.b,{dialogs:other.dialogs,cards:f.cards}),/fresh/);
 const changed=plan();changed.waves[1].actions[0].time=0;assert.throws(()=>install(f.b,{dialogs:f.dialogs,cards:f.cards,source:changed}),/Unreviewed/);assert.equal(f.b.total,0);
 f.b.flags.moveScale=1;assert.throws(()=>install(f.b,{dialogs:f.dialogs,cards:f.cards}),/layout/);f.b.flags.moveScale=.5;
 const scheduler=install(f.b,{dialogs:f.dialogs,cards:f.cards});assert.throws(()=>install(f.b,{dialogs:f.dialogs,cards:f.cards}),/fresh/);scheduler.stop();
 other.dialogs.stop();assert.throws(()=>install(other.b,{dialogs:other.dialogs,cards:other.cards}),/fresh/);assert.equal(other.b.total,0);
 const late=fixture({schedule:false});late.b.time=1;assert.throws(()=>install(late.b,{dialogs:late.dialogs,cards:late.cards}),/fresh/);
});
test('deployment replacement at source spawn aborts instead of adopting another enemy life as wave ownership',()=>{
 const f=fixture();f.b.on('enemySpawn',({enemy})=>enemy.deploySeq++);until(f,()=>f.b.finished,5);assert.equal(f.b.reason,'forced');assert.equal(f.scheduler.state().reason,'error');assert.ok(f.b.errors.some(e=>JSON.stringify(e).includes('deployment was replaced')));assert.equal(f.scheduler.state().active,false);
});
test('an override injected by a spawn hook cannot change the next same-time source body or turn an error into a clear',()=>{
 const f=fixture();let infiltrators=0;f.b.on('enemySpawn',({enemy})=>{if(enemy.defId==='enemy_10120_uaghst'&&++infiltrators===3)f.b.enemyOverrides.enemy_10120_uaghst={stats:{maxHp:1}};});
 until(f,()=>f.b.finished,31);assert.equal(f.b.reason,'forced');assert.equal(f.scheduler.state().reason,'error');assert.equal(infiltrators,3);assert.ok(f.b.errors.some(e=>JSON.stringify(e).includes('reserved enemy override')));assert.equal(f.scheduler.state().active,false);
});
