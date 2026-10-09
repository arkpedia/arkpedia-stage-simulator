// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-ulpianus-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { COLS } from '../server/sim/constants.js';
import { applyElement } from '../server/sim/damage.js';
const ID='char_4145_ulpia', SKADI='char_263_skadi', MEL='char_208_melan';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){const end=b.time+s;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',row=3,col=2}={}) {
 const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
  potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(src,{operators:[build,defaultBuild(src.operators[SKADI]),defaultBuild(src.operators[MEL])]});
 b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.getPlayer('arkpedia').dp=99;
 const u=b.deployOperator(ID,row,col,dir);assert.ok(u);u.profile.noAttack=true;u.atkCd=1000;u.skill.rule='NEVER';
 const hits=[],heals=[],moves=[];b.on('damaged',c=>hits.push({...c,time:b.time}));
 b.on('heal',c=>heals.push({...c,time:b.time}));b.on('sourceMoveBorn',c=>moves.push({...c,time:b.time}));
 return{b,u,hits,heals,moves};
}
function enemy(b,{r=3,c=4,fly=false,hp=1000000,mass=0}={}) {
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:hp,atk:100,def:0,res:0,massLevel:mass});
 e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
 b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);}
function fire(b,u,es){b.forceAttack(u,es??acquireTargets(b,u,effectiveProfile(u)));u.atkCd=1000;}
const tagged=(hits,t)=>hits.filter(h=>h.dmg.tags.includes(t));
function ally(b,id,r=2,c=1){b.addDp('arkpedia',99);const u=b.deployOperator(id,r,c,'RIGHT');assert.ok(u);u.profile.noAttack=true;u.skill.rule='NEVER';return u;}
function hurt(b,e,u,amount=10,extra={}){return b.dealDamage(e,u,{amount,type:'true',isAttack:true,...extra});}

