// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,advance,near,until} from './helpers/mcnist-attack-fixture.js';
import {MCNIST_ATTACK_CONTRACT} from '../server/sim/content/arkpedia-mcnist-attacks.js';
const target=(f,o={})=>enemy(f,{x:6,y:5,...o});
const born=f=>advance(f.b,1.01);
for(const dir of['UP','DOWN','LEFT','RIGHT'])test(`Mechanist ${dir} ordinary shot retains one original physical receipt and source marker`,()=>{
 const f=make({dir}),t=target(f,{x:dir==='LEFT'?4:dir==='RIGHT'?6:5,y:dir==='UP'?6:dir==='DOWN'?4:5});
 until(f,()=>f.attacks.length===1,3);assert.equal(f.attacks[0].targets.length,1);assert.equal(f.attacks[0].targets[0],t);assert.equal(f.attacks[0].isSkill,false);
 near(f.attacks[0].time,f.controller.phase.releaseAt,f.b.dt+1e-7);until(f,()=>f.hits.length===1,1);near(f.hits[0].amount,f.u.s.atk);assert.equal(f.hits[0].dmg.type,'phys');assert.equal(f.hits[0].dmg.applyWay,'ranged');assert.deepEqual(f.b.errors,[]);
});
test('McGraf ordinary strike uses native .7-second predelay rather than its .666667 artwork event',()=>{
 const f=make(),t=f.deck.place(5,7),z=enemy(f,{x:7.3,y:5}),c=t.mem.mcgrafAttacks,attacks=[],hits=[];
 f.b.on('attack',x=>{if(x.attacker===t)attacks.push({...x,time:f.b.time});});f.b.on('damaged',x=>{if(x.source===t)hits.push(x);});
 born(f);assert.equal(c.phase.kind,'attack');near(c.phase.releaseAt-f.b.time,.699999988079071-(f.b.time-1),1e-6);
 advance(f.b,.6);assert.equal(attacks.length,0);advance(f.b,f.b.dt);assert.equal(attacks.length,0);advance(f.b,f.b.dt);assert.equal(attacks.length,0);until(f,()=>attacks.length===1,1);assert.equal(attacks[0].targets.length,1);assert.equal(attacks[0].targets[0],z);assert.equal(hits.length,1);near(hits[0].amount,t.s.atk);assert.equal(hits[0].dmg.applyWay,'melee');
});

