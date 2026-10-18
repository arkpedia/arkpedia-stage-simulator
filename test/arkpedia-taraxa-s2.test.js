// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,ally,advance,until,near} from './helpers/taraxa-fixture.js';
import {prepareTaraxaS2,TARAXA_S2_CONTRACT,verifyTaraxaS2} from '../server/sim/content/arkpedia-taraxa-s2.js';
import {taraxaNativeInputs} from '../server/sim/content/arkpedia-taraxa-source.js';
function make(opts={}){
 const f=fixture({skill:2,...opts,prepare:(b,u)=>prepareTaraxaS2(b,u,{contract:TARAXA_S2_CONTRACT})});f.heals=[];f.receipts=[];
 f.b.on('calculatedHeal',h=>{if(h.source===f.u)f.heals.push({...h,time:f.b.time});});
 f.b.on('attack',h=>{if(h.attacker===f.u)f.receipts.push({...h,time:f.b.time});});return f;
}
function cast(f){f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('fixture'),true);}
const active=f=>until(f,()=>f.flight.mode===5),fired=f=>until(f,()=>f.payload.flights.size>0);
const hs=(f,kind)=>f.heals.filter(h=>h.opts.tags?.includes(`taraxa:s2-${kind}`));
test('Selected S2 composition rejects another skill, absent contracts and changed source controller inputs',()=>{
 verifyTaraxaS2();assert.throws(()=>fixture({skill:2,prepare:prepareTaraxaS2}),/exact contract/);
 assert.throws(()=>make({skill:1}),/selected Taraxacum S2/);
 const n=structuredClone(taraxaNativeInputs());n.modes[5].attack._affectedBySlowDown=1;assert.throws(()=>verifyTaraxaS2(n),/Changed original/);
});
for(const rank of[1,7,10])test(`S2 rank${rank} admits original ATK, .6-marker carrier and one native timed account`,()=>{
 const f=make({rank});ally(f);const base=f.u.s.atk;cast(f);assert.equal(f.flight.mode,4);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Begin');
 active(f);near(f.u.s.atk,base*(1+f.record.bb['attack@atk']));assert.equal(f.controller.phase.shot.isSkill,true);
 assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Loop');assert.equal(f.u.mem.regularFormVisual.loop,true);advance(f.b,.5);assert.equal(f.receipts.length,0);fired(f);
 assert.equal(f.receipts.length,1);assert.equal(f.receipts[0].isSkill,true);assert.equal(f.payload.flights.size,1);
 until(f,()=>hs(f,'primary').length>0);near(hs(f,'primary')[0].amount,f.u.s.atk*f.record.bb['attack@heal_scale']);
 assert.equal(f.u.skill.active,true);near(f.u.skill.duration,f.record.source.duration);near(f.u.skill.sp,0);
});
test('One original S2 receipt can release primary plus secondary while only its primary emits splash',()=>{
 const f=make(),air=ally(f,{flags:{liftoff:true},ratio:.2}),ground=ally(f,{col:7,ratio:.01});cast(f);fired(f);
 assert.equal(f.receipts.length,1);assert.equal(f.receipts[0].targets[0]?.id,air.id);assert.equal(f.payload.flights.size,2);
 until(f,()=>hs(f,'secondary').length>0);assert.equal(hs(f,'secondary')[0].target?.id,ground.id);assert.equal(f.receipts.length,1);
 until(f,()=>f.payload.flights.size===0);assert.ok(hs(f,'splash').length<=2);
});
test('Actual FLY movement alone cannot satisfy the source extra-heal condition',()=>{
 const f=make(),t=ally(f,{motion:'FLY',ratio:.1});ally(f,{col:7,ratio:.3});cast(f);fired(f);assert.equal(f.receipts[0].targets[0]?.id,t.id);
 assert.equal([...f.payload.flights.values()].filter(p=>p.kind==='secondary').length,0);
});
test('A no-target S2 activation takes off, admits attributes and holds its account without creating an attack',()=>{
 const f=make();cast(f);active(f);advance(f.b,3);assert.equal(f.u.skill.active,true);assert.equal(f.receipts.length,0);
 assert.equal(f.payload.flights.size,0);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Idle');assert.equal(f.u.mem.regularDeathVisual.clip,'Skill_Die');near(f.u.skill.sp,0);
});
test('S2 displays original Idle after the 1.5-second Loop finishes while its 2.85 cooldown remains positive',()=>{
 const f=make();ally(f);cast(f);active(f);const start=f.controller.phase.lastAt;
 until(f,()=>f.b.time-start>1.55);assert.ok(f.u.atkCd>0);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Idle');assert.equal(f.u.mem.regularFormVisual.loop,true);
});
test('Fast ASPD uses the native maximum animation scale and does not release before the .6 marker',()=>{
 const f=make();ally(f);f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd:100}});cast(f);active(f);
 near(f.controller.phase.speed,1);near(f.controller.phase.untilAge,1.425);advance(f.b,.5);assert.equal(f.receipts.length,0);fired(f);
});
test('Slow attack stats are sampled once and do not additionally multiply the already sampled clock by slowdown',()=>{
 const f=make();ally(f);f.b.addBuff(f.u,{key:'fixture:slow',mods:{aspd:-50,slowDownMul:.1}});cast(f);active(f);
 near(f.controller.phase.speed,.5);advance(f.b,1);assert.equal(f.receipts.length,0);fired(f);assert.equal(f.receipts.length,1);
});
test('A temporary control cancels the unborn S2 receipt and preserves the active timed account/cooldown',()=>{
 const f=make();ally(f);cast(f);active(f);advance(f.b,.1);f.b.applyStatus(f.u,'stun',{duration:.001});advance(f.b,.8);
 assert.equal(f.receipts.length,0);assert.equal(f.payload.flights.size,0);assert.ok(f.u.atkCd>0);assert.equal(f.u.skill.active,true);near(f.u.skill.sp,0);
});
test('S2 retains its primary input through windup rather than replacing it with a newly injured lower-ratio ally',()=>{
 const f=make(),a=ally(f);cast(f);active(f);a.hp=a.s.maxHp;const b=ally(f,{col:7,ratio:.01});fired(f);
 assert.equal(f.receipts[0].targets[0]?.id,a.id);until(f,()=>hs(f,'primary').length>0);assert.equal(hs(f,'primary')[0].target?.id,a.id);assert.ok(b.hp>=100);
});
test('Primary landing before the marker disables only the extra heal, preserving the retained primary',()=>{
 const f=make(),a=ally(f,{flags:{liftoff:true}});ally(f,{col:7});cast(f);active(f);f.b.removeBuff(a,'fixture:flags');fired(f);
 assert.equal(f.receipts[0].targets[0]?.id,a.id);assert.equal([...f.payload.flights.values()].filter(p=>p.kind==='secondary').length,0);
});
test('Second recipient is chosen at source release and can differ from its acquisition-time lowest ally',()=>{
 const f=make(),a=ally(f,{flags:{liftoff:true},ratio:.2}),b=ally(f,{col:7,ratio:.1}),c=ally(f,{row:6,col:6,ratio:.3});cast(f);active(f);
 b.hp=b.s.maxHp;c.hp=1;fired(f);const record=[...f.payload.flights.values()].find(p=>p.kind==='secondary');assert.equal(record.target?.id,c.id);assert.equal(f.receipts[0].targets[0]?.id,a.id);
});
test('Rejected mode keeps ordinary healing/receipt identity and grants neither ATK nor airborne state',()=>{
 const f=make();ally(f);const atk=f.u.s.atk;f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa_s2[mode]:'))c.cancel=true;});cast(f);advance(f.b,3);
 near(f.u.s.atk,atk);assert.equal(f.flight.mode,0);assert.ok(f.heals.length>0);assert.ok(f.receipts.every(h=>h.isSkill===false));assert.equal(f.payload.flights.size,0);
});
test('Rejected ATK buff retains the selected primary/secondary heal mode without its additive ATK gain',()=>{
 const f=make();ally(f,{flags:{liftoff:true}});ally(f,{col:7});const atk=f.u.s.atk;
 f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa_s2[atk]:'))c.cancel=true;});cast(f);active(f);near(f.u.s.atk,atk);fired(f);assert.equal(f.payload.flights.size,2);
});
test('Rejected or dispelled second-heal passive retains ATK and the primary/splash ability',()=>{
 const f=make();ally(f,{flags:{liftoff:true}});ally(f,{col:7});const atk=f.u.s.atk;
 f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa_s2[second_heal]:'))c.cancel=true;});cast(f);active(f);near(f.u.s.atk,atk*2.2);fired(f);
 assert.equal([...f.payload.flights.values()].filter(p=>p.kind==='secondary').length,0);until(f,()=>hs(f,'splash').length>0);
});
test('Dispelling mode clears owned ATK/passive resources and starts End while its account remains held',()=>{
 const f=make();cast(f);active(f);const atk=f.u.base.atk;f.b.removeBuff(f.u,f.controller.modeBuff);
 assert.equal(f.flight.mode,6);near(f.u.s.atk,atk);assert.equal(f.controller.atkBuff,null);assert.equal(f.controller.secondaryBuff,null);
 advance(f.b,1.1);assert.equal(f.flight.mode,0);assert.equal(f.u.skill.active,true);near(f.u.skill.sp,0);
});
test('Account ending before release cancels unfired work while original End retains flight until completion',()=>{
 const f=make();ally(f);cast(f);active(f);f.u.skill.end('fixture');assert.equal(f.flight.mode,6);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');
 advance(f.b,.8);assert.equal(f.receipts.length,0);assert.equal(f.u.s.flags.liftoff,true);assert.ok(f.u.skill.sp>0);
 advance(f.b,.3);assert.equal(f.flight.mode,0);assert.equal(!!f.u.s.flags.liftoff,false);
});
test('A born S2 carrier uses live ordinary ATK after its source account/ATK mode ends',()=>{
 const f=make();ally(f);cast(f);fired(f);f.u.skill.end('fixture');until(f,()=>hs(f,'primary').length>0);
 near(hs(f,'primary')[0].amount,f.u.s.atk);assert.equal(f.flight.mode,6);
});
test('Source retreat retains born S2 primary/splash work with original boosted launch attributes',()=>{
 const f=make(),t=ally(f);ally(f,{col:7,ratio:.3});cast(f);fired(f);const atk=f.u.s.atk;f.b.retreat(f.u);f.u.base.atk=99999;f.u.markDirty();
 until(f,()=>hs(f,'primary').length>0);near(hs(f,'primary')[0].amount,atk);assert.equal(hs(f,'primary')[0].target?.id,t.id);
 until(f,()=>f.payload.flights.size===0);assert.equal(f.payload.watchers.length,0);assert.equal(f.controller.handles.length,0);assert.equal(f.flight.handles.length,0);assert.equal(f.aura.handles.length,0);
});
test('An external primary-heal callback ending the skill cannot erase or upgrade its already-born splash payload',()=>{
 const f=make(),t=ally(f);ally(f,{col:7,ratio:.3});cast(f);fired(f);
 f.b.on('heal',h=>{if(h.opts.tags.includes('taraxa:s2-primary'))f.u.skill.end('fixture');});until(f,()=>f.payload.flights.size===0);
 assert.equal(hs(f,'primary')[0].target?.id,t.id);assert.equal(f.flight.mode,6);assert.ok(hs(f,'splash').length>0);
 for(const h of hs(f,'splash'))near(h.amount,f.u.s.atk*.5);
});
test('Before-attack veto cannot emit main, extra, splash or an accepted receipt',()=>{
 const f=make();ally(f,{flags:{liftoff:true}});ally(f,{col:7});f.b.on('beforeAttack',h=>{if(h.attacker===f.u)h.targets=[];});cast(f);advance(f.b,3);
 assert.equal(f.receipts.length,0);assert.equal(f.heals.length,0);assert.equal(f.payload.flights.size,0);
});
test('Recursive forced attacks cannot duplicate the one retained S2 receipt or secondary',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});ally(f,{col:7});f.b.on('beforeAttack',h=>{if(h.attacker===f.u)f.b.forceAttack(f.u,[t]);});cast(f);fired(f);
 assert.equal(f.receipts.length,1);assert.equal(f.payload.flights.size,2);
});
test('Primary life replacement before release does not become a new source skill input',()=>{
 const f=make(),t=ally(f);cast(f);active(f);t.deploySeq++;advance(f.b,1);assert.equal(f.receipts.length,0);assert.equal(f.payload.flights.size,0);
});
for(const key of['taraxa_s2[mode]:','taraxa_s2[atk]:','taraxa_s2[second_heal]:'])test(`Retreat inside ${key} admission removes all late source resources`,()=>{
 const f=make();ally(f);let once=false;f.b.on('beforeBuff',c=>{if(!once&&c.buff.key.startsWith(key)){once=true;f.b.retreat(f.u);}});cast(f);advance(f.b,1.2);
 assert.ok(once);assert.equal(f.controller.stopped,true);assert.equal(f.u.buffs.filter(b=>b.key.startsWith('taraxa')).length,0);
 for(const c of[f.controller,f.flight,f.aura])assert.equal(c.handles.length,0);
});
test('A prematurely finished mode admission cannot retain its late source buff or start flight',()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa_s2[mode]:'))c.buff.onRemove();});cast(f);advance(f.b,1.1);
 assert.equal(f.flight.mode,0);assert.equal(f.controller.modeBuff,null);assert.ok(!f.u.buffs.some(b=>b.key.startsWith('taraxa_s2[mode]:')));
});
for(const dir of['LEFT','UP','DOWN'])test(`S2 ${dir} uses source-selected original direction and height through its heal clip`,()=>{
 const f=make({dir}),t=ally(f,{row:dir==='UP'?6:dir==='DOWN'?4:5,col:dir==='LEFT'?4:5});cast(f);fired(f);
 assert.equal(f.u.mem.regularVisualDirection,dir);near(f.flight.heightNow(),.4);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Loop');
 until(f,()=>hs(f,'primary').length>0);assert.equal(hs(f,'primary')[0].target?.id,t.id);
});
test('Natural source-duration expiry clears mode resources and eventually resumes normal grounded healing',()=>{
 const f=make();ally(f);cast(f);advance(f.b,f.record.source.duration+.01);assert.equal(f.u.skill.active,false);assert.equal(f.flight.mode,6);
 advance(f.b,1.1);assert.equal(f.flight.mode,0);assert.equal(f.controller.atkBuff,null);assert.equal(f.controller.secondaryBuff,null);assert.ok(f.u.skill.sp>0);
});
test('Source hidden state suspends new healing without retiring the same-life timed account',()=>{
 const f=make();ally(f);cast(f);active(f);f.u.hidden=true;advance(f.b,2);assert.equal(f.receipts.length,0);
 assert.equal(f.controller.stopped,false);f.u.hidden=false;fired(f);assert.equal(f.receipts.length,1);
});
test('Battle end drains source components, ordinary transport and every born S2 payload',()=>{
 const f=make();ally(f);cast(f);fired(f);f.b.finished=true;f.b.emit('battleEnd',{});
 assert.equal(f.payload.flights.size,0);assert.equal(f.payload.watchers.length,0);assert.equal(f.controller.flights.size,0);
 assert.ok(!f.u.buffs.some(b=>b.key.startsWith('taraxa')));for(const c of[f.controller,f.flight,f.aura])assert.equal(c.handles.length,0);
});

test('E1 S2 uses selected promotion/potential/trust attributes and its original E1 aura coefficient',()=>{
 const f=make({elite:1,rank:7,potential:5,trust:200});ally(f);const atk=f.u.s.atk;cast(f);active(f);
 near(f.u.s.atk,atk*(1+f.record.bb['attack@atk']));near(f.u.s.physTakenMul,.91);until(f,()=>hs(f,'primary').length>0);
 near(hs(f,'primary')[0].amount,f.u.s.atk*f.record.bb['attack@heal_scale']);
});
test('Original time SP reaches S2 readiness naturally without automatic activation',()=>{
 const f=make();ally(f);assert.equal(f.u.skill.ready,false);until(f,()=>f.u.skill.ready);
 assert.equal(f.u.skill.active,false);assert.equal(f.flight.mode,0);near(f.b.time,f.u.skill.spCost-f.u.skill.initSp,.04);
 assert.equal(f.u.skill.activate('fixture'),true);assert.equal(f.flight.mode,4);
});