test('all native ranks/ranges and ordinary capped original attack events are used',()=>{
 for(const s of data.operators[ID].skills)assert.deepEqual(s.levels.map(({rangeGrid,...l})=>l),evidence.tables.skills[s.id].levels);
 const{b,u}=make();const es=[enemy(b,{c:2.4}),enemy(b,{c:2.5}),enemy(b,{c:2.6}),enemy(b,{c:2.3,fly:true})];
 const list=acquireTargets(b,u,effectiveProfile(u));assert.equal(list.length,2);assert.ok(!list.includes(es[3]));
 fire(b,u,list);advance(b,.5);es.forEach(e=>near(e.hp,1000000));advance(b,.1);
 assert.equal(es.filter(e=>e.hp<1000000).length,2);near(u.profile.windup(),.533);
 b.addBuff(u,{key:'test:ASPD',mods:{aspd:200}});near(u.profile.windup(),.533);
 b.addBuff(u,{key:'test:slowASPD',mods:{aspd:-250}});near(u.profile.windup(),1.066);
 near(u.s.def,0);near(u.s.res,0);
});
for(let rank=1;rank<=10;rank++)test(`S1 rank ${rank}: two retained ground victims, source release/travel, force and SP lock`,()=>{
 const{b,u,hits}=make({rank});const es=[enemy(b,{c:4}),enemy(b,{c:4.2}),enemy(b,{c:4.4}),enemy(b,{c:4.1,fly:true})];
 cast(u);near(u.skill.sp,0);assert.equal(u.s.flags.noSp,true);advance(b,.7);assert.equal(tagged(hits,'ulpia:s1').length,0);
 advance(b,.4);const out=tagged(hits,'ulpia:s1');assert.equal(out.length,2);near(es[3].hp,1000000);
 for(const h of out){near(h.amount,u.s.atk*u.skill.bb.atk_scale);assert.ok(h.target.x<4.21);}
 near(u.skill.sp,0);advance(b,4);assert.equal(u.skill.active,false);assert.equal(u.mem.ulpiaS1,null);
 assert.equal(!!u.s.flags.noSp,false);assert.ok(u.skill.spTotal>0);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank}: automatic permanent stats, three targets and scaled damage healing`,()=>{
 const{b,u,hits,heals}=make({skill:1,rank});cast(u);advance(b,.2);
 assert.equal(u.skill.kind,'toggle');assert.equal(u.skill.active,true);near(u.s.atk,u.base.atk*(1.14+u.skill.bb.atk));
 near(u.s.maxHp,u.base.maxHp*(1+u.skill.bb.max_hp));assert.equal(u.s.blockCnt,3);
 const es=[enemy(b,{c:2.4}),enemy(b,{c:2.5}),enemy(b,{c:2.6}),enemy(b,{c:2.7})];
 fire(b,u);advance(b,.65);assert.equal(hits.length,0);advance(b,.1);assert.equal(hits.length,3);
 const h=u.hp=u.s.maxHp*.3;hurt(b,es[0],u);near(u.hp,h-10+160*u.skill.bb.talent_scale);
 near(heals.at(-1).amount,160*u.skill.bb.talent_scale);assert.equal(b.activateOperator(ID),false);
 advance(b,75);assert.equal(u.skill.active,true);near(u.skill.spTotal,0);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank ${rank}: anchor splash/stun, source move, reserved home, carried time/HP and return`,()=>{
 const{b,u,hits,moves}=make({skill:2,rank});const es=[enemy(b,{c:4}),enemy(b,{c:4.6}),enemy(b,{r:4,c:4}),enemy(b,{c:4.2,fly:true})];
 u.hp=u.s.maxHp*.37;const before=u.hpRatio,dp=b.dp,slots=b.deployedSlots(),penalty=b.bench[ID].deployments;
 cast(u);advance(b,.4);assert.equal(tagged(hits,'ulpia:s3-anchor').length,0);advance(b,.3);
 const out=tagged(hits,'ulpia:s3-anchor');assert.equal(out.length,3);near(es[3].hp,1000000);
 for(const h of out){near(h.amount,u.s.atk*u.skill.bb.atk_scale);assert.ok(h.target.findBuff('stun'));}
 assert.deepEqual([u.tileR,u.tileC],[3,4]);assert.equal(moves.length,1);near(u.hpRatio,before);
 assert.equal(b.tileReservation(3,2).owner,u);assert.equal(b.deployedSlots(),slots);near(b.dp,dp);
 assert.equal(b.bench[ID].deployments,penalty);assert.ok(u.skill.timeLeft<u.skill.duration-.5);
 near(u.skill.spTotal,0);assert.equal(u.mem.regularFormVisual.clip,'Skill_3_ReStart_A');
 advance(b,u.skill.timeLeft+.4);assert.equal(u.skill.active,false);assert.deepEqual([u.tileR,u.tileC],[3,2]);
 assert.equal(moves.length,2);assert.equal(b.tileReservation(3,2),null);near(u.hpRatio,before);
 near(u.s.maxHp,u.base.maxHp);near(u.s.atk,u.base.atk*1.14); // Skadi selected deck remains through rebirth
 advance(b,1);assert.equal(u.mem.ulpiaTransition,null);assert.ok(u.skill.spTotal>0);
});
test('E0 has no talent; E1/E2 accepted-damage healing samples threshold and normal healing modifiers',()=>{
 for(const [elite,a,z]of[[0,0,0],[1,80,120],[2,100,160]]){
  const{b,u,heals}=make({elite});const e=enemy(b);u.hp=u.s.maxHp*.8;let h=u.hp;hurt(b,e,u);near(u.hp,h-10+a);
  u.hp=u.s.maxHp*.3;h=u.hp;hurt(b,e,u);near(u.hp,h-10+z);assert.equal(heals.length,elite?2:0);
  if(elite){b.addBuff(u,{key:'test:healcut',mods:{healingTakenMul:.5}});h=u.hp;hurt(b,e,u);near(u.hp,h-10+z*.5);}
 }
});
test('healing is rebirth-safe, unaffected by silence/stun, respects HealFree and excludes HP loss/gauge filling',()=>{
 const{b,u,heals}=make();const e=enemy(b);u.hp=1000;b.applyStatus(u,'stun',{duration:2});
 b.addBuff(u,{key:'test:silence',flags:{silence:true}});hurt(b,e,u);assert.equal(heals.length,1);
 b.addBuff(u,{key:'test:healFree',flags:{healFree:true}});const h=u.hp;hurt(b,e,u);near(u.hp,h-10);
 b.removeBuff(u,'test:healFree');b.loseHp(u,10);assert.equal(heals.length,1);
 applyElement(b,e,u,{amount:10,element:'neural',tags:[]});assert.equal(heals.length,1);
 b.addBuff(u,{key:'test:shield',shield:100});hurt(b,e,u);assert.equal(heals.length,2);
 b.on('damageFinal',ctx=>{ctx.dmg.cancel=true;});hurt(b,e,u);assert.equal(heals.length,2);
});
test('kill stacks use ADDITION, selected cap9/10, independent Abyssal benefits and true detach cleanup',()=>{
 for(const potential of[1,5]){
  const{b,u}=make({potential});const a=ally(b,SKADI),outsider=ally(b,MEL,1,1);
  for(let i=0;i<11;i++){const e=enemy(b);b.kill(e,u);}
  const cap=potential===5?10:9;assert.equal(u.findBuff('ulpia:kill-stacks').stacks,cap);
  near(u.s.maxHp,u.base.maxHp+120*cap);near(u.s.atk,(u.base.atk+30*cap)*1.14);
  advance(b,.1);near(a.s.maxHp,a.base.maxHp+60*cap);near(a.s.atk,(a.base.atk+15*cap)*1.14);
  assert.equal(outsider.findBuff(`ulpia:abyssal:${u.id}`),null);
  b.retreatOperator(ID);assert.equal(a.findBuff(`ulpia:abyssal:${u.id}`),null);
 }
});
test('Abyssal discovery waits .04 then syncs1s; late deployment is caught without immediate false grant',()=>{
 const{b,u}=make();b.kill(enemy(b),u);advance(b,.05);const a=ally(b,SKADI);
 assert.equal(a.findBuff(`ulpia:abyssal:${u.id}`),null);advance(b,1.05);
 assert.equal(a.findBuff(`ulpia:abyssal:${u.id}`).stacks,1);b.kill(enemy(b),u);
 assert.equal(a.findBuff(`ulpia:abyssal:${u.id}`).stacks,1);advance(b,1);assert.equal(a.findBuff(`ulpia:abyssal:${u.id}`).stacks,2);
});
test('S3 rebirth retains self stacks and unaffected recipient benefit identity; no duplicate callbacks or healing',()=>{
 const{b,u,heals,moves}=make({skill:2});const a=ally(b,SKADI);b.kill(enemy(b),u);b.kill(enemy(b),u);advance(b,.1);
 const grant=a.findBuff(`ulpia:abyssal:${u.id}`);u.hp=u.s.maxHp*.27;cast(u);advance(b,1);
 assert.equal(moves.length,1);assert.equal(heals.length,0);assert.equal(a.findBuff(`ulpia:abyssal:${u.id}`),grant);
 assert.equal(u.findBuff('ulpia:kill-stacks').stacks,2);near(u.hpRatio,.27);
 const e=enemy(b,{c:8});advance(b,1);const h=u.hp;hurt(b,e,u);near(u.hp,h-10+160);assert.equal(heals.length,1);
 assert.equal(b.activateOperator(ID),true);advance(b,1.3);assert.equal(moves.length,2);
 assert.equal(u.findBuff('ulpia:kill-stacks').stacks,2);assert.equal(a.findBuff(`ulpia:abyssal:${u.id}`),grant);
});
test('S3 cannot place others on home and manual cancel returns exactly once with no real death/deploy/refund',()=>{
 const{b,u,moves}=make({skill:2});let deploys=0,deaths=0,kills=0;
 b.on('deploy',()=>deploys++);b.on('death',()=>deaths++);b.on('kill',()=>kills++);
 cast(u);advance(b,2);assert.deepEqual([u.tileR,u.tileC],[3,8]);
 assert.match(b.placementError(MEL,3,2),/reserved/);assert.throws(()=>b.deployOperator(MEL,3,2,'RIGHT'),/reserved/);
 assert.equal(b.isReservedTile(3,2),true);
 assert.equal(b.spawnDevice('test',3,2),null);const before=b.dp;
 assert.equal(b.activateOperator(ID),true);assert.equal(b.activateOperator(ID),false);advance(b,1.3);
 assert.deepEqual([u.tileR,u.tileC],[3,2]);assert.equal(moves.length,2);near(b.dp,before);
 assert.equal(deploys+deaths+kills,0);assert.equal(b._occ[3*COLS+2],u);
});
test('occupied/high/no-build anchor endpoints still explode but refuse movement and do not create a phantom home',()=>{
 for(const invalid of['occupied','high','none']){
  const{b,u,hits,moves}=make({skill:2});enemy(b,{c:4});
  if(invalid==='occupied')ally(b,MEL,3,4);else b.grid.tile(3,4).build=invalid==='high'?'RANGED':'NONE';
  cast(u);advance(b,2);assert.equal(tagged(hits,'ulpia:s3-anchor').length,1);assert.equal(moves.length,0);
  assert.deepEqual([u.tileR,u.tileC],[3,2]);assert.equal(b.tileReservation(3,2),null);
  assert.equal(b.activateOperator(ID),true);advance(b,1.3);assert.equal(u.alive,true);
 }
});
test('same-tile anchor uses ReStart_B and map edges select an in-map endpoint, never reserve a phantom tile',()=>{
 const{b,u,moves}=make({skill:2});enemy(b,{c:2});cast(u);advance(b,.6);
 assert.equal(moves.length,1);assert.equal(moves[0].inPlace,true);assert.equal(u.mem.regularFormVisual.clip,'Skill_3_ReStart_B');
 assert.equal(b.tileReservation(3,2),null);
 const edge=make({skill:2,col:8});cast(edge.u);advance(edge.b,2);
 assert.equal(edge.u.tileC,8);assert.equal(edge.b.tileReservation(3,8),null);
});
test('true death/retreat before launch, in flight or after move never returns/resurrects and cleans the footprint',()=>{
 for(const remove of['death','retreat'])for(const delay of[.2,.5,2]){
  const{b,u,hits,moves}=make({skill:2});cast(u);advance(b,delay);
  if(remove==='death')b.kill(u);else b.retreatOperator(ID);const count=moves.length;
  advance(b,35);assert.equal(moves.length,count);assert.equal(u.alive,false);if(remove==='death')assert.equal(u.hp,0);
  assert.equal(b.tileReservation(3,2),null);assert.equal(u.mem.ulpiaS3,null);assert.equal(u.mem.regularFormVisual,null);
  assert.equal(tagged(hits,'ulpia:s3-anchor').length,0);
 }
});
test('S3 fixed cast clock survives a stun, while its ordinary unborn strike is interrupted',()=>{
 const{b,u,hits}=make({skill:2});enemy(b,{c:4});cast(u);b.applyStatus(u,'stun',{duration:1});advance(b,2);
 assert.equal(tagged(hits,'ulpia:s3-anchor').length,1);assert.equal(u.tileC,4);
 const e=enemy(b,{c:4.4});fire(b,u,[e]);advance(b,.2);b.applyStatus(u,'stun',{duration:.1});advance(b,.6);
 near(e.hp,1000000);
});
test('S1 INPUT deaths refund a refused release; a heavy target takes damage without displacement',()=>{
 const{b,u,hits}=make();const e=enemy(b);cast(u);b.kill(e);advance(b,4);assert.equal(u.skill.spTotal,u.skill.spCost);
 assert.equal(tagged(hits,'ulpia:s1').length,0);
 const heavy=make();const z=enemy(heavy.b,{mass:10});cast(heavy.u);advance(heavy.b,1);near(z.x,4);
 assert.equal(tagged(heavy.hits,'ulpia:s1').length,1);
});
test('S1 emitted unowned anchor survives source withdrawal; pre-release control cancels it',()=>{
 const{b,u,hits}=make();enemy(b,{c:4.4});cast(u);advance(b,.85);assert.ok(b.projectiles.list.length);
 b.retreatOperator(ID);advance(b,.4);assert.equal(tagged(hits,'ulpia:s1').length,1);
 const blocked=make();enemy(blocked.b);cast(blocked.u);advance(blocked.b,.2);
 blocked.b.applyStatus(blocked.u,'stun',{duration:.1});advance(blocked.b,2);
 assert.equal(tagged(blocked.hits,'ulpia:s1').length,0);assert.equal(blocked.u.skill.active,false);
});
test('natural S1/S2 automatic casts occur without enemy in basic range; S3 remains manual',()=>{
 for(const skill of[0,1,2]){
  const{b,u}=make({skill});u.profile.noAttack=false;u.atkCd=0;
  u.skill.rule=skill===0?'SEARCH':skill===1?'SP_FULL':'NEVER';if(skill===0)enemy(b,{c:4});
  u.skill.setSpTotal(u.skill.spCost);advance(b,.1);assert.equal(u.skill.activations,skill===2?0:1);
 }
});
test('all four deployment facings use original cast/attack clips and a legal forward endpoint',()=>{
 for(const dir of['RIGHT','UP','LEFT','DOWN']){
  const{b,u,moves}=make({skill:2,dir,row:3,col:4});const f=[...u.fwd];enemy(b,{r:3+f[0],c:4+f[1]});
  cast(u);assert.equal(u.mem.regularFormVisual.clip,dir==='DOWN'?'Skill_3_Begin_Down':'Skill_3_Begin');
  advance(b,.6);assert.equal(moves.length,1);assert.deepEqual([u.tileR,u.tileC],[3+f[0],4+f[1]]);
  assert.equal(u.dir,dir);advance(b,1.1);near(u.profile.windup(),.633);
  const second=make({skill:1,dir});cast(second.u);advance(second.b,.2);
  near(second.u.profile.windup(),.7);assert.equal(second.u.profile.attackVisual(),'Skill_2_Loop');
  const first=make({dir});enemy(first.b,{r:first.u.tileR+first.u.fwd[0],c:first.u.tileC+first.u.fwd[1]});
  cast(first.u);assert.equal(first.u.mem.regularFormVisual.clip,dir==='DOWN'?'Skill_1_Down_Begin':'Skill_1_Begin');
 }
});
test('S3 return failure kills once instead of duplicating an operator onto an occupied home',()=>{
 const{b,u,moves}=make({skill:2});cast(u);advance(b,2);
 // A scripted fixture bypasses the player placement gate to exercise the
 // literal return failure branch (ordinary UI placement cannot steal home).
 b.releaseTileReservations(u);ally(b,MEL,3,2);const n=moves.length;
 assert.equal(b.activateOperator(ID),true);advance(b,1);
 assert.equal(u.alive,false);assert.equal(moves.length,n);assert.equal(u.mem.ulpiaS3,null);
 assert.equal(b.tileReservation(3,2),null);
});
test('S3 detached temporary resident buffs are not silently carried; selected stack/deck effects are',()=>{
 const{b,u}=make({skill:2});b.addBuff(u,{key:'test:temporary',duration:15,mods:{atkPct:.25}});
 b.kill(enemy(b,{c:0}),u);cast(u);advance(b,2);
 assert.equal(u.findBuff('test:temporary'),null);assert.ok(u.findBuff('skadi:deck'));
 assert.equal(u.findBuff('ulpia:kill-stacks').stacks,1);
 assert.equal(u.buffs.filter(x=>x.key==='ulpia:s3-stats').length,1);
 near(u.s.atk,(u.base.atk+30)*(1.14+u.skill.bb.atk));
});
test('natural ordinary/S2/S3 attack loops enforce block-count caps instead of inherited splash or one-target fallback',()=>{
 for(const skill of[0,1,2]){
  const{b,u,hits}=make({skill});const es=[enemy(b,{c:2.4}),enemy(b,{c:2.5}),enemy(b,{c:2.6}),enemy(b,{c:2.7})];
  if(skill===1){cast(u);advance(b,.2);}
  if(skill===2){cast(u);advance(b,2);es.forEach(e=>{e.x=u.x+.3;e.y=u.y;e.tileR=u.tileR;e.tileC=u.tileC;});b._buildEnemyIndex();}
  const start=hits.length;u.profile.noAttack=false;u.atkCd=0;advance(b,.8);
  const out=hits.slice(start).filter(h=>h.source===u);assert.equal(out.length,skill===1?3:2);
  for(const h of out)near(h.amount,u.s.atk);
 }
});
test('S1 capture moves gradually over the original second-part window, clears controls and survives source death',()=>{
 const{b,u,hits}=make();const e=enemy(b,{c:4});cast(u);advance(b,1.05);
 assert.equal(tagged(hits,'ulpia:s1').length,1);assert.ok(e.x<4&&e.x>3.5);
 const previous=e.x;b.kill(u);advance(b,.3);assert.ok(e.x<previous&&e.x>2.5);
 advance(b,1.2);assert.ok(e.x>=2.49&&e.x<2.8);
 assert.equal(e.buffs.some(x=>x.key.startsWith('ulpia:capture:')),false);
});
test('pull planning is mutation-free and timed capture stops at solid tiles or invalid victim lifetimes',()=>{
 const{b,u}=make();const e=enemy(b,{c:4});const snapshot={x:e.x,y:e.y,route:e.route,blocker:e.blockedBy};
 const plan=b.planPull(e,1,{to:{x:2.5,y:3},center:u});assert.ok(plan.distance>0);
 assert.deepEqual({x:e.x,y:e.y,route:e.route,blocker:e.blockedBy},snapshot);
 b.grid.tile(3,3).pass='NONE';cast(u);advance(b,4);
 assert.ok(e.x>=3.5);assert.equal(e.buffs.some(x=>x.key.startsWith('ulpia:capture:')),false);
 const next=make();const z=enemy(next.b);cast(next.u);advance(next.b,1.05);next.b.kill(z);advance(next.b,4);
 assert.equal(next.u.mem.ulpiaS1,null);assert.equal(next.u.skill.active,false);assert.equal(z.alive,false);
});
