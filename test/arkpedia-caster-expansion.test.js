// SPDX-License-Identifier: GPL-3.0-or-later
import {test} from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with{type:'json'};
import evidence from '../data/arkpedia-caster-expansion-prefabs.json' with{type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {acquireTargets,effectiveProfile} from '../server/sim/ai.js';
const click='char_328_cammou',indigo='char_469_indigo',pudding='char_4004_pudd';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const bbOf=l=>Object.fromEntries(l.blackboard.map(({key,value})=>[key,value]));
function make(id,{skill=0,rank=10,elite=2,potential=1,enemies=1}={}){
 const src=structuredClone(data),op=src.operators[id];src.stage.geometry.waves[0].spawns=enemies?[{enemy_id:'enemy_1007_slime',count:enemies,time:0,interval:0,route:1}]:[];
 Object.assign(src.enemies.enemy_1007_slime.stats,{maxHp:100000,atk:0,def:0,magicResistance:0,moveSpeed:0});
 const b=new StandardBattle(src,{operators:[{...defaultBuild(op),elite,level:1,potential,skillRank:rank,skillId:op.skills[skill].id}]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);const u=b.deployOperator(id,1,7,'UP');u.atkCd=1000;b.step();
 for(const e of b.enemies){pin(b,e,7,2);}b.step();return{b,u,src};
}
function pin(b,e,x,y){e.x=x;e.y=y;b.addBuff(e,{key:'pin',flags:{noMove:true,disarm:true},persist:true});}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function activate(u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(u.skill.activate('test'),true);}
function attack(b,u,t,seconds=1.5){const hp=t.hp;b.forceAttack(u,[t]);advance(b,seconds);return hp-t.hp;}

test('caster evidence retains unlocked Bind selector, owner-independent funnel and source bounce fields',()=>{
 assert.ok(evidence.characters[indigo].some(x=>x._abnormalFlagExcluded===1&&x._abnormalFlags?.includes(13)));
 assert.ok(evidence.projectiles.projectile_chr_cammou_funnel_s2.some(x=>x._waitFirstPeriod===0));
 const bounce=evidence.projectiles.projectile_chr_pudd_s2.find(x=>x._perDamageInterval);
 near(bounce._perDamageInterval,.15);near(bounce._atkScaleRatePerBounce,.85);
 assert.equal(bounce._bounceTimesAsDamageTimes,0);assert.equal(bounce._allowRepetitionIfNoTarget,1);
});

test('Click normal attacks include caster and ramping drone damage, reset per target and source S1 scales both at all ranks',()=>{
 const {b,u}=make(click,{enemies:2});const[a,z]=b.enemies;b.rng.chance=()=>false;
 for(const scale of[1.2,1.35,1.5,1.65,1.8,1.95,2.1,2.1])near(attack(b,u,a),u.s.atk*scale);
 near(attack(b,u,z),u.s.atk*1.2);
 for(let rank=1;rank<=10;rank++){
  const x=make(click,{rank}),base=x.u.s.atk,bb=bbOf(x.src.operators[click].skills[0].levels[rank-1]);activate(x.u);
  near(attack(x.b,x.u,x.b.enemies[0]),base*(1+bb.atk)*1.2);
  advance(x.b,26);near(x.u.s.atk,base);
 }
});

test('Click S2 independently locks/follows its drone outside range, rolls both stuns and returns on expiry/retreat',()=>{
 const {b,u}=make(click,{skill:1,enemies:2}),[a,z]=b.enemies;pin(b,z,6,2);b.step();activate(u);
 b.rng.chance=()=>true;const statuses=[];b.on('statusApplied',x=>{if(x.source===u&&x.status==='stun')statuses.push(x);});
 const hp=a.hp;b.forceAttack(u,[a]);advance(b,.7);assert.ok(statuses.length>=2);assert.equal(u.mem.clickDrone.target,a);
 const amount=a.hp;pin(b,a,10,3);b.step();assert.ok(!acquireTargets(b,u,effectiveProfile(u)).includes(a));
 advance(b,u.s.interval+.1);assert.ok(a.hp<amount);assert.equal(u.mem.clickDrone.target,a);
 b.kill(a,u);advance(b,.1);assert.equal(u.mem.clickDrone,null);
 b.forceAttack(u,[z]);advance(b,.7);assert.equal(u.mem.clickDrone.target,z);
 b.retreatOperator(click);const after=z.hp;advance(b,2);near(z.hp,after);assert.ok(hp>a.hp);
});

test('Click locked drone skips hidden or untargetable periods without queuing attacks on return',()=>{
 const {b,u}=make(click,{skill:1}),t=b.enemies[0];activate(u);b.rng.chance=()=>false;
 b.forceAttack(u,[t]);advance(b,.7);assert.equal(u.mem.clickDrone.target,t);
 const hits=[];b.on('damaged',x=>{if(x.source===u)hits.push(b.time);});
 for(const state of['hidden','untargetable']){
  if(state==='hidden')t.hidden=true;else b.addBuff(t,{key:'test:untargetable',flags:{untargetable:true}});
  const hp=t.hp;advance(b,u.s.interval*3+.1);near(t.hp,hp);
  assert.equal(u.mem.clickDrone.cooldown,0);
  if(state==='hidden')t.hidden=false;else b.removeBuff(t,'test:untargetable');
  const count=hits.length;advance(b,b.dt);assert.equal(hits.length,count+1);
  const after=t.hp;advance(b,u.s.interval-b.dt*2);near(t.hp,after);
  advance(b,b.dt*2);assert.equal(hits.length,count+2);
 }
});

test('Indigo excludes Bound targets only with unlocked talent and rolls Bind independently for each released stored projectile',()=>{
 for(const elite of[0,1,2]){
  const {b,u}=make(indigo,{elite,rank:1,enemies:2}),[a,z]=b.enemies;b.applyStatus(a,'bind',{duration:20});b.step();
  const targets=acquireTargets(b,u,effectiveProfile(u));assert.equal(targets.includes(a),elite===0);
  if(elite>0)assert.deepEqual(targets,[z]);
 }
 const {b,u}=make(indigo);const t=b.enemies[0];pin(b,t,12,4);b.step();advance(b,u.s.interval*3+.1);
 assert.equal(u.trait.stored,3);pin(b,t,7,2);b.step();const applied=[];b.rng.chance=()=>true;
 b.on('statusApplied',x=>{if(x.source===u&&x.status==='bind')applied.push(x);});
 near(attack(b,u,t,1.5),u.s.atk*4);assert.equal(u.trait.stored,0);assert.equal(applied.length,4);
});

test('Indigo S1 narrows range, reduces final BAT, preserves outside interval buffs and uses half damage at every rank',()=>{
 for(let rank=1;rank<=10;rank++){
  const {b,u}=make(indigo,{rank,enemies:2}),[a,z]=b.enemies;pin(b,z,6,2);b.step();const bat=u.base.bat;
  b.addBuff(u,{key:'outside:interval',mods:{batPct:.3}});activate(u);near(u.s.bat,bat*1.3*.2);
  assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);b.rng.chance=()=>false;
  near(attack(b,u,a),u.s.atk*bbOf(data.operators[indigo].skills[0].levels[rank-1])['attack@atk_scale']);advance(b,4.1);near(u.s.bat,bat*1.3);
 }
});

test('Indigo S2 polls Bind and waits first DOT interval, preserves target ownership, and removes damage on leaving/unbinding/expiry',()=>{
 const {b,u}=make(indigo,{skill:1,enemies:2}),[a,z]=b.enemies;pin(b,z,6,2);b.step();activate(u);
 near(u.s.bat,u.base.bat*.6);b.applyStatus(a,'bind',{duration:10});const hp=a.hp;
 advance(b,.5);near(a.hp,hp);advance(b,.25);near(hp-a.hp,u.s.atk*.2);near(z.hp,100000);
 pin(b,a,12,4);b.step();const amount=a.hp;advance(b,1);near(a.hp,amount);
 pin(b,a,7,2);b.step();advance(b,.8);assert.ok(a.hp<amount);
 b.removeBuff(a,'bind');b.step();const after=a.hp;advance(b,1);near(a.hp,after);
 b.applyStatus(a,'bind',{duration:40});advance(b,22);const done=a.hp;advance(b,2);near(a.hp,done);
});

test('Pudding normal chains obey promotion target cap, radius/falloff and Sluggish; S1 source ASPD expires at every rank',()=>{
 for(const[elite,count]of[[0,3],[1,3],[2,4]]){
  const {b,u}=make(pudding,{elite,rank:1,enemies:5});for(let i=0;i<5;i++)pin(b,b.enemies[i],7+i*.3,2);b.step();
  const hp=b.enemies.map(x=>x.hp);b.forceAttack(u,[b.enemies[0]]);advance(b,.7);
  for(let i=0;i<count;i++)near(hp[i]-b.enemies[i].hp,u.s.atk*Math.pow(.85,i));
  near(b.enemies[4].hp,100000);assert.ok(b.enemies[count-1].findBuff('sluggish'));
 }
 for(let rank=1;rank<=10;rank++){
  const {b,u,src}=make(pudding,{rank}),aspd=u.s.aspd,bb=bbOf(src.operators[pudding].skills[0].levels[rank-1]);activate(u);
  near(u.s.aspd,aspd+bb.attack_speed);near(attack(b,u,b.enemies[0]),u.s.atk);advance(b,26);near(u.s.aspd,aspd);
 }
});

test('Pudding S2 prefers unused neighbors, then revisits earlier targets with travel, falloff and bounded bounce count',()=>{
 const {b,u}=make(pudding,{skill:1,enemies:3}),[a,z,out]=b.enemies;pin(b,z,8,2);pin(b,out,11,4);b.step();activate(u);
 const hits=[];b.on('damaged',x=>{if(x.source===u)hits.push([x.target,b.time,x.amount]);});
 b.forceAttack(u,[a]);advance(b,.6);assert.equal(hits.length,1);
 advance(b,1.3);assert.deepEqual(hits.map(x=>x[0]),[a,z,a,z,a]);near(out.hp,100000);
 for(let i=0;i<hits.length;i++){near(hits[i][2],u.s.atk*Math.pow(.85,i));if(i)assert.ok(hits[i][1]-hits[i-1][1]>=.15-1e-8);}
 const hp=a.hp;advance(b,2);near(a.hp,hp);advance(b,21);assert.equal(u.skill.active,false);
});

test('caster S2 blackboards control actual ATK, final interval and proc chance at every rank',()=>{
 for(let rank=1;rank<=10;rank++){
  for(const id of[click,pudding]){
   const {b,u,src}=make(id,{skill:1,rank}),base=u.s.atk,bb=bbOf(src.operators[id].skills[1].levels[rank-1]);
   activate(u);near(u.s.atk,base+u.base.atk*bb.atk);
   const amounts=[];b.on('damaged',x=>{if(x.source===u)amounts.push(x.amount);});b.rng.chance=()=>false;
   b.forceAttack(u,b.enemies);advance(b,.7);
   assert.ok(amounts.some(x=>Math.abs(x-u.s.atk)<1e-5));
   advance(b,31);near(u.s.atk,base);
  }
  const {b,u,src}=make(indigo,{skill:1,rank}),bb=bbOf(src.operators[indigo].skills[1].levels[rank-1]);
  activate(u);near(u.s.bat,u.base.bat*bb.base_attack_time);const rolls=[];
  b.rng.chance=p=>{rolls.push(p);return false;};b.forceAttack(u,b.enemies);advance(b,.7);
  assert.equal(rolls.length,1);near(rolls[0],.18*bb.talent_scale);
  advance(b,21);near(u.s.bat,u.base.bat);
 }
});

test('source-timed Indigo stores are not consumed by interrupted windup and Pudding releases a fizzled normal projectile',()=>{
 const {b,u}=make(indigo),t=b.enemies[0];pin(b,t,12,4);b.step();advance(b,9);
 assert.equal(u.trait.stored,3);pin(b,t,7,2);b.step();b.forceAttack(u,[t]);advance(b,.3);
 b.applyStatus(u,'stun',{duration:2});advance(b,1);near(t.hp,100000);assert.equal(u.trait.stored,3);
 const x=make(pudding),a=x.b.enemies[0];pin(x.b,a,7,4);x.b.step();
 x.b.forceAttack(x.u,[a]);advance(x.b,.45);assert.equal(x.u.mem.puddingProjectile,true);
 x.b.kill(a,x.u);advance(x.b,.1);assert.equal(x.u.mem.puddingProjectile,false);
});
