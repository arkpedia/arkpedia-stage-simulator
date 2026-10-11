// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import source from '../data/arkpedia-crownslayer-prefabs.json' with {type:'json'};
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
import { canTargetAlly } from '../server/sim/targeting.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID='char_1502_crosly';
const near=(a,z,tol=1e-5)=>assert.ok(Math.abs(a-z)<tol,`${a} != ${z}`);
function advance(b,t){const end=b.time+t;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',pre=null}={}){
 const d=structuredClone(data),o=d.operators[ID];d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(o),elite,potential,level:o.phases[elite].maxLevel,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(d,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 b.addDp('arkpedia',99);const hits=[];b.on('damaged',c=>hits.push({...c,time:b.time}));const victims=pre?.(b);const u=b.deployOperator(ID,3,4,dir);assert.ok(u);u.atkCd=1000;u.profile.canAttack=()=>false;return{b,u,hits,victims};
}
function enemy(b,{x=5,y=3,hp=100000,def=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:hp,def,res:0,atk:100,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
 b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
const bbFor=(n,r)=>Object.fromEntries(source.tables.skills[`skchr_crosly_${n}`].levels[r-1].blackboard.map(x=>[x.key,x.value]));
const own=(hs,u,tag)=>hs.filter(h=>h.source===u&&(!tag||h.dmg.tags.includes(tag)));
const smoke=(u,e)=>e.findBuff(`crosly:smoke:${u.id}`);
const mark=(u,e)=>e.findBuff(`crosly:mark:${u.id}`);
function shot(b,u){const p=effectiveProfile(u),es=acquireTargets(b,u,p);assert.ok(es.length);performAttack(b,u,p,es);u.atkCd=1000;}
for(let rank=1;rank<=10;rank++)test(`S1 rank ${rank}: deployment protection then ten-second ATK/evasion and original hit`,()=>{
 const{b,u,hits}=make({rank}),e=enemy(b),air=enemy(b,{fly:true}),bb=bbFor(1,rank);assert.equal(u.skill.active,true);assert.equal(u.s.flags.untargetable,true);assert.equal(smoke(u,e),null);
 advance(b,1.05);near(u.s.atk,u.base.atk*(1+bb.atk));near(u.s.dodgePhys,bb.prob);near(u.s.dodgeArts,bb.prob);near(e.s.hitRatePhys,.8);near(air.s.hitRatePhys,1);
 shot(b,u);advance(b,.4);assert.equal(own(hits,u).length,0);advance(b,.07);assert.equal(own(hits,u).length,1);near(own(hits,u)[0].amount,u.s.atk*1.2);
 advance(b,9.6);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);near(u.s.dodgePhys,0);near(e.s.hitRatePhys,1);assert.equal(skillHud(u.skill),null);assert.equal(u.skill.activate('test'),false);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank}: scaled smoke, taunt and CAST-resampled all-ground burst`,()=>{
 const{b,u,hits}=make({skill:1,rank}),bb=bbFor(2,rank),a=enemy(b),air=enemy(b,{fly:true});advance(b,1.05);
 near(u.s.taunt,-1);near(a.s.hitRatePhys,1-.2*bb.talent_scale);near(a.s.hitRateArts,1-.2*bb.talent_scale);near(air.s.hitRateArts,1);
 advance(b,7.95);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');assert.equal(own(hits,u).length,0);near(u.s.taunt,0);near(a.s.hitRatePhys,1);
 a.x=7;b._buildEnemyIndex();const late=enemy(b,{x:4,y:4});advance(b,.64);
 assert.equal(own(hits,u,'crosly:blast').length,1);assert.equal(own(hits,u)[0].target,late);near(own(hits,u)[0].amount,u.s.atk*bb['attack@atk_scale_s2']*1.2);near(air.hp,air.s.maxHp);
 advance(b,.7);assert.equal(u.mem.croslyBlast,null);assert.equal(u.mem.regularFormVisual,null);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank ${rank}: immediate conceal/block zero, fixed paired hits and target-owned marks`,()=>{
 const{b,u,hits}=make({skill:2,rank}),bb=bbFor(3,rank),e=enemy(b,{x:6}),other=enemy(b,{x:4,y:5}),air=enemy(b,{fly:true});
 near(u.s.blockCnt,0);assert.equal(u.s.flags.stealth,true);assert.equal(!!u.s.flags.untargetable,false);advance(b,.1);near(e.s.hitRatePhys,.8);assert.equal(own(hits,u).length,0);
 advance(b,.94);assert.equal(own(hits,u,'crosly:execution').length,1);assert.ok(mark(u,e)||mark(u,other));advance(b,.12);assert.equal(own(hits,u,'crosly:execution').length,2);
 const victim=own(hits,u)[0].target;assert.equal(own(hits,u)[1].target,victim);for(const h of own(hits,u))near(h.amount,u.s.atk*bb['attack@atk_scale_s3']*1.2);assert.equal(victim.s.flags.stun,true);
 const expiry=mark(u,victim).timeLeft;advance(b,.05);assert.ok(mark(u,victim).timeLeft<expiry);advance(b,2);assert.equal(own(hits,u,'crosly:execution').length,4);assert.notEqual(own(hits,u)[2].target,victim);near(air.hp,air.s.maxHp);
 advance(b,16);assert.equal(u.skill.active,false);near(u.s.blockCnt,1);assert.equal(!!u.s.flags.stealth,false);near(e.s.hitRatePhys,1);assert.equal(mark(u,victim),null);
});
for(const [elite,skill,expected] of [[0,0,1],[1,0,.85],[1,1,.7],[2,0,.8],[2,1,.5]])test(`E${elite} S${skill+1}: only unlocked smoke tiers apply`,()=>{
 const{b,u}=make({elite,skill}),e=enemy(b);advance(b,1.1);near(e.s.hitRatePhys,expected);near(e.s.hitRateArts,expected);assert.ok(u);
});
for(const dir of ['UP','RIGHT','DOWN','LEFT'])test(`${dir}: smoke selects symmetric source tiles independent of facing`,()=>{
 const{b,u}=make({skill:1,dir}),a=enemy(b,{x:3,y:2}),z=enemy(b,{x:5,y:4}),outside=enemy(b,{x:6,y:3});advance(b,1.1);assert.ok(smoke(u,a));assert.ok(smoke(u,z));assert.equal(smoke(u,outside),null);
});
test('S1 original animation rate is capped at one and slows with BAT/ASPD',()=>{
 for(const aspd of [50,200]){const{b,u,hits}=make(),e=enemy(b);advance(b,1.05);b.addBuff(u,{key:'test:aspd',mods:{aspd:aspd-100}});shot(b,u);advance(b,aspd===50?.82:.4);assert.equal(own(hits,u).length,0);advance(b,.07);assert.equal(own(hits,u).length,1);assert.ok(e);}
});
test('S3 interval is fixed under ASPD modifiers; one isolated victim waits for its six-second mark',()=>{
 const{b,u,hits}=make({skill:2}),e=enemy(b,{x:6});b.addBuff(u,{key:'test:haste',mods:{aspd:900}});advance(b,1.2);assert.equal(own(hits,u).length,2);advance(b,5.7);assert.equal(own(hits,u).length,2);advance(b,.25);assert.equal(own(hits,u).length,4);assert.equal(own(hits,u)[2].target,e);
});
test('S3 output marks any damage before evasion and does not refresh for its second hit',()=>{
 const{b,u,hits}=make({skill:2}),e=enemy(b,{x:6});b.addBuff(e,{key:'test:evade',mods:{dodgePhys:1}});advance(b,1.2);assert.equal(own(hits,u).length,0);assert.ok(mark(u,e));near(mark(u,e).timeLeft,5.8,.05);advance(b,1);b.dealDamage(u,e,{amount:1,type:'arts',canDodge:false});near(mark(u,e).timeLeft,4.8,.05);
});
test('S3 invisible buff blocks enemy selection, reveal removes both concealment and its block penalty',()=>{
 const{b,u}=make({skill:2}),e=enemy(b);assert.equal(canTargetAlly(e,u,true),false);b.applyStatus(u,'reveal',{duration:.1});assert.equal(!!u.s.flags.stealth,false);near(u.s.blockCnt,1);assert.equal(canTargetAlly(e,u,true),true);advance(b,1.2);assert.equal(!!u.s.flags.stealth,false);
});
for(const what of ['stun','freeze','disarm','retreat','death'])test(`S2 ${what} during end animation cancels its unissued burst`,()=>{
 const{b,u,hits}=make({skill:1});enemy(b);advance(b,9.2);
 if(what==='retreat')b.retreatOperator(ID);else if(what==='death')b.kill(u);else b.applyStatus(u,what,{duration:.05});advance(b,1.3);assert.equal(own(hits,u,'crosly:blast').length,0);assert.equal(u.mem.croslyBlast,null);
});
test('S2 controls while waiting do not truncate the eight seconds, but existing control at expiry prevents the blast',()=>{
 const{b,u,hits}=make({skill:1});enemy(b);advance(b,1.1);b.applyStatus(u,'stun',{duration:.1});advance(b,7);assert.equal(u.skill.active,true);advance(b,.6);b.applyStatus(u,'freeze',{duration:1});advance(b,1.3);assert.equal(own(hits,u,'crosly:blast').length,0);assert.equal(u.skill.active,false);
});
for(const what of ['stun','retreat','death'])test(`S3 ${what} between retained hits never retargets the unfired second hit`,()=>{
 const{b,u,hits}=make({skill:2});enemy(b,{x:6});enemy(b,{x:4,y:5});advance(b,1.04);assert.equal(own(hits,u).length,1);
 if(what==='stun')b.applyStatus(u,'stun',{duration:.1});else if(what==='death')b.kill(u);else b.retreatOperator(ID);advance(b,.3);assert.equal(own(hits,u).length,1);
});
test('S3 lethal first hit does not redirect the second hit to a new victim',()=>{
 const{b,u,hits}=make({skill:2});enemy(b,{x:6,hp:1});advance(b,1.04);enemy(b,{x:4,y:5});advance(b,.2);assert.equal(own(hits,u).length,1);
});
test('talent Physical damage scales after DEF; only actual non-cancelled damage removes it, with P5 tier',()=>{
 for(const potential of [1,5]){const{b,u,hits}=make({potential}),e=enemy(b,{def:100});advance(b,1.1);const scale=potential===5?1.22:1.2;
 b.dealDamage(u,e,{amount:1000,type:'phys'});near(own(hits,u).at(-1).amount,900*scale);b.dealDamage(u,e,{amount:1000,type:'arts'});near(own(hits,u).at(-1).amount,1000);
 b.addBuff(u,{key:'test:evade',mods:{dodgePhys:1}});b.dealDamage(e,u,{amount:1000,type:'phys'});b.dealDamage(u,e,{amount:1000,type:'phys'});near(own(hits,u).at(-1).amount,900*scale);
 b.removeBuff(u,'test:evade');b.dealDamage(e,u,{amount:1000,type:'phys',canDodge:false});b.dealDamage(u,e,{amount:1000,type:'phys'});near(own(hits,u).at(-1).amount,900);
 }
});
test('talent does not boost aerial victims and damaging another ally does not remove it',()=>{
 const{b,u,hits}=make(),e=enemy(b,{fly:true}),ground=enemy(b);advance(b,1.1);b.dealDamage(u,e,{amount:1000,type:'phys'});near(own(hits,u).at(-1).amount,1000);b.dealDamage(u,ground,{amount:1000,type:'phys'});near(own(hits,u).at(-1).amount,1200);
});
test('smoke is removed on leaving, expiry and retreat; redeployment restores the complete skill',()=>{
 const{b,u}=make({skill:1}),e=enemy(b);advance(b,1.1);near(e.s.hitRatePhys,.5);e.x=7;b._buildEnemyIndex();advance(b,.04);near(e.s.hitRatePhys,1);e.x=5;b._buildEnemyIndex();advance(b,.04);near(e.s.hitRatePhys,.5);
 b.retreatOperator(ID);near(e.s.hitRatePhys,1);advance(b,23);b.addDp('arkpedia',99);const v=b.deployOperator(ID,3,4,'RIGHT');assert.ok(v);assert.equal(v.skill.active,true);v.profile.canAttack=()=>false;advance(b,1.1);near(e.s.hitRatePhys,.5);
});
test('source evidence retains five exact bundles, full ranks, original events and explicit parity limits',()=>{
 assert.equal(source.source.bundles.length,5);assert.equal(Object.keys(source.templates).length,8);assert.equal(Object.values(source.tables.skills).flatMap(s=>s.levels).length,30);assert.equal(source.frameParity,false);assert.equal(source.moduleSupport,false);
 for(const face of ['Front','Back']){near(source.models[ID][face].hits.Skill_2_End[0],.6);assert.equal(source.models[ID][face].sha256,source.officialSkeletonBindings[ID][face].sha256);}
});

test('S3 retained second hit follows its victim outside smoke, while a new marked victim is never reselected',()=>{
 const{b,u,hits}=make({skill:2}),e=enemy(b,{x:6});advance(b,1.04);e.x=7;b._buildEnemyIndex();const other=enemy(b,{x:4,y:5});advance(b,.15);assert.equal(own(hits,u).length,2);assert.equal(own(hits,u)[1].target,e);assert.equal(mark(u,other),null);
});
test('S3 hidden/air victims cannot be selected; a sleeping victim is skipped without ending the duration',()=>{
 const{b,u,hits}=make({skill:2}),e=enemy(b,{x:6}),air=enemy(b,{fly:true});b.addBuff(e,{key:'test:hidden',flags:{stealth:true}});advance(b,2);assert.equal(own(hits,u).length,0);b.removeBuff(e,'test:hidden');b.applyStatus(e,'sleep',{duration:.5});advance(b,.3);assert.equal(own(hits,u).length,0);advance(b,.3);assert.equal(own(hits,u).length,2);assert.ok(u.skill.active);near(air.hp,air.s.maxHp);
});
test('S3 stun respects resistance and immunity, independently of paired Physical damage',()=>{
 for(const immune of [false,true]){const{b,u,hits}=make({skill:2}),e=enemy(b,{x:6});e.def={...e.def,immune:new Set(immune?['stun']:[])};if(!immune)b.applyStatus(e,'resist',{duration:10});advance(b,1.2);assert.equal(own(hits,u).length,2);if(immune)assert.equal(!!e.s.flags.stun,false);else{assert.ok(e.s.flags.stun);advance(b,2.1);assert.equal(!!e.s.flags.stun,false);}}
});
test('S3 expiry restores single-target normal attacks and removes all owned marks',()=>{
 const{b,u,hits}=make({skill:2}),a=enemy(b),z=enemy(b,{x:4,y:4});advance(b,16.7);const n=own(hits,u).length;shot(b,u);advance(b,.5);assert.equal(own(hits,u).length,n+1);assert.equal(own(hits,u).at(-1).target,a);assert.equal(mark(u,a),null);assert.equal(mark(u,z),null);
});
test('S2 smoke reduces an enemy hit against another ally and never changes outgoing ally hit rate',()=>{
 const{b,u}=make({skill:1}),e=enemy(b);advance(b,1.1);near(u.s.hitRatePhys,1);b.rng=()=>.99;const hp=u.hp;b.dealDamage(e,u,{amount:1000,type:'phys'});near(u.hp,hp);u.skill.end('test');b.dealDamage(e,u,{amount:1000,type:'phys'});assert.ok(u.hp<hp);
});
test('talent remembers damage through skill expiry but excludes cancelled and zero-damage receipts',()=>{
 const{b,u,hits}=make(),e=enemy(b);advance(b,1.1);b.addBuff(u,{key:'test:inv',flags:{invulnerable:true}});b.dealDamage(e,u,{amount:1000,type:'arts'});b.removeBuff(u,'test:inv');b.dealDamage(e,u,{amount:0,type:'arts'});b.dealDamage(u,e,{amount:100,type:'phys'});near(own(hits,u).at(-1).amount,120);b.dealDamage(e,u,{amount:1,type:'true'});advance(b,10);b.dealDamage(u,e,{amount:100,type:'phys'});near(own(hits,u).at(-1).amount,100);
});
