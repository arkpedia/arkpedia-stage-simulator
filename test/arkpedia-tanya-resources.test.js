// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,advance,near} from './helpers/tanya-resource-fixture.js';
import {registerBerryProtection} from '../server/sim/content/arkpedia-five-star-medic-second.js';
const EP=['burn','neural','necrosis','apoptosis','erosion'];
const injure=(f,amount,element)=>f.b.dealDamage(null,f.u,{amount,type:'element',element,canDodge:false});
const hurt=(f,amount=10,options={})=>f.b.dealDamage(null,f.u,{amount,type:'true',canDodge:false,...options});
function provider(f,value){
 const u=f.b.spawnToken(f.u,'fixture:protection',4,5,{def:{name:'Protection fixture',profession:'TOKEN',position:'MELEE',stats:{maxHp:1000,atk:0,def:0,blockCnt:0,cost:0},skill:null},kit:{trait:{noAttack:true,noBlock:true},talents:[],skill:{kind:'passive'}}});
 assert.ok(u);const sync=registerBerryProtection(f.b,u,value,()=>true,()=>u.alive&&u.deployed);sync();return{u,sync};
}
for(const elite of[0,1,2])for(const potential of[1,6])test(`Crackborne E${elite}/P${potential} combines WATER resistance operands only for erosion gauge input`,()=>{
 const f=make({elite,potential}),t=f.record.talentBb[0],base=t?.['ep_damage_resistance[other]']??0;
 for(const el of EP){injure(f,100,el);near(f.u.elem[el],100*(1-base*(el==='erosion'?2:1)));}
 const hp=f.u.hp;hurt(f,100,{type:'elemental',element:'erosion'});near(hp-f.u.hp,100);
});
for(let rank=1;rank<=10;rank++)test(`Crackborne S1/rank ${rank} attaches HP immediately and recovers each gauge on delayed one-second pulses`,()=>{
 const f=make({rank}),{b,u,resources:r}=f,max=u.s.maxHp;u.hp=max*.5;for(const el of EP)u.elem[el]=500;
 assert.equal(r.beginHp(),true);near(u.s.maxHp,max*(1+f.record.bb.max_hp));near(u.hp/u.s.maxHp,.5);
 advance(b,.9);assert.equal(r.s1Ticks,0);for(const el of EP)near(u.elem[el],500);
 advance(b,.2);assert.equal(r.s1Ticks,1);for(const el of EP)near(u.elem[el],500-f.record.bb.ep_heal);
 r.endHp();near(u.s.maxHp,max);near(u.hp,max*.5);advance(b,1);assert.equal(r.s1Ticks,1);assert.equal(f.attacks.length,0);
});
for(let rank=1;rank<=10;rank++)test(`Crackborne S2/rank ${rank} caps permanent DEF and consumes one stack for a positive HP-loss receipt`,()=>{
 const f=make({skill:2,rank}),{b,u,resources:r}=f,t=enemy(f,{x:6}),base=u.s.def,atk=u.s.atk;
 assert.equal(r.addStacks(),true);assert.equal(r.stacks(),5);near(u.s.def,base*(1+5*f.record.bb.def));r.addStacks();assert.equal(r.stacks(),5);
 hurt(f);assert.equal(r.stacks(),4);near(u.s.def,base*(1+4*f.record.bb.def));near(t.elem.erosion,atk*f.record.bb.ep_damage_ratio);
 advance(b,30);assert.equal(r.stacks(),4);assert.equal(f.attacks.length,0);assert.deepEqual(b.errors,[]);
});
test('Crackborne S1 follows native heal-free rejection, while silence/stun do not pause its clock',()=>{
 const f=make(),{b,u,resources:r}=f;u.elem.erosion=600;r.beginHp();b.addBuff(u,{key:'qa:heal-free',flags:{healFree:true}});
 b.applyStatus(u,'silence',{duration:3});b.applyStatus(u,'stun',{duration:3});advance(b,1.1);assert.equal(r.s1Ticks,1);near(u.elem.erosion,600);
 b.removeBuff(u,'qa:heal-free');advance(b,1);assert.equal(r.s1Ticks,2);near(u.elem.erosion,600-f.record.bb.ep_heal);
});
test('Crackborne S1 respects all-gauge burst lock and does not heal HP or apply HP-healing multipliers',()=>{
 const f=make(),{b,u,resources:r}=f;u.elem.burn=400;u.hp=u.s.maxHp*.3;r.beginHp();const hp=u.hp;
 b.addBuff(u,{key:'qa:healing-multipliers',mods:{healingDealtMul:2,healingTakenMul:3}});b.applyStatus(u,'neuralBurst',{duration:2});advance(b,1.1);near(u.elem.burn,400);near(u.hp,hp);
 b.removeStatus(u,'neuralBurst');advance(b,1);near(u.elem.burn,400-f.record.bb.ep_heal);near(u.hp,hp);
});
for(const mode of['shield','dodge','cancel','floor','guard','zero','gauge'])test(`Crackborne ${mode} without real HP loss never spends a DEF stack`,()=>{
 const f=make({skill:2}),{b,u,resources:r}=f;const t=enemy(f,{x:6});r.addStacks();
 if(mode==='shield')b.addBuff(u,{key:'qa:shield',shield:10000});
 if(mode==='dodge')b.addBuff(u,{key:'qa:dodge',mods:{dodgePhys:1}});
 if(mode==='cancel')b.on('hit',c=>{if(c.target===u)c.cancel=true;});
 if(mode==='floor'){u.hp=1;b.addBuff(u,{key:'qa:undeadable',flags:{undeadable:true}});}
 if(mode==='guard')b.on('beforeHpZero',c=>{if(c.unit===u)c.blocked=true;});
 if(mode==='gauge')injure(f,10,'neural');else hurt(f,mode==='guard'?100000:mode==='zero'?0:10,{type:mode==='dodge'?'phys':'true',canDodge:mode==='dodge'});
 assert.equal(r.stacks(),5);assert.equal(r.responses,0);near(t.elem.erosion,0);
});
test('Crackborne HP drain spends stacks but direct HP assignment does not create modifier receipts',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f,t=enemy(f,{x:6});r.addStacks();u.hp-=10;advance(b,.1);assert.equal(r.stacks(),5);
 b.loseHp(u,10);assert.equal(r.stacks(),4);assert.equal(r.responses,1);near(t.elem.erosion,u.s.atk*f.record.bb.ep_damage_ratio);
});
test('Crackborne spends before the erosion pulse, reaches every legal ground body and never hits flyers',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f,ground=enemy(f,{x:6}),second=enemy(f,{x:4}),fly=enemy(f,{x:6,fly:true}),far=enemy(f,{x:8});r.addStacks();
 const seen=[];b.on('elementHit',c=>{if(c.source===u)seen.push({stacks:r.stacks(),target:c.target});});hurt(f);
 assert.equal(seen.length,2);assert.ok(seen.every(s=>s.stacks===4));for(const t of[ground,second])near(t.elem.erosion,u.s.atk*f.record.bb.ep_damage_ratio);near(fly.elem.erosion,0);near(far.elem.erosion,0);
});
test('Crackborne five actual HP losses spend exactly five stacks and a fresh cast restores capacity',()=>{
 const f=make({skill:2}),{u,resources:r}=f;enemy(f,{x:6});r.addStacks();for(let n=0;n<8;n++)hurt(f,1);
 assert.equal(r.stacks(),0);assert.equal(r.responses,5);near(u.s.def,f.record.stats.def);assert.equal(u.findBuff(r.stackKey),null);r.addStacks();assert.equal(r.stacks(),5);
});
test('Crackborne erosion uses live ATK per recipient and separate buildup despite zero HP damage',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f,a=enemy(f,{x:6}),z=enemy(f,{x:4}),atk=u.s.atk;r.addStacks();
 b.on('elementHit',c=>{if(c.source===u&&c.target===a)b.addBuff(u,{key:'qa:atk',mods:{atkPct:1}});});hurt(f);
 near(a.elem.erosion,atk*f.record.bb.ep_damage_ratio);near(z.elem.erosion,atk*2*f.record.bb.ep_damage_ratio);near(a.hp,a.s.maxHp);near(z.hp,z.s.maxHp);
});
test('Crackborne fatal HP-loss response precedes death and resource cleanup',()=>{
 const f=make({skill:2}),{u,resources:r}=f,t=enemy(f,{x:6}),atk=u.s.atk;r.addStacks();hurt(f,100000);
 near(t.elem.erosion,atk*f.record.bb.ep_damage_ratio);assert.equal(u.alive,false);assert.equal(r.responses,1);assert.equal(r.stopped,true);assert.equal(r.stacks(),0);
});
test('Crackborne an empty response still consumes its stack and environmental HP loss counts',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f;r.addStacks();b.loseHp(u,5,{sourceless:true});assert.equal(r.stacks(),4);assert.equal(r.responses,1);
});
test('Crackborne self resistance survives untargetability/isolation and respects unrelated elemental intake once',()=>{
 const f=make({potential:6}),{b,u}=f;b.addBuff(u,{key:'qa:self',flags:{untargetable:true,isolated:true},mods:{elemTakenMul:.5}});
 injure(f,100,'erosion');near(u.elem.erosion,100*.5*(1-.24));injure(f,100,'burn');near(u.elem.burn,100*.5*(1-.12));
});
for(const value of[.15,.3])test(`Crackborne typed resistance shares strongest protection with an external ${value} source`,()=>{
 const f=make(),{b,u}=f,p=provider(f,value);injure(f,100,'burn');near(u.elem.burn,100*(1-Math.max(.1,value)));
 injure(f,100,'erosion');near(u.elem.erosion,100*(1-Math.max(.2,value)));b.retreat(p.u,{permanent:true});p.sync.remove();
 u.elem.erosion=0;injure(f,100,'erosion');near(u.elem.erosion,80);
});
test('Crackborne removal restores another protection producer and clears only owned resource state',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f,p=provider(f,.15);r.addStacks();r.stop();assert.equal(r.stacks(),0);assert.equal(r.handles.length,0);
 injure(f,100,'erosion');near(u.elem.erosion,85);assert.ok(u.findBuff('source:mberry-safe-zone'));assert.equal(u.findBuff(r.talentKey),null);p.sync.remove();
});
test('Crackborne rejected native talent/HP/stack attachments do not create protection or reactions',()=>{
 const f=make({defer:true}),{b,u,resources:r}=f;b.on('beforeBuff',c=>{if(c.buff.key.startsWith('tanya:'))c.cancel=true;});f.deploy();injure(f,100,'erosion');near(u.elem.erosion,100);assert.equal(r.beginHp(),false);
 const g=make({skill:2});g.b.on('beforeBuff',c=>{if(c.buff.key===g.resources.stackKey)c.cancel=true;});assert.equal(g.resources.addStacks(),false);hurt(g);assert.equal(g.resources.responses,0);
});
test('Crackborne resource selectors reject changed inputs, malformed contracts and the wrong skill API',()=>{
 assert.throws(()=>make({contract:{}}));for(const mutate of[d=>d.stats.atk++,d=>d.skill.bb.max_hp=9,d=>d.skill.spCost++,d=>d.rangeGrid.push([1,0]),d=>d.talents=[]])assert.throws(()=>make({mutate}));
 const f=make();assert.equal(f.resources.addStacks(),false);const g=make({skill:2});assert.equal(g.resources.beginHp(),false);
});
test('Crackborne typed protection is applied once before a later elemental barrier preview',()=>{
 const f=make(),{b,u}=f;let pool=20;
 b.on('elementHit',c=>{if(c.target!==u)return;const factor=c.dmg.mul*u.s.elemTakenMul;const incoming=c.dmg.amount*factor,take=Math.min(pool,incoming);pool-=take;c.dmg.amount=(incoming-take)/factor;},{priority:-2000});
 injure(f,100,'erosion');near(pool,0);near(u.elem.erosion,60);
});
test('Crackborne and another typed producer use one strongest channel and keep replacement registration alive',()=>{
 const f=make(),p=provider(f,.15),hook=f.b._arkpediaBerryElementHook;
 const typed=registerBerryProtection(f.b,p.u,.15,()=>true,()=>true,{elements:{erosion:.25}});typed();p.sync.remove();
 assert.equal(f.b._arkpediaBerryElementHook,hook);injure(f,100,'erosion');near(f.u.elem.erosion,75);
 f.resources.stop();f.u.elem.erosion=0;injure(f,100,'erosion');near(f.u.elem.erosion,75);typed.remove();
});
test('Crackborne full external elemental protection stays finite and blocks typed input completely',()=>{
 const f=make(),p=provider(f,1);injure(f,100,'erosion');near(f.u.elem.erosion,0);assert.deepEqual(f.b.errors,[]);p.sync.remove();
});
test('Crackborne rejected shared protection output never creates a hidden typed multiplier',()=>{
 const f=make({defer:true});f.b.on('beforeBuff',c=>{if(c.buff.key==='source:mberry-safe-zone')c.cancel=true;});f.deploy();injure(f,100,'erosion');near(f.u.elem.erosion,100);
});
test('Crackborne a fatal floor that still loses HP spends a stack, while repeated floor hits spend none',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f;r.addStacks();u.hp=10;b.addBuff(u,{key:'qa:floor',flags:{undeadable:true}});
 hurt(f,10000);near(u.hp,1);assert.equal(r.stacks(),4);hurt(f,10000);assert.equal(r.stacks(),4);
});
