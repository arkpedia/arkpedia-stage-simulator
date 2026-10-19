// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,addOwner,enemy,ally,near,advance,until} from './helpers/yukari-fixture.js';
import data from '../data/arkpedia-mvp.json' with{type:'json'};import {StandardBattle} from '../server/sim/arkpedia.js';import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {prepareYukariS1,YUKARI_S1_CONTRACT,verifyYukariS1} from '../server/sim/content/arkpedia-yukari-s1.js';
import {yukariNativeInputs,yukariSourceComponent} from '../server/sim/content/arkpedia-yukari-source.js';
const fs=[],make=opts=>{const f=fixture({prepare:(b,u)=>prepareYukariS1(b,u,{contract:YUKARI_S1_CONTRACT}),...opts});fs.push(f);return f;};test.afterEach(()=>{for(const f of fs.splice(0))assert.deepEqual(f.b.errors,[]);});
const cast=f=>{f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('fixture'),true);};
const hits=f=>f.hits.filter(h=>h.dmg.tags.some(t=>t.startsWith('yukari:s1-'))),ordinary=f=>f.hits.filter(h=>h.dmg.tags.includes('yukari:ordinary'));
test('S1 composition requires its selected original account and exact fresh contract',()=>{
 verifyYukariS1();assert.throws(()=>make({prepare:(b,u)=>prepareYukariS1(b,u,{contract:{...YUKARI_S1_CONTRACT}})}),/exact controller/);assert.throws(()=>make({skill:2}),/selected Yukari S1/);
 const f=make();assert.throws(()=>prepareYukariS1(f.b,f.u,{contract:YUKARI_S1_CONTRACT}),/Fresh selected/);assert.throws(()=>f.controller.install(),/reinstalled/);
});
for(const what of['sp','trigger','born','refund','cooldown','finish','silence','time','slowdown','marker','reselection','count','oneTarget','selector','motion'])test(`Changed ${what} cannot retain S1 composition approval`,()=>{
 const n=structuredClone(yukariNativeInputs()),read=(...args)=>{const v=structuredClone(yukariSourceComponent(...args));if(args[2]==='6907655210490132085'){if(what==='selector')v._postFilter=14;if(what==='motion')v._targetMotion=2;}return v;};
 if(what==='sp')n.s1._allowSpRecoveryWhenAffecting=1;if(what==='trigger')n.s1._useTriggerInManualMode=0;if(what==='born')n.s1._canCastDuringBorn=0;if(what==='refund')n.s1._recoverSpIfNoTarget=1;
 if(what==='cooldown')n.s1._resetAbilityCooldownWhenCastEnd=1;if(what==='finish')n.s1._earlySkillFinishAtAttackFinished=1;if(what==='silence')n.s1._canSilenced=1;if(what==='time')n.s1Attack._timeMode=0;
 if(what==='slowdown')n.s1Attack._affectedBySlowDown=0;if(what==='marker')n.s1Attack._waitForAttackEvent=0;if(what==='reselection')n.s1Attack._selectTargetTiming=0;if(what==='count')n.s1Attack._additionalTimes=4;if(what==='oneTarget')n.s1Attack._limitToOneTargetAfterFirstRound=1;
 assert.throws(()=>verifyYukariS1(n,read),/Changed original/);
});
for(let rank=1;rank<=10;rank++)test(`Rank${rank} spends one manual charge for four original releases, one attack receipt and one finish-heal batch`,()=>{
 const f=make({rank}),t=enemy(f),a=ally(f),atk=f.u.s.atk;f.u.hp=100;cast(f);const start=f.b.time;assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1');assert.equal(f.u.skill.pending,true);assert.equal(f.u.skill.holdsSp,true);
 const born=[];for(let i=0;i<4;i++){until(f,()=>f.controller.phase?.next===i+1);born.push(f.b.time-start);assert.equal(f.heals.length,0);assert.equal(f.receipts.length,1);near(f.u.skill.spTotal,0);}
 for(const[timing,expected]of born.map((t,i)=>[t,[1.5333333015441895,1.8333333730697632,2.133333444595337,3.366666555404663][i]]))near(timing,expected,.04);
 until(f,()=>!f.u.skill.active);near(f.b.time-start,4.066666603088379,.04);assert.equal(f.u.skill.activations,1);assert.equal(f.receipts.length,1);assert.equal(hits(f).length,4);near(t.s.maxHp-t.hp,atk*(f.record.bb.multi_atk_scale*3+f.record.bb.final_atk_scale));
 assert.equal(f.heals.length,2);assert.ok(a.hp>1000);assert.equal(ordinary(f).length,0);assert.equal(f.u.skill.holdsSp,false);advance(f.b,.2);assert.ok(f.u.skill.spTotal>0);
});
for(const[dir,row,col]of[['RIGHT',5,7],['LEFT',5,3],['UP',7,5],['DOWN',3,5]])test(`${dir} retains the literal source Skill_1 and its own facing clocks`,()=>{
 const f=make({dir});enemy(f,{row,col});cast(f);assert.equal(f.u.mem.regularVisualDirection,dir);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1');until(f,()=>!f.u.skill.active);assert.equal(hits(f).length,4);assert.equal(f.controller.model().exactDurations.Skill_1,4.066666603088379);
});
test('Ready empty-range S1 remains manual and does not spend a charge or fabricate a cast',()=>{
 const f=make();f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate(),false);advance(f.b,8);assert.equal(f.u.skill.ready,true);assert.equal(f.u.skill.activations,0);enemy(f);advance(f.b,4);assert.equal(f.u.skill.activations,0);assert.ok(ordinary(f).length>0);
});
test('Selected E0 has no finish-heal parent; lower promotions preserve their own source account',()=>{
 for(const elite of[0,1]){const f=make({elite}),t=enemy(f);f.u.hp=100;ally(f);near(f.u.skill.spCost,f.record.source.spData.spCost);cast(f);until(f,()=>!f.u.skill.active);assert.equal(hits(f).length,4);assert.equal(f.heals.length,elite===0?0:2);assert.ok(t.hp<t.s.maxHp);}
});
for(const aspd of[-50,400])test(`ASPD${aspd} does not retime the source fixed S1 animation`,()=>{
 const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd}});cast(f);near(f.u.mem.regularFormVisual.speed,1);until(f,()=>f.receipts.length===1);near(f.receipts[0].time,1.5333333015441895,.04);until(f,()=>!f.u.skill.active);near(f.b.time,4.066666603088379,.04);
});
test('Live slowdown applies once to the source sequence and can freeze/resume without duplicate releases',()=>{
 const f=make();enemy(f);cast(f);advance(f.b,.6);f.b.addBuff(f.u,{key:'fixture:slow',mods:{slowDownMul:.5}});advance(f.b,.4);near(f.u.mem.regularFormVisual.speed,.5);assert.equal(f.receipts.length,0);const p=f.controller.phase;
 f.b.addBuff(f.u,{key:'fixture:zero',mods:{slowDownMul:0}});const age=p.age;advance(f.b,2);near(p.age,age);near(f.u.mem.regularFormVisual.speed,0);assert.equal(f.u.skill.active,true);near(f.u.skill.spTotal,0);
 f.b.removeBuff(f.u,'fixture:zero');until(f,()=>!f.u.skill.active);assert.equal(hits(f).length,4);assert.equal(f.receipts.length,1);near(f.b.time,.6+(4.066666603088379-.6)/.5+2,.08);
});
test('Marker reselection uses the current legal normal-priority target rather than pinning all arrows to the first round',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});cast(f);until(f,()=>hits(f).length===1);f.b.addBuff(a,{key:'fixture:hidden',flags:{stealth:true}});until(f,()=>!f.u.skill.active);
 assert.equal(hits(f).filter(h=>h.target===a).length,1);assert.equal(hits(f).filter(h=>h.target===other).length,3);assert.equal(f.receipts.length,1);
});
test('With no legal replacement, later markers keep the last input point and cannot home to a replacement life',()=>{
 const f=make(),a=enemy(f),later=enemy(f,{col:12});cast(f);until(f,()=>hits(f).length===1);a.deploySeq++;a.x=15;a.y=15;f.b._buildEnemyIndex();until(f,()=>!f.u.skill.active);assert.equal(hits(f).length,1);near(later.hp,later.s.maxHp);assert.equal(f.receipts.length,1);assert.equal(f.heals.length,1);
});
test('Losing the input during accepted start spends the charge without refund, then runs the living finish-heal talent',()=>{
 const f=make(),a=enemy(f);f.u.hp=100;f.b.on('beforeBuff',c=>{if(c.buff.tags?.includes('skill'))f.b.kill(a,null);});cast(f);assert.equal(f.u.skill.active,false);assert.equal(f.u.skill.charges,0);assert.equal(f.u.skill.activations,1);assert.equal(f.receipts.length,0);assert.equal(f.heals.length,1);
});
for(const flag of['stun','freeze','sleep','levitate','hidden'])test(`A brief ${flag} invalidates unborn markers even after the control has ended`,()=>{
 const f=make();enemy(f);cast(f);advance(f.b,.5);if(flag==='hidden'){f.u.hidden=true;advance(f.b,.04);f.u.hidden=false;}else{f.b.applyStatus(f.u,flag,{duration:.01});advance(f.b,.04);}
 assert.equal(f.u.skill.active,false);assert.equal(f.u.skill.charges,0);assert.equal(hits(f).length,0);assert.equal(f.controller.phase?.kind==='s1',false);assert.equal(f.heals.length,1);
});
test('Ordinary-only disarm and Silence do not cancel the nonsilenceable source S1 ability',()=>{
 const f=make();enemy(f);f.b.applyStatus(f.u,'disarm',{duration:20});f.b.applyStatus(f.u,'silence',{duration:20});cast(f);until(f,()=>!f.u.skill.active);assert.equal(hits(f).length,4);assert.equal(f.receipts.length,1);advance(f.b,1);assert.equal(ordinary(f).length,0);
});
test('An actual palsy trigger interrupts, while merely holding a palsy stack does not invent its native generator',()=>{
 const f=make();enemy(f);cast(f);f.b.applyStatus(f.u,'palsy',{duration:10,value:1});advance(f.b,.5);assert.equal(f.u.skill.active,true);f.b.emit('palsyTriggered',{unit:f.u});assert.equal(f.u.skill.active,false);assert.equal(hits(f).length,0);assert.equal(f.heals.length,1);
});
test('An interrupted multi-event account leaves already born arrows alive and heals once at source finish',()=>{
 const f=make();enemy(f,{col:8});cast(f);until(f,()=>f.controller.phase.next===2);f.b.applyStatus(f.u,'stun',{duration:10});advance(f.b,.04);assert.equal(f.u.skill.active,false);until(f,()=>hits(f).length===2);advance(f.b,3);assert.equal(hits(f).length,2);assert.equal(f.heals.length,1);assert.equal(f.receipts.length,1);
});
test('Manual S1 replaces an ordinary windup, preserves positive cooldown and later returns through a fresh opening',()=>{
 const f=make();enemy(f);until(f,()=>!!f.controller.phase);const cd=f.u.atkCd;cast(f);near(f.u.atkCd,cd);assert.equal(f.controller.phase.kind,'s1');until(f,()=>!f.u.skill.active);assert.equal(ordinary(f).length,0);until(f,()=>f.controller.phase?.beginAge>0);until(f,()=>ordinary(f).length===1);assert.equal(f.u.mem.regularFormVisual.clip,'Attack_Loop');
});
for(const mode of['veto','substitute','recursive','replacement'])test(`${mode} at the first beforeAttack boundary cannot multiply or substitute source releases`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});f.b.on('beforeAttack',c=>{if(c.attacker!==f.u||f.controller.phase?.kind!=='s1')return;if(mode==='veto')c.targets=[];if(mode==='substitute')c.targets=[other];if(mode==='recursive')f.b.forceAttack(f.u,[a]);if(mode==='replacement'){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'replacement'};}});cast(f);advance(f.b,4.2);
 assert.equal(f.receipts.filter(r=>r.isSkill).length,mode==='recursive'?1:0);assert.equal(hits(f).length,mode==='recursive'?5:0);if(mode==='replacement')assert.equal(f.u.mem.regularFormVisual.playId,'replacement');
});
for(const how of['retreat','death','replacement','stop','battleEnd'])test(`Source ${how} before first release removes account, talent and owned unborn work`,()=>{
 const f=make();enemy(f);cast(f);advance(f.b,.5);if(how==='retreat')f.b.retreat(f.u);if(how==='death')f.b.kill(f.u,null);if(how==='replacement'){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'new-life'};}
 if(how==='stop')f.controller.stop();if(how==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}advance(f.b,4);assert.equal(hits(f).length,0);assert.equal(f.controller.handles.length,0);assert.equal(f.controller.accountHandles.length,0);assert.equal(f.talent.handles.length,0);assert.equal(f.payload.flights.size,0);if(how==='replacement')assert.equal(f.u.mem.regularFormVisual.playId,'new-life');
});
test('A source exit after launch preserves only born payloads, with no post-withdrawal finish-heal grant',()=>{
 const f=make();enemy(f,{col:8});cast(f);until(f,()=>f.controller.phase.next===1);f.b.retreat(f.u);until(f,()=>hits(f).length===1);advance(f.b,5);assert.equal(hits(f).length,1);assert.equal(f.heals.length,0);assert.equal(f.payload.watchers.length,0);
});
test('Foreign modifiers survive cast cleanup and an externally ended account heals only once',()=>{
 const f=make();enemy(f);const foreign=f.b.addBuff(f.u,{key:'fixture:foreign',mods:{defPct:.2}});cast(f);f.u.skill.end('manual-stop');assert.equal(f.u.buffs.includes(foreign),true);assert.equal(f.heals.length,1);advance(f.b,.1);assert.equal(f.heals.length,1);
});
test('A nonderived final levitation remains after the selected account finishes normally',()=>{
 const f=make(),a=enemy(f);cast(f);until(f,()=>!f.u.skill.active);assert.equal(a.s.flags.levitate,true);assert.equal(f.controller.payload.flights.size,0);assert.equal(f.heals.length,1);
});
test('Source resetAbilityCooldownWhenCastEnd0 preserves the remaining ordinary cooldown on interruption',()=>{
 const f=make();enemy(f);until(f,()=>!!f.controller.phase);cast(f);advance(f.b,.1);const cd=f.u.atkCd;f.b.applyStatus(f.u,'stun',{duration:.01});advance(f.b,.04);assert.equal(f.u.skill.active,false);assert.ok(f.u.atkCd>cd-.1);advance(f.b,.4);assert.equal(ordinary(f).length,0);until(f,()=>ordinary(f).length===1);
});
test('Removing the shared presentation/modifier buff does not unlock the separately held S1 SP account',()=>{
 const f=make();enemy(f);cast(f);f.b.removeBuff(f.u,f.u.skill._buffKey);assert.equal(f.u.skill.gainSp(999,'gift'),0);advance(f.b,2);assert.equal(f.u.skill.active,true);near(f.u.skill.spTotal,0);until(f,()=>!f.u.skill.active);assert.equal(hits(f).length,4);assert.equal(f.u.skill.gainSp(1,'gift'),1);
});
test('External forceAttack cannot invent an early or extra marker receipt during an accepted S1',()=>{
 const f=make(),t=enemy(f);cast(f);f.b.forceAttack(f.u,[t]);assert.equal(f.receipts.length,0);until(f,()=>f.receipts.length===1);f.b.forceAttack(f.u,[t]);until(f,()=>!f.u.skill.active);assert.equal(f.receipts.length,1);assert.equal(hits(f).length,4);
});
test('Held S1 clears unchanged original 0-1 with natural DP, source cost and actual Yukari damage',()=>{
 const M='char_208_melan',G='char_122_beagle',b=new StandardBattle(data,{operators:[defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 const tiles=structuredClone(b.grid.tiles),geometry=JSON.stringify(data.stage.geometry),f=addOwner(b,{row:1,col:4,dir:'UP',defer:true,prepare:(b,u)=>prepareYukariS1(b,u,{contract:YUKARI_S1_CONTRACT})});fs.push(f);let deployed=false,m,g,casts=0,cost=0;
 for(let n=0;n<9001&&!b.finished;n++){
  if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');
  if(m&&!deployed&&b.dp>=f.record.stats.cost){assert.equal(b.grid.tile(1,4).build,'RANGED');const before=b.dp;b.addDp('arkpedia',-f.record.stats.cost);assert.ok(b._deploy(f.u,{initial:false,costAttribute:f.record.stats.cost}));cost=before-b.dp;deployed=true;}
  if(deployed&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(deployed&&f.u.skill.ready&&f.u.skill.activate('manual'))casts++;b.step();
 }
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;console.log(JSON.stringify({scope:'held direct-controller original-wave diagnostic',skill:1,reason:r.reason,kills:r.killed,leaks,life:b.life,cost,casts,activations:f.u.skill.activations,damage:f.u.stats.dmg}));
 assert.ok(deployed&&m&&g&&f.u.stats.dmg>0&&casts>0);near(cost,16);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);assert.deepEqual(b.grid.tiles,tiles);assert.equal(JSON.stringify(data.stage.geometry),geometry);
});
