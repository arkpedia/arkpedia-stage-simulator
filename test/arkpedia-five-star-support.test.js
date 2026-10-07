// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-support-prefabs.json' with { type: 'json' };
import { FIVE_STAR_SUPPORT_OPERATORS } from '../shared/arkpedia/five-star-support-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const RED='char_144_red',WAAI='char_243_waaifu',KAFKA='char_214_kafka',PRAM='char_174_slbell',GLAU='char_326_glacus';
const near=(a,e)=>assert.ok(Math.abs(a-e)<1e-5,`${a} != ${e}`);
function advance(b,seconds){for(let i=0;i<Math.round(seconds/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function make(id,{skill=0,rank=10,elite=2,potential=1}={}){
  const source=structuredClone(data),op=source.operators[id];assert.ok(op,`Reviewed snapshot required: ${id}`);
  source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
  const b=new StandardBattle(source,{operators:[{...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
    potential,skillId:op.skills[skill].id,skillRank:rank}]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
  const deploy=()=>{const u=b.deployOperator(id,id===PRAM||id===GLAU?1:3,id===PRAM||id===GLAU?4:3,id===PRAM||id===GLAU?'UP':'RIGHT');u.atkCd=1000;return u;};
  return{b,deploy,source};
}
function enemy(b,{row=3,col=4,def=0,res=0,fly=false,drone=false}={}){
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});e.base.maxHp=100000;e.hp=100000;e.base.def=def;e.base.res=res;e.base.atk=100;
  if(fly)e.motion='FLY';if(drone)e.tags.add('drone');e.markDirty();
  b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(b.activateOperator(u.defId),true);u.atkCd=1000;}
function strike(b,u,e,seconds=1){const before=e.hp;b.forceAttack(u,[e]);u.atkCd=1000;advance(b,seconds);return before-e.hp;}
function bb(id,skill,rank){const source=data.operators[id].skills[skill].levels[rank-1],values=Object.fromEntries(source.blackboard.map(r=>[r.key,r.value]));return{...values,duration:source.duration>0?source.duration:values.duration};}

test('original five-star support evidence preserves deployment selectors, modifier families and native timing',()=>{
  for(const id of Object.keys(FIVE_STAR_SUPPORT_OPERATORS)){
    assert.ok(evidence.characters[id].length);assert.match(evidence.sourceBundles.find(b=>b.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
    assert.match(evidence.models[id].Front.sha256,/^[a-f0-9]{64}$/);
  }
  assert.equal(evidence.skills.skchr_red_2.find(r=>'_targetMotion'in r)._targetMotion,1);
  assert.equal(evidence.skills.skchr_waaifu_2.find(r=>'_damageType'in r)._waitForAttackEvent,1);
  assert.equal(evidence.templates['glacus_s_2_damage[drone]'].eventToActions.ON_BUFF_START[1]._emitSourceOnCalculateDamage,false);
  assert.equal(evidence.projectiles.projectile_kafka_s2.find(r=>'_onlyCheckHitWhenStop'in r)._onlyCheckHitWhenStop,1);
});
test('all ten original skills resolve at every source rank and retain phase unlock and passive recovery policy',()=>{
  for(const[id,config]of Object.entries(FIVE_STAR_SUPPORT_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,config.skillIds[skill]);
    assert.equal(u.def.raw.arkpedia.skillRank,rank);assert.equal(u.skill.noSkill,false);
    if([RED,WAAI,KAFKA].includes(id)){assert.equal(u.skill.manual,false);assert.equal(u.skill.ready,false);}
    assert.deepEqual(b.errors,[]);
  }
});
test('Red S1 source ATK and physical/Arts dodge expire after10 seconds, reset on redeploy, and never dodge true damage',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(RED,{rank}),u=deploy(),s=bb(RED,0,rank),base=u.base.atk;
    near(u.s.atk,base*(1+s.atk));near(u.s.dodgePhys,s.prob);near(u.s.dodgeArts,s.prob);
    b.rng=()=>0;let hp=u.hp;b.dealDamage(null,u,{amount:100,type:'phys'});near(u.hp,hp);
    b.dealDamage(null,u,{amount:100,type:'arts'});near(u.hp,hp);
    b.dealDamage(null,u,{amount:100,type:'true'});near(u.hp,hp-100);
    advance(b,10.1);near(u.s.atk,base);near(u.s.dodgePhys,0);near(u.s.dodgeArts,0);
    b.retreat(u);advance(b,b.bench[RED].readyAt-b.time+.1);b.addDp('arkpedia',99);const again=deploy();near(again.s.atk,again.base.atk*(1+s.atk));
  }
});
test('Red source talent floors post-mitigation damage by phase/potential and retains physical/incoming multipliers',()=>{
  for(const[elite,potential,ratio]of[[0,1,.05],[1,1,.2],[1,5,.23],[2,1,.3],[2,5,.33]]){
    const{b,deploy}=make(RED,{elite,potential,rank:[4,7,10][elite]}),u=deploy(),e=enemy(b,{def:10000});
    b.addBuff(e,{key:'test:physical',mods:{physTakenMul:.5}});near(strike(b,u,e),u.s.atk*ratio*.5);
  }
});
test('Red S2 deployment hits/stuns all nearby ground enemies once at every rank, excluding air and respecting control immunity',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(RED,{rank,skill:1}),ground=enemy(b),air=enemy(b,{fly:true}),immune=enemy(b,{col:3.7});
    immune.def={...immune.def,immune:new Set(['stun'])};const u=deploy(),s=bb(RED,1,rank);
    near(100000-ground.hp,u.s.atk*s.atk_scale);assert.ok(ground.s.flags.stun);near(air.hp,100000);assert.equal(Boolean(immune.s.flags.stun),false);
    advance(b,s.stun+.1);assert.equal(Boolean(ground.s.flags.stun),false);near(100000-ground.hp,u.s.atk*s.atk_scale);
  }
});
test('Waai Fu S1 uses source ATK boost/debuff and duration at all ranks; ordinary talent is a per-hit proc with source force',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(WAAI,{rank}),u=deploy(),e=enemy(b),s=bb(WAAI,0,rank);b.rng.chance=()=>false;
    near(u.s.atk,u.base.atk*(1+s['waaifu_s_1[self].atk']));near(strike(b,u,e),u.s.atk);
    near(e.s.atk,100*(1+s['attack@waaifu_s_1[debuff].atk']));advance(b,s['attack@waaifu_s_1[debuff].duration']+.1);near(e.s.atk,100);
    advance(b,10.1);near(u.s.atk,u.base.atk);
  }
  const{b,deploy}=make(WAAI,{potential:5}),u=deploy(),e=enemy(b);b.rng.chance=()=>true;
  const calls=[];const push=b.push.bind(b);b.push=(...args)=>{calls.push(args);return push(...args);};
  near(strike(b,u,e),u.s.atk*1.6);assert.equal(calls.length,1);near(calls[0][1],-1);assert.deepEqual(calls[0][2].dir,{x:1,y:0});
});
test('Waai Fu S2 waits for source Start_2 strike, silences ground targets at all ranks and does not apply its S1 debuff',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(WAAI,{rank,skill:1}),e=enemy(b),air=enemy(b,{fly:true});b.rng.chance=()=>true;const u=deploy(),s=bb(WAAI,1,rank);
    assert.equal(u.mem.regularFormVisual.clip,'Start_2');advance(b,.4);near(e.hp,100000);advance(b,.15);
    near(100000-e.hp,u.s.atk*s.atk_scale);assert.ok(e.s.flags.silence);near(air.hp,100000);near(e.s.atk,100);
    advance(b,s.silence+.1);assert.equal(Boolean(e.s.flags.silence),false);
  }
});
test('Kafka S1 sleeps only initial ground targets, drops block with camouflage, and delivers source Arts finisher/talent tail after sleep ends',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(KAFKA,{rank}),e=enemy(b,{res:20}),air=enemy(b,{fly:true}),u=deploy(),s=bb(KAFKA,0,rank),base=u.base.atk;
    assert.ok(e.s.flags.sleep);assert.equal(Boolean(air.s.flags.sleep),false);near(u.s.blockCnt,0);assert.ok(u.s.flags.camou);
    assert.equal(effectiveProfile(u).noAttack,true);const late=enemy(b,{col:3.7});assert.equal(Boolean(late.s.flags.sleep),false);
    advance(b,5.1);assert.equal(Boolean(e.s.flags.sleep),false);near(e.hp,100000);assert.equal(u.skill.active,false);
    near(u.s.atk,base*1.15);advance(b,.3);near(100000-e.hp,base*1.15*s.atk_scale*.8);near(100000-late.hp,base*1.15*s.atk_scale);near(air.hp,100000);
    assert.equal(Boolean(u.s.flags.camou),false);near(u.s.blockCnt,1);advance(b,.5);near(u.s.atk,base);
  }
});
test('Kafka withdrawal cancels an unfired S1 finisher and leaves already inflicted source sleep duration intact',()=>{
  const{b,deploy}=make(KAFKA),e=enemy(b),u=deploy();assert.ok(e.s.flags.sleep);advance(b,2);b.retreat(u);assert.ok(e.s.flags.sleep);advance(b,4);
  near(e.hp,100000);assert.equal(Boolean(e.s.flags.sleep),false);
});
test('Kafka S2 fixed tile burst hits all ground/air occupants once after .2s; sustained Arts attacks hit one ground target only and restore on expiry',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(KAFKA,{rank,skill:1}),e=enemy(b,{col:6}),other=enemy(b,{col:6.1}),air=enemy(b,{col:6,fly:true}),outside=enemy(b,{col:5}),u=deploy(),s=bb(KAFKA,1,rank);
    assert.deepEqual(u.def.skill.rangeGrid,[[0,3]]);
    advance(b,.1);near(e.hp,100000);advance(b,.2);
    for(const t of[e,other,air])near(100000-t.hp,u.s.atk*s.atk_scale);near(outside.hp,100000);
    const p=effectiveProfile(u);assert.equal(p.dmgType,'arts');assert.equal(p.canHitFly,false);near(p.windup(b,u),.363);
    const before=e.hp,hp2=other.hp,hp3=air.hp;const list=acquireTargets(b,u,p);assert.equal(list.length,1);assert.ok(list[0]!==air);
    b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.5);near(before-e.hp,u.s.atk);near(other.hp,hp2);near(air.hp,hp3);
    advance(b,s.duration);assert.equal(u.skill.active,false);assert.equal(effectiveProfile(u).dmgType,'phys');near(u.s.blockCnt,1);
  }
});
test('Pramanix second-target talent is E2-only and S1 independently selects two targets with source ASPD aura at every rank',()=>{
  for(const elite of[0,1,2]){
    const{b,deploy}=make(PRAM,{elite,rank:[4,7,10][elite]}),u=deploy();for(let i=0;i<3;i++)enemy(b,{row:2,col:4+i*.1});b._buildEnemyIndex();
    assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,elite===2?2:1);cast(b,u);
    assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,2);
  }
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(PRAM,{rank}),u=deploy(),e=enemy(b,{row:2,col:4}),s=bb(PRAM,0,rank);cast(b,u);
    near(e.s.aspd,100+s.attack_speed);const p=effectiveProfile(u);assert.equal(p.projectile,'none');near(p.windup,.5);
    e.x=8;advance(b,.1);near(e.s.aspd,100);e.x=4;advance(b,.1);near(e.s.aspd,100+s.attack_speed);
    advance(b,s.duration);near(e.s.aspd,100);
  }
});
test('Pramanix Fragile strict HP threshold follows original source promotion/potential, strongest status overlap, range exits and owner removal',()=>{
  for(const[elite,potential,scale]of[[0,1,1],[1,1,1.15],[1,5,1.18],[2,1,1.3],[2,5,1.33]]){
    const{b,deploy}=make(PRAM,{elite,potential,rank:[4,7,10][elite]}),u=deploy(),e=enemy(b,{row:2,col:4});e.hp=40000;
    advance(b,.1);near(e.s.dmgTakenMul,1);e.hp=39999;advance(b,.1);near(e.s.dmgTakenMul,scale);
    b.applyStatus(e,'fragile',{key:'test:fragile',duration:10,value:.5});near(e.s.dmgTakenMul,1.5);
    b.removeBuff(e,'test:fragile');near(e.s.dmgTakenMul,scale);e.x=8;advance(b,.1);near(e.s.dmgTakenMul,1);
    e.x=4;advance(b,.1);near(e.s.dmgTakenMul,scale);b.retreat(u);near(e.s.dmgTakenMul,1);
  }
});
test('Pramanix S2 uses final DEF/RES multipliers at every rank, affects ground/air/late entrants and clears only its own aura',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(PRAM,{rank,skill:1}),u=deploy(),e=enemy(b,{row:2,col:4,def:500,res:50,fly:true}),s=bb(PRAM,1,rank);
    b.addBuff(e,{key:'test:other-def',mods:{defPct:.5,defFlat:100}});cast(b,u);
    near(e.s.def,900*(1+s.def));near(e.s.res,50*(1+s.magic_resistance));
    const late=enemy(b,{row:2,col:4.1,def:500,res:50});advance(b,.1);near(late.s.def,500*(1+s.def));
    b.retreat(u);near(e.s.def,900);near(e.s.res,50);near(late.s.def,500);assert.ok(e.findBuff('test:other-def'));
  }
});
test('Glaucus prioritizes source drone tag and scales its normal Arts attack before RES, without treating all fliers as drones',()=>{
  for(const[elite,potential,scale]of[[0,1,1],[1,1,1.25],[1,5,1.3],[2,1,1.5],[2,5,1.55]]){
    const{b,deploy}=make(GLAU,{elite,potential,rank:[4,7,10][elite]}),u=deploy(),e=enemy(b,{row:2,col:4,res:20,drone:true}),air=enemy(b,{row:2,col:4.1,fly:true});b._buildEnemyIndex();
    assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],e);near(strike(b,u,e),u.s.atk*scale*.8);
    near(strike(b,u,air),u.s.atk);assert.ok(air.findBuff('sluggish'));
  }
});
test('Glaucus S1 boosts source ATK and hits exactly two targets at every rank, then restores normal one-target profile',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(GLAU,{rank}),u=deploy();for(let i=0;i<3;i++)enemy(b,{row:2,col:4+i*.1});b._buildEnemyIndex();const base=u.s.atk,s=bb(GLAU,0,rank);cast(b,u);
    near(u.s.atk,base*(1+s.atk));assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,2);
    advance(b,s.duration+.1);near(u.s.atk,base);assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);
  }
});
test('Glaucus EMP releases at original Skill frame, binds normal ground/air, stuns drones, and never multiplies talent twice at any rank',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(GLAU,{rank,skill:1}),u=deploy(),e=enemy(b,{row:2,col:4,res:20,drone:true}),normal=enemy(b,{row:2,col:4.1}),air=enemy(b,{row:2,col:4.2,fly:true}),s=bb(GLAU,1,rank);cast(b,u);
    advance(b,.7);near(e.hp,100000);advance(b,.2);
    near(100000-e.hp,u.s.atk*s['atk_scale[drone]']*.8);assert.ok(e.s.flags.stun);assert.equal(Boolean(e.s.flags.bind),false);
    for(const t of[normal,air]){near(100000-t.hp,u.s.atk*s['atk_scale[normal]']);assert.ok(t.s.flags.bind);assert.equal(Boolean(t.s.flags.freeze),false);near(t.s.res,0);}
    advance(b,s.frozen+.1);assert.equal(Boolean(e.s.flags.stun),false);assert.equal(Boolean(air.s.flags.bind),false);
  }
});

