// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import{make as fixture,ally,advance,until,near}from'./helpers/taraxa-fixture.js';
import{taraxaNativeInputs}from'../server/sim/content/arkpedia-taraxa-source.js';
import{verifyTaraxaOrdinarySource}from'../server/sim/content/arkpedia-taraxa-ordinary.js';
function make(opts={}){const f=fixture({ordinary:true,...opts});f.heals=[];f.receipts=[];
 f.b.on('calculatedHeal',h=>{if(h.source===f.u)f.heals.push({...h,time:f.b.time});});
 f.b.on('attack',h=>{if(h.attacker===f.u)f.receipts.push({...h,time:f.b.time});});return f;
}
const phase=f=>until(f,()=>!!f.attacks.phase);
const airborne=f=>until(f,()=>f.attacks.flights.size>0);
test('Grounded healing requires original ability clocks/projectile and explicit skill composition',()=>{
 verifyTaraxaOrdinarySource();assert.throws(()=>make({mayBegin:null}),/composition predicate/);
 const n=structuredClone(taraxaNativeInputs());n.modes[0].attack._useCachedAtkOnly=1;
 assert.throws(()=>verifyTaraxaOrdinarySource(n),/Changed original/);
});
test('Original Start precedes one .6-marker heal receipt and speed-eleven finite projectile',()=>{
 const f=make(),t=ally(f);advance(f.b,.9);assert.equal(f.attacks.phase,null);assert.equal(f.u.mem.regularFormVisual.clip,'Start');
 phase(f);assert.equal(f.u.mem.regularFormVisual.clip,'Attack');advance(f.b,.5);assert.equal(f.receipts.length,0);
 airborne(f);assert.equal(f.receipts.length,1);assert.equal(f.heals.length,0);const p=[...f.attacks.flights.keys()][0];
 assert.equal(p.speed,11);assert.equal(p.maxAge,10);until(f,()=>f.heals.length===1);assert.equal(f.heals[0].target,t);
 near(f.heals[0].amount,f.u.s.atk);assert.equal(f.heals[0].opts.isAttack,true);assert.equal(f.heals[0].opts.isSkill,false);
});
test('Full-HP allies do not consume ordinary healing attacks',()=>{
 const f=make();ally(f,{ratio:1});advance(f.b,5);assert.equal(f.receipts.length,0);assert.equal(f.heals.length,0);
});
test('Grounded acquisition chooses lowest HP ratio rather than lowest raw HP',()=>{
 const f=make(),a=ally(f,{ratio:.2}),b=ally(f,{col:7,ratio:.3});a.base.maxHp=20000;a.markDirty();void a.s;a.hp=4000;b.hp=3000;
 phase(f);assert.equal(f.attacks.phase.target,a);
});
test('An injured self remains an ordinary recipient despite isolation/no-heal-from-others',()=>{
 const f=make();f.u.hp=100;f.b.addBuff(f.u,{key:'fixture:self-only',flags:{isolated:true,noHeal:true}});
 until(f,()=>f.heals.length===1);assert.equal(f.heals[0].target,f.u);assert.ok(f.u.hp>100);
});
for(const kind of['hidden','untargetable','isolated','healFree','noHeal','device'])test(`New grounded healing acquisition excludes ${kind}`,()=>{
 const f=make(),t=ally(f,{flags:['untargetable','isolated','healFree','noHeal'].includes(kind)?{[kind]:true}:{},device:kind==='device'});
 if(kind==='hidden')t.hidden=true;advance(f.b,3);assert.equal(f.receipts.length,0);assert.equal(f.heals.length,0);
});
test('The active flight/controller composition predicate owns presentation when grounded healing yields',()=>{
 let enabled=true;const f=make({mayBegin:()=>enabled});ally(f);phase(f);enabled=false;
 f.u.mem.regularFormVisual={clip:'Skill_1_Begin'};advance(f.b,1);assert.equal(f.receipts.length,0);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1_Begin');
 enabled=true;until(f,()=>f.receipts.length===1);
});
test('Fast ASPD shortens the cycle while the original maximum animation scale caps its release speed',()=>{
 const f=make();ally(f);f.b.addBuff(f.u,{key:'fixture:fast',mods:{aspd:100}});phase(f);near(f.attacks.phase.speed,1);near(f.u.atkCd,1.425,.04);
 until(f,()=>f.receipts.length===2);near(f.receipts[1].time-f.receipts[0].time,1.4333333333333333);
});
test('Slow attack stats are sampled once without another slowdown multiplier',()=>{
 const f=make();ally(f);f.b.addBuff(f.u,{key:'fixture:slow',mods:{aspd:-50,slowDownMul:.2}});phase(f);near(f.attacks.phase.speed,.5);
 advance(f.b,1);assert.equal(f.receipts.length,0);airborne(f);assert.equal(f.receipts.length,1);
});
test('A short control cancels an unfired heal while preserving its positive cooldown',()=>{
 const f=make();ally(f);phase(f);f.b.applyStatus(f.u,'stun',{duration:.01});advance(f.b,.8);
 assert.equal(f.receipts.length,0);assert.ok(f.u.atkCd>0);
});
test('Healing a captured input to full during windup does not reselect a newly injured ally',()=>{
 const f=make(),a=ally(f);phase(f);a.hp=a.s.maxHp;const b=ally(f,{col:7,ratio:.1});
 until(f,()=>f.heals.length===1);assert.equal(f.heals[0].target,a);assert.equal(b.hp,b.s.maxHp*.1);
});
for(const born of[false,true])test(`Recipient life replacement ${born?'after projectile birth':'during windup'} cannot inherit an old heal`,()=>{
 const f=make(),t=ally(f);phase(f);if(born)airborne(f);const hp=t.hp;t.deploySeq++;advance(f.b,.8);
 assert.equal(t.hp,hp);assert.equal(f.heals.length,0);if(!born)assert.equal(f.receipts.length,0);
});
test('Before-attack veto cannot produce a receipt or healing transport',()=>{
 const f=make();ally(f);f.b.on('beforeAttack',h=>{if(h.attacker===f.u)h.targets=[];});advance(f.b,2);
 assert.equal(f.receipts.length,0);assert.equal(f.attacks.flights.size,0);assert.equal(f.heals.length,0);
});
test('Reentrant forced attacks cannot duplicate a grounded heal receipt',()=>{
 const f=make(),t=ally(f);f.b.on('beforeAttack',h=>{if(h.attacker===f.u)f.b.forceAttack(f.u,[t]);});until(f,()=>f.heals.length===1);
 assert.equal(f.receipts.length,1);
});
test('Matching live source ATK and normal healing multipliers apply at impact',()=>{
 const f=make(),t=ally(f);phase(f);airborne(f);f.b.addBuff(f.u,{key:'fixture:live-boost',mods:{atkMul:2,healingDealtMul:1.5}});
 f.b.addBuff(t,{key:'fixture:heal-taken',mods:{healingTakenMul:1.2}});until(f,()=>f.heals.length===1);near(f.heals[0].amount,f.u.s.atk*1.5*1.2);
});
test('Born healing survives source withdrawal with its own launch-ATK fallback',()=>{
 const f=make();ally(f);phase(f);airborne(f);const atk=f.u.s.atk;f.b.retreat(f.u);f.u.base.atk=99999;f.u.markDirty();
 until(f,()=>f.heals.length===1);near(f.heals[0].amount,atk);assert.equal(f.attacks.handles.length,0);assert.equal(f.attacks.watchers.length,0);
});
test('A newly applied heal-free flag prevents the real arriving heal',()=>{
 const f=make(),t=ally(f);phase(f);airborne(f);const hp=t.hp;f.b.addBuff(t,{key:'fixture:heal-free',flags:{healFree:true}});advance(f.b,.5);
 assert.equal(t.hp,hp);assert.equal(f.heals.length,0);assert.equal(f.attacks.watchers.length,0);
});
test('External projectile removal drains finite tracked transport',()=>{
 const f=make();ally(f);phase(f);airborne(f);f.b.removeProjectiles(p=>f.attacks.flights.has(p));advance(f.b,.1);
 assert.equal(f.attacks.flights.size,0);assert.equal(f.attacks.watchers.length,0);assert.equal(f.heals.length,0);
});
for(const[dir,row,col]of[['RIGHT',5,6],['LEFT',5,4],['UP',6,5],['DOWN',4,5]])test(`Grounded ${dir} healing uses the matching original clock and facing`,()=>{
 const f=make({dir});ally(f,{row,col});phase(f);assert.equal(f.u.mem.regularVisualDirection,dir);
 near(f.attacks.phase.releaseAge,.6000000238418579);until(f,()=>f.heals.length===1);
});
test('Battle end drains unfired phases, independent projectiles and source aura resources',()=>{
 const f=make();ally(f);phase(f);airborne(f);f.b.finished=true;f.b.emit('battleEnd',{});
 assert.equal(f.attacks.flights.size,0);assert.equal(f.attacks.watchers.length,0);assert.equal(f.attacks.handles.length,0);assert.equal(f.aura.handles.length,0);
});

