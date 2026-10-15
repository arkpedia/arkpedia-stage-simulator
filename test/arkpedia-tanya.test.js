// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,advance,until,cast,near} from './helpers/tanya-fixture.js';
const primary=f=>f.hits.filter(h=>h.type==='phys');
const freeEnemy=(f,opts)=>{const e=enemy(f,opts);f.b.addBuff(e,{key:'fixture:unblockable',flags:{unblockable:true}});return e;};
const slow=f=>f.b.addBuff(f.u,{key:'qa:native-slow-down',data:{nativeSlowDown:{increment:.5,maxStrength:.5}}});
const hurt=(f,amount=10)=>f.b.dealDamage(null,f.u,{amount,type:'true',canDodge:false});
for(let rank=1;rank<=10;rank++)test(`Crackborne S1/rank ${rank} attaches HP immediately, recovers on world seconds and keeps one-target source attacks`,()=>{
 const f=make({rank}),{b,u,controller:c,resources:r}=f,max=u.s.maxHp;for(const el of Object.keys(u.elem))u.elem[el]=500;u.hp=max*.6;
 for(let n=0;n<4;n++)freeEnemy(f);cast(f);near(u.s.maxHp,max*(1+f.record.bb.max_hp));near(u.hp/u.s.maxHp,.6);assert.equal(u.mem.regularFormVisual.clip,'Skill_1_Begin');
 advance(b,.3);assert.equal(primary(f).length,0);assert.equal(r.s1Ticks,0);until(f,()=>primary(f).length>0,2);
 assert.equal(primary(f).length,1);assert.equal(primary(f)[0].dmg.isSkill,true);assert.equal(u.stats.attacks,1);assert.equal(u.mem.regularFormVisual.clip,'Skill_1_Loop');
 until(f,()=>r.s1Ticks>=1,1);near(u.elem.burn,Math.max(0,500-f.record.bb.ep_heal));
 until(f,()=>!u.skill.active,22);assert.equal(c.mode,0);near(u.s.maxHp,max);near(u.hp/u.s.maxHp,.6);assert.equal(r.s1Ticks,20);near(b.time-u.skill.lastStart,20,b.dt*2);
});
for(let rank=1;rank<=10;rank++)test(`Crackborne S2/rank ${rank} grants permanent capped stacks at the fixed native marker without attacking`,()=>{
 const f=make({skill:2,rank}),{b,u,controller:c,resources:r}=f,base=u.s.def;cast(f);assert.equal(u.mem.regularFormVisual.clip,'Skill_2');assert.equal(r.stacks(),0);
 advance(b,.6);assert.equal(r.stacks(),0);until(f,()=>c.phase?.released,1);assert.equal(r.stacks(),5);near(u.s.def,base*(1+5*f.record.bb.def));near(u.skill.spTotal,0);
 assert.equal(u.stats.attacks,0);until(f,()=>!u.skill.active,2);assert.equal(r.stacks(),5);advance(b,5);assert.equal(r.stacks(),5);assert.ok(u.skill.spTotal>0);
});
test('Crackborne ordinary attempts alternate the two retained native clips with one input and one receipt each',()=>{
 const f=make({elite:0}),{b,u,controller:c}=f;Array.from({length:4},()=>freeEnemy(f));let rng=0;b.rng=()=>{rng++;return .5;};
 until(f,()=>primary(f).length>0,3);assert.equal(u.mem.regularFormVisual.clip,'Attack_1');assert.equal(primary(f).length,1);near(primary(f)[0].time,1+.5666666626930237,b.dt*2);
 until(f,()=>primary(f).length>1,3);assert.equal(u.mem.regularFormVisual.clip,'Attack_2');assert.equal(u.stats.attacks,2);assert.equal(c.ordinaryIndex,2);assert.equal(rng,0);
});
test('Crackborne blocks three while its ordinary input remains single-target',()=>{
 const f=make();Array.from({length:4},()=>enemy(f));until(f,()=>primary(f).length>0,3);assert.equal(f.u.blocking.length,3);assert.equal(primary(f).length,1);assert.equal(f.attacks[0].targets.length,1);
});
for(const aspd of[-50,0,300])test(`Crackborne S2 ignores ${aspd} ASPD for its fixed marker and finish clocks`,()=>{
 const f=make({skill:2}),{b,u,controller:c}=f;b.addBuff(u,{key:'qa:aspd',mods:{aspd}});cast(f);until(f,()=>c.phase?.released,2);
 near(b.time,.6666666865348816,b.dt*2);near(u.mem.regularFormVisual.speed,1);until(f,()=>!u.skill.active,2);near(b.time,1.600000023841858,b.dt*2);
});
test('Crackborne S2 opts into native slow_down once, without doubling its ASPD effect',()=>{
 const f=make({skill:2}),{b,u,controller:c}=f;slow(f);near(u.s.slowDownRate,.5);cast(f);assert.equal(u.mem.regularFormVisual.speed,.5);
 until(f,()=>c.phase?.released,3);near(b.time,.6666666865348816/.5,b.dt*2);until(f,()=>!u.skill.active,3);near(b.time,1.600000023841858/.5,b.dt*2);
});
test('Crackborne changing slow_down mid-cast updates elapsed time and playback without restarting the clip',()=>{
 const f=make({skill:2}),{b,u,controller:c}=f;cast(f);advance(b,.4);const play=u.mem.regularFormVisual.playId;slow(f);advance(b,.1);
 assert.equal(u.mem.regularFormVisual.playId,play);assert.equal(u.mem.regularFormVisual.speed,.5);until(f,()=>c.phase?.released,2);near(b.time,.4+(.6666666865348816-.4)/.5,b.dt*3);
});
test('Crackborne S1 recovery and account remain on world time under native slow_down',()=>{
 const f=make(),{b,u,resources:r}=f;slow(f);u.elem.burn=700;cast(f);advance(b,1.1);assert.equal(r.s1Ticks,1);near(u.elem.burn,700-f.record.bb.ep_heal);
 until(f,()=>!u.skill.active,21);assert.equal(r.s1Ticks,20);near(b.time,20,b.dt*2);
});
test('Crackborne preserves cooldown while mode/cast changes discard unreleased normal attacks',()=>{
 for(const skill of[1,2]){const f=make({skill}),{b,u,controller:c}=f;freeEnemy(f);until(f,()=>c.phase?.kind==='attack',2);const cd=u.atkCd;cast(f);near(u.atkCd,cd);advance(b,.8);assert.equal(primary(f).length,0);}
});
test('Crackborne S1 natural End clears HP and returns to idle without resetting ordinary cooldown',()=>{
 const f=make(),{b,u}=f;freeEnemy(f);cast(f);until(f,()=>primary(f).length>0,3);const cd=u.atkCd;u.skill.end('external');near(u.atkCd,cd);assert.equal(u.mem.regularFormVisual.clip,'Skill_1_End');advance(b,.3);assert.notEqual(u.mem.regularFormVisual.clip,'Skill_1_End');
});
for(const when of['before','after'])test(`Crackborne control ${when} S2 marker cancels future grant but preserves accepted stacks`,()=>{
 const f=make({skill:2}),{b,u,controller:c,resources:r}=f;cast(f);if(when==='after')until(f,()=>c.phase?.released,2);else advance(b,.2);
 b.applyStatus(u,'stun',{duration:.5});advance(b,.1);assert.equal(u.skill.active,false);assert.equal(r.stacks(),when==='after'?5:0);advance(b,2);assert.equal(r.stacks(),when==='after'?5:0);
});
test('Crackborne self S2 may cast while already disarmed, while a new short control epoch cancels it',()=>{
 const f=make({skill:2});f.b.addBuff(f.u,{key:'qa:disarm',flags:{disarm:true}});cast(f);until(f,()=>f.resources.stacks()===5,2);
 const g=make({skill:2});cast(g);advance(g.b,.2);g.b.applyStatus(g.u,'stun',{duration:g.b.dt/2});advance(g.b,.1);assert.equal(g.u.skill.active,false);advance(g.b,2);assert.equal(g.resources.stacks(),0);
});
test('Crackborne a later interrupted cast keeps stacks from an earlier completed activation',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f;cast(f);until(f,()=>!u.skill.active,2);hurt(f);assert.equal(r.stacks(),4);cast(f);advance(b,.2);u.skill.end('external');advance(b,2);assert.equal(r.stacks(),4);
});
test('Crackborne HP-loss response spends permanent stacks after skill finish, without another attack receipt',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f,t=freeEnemy(f,{x:6});cast(f);until(f,()=>!u.skill.active,2);const attacks=f.attacks.length;hurt(f);
 assert.equal(r.stacks(),4);near(t.elem.erosion,u.s.atk*f.record.bb.ep_damage_ratio);assert.equal(f.attacks.length,attacks);
});
test('Crackborne the old attack input is never replaced after target death before the release marker',()=>{
 const f=make({elite:0}),a=freeEnemy(f);until(f,()=>f.controller.phase?.kind==='attack',2);f.b.kill(a,null);const z=freeEnemy(f);advance(f.b,.7);assert.equal(primary(f).length,0);
 until(f,()=>primary(f).length>0,3);assert.equal(primary(f)[0].target,z);
});
for(const skill of[1,2])test(`Crackborne S${skill} uses natural time SP and waits for a public/manual request`,()=>{
 const f=make({skill}),{b,u}=f;advance(b,f.record.source.spData.spCost-f.record.source.spData.initSp+.1);assert.equal(u.skill.ready,true);assert.equal(u.skill.activations,0);
 assert.equal(u.skill.activate('manual'),true);u.skill.gainSp(10,'gift');near(u.skill.spTotal,0);
});
for(const dir of['UP','DOWN','LEFT','RIGHT'])test(`Crackborne ${dir} uses matching original clocks and keeps its deployment facing`,()=>{
 const f=make({dir,elite:0});freeEnemy(f);until(f,()=>primary(f).length>0,3);assert.equal(f.u.mem.regularVisualDirection,dir);assert.equal(f.controller.model().exactDurations.Die,dir==='UP'?undefined:1);assert.equal(f.u.dir,dir);
});
test('Crackborne retreat cancels cast work, permanent stacks, recovery, protection and owner handles',()=>{
 for(const skill of[1,2]){const f=make({skill}),{b,u,resources:r,controller:c}=f;cast(f);if(skill===2)until(f,()=>r.stacks()===5,2);else advance(b,.2);
  b.retreat(u,{permanent:true});advance(b,2);assert.equal(c.stopped,true);assert.equal(r.stopped,true);assert.equal(c.handles.length,0);assert.equal(r.handles.length,0);assert.equal(r.stacks(),0);assert.equal(u.findBuff(r.hpKey),null);assert.equal(u.mem.regularFormVisual,undefined);}
});
test('Crackborne rejected or reentrant cast attachments cannot create skill-mode or permanent effects',()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(c.buff.key===f.resources.hpKey)c.cancel=true;});cast(f);assert.equal(f.controller.mode,0);near(f.u.s.maxHp,f.record.stats.maxHp);advance(f.b,.5);
 const g=make({skill:2});g.b.on('beforeBuff',c=>{if(c.buff.key===g.resources.stackKey)g.b.retreat(g.u,{permanent:true});});cast(g);advance(g.b,2);assert.equal(g.resources.stacks(),0);assert.equal(g.controller.stopped,true);
});
test('Crackborne source controller rejects external force attacks and changed build definitions',()=>{
 const f=make(),t=freeEnemy(f);assert.equal(f.b.forceAttack(f.u,[t]),false);assert.equal(f.attacks.length,0);assert.throws(()=>make({contract:{}}));
 for(const mutate of[d=>d.stats.atk++,d=>d.skill.spCost++,d=>d.skill.bb.max_hp++,d=>d.rangeGrid.push([1,0])])assert.throws(()=>make({mutate}));
});
