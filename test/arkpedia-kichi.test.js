// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,cast,near,advance,until} from './helpers/kichi-fixture.js';
test('Kichisei rejects missing contract or altered selected inputs before combat installation',()=>{
 assert.throws(()=>make({contract:null}));for(const mutate of[d=>d.stats.atk++,d=>d.skill.bb.atk++,d=>d.traitBb.atk_scale++,d=>d.raw.arkpedia.skillId='other'])assert.throws(()=>make({mutate}));
});
test('ordinary direct spread wave hits all legal targets once with one attack receipt and pre-mitigation front-row bonus',()=>{
 const f=make(),front=enemy(f),back=enemy(f,{x:7}),fly=enemy(f,{x:6,y:6,fly:true}),out=enemy(f,{x:10});front.base.def=100;front.markDirty();
 advance(f.b,1.4);assert.equal(f.hits.length,0);until(f,()=>f.attacks.length===1,1);
 assert.equal(f.hits.length,3);near(100000-front.hp,f.u.s.atk*1.5-100);near(100000-back.hp,f.u.s.atk);near(100000-fly.hp,f.u.s.atk*1.5);near(out.hp,100000);
 assert.equal(new Set(f.hits.map(h=>h.dmg.attackId)).size,1);assert.equal(f.u.stats.attacks,1);assert.equal(f.b.projectiles.list.length,0);
});
for(let rank=1;rank<=10;rank++)test(`S1 rank ${rank} stacks once after each wave, caps at four and restores ATK/BAT on finish`,()=>{
 const f=make({rank});advance(f.b,1.1);enemy(f);enemy(f,{x:6,y:6});const atk=f.u.s.atk;cast(f);
 near(f.u.s.interval,2.8);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1_Begin');
 for(let n=1;n<=5;n++){
  until(f,()=>f.attacks.length===n,5);assert.equal(f.resources.skillStacks,Math.min(n,4));assert.equal(f.hits.length,n*2);
  const last=f.hits.slice(-2);for(const h of last)near(h.amount,atk*(1+f.record.bb.atk*Math.min(n-1,4))*1.5);
 }
 f.u.skill.end('fixture');assert.equal(f.resources.skillStacks,0);near(f.u.s.atk,atk);near(f.u.s.interval,2.3);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank} cycles Slow, Bind and Stun once per whole wave and retains source ATK/BAT`,()=>{
 const f=make({skill:2,rank});advance(f.b,1.1);const targets=[enemy(f),enemy(f,{x:6,y:6,fly:true})],atk=f.u.s.atk;cast(f);near(f.u.s.interval,3);
 const states=[];f.b.on('calculatedDamage',c=>{if(c.source===f.u)states.push({slow:c.target.findBuff('sluggish')?.timeLeft,bind:c.target.findBuff('bind')?.timeLeft,stun:c.target.findBuff('stun')?.timeLeft});});
 for(let n=1;n<=4;n++){
  until(f,()=>f.attacks.length===n,5);assert.equal(f.resources.cycle,n%3);const cycle=(n-1)%3;
  for(const s of states.slice(-2)){const duration=cycle===0?s.slow:cycle===1?s.bind:s.stun;near(duration,rank<7?1:rank<10?1.3:1.5);}
  for(const h of f.hits.slice(-2))near(h.amount,atk*(1+f.record.bb.atk)*1.5);
 }
 assert.equal(f.hits.length,targets.length*4);f.u.skill.end('fixture');assert.equal(f.resources.cycle,0);near(f.u.s.atk,atk);near(f.u.s.interval,2.3);
});
test('S2 non-damage-missable status survives dodge and shields while resistance and immunity keep their own rules',()=>{
 for(const kind of['dodge','shield','resist','bind-rejected','stun-immune']){
  const f=make({skill:2});advance(f.b,1.1);const e=enemy(f);cast(f);
  if(kind==='dodge')f.b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});
  if(kind==='shield')f.b.addBuff(e,{key:'shield',shield:100000});
  if(kind==='resist')f.b.applyStatus(e,'resist',{value:.5});
  if(kind==='bind-rejected')f.b.on('beforeStatus',c=>{if(c.target===e&&c.status==='bind')c.cancel=true;});if(kind==='stun-immune')e.def.immune.add('stun');
  until(f,()=>f.attacks.length===1,2);assert.ok(e.findBuff('sluggish'));near(e.findBuff('sluggish').timeLeft,kind==='resist'?.75:1.5);
  if(['dodge','shield'].includes(kind))near(e.hp,100000);
  until(f,()=>f.attacks.length===2,5);assert.equal(!!e.findBuff('bind'),kind!=='bind-rejected');
  until(f,()=>f.attacks.length===3,5);assert.equal(!!e.findBuff('stun'),kind!=='stun-immune');
 }
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`E${elite}/P${potential} talent counts distinct credited definitions, caps correctly and changes later damage`,()=>{
 const f=make({elite,potential});advance(f.b,1.1);const a=enemy(f,{hp:1}),same=enemy(f,{x:6,y:6,hp:1}),different=enemy(f,{x:7,hp:1,id:'enemy_1004_pgan'});
 until(f,()=>!a.alive&&!same.alive&&!different.alive,2);
 const expected=elite?2:0;assert.equal(f.resources.kills.size,expected);near(f.u.s.dmgDealtMul,1+expected*(potential===6?.07:.06));
 const target=enemy(f,{x:7});until(f,()=>f.hits.some(h=>h.target===target),4);const h=f.hits.find(h=>h.target===target);near(h.amount,f.u.s.atk*f.u.s.dmgDealtMul);
});
test('external forced attacks cannot bypass source release timing or fabricate stacks',()=>{
 const f=make();advance(f.b,1.1);const e=enemy(f);cast(f);assert.equal(f.b.forceAttack(f.u,[e]),false);assert.equal(f.resources.skillStacks,0);assert.equal(f.attacks.length,0);
});
for(const dir of['RIGHT','LEFT','UP','DOWN'])for(const skill of[1,2])test(`S${skill}/${dir} uses literal directional tracks and uncapped speed while BAT changes only once`,()=>{
 const f=make({skill,dir});advance(f.b,1.1);f.b.addBuff(f.u,{key:'fast',mods:{aspd:200}});
 enemy(f,{x:5+(dir==='RIGHT'?1:dir==='LEFT'?-1:0),y:5+(dir==='UP'?1:dir==='DOWN'?-1:0)});cast(f);
 until(f,()=>f.controller.phase?.kind==='attack',1);near(f.u.s.interval,(skill===1?2.8:3)/3);near(f.u.mem.regularFormVisual.speed,3);
 assert.equal(f.u.mem.regularFormVisual.clip,dir==='DOWN'?`Skill_Down_${skill}_Loop`:`Skill_${skill}_Loop`);
 const start=f.b.time;until(f,()=>f.attacks.length===1,1);near(f.b.time-start,.5/3,f.b.dt+1e-6);
});
test('one accepted empty release advances S1 once after all prior targets leave; hooks cancelling a nonempty selection do not',()=>{
 const f=make();advance(f.b,1.1);const e=enemy(f);cast(f);until(f,()=>f.controller.phase?.kind==='attack',1);
 e.hidden=true;f.b._buildEnemyIndex();until(f,()=>f.attacks.length===1,1);assert.equal(f.hits.length,0);assert.equal(f.resources.skillStacks,1);
 const g=make();advance(g.b,1.1);enemy(g);cast(g);g.b.on('beforeAttack',c=>{if(c.attacker===g.u)c.targets=[];});advance(g.b,1);
 assert.equal(g.attacks.length,0);assert.equal(g.resources.skillStacks,0);
});
test('release selector hits entrants and drops leavers rather than retaining cast-start victims',()=>{
 const f=make(),old=enemy(f);until(f,()=>f.controller.phase?.kind==='attack',2);old.x=15;
 const fresh=enemy(f,{x:7});f.b._buildEnemyIndex();until(f,()=>f.attacks.length===1,1);
 assert.equal(f.hits.length,1);assert.equal(f.hits[0].target,fresh);near(old.hp,100000);
});
test('brief control invalidates an unfired wave and its after-attack effects, then recovers without duplicated attacks',()=>{
 for(const skill of[1,2]){
  const f=make({skill});advance(f.b,1.1);enemy(f);cast(f);until(f,()=>f.controller.phase?.kind==='attack',1);
  f.b.applyStatus(f.u,'stun',{duration:.001});advance(f.b,.6);assert.equal(f.attacks.length,0);assert.equal(f.resources.skillStacks,0);assert.equal(f.resources.cycle,0);
  until(f,()=>f.attacks.length===1,4);assert.equal(f.resources.skillStacks,skill===1?1:0);assert.equal(f.resources.cycle,skill===2?1:0);
 }
});
test('birth control cannot bypass the declared full Start window; native skill casting during birth remains allowed',()=>{
 const f=make();enemy(f);f.b.applyStatus(f.u,'stun',{duration:.001});advance(f.b,.7);assert.equal(f.hits.length,0);assert.equal(f.controller.phase.kind,'born');
 until(f,()=>f.hits.length>0,2);assert.ok(f.hits[0].time>=1.5-1e-7);
 const g=make({skill:2});enemy(g);cast(g);until(g,()=>g.attacks.length===1,1);assert.ok(g.b.time<1);assert.equal(g.u.skill.active,true);
});
test('skill mode changes preserve existing positive attack cooldown and discard an unborn previous-mode wave',()=>{
 const f=make();enemy(f);until(f,()=>f.controller.phase?.kind==='attack',2);const cd=f.u.atkCd;cast(f);near(f.u.atkCd,cd);
 advance(f.b,.7);assert.equal(f.attacks.length,0);assert.equal(f.resources.skillStacks,0);
 until(f,()=>f.controller.phase?.kind==='attack',3);const tail=f.u.atkCd;f.u.skill.end('fixture');near(f.u.atkCd,tail);
 advance(f.b,.7);assert.equal(f.attacks.length,0);near(f.u.s.atk,f.u.base.atk);
});
test('talent keeps one credit per definition, applies its capped output multiplier to later same-wave targets and ignores others’ kills',()=>{
 const f=make();advance(f.b,1.1);const first=enemy(f,{hp:1}),second=enemy(f,{x:6,y:6,hp:1}),last=enemy(f,{x:7});
 until(f,()=>f.attacks.length===1,2);const damage=f.calculated;near(damage[0].amount,f.u.s.atk*1.5);near(damage[1].amount,f.u.s.atk*1.5*1.06);near(damage[2].amount,f.u.s.atk*1.06);
 assert.equal(f.resources.kills.size,1);assert.equal(first.alive,false);assert.equal(second.alive,false);assert.ok(last.alive);
 f.b.addBuff(f.u,{key:'test:disarm',flags:{disarm:true}});
 for(let n=0;n<4;n++){const e=enemy(f,{hp:1});e.defId=`fixture:distinct-${n}`;f.b.dealDamage(f.u,e,{amount:100,type:'true'});}
 assert.equal(f.resources.kills.size,3);near(f.u.s.dmgDealtMul,1.18);
 const foreign=enemy(f,{hp:1});f.b.dealDamage(null,foreign,{amount:100,type:'true'});assert.equal(f.resources.kills.size,3);
});
test('front-row marks follow current bodies, clean dead recipients and retire without removing a foreign mark',()=>{
 const f=make(),e=enemy(f);advance(f.b,.1);assert.ok(e.findBuff(f.resources.frontKey));
 e.x=7;f.b._buildEnemyIndex();advance(f.b,.1);assert.equal(e.findBuff(f.resources.frontKey),null);
 e.x=6;f.b._buildEnemyIndex();advance(f.b,.1);assert.ok(e.findBuff(f.resources.frontKey));
 const dead=enemy(f,{x:6,y:6});advance(f.b,.1);assert.ok(f.resources.marked.has(dead));f.b.kill(dead,null);advance(f.b,.1);
 assert.equal(f.resources.marked.has(dead),false);assert.equal(dead.findBuff(f.resources.frontKey),null);
 f.b.addBuff(e,{key:'foreign:front',data:{kichiFront:true}});f.b.retreat(f.u,{permanent:true});
 assert.equal(e.findBuff(f.resources.frontKey),null);assert.ok(e.findBuff('foreign:front'));assert.equal(f.resources.marked.size,0);assert.equal(f.controller.handles.length,0);
});
test('a huge recipient overlapping the front row gets one trait bonus even with its centre beyond that row',()=>{
 const f=make(),e=enemy(f,{x:7.2});e.hitArea={w:2,h:1,dx:0,dy:0};f.b._buildEnemyIndex();
 until(f,()=>f.attacks.length===1,2);assert.equal(f.hits.length,1);near(f.hits[0].amount,f.u.s.atk*1.5);
});
test('applied S2 statuses retain their finite recipient lifetime after retreat, but owned stats/marks and future attacks stop',()=>{
 const f=make({skill:2});advance(f.b,1.1);const e=enemy(f);cast(f);until(f,()=>f.attacks.length===1,2);
 f.b.retreat(f.u,{permanent:true});assert.ok(e.findBuff('sluggish'));assert.equal(f.resources.marked.size,0);const n=f.hits.length;
 advance(f.b,2);assert.equal(e.findBuff('sluggish'),null);assert.equal(f.hits.length,n);assert.equal(f.controller.stopped,true);
});
test('original End mixes occur only from source skill Idle and never add an artificial attack lock',()=>{
 for(const skill of[1,2]){
  const f=make({skill});advance(f.b,1.1);cast(f);advance(f.b,.2);assert.equal(f.u.mem.regularFormVisual.clip,`Skill_${skill}_Idle`);
  f.u.skill.end('fixture');assert.equal(f.u.mem.regularFormVisual.clip,`Skill_${skill}_End`);
  enemy(f);advance(f.b,f.b.dt);assert.equal(f.controller.phase.kind,'attack');assert.equal(f.u.mem.regularFormVisual.clip,'Attack');
 }
});
