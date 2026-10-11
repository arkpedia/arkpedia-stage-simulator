// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-jessica-prefabs.json' with {type:'json'};
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets,effectiveProfile } from '../server/sim/ai.js';
import { deployRegularSummon,summonPlacementError,regularSummonCards,retreatRegularSummon } from '../server/sim/content/arkpedia-summons.js';
import { regularTokenIdsFor,summonCardId,summonUnitId } from '../shared/arkpedia/summons.js';
import { spriteFacing } from '../shared/arkpedia/facing.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID='char_1034_jesca2',TOKEN='token_10032_jesca2_jckshd',key=summonCardId(ID);
const near=(a,z)=>assert.ok(Math.abs(a-z)<1e-5,`${a} != ${z}`);
function advance(b,s){const end=b.time+s;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',others=[]}={}){
 const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,
  skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(src,{operators:[build,...others.map(id=>defaultBuild(src.operators[id]))]});
 b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 b.addDp('arkpedia',99);const u=b.deployOperator(ID,3,2,dir);
 u.profile.noAttack=true;u.atkCd=1000;u.skill.rule='NEVER';
 const hits=[];b.on('damaged',c=>hits.push({...c,time:b.time}));return{b,u,hits};
}
function enemy(b,{r=3,c=3,hp=100000,def=0,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:hp,atk:0,def,res});
 e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
 b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function shield(b,r=3,c=3){return deployRegularSummon(b,key,r,c);}
