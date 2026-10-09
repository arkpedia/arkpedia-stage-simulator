// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-brigid-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID = 'char_4177_brigid';
const near = (a,z,tol=1e-5) => assert.ok(Math.abs(a-z)<tol, `${a} != ${z}`);
function advance(b,t) { const end=b.time+t; while(b.time<end-1e-9)b.step(); assert.deepEqual(b.errors,[]); }
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}) {
  const d=structuredClone(data),o=d.operators[ID];
  d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  const build={...defaultBuild(o),elite,potential,level:o.phases[elite].maxLevel,
    skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(d,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'HIGH',build:'ALL',pass:'ALL'}));
  b.addDp('arkpedia',99);const hits=[];b.on('damaged',c=>hits.push({...c,time:b.time}));
  const u=b.deployOperator(ID,3,4,dir);assert.ok(u);u.atkCd=1000;return{b,u,hits};
}
function enemy(b,{x=6,y=3,fly=false,hp=100000}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});
  Object.assign(e.base,{maxHp:hp,atk:100,def:0,res:0,moveSpeed:1});e.markDirty();void e.s;e.hp=hp;
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{disarm:true,noMove:true}});b._buildEnemyIndex();return e;
}
const own=(hits,u)=>hits.filter(h=>h.source===u);
const bbFor=(n,r)=>Object.fromEntries(source.tables.skills[`skchr_brigid_${n}`].levels[r-1].blackboard.map(x=>[x.key,x.value]));
function cast(u) {u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);}
function shot(b,u) {const p=effectiveProfile(u),targets=acquireTargets(b,u,p);assert.ok(targets.length);performAttack(b,u,p,targets);u.atkCd=1000;}
for(let rank=1;rank<=10;rank++) test(`S1 rank${rank}: source scale, additional bounce budget, repeat fallback and return gate`,()=>{
  const{b,u,hits}=make({rank}),a=enemy(b),z=enemy(b,{x:7,fly:true}),bb=bbFor(1,rank);
  cast(u);shot(b,u);advance(b,.38);assert.equal(own(hits,u).length,0);advance(b,.22);
  assert.equal(own(hits,u).length,1);assert.equal(u.profile.canAttack(b,u),false);
  advance(b,1.5);const h=own(hits,u);assert.equal(h.length,bb.times+1);
  assert.deepEqual(h.map(x=>x.target),Array.from({length:bb.times+1},(_,i)=>i%2?z:a));
  for(const x of h)near(x.amount,u.s.atk*bb.atk_scale);
  advance(b,2);assert.equal(u.mem.brigidFlight,null);assert.equal(u.profile.canAttack(b,u),true);
  near(u.skill.spTotal,0);shot(b,u);advance(b,.6);near(u.skill.spTotal,1);
});
for(let rank=1;rank<=10;rank++) test(`S2 rank${rank}: primary hit plus four quarter-second cuts, slow and held return`,()=>{
  const{b,u,hits}=make({skill:1,rank}),e=enemy(b,{fly:true}),bb=bbFor(2,rank);cast(u);near(u.s.atk,u.base.atk*(1+bb.atk));
  shot(b,u);advance(b,.48);assert.equal(own(hits,u).length,1);near(e.s.moveSpeed,e.base.moveSpeed*.2);
  advance(b,.15);assert.equal(own(hits,u).length,1);assert.equal(u.profile.canAttack(b,u),false);
  advance(b,.85);const h=own(hits,u);assert.equal(h.length,5);
  for(let i=0;i<h.length;i++){assert.equal(h[i].target,e);near(h[i].amount,u.s.atk);if(i)near(h[i].time-h[0].time,i*.25,.04);}
  advance(b,1);assert.equal(u.mem.brigidFlight,null);assert.equal(skillHud(u.skill).state,'active');near(u.skill.spTotal,0);
  advance(b,26);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);
});
for(const dir of ['UP','RIGHT','DOWN','LEFT']) test(`${dir}: literal attack and skill families with capped playback`,()=>{
  const{b,u,hits}=make({skill:1,dir});const pos={UP:[3,5],RIGHT:[6,3],DOWN:[4,1],LEFT:[2,3]}[dir];enemy(b,{x:pos[0],y:pos[1]});
  b.addBuff(u,{key:'test:haste',mods:{aspd:300}});cast(u);shot(b,u);advance(b,.31);assert.equal(own(hits,u).length,0);
  assert.equal(effectiveProfile(u).attackVisual(b,u),dir==='DOWN'?'Skill_Down_2_Loop':'Skill_2_Loop');
  advance(b,.25);assert.equal(own(hits,u).length,1);
});
for(const [elite,potential,prob] of [[0,1,0],[1,1,.15],[1,5,.18],[2,1,.35],[2,5,.38]]) test(`E${elite} P${potential}: exactly twentieth output enables selected physical dodge only`,()=>{
  const{b,u}=make({elite,potential}),e=enemy(b);
  for(let i=0;i<19;i++)b.dealDamage(u,e,{amount:1,type:'true'});near(u.s.dodgePhys,0);
  b.dealDamage(u,e,{amount:1,type:'arts'});near(u.s.dodgePhys,prob);near(u.s.dodgeArts,0);
  for(let i=0;i<4;i++)b.dealDamage(u,e,{amount:1,type:'phys'});near(u.s.dodgePhys,prob);
});
test('Talent output counter includes dodge and zero HP damage but excludes sourceless output',()=>{
  const{b,u}=make(),e=enemy(b);b.addBuff(e,{key:'test:evade',mods:{dodgePhys:1}});
  for(let i=0;i<19;i++)b.dealDamage(u,e,{amount:100,type:'phys'});
  near(e.hp,e.s.maxHp);near(u.s.dodgePhys,0);b.dealDamage(u,e,{amount:100,type:'true',sourceless:true});near(u.s.dodgePhys,0);
  b.addBuff(e,{key:'test:shield',shield:1000});b.dealDamage(u,e,{amount:100,type:'arts'});near(u.s.dodgePhys,.35);
});
test('Talent output is counted before invulnerability, not only after successful HP damage',()=>{
  const{b,u}=make(),e=enemy(b);b.addBuff(e,{key:'test:invulnerable',flags:{invulnerable:true}});
  for(let i=0;i<20;i++)b.dealDamage(u,e,{amount:100,type:'phys'});
  near(e.hp,e.s.maxHp);near(u.s.dodgePhys,.35);
});
test('Refused Sluggish leaves the primary hit and all four cuts intact',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b);let refused=0;
  b.on('beforeStatus',c=>{if(c.target===e&&c.status==='sluggish'){c.cancel=true;refused++;}});
  cast(u);shot(b,u);advance(b,.5);assert.equal(refused,1);assert.equal(own(hits,u).length,1);
  near(e.s.moveSpeed,e.base.moveSpeed);assert.equal(e.findBuff('sluggish'),null);
  advance(b,1.1);assert.equal(own(hits,u).length,5);near(e.s.moveSpeed,e.base.moveSpeed);
});
test('Ordinary speed15 outward/.01 dwell/3.75 return has one victim and no splash',()=>{
  const{b,u,hits}=make(),e=enemy(b),z=enemy(b,{x:6,y:4});const speeds=[],add=b.addProjectile.bind(b);
  b.addProjectile=p=>{speeds.push(p.speed);return add(p);};shot(b,u);advance(b,.6);assert.deepEqual(own(hits,u).map(h=>h.target),[e]);
  assert.equal(u.profile.canAttack(b,u),false);advance(b,.8);assert.deepEqual(speeds,[15,3.75]);assert.equal(u.mem.brigidFlight,null);near(z.hp,z.s.maxHp);
});
test('S1 single victim is not hit again; radius rejects distant secondary and accepts flying secondary',()=>{
  const{b,u,hits}=make(),e=enemy(b),far=enemy(b,{x:8});cast(u);shot(b,u);advance(b,2);assert.deepEqual(own(hits,u).map(h=>h.target),[e]);near(far.hp,far.s.maxHp);
});
test('Unreleased shot is canceled by brief control and no projectile gate is stranded',()=>{
  const{b,u,hits}=make();enemy(b);shot(b,u);b.applyStatus(u,'stun',{duration:.05});advance(b,1);assert.equal(own(hits,u).length,0);assert.equal(u.mem.brigidFlight,null);
});
test('Killed trace target lands at its last position and returns without redirecting ordinary damage',()=>{
  const{b,u,hits}=make(),e=enemy(b),z=enemy(b,{x:7});shot(b,u);advance(b,.42);assert.ok(u.mem.brigidFlight);b.kill(e);advance(b,1.5);assert.equal(own(hits,u).length,0);near(z.hp,z.s.maxHp);assert.equal(u.mem.brigidFlight,null);
});
test('S2 losing a latched target stops all later cuts and returns early',()=>{
  for(const reason of ['dead','stealth','untargetable']){const{b,u,hits}=make({skill:1}),e=enemy(b);cast(u);shot(b,u);advance(b,.5);assert.equal(own(hits,u).length,1);
    if(reason==='dead')b.kill(e);else b.addBuff(e,{key:'test:invalid',flags:{[reason]:true}});
    advance(b,1.5);assert.equal(own(hits,u).length,1);assert.equal(u.mem.brigidFlight,null);}
});
test('S2 cuts use current ATK after skill expiry and keep the original target outside attack range',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b);cast(u);shot(b,u);advance(b,.5);e.x=10;b._buildEnemyIndex();u.skill.end('test');
  advance(b,1.1);const h=own(hits,u);assert.equal(h.length,5);near(h[0].amount,u.base.atk*1.5);for(const x of h.slice(1))near(x.amount,u.base.atk);
});
test('An emitted S2 survives withdrawal; its return cannot release a redeployment projectile',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b);cast(u);shot(b,u);advance(b,.5);const old=u.id;b.retreatOperator(ID);
  b.bench[ID].readyAt=b.time;b.addDp('arkpedia',99);const fresh=b.deployOperator(ID,3,4,'RIGHT');assert.ok(fresh);assert.notEqual(fresh.id,old);fresh.atkCd=1000;advance(b,1);shot(b,fresh);
  advance(b,.6);assert.ok(fresh.mem.brigidFlight);assert.equal(own(hits,u).filter(h=>h.target===e).length,5);
  advance(b,1);assert.equal(fresh.mem.brigidFlight,null);near(fresh.s.dodgePhys,0);
});
test('S1 dead-at-release refund restores one charge and does not spawn a replacement projectile',()=>{
  const{b,u,hits}=make(),e=enemy(b);cast(u);shot(b,u);b.kill(e);advance(b,.5);assert.equal(own(hits,u).length,0);near(u.skill.spTotal,u.skill.spCost);assert.equal(u.mem.brigidFlight,null);
});
test('Talent and held flight reset on redeployment; source records retain both skills/all ranks/facings',()=>{
  const{b,u}=make(),e=enemy(b);for(let i=0;i<20;i++)b.dealDamage(u,e,{amount:1,type:'phys'});near(u.s.dodgePhys,.35);b.retreatOperator(ID);b.bench[ID].readyAt=b.time;b.addDp('arkpedia',99);const fresh=b.deployOperator(ID,3,4,'RIGHT');assert.ok(fresh);near(fresh.s.dodgePhys,0);assert.equal(fresh.mem.brigidCount,0);
  assert.deepEqual(source.enabledOperators,[ID]);assert.equal(Object.values(source.tables.skills).flatMap(s=>s.levels).length,20);
  for(const face of ['Front','Back'])assert.equal(source.models[ID][face].sha256,source.officialSkeletonBindings[ID][face].sha256);
  assert.equal(source.frameParity,false);assert.equal(source.moduleSupport,false);
});