test('Waai Fu deployment strike cannot outlive retreat and a fresh deployment gets its own source strike',()=>{
  const{b,deploy}=make(WAAI,{skill:1}),e=enemy(b),u=deploy();b.rng.chance=()=>false;
  advance(b,.2);b.retreat(u);advance(b,.4);near(e.hp,100000);assert.equal(Boolean(e.s.flags.silence),false);
  advance(b,b.bench[WAAI].readyAt-b.time+.1);b.addDp('arkpedia',99);const next=deploy();
  advance(b,.55);near(100000-e.hp,next.s.atk*bb(WAAI,1,10).atk_scale);assert.ok(e.s.flags.silence);
});
test('Kafka launched S2 burst keeps its original selected tile after the operator retreats',()=>{
  const{b,deploy}=make(KAFKA,{skill:1}),e=enemy(b,{col:6}),outside=enemy(b,{col:5}),u=deploy(),atk=u.s.atk;
  advance(b,.1);b.retreat(u);advance(b,.2);
  // The projectile has already been released and is independent of its owner.
  near(100000-e.hp,u.s.atk*bb(KAFKA,1,10).atk_scale);near(outside.hp,100000);assert.ok(atk>u.s.atk);
});
test('Glaucus unreleased EMP is cancelled by withdrawal or a disabling status before its original strike frame',()=>{
  for(const action of['retreat','stun']){
    const{b,deploy}=make(GLAU,{skill:1}),u=deploy(),e=enemy(b,{row:2,col:4,drone:true});cast(b,u);advance(b,.4);
    if(action==='retreat')b.retreat(u);else b.applyStatus(u,'stun',{duration:1});
    advance(b,.6);near(e.hp,100000);assert.equal(Boolean(e.s.flags.stun),false);
  }
});
test('Red minimum-damage talent never bypasses source dodge and ignores nonattack damage',()=>{
  const{b,deploy}=make(RED),u=deploy(),e=enemy(b,{def:10000});b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});b.rng=()=>0;
  near(strike(b,u,e),0);b.removeBuff(e,'test:dodge');
  const before=e.hp;b.dealDamage(u,e,{amount:100,type:'phys',isSkill:true});near(before-e.hp,5);
});