test('A float32 0.6000000238418579 marker does not slip one extra 30-Hz simulation frame',()=>{
 const f=make();ally(f);phase(f);const start=f.attacks.phase.lastAt;airborne(f);
 near(f.receipts[0].time-start,.6,1e-8);
});
test('Source withdrawal before the marker cancels the unborn grounded heal and all source handles',()=>{
 const f=make();ally(f);phase(f);f.b.retreat(f.u);advance(f.b,1);
 assert.equal(f.receipts.length,0);assert.equal(f.heals.length,0);assert.equal(f.attacks.flights.size,0);assert.equal(f.attacks.handles.length,0);
});
test('Reusing the source object after projectile birth cannot supply a new life\'s ATK',()=>{
 const f=make();ally(f);phase(f);airborne(f);const atk=f.u.s.atk;f.u.deploySeq++;f.u.base.atk=99999;f.u.markDirty();
 until(f,()=>f.heals.length===1);near(f.heals[0].amount,atk);assert.equal(f.attacks.handles.length,0);
});
test('A target replaced inside the healing callback does not inherit the old projectile\'s HP restoration',()=>{
 const f=make(),t=ally(f);phase(f);airborne(f);const hp=t.hp;
 f.b.on('heal',h=>{if(h.source===f.u)h.target.deploySeq++;});advance(f.b,.5);
 assert.equal(t.hp,hp);assert.equal(f.attacks.watchers.length,0);
});