for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)test(`Mechanist ordinary S${skill}/rank ${rank} stays physical while the unreviewed skill cannot activate`,()=>{
 const f=make({skill,rank}),t=target(f);until(f,()=>f.hits.length>0,3);near(f.hits[0].amount,f.u.s.atk);assert.equal(f.hits[0].dmg.isSkill,false);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('fixture'),false);assert.equal(t.hp<t.s.maxHp,true);
});
test('Mechanist Start reserves one second before any ordinary windup or receipt',()=>{const f=make();target(f);advance(f.b,.99);assert.equal(f.controller.phase.kind,'born');assert.equal(f.attacks.length,0);advance(f.b,.46);assert.equal(f.attacks.length,1);});
for(const aspd of[50,100,200,400])test(`Mechanist original release and ordinary period are bounded under ${aspd} ASPD`,()=>{
 const f=make();target(f);f.b.addBuff(f.u,{key:'qa:aspd',mods:{aspd:aspd-100}});born(f);const p=f.controller.phase,speed=Math.min(1,aspd/100);near(f.u.mem.regularFormVisual.speed,speed);near(p.releaseAt-(p.until-Math.max(f.u.s.interval,.4333333373069763/speed)),.4333333373069763/speed);until(f,()=>f.attacks.length>=2,5);assert.ok(f.attacks[1].time-f.attacks[0].time+1e-7>=Math.max(f.u.s.interval,.4333333373069763/speed));
});
test('Mechanist native slow-down affects the selected ordinary clock once',()=>{
 const f=make();target(f);f.b.addBuff(f.u,{key:'qa:slow',mods:{slowDownMul:.5}});born(f);near(f.u.mem.regularFormVisual.speed,.5);near(f.controller.phase.releaseAt-1,.4333333373069763/.5);advance(f.b,.7);assert.equal(f.attacks.length,0);advance(f.b,.2);assert.equal(f.attacks.length,1);
});
test('Mechanist may hit an aerial target; McGraf ground selector cannot',()=>{
 const f=make();target(f,{fly:true});until(f,()=>f.hits.length===1,3);const t=f.deck.place(5,7),a=enemy(f,{x:7.2,y:5,fly:true});advance(f.b,3);assert.equal(t.stats.attacks,0);near(a.hp,a.s.maxHp);
});
for(const who of['owner','token'])test(`${who} blocks three enemies but spends each ordinary receipt on only one`,()=>{
 const f=make(),u=who==='owner'?f.u:f.deck.place(5,7),xs=[.15,.25,.35].map(dx=>enemy(f,{x:u.x+dx,y:u.y})),hits=[],attacks=[];
 f.b.on('damaged',c=>{if(c.source===u)hits.push(c);});f.b.on('attack',c=>{if(c.attacker===u)attacks.push(c);});f.b.addBuff(u,{key:'qa:extra-targets',mods:{maxTargets:100}});until(f,()=>hits.length>0,4);assert.equal(u.blocking.length,3);assert.equal(attacks.length,1);assert.equal(attacks[0].targets.length,1);assert.equal(hits.length,1);assert.equal(xs.filter(t=>t.hp<t.s.maxHp).length,1);
});
for(const control of['stun','freeze','disarm'])test(`Mechanist ${control} before release cancels pending work and preserves positive cooldown`,()=>{
 const f=make();target(f);born(f);const cd=f.u.atkCd;f.b.applyStatus(f.u,control,{duration:.5});advance(f.b,.2);assert.equal(f.attacks.length,0);assert.equal(f.controller.phase,null);assert.ok(f.u.atkCd>0&&f.u.atkCd<=cd);
});
test('Mechanist a sub-tick control epoch cancels windup even after its visible flag is gone',()=>{const f=make();target(f);born(f);f.b.applyStatus(f.u,'stun',{duration:1});f.b.removeStatus(f.u,'stun');advance(f.b,.5);assert.equal(f.attacks.length,0);});
test('Mechanist silence leaves ordinary attacks and their source physical output active',()=>{const f=make();target(f);f.b.applyStatus(f.u,'silence',{duration:10});until(f,()=>f.hits.length===1,3);assert.equal(f.hits[0].dmg.type,'phys');});
for(const mode of['veto','duplicate','substitute'])test(`Mechanist beforeAttack ${mode} cannot add a phantom shot or receipt`,()=>{
 const f=make(),a=target(f),z=target(f,{x:7});born(f);f.b.on('beforeAttack',c=>{if(c.attacker!==f.u)return;if(mode==='veto')c.cancel=true;else c.targets=mode==='duplicate'?[a,a]:[z];});advance(f.b,.5);assert.equal(f.attacks.length,0);assert.equal(f.hits.length,0);assert.equal(f.controller.flights.size,0);
});
test('Mechanist recursive attack callbacks serialize one accepted ordinary receipt',()=>{const f=make(),t=target(f);let n=0;f.b.on('beforeAttack',c=>{if(c.attacker===f.u){n++;f.b.forceAttack(f.u,[t]);}});until(f,()=>f.attacks.length===1,3);assert.equal(n,1);});
test('Mechanist external forced attacks cannot bypass its captured ordinary release',()=>{const f=make(),t=target(f);assert.equal(f.b.forceAttack(f.u,[t]),false);born(f);assert.equal(f.b.forceAttack(f.u,[t]),false);assert.equal(f.attacks.length,0);});
test('Mechanist lost input is omitted at release instead of replaced by another live enemy',()=>{
 const f=make(),t=target(f);born(f);f.b.kill(t,null);target(f,{x:7});advance(f.b,.5);assert.equal(f.attacks.length,0);advance(f.b,.8);assert.equal(f.controller.phase.kind,'attack');
});
test('Mechanist offensive SP counts one accepted ordinary receipt, never one per blocked body',()=>{const f=make();for(const dx of[.15,.25,.35])target(f,{x:5+dx});until(f,()=>f.attacks.length===1,3);near(f.u.skill.spTotal,1);});
for(const after of[false,true])test(`Mechanist source withdrawal ${after?'after':'before'} launch preserves only legally born projectile work`,()=>{
 const f=make();target(f,{x:7});if(after)until(f,()=>f.attacks.length===1,3);else born(f);f.b.retreat(f.u,{permanent:true});advance(f.b,1);assert.equal(f.hits.length,after?1:0);assert.equal(f.controller.handles.length,0);assert.equal(f.controller.flightHandles.length,0);
});
for(const retire of[false,true])test(`Mechanist impact ATK uses ${retire?'birth snapshot after departure':'live same-life source stats'}`,()=>{
 const f=make();target(f,{x:7});const atk=f.u.s.atk;until(f,()=>f.attacks.length===1,3);f.b.addBuff(f.u,{key:'qa:atk',mods:{atkPct:1}});if(retire)f.b.retreat(f.u,{permanent:true});until(f,()=>f.hits.length===1,1);near(f.hits[0].amount,atk*(retire?1:2));
});
test('Mechanist a changed target life cannot receive damage from the old projectile',()=>{const f=make(),t=target(f,{x:7});until(f,()=>f.attacks.length===1,3);t.deploySeq++;advance(f.b,.2);assert.equal(f.hits.length,0);assert.equal(f.controller.flights.size,0);});
test('Mechanist legally born projectile can finish outside the original attack range',()=>{const f=make(),t=target(f,{x:7});until(f,()=>f.attacks.length===1,3);t.x=11;until(f,()=>f.hits.length===1,1);assert.equal(f.hits[0].target,t);});
test('Mechanist later battle end removes a born flight watcher after source withdrawal',()=>{const f=make();target(f,{x:7});until(f,()=>f.attacks.length===1,3);f.b.retreat(f.u,{permanent:true});assert.ok(f.controller.flightHandles.length>0);f.b.finished=true;f.b.emit('battleEnd',{});assert.equal(f.controller.flightHandles.length,0);assert.equal(f.controller.flights.size,0);});
test('Mechanist post-launch source removal retains the born shot but not pending follow-ups',()=>{const f=make();target(f,{x:7});f.b.on('attack',c=>{if(c.attacker===f.u)f.b.retreat(f.u,{permanent:true});});until(f,()=>f.hits.length===1,3);assert.equal(f.attacks.length,1);assert.equal(f.controller.stopped,true);});
for(const aspd of[50,200,400])test(`McGraf ordinary explicit predelay stays capped at ${aspd} ASPD`,()=>{
 const f=make(),t=f.deck.place(5,7);enemy(f,{x:7.2,y:5});f.b.addBuff(t,{key:'qa:aspd',mods:{aspd:aspd-100}});born(f);near(t.mem.mcgrafAttacks.phase.releaseAt-1,.699999988079071/Math.min(1,aspd/100));assert.equal(t.mem.regularFormVisual.clip,'Attack');
});
test('McGraf birth, melee and independent owner shots do not share damage IDs or attack counts',()=>{
 const f=make(),t=f.deck.place(5,7);enemy(f,{x:7.2,y:5});const hits=[];f.b.on('damaged',c=>{if(c.source===f.u||c.source===t)hits.push(c);});until(f,()=>hits.some(h=>h.source===t)&&hits.some(h=>h.source===f.u),4);assert.notEqual(hits.find(h=>h.source===t).dmg.attackId,hits.find(h=>h.source===f.u).dmg.attackId);
});
test('McGraf removal disposes its ordinary pending attack while a later deployed source life gets a fresh clock',()=>{
 const f=make(),t=f.deck.place(5,7);enemy(f,{x:7.2,y:5});born(f);const c=t.mem.mcgrafAttacks;f.deck.retreat(t);advance(f.b,1);assert.equal(c.stopped,true);assert.equal(c.handles.length,0);assert.equal(t.stats.attacks,0);advance(f.b,39);f.u.player.dp=99;const next=f.deck.place(5,7);assert.notEqual(next.mem.mcgrafAttacks,c);assert.equal(next.mem.mcgrafAttacks.phase.kind,'born');
});
test('Mechanist ordinary admission refuses cloned or missing contracts and changed selected data',()=>{
 for(const contract of[null,{}, {...MCNIST_ATTACK_CONTRACT}])assert.throws(()=>make({contract}));for(const mutate of[d=>d.stats.atk++,d=>d.skill.spCost++,d=>d.talents=[]])assert.throws(()=>make({mutate}));
});

