// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-sniper-third-prefabs.json' with { type: 'json' };
import { FIVE_STAR_SNIPER_THIRD_OPERATORS } from '../shared/arkpedia/five-star-sniper-third-operators.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { canTargetAlly } from '../server/sim/targeting.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const T='char_363_toddi',L='char_4014_lunacu',G='char_1027_greyy2';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const nodes=rs=>rs.flatMap(r=>r.components);
function make(id,{skill=0,rank=10,elite=2,potential=1}={}){
 const d=structuredClone(data);assert.ok(d.operators[id],`Reviewed snapshot required: ${id}`);
 d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const o=d.operators[id],build={...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,
  skillId:o.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build]});b.autoFinish=false;b.timeLimit=Infinity;b.setViewport('fullscreen-workspace');
 b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(id,1,7,'RIGHT');assert.ok(u);u.atkCd=1000;return{b,u};
}
function advance(b,s){for(let n=0;n<Math.round(s/b.dt);n++)b.step();assert.deepEqual(b.errors,[]);}
function enemy(b,x=8,y=1,{hp=100000,def=0,flying=false,sarkaz=false,weight=1}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});e.x=x;e.y=y;e.base.maxHp=e.hp=hp;e.base.def=def;
 e.base.res=e.base.moveSpeed=0;e.base.massLevel=weight;if(flying)e.motion='FLY';if(sarkaz)e.tags.add('sarkaz');e.markDirty();
 b.addBuff(e,{key:'pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.gainSp(u.skill.spCost*u.skill.maxCharges,'test');assert.equal(b.activateOperator(u.defId),true);u.atkCd=1000;}
function attack(b,u,e,s){b.forceAttack(u,[e]);advance(b,s);}

test('third sniper source keeps original formulas, pointer identities, colliders and explicit whole-kit deferrals',()=>{
 assert.equal(evidence.frameParity,false);assert.equal(Object.keys(FIVE_STAR_SNIPER_THIRD_OPERATORS).length,3);
 for(const id of['char_158_milu','char_4006_melnte']){assert.equal(REGULAR_OPERATORS[id],undefined);assert.ok(evidence.deferredOperators[id].reason.length>100);}
 for(const id of[T,L,G]){assert.match(evidence.source.bundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  for(const facing of['Front','Back'])assert.match(evidence.models[id][facing].sha256,/^[a-f0-9]{64}$/);}
 const toddi=nodes(evidence.skills.skchr_toddi_2).find(c=>c._buffs);
 assert.equal(toddi._buffs[0].attributes.attributeModifiers[0].formulaItem,1);
 const luna=evidence.templates.lunacu_t_1.eventToActions.ON_BUFF_TRIGGER[0];
 assert.equal(luna._succeedNodes.find(n=>n._buff). _buff.attributes.attributeModifiers[0].formulaItem,'MULTIPLIER');
 near(nodes(evidence.projectiles.projectile_chr_greyy2).find(c=>c.m_Radius).m_Radius,.9,1e-6);
 near(nodes(evidence.projectiles.projectile_chr_greyy2_s2).find(c=>c.m_Radius).m_Radius,1);
 assert.equal(nodes(evidence.projectiles.projectile_chr_greyy2_s2).find(c=>c._interval)._waitFirstPeriod,0);
 assert.equal(evidence.models.char_158_milu.Front.hits.Skill,undefined);
 assert.equal(nodes(evidence.projectiles.projectile_chr_melnte_s2).find(c=>c._scaleCurve)._minKey,'scale');
});

test('every selected skill rank loads each complete third sniper kit',()=>{
 for(const[id,cfg]of Object.entries(FIVE_STAR_SNIPER_THIRD_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,u}=make(id,{skill,rank});assert.equal(u.skill.id,cfg.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
});

test('Toddifons heaviest normal priority and Sarkaz talent use source tags before Physical DEF mitigation',()=>{
 for(const[elite,potential,mul]of[[0,1,1],[1,1,1.3],[1,5,1.35],[2,1,1.45],[2,5,1.5]]){
  const{b,u}=make(T,{elite,potential,rank:[4,7,10][elite]});const a=enemy(b,9,1,{sarkaz:true,weight:3,def:100}),c=enemy(b,9.1,1,{weight:2});
  assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],a);const atk=u.s.atk;attack(b,u,a,1.6);near(100000-a.hp,atk*mul-100);near(c.hp,100000);
 }
});

test('Toddifons S1 marks one heaviest Sarkaz snapshot, owns final DEF reduction/taunt, and retains mark outside range',()=>{
 const{b,u}=make(T),heavy=enemy(b,8,1,{weight:5}),a=enemy(b,9,1,{sarkaz:true,weight:2,def:100}),c=enemy(b,8.5,1,{sarkaz:true,weight:1});
 b.addBuff(a,{key:'other:def',mods:{defPct:.2}});cast(b,u);near(a.s.def,84);near(a.s.taunt,1);near(heavy.s.taunt,0);near(c.s.taunt,0);
 a.x=20;b._buildEnemyIndex();advance(b,1);near(a.s.def,84);b.retreatOperator(T);advance(b,.1);near(a.s.def,84);
 advance(b,19);near(a.s.def,120);near(a.s.taunt,0);
});

test('Toddifons S1 attack scale and talent stack on Sarkaz, while non-Sarkaz only receives skill scale',()=>{
 const{b,u}=make(T),a=enemy(b,8,1,{sarkaz:true}),c=enemy(b,8.3,1);cast(b,u);const atk=u.s.atk;
 attack(b,u,a,1.5);near(100000-a.hp,atk*1.8*1.45);attack(b,u,c,1.5);near(100000-c.hp,atk*1.8);
});

test('Toddifons S2 uses percentage BAT and exact delayed direct hit followed by moving-target radius1.2 explosion',()=>{
 const{b,u}=make(T,{skill:1}),a=enemy(b,8,1),c=enemy(b,8.8,1),far=enemy(b,10,1),air=enemy(b,8.7,1,{flying:true});
 b.addBuff(u,{key:'bat:other',mods:{batFlat:.2,batPct:.1,batMul:.8}});cast(b,u);near(u.s.bat,(u.base.bat+.2)*1.4*.8);
 advance(b,.5);const atk=u.s.atk;b.forceAttack(u,[a]);advance(b,1.8);near(a.hp,100000);advance(b,.1);near(100000-a.hp,atk*2.4);near(c.hp,100000);
 a.x=9;a.y=1;air.x=9.2;b._buildEnemyIndex();advance(b,1.5);near(100000-a.hp,atk*3.2);near(100000-c.hp,atk*.8);
 near(100000-air.hp,atk*.8);near(100000-far.hp,atk*.8);assert.equal(u.skill.ammoLeft,9);
});

test('Toddifons delayed explosion is cancelled by death or brief disappearance before its deadline',()=>{
 for(const hidden of[false,true]){
  const{b,u}=make(T,{skill:1}),a=enemy(b),c=enemy(b,8.5,1);cast(b,u);advance(b,.5);attack(b,u,a,1.9);
  if(hidden){a.hidden=true;advance(b,.05);a.hidden=false;}else b.kill(a,null);
  advance(b,2);near(c.hp,100000);
 }
});

test('Toddifons final ammunition waits for clip completion, starts ending form, and launched hits survive manual cancel/withdrawal',()=>{
 for(const retreat of[false,true]){
  const{b,u}=make(T,{skill:1}),a=enemy(b);cast(b,u);advance(b,.5);u.skill.ammoLeft=1;const atk=u.s.atk;
  b.forceAttack(u,[a]);advance(b,1.7);assert.equal(u.skill.ammoLeft,0);assert.equal(u.skill.active,true);
  if(retreat)b.retreatOperator(T);else assert.equal(b.activateOperator(T),true);
  advance(b,.3);near(100000-a.hp,atk*2.4);advance(b,1.5);near(100000-a.hp,atk*3.2);
 }
 const{b,u}=make(T,{skill:1}),a=enemy(b);cast(b,u);advance(b,.5);u.skill.ammoLeft=1;attack(b,u,a,2.8);
 assert.equal(u.skill.active,false);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');assert.equal(u.s.flags.noSp,true);advance(b,.5);assert.ok(!u.s.flags.noSp);
});

test('Toddifons original normal and S2 windup cap1 retain long crossbow release with high ASPD',()=>{
 const{b,u}=make(T,{skill:1}),e=enemy(b);b.addBuff(u,{key:'fast',mods:{aspd:200}});near(effectiveProfile(u).windup(b,u),1.367);
 cast(b,u);advance(b,.5);near(effectiveProfile(u).windup(b,u),1.633);b.forceAttack(u,[e]);advance(b,1.8);near(e.hp,100000);advance(b,.1);assert.ok(e.hp<100000);
});

test('Lunacub periodic promotion talent swaps idle camouflage and percentage interval only while a skill is active',()=>{
 for(const[elite,mul]of[[0,1],[1,1],[2,.85]]){
  const{b,u}=make(L,{elite,rank:[4,7,10][elite]}),e=enemy(b);advance(b,.13);assert.equal(!!u.s.flags.camou,elite>=1);
  cast(b,u);advance(b,.13);assert.ok(!u.findBuff('lunacu:idle-cam'));near(u.s.bat,u.base.bat*mul);
  if(elite>=1)assert.equal(canTargetAlly(e,u,true),true);u.skill.end('test');advance(b,.13);near(u.s.bat,u.base.bat);assert.equal(!!u.s.flags.camou,elite>=1);
 }
});

test('Lunacub S1 ATK and low-DEF target priority retain native cap1 and projectile25',()=>{
 const{b,u}=make(L),high=enemy(b,8,1,{def:200}),low=enemy(b,9,1);advance(b,.13);cast(b,u);advance(b,.13);
 assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],low);near(u.s.atk,u.base.atk*2);b.addBuff(u,{key:'fast',mods:{aspd:200}});
 near(effectiveProfile(u).windup(b,u),.7);b.forceAttack(u,[low]);advance(b,.66);near(low.hp,100000);advance(b,.2);near(100000-low.hp,u.s.atk);near(high.hp,100000);
});

test('Lunacub S2 start and kill camouflage have separate source lifetimes and repeated kills refresh instead of accumulate',()=>{
 const{b,u}=make(L,{skill:1}),a=enemy(b);advance(b,.13);cast(b,u);near(u.s.aspd,240);advance(b,.4);
 assert.equal(u.findBuff('lunacu:start-cam')?.duration,8);b.kill(a,u);assert.equal(u.findBuff('lunacu:start-cam'),null);
 const first=u.findBuff('lunacu:kill-cam');near(first.duration,8);advance(b,2);const c=enemy(b);b.kill(c,u);near(first.timeLeft,8);
 u.skill.end('test');assert.ok(u.findBuff('lunacu:kill-cam'));advance(b,.4);near(u.s.bat,u.base.bat);near(u.s.aspd,100);advance(b,8);assert.equal(u.findBuff('lunacu:kill-cam'),null);assert.equal(u.s.flags.camou,true);
});

test('Lunacub S2 expiring start camouflage exposes her before another owned kill, while other operator kills do not refresh',()=>{
 const{b,u}=make(L,{skill:1}),a=enemy(b);advance(b,.13);cast(b,u);advance(b,8.2);assert.ok(!u.s.flags.camou);
 b.kill(a,null);assert.ok(!u.findBuff('lunacu:kill-cam'));const c=enemy(b);b.kill(c,u);assert.equal(u.s.flags.camou,true);
 assert.equal(effectiveProfile(u).attackVisual(b,u),'Skill_2_Loop');near(effectiveProfile(u).windup(b,u),.1);
});

test('Greyy two ground-only physical waves select independently with radius.9 and .15 delay',()=>{
 const{b,u}=make(G),a=enemy(b),c=enemy(b,7.2,1),far=enemy(b,6.5,1),air=enemy(b,8.2,1,{flying:true});b.rng.chance=()=>false;
 const atk=u.s.atk;b.forceAttack(u,[a]);advance(b,.67);near(100000-a.hp,atk);near(100000-c.hp,atk);near(far.hp,100000);near(air.hp,100000);
 c.x=6.5;far.x=7.2;b._buildEnemyIndex();advance(b,.17);near(100000-a.hp,atk*1.5);near(100000-c.hp,atk);near(100000-far.hp,atk*.5);
});

test('Greyy talent rolls before each wave damage, including Physical dodge, and scales by promotion',()=>{
 for(const[elite,prob]of[[0,0],[1,.25],[2,.4]]){
  const{b,u}=make(G,{elite,rank:[4,7,10][elite]}),a=enemy(b);let rolls=[];b.rng.chance=p=>{rolls.push(p);return true;};
  b.addBuff(a,{key:'dodge',mods:{dodgePhys:1}});attack(b,u,a,.8);near(a.hp,100000);
  assert.equal(!!a.findBuff('sluggish'),elite>=1);if(elite>=1)assert.equal(rolls.filter(p=>p===prob).length,2);
 }
});

test('Greyy S1 ATK/ASPD keeps both waves and source cap1 instead of multiplying its damage twice',()=>{
 const{b,u}=make(G),e=enemy(b);b.rng.chance=()=>false;cast(b,u);near(u.s.atk,u.base.atk*1.45);near(u.s.aspd,145);
 near(effectiveProfile(u).windup(b,u),.5);const atk=u.s.atk;attack(b,u,e,.8);near(100000-e.hp,atk*1.5);
});

test('Greyy S2 full-SP stays ready without a ground target; failed cast consumes no stock',()=>{
 const{b,u}=make(G,{skill:1});u.skill.gainSp(50,'test');assert.equal(u.skill.charges,2);assert.equal(u.skill.ready,true);
 assert.equal(b.activateOperator(G),false);assert.equal(u.skill.charges,2);const air=enemy(b,8,1,{flying:true});assert.equal(b.activateOperator(G),false);
 b.kill(air,null);enemy(b);assert.equal(b.activateOperator(G),true);assert.equal(u.skill.charges,1);assert.equal(b.activateOperator(G),false);
 assert.equal(skillHud(u.skill).ready,true);
});

test('Greyy S2 uses source event.8/full cast1.267 and cancels permanently after brief startup control',()=>{
 for(const control of[false,true]){
  const{b,u}=make(G,{skill:1}),e=enemy(b);b.rng.chance=()=>false;cast(b,u);const atk=u.s.atk;
  if(control){advance(b,.1);b.applyStatus(u,'stun',{duration:.1});advance(b,.6);}else advance(b,.7);
  near(e.hp,100000);advance(b,.15);if(control)near(e.hp,100000);else near(100000-e.hp,atk*1.3);
  assert.equal(u.s.flags.noSp,true);advance(b,.5);assert.ok(!u.s.flags.noSp);assert.ok(!u.s.flags.disarm);
 }
});

test('Greyy S2 pulses during original speed8 flight then persists at arrival with independent timer after retreat',()=>{
 const{b,u}=make(G,{skill:1}),far=enemy(b,10,1),nearUnit=enemy(b,7.5,1),air=enemy(b,7.5,1,{flying:true});
 b.rng.chance=()=>false;cast(b,u);const atk=u.s.atk;advance(b,.85);near(100000-nearUnit.hp,atk*1.3);near(far.hp,100000);near(air.hp,100000);
 advance(b,.5);b.retreatOperator(G);advance(b,1.05);near(100000-far.hp,atk*1.3);advance(b,10.5);assert.ok(far.hp<100000-atk*1.3);const hp=far.hp;advance(b,2);near(far.hp,hp);
});

test('Greyy overlapping charged balls each pulse once per1.5s without sharing a mutable cooldown or normal-talent slow',()=>{
 const{b,u}=make(G,{skill:1,elite:1,rank:7}),e=enemy(b);let rolls=[];b.rng.chance=p=>{rolls.push(p);return true;};cast(b,u);advance(b,1.4);
 const atk=u.s.atk;near(100000-e.hp,atk*1.1);assert.equal(u.skill.charges,1);assert.equal(b.activateOperator(G),true);advance(b,1.1);
 near(100000-e.hp,atk*1.1*3);assert.deepEqual(rolls.filter(p=>p!==0),[.4,.4,.4]);near(e.findBuff('sluggish').duration,1.4);
});
