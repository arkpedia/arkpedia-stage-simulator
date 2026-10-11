// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-melanite-prefabs.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {acquireTargets,effectiveProfile} from '../server/sim/ai.js';
import {dirVec} from '../server/sim/dir.js';

const ID='char_4006_melnte';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,elite=2,potential=1}={}) {
  const src=structuredClone(data),op=src.operators[ID];
  src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
  const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,
    skillId:op.skills[skill].id,skillRank:rank};
  const b=new StandardBattle(src,{operators:[build]});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const hits=[];b.on('damaged',ctx=>hits.push(ctx));
  const deploy=(dir='RIGHT')=>{
    b.getPlayer('arkpedia').dp=90;const u=b.deployOperator(ID,3,4,dir);assert.ok(u);
    u.atkCd=1000;u.skill.rule='NEVER';return u;
  };
  return{b,deploy,hits};
}
function enemy(b,{r=3,c=5,def=0,fly=false}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});
  Object.assign(e.base,{maxHp:100000,def,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=100000;
  if(fly)e.motion='FLY';
  b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u,total=u.skill.spCost){u.skill.setSpTotal(total);assert.equal(b.activateOperator(ID),true);}
function shot(b,u,e){assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;}

test('Melanite retains all20 source ranks, original graphs, curve, talent templates and facing bytes',()=>{
  assert.equal(evidence.frameParity,false);assert.equal(evidence.moduleSupport,false);
  assert.equal(evidence.source.bundles.length,5);
  for(const s of data.operators[ID].skills)assert.deepEqual(s.levels,evidence.tables.skills[s.id].levels.map(l=>l.rangeId?{...l,rangeGrid:evidence.tables.ranges[l.rangeId].grids.map(p=>[p.row,p.col])}:l));
  const ctrl=evidence.skills.skchr_melnte_2.flatMap(g=>g.components).find(c=>c.data._projectileKey).data;
  assert.equal(ctrl._waitForAttackEvent,1);assert.equal(ctrl._animKey,'Skill_2');assert.equal(ctrl._maxAnimScale,1);
  const curve=evidence.projectiles.projectile_chr_melnte_s2[0].components.find(c=>c.data._scaleCurve).data._scaleCurve.m_Curve;
  assert.deepEqual(curve.map(k=>Math.round(k.time*100)),[0,25,85,100]);
  assert.equal(evidence.templates['melnte_t_1[skill_buff]'].eventToActions.ON_SKILL_START[0]._conditionNode._buffKeys[0],'melnte_talent_1[skill_flag]');
  for(const face of ['Front','Back']) {
    const asset=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
    const bytes=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
  }
  assert.ok(evidence.verificationLimits.some(s=>s.includes('normalized projectile age')));
});
test('all S1 ranks preserve selected ATK, flat interval increase, SP, duration and restoration',()=>{
  for(let rank=1;rank<=10;rank++) {
    const{b,deploy}=make({skill:0,rank}),u=deploy(),s=u.def.skill;
    near(u.skill.spTotal,s.initSp);near(u.skill.spCost,s.spCost);
    const atk=u.s.atk,interval=u.s.interval;cast(b,u);
    near(u.s.atk,atk*(1+s.bb.atk));near(u.s.interval,interval+.8);near(u.skill.timeLeft,s.duration);
    assert.equal(u.mem.regularFormVisual.clip,'Skill_1_Idle');advance(b,s.duration+.1);
    near(u.s.atk,atk);near(u.s.interval,interval);assert.equal(u.skill.active,false);
    assert.equal(u.mem.regularFormVisual,null);
  }
});
test('all S2 ranks use selected charge count, SP and close-range maximum physical output',()=>{
  for(let rank=1;rank<=10;rank++) {
    const{b,deploy,hits}=make({rank}),u=deploy(),e=enemy(b,{c:4.6}),s=u.def.skill;
    assert.equal(u.skill.maxCharges,s.maxCharges);near(u.skill.spCost,s.spCost);
    near(u.skill.spTotal,s.initSp);cast(b,u);advance(b,.5);assert.equal(hits.length,0);
    advance(b,.2);assert.equal(hits.length,1);near(hits[0].dmg.amount,u.s.atk*s.bb.atk_scale);
    assert.equal(hits[0].target,e);assert.equal(u.skill.active,true);near(u.skill.spTotal,0);
    advance(b,1.1);assert.equal(u.skill.active,false);assert.equal(u.mem.melaniteCast,null);
  }
});
test('normal input targeting is cap1 including air, with no retarget or splash',()=>{
  const{b,deploy,hits}=make(),u=deploy(),e=enemy(b),other=enemy(b,{c:5.1,fly:true});
  assert.equal(acquireTargets(b,u,u.profile).length,1);shot(b,u,e);advance(b,.7);
  assert.deepEqual(hits.map(h=>h.target),[e]);near(other.hp,100000);
  e.hidden=true;shot(b,u,other);advance(b,.7);assert.equal(hits.at(-1).target,other);
});
test('normal and S1 clocks preserve uncapped versus capped animation rates in all facings',()=>{
  for(const dir of ['UP','RIGHT','DOWN','LEFT'])for(const skill of [0,1]) {
    const{b,deploy}=make({skill}),u=deploy(dir),[dr,dc]=dirVec(dir),e=enemy(b,{r:3+dr,c:4+dc});
    b.addBuff(u,{key:'test:speed',mods:{aspd:200}});
    near(effectiveProfile(u).windup(b,u,[e]),.433/3);
    if(skill===0){cast(b,u);near(effectiveProfile(u).windup(b,u,[e]),.467);}
    else {cast(b,u);near(u.skill.timeLeft,1.7);assert.equal(u.mem.regularFormVisual.clip,dir==='DOWN'?'Skill_Down_2':'Skill_2');}
  }
});
test('second and later S1 casts apply selected talent after DEF, not before it',()=>{
  for(const[elite,potential,mul]of [[1,1,1.1],[1,5,1.11],[2,1,1.15],[2,5,1.16]]) {
    const{b,deploy,hits}=make({skill:0,rank:7,elite,potential}),u=deploy(),e=enemy(b,{def:500});
    cast(b,u);shot(b,u,e);advance(b,.8);near(hits.at(-1).hpLoss,u.s.atk-500);
    u.skill.end('test');cast(b,u);shot(b,u,e);advance(b,.8);
    near(hits.at(-1).hpLoss,(u.s.atk-500)*mul);near(hits.at(-1).dmg.amount,u.s.atk);
    u.skill.end('test');shot(b,u,e);advance(b,.8);near(hits.at(-1).hpLoss,u.s.atk-500);
  }
});
test('S2 consumes one stored charge, blocks recast and recovery while casting, then applies second-use talent',()=>{
  const{b,deploy,hits}=make({potential:5}),u=deploy(),e=enemy(b,{c:4.6,def:500});
  cast(b,u,u.skill.spCost*2);assert.equal(u.skill.charges,1);assert.equal(b.activateOperator(ID),false);
  advance(b,1);near(u.skill.spTotal,u.skill.spCost);near(hits[0].hpLoss,u.s.atk*5-500);
  advance(b,.8);assert.equal(u.skill.active,false);assert.equal(b.activateOperator(ID),true);
  advance(b,.8);near(hits[1].hpLoss,(u.s.atk*5-500)*1.16);assert.equal(hits[1].target,e);
});
test('piercing shot traverses all four directions and hits every eligible ground/air victim once through walls',()=>{
  for(const dir of ['UP','RIGHT','DOWN','LEFT']) {
    const{b,deploy,hits}=make(),u=deploy(dir),[dr,dc]=dirVec(dir);
    const a=enemy(b,{r:3+dr,c:4+dc}),z=enemy(b,{r:3+2*dr,c:4+2*dc,fly:true});
    b.addBuff(z,{key:'test:camou',flags:{camou:true}});
    const off=enemy(b,{r:3+dr+dc,c:4+dc+dr}),behind=enemy(b,{r:3-dr,c:4-dc});
    cast(b,u);advance(b,1.3);assert.deepEqual(new Set(hits.map(h=>h.target)),new Set([a,z]));
    assert.equal(hits.length,2);near(off.hp,100000);near(behind.hp,100000);
    advance(b,1);assert.equal(hits.length,2);
  }
});
test('original falloff curve has maximum, interpolated and minimum outputs at contact times',()=>{
  const{b,deploy,hits}=make(),u=deploy();
  const close=enemy(b,{c:5}),mid=enemy(b,{c:6.7}),far=enemy(b,{c:8});
  cast(b,u);advance(b,1.2);
  const find=e=>hits.find(h=>h.target===e).dmg.amount/u.s.atk;
  near(find(close),5);near(find(mid),3.4,1e-5);near(find(far),1.8);
});
test('swept collider catches between-frame targets and excludes hidden/free/sleep/invisible victims',()=>{
  const{b,deploy,hits}=make(),u=deploy();
  const boundary=enemy(b,{c:5.21,r:3.49}),miss=enemy(b,{c:5.21,r:3.51});
  const hidden=enemy(b,{c:5.4}),free=enemy(b,{c:5.5}),sleep=enemy(b,{c:5.6}),stealth=enemy(b,{c:5.7});
  hidden.hidden=true;b.addBuff(free,{key:'test:free',flags:{untargetable:true}});
  b.applyStatus(sleep,'sleep',{duration:10});b.addBuff(stealth,{key:'test:stealth',flags:{stealth:true}});
  cast(b,u);advance(b,1.2);assert.deepEqual(hits.map(h=>h.target),[boundary]);near(miss.hp,100000);
});
test('huge shared hit bodies intersect the shot even with centres outside the lane',()=>{
  const{b,deploy,hits}=make(),u=deploy(),e=enemy(b,{c:6,r:4});
  e.hitArea={w:2,h:1.2,dx:0,dy:0};cast(b,u);advance(b,1.2);assert.equal(hits[0].target,e);
});
test('shot collision reads live occupancy, allowing late entrants and missing enemies that leave the lane',()=>{
  const{b,deploy,hits}=make(),u=deploy(),leave=enemy(b,{c:7});cast(b,u);advance(b,.56);
  leave.y=4;const enter=enemy(b,{c:6});advance(b,.6);
  assert.deepEqual(hits.map(h=>h.target),[enter]);
});
test('unborn shots cancel on retreat or transient control without refund or lingering cast flags',()=>{
  for(const control of [false,true]) {
    const{b,deploy,hits}=make(),u=deploy();enemy(b);cast(b,u);advance(b,.2);
    if(control){b.applyStatus(u,'stun',{duration:.01});advance(b,.02);}
    else b.retreatOperator(ID);
    advance(b,2);assert.equal(hits.length,0);assert.equal(b.projectiles.list.length,0);
    assert.equal(u.findBuff('melanite:cast'),null);assert.equal(u.mem.melaniteCast,null);
  }
});
test('born piercing shot survives source retirement and continues its independent flight',()=>{
  const{b,deploy,hits}=make(),u=deploy(),e=enemy(b,{c:7.8});cast(b,u);advance(b,.56);
  assert.equal(b.projectiles.list.length,1);b.retreatOperator(ID);advance(b,.5);
  assert.equal(hits[0].target,e);assert.equal(b.projectiles.list.length,0);
});
test('finite piercing collider respects slowdown and expires in place without teleporting into distant targets',()=>{
  const{b,deploy,hits}=make(),u=deploy(),nearEnemy=enemy(b,{c:5}),far=enemy(b,{c:7});
  b.projectiles.registerSpeedAura({owner:u,contains:()=>true,scale:.5});
  cast(b,u);advance(b,1.2);assert.equal(hits.length,1);assert.equal(hits[0].target,nearEnemy);
  near(far.hp,100000);assert.equal(b.projectiles.list.length,0);
});
test('new deployment restores first-use talent state instead of carrying prior cast counts',()=>{
  const{b,deploy}=make({skill:0}),u=deploy();cast(b,u);u.skill.end('test');cast(b,u);
  assert.equal(u.skill.activations,2);b.retreatOperator(ID);advance(b,80);
  const fresh=deploy();assert.equal(fresh.skill.activations,0);cast(b,fresh);assert.equal(fresh.skill.activations,1);
});
