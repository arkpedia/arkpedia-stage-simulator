// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-chen-alter-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
const ID = 'char_1013_chen2';
const near = (a, z, tol = 1e-5) => assert.ok(Math.abs(a-z) < tol, `${a} != ${z}`);
function advance(b, seconds) {
  const end = b.time + seconds;
  while (b.time < end - 1e-9) b.step();
  assert.deepEqual(b.errors, []);
}
function make({ skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT', water = false, others = [] } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({length:19}, () => Array(21).fill(2));
  d.stage.mapTags = water ? ['water'] : [];
  const build = { ...defaultBuild(o), elite, potential, level:o.phases[elite].maxLevel,
    skillId:o.skills[skill].id, skillRank:Math.min(rank, [4,7,10][elite]) };
  const b = new StandardBattle(d, {operators:[build, ...others.map(entry => {
    const {id,skill=1}=typeof entry==='string'?{id:entry}:entry, op=d.operators[id];
    return {...defaultBuild(op),elite:2,level:op.phases[2].maxLevel,skillId:op.skills[skill].id,skillRank:10};
  })]}, {seed:1});
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({...t,height:'LOW',build:'ALL',pass:'ALL'})); b.addDp('arkpedia',99);
  const hits = []; b.on('damaged', c => hits.push({...c,time:b.time}));
  const u = b.deployOperator(ID,5,5,dir); u.atkCd = 1000; u.profile.canAttack = () => false;
  advance(b,1.1); b.rng = () => .99; return {b,u,hits};
}
function enemy(b, {x=6,y=5,fly=false,hp=100000,def=400} = {}) {
  const e = b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});
  Object.assign(e.base,{maxHp:hp,def,moveSpeed:1,massLevel:10}); e.markDirty(); void e.s; e.hp=hp;
  if (fly) e.motion='FLY'; b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}}); b._buildEnemyIndex(); return e;
}
function cast(b,u,total=u.skill.spCost) { u.skill.setSpTotal(total); assert.equal(u.skill.activate('manual'),true); }
function shot(b,u) {
  const p = effectiveProfile(u), targets = acquireTargets(b,u,p); assert.ok(targets.length);
  performAttack(b,u,p,targets); u.atkCd=1000;
}
const own = (hits,u) => hits.filter(h => h.source === u);
const bbFor = (n,rank) => Object.fromEntries(source.tables.skills[`skchr_chen2_${n}`].levels[rank-1].blackboard.map(x => [x.key,x.value]));
for (let rank=1; rank<=10; rank++) test(`S1 rank ${rank}: four ammo, all-range trait, attack SP and AUTO source`, () => {
  const {b,u,hits} = make({rank}), bb = bbFor(1,rank), close = enemy(b), far = enemy(b,{x:7}), air = enemy(b,{x:7,y:6,fly:true});
  const lv = source.tables.skills.skchr_chen2_1.levels[rank-1];
  assert.equal(u.skill.spCost,lv.spData.spCost); assert.equal(u.skill.spType,'attack'); assert.equal(u.skill.manual,false);
  cast(b,u); advance(b,.2); assert.equal(u.mem.regularFormVisual.clip,'Skill_Idle'); assert.equal(u.skill.ammoLeft,bb['attack@trigger_time']);
  near(u.s.atk,u.base.atk*(1+bb.atk)); shot(b,u); advance(b,.6);
  assert.equal(own(hits,u).length,3);
  for(const e of [close,far,air]) near(own(hits,u).find(h=>h.target===e).amount,u.s.atk*1.5-e.s.def);
  assert.equal(u.skill.ammoLeft,3); near(u.skill.spTotal,0);
  for(let i=0;i<3;i++){shot(b,u);advance(b,.6);}
  assert.equal(u.skill.active,false); near(u.skill.spTotal,0); advance(b,.2);
  shot(b,u); advance(b,.6); near(u.skill.spTotal,1);
});
for (let rank=1; rank<=10; rank++) test(`S2 rank ${rank}: partial/full charge ammo and nonstacking source liquid`, () => {
  const {b,u,hits} = make({skill:1,rank}), bb = bbFor(2,rank), close = enemy(b), far = enemy(b,{x:7}), air = enemy(b,{x:7,y:6,fly:true});
  cast(b,u,u.skill.spCost*1.5); advance(b,.2); near(u.skill.spTotal,0);
  assert.equal(u.skill.ammoLeft,bb['attack@trigger_time']);
  shot(b,u); advance(b,.6); const hs = own(hits,u); assert.equal(hs.length,3);
  near(hs.find(h=>h.target===close).amount,u.s.atk*1.5-Math.max(0,400+bb['attack@def']));
  near(hs.find(h=>h.target===far).amount,u.s.atk-Math.max(0,400+bb['attack@def']));
  near(hs.find(h=>h.target===air).amount,u.s.atk-400);
  near(close.s.moveSpeed,1+bb['attack@move_speed']); assert.equal(air.findBuff('chen2:slime'),null);
  shot(b,u); advance(b,.6); assert.equal(close.buffs.filter(f=>f.key==='chen2:slime').length,1);
  near(close.s.def,400+bb['attack@def']);
  assert.equal(b.activateOperator(ID),true); advance(b,.2);
  cast(b,u,u.skill.spCost*2); assert.equal(u.skill.ammoLeft,bb['attack@another_trigger_time']); near(u.skill.spTotal,0);
});
for (let rank=1; rank<=10; rank++) test(`S3 rank ${rank}: expanded range, simultaneous double damage and two ammo per attack`, () => {
  const {b,u,hits} = make({skill:2,rank}), bb = bbFor(3,rank), a = enemy(b,{x:7,y:7}), air = enemy(b,{x:7,y:3,fly:true});
  cast(b,u); advance(b,.2); assert.deepEqual(u.liveRangeGrid,u.def.skill.rangeGrid);
  assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle'); const ammo=u.skill.ammoLeft;
  shot(b,u); advance(b,.6); const hs=own(hits,u); assert.equal(hs.length,4);
  const ground=hs.filter(h=>h.target===a), flying=hs.filter(h=>h.target===air);
  for(const h of ground) near(h.amount,u.s.atk*1.5-Math.max(0,400+bb['attack@def']));
  for(const h of flying) near(h.amount,u.s.atk*1.5-400);
  near(ground[0].time,ground[1].time); assert.equal(new Set(hs.map(h=>h.dmg.attackId)).size,1);
  assert.equal(u.skill.ammoLeft,ammo-2); near(u.skill.spTotal,0); near(a.s.moveSpeed,1+bb['attack@move_speed']);
});
test('ordinary spreadshot applies the near trait to ground/air and can hit every legal range victim', () => {
  const {b,u,hits}=make(),close=enemy(b),far=enemy(b,{x:7}),air=enemy(b,{x:6,y:6,fly:true}),out=enemy(b,{x:8});
  shot(b,u); advance(b,.6); const hs=own(hits,u); assert.equal(hs.length,3);
  near(hs.find(h=>h.target===close).amount,u.s.atk*1.5-400); near(hs.find(h=>h.target===far).amount,u.s.atk-400);
  near(hs.find(h=>h.target===air).amount,u.s.atk*1.5-400); near(out.hp,out.s.maxHp);
});
test('native CAST selector resamples victims at the hit instead of retaining the initial range group', () => {
  const {b,u,hits}=make(),old=enemy(b),incoming=enemy(b,{x:8}); shot(b,u);
  old.x=8;incoming.x=6;b._buildEnemyIndex();advance(b,.6);
  assert.deepEqual(own(hits,u).map(h=>h.target),[incoming]);
});
for(const dir of ['RIGHT','LEFT','UP','DOWN']) test(`${dir} source facing and capped .5-second attack event`,()=>{
  const {b,u,hits}=make({dir}),e=enemy(b,{x:dir==='RIGHT'?6:dir==='LEFT'?4:5,y:dir==='UP'?6:dir==='DOWN'?4:5});
  b.addBuff(u,{key:'test:fast',mods:{aspd:200}});shot(b,u);advance(b,.4);assert.equal(own(hits,u).length,0);
  advance(b,.15);assert.equal(own(hits,u).length,1);near(own(hits,u)[0].amount,u.s.atk*1.5-e.s.def);
});
test('attack BAT debuff lengthens native time-mode windup',()=>{
  const {b,u,hits}=make();enemy(b);b.addBuff(u,{key:'test:bat',mods:{batPct:1}});shot(b,u);
  advance(b,.8);assert.equal(own(hits,u).length,0);advance(b,.2);assert.equal(own(hits,u).length,1);
});
for(const [elite,potential,chance] of [[0,1,0],[1,1,.15],[1,5,.17],[2,1,.2],[2,5,.22]]) test(`Frugality E${elite}/P${potential}: selected self probability ${chance}`,()=>{
  const {b,u}=make({elite,potential}),e=enemy(b);cast(b,u);advance(b,.2);
  let draws=0;b.rng=()=>{draws++;return chance ? chance-.001 : 0;};shot(b,u);advance(b,.6);
  assert.equal(u.skill.ammoLeft,chance?4:3);assert.equal(draws,chance?1:0);
  if(chance){b.rng=()=>chance;shot(b,u);advance(b,.6);assert.equal(u.skill.ammoLeft,3);}
  assert.ok(e.alive);
});
test('one Frugality roll saves both S3 ammo and draws once regardless of target/hit count',()=>{
  const {b,u,hits}=make({skill:2});enemy(b);enemy(b,{x:7});cast(b,u);advance(b,.2);
  let draws=0;b.rng=()=>{draws++;return .19;};shot(b,u);advance(b,.6);
  assert.equal(u.skill.ammoLeft,32);assert.equal(draws,1);assert.equal(own(hits,u).length,4);
  b.rng=()=>.2;shot(b,u);advance(b,.6);assert.equal(u.skill.ammoLeft,30);
});
test('E2 Frugality reaches a later-deployed Sniper ammo skill and disappears with Ch’en',()=>{
  const {b,u}=make({skill:1,others:['char_456_ash']});const ally=b.deployOperator('char_456_ash',3,3,'RIGHT');
  ally.profile.canAttack=()=>false;ally.atkCd=1000;advance(b,1.1);
  ally.skill.setSpTotal(ally.skill.spCost);assert.equal(ally.skill.activate('manual'),true);const ammo=ally.skill.ammoLeft;
  let draws=0;b.rng=()=>{draws++;return .099;};ally.skill.onAttackPerformed([],true);
  assert.equal(ally.skill.ammoLeft,ammo);assert.equal(draws,1);
  b.rng=()=>.1;ally.skill.onAttackPerformed([],true);assert.equal(ally.skill.ammoLeft,ammo-1);
  b.retreatOperator(ID);b.rng=()=>{throw Error('Inactive aura must not roll');};ally.skill.onAttackPerformed([],true);
  assert.equal(ally.skill.ammoLeft,ammo-2);assert.deepEqual(b.errors,[]);assert.equal(u.alive,false);
});
test('E1 Frugality never supplies the other-Sniper chance',()=>{
  const {b}=make({elite:1,others:['char_456_ash']});const ally=b.deployOperator('char_456_ash',3,3,'RIGHT');
  advance(b,1.1);ally.skill.setSpTotal(ally.skill.spCost);ally.skill.activate('manual');const ammo=ally.skill.ammoLeft;
  b.rng=()=>{throw Error('E1 ally aura must not roll');};ally.skill.onAttackPerformed([],true);
  assert.equal(ally.skill.ammoLeft,ammo-1);assert.deepEqual(b.errors,[]);
});
test('Typhon’s custom ammo holder honors a saved shot',()=>{
  const {b,hits}=make({others:[{id:'char_2012_typhon',skill:2}]});
  const ally=b.deployOperator('char_2012_typhon',3,3,'RIGHT');
  ally.profile.canAttack=()=>false;ally.atkCd=1000;enemy(b,{x:5,y:3});advance(b,1.1);
  cast(b,ally);advance(b,1.1);const ammo=ally.skill.ammoLeft;
  b.rng=()=>.099;shot(b,ally);advance(b,1.1);
  assert.equal(ally.skill.ammoLeft,ammo);assert.equal(own(hits,ally).length,5);
  b.rng=()=>.1;shot(b,ally);advance(b,1.1);
  assert.equal(ally.skill.ammoLeft,ammo-1);assert.equal(own(hits,ally).length,10);
});
test('highest aura chance draws once, already free shots and non-Snipers do not roll',()=>{
  const {b,u}=make({skill:2,others:['char_1032_excu2']});cast(b,u);advance(b,.2);
  b.on('beforeAmmoUse',ctx=>{ctx.spareShotProb=Math.max(ctx.spareShotProb,.5);});
  let draws=0;b.rng=()=>{draws++;return .4;};u.skill.onAttackPerformed([],true);assert.equal(u.skill.ammoLeft,32);assert.equal(draws,1);
  u.skill.onAttackPerformed([],true,true);assert.equal(u.skill.ammoLeft,32);assert.equal(draws,1);
  const ally=b.deployOperator('char_1032_excu2',3,3,'RIGHT');assert.equal(ally.def.profession,'WARRIOR');
});
test('Frugality alone never saves a non-Sniper ammo skill',()=>{
  const {b}=make({others:['char_1032_excu2']});const ally=b.deployOperator('char_1032_excu2',3,3,'RIGHT');
  advance(b,1.1);ally.skill.setSpTotal(ally.skill.spCost);ally.skill.activate('manual');const ammo=ally.skill.ammoLeft;
  // Executor's source attack RNG is not invoked by this direct ammo hook.
  b.rng=()=>{throw Error('Guard must not roll Sniper aura');};ally.skill.onAttackPerformed([],true);assert.deepEqual(b.errors,[]);
  // His custom family holder, rather than onAttackPerformed, owns consumption.
  assert.equal(ally.skill.ammoLeft,ammo);
});
for(const water of [false,true]) test(`Vestiges uses exact source map water tag: ${water}`,()=>{
  const {u}=make({water});near(u.s.aspd,water?112:108);
});
test('S2/S3 sticky field persists through manual cancellation and retreat, admits ground newcomers and excludes air',()=>{
  const {b,u}=make({skill:2});enemy(b);cast(b,u);advance(b,.2);shot(b,u);advance(b,.6);
  assert.equal(b.activateOperator(ID),true);b.retreatOperator(ID);
  const newcomer=enemy(b,{x:7,y:7}),air=enemy(b,{x:7,y:3,fly:true});advance(b,.3);
  near(newcomer.s.def,180);near(newcomer.s.moveSpeed,.55);assert.equal(air.findBuff('chen2:slime'),null);
  advance(b,5);near(newcomer.s.def,400);near(newcomer.s.moveSpeed,1);
});
test('a sticky field is fixed to its fired range and debuff lingers only for the native refresh tail after leaving',()=>{
  const {b,u}=make({skill:1}),e=enemy(b);cast(b,u);advance(b,.2);shot(b,u);advance(b,.6);
  e.x=8;b._buildEnemyIndex();advance(b,.3);near(e.s.def,400);near(e.s.moveSpeed,1);
  e.x=6;b._buildEnemyIndex();advance(b,.3);near(e.s.def,230);near(e.s.moveSpeed,.65);
});
test('liquid flat DEF is added after percentage DEF modifiers and is independent of damage dodge',()=>{
  const {b,u,hits}=make({skill:2}),e=enemy(b);b.addBuff(e,{key:'test:def',mods:{defPct:1}});
  b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});cast(b,u);advance(b,.2);shot(b,u);advance(b,.6);
  near(e.s.def,580);near(e.hp,e.s.maxHp);assert.equal(own(hits,u).length,0);
});
test('overlapping liquid fields do not multiply speed or add duplicate DEF penalties',()=>{
  const {b,u}=make({skill:2}),e=enemy(b);cast(b,u);advance(b,.2);
  for(let i=0;i<3;i++){shot(b,u);advance(b,.6);}
  near(e.s.def,180);near(e.s.moveSpeed,.55);assert.equal(e.buffs.filter(f=>f.key==='chen2:slime').length,1);
});
test('S2/S3 final ammo locks through the attack tail, preserves last field and resumes SP after finish',()=>{
  for(const skill of [1,2]){
    const {b,u,hits}=make({skill}),e=enemy(b);cast(b,u);advance(b,.2);u.skill.ammoLeft=skill===2?2:1;
    shot(b,u);advance(b,.6);assert.equal(u.skill.ammoLeft,0);assert.equal(u.skill.active,true);
    assert.ok(e.findBuff('chen2:slime'));assert.equal(own(hits,u).length,skill===2?2:1);near(u.skill.spTotal,0);
    advance(b,1.6);assert.equal(u.skill.active,true);advance(b,.3);assert.equal(u.skill.active,false);
    advance(b,.3);assert.ok(u.skill.spTotal>0);
  }
});
test('stun cancels an unfired attack without ammo, damage or a field; recovery continues after the skill ends',()=>{
  const {b,u,hits}=make({skill:2}),e=enemy(b);cast(b,u);advance(b,.2);shot(b,u);b.applyStatus(u,'stun',{duration:.1});advance(b,.6);
  assert.equal(u.skill.ammoLeft,32);assert.equal(own(hits,u).length,0);assert.equal(e.findBuff('chen2:slime'),null);
  b.activateOperator(ID);advance(b,.4);assert.ok(u.skill.spTotal>0);
});
test('retreat and redeploy reset ammo, charged state and source visual timers',()=>{
  const {b,u}=make({skill:1});cast(b,u,u.skill.spCost*2);advance(b,.2);assert.equal(u.skill.ammoLeft,20);
  b.retreatOperator(ID);advance(b,71);b.addDp('arkpedia',99);const fresh=b.deployOperator(ID,5,5,'LEFT');
  assert.ok(fresh);assert.notEqual(fresh,u);assert.equal(fresh.skill.active,false);assert.equal(fresh.skill.ammoLeft,0);
  assert.equal(skillHud(fresh.skill).charged,undefined);advance(b,1.1);assert.ok(fresh.mem.regularFormVisual==null);
});
test('S1 automatically starts at full offensive SP without a manual ready button and remains cancellable',()=>{
  const {b,u}=make();u.skill.setSpTotal(u.skill.spCost);advance(b,.2);
  assert.equal(u.skill.active,true);assert.equal(skillHud(u.skill).ready,false);assert.equal(skillHud(u.skill).canCancel,true);
  assert.equal(b.activateOperator(ID),true);assert.equal(u.skill.active,false);
});
test('S2 charged indicator appears only at two full charges and consumes all SP',()=>{
  const {b,u}=make({skill:1});u.skill.setSpTotal(u.skill.spCost*1.9);assert.equal(skillHud(u.skill).charged,undefined);
  u.skill.setSpTotal(u.skill.spCost*2);assert.equal(skillHud(u.skill).charged,true);assert.equal(b.activateOperator(ID),true);
  assert.equal(u.skill.ammoLeft,20);near(u.skill.spTotal,0);
});
test('source record retains original animation/facing/range evidence without claiming native effects or frame parity',()=>{
  assert.deepEqual(source.enabledOperators,[ID]);assert.equal(source.source.bundles.length,5);
  assert.equal(Object.keys(source.templates).length,9);assert.equal(source.models[ID].Front.hits.Skill_2_Loop[0],.5);
  assert.equal(source.models[ID].Back.hits.Attack[0],.5);assert.equal(source.tables.ranges['1-3'].grids.length,4);
  assert.equal(source.frameParity,false);assert.equal(source.moduleSupport,false);assert.equal(source.nativeParticleSupport,false);
  for(const face of ['Front','Back']){
    const entry=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`];
    const raw=readFileSync(new URL(`../../arkpedia-sd-assets/${entry.skeleton.path}`,import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'),source.models[ID][face].sha256);
  }
});
