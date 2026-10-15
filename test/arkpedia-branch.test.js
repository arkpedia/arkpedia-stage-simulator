// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-native-operators/char_4207_branch.json' with { type:'json' };
import tier2 from '../server/sim/content/kits/tier2.js';
import { BRANCH_ID as ID, selectedBranchBuild, branchNativeInputs } from '../server/sim/content/arkpedia-branch-source.js';
import { make, enemy, cast, advance, until, near } from './helpers/branch-fixture.js';
test('Vetochki keeps complete original held source, native timing, targets and talent flags',()=>{
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);
 for(const key of ['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[key],false);
 assert.equal(e.source.bundles.length,5);assert.equal(Object.keys(e.templates).length,5);
 const n=branchNativeInputs();assert.equal(n.ordinary._maxAnimScale,1);assert.equal(n.modeAttack._selectTargetTiming,1);
 assert.equal(n.modeSelector._limitedMaxTargetNumToBlockedCnt,1);assert.equal(n.pulse._waitForAttackEvent,0);
 assert.equal(n.talent._ignoreHealFree,true);assert.equal(n.talent._skipModifierEvent,false);
 for(const face of ['Front','Back']){near(e.models[ID][face].eventPayloads.Skill_2_Begin[0].time,.6000000238418579);near(e.models[ID][face].eventPayloads.Skill_2_Loop[0].time,.800000011920929);}
});
for(const elite of [0,1,2])for(const potential of [1,6])test(`selected E${elite}/P${potential} preserves trust, potential and talent`,()=>{
 const f=make({elite,potential,trust:200}),r=selectedBranchBuild(f.build);assert.deepEqual(f.u.def.tags,r.tags);
 near(f.u.s.maxHp,r.stats.maxHp);near(f.u.s.atk,r.stats.atk);
 if(elite)near(r.talentBb[0].hp_ratio,(elite===1?.4:.5)+(potential===6?.1:0));else assert.deepEqual(r.talentBb,[]);
});
test('invalid, incomplete, locked and moduled source builds reject before installing',()=>{
 assert.throws(()=>make({contract:{}}));assert.throws(()=>make({elite:0,skill:2}));
 for(const mutate of [d=>d.stats.atk++,d=>d.skill.spCost++,d=>d.raw.arkpedia.module='mod-x',d=>d.tags=['invented']])assert.throws(()=>make({mutate}));
});
for(let rank=1;rank<=10;rank++)test(`S1/rank ${rank} reuses selected DEF and resistance and native heal-free-bypassing talent`,()=>{
 const f=make({rank}),{b,u,record:r}=f;advance(b,1.1);u.hp=100;
 b.addBuff(u,{key:'qa:heal-free',flags:{healFree:true}});cast(f);near(u.s.def,r.stats.def*(1+r.bb.def));near(b.resistOf(u),-r.bb.one_minus_status_resistance);
 until(f,()=>!u.skill.active,20);near(u.s.def,r.stats.def);near(b.resistOf(u),0);near(u.hp,100+u.s.maxHp*r.talentBb[0].hp_ratio);
 assert.equal(f.upstream.talents.length,1);assert.equal(typeof tier2.chess_char_2_17_a,'function');assert.deepEqual(b.errors,[]);
});
for(let rank=1;rank<=10;rank++)test(`S2/rank ${rank} reuses selected ATK/DEF while delaying ground-only Tremble to original Begin event`,()=>{
 const f=make({skill:2,rank}),{b,u,record:r}=f;const a=enemy(f),z=enemy(f,{col:4}),outside=enemy(f,{col:5}),air=enemy(f,{row:4,col:3,flying:true});
 advance(b,1.1);cast(f);const at=b.time;near(u.s.atk,r.stats.atk*(1+r.bb.atk));near(u.s.def,r.stats.def*(1+r.bb.def));
 advance(b,.55);assert.ok(!a.s.flags.tremble&&!z.s.flags.tremble);assert.equal(f.hits.length,0);
 until(f,()=>!!a.s.flags.tremble,1);near(b.time-at,.6,b.dt+1e-8);assert.ok(z.s.flags.tremble);assert.ok(!outside.s.flags.tremble&&!air.s.flags.tremble);
 assert.equal(f.hits.length,0);assert.equal(f.attacks.length,0);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');
 until(f,()=>f.hits.length>0,3);near(f.hits[0].time-at,1.8,b.dt*2);assert.deepEqual(b.errors,[]);
});
test('ordinary attacks hit only one target at the exact native event; high ASPD retains native max animation scale one',()=>{
 const f=make(),a=enemy(f),z=enemy(f);advance(f.b,1.1);until(f,()=>f.hits.length>0,2);
 assert.equal(f.hits.length,1);assert.ok([a,z].includes(f.hits[0].target));
 const g=make();enemy(g);g.b.addBuff(g.u,{key:'qa:fast',mods:{aspd:200}});advance(g.b,1.1);
 assert.equal(g.u.mem.regularFormVisual.speed,1);const p=g.controller.phase;near(p.releaseAt-(p.until-Math.max(g.u.s.interval,.7333333492279053)),.7333333492279053);
});
test('S2 retargets at strike and caps at current block capacity, including in-range enemies not actually blocked',()=>{
 const f=make({skill:2});advance(f.b,1.1);cast(f);advance(f.b,1.1);
 const targets=Array.from({length:5},()=>enemy(f,{flags:{unblockable:true}}));const cap=f.u.s.blockCnt;
 until(f,()=>f.hits.length>0,3);assert.equal(f.hits.length,cap);assert.ok(f.hits.every(h=>targets.includes(h.target)&&!h.target.blockedBy));
});
test('S2 initial pulse can run with no enemy and never infers damage',()=>{
 const f=make({skill:2});advance(f.b,1.1);cast(f);advance(f.b,1.2);
 assert.equal(f.controller.firstPending,false);assert.equal(f.hits.length,0);assert.equal(f.attacks.length,0);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Idle');
});
test('native transition mix plays only when leaving the S2 Idle/Loop family, without inventing a combat lock',()=>{
 const f=make({skill:2});advance(f.b,1.1);cast(f);advance(f.b,1.2);f.u.skill.end('test');
 assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');advance(f.b,.11);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');
 const g=make({skill:2});advance(g.b,1.1);cast(g);advance(g.b,.2);g.u.skill.end('test');assert.equal(g.u.mem.regularFormVisual.clip,'Idle');
});
test('stun before native pulse cancels unlaunched startup; recovery retries the still-pending first marker',()=>{
 const f=make({skill:2}),a=enemy(f);advance(f.b,1.1);cast(f);advance(f.b,.3);f.b.applyStatus(f.u,'stun',{duration:.2});advance(f.b,.25);
 assert.ok(!a.s.flags.tremble);assert.equal(f.controller.firstPending,true);until(f,()=>a.s.flags.tremble,2);assert.equal(f.hits.length,0);
});
test('retirement cancels pending pulse, leaves applied Tremble alive and never fires a stale talent heal',()=>{
 const f=make({skill:2}),a=enemy(f);advance(f.b,1.1);cast(f);advance(f.b,.3);f.b.retreat(f.u,{permanent:true});advance(f.b,1);
 assert.ok(!a.s.flags.tremble);assert.equal(f.controller.stopped,true);
 const g=make({skill:2}),z=enemy(g);advance(g.b,1.1);cast(g);until(g,()=>z.s.flags.tremble,1);const heals=g.heals.length;
 g.b.retreat(g.u,{permanent:true});advance(g.b,.5);assert.ok(z.s.flags.tremble);assert.equal(g.heals.length,heals);advance(g.b,g.record.bb.not_combat+.1);assert.ok(!z.s.flags.tremble);
});
test('S1 can activate during birth and while merely disarmed, but does not bypass stun',()=>{
 const f=make();f.b.addBuff(f.u,{key:'qa:disarm',flags:{disarm:true}});cast(f);assert.equal(f.u.skill.active,true);
 const g=make();g.b.applyStatus(g.u,'stun',{duration:1});g.u.skill.setSpTotal(g.u.skill.spCost);assert.equal(g.u.skill.activate(),false);
});

