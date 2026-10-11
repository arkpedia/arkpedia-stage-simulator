// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-degenbrecher-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
import { immuneSet } from '../server/sim/simdata.js';
const ID='char_4116_blkkgt';
const near=(a,z,tol=1e-5)=>assert.ok(Math.abs(a-z)<tol,`${a} != ${z}`);
function advance(b,s){const end=b.time+s;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
  const d=structuredClone(data),o=d.operators[ID];d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const build={...defaultBuild(o),elite,potential,level:o.phases[elite].maxLevel,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(d,{operators:[build]},{seed:1});b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.addDp('arkpedia',99);
  const hits=[];b.on('damaged',c=>hits.push({...c,time:b.time}));const u=b.deployOperator(ID,5,5,dir);
  u.atkCd=1000;u.profile.canAttack=()=>false;advance(b,1.1);b.rng=()=>.99;return{b,u,hits};
}
function enemy(b,{x=6,y=5,fly=false,hp=100000,def=0,weight=10,blocked=false}={}){
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:hp,def,moveSpeed:0,massLevel:weight});e.markDirty();void e.s;e.hp=hp;
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();
  if(blocked){const u=b.allyUnits.find(a=>a.def.charId===ID);e.x=5.6;e.y=5;b._buildEnemyIndex();assert.equal(b._checkBlock(e),true);}return e;
}
function cast(b,u,total=u.skill.spCost){u.skill.setSpTotal(total);assert.equal(u.skill.activate('manual'),true);}
function shot(b,u){const p=effectiveProfile(u),ts=acquireTargets(b,u,p);assert.ok(ts.length);performAttack(b,u,p,ts);u.atkCd=1000;}
const out=(hits,u)=>hits.filter(h=>h.source===u);
const bbFor=(n,rank)=>Object.fromEntries(Object.values(source.tables.skills)[n-1].levels[rank-1].blackboard.map(v=>[v.key,v.value]));
test('Degenbrecher preserves30 ranks, ten native templates and both original facings',()=>{
  assert.equal(Object.values(source.tables.skills).flatMap(s=>s.levels).length,30);assert.equal(source.source.bundles.length,5);
  assert.equal(Object.keys(source.templates).length,10);
  for(const face of ['Front','Back'])assert.equal(source.models[ID][face].sha256,source.officialSkeletonBindings[ID][face].sha256);
  assert.equal(source.frameParity,false);assert.equal(source.nativeParticleSupport,false);
});
for(let rank=1;rank<=10;rank++)test(`S1 rank${rank}: charged surrounding range, two capped AoE hits and SP lock`,()=>{
  const{b,u,hits}=make({rank}),bb=bbFor(1,rank),es=Array.from({length:8},(_,i)=>enemy(b,{x:5+.03*i,y:6}));
  assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,0);
  u.skill.setSpTotal(u.skill.spCost);assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);
  cast(b,u);shot(b,u);advance(b,.7);const hs=out(hits,u);assert.equal(hs.length,bb.max_target*2);
  for(const h of hs)near(h.amount,u.s.atk*bb.atk_scale_s1);assert.equal(new Set(hs.map(h=>h.target)).size,bb.max_target);
  assert.equal(es.filter(e=>e.hp<e.s.maxHp).length,bb.max_target);near(u.skill.spTotal,0);
  u.skill.gainSp(2,'talent');near(u.skill.spTotal,0);advance(b,.7);assert.equal(u.mem.degenCast,null);
  u.skill.gainSp(1,'talent');near(u.skill.spTotal,1);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank${rank}: block check gives3/2 hits, source cap and two charges`,()=>{
  const{b,u,hits}=make({skill:1,rank}),bb=bbFor(2,rank),es=Array.from({length:8},(_,i)=>enemy(b,{x:6+.01*i,blocked:i===0}));
  cast(b,u,u.skill.spCost*2);assert.equal(u.skill.maxCharges,2);assert.equal(u.skill.charges,1);
  advance(b,.25);assert.equal(out(hits,u).length,0);advance(b,.2);
  const hs=out(hits,u);assert.equal(hs.length,bb.max_target*2+1);assert.equal(hs.filter(h=>h.target===es[0]).length,3);
  for(const h of hs){near(h.amount,u.s.atk*bb.dot_scale*1.6);assert.equal(h.target.s.flags.tremble,true);}
  near(u.skill.spTotal,u.skill.spCost);advance(b,1.8);assert.equal(u.skill.active,false);near(u.skill.spTotal,u.skill.spCost);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank${rank}: ten fixed slashes and finisher, ground/air cap and immunity window`,()=>{
  const{b,u,hits}=make({skill:2,rank}),bb=bbFor(3,rank);enemy(b);const fly=enemy(b,{x:6.1,fly:true});
  cast(b,u);advance(b,.2);assert.equal(out(hits,u).length,0);assert.equal(u.s.flags.invulnerable||false,false);
  advance(b,.2);assert.equal(out(hits,u).length,2);assert.equal(u.s.flags.invulnerable,true);
  assert.equal(b.applyStatus(u,'stun',{duration:1}),false);assert.equal(b.applyStatus(u,'freeze',{duration:1}),false);
  advance(b,2.7);assert.equal(out(hits,u).length,20);assert.equal(out(hits,u).filter(h=>h.target===fly).length,10);
  for(const h of out(hits,u))near(h.amount,u.s.atk*bb.d_atk_scale*1.6);
  advance(b,.6);assert.equal(out(hits,u).length,22);for(const h of out(hits,u).slice(-2))near(h.amount,u.s.atk*bb.e_atk_scale_end*1.6);
  assert.equal(u.s.flags.invulnerable||false,false);assert.equal(u.skill.active,true);advance(b,1.3);assert.equal(u.skill.active,false);
  assert.equal(u.mem.degenCast,null);
});
test('basic Swordmaster retains one victim while blocking two, and grants only one offensive SP',()=>{
  const{b,u,hits}=make(),e=enemy(b,{blocked:true}),spare=enemy(b,{x:6.1,blocked:true});shot(b,u);advance(b,.45);
  assert.equal(out(hits,u).length,1);near(u.skill.spTotal,1);advance(b,.25);assert.equal(out(hits,u).length,2);
  assert.ok(out(hits,u).every(h=>h.target===e));near(spare.hp,spare.s.maxHp);near(u.skill.spTotal,1);
});
test('basic second hit never acquires a new enemy after killing the first',()=>{
  const{b,u,hits}=make(),e=enemy(b,{hp:1}),spare=enemy(b,{x:6.1});shot(b,u);advance(b,.8);
  assert.equal(e.alive,false);assert.equal(out(hits,u).length,1);near(spare.hp,spare.s.maxHp);
});
test('S1 naturally triggers against an enemy outside normal facing once charged',()=>{
  const{b,u,hits}=make();enemy(b,{x:5,y:6});u.profile.canAttack=()=>!u.mem.degenCast;u.atkCd=0;
  advance(b,.2);assert.equal(out(hits,u).length,0);u.skill.setSpTotal(u.skill.spCost);advance(b,.8);assert.equal(out(hits,u).length,2);
});
test('S1 charged map range persists through the animation tail and returns to normal',()=>{
  const{b,u}=make(),base=structuredClone(u.liveRangeGrid);enemy(b,{x:5,y:6});
  u.skill.setSpTotal(u.skill.spCost);advance(b,.05);
  assert.deepEqual(u.liveRangeGrid,u.def.skill.rangeGrid);assert.ok(u.rangeKeys.length>base.length);
  cast(b,u);shot(b,u);advance(b,.7);assert.equal(u.skill.charges,0);
  assert.deepEqual(u.liveRangeGrid,u.def.skill.rangeGrid);advance(b,.7);
  assert.deepEqual(u.liveRangeGrid,base);
});
test('S1 reselects at release when the input dies during windup',()=>{
  const{b,u,hits}=make(),e=enemy(b),spare=enemy(b,{x:6.1});cast(b,u);shot(b,u);b.kill(e);advance(b,.7);
  assert.equal(out(hits,u).length,2);assert.ok(out(hits,u).every(h=>h.target===spare));
});
for(const dir of ['UP','RIGHT','DOWN','LEFT'])test(`${dir} uses the original two native basic timings`,()=>{
  const{b,u,hits}=make({dir}),pos={UP:[5,6],RIGHT:[6,5],DOWN:[5,4],LEFT:[4,5]},[x,y]=pos[dir];enemy(b,{x,y});shot(b,u);
  advance(b,.35);assert.equal(out(hits,u).length,0);advance(b,.1);assert.equal(out(hits,u).length,1);advance(b,.25);assert.equal(out(hits,u).length,2);
});
test('Born Warrior scales before mitigation and T2 sees the same first critical hit',()=>{
  const{b,u,hits}=make(),e=enemy(b,{def:500});b.rng=()=>0;shot(b,u);advance(b,.45);
  near(out(hits,u)[0].amount,u.s.atk*1.6-500*.75);assert.equal(e.s.flags.tremble,true);
});
test('potential3/5 upgrades scale and penetration, E0 has neither talent',()=>{
  const high=make({potential:5});enemy(high.b,{def:500});high.b.rng=()=>0;shot(high.b,high.u);advance(high.b,.45);
  near(out(high.hits,high.u)[0].amount,high.u.s.atk*1.65-500*.7);
  const low=make({elite:0});const e=enemy(low.b);low.b.rng=()=>0;shot(low.b,low.u);advance(low.b,.45);
  near(out(low.hits,low.u)[0].amount,low.u.s.atk);assert.equal(e.s.flags.tremble||false,false);
});
test('Tremble respects its own immunity, independently from fear; critical scale remains',()=>{
  const{b,u,hits}=make();const immune=enemy(b);immune.def={...immune.def,immune:immuneSet({disarmedCombatImmune:true})};
  b.rng=()=>0;shot(b,u);advance(b,.7);assert.equal(immune.s.flags.tremble||false,false);near(out(hits,u)[0].amount,u.s.atk*1.6);
  const fearImmune=enemy(b,{x:6.1});fearImmune.def={...fearImmune.def,immune:immuneSet({fearedImmune:true})};
  assert.equal(b.applyStatus(fearImmune,'tremble',{duration:5,source:u}),true);assert.equal(b.applyStatus(fearImmune,'fear',{duration:5,source:u}),false);
});
test('Tremble suppresses only blocked normal attacks and expires without removing a block',()=>{
  const{b,u}=make();const e=enemy(b,{blocked:true});b.removeBuff(e,'test:pin');e.atkCd=0;b.applyStatus(e,'tremble',{duration:.5,source:u});
  const before=e.stats.attacks;advance(b,.3);assert.equal(e.stats.attacks,before);assert.equal(e.blockedBy,u);
  advance(b,.6);e.atkCd=0;advance(b,.1);assert.ok(e.stats.attacks>before);
});
test('S3 pulls at forces1/2 with weight rules and a0.6708-tile dead zone',()=>{
  const{b,u}=make({skill:2}),light=enemy(b,{x:6.4,weight:1}),heavy=enemy(b,{x:6.4,y:5.1,weight:5}),nearby=enemy(b,{x:5.4,weight:1});
  cast(b,u);advance(b,.4);assert.ok(light.x<6.4);near(heavy.x,6.4);near(nearby.x,5.4);
  assert.ok(Math.hypot(light.x-u.x,light.y-u.y)>=Math.sqrt(.45)-1e-5);
});
test('S3 time SP ignores ASPD, cannot start without targets and preserves SP',()=>{
  const{b,u}=make({skill:2});u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('manual'),false);
  near(u.skill.spTotal,u.skill.spCost);enemy(b);b.addBuff(u,{key:'test:aspd',mods:{aspd:100}});cast(b,u);
  advance(b,.2);assert.equal(u.s.flags.invulnerable||false,false);advance(b,.2);assert.equal(u.s.flags.invulnerable,true);
});
for(const skill of [0,1,2])test(`S${skill+1} interruption before release clears its sequence`,()=>{
  const{b,u,hits}=make({skill});enemy(b);cast(b,u);if(skill===0)shot(b,u);b.applyStatus(u,'stun',{duration:.01});
  advance(b,5);assert.equal(out(hits,u).length,0);assert.equal(u.mem.degenCast,null);assert.equal(u.s.flags.invulnerable||false,false);
});
test('S3 loses protection in finisher and control then cancels the finisher',()=>{
  const{b,u,hits}=make({skill:2});enemy(b);cast(b,u);advance(b,3.35);assert.equal(out(hits,u).length,10);
  assert.equal(b.applyStatus(u,'stun',{duration:.1}),true);advance(b,2);assert.equal(out(hits,u).length,10);assert.equal(u.mem.degenCast,null);
});
test('retreat cancels S3 and removes invulnerability',()=>{
  const{b,u,hits}=make({skill:2});enemy(b);cast(b,u);advance(b,.4);const n=out(hits,u).length;b.retreatOperator(ID);
  advance(b,5);assert.equal(out(hits,u).length,n);assert.equal(u.mem.degenCast,null);assert.equal(u.findBuff('degen:invincible'),null);
});
test('S2 retains partial charge progress through a cast',()=>{
  const{b,u}=make({skill:1});enemy(b);cast(b,u,u.skill.spCost+3);near(u.skill.spTotal,3);
  u.skill.gainSp(3,'talent');near(u.skill.spTotal,3);advance(b,2.3);near(u.skill.spTotal,3);u.skill.gainSp(1,'talent');near(u.skill.spTotal,4);
});
test('unblocked ranged enemy can attack while Trembling',()=>{
  const{b,u}=make();const e=enemy(b,{x:7});e.def={...e.def,applyWay:'RANGED',dmgType:'phys'};e.base.rangeRadius=4;
  b.removeBuff(e,'test:pin');b.addBuff(e,{key:'test:stay',flags:{noMove:true}});b.applyStatus(e,'tremble',{duration:5,source:u});e.atkCd=0;
  advance(b,.2);assert.ok(e.stats.attacks>0);assert.equal(e.blockedBy,null);
});
test('Tremble respects resistance and refreshes without shortening its lifetime',()=>{
  const{b,u}=make(),e=enemy(b);b.applyStatus(e,'resist',{duration:10,value:.5});
  b.applyStatus(e,'tremble',{duration:5,source:u});near(e.findBuff('tremble').timeLeft,2.5);
  b.applyStatus(e,'tremble',{duration:1,source:u});near(e.findBuff('tremble').timeLeft,2.5);
});
test('S3 reselection fills the cap with a new entrant after a victim dies',()=>{
  const{b,u,hits}=make({skill:2});const first=enemy(b,{hp:1});cast(b,u);advance(b,.4);assert.equal(first.alive,false);
  const replacement=enemy(b,{x:6.1});advance(b,.7);assert.ok(out(hits,u).some(h=>h.target===replacement));
});
test('S3 selected cap applies to every slash and finisher',()=>{
  const{b,u,hits}=make({skill:2});Array.from({length:8},(_,i)=>enemy(b,{x:6+.01*i}));cast(b,u);advance(b,4);
  assert.equal(out(hits,u).length,6*11);assert.equal(new Set(out(hits,u).map(h=>h.target)).size,6);
});
test('critical rolls independently per damage instance, and penetration persists through dodge',()=>{
  const{b,u,hits}=make(),e=enemy(b,{def:500});b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});b.rng=()=>0;
  shot(b,u);advance(b,.45);assert.equal(out(hits,u).length,0);assert.equal(u.mem.degenPenetration,true);
  b.removeBuff(e,'test:dodge');b.removeBuff(e,'tremble');b.rng=()=>.99;advance(b,.25);
  assert.equal(out(hits,u).length,1);near(out(hits,u)[0].amount,u.s.atk-500*.75);assert.equal(u.mem.degenPenetration,false);
});
test('S2 issued derived hits retain their recipient after concealment and caster interruption',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b,{blocked:true});let interrupted=false;
  b.on('damaged',c=>{if(c.source===u&&!interrupted){interrupted=true;b.applyStatus(u,'stun',{duration:1});b.addBuff(e,{key:'test:conceal',flags:{stealth:true,untargetable:true}});}});
  cast(b,u);advance(b,.5);assert.equal(out(hits,u).length,3);assert.equal(u.mem.degenCast,null);
});
test('S1/S2 playback follows ASPD, S2 uses native Down alias, S3 remains fixed speed',()=>{
  for(const skill of [0,1,2]){
    const{b,u}=make({skill,dir:'DOWN'});enemy(b,{x:5,y:4});b.addBuff(u,{key:'test:haste',mods:{aspd:100}});cast(b,u);if(skill===0)shot(b,u);
    assert.equal(u.mem.regularFormVisual.speed,skill===2?1:2);
    if(skill===1)assert.equal(u.mem.regularFormVisual.clip,'Skill_Down_2');
  }
});
