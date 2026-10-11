// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-weedy-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { deployRegularSummon, retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { summonRecordFor, summonUnitId } from '../shared/arkpedia/summons.js';
import { applyDistanceRupture } from '../server/sim/content/arkpedia-rupture.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID='char_400_weedy', TOKEN='token_10009_weedy_cannon', CARD=`summon:${ID}`;
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){const end=b.time+s;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
 const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,
  skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;b.recordEvents=true;
 b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 b.addDp('arkpedia',99);const u=b.deployOperator(ID,3,2,dir);u.profile.noAttack=true;u.atkCd=1000;u.skill.rule='NEVER';
 const hits=[];b.on('damaged',c=>hits.push({...c,time:b.time}));return{b,u,hits,build};
}
function enemy(b,{r=3,c=4,fly=false,hp=1000000,mass=0}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:hp,atk:0,def:0,res:0,massLevel:mass});
 e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
 b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true,...(fly?{noDisplace:true}:{})}});b._buildEnemyIndex();return e;
}
function cast(u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);}
function fire(b,u,es){b.forceAttack(u,es??acquireTargets(b,u,effectiveProfile(u)));u.atkCd=1000;}
function cannon(b,r=3,c=3,dir='RIGHT') {const t=deployRegularSummon(b,CARD,r,c,dir);t.profile.noAttack=true;t.atkCd=1000;return t;}
const tagged=(hits,tag)=>hits.filter(h=>h.dmg.tags.includes(tag));
test('source ranks, ranges and original clips survive compilation; ordinary attacks have no push',()=>{
 for(const s of data.operators[ID].skills)assert.deepEqual(s.levels.map(({rangeGrid,...l})=>l),evidence.tables.skills[s.id].levels);
 const{b,u,hits}=make();const es=[enemy(b,{c:2.4}),enemy(b,{c:2.5}),enemy(b,{c:2.6}),enemy(b,{c:2.45,fly:true})];
 const targets=acquireTargets(b,u,effectiveProfile(u));assert.equal(targets.length,2);
 fire(b,u,targets);advance(b,.5);assert.equal(hits.length,0);advance(b,.1);assert.equal(hits.length,2);
 es.forEach((e,i)=>near(e.x,2.4+[0,.1,.2,.05][i]));near(u.profile.windup(b,u),.533);
 b.addBuff(u,{key:'aspd',mods:{aspd:200}});near(u.profile.windup(b,u),.533);
});
for(let rank=1;rank<=10;rank++)test(`S1 rank${rank}: block-count ground victims, uncapped release, push/stun and SP lock`,()=>{
 const{b,u,hits}=make({rank});const es=[enemy(b,{c:2.4}),enemy(b,{c:2.5}),enemy(b,{c:2.6}),enemy(b,{c:2.5,fly:true})];
 cast(u);assert.equal(u.s.flags.noSp,true);near(u.skill.gainSp(5,'gift'),0);
 fire(b,u);advance(b,.4);assert.equal(hits.length,0);advance(b,.2);
 assert.equal(hits.length,2);for(const h of hits){near(h.amount,u.s.atk*u.skill.bb.atk_scale);assert.ok(h.target.findBuff('stun'));}
 assert.ok(es.filter(e=>e.x>2.7).length===2);near(es[3].hp,1000000);assert.equal(u.skill.active,false);
 b.addBuff(u,{key:'aspd',mods:{aspd:100}});near(u.skill.spec.attack.windup(),.467/2);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank${rank}: permanent percentage BAT/ATK/range and one captured ground AoE shot`,()=>{
 const{b,u,hits}=make({skill:1,rank});cast(u);near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));
 near(u.s.interval,u.base.bat*(1+u.skill.bb.base_attack_time));assert.equal(u.skill.kind,'toggle');
 assert.equal(u.s.rangeExtend,u.skill.bb.ability_range_forward_extend);assert.equal(u.s.flags.disarm,true);
 advance(b,.3);assert.equal(!!u.s.flags.disarm,false);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');
 const es=[enemy(b,{c:4}),enemy(b,{c:4.8}),enemy(b,{c:4.2,fly:true}),enemy(b,{c:5})];
 const targets=acquireTargets(b,u,effectiveProfile(u));assert.equal(targets.length,1);
 fire(b,u,[es[0]]);advance(b,.15);assert.equal(hits.length,0);advance(b,.4);assert.equal(hits.length,2);
 near(es[2].hp,1000000);near(es[3].hp,1000000);assert.ok(es[0].x>4);
 near(u.profile.windup(b,u),.2);assert.equal(u.skill.activate(),false);advance(b,75);assert.equal(u.skill.active,true);near(u.skill.spTotal,0);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank${rank}: fixed release,1.2 Arts AoE and movement-only true damage`,()=>{
 const{b,u,hits}=make({skill:2,rank});const e=enemy(b),f=enemy(b,{c:4.6,fly:true}),outside=enemy(b,{c:5.3});
 cast(u);assert.equal(u.skill.active,true);assert.equal(u.skill.activate(),false);near(u.skill.gainSp(1,'gift'),0);
 assert.equal(skillHud(u.skill).text,'Skill casting');assert.equal(skillHud(u.skill).canActivate,false);
 advance(b,.3);assert.equal(hits.length,0);advance(b,.5);
 const arts=tagged(hits,'weedy:s3');assert.equal(arts.length,2);for(const h of arts)near(h.amount,u.s.atk*u.skill.bb.atk_scale);
 assert.ok(e.x>4);near(f.x,4.6);near(outside.hp,1000000);
 const pure=tagged(hits,'weedy:rupture');assert.ok(pure.length>0);near(pure.reduce((s,h)=>s+h.amount,0),(e.x-4)*u.skill.bb.value);
 assert.equal(u.skill.active,false);const hp=e.hp;advance(b,.5);near(e.hp,hp);
 e.x+=.2;advance(b,.1);near(e.hp,hp-.2*u.skill.bb.value);
});
test('S1 dead captured inputs refund exactly once; no replacement victim is selected',()=>{
 const{b,u,hits}=make();const e=enemy(b,{c:2.4});cast(u);fire(b,u,[e]);b.kill(e);enemy(b,{c:2.5});advance(b,.6);
 assert.equal(hits.length,0);assert.equal(u.skill.charges,1);assert.equal(u.skill.active,false);
});
test('S3 unborn control/retreat cancels; emitted shots and rupture survive source removal/control',()=>{
 for(const remove of['retreat','stun'])for(const delay of[.1,.4]){
  const{b,u,hits}=make({skill:2});const e=enemy(b,{c:5});cast(u);advance(b,delay);
  if(remove==='retreat')b.retreatOperator(ID);else b.applyStatus(u,'stun',{duration:.001});
  advance(b,1);assert.equal(tagged(hits,'weedy:s3').length,delay===.1?0:1);
  if(delay===.4){const hp=e.hp;e.x-=.2;advance(b,.1);assert.ok(e.hp<hp);}
  assert.equal(u.mem.weedyCast,null);
 }
});
test('S3 captures once, refuses replacement before emission, lands committed splash after target death',()=>{
 for(const delay of[.1,.4]){
  const{b,u,hits}=make({skill:2});const e=enemy(b),other=enemy(b,{c:4.5});cast(u);advance(b,delay);b.kill(e);advance(b,1);
  assert.equal(tagged(hits,'weedy:s3').length,delay===.1?0:1);
  if(delay===.4)assert.ok(other.hp<1000000);assert.equal(u.skill.active,false);
 }
 const{b,u}=make({skill:2});cast(u);advance(b,.3);assert.equal(u.skill.active,true);advance(b,.1);assert.equal(u.skill.active,false);
});
test('S3 release is fixed under ASPD and waits only until its shot resolves, not the clip end',()=>{
 const{b,u,hits}=make({skill:2});const e=enemy(b,{c:2.5});b.addBuff(u,{key:'aspd',mods:{aspd:200}});cast(u);
 advance(b,.3);assert.equal(hits.length,0);advance(b,.15);assert.equal(tagged(hits,'weedy:s3').length,1);
 assert.equal(u.skill.active,false);assert.ok(b.time<1.167);assert.ok(e.hp<1000000);
});
test('cannon source stats use owner level,zero slots,ALL placement,invulnerability and no manual skill',()=>{
 for(const elite of[1,2]){
  const{b,u,build}=make({elite});const r=summonRecordFor(ID,build,data.tokens);near(r.stats.atk,elite===1?479:585);
  const dp=b.dp,slots=b.deployedSlots(),t=cannon(b);near(b.dp,dp-5);assert.equal(b.deployedSlots(),slots);
  assert.equal(t.ownerUnit,u);assert.equal(t.kind,'token');assert.equal(t.skill.noSkill,true);
  assert.equal(t.s.blockCnt,0);assert.equal(t.s.flags.invulnerable,true);assert.equal(t.s.flags.untargetable,true);
  const hp=t.hp;b.dealDamage(enemy(b),t,{amount:500,type:'true',ignoreSelect:true});near(t.hp,hp);
  assert.equal(t.skill.activate(),false);near(r.talents[0].bb.duration,elite===1?15:20);
 }
 const{b}=make({elite:0});assert.equal(b.regularSummons?.has(CARD)??false,false);
});
test('cannon normal attack is nearest single ground homing shot, with its own ATK and E2 force bonus',()=>{
 for(const elite of[1,2]){
  const{b,hits}=make({elite});const t=cannon(b);advance(b,1.1);
  const far=enemy(b,{c:5}),nearer=enemy(b,{c:4}),air=enemy(b,{c:3.8,fly:true});
  const targets=acquireTargets(b,t,effectiveProfile(t));assert.deepEqual(targets,[nearer]);fire(b,t,targets);advance(b,.4);
  assert.deepEqual(t.profile.attackVisual(b,t),{begin:'Attack_Begin',loop:'Attack_Loop',beginDuration:.167});
  near(t.profile.windup(b,t),.033);assert.equal(t.profile.attackVisual(b,t),'Attack_Loop');
  assert.equal(hits.length,1);near(hits[0].amount,t.s.atk);assert.ok(nearer.x>4);near(far.hp,1000000);near(air.hp,1000000);
  assert.equal(t.mem.weedyEngaged,true);
 }
});
test('cannon expires15/20s from deployment, charges one card and starts35s cooldown on finish',()=>{
 for(const elite of[1,2]){
  const{b}=make({elite});const t=cannon(b),s=b.regularSummons.get(CARD);near(s.stock,0);
  advance(b,(elite===1?15:20)-.1);assert.equal(t.alive,true);advance(b,.2);assert.equal(t.alive,false);near(s.stock,1);
  assert.match(summonPlacementError(b,CARD,3,3),/redeploying/);const ready=s.readyAt;advance(b,ready-b.time+.01);
  assert.equal(summonPlacementError(b,CARD,3,3),null);assert.ok(cannon(b));
 }
});
test('cannon retreat refunds2DP, retains cooldown across owner redeployment and owner finish removes it',()=>{
 const{b,u}=make();const t=cannon(b),s=b.regularSummons.get(CARD),dp=b.dp;
 retreatRegularSummon(b,summonUnitId(t));near(b.dp,dp+2);near(s.readyAt,b.time+35);
 b.retreatOperator(ID);advance(b,31);b.addDp('arkpedia',99);
 // Test redeployment immediately after clearing only the owner's bench timer;
 // independent cannon cooldown must not be erased by that new owner lifetime.
 b.bench[ID].readyAt=b.time;const owner=b.deployOperator(ID,3,2,'RIGHT');assert.ok(owner);
 const next=b.regularSummons.get(CARD);near(next.readyAt,s.readyAt);assert.match(summonPlacementError(b,CARD,3,3),/redeploying/);
 advance(b,5);const t2=cannon(b);b.retreatOperator(ID);assert.equal(t2.alive,false);near(next.stock,1);
 assert.equal(u.alive,false);
});
test('E2 SP pulse is owner-only,adjacent not diagonal/two tiles, and obeys active/noSP lock',()=>{
 for(const [r,c,want] of[[3,3,2],[2,2,2],[2,3,0],[3,4,0]]){
  const{b,u}=make({skill:2});u.skill.setSpTotal(0);cannon(b,r,c);advance(b,6.01);near(u.skill.spTotal,6.05+want,.08);
 }
 const{b,u}=make({skill:1});cannon(b);cast(u);advance(b,6.1);near(u.skill.spTotal,0);
 const first=make();first.u.skill.setSpTotal(0);cannon(first.b);cast(first.u);advance(first.b,3.1);near(first.u.skill.spTotal,0);
});
for(let rank=1;rank<=10;rank++)test(`linked cannon S3 rank${rank}: original rank,independent facing,host ATK and extra force`,()=>{
 const{b,u,hits,build}=make({skill:2,rank});const t=cannon(b,2,2,'RIGHT');advance(b,1.1);
 const e=enemy(b,{r:2,c:5}),f=enemy(b,{r:3,c:4});
 assert.deepEqual(t.def.skill.bb,u.skill.bb);assert.equal(t.def.raw.arkpedia.skillRank,rank);
 cast(u);assert.ok(t.mem.weedyCast);advance(b,1);
 const out=tagged(hits,'weedy:s3');assert.equal(out.length,2);
 assert.ok(out.some(h=>h.source===t));assert.ok(out.some(h=>h.source===u));
 for(const h of out)near(h.amount,u.s.atk*u.skill.bb.atk_scale);
 assert.ok(e.x>5);assert.ok(f.x>4);assert.equal(t.mem.weedyCast,null);assert.equal(t.skill.noSkill,true);
 near(summonRecordFor(ID,build,data.tokens).skill.bb.force,u.skill.bb.force);
});
test('remote S3 excludes diagonal cannon; cannon may fire during original Start and emitted shot survives expiry',()=>{
 const far=make({skill:2});const t=cannon(far.b,2,3);enemy(far.b);cast(far.u);assert.equal(t.mem.weedyCast,undefined);
 const{b,u,hits}=make({skill:2});const nearToken=cannon(b,2,2);enemy(b,{r:2,c:4});cast(u);
 assert.equal(nearToken.mem.weedyBorn,false);assert.ok(nearToken.mem.weedyCast);advance(b,.4);b.retreat(nearToken,{permanent:true});
 advance(b,1);assert.ok(tagged(hits,'weedy:s3').some(h=>h.source===nearToken));
});
test('rupture counts out-and-back receipts,flushes final distance and shares first-value override with Nightmare',()=>{
 const{b,u,hits}=make();const e=enemy(b,{c:4});const bb={duration:1,value:1200,interval:.066};
 const old=applyDistanceRupture(b,u,e,bb,{key:'nightmare:rupture:test',tag:'nightmare:rupture',mods:{moveMul:.5}});
 assert.equal(applyDistanceRupture(b,u,e,{...bb,duration:3,value:600},{key:'weedy:rupture:test',tag:'weedy:rupture'}),old);
 near(old.timeLeft,3);near(old.data.value,1200);assert.equal(e.buffs.filter(x=>x.data?.regularRupture).length,1);
 b.displace(e,{x:1,y:0},.2);b.displace(e,{x:-1,y:0},.2);near(e.x,4);advance(b,.1);
 near(tagged(hits,'nightmare:rupture').reduce((s,h)=>s+h.amount,0),480);
 e.x+=.1;b.removeBuff(e,old.key);near(tagged(hits,'nightmare:rupture').reduce((s,h)=>s+h.amount,0),600);
 const hp=e.hp;advance(b,1);near(e.hp,hp);
});
test('natural S1 and S2 loops retain target caps; cannon waits for Start then really attacks',()=>{
 for(const skill of[0,1]){
  const{b,u,hits}=make({skill});u.profile.noAttack=false;u.atkCd=0;
  const t=cannon(b,2,2);t.profile.noAttack=false;t.atkCd=0;
  enemy(b,{r:2,c:3});enemy(b,{c:2.4});enemy(b,{c:2.5});enemy(b,{c:2.6});
  if(skill===1)cast(u);else{u.skill.rule='DEFAULT';u.skill.setSpTotal(u.skill.spCost);}
  advance(b,.6);assert.equal(hits.filter(h=>h.source===t).length,0);
  const first=hits.filter(h=>h.source===u);assert.equal(first.length,skill===0?2:3);
  advance(b,.8);assert.equal(hits.filter(h=>h.source===t).length,1);
  assert.equal(hits.filter(h=>h.source===u&&h.time>1).length,0);
 }
});
test('S3 true distance respects mass,passability,static immunity and final removal without leaks',()=>{
 for(const kind of['heavy','static','wall']){
  const{b,u,hits}=make({skill:2});const e=enemy(b,{mass:kind==='heavy'?8:0});
  if(kind==='static')b.addBuff(e,{key:'static',flags:{noDisplace:true}});
  if(kind==='wall')b.grid.tile(3,5).pass='NONE';
  cast(u);advance(b,1);assert.equal(tagged(hits,'weedy:s3').length,1);
  if(kind==='wall'){assert.ok(e.x>4&&e.x<5);near(tagged(hits,'weedy:rupture').reduce((s,h)=>s+h.amount,0),(e.x-4)*1200);}
  else{near(e.x,4);assert.equal(tagged(hits,'weedy:rupture').length,0);}
  b.kill(e);advance(b,10);assert.equal(e.buffs.filter(x=>x.data?.regularRupture).length,0);
 }
});
test('S1/S2 unfired control cancels damage; emitted S2 shot persists through retreat',()=>{
 for(const skill of[0,1]){
  const{b,u,hits}=make({skill});const e=enemy(b,{c:skill===0?2.4:4});cast(u);if(skill===1)advance(b,.3);
  fire(b,u,[e]);b.applyStatus(u,'stun',{duration:.001});advance(b,1);assert.equal(hits.length,0);
 }
 const{b,u,hits}=make({skill:1});const e=enemy(b);cast(u);advance(b,.3);fire(b,u,[e]);advance(b,.25);
 assert.ok(b.projectiles.list.length);b.retreatOperator(ID);advance(b,1);assert.equal(hits.length,1);
});
test('rupture lethal tick/removal is reentrant-safe and stops all later distance damage',()=>{
 const{b,u,hits}=make();const e=enemy(b,{hp:100});
 applyDistanceRupture(b,u,e,{duration:2,value:1200,interval:.066},{key:'weedy:rupture:test',tag:'weedy:rupture'});
 b.displace(e,{x:1,y:0},.2);advance(b,.1);assert.equal(e.alive,false);assert.equal(hits.length,1);
 advance(b,3);assert.equal(hits.length,1);
});
