// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-vanguard-third-prefabs.json' with { type: 'json' };
import { FIVE_STAR_VANGUARD_THIRD_OPERATORS as configs } from '../shared/arkpedia/five-star-vanguard-third-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const W='char_4119_wanqin',C='char_497_ctable',F='char_123_fang',M='char_208_melan',V='char_163_hpsts';
const near=(a,v,t=1e-5)=>assert.ok(Math.abs(a-v)<t,`${a} != ${v}`);
function advance(b,s){for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[]}={}) {
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const op=d.operators[id],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,...others.map(id=>defaultBuild(d.operators[id]))]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(v=>({...v,height:'LOW',build:'ALL',pass:'ALL'}));const rng=()=>.999;rng.int=()=>0;b.rng=rng;
 const deploy=(who=id,r=3,c=4,dir='RIGHT')=>{b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(who,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';b.getPlayer('arkpedia').dp=0;return u;};return{b,deploy};
}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function enemy(b,{r=3,c=5,fly=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});e.base.maxHp=100000;e.base.def=e.base.res=e.base.moveSpeed=0;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=100000;b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
function block(u,e){u.blocking=[e];e.blockedBy=u;}
const bb=(id,skill,rank=10)=>Object.fromEntries(data.operators[id].skills[skill].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
test('all four original skills and ten ranks load with original model and native selector evidence',()=>{
 for(const[id,cfg]of Object.entries(configs))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,cfg.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
 for(const id of[W,C])for(const face of['Front','Back'])assert.match(evidence.models[id][face].sha256,/^[a-f0-9]{64}$/);
 assert.ok(evidence.interpretations.some(x=>x.includes('frame parity')));
});
test('Wanqing ordinary single-target melee uses uncapped original OnAttack in both facings',()=>{
 for(const dir of['RIGHT','UP']){const{b,deploy}=make(W),u=deploy(W,3,4,dir),e=enemy(b);b.addBuff(u,{key:'test:ASPD',mods:{aspd:200}});
  const p=effectiveProfile(u);near(p.windup(b,u,[e]),.667/3);b.forceAttack(u,[e]);advance(b,.15);near(e.hp,100000);advance(b,.15);near(100000-e.hp,u.s.atk);}
});
test('Wanqing HP aura follows promotion, potential, direction, range, and owner withdrawal',()=>{
 for(const[elite,potential,common,extra]of[[0,1,0,0],[1,1,.03,.02],[1,5,.04,.02],[2,1,.05,.04],[2,5,.06,.04]]){
  const{b,deploy}=make(W,{elite,potential,rank:elite===0?4:elite===1?7:10,others:[F,M]}),u=deploy(),f=deploy(F,3,5,'RIGHT'),m=deploy(M,2,4,'UP');advance(b,.1);
  near(f.s.maxHp,f.base.maxHp*(1+common+extra));near(m.s.maxHp,m.base.maxHp*(1+common));near(u.s.maxHp,u.base.maxHp);
  f.dir='UP';advance(b,.1);near(f.s.maxHp,f.base.maxHp*(1+common));f.tileC=f.x=7;advance(b,.1);near(f.s.maxHp,f.base.maxHp);
  b.retreatOperator(W);advance(b,.1);near(m.s.maxHp,m.base.maxHp);
 }
});
test('Wanqing aura does not attach to devices or unhealable operators',()=>{
 const{b,deploy}=make(W,{others:[V]}),u=deploy(),v=deploy(V,3,5);advance(b,.1);near(v.s.maxHp,v.base.maxHp);assert.ok(!v.findBuff(`wanqing:HP:${u.id}`));
});
test('Wanqing both skills grant exact periodic DP while unblocking and never attacking',()=>{
 for(const skill of[0,1])for(const rank of[1,7,10]){const{b,deploy}=make(W,{skill,rank}),u=deploy(),e=enemy(b);block(u,e);const x=bb(W,skill,rank),interval=skill?x['wanqin_s_2[cost].interval']:x.interval;
  cast(b,u);near(u.s.blockCnt,0);assert.equal(e.blockedBy,null);u.atkCd=0;
  advance(b,interval-.1);near(b.dp,0);near(e.hp,100000);u.atkCd=1000;advance(b,.15);near(b.dp,1);b.applyStatus(u,'stun',{duration:.8});advance(b,u.skill.duration+.5);near(b.dp,x.value);assert.equal(u.skill.active,false);near(u.s.blockCnt,u.base.blockCnt);
 }
});
test('Wanqing S2 first heal and periodic heal affect every eligible surrounding operator and only matching directions get ASPD',()=>{
 const{b,deploy}=make(W,{skill:1,others:[F,M]}),u=deploy(),f=deploy(F,3,5,'RIGHT'),m=deploy(M,2,4,'UP');advance(b,.1);u.hp=f.hp=m.hp=100;const fm=f.s.aspd,mm=m.s.aspd;cast(b,u);
 near(f.s.aspd,fm+25);near(m.s.aspd,mm);advance(b,.45);near(f.hp,100);advance(b,.15);near(f.hp,100+u.s.atk*.25);near(m.hp,f.hp);near(u.hp,f.hp);
 advance(b,1);near(f.hp,100+2*u.s.atk*.25);f.dir='UP';advance(b,.1);near(f.s.aspd,fm);u.skill.end('manual');near(m.s.aspd,mm);near(f.s.aspd,fm);
});
test('Wanqing suppressed healing misses pulses without catching them up after stun',()=>{
 const{b,deploy}=make(W,{skill:1,others:[F]}),u=deploy(),f=deploy(F,3,5);advance(b,.1);f.hp=100;cast(b,u);b.applyStatus(u,'stun',{duration:1.1});advance(b,1.2);near(f.hp,100);advance(b,.45);near(f.hp,100+u.s.atk*.25);
});
test('Wanqing source auras ignore ally target-free while actual healing respects it',()=>{
 const{b,deploy}=make(W,{skill:1,others:[F]}),u=deploy(),f=deploy(F,3,5,'RIGHT');
 b.addBuff(f,{key:'test:untargetable',flags:{untargetable:true,isolated:true}});advance(b,.1);
 near(f.s.maxHp,f.base.maxHp*1.09);f.hp=100;const speed=f.s.aspd;cast(b,u);near(f.s.aspd,speed+25);
 advance(b,.7);near(f.hp,100);b.removeBuff(f,'test:untargetable');advance(b,1);assert.ok(f.hp>100);
});
test('Cantabile chooses original melee Combat for her blocker and tracked Attack for flying/ranged enemies',()=>{
 const{b,deploy}=make(C),u=deploy(),e=enemy(b,{c:6,fly:true});u.skill.end('test');assert.ok(acquireTargets(b,u,effectiveProfile(u)).includes(e));
 b.forceAttack(u,[e]);advance(b,.4);near(e.hp,100000);advance(b,.1);near(e.hp,100000);advance(b,.25);near(100000-e.hp,u.s.atk);
 const a=enemy(b,{c:4.1});block(u,a);advance(b,.1);const p=effectiveProfile(u);assert.equal(p.attackVisual(b,u,[a]),'Combat');b.forceAttack(u,[a]);advance(b,.45);near(100000-a.hp,u.s.atk);
});
test('Cantabile talent switches between ASPD and ATK, respecting promotion and potential',()=>{
 for(const[elite,potential,value]of[[0,1,0],[1,1,.06],[1,5,.08],[2,1,.12],[2,5,.14]]){const{b,deploy}=make(C,{elite,potential,rank:elite===0?4:elite===1?7:10}),u=deploy();u.skill.end('test');advance(b,.1);near(u.s.aspd,u.base.aspd+value*100);near(u.s.atk,u.base.atk);
  const e=enemy(b,{c:4.1});block(u,e);advance(b,.1);near(u.s.atk,u.base.atk*(1+value));near(u.s.aspd,u.base.aspd);e.x=e.tileC=7;b._buildEnemyIndex();e.blockedBy=null;u.blocking=[];advance(b,.1);near(u.s.aspd,u.base.aspd+value*100);
 }
});
test('Cantabile S2 uses the original downward Combat animation and attack event',()=>{
 const{b,deploy}=make(C,{skill:1}),u=deploy(C,3,4,'DOWN'),e=enemy(b,{r:3.1,c:4});block(u,e);cast(b,u);advance(b,.2);
 const p=effectiveProfile(u);assert.equal(p.attackVisual(b,u,[e]),'Skill_2_Down');near(p.windup(b,u,[e]),.433);
 b.forceAttack(u,[e]);advance(b,.4);near(e.hp,100000);advance(b,.1);near(100000-e.hp,u.s.atk);near(u.skill.ammoLeft,17);near(b.dp,1);
});
test('Cantabile S1 starts exactly once per deployment, grants DP on output instead of release, and excludes missed hits',()=>{
 const{b,deploy}=make(C),u=deploy(),e=enemy(b,{c:6});assert.equal(u.skill.activations,1);near(u.s.atk,u.base.atk*2);b.forceAttack(u,[e]);advance(b,.4);near(b.dp,0);advance(b,.4);near(b.dp,1);
 const inv=enemy(b);b.addBuff(inv,{key:'test:inv',flags:{invulnerable:true}});b.forceAttack(u,[inv]);advance(b,1);near(b.dp,1);
 const dodge=enemy(b);b.addBuff(dodge,{key:'test:dodge',mods:{dodgePhys:1}});b.forceAttack(u,[dodge]);advance(b,1);near(b.dp,1);
 advance(b,20);assert.equal(u.skill.active,false);assert.equal(u.skill.exhausted,true);b.bench[C].readyAt=b.time;b.retreatOperator(C);b.bench[C].readyAt=b.time;const next=deploy();assert.equal(next.skill.activations,1);
});
test('Cantabile S2 cap1 windup, ammo count, camouflage polling and manual cancellation',()=>{
 const{b,deploy}=make(C,{skill:1}),u=deploy(),e=enemy(b);cast(b,u);near(u.skill.ammoLeft,18);advance(b,.2);assert.equal(u.s.flags.camou,true);
 b.addBuff(u,{key:'test:ASPD',mods:{aspd:300}});const p=effectiveProfile(u);near(p.windup(b,u,[e]),.433);b.forceAttack(u,[e]);advance(b,.6);near(u.skill.ammoLeft,17);near(b.dp,1);
 block(u,e);advance(b,.1);assert.ok(!u.s.flags.camou);u.blocking=[];e.blockedBy=null;advance(b,.15);assert.equal(u.s.flags.camou,true);
 u.skill.end('manual');assert.ok(!u.s.flags.camou);advance(b,.2);near(u.s.atk,u.base.atk);
});
test('Cantabile final ammo retains skill damage and DP through the last projectile before ending',()=>{
 const{b,deploy}=make(C,{skill:1}),u=deploy(),e=enemy(b,{c:7});cast(b,u);advance(b,.2);u.skill.ammoLeft=1;const attack=u.s.atk;b.forceAttack(u,[e]);advance(b,.45);
 near(u.skill.ammoLeft,0);assert.equal(u.skill.active,true);near(b.dp,0);advance(b,.4);near(b.dp,1);near(100000-e.hp,attack);advance(b,.4);assert.equal(u.skill.active,false);assert.ok(!u.s.flags.camou);
});
test('brief control interrupts an unfired Cantabile shot without spending ammo, while released flight persists',()=>{
 const{b,deploy}=make(C,{skill:1}),u=deploy(),e=enemy(b,{c:6});cast(b,u);advance(b,.2);b.forceAttack(u,[e]);advance(b,.1);b.applyStatus(u,'stun',{duration:.1});advance(b,.6);near(u.skill.ammoLeft,18);near(e.hp,100000);
 b.forceAttack(u,[e]);advance(b,.45);b.applyStatus(u,'stun',{duration:.1});advance(b,.3);near(u.skill.ammoLeft,17);near(b.dp,1);assert.ok(e.hp<100000);
});
test('Cantabile release with noAmmo explicitly set does not consume the active skill inventory',()=>{
 const{b,deploy}=make(C,{skill:1}),u=deploy(),e=enemy(b);cast(b,u);advance(b,.2);b.forceAttack(u,[e],{noAmmo:true});advance(b,.7);near(u.skill.ammoLeft,18);
});
