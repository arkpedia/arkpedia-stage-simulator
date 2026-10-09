// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-iana-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
import { canTargetEnemy, canTargetAlly } from '../server/sim/targeting.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID = 'char_4124_iana';
const near = (a, z, tol = 1e-5) => assert.ok(Math.abs(a-z) < tol, `${a} != ${z}`);
function advance(b, t) { const end = b.time+t; while (b.time < end-1e-9) b.step(); assert.deepEqual(b.errors, []); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT' } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4,7,10][elite]) };
  const b = new StandardBattle(d, { operators: [build] }); b.autoFinish = false;
  b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  b.addDp('arkpedia',99); const hits = [];
  b.on('damaged', c => hits.push({ ...c, time: b.time }));
  const u = b.deployOperator(ID,3,4,dir); assert.ok(u);
  u.atkCd = 1000; u.profile.canAttack = () => false;
  return { b, u, hits };
}
function enemy(b, { x = 5, y = 3, fly = false, hp = 100000 } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y,x] });
  Object.assign(e.base, { maxHp: hp, def: 0, res: 0, atk: 100, moveSpeed: 0 });
  e.markDirty(); void e.s; e.hp = hp; if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
const own = (hits, u, tag) => hits.filter(h => h.source === u && (!tag || h.dmg.tags.includes(tag)));
const bbFor = (n,r) => Object.fromEntries(source.tables.skills[`skchr_iana_${n}`].levels[r-1].blackboard.map(x => [x.key,x.value]));
const aura = (u,e) => e.findBuff(`iana:aura:${u.id}`);
function incoming(b, u, e) { b.dealDamage(e, u, { amount: 100, type: 'phys', canDodge: false }); }
function cast(u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(u.skill.activate('test'),true); }
function shot(b,u) { const p = effectiveProfile(u), targets = acquireTargets(b,u,p); assert.ok(targets.length); performAttack(b,u,p,targets); u.atkCd = 1000; }
for (let rank=1; rank<=10; rank++) test(`S1 rank${rank}: marked-source blast uses source scale, two UP squares and air`, () => {
  const {b,u,hits} = make({rank}), e = enemy(b), up = enemy(b,{y:4,fly:true}), side = enemy(b,{x:6});
  incoming(b,u,e); assert.equal(u.trait.dollSwitching,true); near(u.s.blockCnt,0);
  advance(b,1.2); assert.equal(own(hits,u,'iana:blast').length,0);
  advance(b,.35); const h = own(hits,u,'iana:blast'); assert.equal(h.length,2);
  near(h.find(x=>x.target===e).amount,u.s.atk*bbFor(1,rank).atk_scale*1.2);
  near(h.find(x=>x.target===up).amount,u.s.atk*bbFor(1,rank).atk_scale); near(side.hp,side.s.maxHp);
  advance(b,.5); assert.equal(u.trait.doll,true); assert.equal(u.trait.dollSwitching,false);
  assert.equal(u.skill.activate('test'),false); assert.equal(skillHud(u.skill).canActivate,false);
  advance(b,19); assert.equal(u.trait.dollSwitching,true); advance(b,2.1);
  assert.equal(u.trait.doll,false); near(u.hp,u.s.maxHp); near(u.s.blockCnt,2); assert.equal(skillHud(u.skill),null);
});
for (let rank=1; rank<=10; rank++) test(`S2 rank${rank}: instant cast, independent haste/reveal and full substitute countdown`, () => {
  const {b,u,hits} = make({skill:1,rank}), e = enemy(b), bb = bbFor(2,rank);
  b.addBuff(e,{key:'test:hidden',flags:{stealth:true,untargetable:true}}); cast(u);
  assert.equal(u.skill.active,false); assert.equal(u.skill.activations,1);
  advance(b,1.15); near(u.s.aspd,100); assert.equal(aura(u,e),null);
  advance(b,.1); near(u.s.aspd,100+bb.attack_speed); assert.ok(aura(u,e));
  assert.equal(u.s.flags.stealth,true); assert.equal(skillHud(u.skill).ready,false);
  advance(b,.85); assert.equal(u.trait.dollSwitching,false); near(u.skill.spTotal,0);
  assert.equal(canTargetAlly(e,u,true),false); assert.equal(own(hits,u,'iana:blast').length,0);
  advance(b,source.tables.skills.skchr_iana_2.levels[rank-1].duration);
  near(u.s.aspd,100); assert.equal(!!u.s.flags.stealth,false); assert.equal(aura(u,e),null);
  assert.equal(u.trait.doll,true); near(u.skill.spTotal,0); assert.equal(u.skill.activate('test'),false);
  advance(b,23.2-b.time); assert.equal(u.trait.doll,false); advance(b,1.1); assert.ok(u.skill.spTotal>=1);
});
for (const dir of ['UP','RIGHT','DOWN','LEFT']) test(`${dir}: S1 unaligned area is always UP, not the facing or a3x3 splash`, () => {
  const {b,u,hits} = make({dir}), e=enemy(b,{x:5.3,y:3.1}), up=enemy(b,{x:5.3,y:4.1}), edge=enemy(b,{x:4.7,y:3.1}), opposite=enemy(b,{x:5.3,y:2.1});
  incoming(b,u,e); advance(b,1.7); const victims=own(hits,u,'iana:blast').map(h=>h.target);
  assert.deepEqual(new Set(victims),new Set([e,up])); near(edge.hp,edge.s.maxHp); near(opposite.hp,opposite.s.maxHp);
});
for (const [elite,potential,scale,duration] of [[0,1,1,6],[1,1,1.1,6],[1,5,1.12,6],[2,1,1.2,8],[2,5,1.22,8]]) test(`E${elite} P${potential}: direct attacker reveal and fragile use selected talent tier`,()=>{
  const {b,u}=make({elite,potential}), e=enemy(b,{x:7}); b.addBuff(e,{key:'test:hide',flags:{stealth:true,untargetable:true}});
  incoming(b,u,e); assert.equal(e.s.flags.reveal,true); near(e.s.dmgTakenMul,scale);
  advance(b,duration+.1); assert.equal(!!e.s.flags.reveal,false); near(e.s.dmgTakenMul,1);
});
test('S2 incoming cast requires full SP and controls; fallback has no special buffs',()=>{
  for (const condition of ['ready','empty','stun','freeze','silence']) {
    const {b,u}=make({skill:1}), e=enemy(b);u.skill.setSpTotal(condition==='empty'?0:u.skill.spCost);
    if (!['ready','empty'].includes(condition)) b.applyStatus(u,condition,{duration:3});
    incoming(b,u,e); advance(b,2.1); assert.equal(u.trait.doll,true);
    assert.equal(u.skill.activations,condition==='ready'?1:0); near(u.s.aspd,condition==='ready'?400:100);
  }
});
test('Mirage cannot attack; substitute attacks exactly one ground/air target with first-only Begin',()=>{
  const {b,u,hits}=make(), e=enemy(b), air=enemy(b,{y:4,fly:true});
  assert.equal(effectiveProfile(u).canAttack(b,u),false); incoming(b,u,e); advance(b,2.1);
  const prior=own(hits,u).length; shot(b,u); advance(b,.23); assert.equal(own(hits,u).length,prior);
  advance(b,.12); assert.equal(own(hits,u).length,prior+1); assert.equal(own(hits,u).at(-1).target,e);
  shot(b,u); advance(b,.18); assert.equal(own(hits,u).length,prior+2);
  assert.equal(u.mem.ianaAttackVisual,'Doll_Attack_Loop'); assert.ok(air.alive);
});
test('Substitute fatal damage retreats; sourceless fatal HP loss to Mirage uses self-centred S1 fallback',()=>{
  const {b,u,hits}=make(), e=enemy(b,{x:4}), up=enemy(b,{x:4,y:4});
  b.loseHp(u,100000); advance(b,2.1); assert.equal(u.alive,true);assert.equal(u.trait.doll,true);
  assert.deepEqual(new Set(own(hits,u,'iana:blast').map(h=>h.target)),new Set([e,up]));
  b.dealDamage(e,u,{amount:100000,type:'true'}); assert.equal(u.alive,false); advance(b,23); assert.equal(u.alive,false);
});
test('Sourceless nonfatal damage and friendly damage do not trigger the talent',()=>{
  const {b,u}=make(), e=enemy(b); b.dealDamage(e,u,{amount:1,type:'true',sourceless:true});
  b.dealDamage(u,u,{amount:1,type:'true'}); assert.equal(u.trait.dollSwitching,false); assert.equal(!!e.s.flags.reveal,false);
});
test('S1 missing attacker falls back to self; untargetable attacker still supplies blast centre',()=>{
  for(const missing of [false,true]){const{b,u,hits}=make(),e=enemy(b,{x:6}),self=enemy(b,{x:4}),up=enemy(b,{x:6,y:4});incoming(b,u,e);
    if(missing)b.kill(e);else b.addBuff(e,{key:'test:free',flags:{untargetable:true}});
    advance(b,1.9);const victims=own(hits,u,'iana:blast').map(h=>h.target);assert.deepEqual(victims,missing?[self]:[up]);}
});
test('S2 reveal removes the whole special buff and aura, and initial reveal suppresses both',()=>{
  for(const initial of [false,true]){const{b,u}=make({skill:1}),e=enemy(b);if(initial)b.applyStatus(u,'reveal',{duration:5});cast(u);if(initial)b.applyStatus(u,'reveal',{duration:5});advance(b,1.3);
    if(!initial){assert.ok(aura(u,e));b.applyStatus(u,'reveal',{duration:.1});}
    near(u.s.aspd,100);assert.equal(!!u.s.flags.stealth,false);assert.equal(aura(u,e),null);advance(b,2);near(u.s.aspd,100);assert.equal(aura(u,e),null);}
});
test('Aura follows live range membership; retreat removes it and cancels unborn effects',()=>{
  const{b,u}=make({skill:1}),e=enemy(b);cast(u);advance(b,1.3);assert.ok(aura(u,e));e.x=8;b._buildEnemyIndex();advance(b,.04);assert.equal(aura(u,e),null);e.x=5;b._buildEnemyIndex();advance(b,.04);assert.ok(aura(u,e));b.retreatOperator(ID);assert.equal(aura(u,e),null);advance(b,23);assert.equal(u.deployed,false);
  const s=make();const a=enemy(s.b);incoming(s.b,s.u,a);s.b.retreatOperator(ID);advance(s.b,2);assert.equal(own(s.hits,s.u,'iana:blast').length,0);
});
test('An emitted S1 projectile survives source retreat and reads current ATK at impact',()=>{
  const{b,u,hits}=make(),e=enemy(b,{x:7});incoming(b,u,e);advance(b,1.17);assert.equal(b.projectiles.list.length,1);b.addBuff(u,{key:'test:atk',persist:true,mods:{atkPct:1}});const atk=u.s.atk;b.retreatOperator(ID);advance(b,1);assert.equal(own(hits,u,'iana:blast').length,1);near(own(hits,u)[0].amount,atk*4*1.2);
});
test('Source records preserve both skills, exact facing chains, authored geometry and explicit fidelity limits',()=>{
  assert.deepEqual(source.enabledOperators,[ID]);assert.equal(source.source.bundles.length,5);assert.equal(Object.values(source.tables.skills).flatMap(s=>s.levels).length,20);
  for(const face of ['Front','Back']){assert.equal(source.models[ID][face].sha256,source.officialSkeletonBindings[ID][face].sha256);near(source.models[ID][face].hits.Doll_Skill_1_SwitchIn[0],.067);near(source.models[ID][face].hits.Doll_Skill_2_SwitchIn[0],.2);}
  assert.equal(source.frameParity,false);assert.equal(source.moduleSupport,false);assert.match(source.authoredGameplayNotes.mapping.s1Area,/1-1/);
});
test('Normal shots retain speed30 tracked flight, aerial selection and source-independent arrival',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b,{x:6,fly:true});cast(u);advance(b,2.1);
  const speeds=[],add=b.addProjectile.bind(b);b.addProjectile=p=>{if(p.source===u)speeds.push(p.speed);return add(p);};
  shot(b,u);advance(b,.12);assert.equal(own(hits,u).length,0);assert.deepEqual(speeds,[30]);
  b.retreatOperator(ID);advance(b,.12);assert.equal(own(hits,u).length,1);
  assert.equal(own(hits,u)[0].target,e);assert.equal(own(hits,u)[0].dmg.applyWay,'ranged');
});
test('Control during normal windup cancels the unissued shot without replacement',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b);cast(u);advance(b,2.1);shot(b,u);
  b.applyStatus(u,'stun',{duration:.01});advance(b,.4);assert.equal(own(hits,u).length,0);assert.ok(e.alive);
});
test('A killed projectile target never redirects a substitute shot to another victim',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b,{x:6});cast(u);advance(b,2.1);shot(b,u);advance(b,.12);assert.equal(b.projectiles.list.length,1);
  b.kill(e);const z=enemy(b,{x:5});advance(b,.3);assert.equal(own(hits,u).length,0);near(z.hp,z.s.maxHp);
});
test('Attack End waits for the literal loop to finish, then new engagement uses Begin again',()=>{
  const{b,u}=make({skill:1}),e=enemy(b);cast(u);advance(b,2.1);shot(b,u);advance(b,.12);
  e.x=9;b._buildEnemyIndex();advance(b,.05);assert.notEqual(u.mem.regularFormVisual.clip,'Doll_Attack_End');
  advance(b,.13);assert.equal(u.mem.regularFormVisual.clip,'Doll_Attack_End');
  advance(b,.2);assert.equal(u.mem.ianaAttackEnd,null);e.x=5;b._buildEnemyIndex();shot(b,u);
  assert.equal(u.mem.ianaAttackVisual.begin,'Doll_Attack_Begin');
});
test('Source Fragile keeps a stronger named effect and falls back when that effect expires',()=>{
  const{b,u}=make(),e=enemy(b,{x:7});b.applyStatus(e,'fragile',{key:'test:strong',value:.5,duration:1});
  incoming(b,u,e);near(e.s.dmgTakenMul,1.5);advance(b,1.1);near(e.s.dmgTakenMul,1.2);
});
test('Durable reveal at S2 cast suppresses ASPD, stealth and aura through the switch',()=>{
  const{b,u}=make({skill:1}),e=enemy(b);b.addBuff(u,{key:'test:counter',persist:true,flags:{reveal:true}});
  cast(u);advance(b,2.1);near(u.s.aspd,100);assert.equal(!!u.s.flags.stealth,false);assert.equal(aura(u,e),null);
});
