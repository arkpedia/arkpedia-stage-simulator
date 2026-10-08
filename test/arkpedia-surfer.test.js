// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-surfer-prefabs.json' with { type: 'json' };
import historical from '../data/arkpedia-five-star-vanguard-third-prefabs.json' with { type: 'json' };
import { SURFER_OPERATORS } from '../shared/arkpedia/surfer-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';

const ID = 'char_4052_surfer', F = 'char_123_fang';
const near = (a, z, eps=1e-5) => assert.ok(Math.abs(a-z)<eps, `${a} != ${z}`);
function advance(b,s) {
  for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();
  assert.deepEqual(b.errors,[]);
}
function make({ skill=1, rank=10, elite=2, potential=1, others=[] }={}) {
  const src=structuredClone(data),op=src.operators[ID];
  src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
  const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,
    skillId:op.skills[skill].id,skillRank:Math.min(rank,elite===2?10:elite===1?7:4)};
  const b=new StandardBattle(src,{operators:[build,...others.map(id=>defaultBuild(src.operators[id]))]});
  b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const hits=[];b.on('damaged',ctx=>hits.push(ctx));
  const deploy=(id=ID,r=3,c=4,dir='RIGHT')=>{
    b.getPlayer('arkpedia').dp=90;
    const cost=b.cost(id),u=b.deployOperator(id,r,c,dir);assert.ok(u);
    u.atkCd=1000;u.skill.rule='NEVER';return{u,cost};
  };
  return{b,deploy,hits};
}
function enemy(b,{r=3,c=5,def=400,fly=false}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});
  Object.assign(e.base,{maxHp:100000,def,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=100000;
  if(fly)e.motion='FLY';
  b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);advance(b,.2);}
function shot(b,u,e){assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;}
const key=u=>`surfer:def-victim:${u.id}`;

