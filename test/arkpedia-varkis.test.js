// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { make, enemy, advance, until, cast, near } from './helpers/varkis-fixture.js';
for(let rank=1;rank<=10;rank++)test(`S1/rank ${rank} uses three original events with one attack receipt and held offensive SP`,()=>{
 const f=make({rank}),a=enemy(f);advance(f.b,1.1);f.u.skill.setSpTotal(f.u.skill.spCost);
 until(f,()=>f.controller.phase?.s1&&f.controller.phase.index===0,4);
 const p=f.controller.phase,at=f.b.time,attacks=f.u.stats.attacks,hits=f.hits.length;
 advance(f.b,p.events[0]-at-.04);assert.equal(f.hits.length,hits);
 until(f,()=>f.hits.length>hits,1);assert.equal(f.hits.length,hits+1);assert.equal(f.u.skill.active,true);near(f.u.skill.spTotal,0);
 until(f,()=>f.hits.length>=hits+3,1);assert.equal(f.u.stats.attacks,attacks+1);assert.equal(f.u.skill.active,false);
 assert.equal(new Set(f.hits.slice(hits).map(h=>h.dmg.attackId)).size,1);
 near(f.hits[hits].time-p.events[0],0,f.b.dt);near(f.hits[hits+2].time-f.hits[hits].time,2/30,f.b.dt);
 for(const h of f.hits.slice(hits,hits+3))near(h.amount,f.u.s.atk*f.record.bb.atk_scale*1.1);
 assert.equal(f.attacks.filter(h=>h.isSkill).length,1);assert.ok(a.alive);
});
for(let rank=1;rank<=10;rank++)test(`S2/rank ${rank} binds Begin, block-capped strikes, one self-heal per attack and retained barrier`,()=>{
 const f=make({skill:2,rank}),{b,u,controller:c}=f;
 const foes=Array.from({length:5},()=>enemy(f,{flags:{unblockable:true}}));advance(b,1.1);u.hp=u.s.maxHp;
 const hits=f.hits.length,heals=f.heals.length;cast(f);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');assert.equal(c.resources.mode,0);
 advance(b,.3);assert.equal(f.hits.length,hits);assert.equal(c.resources.mode,0);
 until(f,()=>c.resources.mode===1,1);until(f,()=>f.hits.length>hits,3);
 assert.equal(f.hits.length-hits,u.s.blockCnt);assert.equal(f.heals.length-heals,1);
 near(f.heals.at(-1).amount,u.s.maxHp*f.record.bb['attack@hp_ratio']);
 near(u.findBuff(c.resources.key).shield,f.heals.at(-1).amount);
 for(const h of f.hits.slice(hits)) {assert.ok(foes.includes(h.target));near(h.amount,u.s.atk*f.record.bb['attack@s2_atk_scale']*1.1);}
 u.skill.end('test');assert.equal(c.resources.mode,0);assert.ok(u.findBuff(c.resources.key).shield>0);
});
test('ordinary native release targets at most current block count, including unblocked legal inputs',()=>{
 const f=make({elite:0});Array.from({length:5},()=>enemy(f,{flags:{unblockable:true}}));
 until(f,()=>f.hits.length>0,4);assert.equal(f.hits.length,2);assert.ok(f.hits.every(h=>!h.target.blockedBy));
 near(f.hits[0].amount,f.u.s.atk);assert.equal(f.u.stats.attacks,1);near(f.hits[0].time,1+.5666666626930237,f.b.dt*2);
});
test('native zero-block fallback retains one target and high ASPD cannot exceed animation speed one',()=>{
 const f=make();Array.from({length:3},()=>enemy(f));f.b.addBuff(f.u,{key:'qa:block-zero',mods:{blockCntMul:0}});
 until(f,()=>f.hits.length>0,3);assert.equal(f.hits.length,1);
 f.b.removeBuff(f.u,'qa:block-zero');f.b.addBuff(f.u,{key:'qa:fast',mods:{aspd:300}});const count=f.hits.length;until(f,()=>f.hits.length>count,2);
 assert.equal(f.u.mem.regularFormVisual.speed,1);assert.ok(f.controller.phase.until-f.controller.phase.events[0] >= -1e-6);
});
test('S1 holds original input lives and never replaces a killed recipient between markers',()=>{
 const f=make();const first=enemy(f);advance(f.b,1.1);f.u.skill.setSpTotal(f.u.skill.spCost);
 until(f,()=>f.controller.phase?.s1&&f.controller.phase.index===0,4);first.hp=100;const start=f.hits.length;
 until(f,()=>!first.alive,1);const replacement=enemy(f);advance(f.b,.12);
 assert.equal(f.hits.slice(start).filter(h=>h.target===replacement).length,0);assert.equal(f.u.skill.active,false);
});
test('all dead inputs before S1 release refund its charge without attacking a replacement',()=>{
 const f=make();let a=enemy(f);advance(f.b,1.1);f.u.skill.setSpTotal(f.u.skill.spCost);
 until(f,()=>f.controller.phase?.s1&&f.controller.phase.index===0,4);f.b.kill(a,null);a=enemy(f);
 const hits=f.hits.length;advance(f.b,.6);assert.equal(f.hits.length,hits);assert.equal(f.u.skill.active,false);near(f.u.skill.spTotal,f.u.skill.spCost);
});
test('stun cancels unreleased S1 markers; recovery creates a fresh ordinary attack',()=>{
 const f=make();enemy(f);advance(f.b,1.1);f.u.skill.setSpTotal(f.u.skill.spCost);
 until(f,()=>f.controller.phase?.s1&&f.controller.phase.index===0,4);const hits=f.hits.length;
 f.b.applyStatus(f.u,'stun',{duration:.5});advance(f.b,.5);assert.equal(f.hits.length,hits);assert.equal(f.u.skill.active,false);
 until(f,()=>f.hits.length>hits,3);assert.equal(f.hits.at(-1).dmg.isSkill,false);
});
test('external S1 finish at its first damage event cancels remaining markers and recipients',()=>{
 const f=make();Array.from({length:3},()=>enemy(f));advance(f.b,1.1);f.u.skill.setSpTotal(f.u.skill.spCost);
 until(f,()=>f.controller.phase?.s1&&f.controller.phase.index===0,4);const start=f.hits.length;
 const hook=f.b.on('damaged',c=>{if(c.source===f.u&&c.dmg.isSkill)f.u.skill.end('external-interrupt');});
 advance(f.b,.7);assert.equal(f.hits.length-start,1);assert.equal(f.u.skill.active,false);f.b.off(hook);
});
test('manual S2 may begin during birth and disarm, while stun still refuses activation',()=>{
 const f=make({skill:2});f.b.addBuff(f.u,{key:'qa:disarm',flags:{disarm:true}});cast(f);advance(f.b,.5);
 assert.equal(f.controller.resources.mode,1);assert.equal(f.hits.length,0);
 const g=make({skill:2});g.b.applyStatus(g.u,'stun',{duration:1});g.u.skill.setSpTotal(g.u.skill.spCost);assert.equal(g.u.skill.activate(),false);
});
test('S2 predelay survives control while the subsequent attack still waits for recovery',()=>{
 const f=make({skill:2});enemy(f);advance(f.b,1.1);cast(f);const hits=f.hits.length;
 f.b.applyStatus(f.u,'stun',{duration:1});advance(f.b,.5);assert.equal(f.controller.resources.mode,1);assert.equal(f.hits.length,hits);
 until(f,()=>f.hits.length>hits,3);assert.equal(f.u.skill.active,true);
});
test('the Minos talent compares the receiving ally HP ratio and scales before physical mitigation',()=>{
 const f=make(),{b,u}=f,a=enemy(f);advance(b,1.1);a.hp=a.s.maxHp*.6;
 // Controlled normalized ally isolates the recipient HP predicate from the aura owner.
 const def={...u.def,chessId:'fixture:minos',charId:'fixture:minos',tags:['minos']};
 const ally=b._makeAlly(b.getPlayer('arkpedia'),def,'op',2,3,{dir:'RIGHT'});b._setupUnit(ally,{talents:[],trait:{noAttack:true}});assert.ok(b._deploy(ally));
 u.hp=u.s.maxHp*.1;ally.hp=ally.s.maxHp*.8;
 const at=a.hp;b.dealDamage(ally,a,{amount:100,type:'phys',canDodge:false});near(at-a.hp,110);
 ally.hp=ally.s.maxHp*.4;const low=a.hp;b.dealDamage(ally,a,{amount:100,type:'phys',canDodge:false});near(low-a.hp,100);
 ally.hp=ally.s.maxHp*.8;b.addBuff(ally,{key:'qa:isolate',flags:{isolated:true}});const isolated=a.hp;
 b.dealDamage(ally,a,{amount:100,type:'true',canDodge:false});near(isolated-a.hp,100);
 b.removeBuff(ally,'qa:isolate');b.retreat(u,{permanent:true});const retired=a.hp;
 b.dealDamage(ally,a,{amount:100,type:'true',canDodge:false});near(retired-a.hp,100);
 assert.deepEqual(b.errors,[]);
});
test('S2 gives one heal per accepted attack even with several targets; heal-free suppresses it and its barrier',()=>{
 const f=make({skill:2});Array.from({length:4},()=>enemy(f));advance(f.b,1.1);cast(f);
 f.b.addBuff(f.u,{key:'qa:heal-free',flags:{healFree:true}});const heals=f.heals.length;
 until(f,()=>f.controller.resources.mode===1&&f.hits.length>=3,3);assert.equal(f.heals.length,heals);assert.equal(f.u.findBuff(f.resources.key),null);
});
test('retiring during S2 Begin cancels mode entry, attacks, healing and all owned handles',()=>{
 const f=make({skill:2});enemy(f);advance(f.b,1.1);cast(f);const hits=f.hits.length,heals=f.heals.length;
 f.b.retreat(f.u,{permanent:true});advance(f.b,2);assert.equal(f.controller.stopped,true);assert.equal(f.resources.stopped,true);
 assert.equal(f.controller.handles.length,0);assert.equal(f.resources.handles.length,0);assert.equal(f.hits.length,hits);assert.equal(f.heals.length,heals);
});
test('native S2 End is an explicit mix and a forced attack outside the controller is refused',()=>{
 const f=make({skill:2}),a=enemy(f);advance(f.b,1.1);assert.equal(f.b.forceAttack(f.u,[a]),false);
 cast(f);advance(f.b,.4);f.b.kill(a,null);advance(f.b,1.3);f.u.skill.end('test');
 assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');advance(f.b,.24);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');
});
test('selected source guards reject changed inputs and battle end cleans up both controllers',()=>{
 assert.throws(()=>make({contract:{}}));
 for(const mutate of[d=>d.stats.atk++,d=>d.skill.bb.atk_scale=99,d=>d.skill.spCost++,d=>d.tags=[],d=>d.rangeGrid=[]])assert.throws(()=>make({mutate}));
 const f=make({skill:2});f.b.emit('battleEnd',{});assert.equal(f.controller.stopped,true);assert.equal(f.resources.stopped,true);
});
