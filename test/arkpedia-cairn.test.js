// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,advance,until,cast,near} from './helpers/cairn-fixture.js';
const primary=f=>f.hits.filter(h=>h.type==='phys');
const dot=f=>f.hits.filter(h=>h.dmg.tags.includes('cairn:s2-dot'));
const freeEnemy=(f,opts)=>{const e=enemy(f,opts);f.b.addBuff(e,{key:'fixture:unblockable',flags:{unblockable:true}});return e;};
for(let rank=1;rank<=10;rank++)test(`Cairn S1/rank ${rank} enters native HP mode after Begin, lasts thirty seconds and uses one-target skill attacks`,()=>{
 const f=make({rank}),{b,u,controller:c}=f;const max=u.s.maxHp;u.hp=max*.6;
 for(let i=0;i<4;i++)freeEnemy(f);cast(f);assert.equal(u.mem.regularFormVisual.clip,'Skill_1_Begin');near(u.s.maxHp,max);
 advance(b,.3);near(u.s.maxHp,max);until(f,()=>c.mode===1,1);near(u.s.maxHp,max*(1+f.record.bb.max_hp));near(u.hp/u.s.maxHp,.6);
 until(f,()=>primary(f).length>0,2);assert.equal(primary(f).length,1);assert.equal(primary(f)[0].dmg.isSkill,true);assert.equal(u.stats.attacks,1);
 assert.equal(u.mem.regularFormVisual.clip,'Skill_1_Loop');near(primary(f)[0].amount,u.s.atk);
 until(f,()=>!u.skill.active,32);assert.equal(c.mode,0);near(u.s.maxHp,max);near(u.hp/u.s.maxHp,.6);near(b.time-u.skill.lastStart,30,b.dt*2);
});
for(let rank=1;rank<=10;rank++)test(`Cairn S2/rank ${rank} selects ground recipients at the marker and grants a finite shield without an attack receipt`,()=>{
 const f=make({skill:2,rank}),{b,u,controller:c}=f;const old=freeEnemy(f,{x:8}),ground=freeEnemy(f,{x:6}),fly=freeEnemy(f,{x:6,fly:true});
 cast(f);assert.equal(u.mem.regularFormVisual.clip,'Skill_2');assert.equal(u.findBuff(f.resources.shieldKey),null);
 advance(b,.5);assert.equal(ground.findBuff(f.resources.dotKey),null);assert.equal(u.stats.attacks,0);
 old.x=u.x-1;old.y=u.y;until(f,()=>c.phase?.released,1);
 assert.ok(ground.findBuff(f.resources.dotKey));assert.ok(old.findBuff(f.resources.dotKey));assert.equal(fly.findBuff(f.resources.dotKey),null);
 near(u.findBuff(f.resources.shieldKey).shield,u.s.maxHp*f.record.bb.shield_hp_ratio);assert.equal(u.stats.attacks,0);near(u.skill.spTotal,0);
 until(f,()=>!u.skill.active,2);assert.equal(c.phase,null);assert.ok(u.findBuff(f.resources.shieldKey));assert.ok(dot(f).length>=2);
 assert.equal(f.attacks.length,0);assert.equal(u.s.flags.noSp,undefined);
});
test('Cairn blocks three but each ordinary release has only one original input',()=>{
 const f=make(),foes=Array.from({length:4},()=>enemy(f));until(f,()=>primary(f).length>0,3);
 assert.equal(f.u.blocking.length,3);assert.equal(primary(f).length,1);assert.equal(f.attacks.length,1);assert.equal(f.attacks[0].targets.length,1);
 assert.ok(foes.includes(primary(f)[0].target));near(primary(f)[0].time,1+.6000000238418579,f.b.dt*2);
});
test('Cairn does not substitute a new enemy after the input target dies before its marker',()=>{
 const f=make({elite:0}),a=freeEnemy(f);until(f,()=>f.controller.phase?.kind==='attack',2);
 f.b.kill(a,null);const replacement=freeEnemy(f);advance(f.b,.7);assert.equal(primary(f).length,0);
 until(f,()=>primary(f).length>0,3);assert.equal(primary(f)[0].target,replacement);
});
test('Cairn source max animation speed is one; slowed attacks retain their full marker delay',()=>{
 for(const aspd of[300,-50]){const f=make({elite:0});freeEnemy(f);f.b.addBuff(f.u,{key:'qa:aspd',mods:{aspd}});
  until(f,()=>f.controller.phase?.kind==='attack',2);const p=f.controller.phase,speed=f.u.mem.regularFormVisual.speed;
  near(speed,aspd>0?1:.5);near(p.releaseAt-p.startedAt,.6000000238418579/speed);
  until(f,()=>primary(f).length>0,3);near(primary(f)[0].time,p.releaseAt,f.b.dt*2);
 }
});
test('Cairn S1 Begin cannot be skipped by a short control and keeps the HP modifier through later stun',()=>{
 const f=make(),{b,u,controller:c}=f,max=u.s.maxHp;cast(f);b.applyStatus(u,'stun',{duration:.2});advance(b,.2);assert.equal(c.mode,0);
 until(f,()=>c.mode===1,1);near(u.s.maxHp,max*(1+f.record.bb.max_hp));b.applyStatus(u,'stun',{duration:1});advance(b,.5);assert.equal(c.mode,1);
});
test('Cairn S1 finish clears HP mode, preserves ordinary cooldown and plays the native End',()=>{
 const f=make(),{b,u,controller:c}=f;freeEnemy(f);cast(f);until(f,()=>primary(f).length>0,3);
 const cd=u.atkCd;assert.ok(cd>0);u.skill.end('test');near(u.atkCd,cd);assert.equal(c.mode,0);assert.equal(u.mem.regularFormVisual.clip,'Skill_1_End');
 advance(b,.2);assert.equal(u.mem.regularFormVisual.clip,'Skill_1_End');advance(b,.2);assert.notEqual(u.mem.regularFormVisual.clip,'Skill_1_End');
});
for(const when of['before','after'])test(`Cairn control ${when} S2 marker cancels unreleased work but keeps accepted child effects`,()=>{
 const f=make({skill:2}),{b,u,controller:c}=f,t=freeEnemy(f,{x:6});cast(f);
 if(when==='after')until(f,()=>c.phase?.released,1);else advance(b,.2);
 b.applyStatus(u,'stun',{duration:.5});advance(b,.1);assert.equal(u.skill.active,false);assert.equal(c.phase,null);
 assert.equal(!!t.findBuff(f.resources.dotKey),when==='after');assert.equal(!!u.findBuff(f.resources.shieldKey),when==='after');
 advance(b,1.2);assert.equal(dot(f).length>0,when==='after');
});
test('Cairn S2 allows an empty ground release and resumes SP only after the source clip ends',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f;cast(f);advance(b,.7);assert.ok(u.findBuff(r.shieldKey));near(u.skill.spTotal,0);
 assert.equal(u.skill.active,true);until(f,()=>!u.skill.active,2);assert.equal(f.attacks.length,0);advance(b,.3);assert.ok(u.skill.spTotal>0);
});
test('Cairn S2 snapshots recipients and ATK at release, rather than at activation',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f,old=freeEnemy(f,{x:6});cast(f);advance(b,.3);
 old.x=9;const incoming=freeEnemy(f,{x:6});b.addBuff(u,{key:'qa:atk',mods:{atkPct:1}});const atk=u.s.atk;
 until(f,()=>incoming.findBuff(r.dotKey),1);assert.equal(old.findBuff(r.dotKey),null);b.removeBuff(u,'qa:atk');advance(b,1.1);
 near(dot(f)[0].amount,atk*f.record.bb.atk_scale);assert.equal(dot(f)[0].target,incoming);
});
for(const dir of['UP','DOWN','LEFT','RIGHT'])test(`Cairn ${dir} facing uses source model clocks and preserves the selected deployment direction`,()=>{
 const f=make({elite:0,dir});freeEnemy(f);until(f,()=>primary(f).length>0,3);
 assert.equal(f.u.mem.regularVisualDirection,dir);assert.equal(f.controller.model().exactDurations.Idle,dir==='UP'?1.3333333730697632:5.333333492279053);
 assert.equal(f.u.dir,dir);
});
test('Cairn ordinary controls cancel the pending marker and force a fresh post-control windup',()=>{
 const f=make({elite:0}),{b,u}=f;freeEnemy(f);until(f,()=>f.controller.phase?.kind==='attack',2);advance(b,.2);
 b.applyStatus(u,'stun',{duration:.2});advance(b,.2);assert.equal(primary(f).length,0);until(f,()=>primary(f).length>0,3);
 assert.ok(primary(f)[0].time>1.6);
});
test('Cairn retirement cancels pending cast/HP work and clears controller handles',()=>{
 for(const skill of[1,2]){const f=make({skill}),{b,u,controller:c,resources:r}=f;freeEnemy(f);cast(f);advance(b,.2);b.retreat(u,{permanent:true});advance(b,2);
  assert.equal(c.stopped,true);assert.equal(r.stopped,true);assert.equal(c.handles.length,0);assert.equal(r.handles.length,0);assert.equal(primary(f).length,0);
  assert.equal(u.findBuff(r.hpKey),null);assert.equal(u.findBuff(r.shieldKey),null);assert.equal(u.mem.regularFormVisual,undefined);
 }
});
test('Cairn accepted S2 effects survive later cast finish and source retreat',()=>{
 const f=make({skill:2}),{b,u,controller:c}=f,t=freeEnemy(f,{x:6});cast(f);until(f,()=>c.phase?.released,1);
 b.retreat(u,{permanent:true});advance(b,1.1);assert.equal(dot(f).length,1);assert.ok(t.findBuff(f.resources.dotKey));
});
test('Cairn externally forced attacks are refused and unsupported definitions fail before installation',()=>{
 const f=make(),t=freeEnemy(f);assert.equal(f.b.forceAttack(f.u,[t]),false);assert.equal(f.attacks.length,0);assert.equal(primary(f).length,0);
 assert.throws(()=>make({contract:{}}));for(const mutate of[d=>d.stats.atk++,d=>d.skill.spCost++,d=>d.skill.bb.max_hp++,d=>d.rangeGrid.push([1,0])])assert.throws(()=>make({mutate}));
});
for(const skill of[1,2])test(`Cairn S${skill} uses natural time SP and waits for manual activation`,()=>{
 const f=make({skill}),{b,u}=f;const delay=f.record.source.spData.spCost-f.record.source.spData.initSp;
 advance(b,delay+.1);assert.equal(u.skill.ready,true);assert.equal(u.skill.active,false);assert.equal(u.skill.activations,0);
 assert.equal(u.skill.activate('manual'),true);assert.equal(u.skill.activations,1);near(u.skill.spTotal,0);
 u.skill.gainSp(10,'gift');near(u.skill.spTotal,0);
});
test('Cairn mode/cast changes preserve a positive ordinary cooldown while discarding its unreleased marker',()=>{
 for(const skill of[1,2]){const f=make({skill}),{b,u,controller:c}=f;freeEnemy(f);until(f,()=>c.phase?.kind==='attack',2);
  const cd=u.atkCd;cast(f);near(u.atkCd,cd);advance(b,.7);assert.equal(primary(f).length,0);
  if(skill===1)assert.equal(c.mode,1);else assert.ok(u.findBuff(f.resources.shieldKey));
 }
});
test('Cairn an externally ended S2 before its marker never releases recipients or a shield',()=>{
 const f=make({skill:2}),{b,u}=f,t=freeEnemy(f,{x:6});cast(f);advance(b,.3);u.skill.end('external');advance(b,2);
 assert.equal(t.findBuff(f.resources.dotKey),null);assert.equal(u.findBuff(f.resources.shieldKey),null);assert.equal(dot(f).length,0);
});
test('Cairn a source removed during S2 attachment cannot attach later recipients or its shield',()=>{
 const f=make({skill:2}),{b,u}=f,first=freeEnemy(f,{x:6}),second=freeEnemy(f,{x:4});
 b.on('beforeBuff',c=>{if(c.unit===first&&c.buff.key===f.resources.dotKey)b.retreat(u,{permanent:true});});cast(f);advance(b,2);
 assert.equal(first.findBuff(f.resources.dotKey),null);assert.equal(second.findBuff(f.resources.dotKey),null);assert.equal(u.findBuff(f.resources.shieldKey),null);
 assert.equal(f.controller.stopped,true);assert.equal(f.resources.stopped,true);
});
test('Cairn rejected S1 mode buff leaves ordinary mode and no HP or skill-loop animation',()=>{
 const f=make(),{b,u,controller:c}=f,max=u.s.maxHp;b.on('beforeBuff',ctx=>{if(ctx.buff.key===f.resources.hpKey)ctx.cancel=true;});cast(f);advance(b,.5);
 assert.equal(c.mode,0);near(u.s.maxHp,max);assert.equal(u.mem.regularFormVisual.clip,'Idle');assert.equal(u.skill.active,true);
});
test('Cairn short control ending before the next engine tick still cancels an unfired S2 marker',()=>{
 const f=make({skill:2}),{b,u}=f,t=freeEnemy(f,{x:6});cast(f);advance(b,.2);b.applyStatus(u,'stun',{duration:b.dt/2});advance(b,.1);
 assert.equal(u.skill.active,false);advance(b,1);assert.equal(t.findBuff(f.resources.dotKey),null);assert.equal(u.findBuff(f.resources.shieldKey),null);
});