test('Retiring an old controller cannot erase presentation installed for a replacement source life',()=>{
 const f=make();ally(f);phase(f);f.u.deploySeq++;
 const fresh={clip:'Idle',playId:'fresh-life'};f.u.mem.regularFormVisual=fresh;f.u.mem.regularVisualDirection='UP';advance(f.b,.1);
 assert.equal(f.u.mem.regularFormVisual,fresh);assert.equal(f.u.mem.regularVisualDirection,'UP');assert.equal(f.attacks.handles.length,0);
});

for(const multiplier of[0,9])test(`A new source life's healing multiplier ${multiplier} cannot change an old projectile`,()=>{
 const f=make();ally(f);f.b.addBuff(f.u,{key:'fixture:birth-healing',mods:{healingDealtMul:1.5}});phase(f);airborne(f);const atk=f.u.s.atk;
 f.u.deploySeq++;f.b.removeBuff(f.u,'fixture:birth-healing');f.b.addBuff(f.u,{key:'fixture:new-life-healing',mods:{healingDealtMul:multiplier}});
 advance(f.b,.5);assert.equal(f.heals.length,1);near(f.heals[0].amount,atk*1.5);
});

test('Hiding the grounded source cancels pending healing and resumes on its original life',()=>{
 const f=make();ally(f);phase(f);f.u.hidden=true;advance(f.b,1);assert.equal(f.receipts.length,0);assert.equal(f.attacks.stopped,false);
 f.u.hidden=false;until(f,()=>f.heals.length===1);
});
