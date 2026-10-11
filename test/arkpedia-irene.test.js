// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-irene-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
const ID = 'char_4009_irene';
const near = (a, z, tol = 1e-5) => assert.ok(Math.abs(a-z) < tol, `${a} != ${z}`);
function advance(b, seconds) { const end = b.time+seconds; while (b.time < end-1e-9) b.step(); assert.deepEqual(b.errors, []); }
function make({ skill=0, rank=10, elite=2, potential=1, dir='RIGHT' }={}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns=[]; d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19; d.stage.geometry.cols=21;
  d.stage.geometry.tileGrid=Array.from({ length:19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level:o.phases[elite].maxLevel,
    skillId:o.skills[skill].id, skillRank:Math.min(rank, [4,7,10][elite]) };
  const b = new StandardBattle(d, { operators:[build] }, { seed:1 });
  b.autoFinish=false; b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t => ({ ...t, height:'LOW', build:'ALL', pass:'ALL' })); b.addDp('arkpedia',99);
  const hits=[]; b.on('damaged', c => hits.push({ ...c, time:b.time }));
  const u=b.deployOperator(ID,5,5,dir); u.atkCd=1000; u.profile.canAttack=()=>false;
  advance(b,1.1); b.rng=()=>.99; return { b,u,hits };
}
function enemy(b,{ x=6,y=5,fly=false,hp=100000,def=0,weight=1 }={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{ pos:[y,x] });
  Object.assign(e.base,{ maxHp:hp,def,moveSpeed:0,massLevel:weight }); e.markDirty(); void e.s; e.hp=hp;
  if(fly)e.motion='FLY'; b.addBuff(e,{ key:'test:pin',flags:{ noMove:true,disarm:true } }); b._buildEnemyIndex(); return e;
}
function cast(b,u,total=u.skill.spCost) { u.skill.setSpTotal(total); assert.equal(u.skill.activate('manual'),true); }
function shot(b,u) { const p=effectiveProfile(u), targets=acquireTargets(b,u,p); assert.ok(targets.length);
  performAttack(b,u,p,targets); u.atkCd=1000; }
