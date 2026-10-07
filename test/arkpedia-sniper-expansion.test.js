// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-sniper-expansion-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile } from '../server/sim/ai.js';
const acid = 'char_366_acdrop', caper = 'char_4100_caper';
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const bbOf = level => Object.fromEntries(level.blackboard.map(({key,value})=>[key,value]));
function make(id,{skill=0,rank=10,elite=2,potential=1,enemies=1}={}) {
 const src=structuredClone(data),op=src.operators[id];
 src.stage.geometry.waves[0].spawns=enemies?[{enemy_id:'enemy_1007_slime',count:enemies,time:0,interval:0,route:1}]:[];
 Object.assign(src.enemies.enemy_1007_slime.stats,{maxHp:100000,atk:0,def:0,magicResistance:0,moveSpeed:0});
 const b=new StandardBattle(src,{operators:[{...defaultBuild(op),elite,level:1,potential,skillRank:rank,skillId:op.skills[skill].id}]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const u=b.deployOperator(id,1,7,'UP');u.atkCd=1000;b.step();
 for(const e of b.enemies){e.x=7;e.y=2;b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true},persist:true});}b.step();
 return {b,u,src};
}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function activate(u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(u.skill.activate('test'),true);}
function attack(b,u,t){const hp=t.hp;b.forceAttack(u,[t]);advance(b,1);return hp-t.hp;}

test('original sniper prefabs bind floor to range2-2, full extra bullet and real out/return boomerang speeds',()=>{
 const floor=evidence.templates.acdrop_t_1.eventToActions.ON_OUTPUT_MODIFIER[0];
 assert.equal(floor._conditionNode._rangeId,'2-2');assert.equal(floor._succeedNodes[0]._key,'atk_scale_2');
 assert.ok(evidence.characters[acid].some(x=>x._additionalProjectile==='projectile_chr_acdrop_s2'&&x._splitDamage===0));
 const move=evidence.projectiles.projectile_chr_caper.find(x=>x._speed);
 near(move._speed,15);near(move._comeBackSpeedScale,.25);near(move._delayAfterReached,.01);
});

test('Aciddrop floor applies separately per hit, varies with promotion and frontal tiles, and remains subject to mitigation multipliers/shields',()=>{
 for(const [elite,floor,front]of[[0,.05,.05],[1,.2,.3],[2,.25,.4]]){
  const {b,u}=make(acid,{elite,rank:1});const t=b.enemies[0];t.base.def=100000;t.markDirty();
  near(attack(b,u,t),u.s.atk*front);
  t.x=8;b.step();near(attack(b,u,t),u.s.atk*floor);
  if(elite===2){
   b.addBuff(t,{key:'test:resist',mods:{physTakenMul:.5}});
   near(attack(b,u,t),u.s.atk*floor*.5);
   b.addBuff(t,{key:'test:shield',shield:10000});near(attack(b,u,t),0);
  }
 }
 const {b,u}=make(acid,{skill:1});const t=b.enemies[0];t.base.def=100000;t.markDirty();activate(u);
 near(attack(b,u,t),2*u.s.atk*.4);
});

test('Aciddrop both skills use every rank source ASPD/ATK and return to normal, with two full S2 damage events',()=>{
 for(let rank=1;rank<=10;rank++)for(const skill of[0,1]){
  const {b,u,src}=make(acid,{skill,rank}),t=b.enemies[0],base=u.s.atk,aspd=u.s.aspd;
  const level=src.operators[acid].skills[skill].levels[rank-1],bb=bbOf(level);activate(u);
  near(u.s.atk,base*(1+(bb.atk??0)));near(u.s.aspd,aspd+(bb.attack_speed??0));
  let hits=0;b.on('damaged',x=>{if(x.source===u)hits++;});
  near(attack(b,u,t),u.s.atk*(skill?2:1));assert.equal(hits,skill?2:1);
  advance(b,level.duration);near(u.s.atk,base);near(u.s.aspd,aspd);
 }
});

test('Caper waits all boomerangs to return, using slow source return speed and one offensive-SP gain per attack',()=>{
 const {b,u}=make(caper,{skill:1});const t=b.enemies[0];t.y=3;b.step();
 b.rng.chance=()=>false;u.atkCd=0;advance(b,.6);
 assert.equal(u.trait.boomerangsOut,1);const count=u.stats.attacks;
 near(t.hp,100000);advance(b,.2);near(100000-t.hp,u.s.atk);
 u.atkCd=0;advance(b,.3);assert.equal(u.stats.attacks,count);assert.equal(u.trait.boomerangsOut,1);
 u.atkCd=1000;advance(b,.6);assert.equal(u.trait.boomerangsOut,0);
 near(u.skill.spTotal,16);u.atkCd=0;advance(b,.1);assert.equal(u.stats.attacks,count+1);
});

test('Caper S1 next attack source scale, per-hit critical and S2 two boomerangs are rank/potential aware',()=>{
 for(let rank=1;rank<=10;rank++){
  const {b,u,src}=make(caper,{rank}),t=b.enemies[0];b.rng.chance=()=>false;
  const bb=bbOf(src.operators[caper].skills[0].levels[rank-1]);activate(u);
  near(attack(b,u,t),u.s.atk*bb.atk_scale);assert.equal(u.skill.pending,false);
  advance(b,1);near(attack(b,u,t),u.s.atk);
  const x=make(caper,{skill:1,rank}),base=x.u.s.atk;x.b.rng.chance=()=>false;activate(x.u);
  const skillbb=bbOf(x.src.operators[caper].skills[1].levels[rank-1]);near(x.u.s.atk,base*(1+skillbb.atk));
  x.b.forceAttack(x.u,x.b.enemies);advance(x.b,.5);assert.equal(x.u.trait.boomerangsOut,2);
  advance(x.b,.6);near(100000-x.b.enemies[0].hp,2*x.u.s.atk);assert.equal(x.u.trait.boomerangsOut,0);
  advance(x.b,21);near(x.u.s.atk,base);
 }
 const {b,u}=make(caper,{potential:6});b.rng.chance=()=>true;near(attack(b,u,b.enemies[0]),u.s.atk*1.6);
 assert.equal(effectiveProfile(u).hits,1);
});

test('Caper launched damage survives retreat without crediting a returned boomerang to a replacement deployment',()=>{
 const {b,u}=make(caper,{skill:1});b.rng.chance=()=>false;const t=b.enemies[0];
 b.forceAttack(u,[t]);advance(b,.6);assert.equal(u.trait.boomerangsOut,1);
 b.retreatOperator(caper);advance(b,.5);near(100000-t.hp,u.s.atk);
 assert.equal(b.errors.length,0);
});

test('source model inspection keeps standard S1 attack roles and specialized S2 loops for both facings',()=>{
 for(const facing of['front','back']){
  const m=evidence.models[`${caper}/${facing}`];assert.equal(m.source.commit,'d0b5af0b004b044d322397ce5ae79632b6d9fcdd');
  assert.equal(m.animationRoles.skills[0].loop,'Attack');assert.equal(m.animationRoles.skills[1].loop,'Skill_Loop');
  near(m.hits.Attack[0],.533);near(m.hits.Skill_Loop[0],.367);
 }
});
