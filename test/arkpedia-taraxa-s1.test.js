// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,ally,advance,until,near} from './helpers/taraxa-fixture.js';
import {prepareTaraxaS1,TARAXA_S1_CONTRACT,verifyTaraxaS1} from '../server/sim/content/arkpedia-taraxa-s1.js';
import {taraxaNativeInputs} from '../server/sim/content/arkpedia-taraxa-source.js';
function make(opts={}){
 const f=fixture({...opts,prepare:(b,u)=>prepareTaraxaS1(b,u,{contract:TARAXA_S1_CONTRACT})});f.heals=[];f.receipts=[];
 f.b.on('calculatedHeal',h=>{if(h.source===f.u)f.heals.push({...h,time:f.b.time});});
 f.b.on('attack',h=>{if(h.attacker===f.u)f.receipts.push({...h,time:f.b.time});});return f;
}
function cast(f){f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('fixture'),true);}
const active=f=>until(f,()=>f.flight.mode===2);
const skillHeals=f=>f.heals.filter(h=>h.opts.isSkill);
test('S1 composition rejects absent contracts, another selected skill or changed source scaling',()=>{
 verifyTaraxaS1();assert.throws(()=>fixture({prepare:prepareTaraxaS1}),/exact contract/);
 assert.throws(()=>make({skill:2}),/selected Taraxacum S1/);
 const n=structuredClone(taraxaNativeInputs());n.modes[2].abilities[0]._buffs[0].attributes.attributeModifiers[0].formulaItem=1;
 assert.throws(()=>verifyTaraxaS1(n),/Changed original/);
});
for(const rank of[1,7,10])test(`S1 rank${rank} retains source duration, final attack-time scale and direct heal coefficient`,()=>{
 const f=make({rank});ally(f);cast(f);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1_Begin');
 assert.equal(f.flight.mode,1);assert.equal(skillHeals(f).length,0);active(f);
 near(f.u.s.interval,f.u.base.bat*f.record.bb['attack@base_attack_time']);
 until(f,()=>skillHeals(f).length>=3);const hs=skillHeals(f);near(hs[0].amount,f.u.s.atk*f.record.bb['attack@heal_scale']);
 assert.equal(f.b.projectiles.list.length,0);assert.equal(f.controller.flights.size,0);
 assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1_Loop');assert.equal(f.u.mem.regularFormVisual.loop,true);
 near(f.u.skill.duration,f.record.source.duration);assert.equal(f.u.skill.active,true);near(f.u.skill.sp,0);
});
test('Continuous S1 loop is not restarted by successive direct heal receipts',()=>{
 const f=make();ally(f);cast(f);active(f);const visual=f.u.mem.regularFormVisual;until(f,()=>skillHeals(f).length>=4);
 assert.equal(f.u.mem.regularFormVisual,visual);assert.equal(f.u.mem.regularVisualDirection,'RIGHT');
});
test('A no-target activation takes off and holds its account without fabricating healing',()=>{
 const f=make();cast(f);active(f);advance(f.b,3);assert.equal(f.u.skill.active,true);assert.equal(skillHeals(f).length,0);
 assert.equal(f.receipts.length,0);near(f.u.skill.sp,0);near(f.u.s.physTakenMul,.9);
});
test('Original random acquisition can pick either injured ratio rather than always the lowest one',()=>{
 const f=make(),a=ally(f,{ratio:.01}),b=ally(f,{col:7,ratio:.2});const inputs=[];
 f.b.rng.pick=xs=>{inputs.push([...xs]);return xs.at(-1);};cast(f);until(f,()=>skillHeals(f).length===1);
 assert.equal(skillHeals(f)[0].target,b);assert.ok(inputs.some(xs=>xs.includes(a)&&xs.includes(b)));
});
for(const kind of['full','hidden','healFree','noHeal','isolated','device'])test(`S1 excludes ${kind} from its random injured inputs`,()=>{
 const f=make(),a=ally(f,{ratio:kind==='full'?1:.2,flags:['healFree','noHeal','isolated'].includes(kind)?{[kind]:true}:{},device:kind==='device'});
 if(kind==='hidden')a.hidden=true;cast(f);active(f);advance(f.b,2);assert.equal(skillHeals(f).length,0);
});
test('An injured isolated self can be selected without healing-from-others eligibility',()=>{
 const f=make();f.u.hp=100;f.b.addBuff(f.u,{key:'fixture:self',flags:{isolated:true,noHeal:true}});cast(f);
 until(f,()=>skillHeals(f).length>0);assert.equal(skillHeals(f)[0].target,f.u);
});
test('Live attack/healing attributes and recipient incoming modifiers apply through the normal pipeline',()=>{
 const f=make(),t=ally(f);f.b.addBuff(f.u,{key:'fixture:output',mods:{atkMul:1.5,healingDealtMul:1.2}});
 f.b.addBuff(t,{key:'fixture:incoming',mods:{healingTakenMul:1.3}});cast(f);until(f,()=>skillHeals(f).length===1);
 near(skillHeals(f)[0].amount,f.u.s.atk*f.record.bb['attack@heal_scale']*1.2*1.3);
});
test('External ASPD affects the final scaled interval once without accelerating the continuously playing model',()=>{
 const f=make();ally(f);f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd:100,batFlat:1,slowDownMul:.1}});cast(f);active(f);
 near(f.u.s.interval,(f.u.base.bat+1)*.2/2);near(f.u.mem.regularFormVisual.speed,1);
 until(f,()=>skillHeals(f).length===3);near(skillHeals(f)[2].time-skillHeals(f)[1].time,.4,.04);
});
test('Rejected mode consumes the original account but grants neither flight nor the rapid-heal mode',()=>{
 const f=make();ally(f);f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa_s1[mode]:'))c.cancel=true;});cast(f);advance(f.b,3);
 assert.equal(f.u.skill.active,true);assert.equal(f.flight.mode,0);near(f.u.s.interval,2.85);assert.equal(skillHeals(f).length,0);
 assert.ok(f.heals.some(h=>!h.opts.isSkill));assert.ok(f.receipts.every(h=>h.isSkill===false));
});
test('Rejected attack-time buff leaves the active direct-heal mode at ordinary BAT',()=>{
 const f=make();ally(f);f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa_s1[atk_time]:'))c.cancel=true;});cast(f);active(f);
 near(f.u.s.interval,2.85);until(f,()=>skillHeals(f).length>=2);near(skillHeals(f)[1].time-skillHeals(f)[0].time,2.8666666667,.04);
});
test('Dispelling the accepted attack-time resource restores BAT without removing flight/account',()=>{
 const f=make();ally(f);cast(f);active(f);f.b.removeBuff(f.u,f.controller.batBuff);
 near(f.u.s.interval,2.85);assert.equal(f.flight.mode,2);assert.equal(f.u.skill.active,true);
});
test('Dispelling mode begins landing, removes scaled BAT and keeps SP held until the account ends',()=>{
 const f=make();ally(f);cast(f);active(f);f.b.removeBuff(f.u,f.controller.modeBuff);
 assert.equal(f.flight.mode,3);near(f.u.s.interval,2.85);advance(f.b,1.1);assert.equal(f.flight.mode,0);
 assert.equal(f.u.skill.active,true);near(f.u.skill.sp,0);assert.equal(f.controller.modeBuff,null);
});
test('Account end clears rapid work, plays End and recovers SP during its original landing window',()=>{
 const f=make();ally(f);cast(f);active(f);const count=skillHeals(f).length;f.u.skill.end('fixture');
 assert.equal(f.flight.mode,3);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1_End');near(f.u.s.interval,2.85);
 advance(f.b,.5);assert.equal(skillHeals(f).length,count);assert.ok(f.u.skill.sp>0);assert.equal(f.u.s.flags.liftoff,true);
 advance(f.b,.6);assert.equal(f.flight.mode,0);assert.equal(!!f.u.s.flags.liftoff,false);
});
test('Short stun during an active cycle holds the account without replaying its attack or spending SP',()=>{
 const f=make();ally(f);cast(f);until(f,()=>skillHeals(f).length===1);const count=skillHeals(f).length;
 f.b.applyStatus(f.u,'stun',{duration:.2});advance(f.b,.2);assert.equal(skillHeals(f).length,count);assert.equal(f.u.skill.active,true);near(f.u.skill.sp,0);
 until(f,()=>skillHeals(f).length>count);assert.equal(f.flight.mode,2);
});
test('Before-attack veto and reentrant forced calls cannot duplicate a direct heal',()=>{
 const f=make(),t=ally(f);let calls=0;
 f.b.on('beforeAttack',h=>{if(h.attacker===f.u){calls++;f.b.forceAttack(f.u,[t]);h.targets=[];}});
 cast(f);advance(f.b,3);assert.ok(calls>0);assert.equal(skillHeals(f).length,0);assert.equal(f.receipts.length,0);
});
test('Recipient replacement before receipt cannot receive an old direct heal',()=>{
 const f=make(),t=ally(f);const hp=t.hp;
 f.b.on('beforeAttack',h=>{if(h.attacker===f.u)t.deploySeq++;});cast(f);advance(f.b,2);
 assert.equal(t.hp,hp);assert.equal(skillHeals(f).length,0);
});
test('Recipient replacement during healing callbacks cannot inherit its HP restoration',()=>{
 const f=make(),t=ally(f);cast(f);active(f);const hp=t.hp;
 f.b.on('heal',h=>{if(h.source===f.u)t.deploySeq++;});advance(f.b,1);assert.equal(t.hp,hp);
});
for(const key of['taraxa_s1[mode]:','taraxa_s1[atk_time]:'])test(`Retreat during ${key} admission leaves no late resource`,()=>{
 const f=make();ally(f);let once=false;f.b.on('beforeBuff',c=>{if(!once&&c.buff.key.startsWith(key)){once=true;f.b.retreat(f.u);}});
 cast(f);advance(f.b,1.1);assert.ok(once);assert.equal(f.controller.stopped,true);
 assert.equal(f.u.buffs.filter(x=>x.key.startsWith('taraxa')).length,0);assert.equal(f.flight.handles.length,0);assert.equal(f.aura.handles.length,0);
});
test('A prematurely finished mode admission cannot retain its late buff or start takeoff',()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa_s1[mode]:'))c.buff.onRemove();});cast(f);
 advance(f.b,1.1);assert.equal(f.flight.mode,0);assert.equal(f.controller.modeBuff,null);assert.equal(f.u.buffs.filter(x=>x.key.startsWith('taraxa_s1[mode]:')).length,0);
});
test('A source-hidden active mode cancels healing and resumes only on the same deployment life',()=>{
 const f=make();ally(f);cast(f);active(f);f.u.hidden=true;const count=skillHeals(f).length;advance(f.b,2);
 assert.equal(skillHeals(f).length,count);f.u.hidden=false;until(f,()=>skillHeals(f).length>count);
});
test('Battle end drains aura, owned flight/mode/attack-time resources and all component listeners',()=>{
 const f=make();ally(f);cast(f);active(f);f.b.finished=true;f.b.emit('battleEnd',{});
 for(const c of[f.controller,f.flight,f.aura])assert.equal(c.handles.length,0);
 assert.equal(f.u.buffs.filter(x=>x.key.startsWith('taraxa')).length,0);assert.equal(f.controller.phase,null);
});