function cast(u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);}
function fire(b,u,es){b.forceAttack(u,es??acquireTargets(b,u,effectiveProfile(u)));u.atkCd=1000;}
function ally(b,id,r,c){b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,'RIGHT');a.profile.noAttack=true;a.atkCd=1000;a.skill.rule='NEVER';return a;}
test('all thirty original ranks and default shield facings preload with the owner',()=>{
 for(const s of data.operators[ID].skills)assert.deepEqual(s.levels.map(({rangeGrid,...l})=>l),evidence.tables.skills[s.id].levels);
 assert.deepEqual(regularTokenIdsFor([ID]),[TOKEN]);
 for(const facing of ['front','back'])assert.equal(data.sd.models[`operator/${TOKEN}/default/${facing}`].skeleton.sha256,
  evidence.models[TOKEN][facing==='front'?'Front':'Back'].sha256);
});
test('normal attacks select one ground or aerial victim, preserve physical mitigation and native event/flight delay',()=>{
 const{b,u,hits}=make({elite:0});const e=enemy(b,{def:100});enemy(b);enemy(b,{fly:true});
 assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);fire(b,u,[e]);advance(b,.05);assert.equal(hits.length,0);
 advance(b,.2);assert.equal(hits.length,1);near(hits[0].amount,u.s.atk-100);assert.equal(hits[0].dmg.applyWay,'ranged');
 assert.equal(hits[0].dmg.type,'phys');
});
test('shield deploys only in cardinal adjacent ground tiles, automatically faces the host-to-shield direction, uses zero slots',()=>{
 const{b,u}=make();assert.match(summonPlacementError(b,key,2,3),/next to/);assert.match(summonPlacementError(b,key,3,5),/next to/);
 const dp=b.dp,slots=b.deployedSlots();const t=shield(b,3,1);
 assert.equal(t.dir,'LEFT');assert.equal(u.dir,'LEFT');assert.equal(b.deployedSlots(),slots);near(b.dp,dp-5);
 assert.equal(t.s.blockCnt,2);assert.equal(t.s.taunt,1);assert.equal(t.s.flags.healFree,true);
 assert.equal(t.profile.canAttack(b,t),false);
 assert.match(summonPlacementError(b,key,3,3),/remaining|limit/);
 advance(b,.15);assert.equal(spriteFacing(u),-1);near(t.hp,3802);
});
test('shield rejects high ground, occupied tiles, insufficient DP and non-fullscreen deployment',()=>{
 const{b}=make({others:['char_208_melan']});b.grid.tiles[3*21+3].build='RANGED';assert.match(summonPlacementError(b,key,3,3),/melee/);
 b.grid.tiles[3*21+3].build='ALL';ally(b,'char_208_melan',3,3);assert.match(summonPlacementError(b,key,3,3),/occupied/);
 b.getPlayer('arkpedia').dp=0;assert.match(summonPlacementError(b,key,3,1),/DP/);
 b.setViewport('embedded');assert.match(summonPlacementError(b,key,3,1),/fullscreen/);
});
for(const [dir,r,c]of[['RIGHT',3,3],['LEFT',3,1],['UP',4,2],['DOWN',2,2]])test(`${dir}: body range rotates immediately, blocked face waits, shield removal restores saved body/face`,()=>{
 const{b,u}=make();const fake={alive:true,deployed:true};u.blocking.push(fake);
 const t=shield(b,r,c);assert.equal(u.dir,dir);assert.equal(t.dir,dir);assert.equal(u.mem.regularVisualDirection,'RIGHT');
 advance(b,.15);assert.equal(u.mem.regularVisualDirection,'RIGHT');u.blocking=[];advance(b,.15);
 assert.equal(u.mem.regularVisualDirection,dir);assert.ok(u.rangeKeys.length);
 b.applyStatus(u,'stun',{duration:.3});b.retreat(t,{permanent:true});assert.equal(u.dir,'RIGHT');
 advance(b,.15);assert.equal(u.mem.regularVisualDirection,dir);advance(b,.2);assert.equal(u.mem.regularVisualDirection,'RIGHT');
});
for(const elite of[0,1,2])test(`E${elite}: source lifetime, countdown, no healing and finish-started 30-second recharge`,()=>{
 const{b,u}=make({elite});const t=shield(b);const duration=[20,35,50][elite];
 const h=skillHud(t.skill);assert.ok(h);assert.equal(h.text,`Shield remaining · ${duration}s`);near(h.fraction,1);
 const before=t.hp;b.dealDamage(null,t,{amount:100,type:'true'});b.heal(u,t,100);near(t.hp,before-100);
 advance(b,duration-.1);assert.equal(t.alive,true);advance(b,.15);assert.equal(t.alive,false);
 const state=regularSummonCards(b)[0];assert.equal(state.stock,1);near(state.readyAt,duration+30);
 assert.match(summonPlacementError(b,key,3,3),/redeploying/);advance(b,30);assert.equal(summonPlacementError(b,key,3,3),null);
});
for(const potential of[1,3,5])test(`P${potential}: shield-dependent rear DEF aura follows facing and cleans up`,()=>{
 const{b,u}=make({potential,others:['char_208_melan','char_122_beagle']});
 const rear=ally(b,'char_208_melan',3,1),side=ally(b,'char_122_beagle',4,2),sideDef=side.s.def;near(u.s.def,u.base.def);
 const t=shield(b);advance(b,.05);const bonus=potential===1?.15:.18;
 near(u.s.def,u.base.def*(1+bonus));near(rear.s.def,rear.base.def*(1+bonus));near(side.s.def,sideDef);
 b.retreat(t,{permanent:true});near(u.s.def,u.base.def);near(rear.s.def,rear.base.def);
});
test('E2 shield damage rolls source probability once, respects potential and active skill SP locks',()=>{
 const{b,u}=make({skill:1,potential:5});const t=shield(b);u.skill.setSpTotal(0);
 let rolls=0;b.rng=()=>{rolls++;return .52;};b.dealDamage(null,t,{amount:100,type:'true'});near(u.skill.spTotal,1);assert.equal(rolls,1);
 b.rng=()=>.99;b.dealDamage(null,t,{amount:100,type:'true'});near(u.skill.spTotal,1);
 cast(u);b.rng=()=>0;b.dealDamage(null,t,{amount:100,type:'true'});near(u.skill.spTotal,0);
 const p1=make({skill:1});const s1=shield(p1.b);p1.u.skill.setSpTotal(0);p1.b.rng=()=>.52;
 p1.b.dealDamage(null,s1,{amount:100,type:'true'});near(p1.u.skill.spTotal,0);
 const e1=make({skill:1,elite:1});const s2=shield(e1.b);e1.u.skill.setSpTotal(0);e1.b.rng=()=>0;
 e1.b.dealDamage(null,s2,{amount:100,type:'true'});near(e1.u.skill.spTotal,0);
});
for(let rank=1;rank<=10;rank++)test(`S1 rank ${rank}: permanent owner buffs, shield DEF and one lifetime extension, no invented shield attacks`,()=>{
 const{b,u}=make({rank});const t=shield(b);advance(b,5);cast(u);advance(b,.4);
 near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));near(u.s.def,u.base.def*(1+u.skill.bb.def+.15));
 near(t.s.def,t.base.def*(1+u.skill.bb.def));near(t.mem.jessicaExpiry,50+u.skill.bb.duration);
 advance(b,1);near(t.mem.jessicaExpiry,50+u.skill.bb.duration);assert.equal(t.stats.attacks,0);
 advance(b,80);assert.equal(u.skill.active,true);assert.equal(t.alive,false);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank}: source BAT addition, physical/Arts dodge, single-target range and finite expiry`,()=>{
 const{b,u}=make({skill:1,rank});cast(u);advance(b,.2);
 near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));near(u.s.bat,u.base.bat+u.skill.bb.base_attack_time);
 near(u.s.dodgePhys,u.skill.bb.prob);near(u.s.dodgeArts,u.skill.bb.prob);
 enemy(b,{r:4,c:3});enemy(b,{r:4,c:3,fly:true});assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);
 advance(b,16);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);near(u.s.bat,u.base.bat);near(u.s.dodgePhys,0);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank ${rank}: source twenty-round stats, shield DEF, forward shell splash/stun without ammo expenditure`,()=>{
 const{b,u,hits}=make({skill:2,rank});const t=shield(b);const e=enemy(b,{c:4}),a=enemy(b,{r:4,c:4,fly:true}),far=enemy(b,{r:1,c:5});
 cast(u);advance(b,.9);assert.equal(u.skill.ammoLeft,20);
 near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));near(u.s.def,u.base.def*(1+.15+u.skill.bb['jesca2_s_3[def].def']));
 near(t.s.def,t.base.def*(1+u.skill.bb['jesca2_s_3_token[def].def']));near(u.s.bat,u.base.bat+u.skill.bb.base_attack_time);
 const impact=hits.filter(h=>h.dmg.tags.includes('jessica:shell'));assert.equal(impact.length,2);
 for(const h of impact)near(h.amount,u.s.atk*u.skill.bb['attack@extrabomb.atk_scale']);
 assert.ok(e.s.flags.stun);assert.ok(a.s.flags.stun);near(far.hp,100000);
 advance(b,1.5);fire(b,u,[e]);advance(b,.3);assert.equal(u.skill.ammoLeft,19);
 u.skill.end('manual');advance(b,.4);assert.equal(u.skill.active,false);near(t.s.def,t.base.def);assert.equal(t.alive,true);
});
test('S3 after activation: a new shield releases one empty-direction shell and does not spend a round',()=>{
 const{b,u,hits}=make({skill:2});cast(u);advance(b,.4);assert.equal(u.mem.jessicaShell,undefined);
 shield(b,4,2);advance(b,.2);assert.ok(u.mem.jessicaShell);assert.equal(u.skill.ammoLeft,20);
 advance(b,2);assert.equal(hits.length,0);assert.equal(u.mem.jessicaShell,null);assert.equal(u.skill.ammoLeft,20);
});
test('S3 shell stops at the first swept collision, explodes only once and preserves emitted shots after cancellation',()=>{
 const{b,u,hits}=make({skill:2});shield(b);const e=enemy(b,{c:3.8});cast(u);advance(b,.45);
 assert.ok(b.projectiles.list.some(p=>p.data?.jessica==='shell'));u.skill.end('manual');advance(b,1);
 assert.equal(hits.filter(h=>h.dmg.tags.includes('jessica:shell')).length,1);assert.ok(e.s.flags.stun);
 assert.equal(b.projectiles.list.some(p=>p.data?.jessica==='shell'),false);
});
test('S3 normal fire consumes twenty rounds then retains the last animation tail before ending',()=>{
 const{b,u,hits}=make({skill:2});const e=enemy(b,{c:3});cast(u);advance(b,.4);
 for(let i=0;i<20;i++){fire(b,u,[e]);advance(b,.15);}
 assert.equal(u.skill.ammoLeft,0);assert.equal(u.skill.active,true);assert.ok(u.findBuff('jessica:last-round'));
 advance(b,2);assert.equal(u.skill.active,false);assert.equal(hits.length,20);near(u.s.atk,u.base.atk);
});
test('shield withdrawal refunds two DP; owner removal removes shield/aura and redeployment resets facing/card state',()=>{
 const{b,u}=make();const t=shield(b,3,1),before=b.dp;retreatRegularSummon(b,summonUnitId(t));near(b.dp,before+2);
 near(u.s.def,u.base.def);advance(b,30.1);const next=shield(b,3,3);b.retreatOperator(ID);assert.equal(next.alive,false);
 advance(b,75);b.addDp('arkpedia',99);const reborn=b.deployOperator(ID,3,2,'UP');assert.ok(reborn);
 assert.equal(reborn.dir,'UP');assert.equal(regularSummonCards(b)[0].stock,1);
});


test('blocked back-to-down turns keep original Back clips until the facing wait finishes', () => {
 const {b,u}=make({skill:1,dir:'UP'});
 cast(u);advance(b,.2);
 u.blocking.push({alive:true,deployed:true});
 shield(b,2,2);advance(b,.15);
 assert.equal(u.dir,'DOWN');assert.equal(u.mem.regularVisualDirection,'UP');
 assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');
 assert.ok(evidence.models[ID].Back.durations[u.mem.regularFormVisual.clip]);
 u.blocking=[];advance(b,.15);
 assert.equal(u.mem.regularVisualDirection,'DOWN');
 assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');
 assert.ok(evidence.models[ID].Front.durations[u.mem.regularFormVisual.clip]);
});
