// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';import data from'../data/arkpedia-mvp.json'with{type:'json'};
import{StandardBattle}from'../server/sim/arkpedia.js';import{SkillRuntime}from'../server/sim/skills.js';import{defaultBuild}from'../shared/arkpedia/loadout.js';
function make(authorize=()=>true){const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_208_melan)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;const u=b.deployOperator('char_208_melan',3,1,'RIGHT');
 const calls=[],events=[],sk=new SkillRuntime(b,u,u.def.skill,{kind:'instant',trigger:'NEVER',acceptSourceCastStart:authorize,onStart:()=>calls.push('start'),onEnd:()=>calls.push('end')});u.skill=sk;sk.reset();
 b.on('skillStart',c=>events.push(['start',c.activation,c.reason]));b.on('skillEnd',c=>events.push(['end',c.activation,c.reason]));return{b,u,sk,calls,events};}
test('One accepted original CastStart instruction emits only its numbered receipt without currency or ordinary callbacks',()=>{
 const{b,sk,calls,events}=make(),ticket={};sk.setSpTotal(3);
 const before=[sk.sp,sk.charges,sk.active,sk.pending,sk.lastStart,sk.opReadyAt];assert.equal(sk.notifySourceCastStart(ticket,'native'),true);
 assert.deepEqual([sk.sp,sk.charges,sk.active,sk.pending,sk.lastStart,sk.opReadyAt],before);assert.equal(sk.activations,1);
 assert.deepEqual(calls,[]);assert.deepEqual(events,[['start',1,'native']]);assert.equal(sk.notifySourceCastStart(ticket,'native'),false);assert.equal(sk.activations,1);assert.deepEqual(b.errors,[]);
});
test('A later ordinary activation retains its normal start/end and next source number',()=>{
 const{b,sk,events,calls}=make();sk.notifySourceCastStart({});sk.notifySourceCastStart({});sk.setSpTotal(sk.spCost);assert.equal(sk.activate('manual'),true);
 assert.equal(sk.activations,3);assert.deepEqual(events,[['start',1,'source'],['start',2,'source'],['start',3,'manual'],['end',3,'instant']]);assert.deepEqual(calls,['start','end']);assert.deepEqual(b.errors,[]);
});
for(const result of[undefined,false,1,'true',{}])test(`Owner result ${String(result)} cannot authorize a native receipt`,()=>{const{sk}=make(()=>result);assert.equal(sk.notifySourceCastStart({}),false);assert.equal(sk.activations,0);});
test('No callback opt-in, timed accounts and nonobject tickets do not emit source events',()=>{
 const{sk}=make();for(const t of[undefined,null,1,'x',()=>{}])assert.equal(sk.notifySourceCastStart(t),false);
 sk.spec.acceptSourceCastStart=null;assert.equal(sk.notifySourceCastStart({}),false);sk.spec.acceptSourceCastStart=()=>true;sk.kind='duration';assert.equal(sk.notifySourceCastStart({}),false);assert.equal(sk.activations,0);
});
for(const how of['life','account','spec','kind','removed','hidden','death','battleEnd'])test(`Owner callback ${how} cannot donate a source receipt to another life/account`,()=>{
 let f;f=make(()=>{if(how==='life')f.u.deploySeq++;if(how==='account')f.u.skill={};if(how==='spec')f.sk.spec={};if(how==='kind')f.sk.kind='duration';if(how==='removed')f.u.removed=true;if(how==='hidden')f.u.hidden=true;if(how==='death')f.u.alive=false;if(how==='battleEnd')f.b.finished=true;return true;});
 assert.equal(f.sk.notifySourceCastStart({}),false);assert.equal(f.sk.activations,0);assert.deepEqual(f.events,[]);
});
test('Recursive owner/receipt callbacks cannot duplicate either their claimed instruction or another instruction',()=>{
 let f;const ticket={};f=make(()=>{assert.equal(f.sk.notifySourceCastStart(ticket),false);assert.equal(f.sk.notifySourceCastStart({}),false);return true;});
 f.b.on('skillStart',()=>assert.equal(f.sk.notifySourceCastStart({}),false));assert.equal(f.sk.notifySourceCastStart(ticket),true);assert.equal(f.sk.activations,1);assert.deepEqual(f.b.errors,[]);
});
test('A source-start listener making a normal activation cannot relabel the outer receipt',()=>{
 const f=make();let once=false;f.b.on('skillStart',()=>{if(once)return;once=true;f.sk.setSpTotal(f.sk.spCost);f.sk.activate('manual');});
 assert.equal(f.sk.notifySourceCastStart({}),true);assert.deepEqual(f.events.map(e=>e.slice(0,2)),[['start',1],['start',2],['end',2]]);assert.equal(f.sk.activations,2);assert.deepEqual(f.b.errors,[]);
});
test('Throwing authorization leaves no receipt or consumed ticket and clears the reentrant guard',()=>{
 const f=make(()=>{throw Error('source authorization');}),ticket={};assert.throws(()=>f.sk.notifySourceCastStart(ticket),/source authorization/);assert.equal(f.sk.activations,0);
 f.sk.spec.acceptSourceCastStart=()=>true;assert.equal(f.sk.notifySourceCastStart(ticket),true);assert.equal(f.sk.activations,1);
});
test('A native start during an active ordinary cast cannot relabel that cast finish or leave its mods behind',()=>{
 const f=make();f.sk.spec.attack={};f.sk.spec.completeOnAttack=false;f.sk.spec.mods={atkPct:1};f.sk.setSpTotal(f.sk.spCost);
 assert.equal(f.sk.activate('manual'),true);assert.equal(f.sk.active,true);assert.equal(f.sk.notifySourceCastStart({}),true);assert.equal(f.sk.activations,2);
 f.sk.end('ordinary-finish');assert.deepEqual(f.events,[['start',1,'manual'],['start',2,'source'],['end',1,'ordinary-finish']]);assert.equal(f.u.buffs.some(b=>b.key===f.sk._buffKey),false);
});
