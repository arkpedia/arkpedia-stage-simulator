// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,cast,advance,until,near} from './helpers/tmslot-fixture.js';
import {TMSLOT_CONTRACT,prepareTimeslot} from '../server/sim/content/arkpedia-tmslot.js';
const out=(f,alias)=>f.hits.filter(h=>h.dmg.tags.includes('tmslot:'+alias));
const born=f=>advance(f.b,1.05);
const target=f=>enemy(f,{x:6});
const slow=f=>f.b.addBuff(f.u,{key:'qa:slow',data:{nativeSlowDown:{increment:.5,maxStrength:.5}}});
for(let rank=1;rank<=10;rank++)test(`Timeslot S1 rank ${rank} keeps common skill identity, additive ATK and ordinary original clips`,()=>{
 const f=make({rank}),{b,u,controller:c}=f;target(f);born(f);cast(f);
 assert.equal(u.skill.id,'skcom_atk_up[3]');assert.equal(c.mode,1);near(u.s.atk,f.record.stats.atk*(1+c.talent.atk+f.record.bb.atk));
 assert.equal(u.skill.duration,30);until(f,()=>out(f,'Funnel').length>0,3);assert.equal(out(f,'Owner').length,out(f,'Funnel').length);assert.equal(f.attacks.at(-1).targets.length,1);
 assert.equal(u.mem.regularFormVisual.clip,'Attack');advance(b,u.skill.timeLeft+.1);assert.equal(u.skill.active,false);assert.equal(c.mode,0);near(u.s.atk,f.record.stats.atk*(1+c.talent.atk));
});
for(let rank=1;rank<=10;rank++)test(`Timeslot S2 rank ${rank} separates first phase, both locked ramps and overload-only attributes`,()=>{
 const f=make({skill:2,rank}),{b,u,controller:c}=f;target(f);born(f);const atk=u.s.atk,aspd=u.s.aspd;cast(f);
 near(u.s.atk,atk);near(u.s.aspd,aspd);assert.equal(u.skill.duration,40);assert.equal(c.mode,2);until(f,()=>out(f,'S2Funnel_1').length>0,3);
 assert.equal(out(f,'Funnel').length,0);assert.equal(out(f,'S2Funnel_1').length,out(f,'S2Funnel_2').length);assert.equal(c.marks.size,1);
 until(f,()=>c.mode===3,21);near(u.s.atk,f.record.stats.atk*(1+c.talent.atk+f.record.bb.atk));near(u.s.aspd,100+f.record.bb.attack_speed);
 assert.ok(Math.abs(b.time-c.startedAt-20)<=b.dt+.001);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Overload_Begin');
 const attacks=f.attacks.length,pulses=c.slots[0].pulses;advance(b,2);assert.equal(f.attacks.length,attacks);assert.ok(c.slots[0].pulses>pulses);
 advance(b,u.skill.timeLeft+.1);assert.equal(c.mode,0);assert.equal(c.marks.size,0);assert.ok(c.slots.every(s=>s.target===null));near(u.s.atk,atk);near(u.s.aspd,aspd);
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`Timeslot E${elite}/P${potential} installs selected talent once and keeps its Slow ownership`,()=>{
 const f=make({elite,potential,trust:200}),{u,controller:c}=f;
 near(u.s.atk,f.record.stats.atk*(1+(c.talent?.atk??0)));assert.equal(!!u.findBuff(c.talentKey),elite>0);assert.throws(()=>c.install());
});
test('Timeslot ordinary owner and one drone share one accepted attack ID but retain independent damage scales',()=>{
 const f=make(),t=target(f);until(f,()=>out(f,'Funnel').length>0,3);
 assert.equal(out(f,'Owner').length,1);assert.equal(out(f,'Funnel').length,1);assert.equal(f.attacks.length,1);
 near(out(f,'Owner')[0].amount,f.u.s.atk);near(out(f,'Funnel')[0].amount,f.u.s.atk*.2);assert.equal(out(f,'Owner')[0].dmg.attackId,out(f,'Funnel')[0].dmg.attackId);
 assert.equal(out(f,'Owner')[0].target,t);assert.equal(out(f,'Funnel')[0].target,t);
});
test('Timeslot ordinary drone ramp reaches the selected cap and resets on a new target life',()=>{
 const f=make(),a=target(f);until(f,()=>out(f,'Funnel').length>=8,15);
 for(let i=0;i<8;i++)near(out(f,'Funnel')[i].amount,f.u.s.atk*Math.min(1.1,.2+.15*i));
 f.b.kill(a);const z=target(f);const n=out(f,'Funnel').length;until(f,()=>out(f,'Funnel').length>n,4);near(out(f,'Funnel').at(-1).amount,f.u.s.atk*.2);assert.equal(out(f,'Funnel').at(-1).target,z);
});
test('Timeslot existing S2 locks stay on their recipient when a new higher-priority target arrives',()=>{
 const f=make({skill:2}),a=target(f);born(f);cast(f);until(f,()=>f.controller.slots[0].pulses>1,5);
 const z=enemy(f,{x:6.5});z.base.tauntLevel=100;z.markDirty();advance(f.b,2);
 assert.ok(f.controller.slots.every(s=>s.target===a));assert.ok(out(f,'Owner').some(h=>h.target===z));assert.ok(out(f,'S2Funnel_1').every(h=>h.target===a));
});
test('Timeslot range-mark forcing skips remaining normal time and leaves the twenty-second overload account',()=>{
 const f=make({skill:2}),t=target(f);born(f);cast(f);until(f,()=>f.controller.marks.has(t),3);const when=f.b.time;
 t.x=12;f.b._buildEnemyIndex();advance(f.b,.15);assert.equal(f.controller.mode,3);near(f.u.skill.timeLeft,20-(f.b.time-f.controller.overloadedAt));
 assert.ok(f.controller.overloadedAt-when<=.15+1e-7);const hp=t.hp,attacks=f.attacks.length;advance(f.b,2);assert.ok(t.hp<hp);assert.equal(f.attacks.length,attacks);
});
test('Timeslot a marked large body overlapping range does not force overload until every covered cell leaves',()=>{
 const f=make({skill:2}),t=target(f);born(f);cast(f);until(f,()=>f.controller.marks.has(t),3);
 t.def={...t.def,hitRect:{width:2,height:1}};t.x=8.4;f.b._buildEnemyIndex();advance(f.b,.2);assert.equal(f.controller.mode,2);
 t.x=11;f.b._buildEnemyIndex();advance(f.b,.15);assert.equal(f.controller.mode,3);
});
test('Timeslot unrelated targets, removed marks and dead target lives cannot force overload',()=>{
 for(const how of['unrelated','mark','death','life']){const f=make({skill:2}),t=target(f);born(f);cast(f);until(f,()=>f.controller.marks.has(t),3);
  if(how==='unrelated'){enemy(f,{x:15});}
  else{t.x=12;if(how==='mark')f.b.removeBuff(t,f.controller.markKey);if(how==='death')f.b.kill(t);if(how==='life')t.deploySeq++;}
  advance(f.b,.2);assert.equal(f.controller.mode,2);
 }
});
for(const flag of['stun','disarm','freeze'])test(`Timeslot locked drones continue through owner ${flag}, with no new owner attacks`,()=>{
 const f=make({skill:2});target(f);born(f);cast(f);until(f,()=>f.controller.slots[0].pulses>0,3);
 f.b.addBuff(f.u,{key:'qa:control',flags:{[flag]:true}});const attacks=f.attacks.length,hits=out(f,'S2Funnel_1').length;advance(f.b,3);
 assert.equal(f.attacks.length,attacks);assert.ok(out(f,'S2Funnel_1').length>hits);
});
test('Timeslot overload reacquires independent empty slots while control prevents new locks',()=>{
 const f=make({skill:2}),a=target(f);born(f);cast(f);until(f,()=>f.controller.slots[0].pulses>1,5);f.controller.enterOverload();advance(f.b,1.1);
 f.b.addBuff(f.u,{key:'qa:control',flags:{stun:true}});f.b.kill(a);const z=target(f);advance(f.b,2);assert.ok(f.controller.slots.every(s=>s.target===null));
 f.b.removeBuff(f.u,'qa:control');until(f,()=>f.controller.slots.every(s=>s.target===z),3);until(f,()=>out(f,'S2Funnel_1').some(h=>h.target===z),2);
 near(out(f,'S2Funnel_1').find(h=>h.target===z).amount,f.u.s.atk*.2);
});
for(const flag of['hidden','stealth','sleep','untargetable','invulnerable'])test(`Timeslot suppressed ${flag} recipients keep their lock without replaying missed pulses`,()=>{
 const f=make({skill:2}),t=target(f);born(f);cast(f);until(f,()=>f.controller.slots[0].pulses>0,3);
 if(flag==='hidden')t.hidden=true;else f.b.addBuff(t,{key:'qa:suppress',flags:{[flag]:true}});
 const hp=t.hp,n=out(f,'S2Funnel_1').length;advance(f.b,2.6);near(t.hp,hp);assert.ok(f.controller.slots.every(s=>s.target===t));
 if(flag==='hidden')t.hidden=false;else f.b.removeBuff(t,'qa:suppress');advance(f.b,.05);assert.ok(out(f,'S2Funnel_1').length<=n+1);advance(f.b,1.4);assert.ok(out(f,'S2Funnel_1').length>n);
});
test('Timeslot native Slow rolls only for accepted funnel outputs, including shielded damage',()=>{
 const f=make(),t=target(f),events=[];f.b.rng=()=>0;f.b.on('statusApplied',c=>{if(c.source===f.u)events.push(c);});until(f,()=>out(f,'Funnel').length>0,3);
 assert.equal(events.length,1);assert.equal(events[0].target,t);near(events[0].duration,1.5);
 const n=events.length;f.b.dealDamage(f.u,t,{amount:1,type:'arts',tags:['tmslot:Owner']});assert.equal(events.length,n);
 f.b.addBuff(t,{key:'qa:shield',shield:1e6});f.b.dealDamage(f.u,t,{amount:1,type:'arts',tags:['tmslot:Funnel']});assert.equal(events.length,n+1);
 f.b.removeBuff(f.u,f.controller.talentKey);f.b.dealDamage(f.u,t,{amount:1,type:'arts',tags:['tmslot:Funnel']});assert.equal(events.length,n+1);
});
for(const how of['miss','cancel','failedRoll','foreign'])test(`Timeslot ${how} drone damage cannot fabricate Slow`,()=>{
 const f=make(),t=target(f),statuses=[];f.b.on('statusApplied',c=>{if(c.source===f.u)statuses.push(c);});f.b.rng=()=>how==='failedRoll'?1:0;
 if(how==='miss')f.b.addBuff(t,{key:'qa:dodge',mods:{dodgeArts:1}});
 if(how==='cancel')f.b.on('hit',c=>{if(c.source===f.u)c.cancel=true;});
 if(how==='foreign')f.b.dealDamage(null,t,{amount:1,type:'arts',tags:['tmslot:Funnel']});
 else f.b.dealDamage(f.u,t,{amount:1,type:'arts',canDodge:true,tags:['tmslot:Funnel']});assert.equal(statuses.length,0);
});
for(const speed of[50,100,300])test(`Timeslot owner ASPD ${speed} keeps the capped marker and one receipt`,()=>{
 const f=make();target(f);f.b.addBuff(f.u,{key:'qa:aspd',mods:{aspd:speed-100}});until(f,()=>f.controller.phase?.kind==='attack',2);
 const p=f.controller.phase,begin=p.startedAt;assert.ok(Math.abs(p.releaseAt-begin-.6333333253860474/Math.min(1,speed/100))<1e-7);
 until(f,()=>f.attacks.length>0,3);assert.equal(f.attacks.length,1);assert.equal(f.attacks[0].targets.length,1);assert.ok(f.attacks[0].time>=p.releaseAt-1e-7);
});
test('Timeslot ordinary clocks capture input-time speed while persistent drone clocks use current rate without a second slow-down factor',()=>{
 const f=make({skill:2});target(f);born(f);cast(f);until(f,()=>f.controller.phase?.kind==='attack',2);const at=f.controller.phase.releaseAt;
 slow(f);near(f.controller.phase.releaseAt,at);until(f,()=>f.controller.slots[0].target,3);const s=f.controller.slots[0];advance(f.b,.6);assert.equal(s.pulses,0);advance(f.b,.7);assert.equal(s.pulses,1);
 f.b.removeBuff(f.u,'qa:slow');const before=s.pulses;advance(f.b,1.3);assert.ok(s.pulses>=before+1);
});
test('Timeslot born ordinary flights keep speed fifteen, live source ATK and captured coefficient',()=>{
 const f=make(),t=enemy(f,{x:8});until(f,()=>f.attacks.length>0,3);assert.equal(f.b.projectiles.list.length,2);assert.ok(f.b.projectiles.list.every(p=>p.speed===15));
 f.b.addBuff(f.u,{key:'qa:atk',mods:{atkFlat:100}});until(f,()=>out(f,'Funnel').length>0,1);near(out(f,'Owner')[0].amount,f.u.s.atk);near(out(f,'Funnel')[0].amount,f.u.s.atk*.2);
});
test('Timeslot ordinary flights survive source retreat with birth ATK, while persistent ownership stops immediately',()=>{
 const f=make(),t=enemy(f,{x:8});until(f,()=>f.attacks.length>0,3);const atk=f.u.s.atk;f.b.retreat(f.u,{permanent:true});advance(f.b,.4);
 assert.equal(out(f,'Owner').length,1);near(out(f,'Owner')[0].amount,atk);near(out(f,'Funnel')[0].amount,atk*.2);assert.equal(f.controller.handles.length,0);assert.ok(t.hp<t.s.maxHp);
 const g=make({skill:2});target(g);born(g);cast(g);until(g,()=>g.controller.slots[0].pulses>0,3);g.b.retreat(g.u,{permanent:true});const n=out(g,'S2Funnel_1').length;advance(g.b,3);assert.equal(out(g,'S2Funnel_1').length,n);assert.equal(g.controller.marks.size,0);
});
for(const how of['targetDeath','targetLife','targetHidden'])test(`Timeslot ${how} fizzles born ordinary flights without replacing their target`,()=>{
 const f=make(),t=enemy(f,{x:8});until(f,()=>f.attacks.length>0,3);target(f);if(how==='targetDeath')f.b.kill(t);if(how==='targetLife')t.deploySeq++;if(how==='targetHidden')t.hidden=true;
 advance(f.b,.3);assert.equal(f.hits.length,0);assert.equal(f.controller.flights.size,0);
});
test('Timeslot control epochs cancel unborn owner output even when control expires between ticks',()=>{
 const f=make();target(f);until(f,()=>f.controller.phase?.kind==='attack',2);f.b.applyStatus(f.u,'stun',{duration:.001});advance(f.b,.65);assert.equal(f.hits.length,0);assert.equal(f.attacks.length,0);
});
test('Timeslot attack inputs do not retarget a lost target at their captured marker',()=>{
 const f=make(),t=target(f);until(f,()=>f.controller.phase?.kind==='attack',2);f.b.kill(t);target(f);advance(f.b,.65);assert.equal(f.hits.length,0);assert.equal(f.attacks.length,0);
});
test('Timeslot external and reentrant force attacks cannot bypass source admission',()=>{
 const f=make(),t=target(f);f.b.forceAttack(f.u,[t]);assert.equal(f.attacks.length,0);assert.equal(f.b.projectiles.list.length,0);
 f.b.on('beforeAttack',()=>f.b.forceAttack(f.u,[t]));until(f,()=>f.attacks.length>0,3);assert.equal(f.attacks.length,1);assert.equal(f.b.projectiles.list.length,2);
});
for(const how of['modeReject','modeRemove','overloadReject','overloadRemove'])test(`Timeslot ${how} keeps parent and stat ownership separate`,()=>{
 const f=make({skill:2}),c=f.controller;target(f);born(f);
 if(how.endsWith('Reject'))f.b.on('beforeBuff',x=>{if(x.buff.key===(how==='modeReject'?c.modeKey:c.skillKey))x.cancel=true;});cast(f);
 if(how==='modeReject'){assert.equal(c.mode,0);advance(f.b,3);assert.ok(c.slots.every(s=>s.target===null));return;}
 until(f,()=>c.slots[0].pulses>0,3);
 if(how==='modeRemove'){f.b.removeBuff(f.u,c.modeKey);assert.equal(c.mode,0);assert.equal(c.marks.size,0);return;}
 c.enterOverload();if(how==='overloadRemove')f.b.removeBuff(f.u,c.skillKey);assert.equal(c.hasOverload(),false);
 near(f.u.s.atk,f.record.stats.atk*(1+c.talent.atk));const n=f.attacks.length;advance(f.b,2);assert.ok(f.attacks.length>n);
});
for(const how of['mark','talent'])test(`Timeslot rejected ${how} resources cannot bypass the rejected parent`,()=>{
 const f=make({skill:2,defer:true}),c=f.controller;f.b.on('beforeBuff',x=>{if(x.buff.key===(how==='mark'?c.markKey:c.talentKey))x.cancel=true;});f.deploy();const t=target(f);born(f);cast(f);until(f,()=>c.slots[0].pulses>0,3);
 if(how==='mark'){assert.equal(c.marks.size,0);t.x=12;advance(f.b,.2);assert.equal(c.mode,2);}else{assert.equal(c.talentBuff,null);near(f.u.s.atk,f.record.stats.atk);}
});
for(const phase of['mode','overload','mark','rng'])test(`Timeslot source retirement during ${phase} attachment/output prevents later owned work`,()=>{
 const f=make({skill:2}),c=f.controller;target(f);born(f);
 if(phase==='rng')f.b.rng=()=>{f.b.retreat(f.u,{permanent:true});return 0;};else f.b.on('beforeBuff',x=>{if(x.buff.key==={mode:c.modeKey,overload:c.skillKey,mark:c.markKey}[phase])f.b.retreat(f.u,{permanent:true});});
 cast(f);if(phase==='overload')c.enterOverload();advance(f.b,3);assert.equal(c.stopped,true);assert.equal(c.handles.length,0);assert.equal(c.marks.size,0);assert.equal(f.u.findBuff(c.modeKey),null);assert.equal(f.u.findBuff(c.skillKey),null);
});
for(const dir of['UP','DOWN','LEFT','RIGHT'])test(`Timeslot ${dir} keeps literal original overload transitions and deployment-facing return`,()=>{
 const f=make({skill:2,dir});born(f);cast(f);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');f.controller.enterOverload();assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Overload_Begin');
 const duration=dir==='UP'?.8333333134651184:1;advance(f.b,duration-.1);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Overload_Begin');advance(f.b,.15);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Overload_Loop');
 f.u.skill.end('external');assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Overload_End');advance(f.b,.6);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');assert.equal(f.u.mem.regularVisualDirection,dir);
});
for(const skill of[1,2])test(`Timeslot S${skill} allows native cast during birth and silence without inventing an initial Begin`,()=>{
 const f=make({skill});f.b.addBuff(f.u,{key:'qa:silence',flags:{silence:true}});cast(f);assert.equal(f.u.mem.regularFormVisual.clip,'Start');target(f);advance(f.b,.9);assert.equal(f.attacks.length,0);
 advance(f.b,1);assert.ok(f.attacks.length>0);assert.notEqual(f.u.mem.regularFormVisual.clip,'Skill_2_Overload_Begin');
});
for(const skill of[1,2])test(`Timeslot S${skill} recovers natural SP, waits for manual input and holds active recovery`,()=>{
 const f=make({skill});advance(f.b,f.record.source.spData.spCost-f.record.source.spData.initSp+.1);assert.equal(f.u.skill.ready,true);assert.equal(f.u.skill.activations,0);assert.ok(f.u.skill.activate('manual'));
 f.u.skill.gainSp(10,'gift');near(f.u.skill.spTotal,0);advance(f.b,1);near(f.u.skill.spTotal,0);
});
test('Timeslot literal End edges do not invent an End when the skill is interrupted during overload Begin',()=>{
 const f=make({skill:2});born(f);cast(f);f.controller.enterOverload();f.u.skill.end('external');assert.equal(f.u.mem.regularFormVisual.clip,'Idle');
});
test('Timeslot battle finish removes born shots, locks, marks, stats, visuals and controller hooks',()=>{
 const f=make({skill:2}),c=f.controller;target(f);born(f);cast(f);until(f,()=>c.slots[0].target,3);assert.ok(f.b.projectiles.list.length>0);f.b.emit('battleEnd',{});
 assert.equal(c.stopped,true);assert.equal(c.handles.length,0);assert.equal(c.flights.size,0);assert.equal(c.marks.size,0);assert.ok(c.slots.every(s=>!s.target));assert.equal(f.u.findBuff(c.skillKey),null);assert.equal(f.u.findBuff(c.talentKey),null);assert.equal(f.u.mem.regularFormVisual,undefined);
 const n=f.hits.length;advance(f.b,3);assert.equal(f.hits.length,n);
});
test('Timeslot preparation rejects changed source stats, trait, selected ranks, talents and duplicate contracts',()=>{
 for(const mutate of[d=>d.stats.atk++,d=>d.traitBb.init_atk_scale++,d=>d.skill.bb.atk++,d=>d.talents[0].bb.prob=.5,d=>d.rangeGrid.push([9,9])])assert.throws(()=>make({mutate}));
 assert.throws(()=>make({contract:{}}));const f=make();assert.throws(()=>prepareTimeslot(f.b,f.u,{contract:TMSLOT_CONTRACT}));
});

