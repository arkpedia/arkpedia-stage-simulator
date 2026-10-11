// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-lin-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
const ID = 'char_4080_lin', KROOS = 'char_124_kroos';
const near = (a,z,eps=1e-5) => assert.ok(Math.abs(a-z)<eps, `${a} != ${z}`);
function advance(b,s) { const end=b.time+s; while(b.time<end-1e-9)b.step(); assert.deepEqual(b.errors,[]); }
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}) {
 const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];
 const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
  potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(src,{operators:[build,defaultBuild(src.operators[KROOS])]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'HIGH',build:'ALL',pass:'ALL'}));
 b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(ID,3,4,dir);assert.ok(u);
 u.profile.noAttack=true;u.atkCd=1000;u.skill.rule='NEVER';
 const hits=[];b.on('damaged',ctx=>hits.push({...ctx,time:b.time}));return{b,u,hits};
}
function enemy(b,{r=3,c=5,fly=false,hp=1000000,res=0,atk=100}={}) {
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:hp,res,def:0,atk});
 e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});
 b._buildEnemyIndex();return e;
}
function cast(b,u,delay=.4) { u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);advance(b,delay); }
function fire(b,u) { performAttack(b,u,effectiveProfile(u),acquireTargets(b,u,effectiveProfile(u))); }
function hurt(b,e,a,amount,type='true',extra={}) { return b.dealDamage(e,a,{amount,type,isAttack:true,...extra}); }
const tagged=(hits,t)=>hits.filter(h=>h.dmg.tags.includes(t));
test('all source ranks, original skeletons and native graph contracts are retained',()=>{
 assert.equal(evidence.source.bundles.length,5);assert.equal(Object.keys(evidence.templates).length,9);
 assert.equal(evidence.frameParity,false);assert.equal(evidence.moduleSupport,false);
 for(const s of data.operators[ID].skills)assert.deepEqual(s.levels.map(({rangeGrid,...l})=>l),evidence.tables.skills[s.id].levels);
 for(const face of ['Front','Back']) {
  const path=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton.path;
  assert.equal(createHash('sha256').update(readFileSync(new URL('../../arkpedia-sd-assets/'+path,import.meta.url))).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
  assert.equal(evidence.models[ID][face].hits.Skill_2_Loop,undefined);
 }
 const cs=evidence.characters[ID].flatMap(row=>row.components);
 assert.deepEqual(cs.find(c=>c.pathId==='-5831994699120311171').data._scaleCertainKeyList,['value']);
 const s2=cs.find(c=>c.pathId==='-7722863339672107907').data;
 assert.equal(s2._animKey,'');assert.equal(s2._waitForAttackEvent,1);
 const aura=cs.find(c=>c.pathId==='8156884214633792637').data;
 assert.equal(aura._removeBuffWhenTargetLeave,0);assert.equal(aura._removeBuffWhenAbilityDetached,1);
});
for(let rank=1;rank<=10;rank++)test(`S1 rank ${rank}: toggle, additive BAT, all ground/air targets, slow and cancellation`,()=>{
 const{b,u,hits}=make({rank});const a=enemy(b),z=enemy(b,{r:4,fly:true});cast(b,u);
 near(u.s.interval,2+u.skill.bb.base_attack_time);near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));
 assert.equal(u.skill.kind,'toggle');fire(b,u);advance(b,.5);
 assert.deepEqual(new Set(tagged(hits,'lin:attack').map(h=>h.target)),new Set([a,z]));
 for(const h of tagged(hits,'lin:attack'))near(h.amount,u.s.atk);
 assert.ok(a.findBuff('sluggish'));assert.ok(z.findBuff('sluggish'));near(u.skill.sp,0);
 assert.equal(b.activateOperator(ID),true);advance(b,2.1);assert.equal(u.skill.active,false);near(u.s.interval,2);
 near(u.s.def,u.base.def*3);near(u.s.res,u.base.res+20);assert.ok(u.skill.sp>0);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank}: ASPD/taunt, eventless all-target attack and ally barriers`,()=>{
 const{b,u,hits}=make({skill:1,rank});const a=b.deployOperator(KROOS,3,5,'RIGHT');assert.ok(a);a.profile.noAttack=true;
 const e=enemy(b),z=enemy(b,{r:4,fly:true});cast(b,u);
 near(u.s.interval,2*100/(100+u.skill.bb.attack_speed));assert.equal(u.s.taunt,-1);
 assert.ok(a.findBuff(`lin:barrier:${u.id}`));assert.equal(b.activateOperator(ID),false);
 fire(b,u);assert.equal(tagged(hits,'lin:attack').length,2);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Loop');
 near(hurt(b,e,a,199),0);near(hurt(b,e,a,220),20);assert.equal(tagged(hits,'lin:shatter').length,2);
 advance(b,u.skill.timeLeft+.1);assert.equal(a.findBuff(`lin:barrier:${u.id}`),null);
 assert.equal(u.s.taunt,0);near(u.s.def,u.base.def*3);assert.equal(z.alive,true);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank ${rank}: expanded range, threshold-only scaling, kill refresh and cancellation`,()=>{
 const{b,u,hits}=make({skill:2,rank});cast(b,u);
 near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));assert.deepEqual(u.skill.spec.targeting.rangeGrid,u.skill.def.rangeGrid);
 const threshold=200*u.skill.bb.talent_scale,e=enemy(b,{hp:1}),z=enemy(b,{r:3,c:6});
 near(hurt(b,z,u,threshold),0);assert.equal(u.mem.linBarriers.get(u).reformAt,0);
 fire(b,u);advance(b,.4);assert.equal(e.alive,false);assert.equal(tagged(hits,'lin:shatter').length,0);
 advance(b,.2);assert.ok(tagged(hits,'lin:shatter').some(h=>h.target===z));
 for(const h of tagged(hits,'lin:shatter'))near(h.amount,u.s.atk);
 near(hurt(b,z,u,threshold+25),25);assert.ok(u.mem.linBarriers.get(u).reformAt>b.time);
 const low=enemy(b,{hp:1});fire(b,u);advance(b,.6);assert.equal(low.alive,false);near(u.mem.linBarriers.get(u).reformAt,0);
 assert.equal(b.activateOperator(ID),true);advance(b,2.1);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);
});
test('E0 has no barrier, E1/2 thresholds/reform time and potential damage use the selected candidates',()=>{
 for(const [elite,potential,threshold,scale,interval]of[[0,1,0,0,0],[1,1,150,.6,12],[1,5,150,.7,12],[2,1,200,1,8],[2,5,200,1.1,8]]) {
  const{b,u,hits}=make({elite,potential});const e=enemy(b);const before=u.hp;
  near(hurt(b,e,u,threshold+10),10);near(before-u.hp,10);
  if(!elite){assert.equal(u.mem.linBarriers.size,0);assert.equal(tagged(hits,'lin:shatter').length,0);continue;}
  near(tagged(hits,'lin:shatter')[0].amount,u.base.atk*scale);
  near(u.mem.linBarriers.get(u).reformAt,interval);advance(b,interval+.01);near(hurt(b,e,u,threshold),0);
 }
});
test('fixed barrier subtracts after DEF/RES, protects exact equality and never accumulates damage',()=>{
 const{b,u}=make();const e=enemy(b);for(let i=0;i<10;i++)near(hurt(b,e,u,200),0);
 near(hurt(b,e,u,u.s.def+200,'phys'),0);near(hurt(b,e,u,200/(1-u.s.res/100),'arts'),0);
 near(hurt(b,e,u,u.s.def+201,'phys'),1);near(hurt(b,e,u,200),200);
 advance(b,8);near(hurt(b,e,u,200),0);
});
test('barrier cooldown survives mode switches; S3 value boost does not clear an existing break',()=>{
 const{b,u}=make({skill:2});const e=enemy(b);hurt(b,e,u,201);const at=u.mem.linBarriers.get(u).reformAt;
 cast(b,u);near(hurt(b,e,u,300),300);assert.equal(u.mem.linBarriers.get(u).reformAt,at);
 assert.equal(b.activateOperator(ID),true);advance(b,2.1);assert.equal(u.mem.linBarriers.get(u).reformAt,at);
});
test('S2 grant persists after range exit and is removed at end; departed/redeployed recipients get fresh state',()=>{
 const{b,u}=make({skill:1});const a=b.deployOperator(KROOS,3,5,'RIGHT');a.profile.noAttack=true;cast(b,u);
 const e=enemy(b);hurt(b,e,a,201);a.x=0;a.y=0;a.tileR=0;a.tileC=0;advance(b,.1);
 assert.ok(a.findBuff(`lin:barrier:${u.id}`));near(hurt(b,e,a,50),50);
 b.retreatOperator(KROOS);assert.equal(u.mem.linBarriers.has(a),false);
 advance(b,u.skill.timeLeft+.1);assert.equal(u.mem.linBarriers.size,1);
});
test('S2 blast uses Lin source ATK and protected recipient origin, not ally ATK or Lin location',()=>{
 const{b,u,hits}=make({skill:1});const a=b.deployOperator(KROOS,3,5,'RIGHT');a.profile.noAttack=true;cast(b,u);
 const e=enemy(b,{c:7}),far=enemy(b,{c:2});hurt(b,e,a,201);
 const out=tagged(hits,'lin:shatter');assert.equal(out.length,1);assert.equal(out[0].target,e);near(out[0].amount,u.base.atk);
 assert.equal(far.hp,far.s.maxHp);
});
test('zero HP damage can give T2 SP; probability/potential and no-SP/active-skill gates are respected',()=>{
 for(const potential of [1,3]) {
  const{b,u}=make({potential});const e=enemy(b);u.skill.setSpTotal(0);b.rng=()=>.52;
  hurt(b,e,u,100);near(u.skill.sp,potential===3?1:0);b.rng=()=>.1;
  const before=u.skill.sp;hurt(b,e,u,100,'true',{noSp:true});near(u.skill.sp,before);
  b.addBuff(u,{key:'test:noSp',flags:{noSp:true}});hurt(b,e,u,100);near(u.skill.sp,before);b.removeBuff(u,'test:noSp');
  hurt(b,e,u,100);near(u.skill.sp,before+1);cast(b,u);hurt(b,e,u,100);near(u.skill.sp,0);
 }
});
test('direct HP loss bypasses the barrier and does not grant T2 SP',()=>{
 const{b,u}=make();u.skill.setSpTotal(0);b.rng=()=>0;const before=u.hp;b.loseHp(u,100);
 near(before-u.hp,100);near(u.skill.sp,0);assert.equal(u.mem.linBarriers.get(u).reformAt,0);
});
test('S3 shatter kills do not recurse or trigger attack-only refresh',()=>{
 const{b,u,hits}=make({skill:2});cast(b,u);const e=enemy(b,{hp:1});hurt(b,e,u,601);
 advance(b,.4);assert.equal(e.alive,false);assert.equal(tagged(hits,'lin:shatter').length,1);
 assert.ok(u.mem.linBarriers.get(u).reformAt>b.time);
});
test('ordinary phalanx holds fire, a natural skill attack hits once per selected target',()=>{
 const{b,u,hits}=make();enemy(b);u.profile.noAttack=false;u.atkCd=0;advance(b,1);
 assert.equal(tagged(hits,'lin:attack').length,0);cast(b,u);advance(b,.6);
 assert.equal(tagged(hits,'lin:attack').length,1);
});
test('stun or skill cancellation during S1/S3 windup invalidates an unfired attack',()=>{
 for(const skill of [0,2])for(const interrupt of ['stun','cancel']) {
  const{b,u,hits}=make({skill});enemy(b);cast(b,u);fire(b,u);advance(b,.1);
  if(interrupt==='stun')b.applyStatus(u,'stun',{duration:1});else assert.equal(b.activateOperator(ID),true);
  advance(b,.6);assert.equal(tagged(hits,'lin:attack').length,0);
 }
});
test('retreat/death clear owned barriers and invalidate pending kill refresh',()=>{
 for(const skill of [1,2])for(const death of [false,true]) {
  const{b,u}=make({skill});const a=b.deployOperator(KROOS,3,5,'RIGHT');a.profile.noAttack=true;cast(b,u);
  const e=enemy(b,{hp:1});fire(b,u);advance(b,.4);
  if(death)b.kill(u);else b.retreatOperator(ID);
  assert.equal(u.mem.linBarriers.size,0);assert.equal(a.findBuff(`lin:barrier:${u.id}`),null);
  advance(b,.5);assert.equal(u.mem.regularFormVisual,null);assert.equal(e.alive,false);
 }
});
test('barrier remains effective while Lin is stunned or silenced; dodged/cancelled damage never breaks it',()=>{
 const{b,u,hits}=make();const e=enemy(b);u.skill.setSpTotal(0);b.rng=()=>0;
 b.applyStatus(u,'stun',{duration:2});b.applyStatus(u,'silence',{duration:2});
 near(hurt(b,e,u,100),0);near(u.skill.sp,1);
 b.addBuff(u,{key:'test:dodge',mods:{dodgePhys:1}});hurt(b,e,u,10000,'phys');
 assert.equal(u.mem.linBarriers.get(u).reformAt,0);assert.equal(tagged(hits,'lin:shatter').length,0);
 b.removeBuff(u,'test:dodge');const h=b.on('hit',ctx=>{if(ctx.target===u)ctx.dmg.cancel=true;});
 hurt(b,e,u,10000);b.off(h);assert.equal(u.mem.linBarriers.get(u).reformAt,0);near(u.skill.sp,1);
});
test('fixed block precedes ordinary HP/hit shields without consuming them on fully blocked damage',()=>{
 const{b,u}=make();const e=enemy(b);b.addBuff(u,{key:'test:shield',shield:100});
 near(hurt(b,e,u,199),0);near(u.findBuff('test:shield').shield,100);
 near(hurt(b,e,u,250),0);near(u.findBuff('test:shield').shield,50);
 near(hurt(b,e,u,100),50);assert.equal(u.findBuff('test:shield'),null);
});
test('S1 slow expires at the selected duration and only the retained valid windup victims are struck',()=>{
 const{b,u,hits}=make();const a=enemy(b),gone=enemy(b,{r:4});cast(b,u);fire(b,u);
 const late=enemy(b,{r:2});b.kill(gone);advance(b,.45);
 assert.deepEqual(tagged(hits,'lin:attack').map(h=>h.target),[a]);assert.equal(late.hp,late.s.maxHp);
 near(a.findBuff('sluggish').duration,1);advance(b,1.01);assert.equal(a.findBuff('sluggish'),null);
});
test('source hit timing is shared by both original facings and cannot accelerate beyond scale one',()=>{
 for(const dir of ['RIGHT','UP'])for(const skill of [0,2]) {
  const{b,u,hits}=make({skill,dir});enemy(b);cast(b,u);b.addBuff(u,{key:'test:aspd',mods:{aspd:200}});fire(b,u);
  const event=skill===0?.4:.333;advance(b,event-.04);assert.equal(tagged(hits,'lin:attack').length,0);
  advance(b,.06);assert.equal(tagged(hits,'lin:attack').length,1);
 }
});
test('original S3 A/B/C clips are selected without changing their common damage event',()=>{
 const{b,u}=make({skill:2});const e=enemy(b);cast(b,u);
 const choices=[];for(const value of [0,.4,.99]) {b.rng=()=>value;choices.push(effectiveProfile(u).attackVisual(b,u,[e]));}
 assert.deepEqual(choices,['Skill_3_Attack_A','Skill_3_Attack_B','Skill_3_Attack_C']);
});