test('S1 defensive SP uses accepted damage, stays held during the timed effect and resumes after it',()=>{
 const f=make(),a=enemy(f,{col:6});advance(f.b,1.1);f.u.skill.setSpTotal(0);
 f.b.dealDamage(a,f.u,{amount:100,type:'true',isAttack:true});near(f.u.skill.spTotal,1);
 cast(f);const during=f.u.skill.spTotal;f.b.dealDamage(a,f.u,{amount:100,type:'true',isAttack:true});near(f.u.skill.spTotal,during);
 until(f,()=>!f.u.skill.active,20);const after=f.u.skill.spTotal;f.b.dealDamage(a,f.u,{amount:100,type:'true',isAttack:true});near(f.u.skill.spTotal,after+1);
});
test('S2 selects entrants at the native pulse event and honours Tremble immunity and resistance',()=>{
 const f=make({skill:2}),a=enemy(f,{col:4}),immune=enemy(f,{row:4,col:3}),resist=enemy(f,{row:2,col:3});
 immune.def={...immune.def,immune:new Set(['disarmedcombat'])};f.b.applyStatus(resist,'resist',{duration:20,value:.5});
 advance(f.b,1.1);cast(f);advance(f.b,.3);a.x=5;a.y=3;a.tileC=5;
 const entrant=enemy(f,{row:3,col:4});until(f,()=>entrant.s.flags.tremble,1);
 assert.ok(!a.s.flags.tremble&&!immune.s.flags.tremble);assert.ok(resist.s.flags.tremble);
 near(resist.findBuff('tremble').timeLeft,f.record.bb.not_combat/2,f.b.dt);
});
test('ordinary attacks keep captured inputs, while a dead input cannot hit its replacement life',()=>{
 const f=make(),a=enemy(f);advance(f.b,1.1);const p=f.controller.phase;assert.equal(p.kind,'attack');
 f.b.kill(a,f.u);const replacement=enemy(f);advance(f.b,Math.max(0,p.releaseAt-f.b.time)+.02);assert.equal(f.hits.length,0);assert.equal(replacement.hp,replacement.s.maxHp);
});
test('target replacement before an S2 strike uses the current block cap and excludes disappeared inputs',()=>{
 const f=make({skill:2});advance(f.b,1.1);cast(f);advance(f.b,1.1);const a=enemy(f,{flags:{unblockable:true}});
 until(f,()=>f.controller.phase?.kind==='attack',1);const phase=f.controller.phase;f.b.kill(a,f.u);
 const newcomers=[enemy(f,{flags:{unblockable:true}}),enemy(f,{flags:{unblockable:true}})];
 advance(f.b,phase.releaseAt-f.b.time+.05);assert.equal(f.hits.length,2);assert.deepEqual(new Set(f.hits.map(h=>h.target)),new Set(newcomers));
});
test('E0 has no skill-end heal and a battle end releases original upstream listener handles',()=>{
 const f=make({elite:0,rank:4});advance(f.b,1.1);f.u.hp=100;cast(f);until(f,()=>!f.u.skill.active,20);near(f.u.hp,100);
 const g=make();advance(g.b,1.1);g.b.forceEnd('cleared');assert.equal(g.controller.stopped,true);assert.equal(g.controller.handles.length,0);
});
test('an unrelated forced attack cannot bypass the selected controller native release',()=>{
 const f=make(),a=enemy(f);assert.equal(f.b.forceAttack(f.u,[a]),false);assert.equal(f.hits.length,0);assert.equal(f.attacks.length,0);
});

