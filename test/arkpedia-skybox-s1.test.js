// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,enemy,near,advance,until} from './helpers/skybox-fixture.js';
import {prepareSkyboxS1,SKYBOX_S1_CONTRACT,verifySkyboxS1} from '../server/sim/content/arkpedia-skybox-s1.js';
import {explicitBlockMode} from '../server/sim/block-mode.js';
const fixtures=[];
const make=opts=>{const f=fixture({...opts,prepare:(b,u)=>prepareSkyboxS1(b,u,{contract:SKYBOX_S1_CONTRACT})});fixtures.push(f);return f;};
test.afterEach(()=>{for(const f of fixtures.splice(0))assert.deepEqual(f.b.errors,[]);});
const hits=f=>f.hits.filter(h=>h.dmg.tags.includes('skybox:s1'));
const cast=f=>{f.u.skill.addCharge(1);until(f,()=>f.u.skill.active);};
test('S1 requires its explicit selected source contract',()=>{verifySkyboxS1();assert.throws(()=>make({skill:2}),/selected Skybox S1/);});
for(let rank=1;rank<=10;rank++)test(`Rank${rank} naturally charges and uses one fixed Begin/End sequence, radius-two bomb and original source scale`,()=>{
 const f=make({rank}),a=enemy(f),other=enemy(f,{col:8});const cost=f.record.source.spData.spCost;
 assert.equal(f.u.skill.maxCharges,rank<7?1:2);advance(f.b,cost-.5);assert.equal(f.u.skill.activations,0);
 until(f,()=>f.u.skill.active);const started=f.b.time,spAtStart=f.u.skill.sp;assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1_Begin');assert.equal(f.u.skill.charges,0);
 advance(f.b,.5);assert.equal(f.receipts.length,0);until(f,()=>f.payload.flights.size===1);assert.equal(f.receipts.length,1);
 until(f,()=>hits(f).length===2);near(a.s.maxHp-a.hp,f.u.s.atk*f.record.bb.atk_scale);assert.equal(other.s.flags.silence,true);
 until(f,()=>f.u.mem.regularFormVisual.clip==='Skill_1_End');near(f.b.time-started,1,.04);near(f.u.skill.sp,spAtStart);
 until(f,()=>!f.u.skill.active);near(f.b.time-started,2,.04);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');assert.equal(explicitBlockMode(f.u),'FLY');
 advance(f.b,.2);assert.ok(f.u.skill.sp>0);
});
test('No input preserves a naturally ready charge and ordinary ground attacks never substitute for S1',()=>{
 const f=make();advance(f.b,20);assert.equal(f.u.skill.activations,0);assert.equal(f.u.skill.charges,2);assert.equal(f.receipts.length,0);
 enemy(f);until(f,()=>f.u.skill.active);assert.equal(f.u.skill.charges,1);
});
test('Ordinary aerial attacks continue while S1 recovers, then a ground input can trigger the skill',()=>{
 const f=make(),ground=enemy(f),air=enemy(f,{col:7.2,motion:'FLY'});until(f,()=>f.hits.length===1);
 assert.equal(f.hits[0].target.id,air.id);near(ground.hp,ground.s.maxHp);until(f,()=>f.u.skill.active);until(f,()=>hits(f).length===2);
 assert.equal(ground.s.flags.silence,true);
});
for(const dir of['RIGHT','LEFT','UP','DOWN'])test(`S1 ${dir} retains original Begin/End and single-input gameplay`,()=>{
 const f=make({dir}),r=dir==='UP'?7:dir==='DOWN'?3:5,c=dir==='RIGHT'?7:dir==='LEFT'?3:5;enemy(f,{row:r,col:c});cast(f);
 assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1_Begin');assert.equal(f.u.mem.regularVisualDirection,dir);until(f,()=>hits(f).length===1);
 until(f,()=>!f.u.skill.active);assert.equal(f.receipts.length,1);
});
test('High ASPD and slowdown cannot speed up or slow down fixed original skill clocks',()=>{
 const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:speed',mods:{aspd:300,slowDownMul:.1}});cast(f);const start=f.b.time;
 advance(f.b,.5);assert.equal(f.receipts.length,0);until(f,()=>f.receipts.length===1);near(f.b.time-start,.5333333611488342,.04);
 until(f,()=>!f.u.skill.active);near(f.b.time-start,2,.04);
});
for(const change of['death','replacement','hidden'])test(`Input ${change} before the original release emits at its captured position and never refunds a born bomb`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});cast(f);const charges=f.u.skill.charges;
 if(change==='death')f.b.kill(a,null);if(change==='replacement'){a.deploySeq++;a.x=15;a.y=15;}if(change==='hidden')a.hidden=true;
 until(f,()=>hits(f).length===1);assert.equal(hits(f)[0].target.id,other.id);assert.equal(f.u.skill.charges,charges);assert.equal(f.receipts.length,1);
});
for(const flag of['stun','disarm','hidden'])test(`Brief ${flag} invalidates unborn output while original End, flight return and SP unlock finish`,()=>{
 const f=make();enemy(f);cast(f);const start=f.b.time;
 if(flag==='hidden'){f.u.hidden=true;advance(f.b,.04);f.u.hidden=false;}else f.b.applyStatus(f.u,flag,{duration:.01});
 until(f,()=>!f.u.skill.active);near(f.b.time-start,2,.04);assert.equal(hits(f).length,0);assert.equal(f.receipts.length,0);
 assert.equal(explicitBlockMode(f.u),'FLY');assert.equal(f.flight.skillTimers.size,0);advance(f.b,.2);assert.ok(f.u.skill.sp>0);
});
test('Refused landing does not fabricate the rejected command or suppress the independent bomb',()=>{
 const f=make();enemy(f);f.b.on('beforeBuff',c=>{if(c.buff.data?.skyboxSkillFlight)c.cancel=true;});cast(f);until(f,()=>hits(f).length===1);
 assert.equal(explicitBlockMode(f.u),null);near(f.flight.heightNow(),.4000000059604645);until(f,()=>!f.u.skill.active);
});
test('Direct manual activation cannot bypass the automatic captured-input controller',()=>{
 const f=make();enemy(f);f.u.skill.addCharge(1);assert.equal(f.u.skill.activate('manual'),false);until(f,()=>f.u.skill.active);
 assert.equal(f.u.skill.activate('manual'),false);
});
test('Before-attack cancellation and recursive forcing cannot duplicate the retained skill receipt',()=>{
 for(const veto of[true,false]){const f=make(),a=enemy(f);f.b.on('beforeAttack',c=>{if(c.attacker!==f.u)return;
  if(veto)c.targets=[];else f.b.forceAttack(f.u,[a]);});cast(f);until(f,()=>!f.u.skill.active);
  assert.equal(f.receipts.length,veto?0:1);assert.equal(hits(f).length,veto?0:1);
 }
});
for(const reason of['retreat','death','battleEnd','replacement'])test(`${reason} clears owned account/transition state and cannot close a replacement account`,()=>{
 const f=make();enemy(f);cast(f);
 if(reason==='retreat')f.b.retreat(f.u);if(reason==='death')f.b.kill(f.u,null);
 if(reason==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}
 if(reason==='replacement'){f.u.deploySeq++;advance(f.b,.1);}
 assert.equal(f.controller.stopped,true);assert.equal(f.controller.handles.length,0);assert.equal(f.controller.accountHandles.length,0);
 assert.equal(f.flight.skillTimers.size,0);assert.equal(f.talent.handles.length,0);
 if(reason!=='replacement')assert.equal(f.u.skill.active,false);
});
test('E0 S1 still uses its source damage and landing sequence without inventing the locked Silence talent',()=>{
 const f=make({elite:0,rank:4}),a=enemy(f);cast(f);until(f,()=>hits(f).length===1);
 near(hits(f)[0].amount,f.u.s.atk*f.record.bb.atk_scale);assert.equal(!!a.s.flags.silence,false);assert.equal(f.talent.records.size,0);
 until(f,()=>!f.u.skill.active);assert.equal(explicitBlockMode(f.u),'FLY');
});
test('Two ready charges produce two complete separate sequences and preserve the ordinary positive cooldown',()=>{
 const f=make();advance(f.b,20);enemy(f);until(f,()=>f.u.skill.active);const first=f.b.time;
 assert.equal(f.u.skill.charges,1);until(f,()=>!f.u.skill.active);assert.equal(f.u.skill.charges,1);
 until(f,()=>f.u.skill.activations===2);assert.ok(f.b.time-first>=2);assert.equal(f.u.skill.charges,0);
 until(f,()=>!f.u.skill.active);assert.equal(f.receipts.length,2);assert.equal(hits(f).length,2);
 assert.equal(f.flight.skillPhase,null);assert.equal(f.flight.skillTimers.size,0);
});
test('An own blocked aerial input remains captured after landing releases it outside the ordinary grid',()=>{
 const f=make(),a=enemy(f,{col:4.2,motion:'FLY'});f.b._refreshRange(f.u);
 assert.equal(f.u.rangeKeySet.has(5*21+4),false);assert.equal(f.b._checkBlock(a),true);cast(f);
 assert.equal(f.controller.phase.target.id,a.id);advance(f.b,.3);assert.equal(a.blockedBy,null);
 until(f,()=>hits(f).length===1);assert.equal(hits(f)[0].target.id,a.id);
});
test('A born bomb survives early account cancellation and cannot be replayed by its End callback',()=>{
 const f=make(),a=enemy(f);cast(f);until(f,()=>f.payload.flights.size===1);const activations=f.u.skill.activations;
 f.u.skill.end('fixture:cancel');until(f,()=>hits(f).length===1);advance(f.b,1.2);
 assert.equal(f.u.skill.activations,activations);assert.equal(f.receipts.length,1);assert.equal(f.payload.flights.size,0);
 assert.equal(!!f.controller.phase,false);assert.equal(f.flight.skillPhase,null);assert.equal(explicitBlockMode(f.u),'FLY');
});
test('Cancelling an unborn account still performs End/return without creating a projectile or free charge',()=>{
 const f=make();enemy(f);cast(f);const charges=f.u.skill.charges;f.u.skill.end('fixture:cancel');
 assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1_End');advance(f.b,1.1);
 assert.equal(hits(f).length,0);assert.equal(f.receipts.length,0);assert.equal(f.u.skill.charges,charges);
 assert.equal(!!f.controller.phase,false);assert.equal(f.flight.skillPhase,null);assert.equal(explicitBlockMode(f.u),'FLY');
});
test('A refused dispellable no-SP buff cannot bypass the held source account lock',()=>{
 const f=make();enemy(f);f.b.on('beforeBuff',c=>{if(c.buff.key===f.u.skill._buffKey)c.cancel=true;});cast(f);
 const sp=f.u.skill.sp;advance(f.b,1.6);near(f.u.skill.sp,sp);assert.equal(f.u.skill.gainSp(100,'fixture'),0);
 until(f,()=>!f.u.skill.active);advance(f.b,.2);assert.ok(f.u.skill.sp>sp);
});
test('Owner replacement inside beforeAttack cannot issue an old-life bomb or overwrite replacement presentation',()=>{
 const f=make();enemy(f);f.b.on('beforeAttack',c=>{if(c.attacker===f.u){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'replacement'};}});
 cast(f);advance(f.b,1);assert.equal(f.controller.stopped,true);assert.equal(f.payload.flights.size,0);assert.equal(hits(f).length,0);
 assert.equal(f.u.mem.regularFormVisual.playId,'replacement');assert.equal(f.flight.skillTimers.size,0);
});

for(const replaced of[false,true])test(`End re-faces the ${replaced?'original input position instead of a replacement life':'current captured input after it moves'}`,()=>{
 const f=make(),a=enemy(f);cast(f);assert.equal(f.u.mem.regularVisualDirection,'RIGHT');
 a.x=5;a.y=8;if(replaced)a.deploySeq++;
 until(f,()=>f.u.mem.regularFormVisual.clip==='Skill_1_End');assert.equal(f.u.mem.regularVisualDirection,replaced?'RIGHT':'UP');
 assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1_End');until(f,()=>!f.u.skill.active);
});
