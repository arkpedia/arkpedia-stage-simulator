// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-firewatch-prefabs.json' with { type: 'json' };
import { FIREWATCH_OPERATORS as configs } from '../shared/arkpedia/firewatch-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { canTargetAlly, areaSelectable, auraSelectable, absoluteRangeKeys } from '../server/sim/targeting.js';
import { COLS } from '../server/sim/constants.js';

const ID = 'char_158_milu';
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a-z) < eps, `${a} != ${z}`);
const rows = p => p.flatMap(g => g.components.map(c => ({ pathId: c.pathId, ...c.data })));
const advance = (b, seconds) => {
  for (let i=0; i<Math.ceil(seconds/b.dt-1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
function make({ skill=0, rank=10, elite=2, potential=1, dir='RIGHT', seed=3 }={}) {
  const src = structuredClone(data), op = src.operators[ID];
  src.stage.geometry.waves[0].spawns=[]; src.stage.battle.dp_per_second=0;
  const build = { ...defaultBuild(op), elite, level: op.phases[elite].maxLevel,
    skillId: op.skills[skill].id, skillRank: Math.min(rank, elite===2?10:elite===1?7:4), potential };
  const b = new StandardBattle(src, { operators: [build] }, { seed });
  b.autoFinish=false; b.recordEvents=true; const hits=[];
  b.on('damaged', ctx => hits.push(ctx));
  b.setViewport('fullscreen-workspace'); b.addDp('arkpedia',99);
  const u=b.deployOperator(ID,3,2,dir); assert.ok(u);
  u.atkCd=1000; u.skill.rule='NEVER';
  return { b, u, hits };
}
function enemy(b, { x=3, y=3, def=0, ranged=false, fly=false }={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});
  Object.assign(e.base,{maxHp:100000,def,res:0,moveSpeed:0}); e.markDirty(); void e.s; e.hp=100000;
  e.def={...e.def,applyWay:ranged?'RANGED':'MELEE'};
  if(fly)e.motion='FLY';
  b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}}); b._buildEnemyIndex();
  return e;
}
function move(b,e,x,y=e.y) {
  e.x=x;e.y=y;e.tileR=Math.round(y);e.tileC=Math.round(x); b._enemiesDirty=true;b._buildEnemyIndex();
}
function cast(b,u) {u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);u.atkCd=1000;}
function shot(b,u,e) {assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;}
const ownHits=(hits,u)=>hits.filter(x=>x.source===u);
function captureBombs(b,u) {
  const original=b.addProjectile.bind(b), bombs=[];
  b.addProjectile=p=>{const q=original(p);if(p.source===u&&p.visual==='bomb')bombs.push(q);return q;};
  return bombs;
}