test('Surfer complete selected kit retains source graphs, all20 ranks, native facings and historical deferral',()=>{
  assert.deepEqual(Object.keys(SURFER_OPERATORS),[ID]);assert.equal(evidence.frameParity,false);
  assert.equal(evidence.moduleSupport,false);assert.equal(evidence.source.bundles.length,5);
  assert.equal(evidence.sourceInvestigations.previousDeferral,historical.deferredOperators[ID]);
  assert.ok(evidence.verificationLimits.some(x=>x.includes('low/negative DEF')));
  for(const [i,p]of data.operators[ID].phases.entries())assert.deepEqual(p.attributesKeyFrames,evidence.tables.character.phases[i].attributesKeyFrames);
  for(const s of data.operators[ID].skills)assert.deepEqual(s.levels,evidence.tables.skills[s.id].levels);
  const controller=evidence.skills.skchr_surfer_2.flatMap(g=>g.components).find(c=>c.data._stealOnceBBKey).data;
  assert.equal(controller._attributeType,2);assert.equal(controller._stealMaxBBKey,'def_steal_max');
  assert.equal(controller._finishTargetBuffWhenInvalid,1);assert.equal(controller._finishOwnerBuffWhenTargetInvalid,0);
  for(const face of['Front','Back']) {
    const asset=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
    const bytes=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
    near(evidence.models[ID][face].hits.Attack[0],.4);near(evidence.models[ID][face].hits.Skill_2_Combat[0],.333);
  }
});
test('all selected S1 ranks activate once on deploy with source ATK/duration and no recast or SP',()=>{
  for(let rank=1;rank<=10;rank++) {
    const {b,deploy}=make({skill:0,rank}),{u}=deploy(),s=evidence.tables.skills.skchr_surfer_1.levels[rank-1];
    near(u.s.atk,u.base.atk*(1+s.blackboard[0].value));near(u.skill.timeLeft,s.duration);
    assert.equal(u.skill.active,true);assert.equal(u.skill.manual,false);near(u.skill.spTotal,0);
    assert.equal(b.activateOperator(ID),false);advance(b,s.duration+.2);
    near(u.s.atk,u.base.atk);assert.equal(u.skill.active,false);assert.equal(u.skill.exhausted,true);
    assert.equal(u.skill.activate('test'),false);assert.equal(u.skill.activations,1);
  }
});
test('all S2 ranks preserve manual SP, selected ASPD, flat steal amount and10s duration',()=>{
  for(let rank=1;rank<=10;rank++) {
    const {b,deploy}=make({rank}),{u}=deploy(),s=evidence.tables.skills.skchr_surfer_2.levels[rank-1];
    const bb=Object.fromEntries(s.blackboard.map(x=>[x.key,x.value])),e=enemy(b);
    near(u.skill.spCost,s.spData.spCost);near(u.skill.spTotal,s.spData.initSp);assert.equal(u.skill.manual,true);
    const aspd=u.s.aspd,def=u.s.def;cast(b,u);near(u.s.aspd,aspd+bb.attack_speed);
    near(u.skill.timeLeft,9.8);shot(b,u,e);advance(b,.7);
    near(u.s.def,def+bb.def_steal);near(e.s.def,400-bb.def_steal);near(u.skill.spTotal,0);
    advance(b,10);assert.equal(u.skill.active,false);near(u.s.aspd,aspd);near(u.s.def,def);near(e.s.def,400);
  }
});
test('Solo Traveler pays deployment cost first and grants exact promotion/potential DP once',()=>{
  for(const [elite,potential,dp]of[[0,1,0],[1,1,1],[1,5,2],[2,1,2],[2,5,3]]) {
    const {b,deploy}=make({skill:0,elite,potential}),{u,cost}=deploy();
    near(cost,u.base.cost);near(b.dp,90-cost+dp);const before=b.dp;advance(b,1);near(b.dp,before);
  }
});
test('Solo Traveler tests four cardinal tiles, excluding self, diagonals, tokens, devices and retired operators',()=>{
  for(const [r,c,blocks]of[[3,5,true],[3,3,true],[2,4,true],[4,4,true],[2,5,false],[3,6,false]]) {
    const {b,deploy}=make({others:[F]});deploy(F,r,c);const{cost}=deploy();near(b.dp,90-cost+(blocks?0:2));
  }
  for(const kind of['token','device','op']) {
    const {b,deploy}=make({others:[F]}),{u:a}=deploy(F,3,5);a.kind=kind;
    if(kind==='op')b.retreatOperator(F);
    const{cost}=deploy();near(b.dp,90-cost+2);
  }
});
test('ordinary attacks select only one legal ground/air victim and never splash',()=>{
  const {b,deploy,hits}=make(),{u}=deploy(),e=enemy(b,{def:0}),z=enemy(b,{c:5.1,def:0,fly:true});
  assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);shot(b,u,z);advance(b,.8);
  near(e.hp,100000);near(100000-z.hp,u.s.atk);assert.equal(hits.filter(x=>x.source===u).length,1);
});
test('original Attack/Combat and S2 clips use uncapped events in all four facings',()=>{
  for(const dir of['RIGHT','LEFT','UP','DOWN'])for(const active of[false,true])for(const combat of[false,true]) {
    const {b,deploy}=make(),{u}=deploy(ID,3,4,dir),e=enemy(b,{def:0});
    if(active)cast(b,u);if(combat){u.blocking=[e];e.blockedBy=u;}
    b.addBuff(u,{key:'test:ASPD',mods:{aspd:200}});shot(b,u,e);
    const event=b._evq.find(x=>x[0]==='atk'&&x[1]===u.id),name=`${active?'Skill_2_':''}${combat?'Combat':'Attack'}`;
    assert.equal(event[4].animation,name);near(event[4].windup,(active?.333:.4)/(u.s.aspd/100));
    advance(b,.5);assert.ok(e.hp<100000);
  }
});
test('S2 steals before the same physical hit, sharing one owner cap across every victim',()=>{
  const {b,deploy}=make(),{u}=deploy(),e=enemy(b),z=enemy(b,{c:5.2});const def=u.s.def;
  cast(b,u);b.getPlayer('arkpedia').dp=0;
  shot(b,u,e);advance(b,.7);near(100000-e.hp,u.s.atk-(400-55));near(u.s.def,def+55);
  for(let i=0;i<2;i++){shot(b,u,e);advance(b,.7);}for(let i=0;i<3;i++){shot(b,u,z);advance(b,.7);}
  near(e.s.def,235);near(z.s.def,290);near(u.s.def,def+275);near(u.mem.surferStolen,275);near(b.dp,6);
});
test('bounded flat-transfer rule preserves external buffs and shared DEF floor',()=>{
  const {b,deploy}=make(),{u}=deploy(),e=enemy(b,{def:20});
  b.addBuff(e,{key:'test:external',mods:{defFlat:10}});const before=u.s.def;cast(b,u);shot(b,u,e);advance(b,.7);
  near(u.s.def,before+55);assert.equal(e.findBuff(key(u)).mods.defFlat,-55);assert.ok(e.s.def>=0);
  u.skill.end('duration');near(u.s.def,before);near(e.s.def,30);assert.ok(e.findBuff('test:external'));
});
test('target invalidation removes only victim reduction and does not replenish Surfer cap or gain',()=>{
  for(const invalid of['death','hidden','free']) {
    const {b,deploy}=make(),{u}=deploy(),e=enemy(b);const before=u.s.def;cast(b,u);shot(b,u,e);advance(b,.7);
    if(invalid==='death')b.kill(e,u);else if(invalid==='hidden')e.hidden=true;else b.addBuff(e,{key:'test:free',flags:{untargetable:true}});
    advance(b,.1);assert.equal(e.findBuff(key(u)),null);near(u.s.def,before+55);near(u.mem.surferStolen,55);
    const z=enemy(b,{c:5.2});shot(b,u,z);advance(b,.7);near(u.s.def,before+110);
    u.skill.end('duration');near(u.s.def,before);near(z.s.def,400);
  }
});
test('skill end, retreat and new activation restore victims without deleting unrelated modifiers',()=>{
  for(const end of['duration','retreat']) {
    const {b,deploy}=make(),{u}=deploy(),e=enemy(b),z=enemy(b,{c:5.2});
    b.addBuff(e,{key:'test:unrelated',mods:{defFlat:-10}});cast(b,u);shot(b,u,e);advance(b,.7);shot(b,u,z);advance(b,.7);
    if(end==='retreat')b.retreatOperator(ID);else u.skill.end('duration');
    near(e.s.def,390);near(z.s.def,400);near(u.mem.surferStolen,0);assert.equal(u.mem.surferVictims.size,0);
    assert.ok(e.findBuff('test:unrelated'));assert.equal(u.findBuff('surfer:def-owner'),null);
    if(end==='duration'){advance(b,.2);cast(b,u);shot(b,u,e);advance(b,.7);near(u.mem.surferStolen,55);}
  }
});
test('accepted zero-HP-loss or shielded damage grants DP, but miss/cancel/invulnerability does not',()=>{
  for(const mode of['shield','zero','dodge','cancel','invulnerable']) {
    const {b,deploy}=make({skill:0}),{u}=deploy(),e=enemy(b,{def:0});b.getPlayer('arkpedia').dp=0;
    if(mode==='shield')b.addBuff(e,{key:'test:shield',shieldHits:1});
    if(mode==='zero')b.addBuff(u,{key:'test:zero',mods:{physDealtMul:0}});
    if(mode==='dodge')b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});
    if(mode==='cancel')b.on('hit',({source,dmg})=>{if(source===u)dmg.cancel=true;});
    if(mode==='invulnerable')b.addBuff(e,{key:'test:invulnerable',flags:{invulnerable:true}});
    shot(b,u,e);advance(b,.8);near(e.hp,100000);near(b.dp,['shield','zero'].includes(mode)?1:0);
  }
});
test('INPUT victims are not silently replaced and unfired attacks interrupted by control grant no DP',()=>{
  for(const mode of['free','control']) {
    const {b,deploy}=make({skill:0}),{u}=deploy(),e=enemy(b,{def:0}),z=enemy(b,{c:5.1,def:0});
    b.getPlayer('arkpedia').dp=0;shot(b,u,e);
    if(mode==='free')b.addBuff(e,{key:'test:free',flags:{untargetable:true}});else b.applyStatus(u,'stun',{duration:.5});
    advance(b,.9);near(e.hp,100000);near(z.hp,100000);near(b.dp,0);
  }
});
test('born ranged shots survive source retirement while owned skill DP/steal stops',()=>{
  const {b,deploy}=make(),{u}=deploy(),e=enemy(b,{c:8,def:0});cast(b,u);b.getPlayer('arkpedia').dp=0;
  shot(b,u,e);advance(b,.25);assert.equal(b.projectiles.list.length,1);b.retreatOperator(ID);const dp=b.dp;
  advance(b,.7);assert.ok(e.hp<100000);near(b.dp,dp);near(u.mem.surferStolen,0);assert.equal(e.findBuff(key(u)),null);
});
test('S1 duration and Solo Traveler restart on an actual new deployment',()=>{
  const {b,deploy}=make({skill:0}),{u}=deploy();advance(b,21);assert.equal(u.skill.exhausted,true);
  b.retreatOperator(ID);advance(b,36);const{u:next,cost}=deploy();assert.notEqual(next,u);
  assert.equal(next.skill.active,true);near(next.skill.timeLeft,20);near(b.dp,90-cost+2);
  assert.equal(next.skill.activations,1);assert.equal(next.mem.surferStolen,0);
});