test('Mechanist live slow-down changes pending elapsed time without recapturing ASPD or replaying a hit',()=>{
 const f=make();target(f);born(f);const p=f.controller.phase;advance(f.b,.2);const age=p.age;f.b.addBuff(f.u,{key:'qa:live-slow',mods:{slowDownMul:.5}});advance(f.b,.3);assert.equal(f.attacks.length,0);assert.ok(p.age>age);near(f.u.mem.regularFormVisual.speed,.5);f.b.removeBuff(f.u,'qa:live-slow');until(f,()=>f.attacks.length===1,1);near(f.u.mem.regularFormVisual.speed,1);
});
for(const flag of['camou','stealth','untargetable','sleep'])test(`Mechanist ordinary source selector refuses an unblocked ${flag} enemy`,()=>{const f=make(),t=target(f,{x:7});f.b.addBuff(t,{key:'qa:unselectable',flags:{[flag]:true}});advance(f.b,3);assert.equal(f.attacks.length,0);});
test('Mechanist camouflage cannot steal priority from another selectable ordinary target',()=>{const f=make(),t=target(f),z=target(f,{x:7});f.b.addBuff(t,{key:'qa:camou',flags:{camou:true}});until(f,()=>f.attacks.length===1,3);assert.equal(f.attacks[0].targets[0],z);});
test('Mechanist may select a blocked camouflaged enemy, preserving source block priority',()=>{const f=make(),t=target(f,{x:5.2});f.b.addBuff(t,{key:'qa:camou',flags:{camou:true}});until(f,()=>f.attacks.length===1,3);assert.equal(t.blockedBy,f.u);assert.equal(f.attacks[0].targets[0],t);});
test('Mechanist new camouflage before release rejects the pending input without substitution',()=>{const f=make(),t=target(f,{x:7});born(f);f.b.addBuff(t,{key:'qa:camou',flags:{camou:true}});advance(f.b,.5);assert.equal(f.attacks.length,0);});