test('complete source graphs, selected tables and native bindings retain explicit timing gaps',()=>{
  assert.deepEqual(Object.keys(configs),[ID]);assert.equal(evidence.frameParity,false);
  assert.equal(evidence.moduleSupport,false);assert.equal(evidence.sourceBundles.length,5);
  assert.equal(evidence.sourceInvestigations.materialBlockers.length,2);
  assert.match(evidence.runtimeMapping.s2Release,/fallback/);
  for(const [i,p] of data.operators[ID].phases.entries()) {
    near(p.maxLevel,evidence.tables.character.phases[i].maxLevel);
    assert.deepEqual(p.attributesKeyFrames,evidence.tables.character.phases[i].attributesKeyFrames);
  }
  for(const s of data.operators[ID].skills)assert.deepEqual(s.levels,evidence.tables.skills[s.id].levels);
  for(const face of ['Front','Back']) {
    const asset=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
    const raw=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
    near(evidence.models[ID][face].hits.Attack[0],.5);
  }
  assert.equal(evidence.models[ID].Back.durations.Skill,undefined);
  assert.equal(evidence.models[ID].Front.hits.Skill,undefined);
  const ability=rows(evidence.skills.skchr_milu_2).find(x=>x.pathId==='-3430969027431619421');
  assert.equal(ability._waitForAttackEvent,1);assert.equal(ability._selectTargetTiming,1);
  assert.equal(ability._faceToFront,0);assert.equal(ability._waitForProjectileInvalid,1);
  const collision=rows(evidence.projectiles.projectile_milu_s2).find(x=>x._targetOptions);
  assert.equal(collision._ignoreCamouflage,1);assert.equal(collision._onlyCheckHitWhenReachTarget,1);
});
test('normal attack selects one lowest-DEF victim and retains INPUT at release without area damage',()=>{
  const {b,u,hits}=make(),e=enemy(b,{def:10}),high=enemy(b,{x:3.2,def:400,fly:true});
  assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e]);shot(b,u,e);
  const next=enemy(b,{x:3.1,def:-10});advance(b,1);
  near(100000-e.hp,u.s.atk-10);near(high.hp,100000);near(next.hp,100000);
  assert.equal(ownHits(hits,u).length,1);
});
test('ordinary input that becomes target-free is not replaced by a fresh enemy',()=>{
  const {b,u,hits}=make(),e=enemy(b),next=enemy(b,{x:3.1});shot(b,u,e);
  b.addBuff(e,{key:'test:free',flags:{untargetable:true}});advance(b,1);
  near(e.hp,100000);near(next.hp,100000);assert.equal(ownHits(hits,u).length,0);
});
test('ordinary .5 event and ASPD cap use original facing clips, and slow ASPD delays release',()=>{
  for(const dir of ['RIGHT','LEFT','UP','DOWN'])for(const aspd of [50,100,200]) {
    const {b,u,hits}=make({dir}),e=enemy(b);b.addBuff(u,{key:'test:aspd',mods:{aspd:aspd-100}});
    shot(b,u,e);const event=b._evq.find(x=>x[0]==='atk'&&x[1]===u.id);
    near(event[4].windup,.5/Math.min(1,aspd/100));assert.equal(event[4].animation,'Attack');
    advance(b,event[4].windup-.1);assert.equal(ownHits(hits,u).length,0);advance(b,.4);
    assert.equal(ownHits(hits,u).length,1);
  }
});
test('Assassin applies selected promotion/potential attack scale before DEF only to ranged enemies',()=>{
  for(const [elite,potential,scale]of [[0,1,1],[1,1,1.2],[1,5,1.25],[2,1,1.4],[2,5,1.45]])
    for(const ranged of [false,true]) {
      const {b,u}=make({elite,potential}),e=enemy(b,{ranged,def:100});shot(b,u,e);advance(b,1);
      near(100000-e.hp,u.s.atk*(ranged?scale:1)-100);
    }
});
test('all ten S1 ranks retain manual SP, source ATK and duration, then remove only owned invisibility',()=>{
  for(let rank=1;rank<=10;rank++) {
    const {b,u}=make({rank}),selected=evidence.tables.skills.skchr_milu_1.levels[rank-1];
    near(u.skill.spCost,selected.spData.spCost);assert.equal(u.skill.manual,true);
    const atk=u.s.atk;cast(b,u);near(u.s.atk,atk*(1+selected.blackboard[0].value));
    near(u.skill.timeLeft,selected.duration);assert.equal(u.s.flags.stealth,true);
    assert.equal(Boolean(u.s.flags.camou),false);advance(b,.5);near(u.skill.spTotal,0);
    b.addBuff(u,{key:'test:independent',flags:{stealth:true}});u.skill.end('duration');
    near(u.s.atk,atk);assert.equal(u.s.flags.stealth,true);b.removeBuff(u,'test:independent');
    assert.equal(Boolean(u.s.flags.stealth),false);
  }
});
test('S1 invisibility stops direct and area/aura enemy selection but preserves the own-blocker exception',()=>{
  const {b,u}=make(),e=enemy(b,{ranged:true});cast(b,u);
  assert.equal(canTargetAlly(e,u,true),false);assert.equal(areaSelectable(e,u),false);
  assert.equal(auraSelectable(e,u),false);e.blockedBy=u;u.blocking=[e];
  assert.equal(canTargetAlly(e,u,true),true);assert.equal(areaSelectable(e,u),false);
  u.skill.end('duration');assert.equal(areaSelectable(e,u),true);
});
test('all ten S2 ranks release selected unique bomb count and scale with overlapping area damage',()=>{
  for(let rank=1;rank<=10;rank++) {
    const {b,u,hits}=make({skill:1,rank}),selected=evidence.tables.skills.skchr_milu_2.levels[rank-1];
    near(u.skill.spCost,selected.spData.spCost);near(u.skill.spTotal,selected.spData.initSp);
    const e=enemy(b),z=enemy(b,{x:4}),bombs=captureBombs(b,u);cast(b,u);
    advance(b,.9);assert.equal(bombs.length,0);advance(b,.3);
    assert.equal(bombs.length,u.skill.bb.max_cnt);assert.equal(u.mem.firewatchCast.released,true);
    assert.equal(new Set(bombs.map(p=>`${p.tx},${p.ty}`)).size,bombs.length);
    assert.ok(bombs.some(p=>p.tx===3&&p.ty===3));assert.ok(bombs.some(p=>p.tx===4&&p.ty===3));
    const bb=u.skill.bb,points=bombs.map(p=>[p.tx,p.ty]);advance(b,.5);
    for(const target of [e,z]) {
      const count=points.filter(([x,y])=>Math.hypot(target.x-x,target.y-y)<=1.2+1e-9).length;
      near(100000-target.hp,count*u.s.atk*bb.atk_scale);
    }
    assert.ok(ownHits(hits,u).length>=2);assert.equal(u.skill.active,false);
    assert.equal(u.mem.firewatchCast,null);assert.equal(u.stats.attacks,0);
  }
});
test('S2 original Front clip and real Back Idle use bounded completion clock without Front forcing',()=>{
  for(const dir of ['RIGHT','LEFT','UP','DOWN']) {
    const {b,u}=make({skill:1,dir});b.addBuff(u,{key:'test:slow',mods:{aspd:-50}});
    const bombs=captureBombs(b,u);cast(b,u);
    assert.equal(u.mem.regularFormVisual.clip,dir==='UP'?'Idle':'Skill');
    assert.equal(u.mem.regularFormVisual.forceFront,undefined);
    near(u.skill.timeLeft,2.5);advance(b,1.8);assert.equal(bombs.length,0);
    advance(b,.4);assert.equal(bombs.length,3);advance(b,.5);assert.equal(u.mem.regularFormVisual,null);
  }
});
test('S2 CAST selection sees current enemy tiles, fills empty tiles and retains deterministic seeded replay',()=>{
  const records=[];
  for(let i=0;i<2;i++) {
    const {b,u}=make({skill:1,seed:77}),e=enemy(b),bombs=captureBombs(b,u);cast(b,u);
    move(b,e,5);advance(b,1.2);assert.ok(bombs.some(p=>p.tx===5&&p.ty===3));
    records.push(bombs.map(p=>[p.tx,p.ty]));
  }
  assert.deepEqual(records[0],records[1]);
  const {b,u}=make({skill:1}),bombs=captureBombs(b,u);cast(b,u);advance(b,1.2);
  assert.equal(bombs.length,3);const keys=absoluteRangeKeys(u.def.rangeGrid,u.tileR,u.tileC,u.dir);
  for(const p of bombs)assert.ok(keys.includes(p.ty*COLS+p.tx));
});
test('S2 suppresses ordinary attacks, SP and repeated activation until the bombs arrive',()=>{
  const {b,u}=make({skill:1});enemy(b);const bombs=captureBombs(b,u);cast(b,u);
  u.atkCd=0;advance(b,1.3);assert.equal(u.stats.attacks,0);near(u.skill.spTotal,0);
  assert.equal(bombs.length,3);u.skill.setSpTotal(u.skill.spCost);
  assert.equal(b.activateOperator(ID),false);u.skill.setSpTotal(0);advance(b,.4);
  assert.equal(u.skill.active,false);assert.ok(u.skill.spTotal>0);assert.ok(u.stats.attacks>0);
});
test('S2 static .5 arrival collides once at fixed tile using current victim position and ranged talent',()=>{
  const {b,u,hits}=make({skill:1,potential:5}),e=enemy(b),bombs=captureBombs(b,u);
  cast(b,u);advance(b,1.2);const p=bombs[0];near(p.fromX,p.tx);near(p.fromY,p.ty);
  near(p.flightTime,.5);assert.equal(p.target,null);assert.equal(ownHits(hits,u).length,0);
  move(b,e,11,0);const victim=enemy(b,{x:p.tx,y:p.ty,ranged:true,def:100});
  const count=bombs.filter(q=>Math.hypot(q.tx-victim.x,q.ty-victim.y)<=1.2+1e-9).length;
  advance(b,.6);near(e.hp,100000);
  near(100000-victim.hp,count*(u.s.atk*3*1.45-100));
  const n=ownHits(hits,u).length;advance(b,1);assert.equal(ownHits(hits,u).length,n);
});
test('S2 blast admits air/camouflage but rejects hidden/free/Sleep/unrevealed invisibility',()=>{
  const {b,u}=make({skill:1}),bombs=captureBombs(b,u);enemy(b);cast(b,u);advance(b,1.2);
  const point=bombs[0],opts={x:point.tx,y:point.ty};
  const air=enemy(b,{...opts,fly:true}),camo=enemy(b,opts),hidden=enemy(b,opts),free=enemy(b,opts),sleep=enemy(b,opts),invisible=enemy(b,opts);
  b.addBuff(camo,{key:'camo',flags:{camou:true}});hidden.hidden=true;
  b.addBuff(free,{key:'free',flags:{untargetable:true}});b.applyStatus(sleep,'sleep',{duration:10});
  b.addBuff(invisible,{key:'invisible',flags:{stealth:true}});advance(b,.6);
  assert.ok(air.hp<100000);assert.ok(camo.hp<100000);
  for(const e of [hidden,free,sleep,invisible])near(e.hp,100000);
  assert.equal(Boolean(camo.s.flags.reveal),false);
});
test('radius collision can hit just outside cast range and excludes victims beyond1.2',()=>{
  const {b,u}=make({skill:1}),bombs=captureBombs(b,u);
  const keys=absoluteRangeKeys(u.def.rangeGrid,u.tileR,u.tileC,u.dir);
  const edge=keys.reduce((a,z)=>z%COLS>a%COLS?z:a);
  enemy(b,{x:edge%COLS,y:Math.floor(edge/COLS)});cast(b,u);advance(b,1.2);
  // Force no geometry assumption: inspect one born bomb and remove the other
  // two from this scoped radius check, without changing its collision callback.
  const p=bombs[0];b.projectiles.remove(q=>q!==p);
  const inside=enemy(b,{x:p.tx+.6,y:p.ty}),outside=enemy(b,{x:p.tx+1.21,y:p.ty});
  assert.equal(keys.includes(Math.round(inside.y)*COLS+Math.round(inside.x)),false);
  advance(b,.6);assert.ok(inside.hp<100000);near(outside.hp,100000);
});
test('accepted transient control cancels unborn bombs; immunity preserves release and born bombs survive control',()=>{
  for(const immune of [false,true]) {
    const {b,u}=make({skill:1}),bombs=captureBombs(b,u);if(immune)u.def.immune.add('stun');
    cast(b,u);b.applyStatus(u,'stun',{duration:.001});advance(b,1.8);
    assert.equal(bombs.length,immune?3:0);assert.equal(u.mem.firewatchCast,null);
  }
  const {b,u}=make({skill:1}),e=enemy(b),bombs=captureBombs(b,u);cast(b,u);advance(b,1.2);
  b.applyStatus(u,'freeze',{duration:1});advance(b,.5);assert.equal(bombs.length,3);assert.ok(e.hp<100000);
});
test('unborn attacks and bombs cancel on retreat; emitted arrows and bombs survive source retirement',()=>{
  for(const skill of [0,1])for(const born of [false,true]) {
    const {b,u}=make({skill}),e=enemy(b,{x:skill?3:5});
    if(skill)cast(b,u);else shot(b,u,e);
    advance(b,skill?(born?1.2:.5):(born?.6:.2));b.retreatOperator(ID);assert.equal(u.deployed,false);
    advance(b,1);if(born)assert.ok(e.hp<100000);else near(e.hp,100000);
  }
});
test('natural ordinary loop counts one attack and hits one victim; S1 switch cancels an unborn arrow',()=>{
  const {b,u,hits}=make(),e=enemy(b),other=enemy(b,{x:3.2,def:100});
  u.atkCd=0;advance(b,.9);assert.equal(u.stats.attacks,1);assert.equal(ownHits(hits,u).length,1);
  near(other.hp,100000);shot(b,u,e);cast(b,u);advance(b,1);
  assert.equal(ownHits(hits,u).length,1);
});