const outputs = (hits,u) => hits.filter(h=>h.source===u);
const bbFor = (n,rank) => Object.fromEntries(Object.values(source.tables.skills)[n-1].levels[rank-1].blackboard.map(v=>[v.key,v.value]));
test('Irene preserves all30 source ranks, exact facings and native non-event-driven bombardments',()=>{
  assert.equal(Object.values(source.tables.skills).flatMap(s=>s.levels).length,30);
  assert.equal(source.source.bundles.length,5); assert.equal(Object.keys(source.templates).length,4);
  for(const face of ['Front','Back']) {
    assert.equal(source.models[ID][face].sha256,source.officialSkeletonBindings[ID][face].sha256);
    assert.equal(source.models[ID][face].hits.Attack.length,2);
    assert.equal(source.models[ID][face].hits.Skill_3_Attack.length,6);
  }
  assert.equal(source.frameParity,false); assert.equal(source.moduleSupport,false);
});
for(let rank=1;rank<=10;rank++) test(`S1 rank${rank}: retained two-hit victim, damage then Levitate and full animation SP lock`,()=>{
  const{b,u,hits}=make({rank}), e=enemy(b), spare=enemy(b,{x:6.2}), bb=bbFor(1,rank);
  cast(b,u); shot(b,u); advance(b,.35); assert.equal(outputs(hits,u).length,1);
  assert.equal(e.s.flags.levitate,true); advance(b,.25);
  const out=outputs(hits,u); assert.equal(out.length,2); assert.ok(out.every(h=>h.target===e));
  near(out[0].amount,u.s.atk*bb.atk_scale); near(out[1].amount,u.s.atk*bb.atk_scale);
  near(spare.hp,spare.s.maxHp); near(u.skill.spTotal,0); assert.ok(u.mem.ireneCast);
  u.skill.gainSp(2,'talent'); near(u.skill.spTotal,0); advance(b,.7); assert.equal(u.mem.ireneCast,null);
  u.skill.gainSp(1,'talent'); near(u.skill.spTotal,1);
});
for(let rank=1;rank<=10;rank++) test(`S2 rank${rank}: source cap, two stored charges and weight-gated Levitate`,()=>{
  const{b,u,hits}=make({skill:1,rank}),bb=bbFor(2,rank);
  const es=Array.from({length:8},(_,i)=>enemy(b,{x:6+(i%2)*.1,y:5+(i%3)*.05,weight:i===0?4:3}));
  cast(b,u,u.skill.spCost*2); assert.equal(u.skill.charges,1); assert.equal(u.skill.maxCharges,2);
  advance(b,.2); assert.equal(outputs(hits,u).length,0); advance(b,.15);
  const out=outputs(hits,u); assert.equal(out.length,bb.max_target);
  for(const h of out) near(h.amount,u.s.atk*bb.atk_scale);
  for(const h of out) assert.equal(h.target.s.flags.levitate||false,h.target.s.massLevel<=3);
  assert.equal(es[0].s.flags.levitate||false,false);
  near(u.skill.spTotal,u.skill.spCost); u.skill.gainSp(1,'talent'); near(u.skill.spTotal,u.skill.spCost);
  advance(b,.55); assert.equal(u.skill.active,false); near(u.skill.spTotal,u.skill.spCost);
});
for(let rank=1;rank<=10;rank++) test(`S3 rank${rank}: ground opener, random bombardments, native count/radius and fixed cast duration`,()=>{
  const{b,u,hits}=make({skill:2,rank}),bb=bbFor(3,rank), e=enemy(b),fly=enemy(b,{x:6.5,fly:true});
  cast(b,u); advance(b,.15); assert.equal(outputs(hits,u).length,1); assert.equal(outputs(hits,u)[0].target,e);
  near(outputs(hits,u)[0].amount,u.s.atk*bb.atk_scale); assert.equal(e.s.flags.levitate,true);
  advance(b,3); const out=outputs(hits,u); assert.equal(out.length,1+bb.multi_times*2);
  assert.equal(out.filter(h=>h.target===fly).length,bb.multi_times);
  for(const h of out.slice(1)) near(h.amount,u.s.atk*bb.multi_atk_scale);
  assert.equal(u.skill.active,true); near(u.skill.spTotal,0); advance(b,.4); assert.equal(u.skill.active,false);
  assert.equal(u.mem.ireneCast,null);
});
for(const dir of ['UP','RIGHT','DOWN','LEFT']) test(`${dir} selects original S1 facing timing`,()=>{
  const{b,u,hits}=make({dir}), positions={UP:[5,6],RIGHT:[6,5],DOWN:[5,4],LEFT:[4,5]};
  const[x,y]=positions[dir]; enemy(b,{x,y}); cast(b,u); shot(b,u);
  advance(b,.34); assert.equal(outputs(hits,u).length,dir==='UP'?0:1);
  advance(b,.3); assert.equal(outputs(hits,u).length,2);
});
test('normal Swordmaster hits are separated and hit one target even while blocking two',()=>{
  const{b,u,hits}=make(),e=enemy(b),spare=enemy(b,{x:6.1}); shot(b,u);
  advance(b,.43); assert.equal(outputs(hits,u).length,1); near(u.skill.spTotal,1);
  advance(b,.1); assert.equal(outputs(hits,u).length,2); near(u.skill.spTotal,1);
  assert.ok(outputs(hits,u).every(h=>h.target===e)); near(spare.hp,spare.s.maxHp);
});
test('a killed first victim never redirects the second basic hit',()=>{
  const{b,u,hits}=make(),e=enemy(b,{hp:1}),spare=enemy(b,{x:6.1}); shot(b,u); advance(b,.7);
  assert.equal(e.alive,false); assert.equal(outputs(hits,u).length,1); near(spare.hp,spare.s.maxHp);
});
test('S1 dead input refunds its charge before a release and does not acquire another victim',()=>{
  const{b,u,hits}=make(),e=enemy(b),spare=enemy(b,{x:6.1}); cast(b,u); shot(b,u); b.kill(e); advance(b,.6);
  assert.equal(outputs(hits,u).length,0); near(u.skill.spTotal,u.skill.spCost); near(spare.hp,spare.s.maxHp);
  assert.equal(u.mem.ireneCast,null);
});
for(const skill of [0,1,2]) test(`S${skill+1} brief control cancels scheduled hits and clears cast lock`,()=>{
  const{b,u,hits}=make({skill}); enemy(b); cast(b,u); if(skill===0)shot(b,u);
  b.applyStatus(u,'stun',{duration:.05}); advance(b,.1); advance(b,4);
  assert.equal(outputs(hits,u).length,0); assert.equal(u.mem.ireneCast,null); assert.equal(u.skill.active,false);
});
for(const skill of [0,1,2]) test(`S${skill+1} source retreat cancels delayed damage`,()=>{
  const{b,u,hits}=make({skill}); enemy(b); cast(b,u); if(skill===0)shot(b,u);
  b.retreatOperator(ID); assert.equal(u.deployed,false); advance(b,4); assert.equal(outputs(hits,u).length,0); assert.equal(u.mem.ireneCast,null);
});
test('S2 cannot activate on flyers or absent targets; S3 can activate on flyers without a ground opener',()=>{
  const{b,u,hits}=make({skill:1}); u.skill.setSpTotal(u.skill.spCost); assert.equal(u.skill.activate(),false);
  enemy(b,{fly:true}); assert.equal(u.skill.activate(),false); near(u.skill.spTotal,u.skill.spCost);
  const v=make({skill:2}); enemy(v.b,{fly:true}); cast(v.b,v.u); advance(v.b,.15);
  assert.equal(outputs(v.hits,v.u).length,0); advance(v.b,3); assert.equal(outputs(v.hits,v.u).length,12);
});
test('heavy S3 Levitate halves duration; heavy S2 targets are never levitated',()=>{
  const{b,u}=make({skill:2}),e=enemy(b,{weight:4}); cast(b,u); advance(b,.2); assert.equal(e.s.flags.levitate,true);
  advance(b,2); assert.equal(e.s.flags.levitate||false,false);
});
test('Levitate immunity keeps damage; status resistance halves duration',()=>{
  const{b,u}=make({skill:1}),immune=enemy(b),resist=enemy(b,{x:6.2});
  immune.def={...immune.def,immune:new Set(['levitate'])}; b.applyStatus(resist,'resist',{duration:10,value:.5});
  cast(b,u); advance(b,.3); assert.equal(immune.s.flags.levitate||false,false); assert.ok(immune.hp<immune.s.maxHp);
  advance(b,2); assert.equal(resist.s.flags.levitate||false,false);
});
test('bombardment reselects each round; empty rounds are discarded without shortening the cast',()=>{
  const{b,u,hits}=make({skill:2}),e=enemy(b); cast(b,u); advance(b,.35); const before=outputs(hits,u).length;
  e.x=12;e.y=12;b._buildEnemyIndex();advance(b,.8);assert.equal(outputs(hits,u).length,before);
  const late=enemy(b,{fly:true}); advance(b,1); assert.ok(outputs(hits,u).some(h=>h.target===late));
  advance(b,1.5); assert.equal(u.skill.active,false);
});
for(const elite of [0,1,2]) test(`E${elite} physical penetration follows selected talent and guaranteed Levitate`,()=>{
  const{b,u,hits}=make({elite}),e=enemy(b,{def:600}); b.rng=()=>0; shot(b,u);advance(b,.7);
  const pct=[0,.3,.5][elite]; for(const h of outputs(hits,u))near(h.dmg.defIgnorePct,pct);
  const before=hits.length; b.rng=()=>.99; b.applyStatus(e,'levitate',{duration:2});
  b.dealDamage(u,e,{amount:1000,type:'phys'}); near(hits[before].dmg.defIgnorePct,pct);
  b.dealDamage(u,e,{amount:1000,type:'arts'}); near(hits.at(-1).dmg.defIgnorePct,0);
});
test('aerial guaranteed penetration consumes no RNG; penetration survives a dodge but not output damage',()=>{
  const{b,u,hits}=make(),e=enemy(b,{fly:true}); let calls=0;b.rng=()=>{calls++;return .99;};
  b.dealDamage(u,e,{amount:1000,type:'phys'});near(hits.at(-1).dmg.defIgnorePct,.5);assert.equal(calls,0);
  e.motion='GROUND';b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});b.rng=()=>0;
  b.dealDamage(u,e,{amount:1000,type:'phys'}); assert.equal(u.mem.irenePenetration,true);
  b.removeBuff(e,'test:dodge');b.rng=()=>.99;b.dealDamage(u,e,{amount:1000,type:'phys'});
  near(hits.at(-1).dmg.defIgnorePct,.5);assert.equal(u.mem.irenePenetration,false);
  b.dealDamage(u,e,{amount:1000,type:'phys'});near(hits.at(-1).dmg.defIgnorePct,0);
});
for(const potential of [1,5]) test(`P${potential} Sea Monster presence doubles ASPD once and removes it when the last leaves`,()=>{
  const{b,u}=make({potential}),a=enemy(b),c=enemy(b,{x:12});const speed=potential===5?21:18;
  near(u.s.aspd,100+speed); a.tags.add('seamonster');c.tags.add('seamonster'); advance(b,.05);
  near(u.s.aspd,100+speed*2); b.kill(a);advance(b,.05);near(u.s.aspd,100+speed*2);
  b.kill(c);advance(b,.05);near(u.s.aspd,100+speed);
});
test('S3 fixed duration is independent of ASPD; S2 captures cast-time ASPD',()=>{
  const{b,u}=make({skill:2});enemy(b);b.addBuff(u,{key:'test:speed',mods:{aspd:100}});cast(b,u);
  advance(b,3.3);assert.equal(u.skill.active,true);advance(b,.25);assert.equal(u.skill.active,false);
  const v=make({skill:1});enemy(v.b);v.b.addBuff(v.u,{key:'test:speed',mods:{aspd:100}});cast(v.b,v.u);
  advance(v.b,.4);assert.equal(v.u.skill.active,true);advance(v.b,.1);assert.equal(v.u.skill.active,false);
});
test('automatic S1 cycles recover one offensive SP per basic attack, then emit exactly two retained skill hits',()=>{
  const{b,u,hits}=make(),e=enemy(b);u.atkCd=0;u.profile.canAttack=()=>!u.mem.ireneCast;
  advance(b,15);const byAttack=new Map();
  for(const h of outputs(hits,u)){const id=h.dmg.attackId;const group=byAttack.get(id)||[];group.push(h);byAttack.set(id,group);}
  const skills=[...byAttack.values()].filter(h=>h[0].dmg.isSkill);
  assert.ok(skills.length>=2);for(const hs of skills){assert.equal(hs.length,2);assert.ok(hs.every(h=>h.target===e));}
});
test('normal second hit cancels on a brief stun even if action resumes before its event',()=>{
  const{b,u,hits}=make();enemy(b);shot(b,u);advance(b,.43);
  b.applyStatus(u,'stun',{duration:.01});advance(b,.2);assert.equal(outputs(hits,u).length,1);
});
test('a sole heavy S2 target takes the selected damage without Levitate',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b,{weight:4});cast(b,u);advance(b,.4);
  assert.equal(outputs(hits,u).length,1);assert.equal(e.s.flags.levitate||false,false);
});
test('S2 preserves a stored charge and partial recovery when casting below its full cap',()=>{
  const{b,u}=make({skill:1});enemy(b);cast(b,u,u.skill.spCost+3);near(u.skill.spTotal,3);
  advance(b,1);near(u.skill.spTotal,3);u.skill.gainSp(1,'talent');near(u.skill.spTotal,4);
});
test('S3 explosion includes nearby out-of-range victims and excludes those beyond radius1.1',()=>{
  const{b,u,hits}=make({skill:2}),main=enemy(b,{x:7,y:5,fly:true}),edge=enemy(b,{x:7.8,y:5,fly:true}),outside=enemy(b,{x:8.3,y:5,fly:true});
  cast(b,u);advance(b,.35);assert.equal(outputs(hits,u).length,2);
  assert.ok(outputs(hits,u).some(h=>h.target===main));assert.ok(outputs(hits,u).some(h=>h.target===edge));near(outside.hp,outside.s.maxHp);
});
