// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-goldenglow-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID = 'char_377_gdglow';
const near = (a,z,eps=1e-5) => assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s) { const end=b.time+s; while(b.time<end-1e-9)b.step(); assert.deepEqual(b.errors,[]); }
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}) {
  const src=structuredClone(data); src.stage.geometry.waves[0].spawns=[];
  const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
    potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(src,{operators:[build]}); b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'HIGH',build:'ALL',pass:'ALL'}));
  b.getPlayer('arkpedia').dp=99;b.rng=()=>.999;
  const u=b.deployOperator(ID,3,4,dir);assert.ok(u);u.profile.noAttack=true;u.atkCd=1000;
  const hits=[];b.on('damaged',ctx=>hits.push({...ctx,time:b.time}));return {b,u,hits};
}
function enemy(b,{r=3,c=5,fly=false,hp=1000000,res=50}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:hp,res,def:0,atk:100});
  e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
  b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u) {u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);advance(b,.4);}
function fire(b,u,e) {performAttack(b,u,effectiveProfile(u),[e]);}
const tagged=(hs,t)=>hs.filter(h=>h.dmg.tags.includes(t));
test('exact source ranks, templates, sluggish DB and delivered facing bytes remain auditable',()=>{
  assert.equal(evidence.frameParity,false);assert.equal(evidence.moduleSupport,false);
  assert.equal(evidence.source.bundles.length,5);assert.equal(Object.keys(evidence.templates).length,3);
  assert.ok(evidence.buffDatabase.sluggish);
  for(const s of data.operators[ID].skills)
    assert.deepEqual(s.levels.map(({rangeGrid,...l})=>l),evidence.tables.skills[s.id].levels);
  for(const face of ['Front','Back']) {
    const path=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton.path;
    const raw=readFileSync(new URL('../../arkpedia-sd-assets/'+path,import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
  }
  assert.equal(evidence.models[ID].Back.durations.Skill3_Loop,undefined);
});
for(let rank=1;rank<=10;rank++)test(`S1 rank${rank}: two independent locked drones, source buffs and timed cleanup`,()=>{
  const {b,u,hits}=make({rank}),e=enemy(b);cast(b,u);
  near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));near(u.s.aspd,100+u.skill.bb.attack_speed);
  fire(b,u,e);advance(b,1.2);assert.equal(u.mem.gdglowSlots.filter(s=>s.lock).length,2);
  assert.equal(tagged(hits,'gdglow:caster').length,1);
  const ds=tagged(hits,'gdglow:released-drone');assert.equal(ds.length,2);
  for(const h of ds)near(h.amount,u.s.atk*.2*.65);
  advance(b,u.skill.timeLeft+.1);assert.equal(u.skill.active,false);
  assert.ok(u.mem.gdglowSlots.every(s=>s.lock===null));near(u.s.atk,u.base.atk);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank${rank}: target-free automatic infinite skill and expanded source range`,()=>{
  const {b,u}=make({skill:1,rank});advance(b,u.skill.spCost+.4);
  assert.equal(u.skill.active,true);near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));
  assert.deepEqual(u.skill.spec.targeting.rangeGrid,u.skill.def.rangeGrid);
  assert.equal(skillHud(u.skill).text,'Skill active');advance(b,10);assert.equal(u.skill.active,true);
  const e=enemy(b);fire(b,u,e);advance(b,1.2);assert.equal(u.mem.gdglowSlots.filter(s=>s.lock).length,2);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank${rank}: global three drones, no caster damage, slow and expiry`,()=>{
  const {b,u,hits}=make({skill:2,rank}),e=enemy(b,{r:0,c:0,fly:true});cast(b,u);
  near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));assert.equal(effectiveProfile(u).noAttack,true);
  advance(b,.8);assert.equal(u.mem.gdglowSlots.filter(s=>s.lock===e).length,3);
  assert.equal(tagged(hits,'gdglow:caster').length,0);assert.equal(tagged(hits,'gdglow:released-drone').length,3);
  near(e.s.moveSpeed,e.base.moveSpeed*.2);
  advance(b,u.skill.timeLeft+.1);assert.equal(u.skill.active,false);
  assert.ok(u.mem.gdglowSlots.every(s=>s.lock===null));near(u.s.atk,u.base.atk);
});
test('normal attack has one caster bolt and one ramping drone; switching targets resets only the ramp',()=>{
  const {b,u,hits}=make(),e=enemy(b),other=enemy(b,{c:6});
  for(let i=0;i<8;i++){fire(b,u,e);advance(b,.7);}
  assert.equal(tagged(hits,'gdglow:caster').length,8);
  const ds=tagged(hits,'gdglow:normal-drone');assert.equal(ds.length,8);
  for(let i=0;i<8;i++)near(ds[i].amount,u.base.atk*Math.min(1.1,.2+.15*i)*.65);
  const slot=u.mem.gdglowSlots[0];slot.stack=13;fire(b,u,other);advance(b,.8);
  near(tagged(hits,'gdglow:normal-drone').at(-1).amount,u.base.atk*.2*.65);assert.equal(slot.stack,13);
  assert.equal(tagged(hits,'gdglow:explosion').length,0);
});
test('locked drones follow an enemy outside the owner range and retain separate ramp/counters',()=>{
  const {b,u,hits}=make(),e=enemy(b);cast(b,u);fire(b,u,e);advance(b,1.1);
  assert.equal(u.mem.gdglowSlots[0].stack,2);assert.equal(u.mem.gdglowSlots[1].stack,2);
  e.x=0;e.y=0;b._buildEnemyIndex();advance(b,u.s.interval+.1);
  const ds=tagged(hits,'gdglow:released-drone');assert.equal(ds.length,4);
  for(const h of ds.slice(-2))near(h.amount,u.s.atk*.35*.65);
});
test('per-drone rising explosion probability resets only the exploding drone, not four AoE hits',()=>{
  const {b,u,hits}=make(),e=enemy(b),air=enemy(b,{c:5.9,fly:true}),far=enemy(b,{c:6.2});
  cast(b,u);fire(b,u,e);advance(b,.5);
  u.mem.gdglowSlots[0].stack=10;u.mem.gdglowSlots[1].stack=1;
  const rolls=[];b.rng=()=>{rolls.push(true);return .1;};advance(b,.75);
  const out=tagged(hits,'gdglow:explosion');assert.equal(out.length,2);
  for(const h of out)near(h.amount,u.s.atk*3*.65);
  assert.ok(out.some(h=>h.target===air));assert.equal(far.hp,far.s.maxHp);
  assert.equal(u.mem.gdglowSlots[0].stack,1);assert.equal(u.mem.gdglowSlots[0].targetId,null);
  assert.equal(u.mem.gdglowSlots[1].stack,2);assert.equal(tagged(hits,'gdglow:released-drone').length,1);
  assert.ok(rolls.length>=2);
});
test('fortieth layer guarantees explosion; successful explosion does not increment the trait ramp',()=>{
  const {b,u,hits}=make({skill:2}),e=enemy(b);cast(b,u);
  for(const s of u.mem.gdglowSlots)s.stack=40;
  advance(b,.9);assert.equal(tagged(hits,'gdglow:explosion').length,3);
  assert.equal(tagged(hits,'gdglow:released-drone').length,0);
  assert.ok(u.mem.gdglowSlots.every(s=>s.stack===1&&s.targetId===null));
  near(e.s.moveSpeed,e.base.moveSpeed*.2);
});
test('explosion resolves once after fixed .32s at the proc location, not the moving target',()=>{
  const {b,u,hits}=make({skill:2}),e=enemy(b);cast(b,u);
  for(const s of u.mem.gdglowSlots)s.stack=40;
  while(u.mem.gdglowSlots[0].stack===40 && b.time<2)b.step();const t=b.time;
  assert.deepEqual(b.errors,[]);advance(b,.2);
  assert.equal(tagged(hits,'gdglow:explosion').length,0);
  e.x=0;e.y=0;const bystander=enemy(b,{c:5,r:3});b._buildEnemyIndex();advance(b,.2);
  const out=tagged(hits,'gdglow:explosion');assert.equal(out.length,3);
  assert.ok(out.every(h=>h.target===bystander));assert.ok(out.every(h=>h.time-t>.2));
});
test('locked released projectiles continue during disarm/stun, but stun prevents new S3 selection',()=>{
  const {b,u,hits}=make({skill:2}),e=enemy(b);cast(b,u);
  b.addBuff(u,{key:'test:disabled',flags:{disarm:true,stun:true}});advance(b,1);
  assert.equal(tagged(hits,'gdglow:released-drone').length,3);
  b.kill(e);advance(b,.1);const other=enemy(b,{r:0,c:0});advance(b,2);
  assert.ok(u.mem.gdglowSlots.every(s=>s.lock===null));near(other.hp,other.s.maxHp);
  b.removeBuff(u,'test:disabled');advance(b,1.5);assert.ok(u.mem.gdglowSlots.every(s=>s.lock===other));
});
test('temporary untargetability pauses a locked drone without backlog or switching to another enemy',()=>{
  const {b,u,hits}=make({skill:2}),e=enemy(b);cast(b,u);advance(b,.8);
  const count=hits.length;b.addBuff(e,{key:'test:hidden',flags:{untargetable:true}});enemy(b,{r:0,c:0});advance(b,3);
  assert.equal(hits.length,count);assert.ok(u.mem.gdglowSlots.every(s=>s.lock===e));
  b.removeBuff(e,'test:hidden');advance(b,.04);assert.equal(hits.length,count+3);
});
test('S3 rejects invisible, sleeping and untargetable enemies globally and reacquires after death',()=>{
  const {b,u}=make({skill:2}),e=enemy(b,{r:0,c:0}),hidden=enemy(b,{r:0,c:1});
  hidden.hidden=true;const asleep=enemy(b,{r:0,c:2});b.applyStatus(asleep,'sleep',{duration:30});
  const free=enemy(b,{r:0,c:3});b.addBuff(free,{key:'test:free',flags:{untargetable:true}});
  cast(b,u);advance(b,.8);assert.ok(u.mem.gdglowSlots.every(s=>s.lock===e));b.kill(e);
  const second=enemy(b,{r:0,c:4});advance(b,2);assert.ok(u.mem.gdglowSlots.every(s=>s.lock===second));
});
test('caster and drone RES ignore respect E0/E1/E2 and potential six',()=>{
  for(const [elite,potential,res] of [[0,1,0],[1,1,0],[2,1,15],[2,6,18]]){
    const {b,u,hits}=make({elite,potential}),e=enemy(b);fire(b,u,e);advance(b,.7);
    near(u.s.resIgnoreFlat,res);
    near(tagged(hits,'gdglow:caster')[0].amount,u.s.atk*(.5+res/100));
    near(tagged(hits,'gdglow:normal-drone')[0].amount,u.s.atk*.2*(.5+res/100));
  }
});
test('potential-three explosion scale uses selected promotion talent and is independent of trait ramp',()=>{
  for(const [elite,potential,scale]of [[1,1,2],[1,3,2.15],[2,1,3],[2,3,3.15]]){
    const {b,u,hits}=make({elite,potential}),e=enemy(b);cast(b,u);fire(b,u,e);advance(b,.5);
    for(const s of u.mem.gdglowSlots)s.stack=40;advance(b,.8);
    const out=tagged(hits,'gdglow:explosion');assert.equal(out.length,2);
    for(const h of out)near(h.amount,u.s.atk*scale*(elite===2?.65:.5));
  }
});
test('retreat cancels released drones and redeploy resets counters, ramps and activation state',()=>{
  const {b,u,hits}=make({skill:2}),e=enemy(b);cast(b,u);advance(b,1);
  const old=u.mem.gdglowSlots;assert.ok(old.some(s=>s.stack>1));b.retreat(u);const count=hits.length;advance(b,2);
  assert.ok(old.every(s=>s.lock===null));assert.equal(hits.length,count);
  advance(b,71);b.getPlayer('arkpedia').dp=99;const again=b.deployOperator(ID,3,4,'UP');assert.ok(again);
  assert.ok(again.mem.gdglowSlots.every(s=>s.stack===1&&s.targetId===null&&s.lock===null));
  assert.equal(again.skill.active,false);assert.equal(again.mem.regularFormVisual,null);assert.ok(e.alive);
});
test('Back S2 uses its actual .4s event and Back S3 keeps delivered Idle without a fictional animation',()=>{
  const {b,u}=make({skill:1,dir:'UP'});u.skill.setSpTotal(u.skill.spCost);advance(b,.4);
  const p=effectiveProfile(u);near(p.windup(b,u),.4);assert.equal(u.mem.regularFormVisual.clip,'Skill2_Idle');
  const second=make({skill:2,dir:'UP'});cast(second.b,second.u);
  assert.equal(second.u.mem.regularFormVisual.clip,'Idle');
});
test('a second S3 activation restarts acquisition instead of inheriting the old interval',()=>{
  const {b,u,hits}=make({skill:2}),e=enemy(b);cast(b,u);advance(b,.8);
  advance(b,u.skill.timeLeft+.1);u.mem.gdglowAcquireCd=10;
  const count=tagged(hits,'gdglow:released-drone').length;
  cast(b,u);advance(b,.8);
  assert.ok(u.mem.gdglowSlots.every(s=>s.lock===e));
  assert.equal(tagged(hits,'gdglow:released-drone').length,count+3);
});
test('already emitted explosions survive withdrawal while released drones are cancelled',()=>{
  const {b,u,hits}=make({skill:2});enemy(b);cast(b,u);
  for(const s of u.mem.gdglowSlots)s.stack=40;
  while(u.mem.gdglowSlots[0].stack===40 && b.time<2)b.step();
  assert.equal(tagged(hits,'gdglow:explosion').length,0);b.retreat(u);advance(b,.4);
  assert.equal(tagged(hits,'gdglow:explosion').length,3);
  assert.equal(tagged(hits,'gdglow:released-drone').length,0);
  assert.ok(u.mem.gdglowSlots.every(s=>s.lock===null));
});
test('E0 has no explosion talent even with a guaranteed random roll',()=>{
  const {b,u,hits}=make({elite:0}),e=enemy(b);b.rng=()=>0;cast(b,u);fire(b,u,e);advance(b,8);
  assert.equal(tagged(hits,'gdglow:explosion').length,0);
  assert.ok(tagged(hits,'gdglow:released-drone').length>8);
  assert.ok(u.mem.gdglowSlots.every(s=>s.stack===1));
});
