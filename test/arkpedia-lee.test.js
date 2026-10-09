// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-lee-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID='char_322_lmlee';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){const end=b.time+s;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',deploy=true}={}){
 const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];
 const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
 potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const hits=[];b.on('damaged',ctx=>hits.push({...ctx,time:b.time}));
 const place=()=>{b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(ID,3,4,dir);assert.ok(u);u.atkCd=1000;u.profile.noAttack=true;return u;};
 const u=deploy?place():null;return {b,u,hits,place};
}
function enemy(b,{r=3,c=5,fly=false,hp=100000}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:hp,atk:100,def:100,res:50,moveSpeed:1,weight:0});
 e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);advance(b,.4);}
const explosions=hits=>hits.filter(h=>h.dmg.tags.includes('lmlee:paper-explosion'));
test('retains all30 source ranks,14 templates, stun DB closure and exact original delivered facings',()=>{
 assert.equal(evidence.frameParity,false);assert.equal(evidence.source.bundles.length,5);assert.equal(Object.keys(evidence.templates).length,14);
 assert.ok(evidence.buffDatabase.stun);assert.equal(evidence.tables.ranges['x-4'].grids.length,9);
 for(const s of data.operators[ID].skills)assert.deepEqual(s.levels.map(({rangeGrid,...l})=>l),evidence.tables.skills[s.id].levels);
 for(const face of ['Front','Back']){
 const asset=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
 const raw=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
 assert.equal(createHash('sha256').update(raw).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
 }
});
for(let rank=1;rank<=10;rank++)test(`S1 rank${rank}: auto activates without targets; additive ATK and Arts-only dodge persist`,()=>{
 const {b,u}=make({rank});assert.equal(u.skill.active,false);advance(b,u.skill.spCost+.1);
 assert.equal(u.skill.active,true);near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));near(u.s.dodgeArts,u.skill.bb.prob);near(u.s.dodgePhys,0);
 assert.equal(b.activateOperator(ID),false);assert.equal(skillHud(u.skill).text,'Skill active');advance(b,20);assert.equal(u.skill.active,true);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank${rank}: passive ASPD, 5-second mark, allied damage count, Arts radius1 explosion`,()=>{
 const {b,u,hits}=make({skill:1,rank}),e=enemy(b),air=enemy(b,{c:5.9,fly:true}),outside=enemy(b,{c:6.1});
 near(u.s.aspd,100+u.skill.bb.attack_speed);cast(b,u);assert.equal(u.mem.leePaper.target,e);assert.equal(u.skill.active,false);
 near(e.s.taunt,1);b.dealDamage(u,e,{amount:100,type:'phys'});b.dealDamage(u,e,{amount:100,type:'arts',isAttack:false});
 assert.equal(u.mem.leePaper.count,2);advance(b,5.1);const out=explosions(hits),bb=u.skill.bb;
 assert.equal(out.length,2);for(const h of out)near(h.amount,u.base.atk*(bb.default_atk_scale+bb.factor_atk_scale*2)*.5);
 assert.ok(out.some(h=>h.target===air));near(outside.hp,100000);near(e.s.taunt,0);assert.equal(u.mem.leePaper,null);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank${rank}: expanded9-cell range, ATK/DEF/taunt and uncapped source attack timing`,()=>{
 const {b,u}=make({skill:2,rank});advance(b,u.skill.spCost+.45);assert.equal(u.skill.active,true);
 near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));near(u.s.def,u.base.def*(1+u.skill.bb.def));near(u.s.taunt,1);assert.equal(u.rangeKeys.length,9);
 assert.equal(u.mem.regularFormVisual.clip,'Skill_3_Idle');b.addBuff(u,{key:'test:aspd',mods:{aspd:300}});
 near(effectiveProfile(u).windup(b,u),evidence.models[ID].Front.hits.Skill_3_Loop[0]/4);
 assert.equal(b.activateOperator(ID),false);
});
test('E2 upkeep spends5 once to arm one shield, then3; refresh is5 again only after consumption',()=>{
 const {b,u}=make();b.getPlayer('arkpedia').dp=50;advance(b,2.9);near(b.getPlayer('arkpedia').dp,52.9,.01);
 advance(b,.14);near(b.getPlayer('arkpedia').dp,45+b.time);assert.equal(u.mem.leeShield,true);
 advance(b,3);near(b.getPlayer('arkpedia').dp,42+b.time);const e=enemy(b);
 assert.equal(b.applyStatus(u,'stun',{duration:10,source:e}),false);assert.equal(u.mem.leeShield,false);near(e.findBuff('stun').timeLeft,3);
 advance(b,3);near(b.getPlayer('arkpedia').dp,37+b.time);assert.equal(u.mem.leeShield,true);
});
test('upkeep at exact threshold uses3 at3/4,5 at5; under3 forces withdrawal and no DP refund',()=>{
 for(const dp of [0,2,3,4,5]){
 const {b,u}=make();advance(b,3);b.getPlayer('arkpedia').dp=dp;b.step();
 assert.equal(u.alive,dp>=3);if(dp>=3){near(b.getPlayer('arkpedia').dp,dp+b.dt-(dp>=5?5:3));assert.equal(u.mem.leeShield,dp>=5);}
 }
 const {b,u}=make();b.getPlayer('arkpedia').dp=40;b.retreatOperator(ID);near(b.getPlayer('arkpedia').dp,40);assert.equal(u.deployed,false);
});
test('E0/E1 pay3 without E2 protection, even with plentiful DP',()=>{
 for(const elite of [0,1]){const {b,u}=make({elite});b.getPlayer('arkpedia').dp=50;advance(b,3.04);near(b.getPlayer('arkpedia').dp,47+b.time);assert.equal(u.mem.leeShield,false);}
});
test('shield only consumes on stun/freeze; enemy immunity, ally and sourceless status use normal source rules',()=>{
 for(const kind of ['stun','freeze']){
 const {b,u}=make();advance(b,3.04);const e=enemy(b);
 assert.equal(b.applyStatus(u,'sleep',{duration:.1,source:e}),true);assert.equal(u.mem.leeShield,true);advance(b,.2);
 assert.equal(b.applyStatus(u,kind,{duration:10,source:e,force:true}),false);near(e.findBuff('stun').timeLeft,3);assert.equal(u.mem.leeShield,false);
 }
 for(const source of ['self',null]){const {b,u}=make();advance(b,3.04);assert.equal(b.applyStatus(u,'stun',{duration:10,source:source?u:null}),false);assert.equal(u.findBuff('stun'),null);}
 const {b,u}=make();advance(b,3.04);const e=enemy(b);e.def={...e.def,immune:new Set(['stun'])};
 assert.equal(b.applyStatus(u,'stun',{duration:10,source:e}),false);assert.equal(e.findBuff('stun'),null);
});
test('blocking talent is selected by promotion/potential and doubles only with exactly one nearby enemy',()=>{
 for(const elite of [0,1,2])for(const potential of [1,5]){
 const {b,u}=make({elite,potential}),e=enemy(b,{c:4.4});b._checkBlock(e);advance(b,.12);
 const value=elite===0?0:(elite===1?7:14)+(potential>=5?1:0);near(u.s.aspd,100+2*value);near(e.s.aspd,100-2*value);
 const z=enemy(b,{r:2,c:4,fly:true});advance(b,.12);near(u.s.aspd,100+value);near(e.s.aspd,100-value);
 b.kill(z);advance(b,.12);near(u.s.aspd,100+2*value);b.releaseBlocked(u);near(u.s.aspd,100);near(e.s.aspd,100);
 }
});
test('blocking swaps and retreat remove only this Lee ASPD debuffs',()=>{
 const {b,u}=make(),e=enemy(b,{c:4.4}),z=enemy(b,{r:2,c:4});b._checkBlock(e);advance(b,.12);
 b.addBuff(e,{key:'test:other',mods:{aspd:-10}});b._unblock(e);e.x=7;z.x=4.4;z.y=3;b._checkBlock(z);advance(b,.12);
 near(e.s.aspd,90);near(z.s.aspd,72);b.retreatOperator(ID);near(z.s.aspd,100);near(e.s.aspd,90);
});
test('S2 requires legal ground victim, uses one begin event, rejects stale windup after interruption',()=>{
 for(const dir of ['UP','DOWN','LEFT','RIGHT']){
 const {b,u}=make({skill:1,dir});u.skill.setSpTotal(7);assert.equal(b.activateOperator(ID),false);
 const e=enemy(b,{r:3,c:4.1,fly:true});assert.equal(b.activateOperator(ID),false);e.motion='WALK';
 assert.equal(b.activateOperator(ID),true);advance(b,.15);assert.equal(u.mem.leePaper,undefined);b.applyStatus(u,'stun',{duration:1});advance(b,.3);assert.equal(u.mem.leePaper,undefined);
 advance(b,1);cast(b,u);assert.equal(u.mem.leePaper.target,e);
 }
});
test('S2 count cap finishes on .1s trigger, one explosion; damage components count separately, HP loss and element fill do not',()=>{
 const {b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);
 b.loseHp(e,10);b.dealDamage(u,e,{amount:10,type:'element',element:'neural'});assert.equal(u.mem.leePaper.count,0);
 for(let i=0;i<40;i++)b.dealDamage(u,e,{amount:1,type:'true'});assert.equal(u.mem.leePaper.count,30);assert.equal(explosions(hits).length,0);
 advance(b,.12);assert.equal(explosions(hits).length,1);near(explosions(hits)[0].amount,u.base.atk*9*.5);advance(b,6);assert.equal(explosions(hits).length,1);
});
test('S2 cap/death/recast cleanup removes taunt before explosion and never hits the same corpse recursively',()=>{
 for(const mode of ['target-death','lee-death','recast']){
 const {b,u,hits}=make({skill:1}),e=enemy(b),z=enemy(b,{c:5.5,fly:true});cast(b,u);hits.length=0;
 if(mode==='target-death')b.dealDamage(u,e,{amount:200000,type:'true'});
 else if(mode==='lee-death')b.kill(u);
 else cast(b,u);
 assert.equal(explosions(hits).filter(h=>h.target===z).length,1);near(e.s.taunt,mode==='recast'?1:0);
 if(mode!=='recast'){advance(b,7);assert.equal(explosions(hits).filter(h=>h.target===z).length,1);}
 }
});
test('S2 voluntary/merchant withdrawal explodes only if marked victim was blocked',()=>{
 for(const blocked of [false,true])for(const forced of [false,true]){
 const {b,u,hits}=make({skill:1}),e=enemy(b,{c:blocked?4.4:5});if(blocked)b._checkBlock(e);cast(b,u);hits.length=0;
 if(forced)b.retreat(u,{reason:'merchant'});else b.retreatOperator(ID);
 assert.equal(explosions(hits).length,blocked?1:0);near(e.s.taunt,0);assert.equal(u.mem.leePaper,null);
 advance(b,7);assert.equal(explosions(hits).length,blocked?1:0);
 }
});
test('ordinary attacks hit one ground victim, S2 passive does not use its two unused visual markers',()=>{
 const {b,u,hits}=make({skill:1}),e=enemy(b),z=enemy(b,{c:5.1});
 assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;advance(b,1);assert.equal(hits.length,1);near(z.hp,100000);near(hits[0].amount,u.base.atk-100);
 near(effectiveProfile(u).windup(b,u),evidence.models[ID].Front.hits.Attack[0]/1.3);
});
test('S3 releases one damaging fixed-time projectile and pushes other ground victims radially once',()=>{
 const {b,u,hits}=make({skill:2}),e=enemy(b),z=enemy(b,{r:2,c:4}),air=enemy(b,{r:4,c:4,fly:true});advance(b,7.5);
 const pushed=[];const old=b.push.bind(b);b.push=(enemy,force,opts)=>{pushed.push({enemy,force,opts});return old(enemy,force,opts);};
 assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;advance(b,.08);assert.equal(hits.length,0);assert.equal(b.projectiles.list.length,1);
 assert.deepEqual(pushed.map(p=>p.enemy),[z]);near(pushed[0].force,0);assert.equal(pushed[0].opts.dir,undefined);
 advance(b,.2);assert.equal(hits.length,1);assert.equal(hits[0].target,e);near(air.hp,100000);near(z.hp,100000);
});
test('S3 dodge reads current attacker position, handles sourceless Arts, excludes True/HP loss and nonmissable hits',()=>{
 const {b,u}=make({skill:2}),e=enemy(b,{c:7});advance(b,7.5);b.rng=()=>0;
 const hp=u.hp;b.dealDamage(e,u,{amount:100,type:'arts'});near(u.hp,hp);e.x=5;b._buildEnemyIndex();
 b.dealDamage(e,u,{amount:100,type:'arts'});near(u.hp,hp-100);
 b.dealDamage(null,u,{amount:100,type:'arts',sourceless:true});near(u.hp,hp-100);
 b.dealDamage(null,u,{amount:100,type:'true'});near(u.hp,hp-200);b.loseHp(u,100);near(u.hp,hp-300);
 b.dealDamage(null,u,{amount:100,type:'arts',canDodge:false});near(u.hp,hp-400);
 b.rng=()=>.9;b.dealDamage(null,u,{amount:100,type:'arts'});near(u.hp,hp-500);
});
test('redeployment creates fresh upkeep, protection and cast state; old callbacks cannot mark new targets',()=>{
 const {b,u,hits}=make({skill:1}),e=enemy(b);u.skill.setSpTotal(7);b.activateOperator(ID);b.retreatOperator(ID);advance(b,25.1);
 const z=b.deployOperator(ID,3,4,'RIGHT');assert.ok(z);z.atkCd=1000;z.profile.noAttack=true;assert.equal(z.mem.leePaper,undefined);assert.equal(z.mem.leeShield,false);
 advance(b,2.9);assert.equal(z.mem.leeShield,false);advance(b,.12);assert.equal(z.mem.leeShield,true);assert.equal(explosions(hits).length,0);near(e.s.taunt,0);
});