test('Timeslot fractional native mark periods consume an exact fixed-tick boundary once',()=>{
 const f=make({skill:2});born(f);cast(f);advance(f.b,.1);assert.ok(f.controller.markAge<1e-7);
 advance(f.b,.1);assert.ok(f.controller.markAge<1e-7);
});
test('Timeslot overload reacquisition consumes an exact owner-interval boundary once',()=>{
 const f=make({skill:2});born(f);cast(f);f.controller.enterOverload();f.b.addBuff(f.u,{key:'qa:clock',mods:{aspd:-65}});near(f.controller.rate(),1);
 advance(f.b,1.3);assert.ok(f.controller.acquireAge<1e-7);advance(f.b,1.3);assert.ok(f.controller.acquireAge<1e-7);
});
test('Timeslot source mode removal during the first drone pulse stops later sibling output',()=>{
 const f=make({skill:2});target(f);born(f);cast(f);f.b.on('damaged',c=>{if(c.dmg.tags.includes('tmslot:S2Funnel_1'))f.b.removeBuff(f.u,f.controller.modeKey);});
 until(f,()=>out(f,'S2Funnel_1').length>0,3);assert.equal(out(f,'S2Funnel_2').length,0);assert.equal(f.controller.mode,0);assert.equal(f.controller.marks.size,0);
});
test('Timeslot beforeAttack vetoes and foreign substitutions cannot create flights or receipts',()=>{
 for(const how of['veto','empty','foreign','duplicate']){const f=make(),t=target(f),z=enemy(f,{x:15});
  f.b.on('beforeAttack',c=>{if(c.attacker!==f.u)return;if(how==='veto')c.cancel=true;else c.targets=how==='empty'?[]:how==='foreign'?[z]:[t,t];});advance(f.b,2);
  assert.equal(f.attacks.length,0);assert.equal(f.hits.length,0);assert.equal(f.controller.flights.size,0);
 }
});