test('the reused S1 resistance remains source-owned and ends with its parent without erasing another producer',()=>{
 const f=make();advance(f.b,1.1);f.b.applyStatus(f.u,'resist',{duration:30,value:.7,key:'other:resist'});cast(f);
 assert.ok(f.u.findBuff(`branch:s1:resist:${f.u.id}`));near(f.b.resistOf(f.u),.7);
 f.u.skill.end('test-early-finish');assert.equal(f.u.findBuff(`branch:s1:resist:${f.u.id}`),null);near(f.b.resistOf(f.u),.7);
 assert.ok(f.u.findBuff('other:resist'));
});

test('a reused install requesting an unreviewed event rolls back all newly registered controller handles',()=>{
 const f=make({defer:true,install:false});f.upstream.talents=[{install:b=>b.on('unexpected',()=>{})}];
 assert.throws(()=>f.controller.install(),/Unreviewed upstream Vetochki listener/);
 assert.equal(f.controller.stopped,true);assert.equal(f.controller.handles.length,0);
});

test('the 0.1-second source End mix expires independently of a longer combat cooldown',()=>{
 const f=make({skill:2});advance(f.b,1.1);cast(f);advance(f.b,1.2);f.u.atkCd=.5;f.u.skill.end('test');
 assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');advance(f.b,.11);
 assert.equal(f.u.mem.regularFormVisual.clip,'Idle');assert.ok(f.u.atkCd>0);
});