test('Natural source-duration expiry starts landing exactly once and admits no late S1 heals',()=>{
 const f=make();ally(f);cast(f);advance(f.b,f.record.source.duration+.01);assert.equal(f.u.skill.active,false);assert.equal(f.flight.mode,3);
 const n=skillHeals(f).length;advance(f.b,1.1);assert.equal(skillHeals(f).length,n);assert.equal(f.flight.mode,0);assert.ok(f.u.skill.sp>0);
});

test('S1 accepted receipt hooks identify the source skill rather than the ordinary attack mode',()=>{
 const f=make();ally(f);cast(f);until(f,()=>skillHeals(f).length===2);assert.ok(f.receipts.every(h=>h.isSkill===true));
});

test('A born grounded projectile remains an ordinary independent heal after S1 activation',()=>{
 const f=make();ally(f);until(f,()=>f.controller.flights.size>0);cast(f);until(f,()=>f.heals.length>0);
 assert.equal(f.heals[0].opts.isSkill,false);assert.equal(f.heals[0].opts.isProjectile,true);assert.equal(f.flight.mode,1);
});

test('Manual activation cannot recast during landing even with an externally refilled account',()=>{
 const f=make();cast(f);active(f);f.u.skill.end('fixture');f.u.skill.setSpTotal(f.u.skill.spCost);
 assert.equal(f.u.skill.activate('fixture'),false);advance(f.b,1.1);assert.equal(f.u.skill.activate('fixture'),true);assert.equal(f.flight.mode,1);
});

test('Removing the generic no-SP buff does not unlock an active native timed account',()=>{
 const f=make();cast(f);active(f);f.b.removeBuff(f.u,f.u.skill._buffKey);advance(f.b,2);
 assert.equal(f.u.skill.active,true);near(f.u.skill.sp,0);assert.equal(f.flight.mode,2);
});

test('A selected source cannot accidentally install a second S1 controller',()=>{
 const f=fixture({defer:true,prepare:(b,u)=>prepareTaraxaS1(b,u,{contract:TARAXA_S1_CONTRACT})});
 assert.throws(()=>prepareTaraxaS1(f.b,f.u,{contract:TARAXA_S1_CONTRACT}),/already has/);
});
