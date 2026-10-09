// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-ascalon-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID = 'char_4132_ascln';
const near = (a,z,tol=1e-5) => assert.ok(Math.abs(a-z)<tol,`${a} != ${z}`);
function advance(b,t) { const until=b.time+t; while(b.time<until-1e-9)b.step(); assert.deepEqual(b.errors,[]); }
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',high=false,others=[]}={}) {
 const d=structuredClone(data),o=d.operators[ID];d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(o),elite,potential,level:o.phases[elite].maxLevel,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(d,{operators:[build,...others.map(id=>defaultBuild(d.operators[id]))]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 if(high)b.grid.tile(4,4).height='HIGH';b.addDp('arkpedia',99);const u=b.deployOperator(ID,3,4,dir);assert.ok(u);
 u.atkCd=1000;u.profile.canAttack=()=>false;u.skill.rule='NEVER';const hits=[];b.on('damaged',c=>hits.push({...c,time:b.time}));advance(b,1.1);return{b,u,hits};
}
function enemy(b,{x=5,y=3,hp=100000,def=0,res=0,fly=false,speed=1}={}) {
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:hp,def,res,moveSpeed:speed,atk:0});e.markDirty();void e.s;e.hp=hp;
 e.def={...e.def,immune:new Set(e.def.immune)};if(fly)e.motion='FLY';b.addBuff(e,{key:'test:quiet',flags:{disarm:true,noMove:true}});b._buildEnemyIndex();return e;
}
function cast(u) { u.skill.setSpTotal(u.skill.spCost*u.skill.maxCharges);assert.equal(u.skill.activate('test'),true); }
function shot(b,u) { const p=effectiveProfile(u),es=acquireTargets(b,u,p);assert.ok(es.length);performAttack(b,u,p,es);u.atkCd=1000; }
const own=(hs,u)=>hs.filter(h=>h.source===u);
const direct=(hs,u)=>own(hs,u).filter(h=>h.dmg.isAttack);
const pois=(u,e)=>e.findBuff(`ascalon:poison:${u.id}`);
const aura=(u,e)=>e.findBuff(`ascalon:aura:${u.id}`);
const bbFor=(n,rank)=>Object.fromEntries(source.tables.skills[`skchr_ascln_${n}`].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
for(let rank=1;rank<=10;rank++)test(`S1 rank ${rank}: two retained original hit events, one charge and linear poison stacks`,()=>{
 const{b,u,hits}=make({rank}),bb=bbFor(1,rank),e=enemy(b),other=enemy(b,{x:4,y:4}),air=enemy(b,{fly:true});
 cast(u);assert.equal(u.skill.maxCharges,bb.cnt);assert.equal(u.skill.manual,false);shot(b,u);
 advance(b,.69);assert.equal(direct(hits,u).length,0);advance(b,.05);assert.equal(direct(hits,u).length,2);assert.equal(pois(u,e).ascalonStacks,1);
 const later=enemy(b,{x:4,y:2});advance(b,.24);assert.equal(direct(hits,u).length,4);assert.equal(pois(u,e).ascalonStacks,2);
 assert.equal(pois(u,other).ascalonStacks,2);assert.equal(pois(u,later),null);assert.equal(pois(u,air),null);
 for(const h of direct(hits,u))near(h.amount,u.s.atk*bb.atk_scale);assert.equal(u.skill.charges,bb.cnt-1);
 const sp=u.skill.spTotal;advance(b,.45);near(u.skill.spTotal,sp);advance(b,.25);assert.ok(u.mem.ascalonS1==null);assert.ok(u.skill.spTotal>sp);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank}: timed ATK, all-motion slow and ground-only 1.3-tile death spread`,()=>{
 const{b,u,hits}=make({skill:1,rank}),bb=bbFor(2,rank),a=enemy(b,{x:5.9}),air=enemy(b,{x:5.9,fly:true}),nearby=enemy(b,{x:7}),far=enemy(b,{x:7.3}),ground=enemy(b);
 cast(u);near(u.s.atk,u.base.atk*(1+bb.atk));near(a.s.moveSpeed,1+bb.move_speed);near(air.s.moveSpeed,1+bb.move_speed);near(nearby.s.moveSpeed,1);
 b.kill(a,null);assert.equal(pois(u,nearby).ascalonStacks,1);assert.equal(pois(u,far),null);assert.equal(pois(u,air),null);
 b.kill(air,null);assert.equal(pois(u,far),null);shot(b,u);advance(b,1);for(const h of direct(hits,u))near(h.amount,u.s.atk);
 advance(b,36);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);assert.equal(aura(u,ground),null);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank ${rank}: original begin, expanded ground aura, hit-rate reduction and miss healing`,()=>{
 const{b,u}=make({skill:2,rank}),bb=bbFor(3,rank),e=enemy(b,{x:6}),air=enemy(b,{x:6,fly:true});
 cast(u);assert.equal(u.mem.regularFormVisual.clip,'Skill_3_Begin');near(u.s.atk,u.base.atk);near(e.s.hitRatePhys,1);
 advance(b,.51);near(u.s.atk,u.base.atk*(1+bb.atk));near(u.s.bat,u.base.bat+bb.base_attack_time);near(u.s.taunt,1);
 near(e.s.hitRatePhys,1+bb['attack@damage_hitrate_physical']);near(e.s.hitRateArts,1+bb['attack@damage_hitrate_magical']);near(air.s.hitRatePhys,1);
 const rolls=[];b.rng=()=>{rolls.push(1);return .99;};u.hp=u.s.maxHp/2;
 const hp=u.hp;b.dealDamage(e,u,{amount:100,type:'phys',isAttack:true});near(u.hp-hp,u.s.maxHp*bb['attack@hp_ratio']);assert.equal(rolls.length,1);
 advance(b,46);assert.equal(u.skill.active,false);near(e.s.hitRatePhys,1);near(u.s.atk,u.base.atk);near(u.s.taunt,-1);
});
for(const [elite,slow,ratio,duration] of [[0,.12,.06,18],[1,.15,.08,18],[2,.18,.1,25]])test(`E${elite}: poison reads current ATK, refreshes full lifetime and preserves its tick clock`,()=>{
 const{b,u,hits}=make({elite}),e=enemy(b);b.dealDamage(u,e,{amount:1,type:'phys',isAttack:true});advance(b,.4);
 b.dealDamage(u,e,{amount:1,type:'phys',isAttack:true});near(pois(u,e).timeLeft,duration);near(e.s.moveSpeed,1-2*slow);
 b.addBuff(u,{key:'test:atk',mods:{atkPct:1}});advance(b,.65);const ticks=own(hits,u).filter(h=>h.dmg.tags.includes('ascalon:poison'));assert.equal(ticks.length,1);near(ticks[0].amount,u.s.atk*ratio*2);
 for(let i=0;i<4;i++)b.dealDamage(u,e,{amount:1,type:'phys',isAttack:true});assert.equal(pois(u,e).ascalonStacks,3);near(e.s.moveSpeed,1-3*slow);
 b.retreatOperator(ID);assert.equal(pois(u,e),null);near(e.s.moveSpeed,1);const n=hits.length;advance(b,2);assert.equal(hits.length,n);
});
for(const [potential,high,aspd] of [[1,false,108],[1,true,114],[5,false,110],[5,true,116]])test(`P${potential}, adjacent high tile ${high}: deployment ASPD snapshot`,()=>{
 const{b,u}=make({potential,high});near(u.s.aspd,aspd);b.grid.tile(4,4).height=high?'LOW':'HIGH';advance(b,.2);near(u.s.aspd,aspd);
});
test('no adjacent-high talent at E0/E1 and diagonal high tiles do not count',()=>{
 for(const elite of [0,1]){const{u}=make({elite,high:true});near(u.s.aspd,100);}
 const{b,u}=make();b.grid.tile(4,5).height='HIGH';advance(b,.1);near(u.s.aspd,108);
});
for(const dir of ['RIGHT','LEFT','UP','DOWN'])test(`${dir}: zero-block stalker attacks every ground target at the original event`,()=>{
 const{b,u,hits}=make({dir}),a=enemy(b),z=enemy(b,{x:4,y:4}),air=enemy(b,{fly:true});shot(b,u);advance(b,.69);assert.equal(direct(hits,u).length,0);
 advance(b,.05);assert.equal(direct(hits,u).length,2);assert.ok(direct(hits,u).some(h=>h.target===a));assert.ok(direct(hits,u).some(h=>h.target===z));near(air.hp,air.s.maxHp);near(u.s.blockCnt,0);
});
for(const interruption of ['stun','retreat','death'])test(`S1 ${interruption} between original hits cancels the second hit and tail`,()=>{
 const{b,u,hits}=make(),e=enemy(b);cast(u);shot(b,u);advance(b,.74);assert.equal(direct(hits,u).length,1);
 if(interruption==='stun')b.applyStatus(u,'stun',{duration:.1});else if(interruption==='death')b.kill(u);else b.retreatOperator(ID);
 advance(b,.4);assert.equal(direct(hits,u).length,1);assert.ok(u.mem.ascalonS1==null);assert.equal(u.findBuff('ascalon:s1-lock'),null);assert.ok(e);
});
test('S1 refunds an input lost before its first event, but does not refund a lethal first strike',()=>{
 for(const lethal of [false,true]){const{b,u}=make(),e=enemy(b,{hp:lethal?1:100000});cast(u);shot(b,u);if(!lethal)b.kill(e);advance(b,1.55);near(u.skill.spTotal,(lethal?2:3)*u.skill.spCost+.06,.06);}
});
test('poison is non-missable and not blocked by invisibility or owner stun; it cannot recursively stack itself',()=>{
 const{b,u,hits}=make(),e=enemy(b);b.dealDamage(u,e,{amount:1,type:'phys',isAttack:true});b.addBuff(e,{key:'test:evade',mods:{dodgeArts:1},flags:{stealth:true}});b.applyStatus(u,'stun',{duration:2});advance(b,1.1);
 assert.equal(pois(u,e).ascalonStacks,1);assert.equal(own(hits,u).filter(h=>h.dmg.tags.includes('ascalon:poison')).length,1);
});
test('native output modifier attaches poison even when the direct Physical strike is dodged',()=>{
 const{b,u,hits}=make(),e=enemy(b);b.addBuff(e,{key:'test:evade',mods:{dodgePhys:1}});b.dealDamage(u,e,{amount:100,type:'phys',isAttack:true});assert.equal(direct(hits,u).length,0);assert.equal(pois(u,e).ascalonStacks,1);
});
test('S2 slow composes with linear poison and is removed immediately on leaving or ending the aura',()=>{
 const{b,u}=make({skill:1}),e=enemy(b);cast(u);for(let i=0;i<3;i++)b.dealDamage(u,e,{amount:1,type:'phys',isAttack:true});near(e.s.moveSpeed,.46*.4);
 e.x=7;b._buildEnemyIndex();advance(b,.02);near(e.s.moveSpeed,.46);assert.equal(aura(u,e),null);
 e.x=5;b._buildEnemyIndex();advance(b,.02);near(e.s.moveSpeed,.46*.4);u.skill.end('test');near(e.s.moveSpeed,.46);
});
test('ground death outside the S2 aura does not spread and a poison kill inside it does',()=>{
 const{b,u}=make({skill:1}),outside=enemy(b,{x:7}),far=enemy(b,{x:7.5});cast(u);b.kill(outside);assert.equal(pois(u,far),null);
 const inside=enemy(b,{x:5,hp:5}),nearby=enemy(b,{x:6.2});b.dealDamage(u,inside,{amount:1,type:'phys',isAttack:true});advance(b,1.1);assert.equal(inside.alive,false);assert.equal(pois(u,nearby).ascalonStacks,1);
});
test('S3 miss affects a different ally too, without healing Ascalon; her independent dodge heals once',()=>{
 const{b,u}=make({skill:2,others:['char_208_melan']}),e=enemy(b);b.addDp('arkpedia',99);const other=b.deployOperator('char_208_melan',2,4,'RIGHT');other.profile.canAttack=()=>false;
 cast(u);advance(b,.51);u.hp=u.s.maxHp/2;let rolls=0;b.rng=()=>{rolls++;return .9;};const hp=u.hp,ohp=other.hp;b.dealDamage(e,other,{amount:100,type:'arts'});near(other.hp,ohp);near(u.hp,hp);assert.equal(rolls,1);
 b.rng=()=>{rolls++;return .1;};b.dealDamage(e,u,{amount:100,type:'arts'});near(u.hp-hp,u.s.maxHp*.08);assert.equal(rolls,3);
});
test('S3 poison, true damage, HP loss and heal prohibition do not trigger recovery',()=>{
 const{b,u}=make({skill:2}),e=enemy(b);cast(u);advance(b,.51);b.rng=()=>.99;u.hp=u.s.maxHp/2;
 const hp=u.hp;b.dealDamage(e,u,{amount:100,type:'true'});near(u.hp,hp-100);b.dealDamage(e,u,{amount:100,type:'arts',canDodge:false});near(u.hp,hp-170);
 b.addBuff(u,{key:'test:no-heal',flags:{healFree:true}});const before=u.hp;b.dealDamage(e,u,{amount:100,type:'phys'});near(u.hp,before);
});
test('S3 countdown excludes its original .5-second begin and native end mix adds no SP lock',()=>{
 const{b,u}=make({skill:2});enemy(b);cast(u);const hud=()=>skillHud(u.skill);
 assert.ok(hud());advance(b,.51);near(u.skill.timeLeft,45,.04);advance(b,44.8);assert.equal(u.skill.active,true);advance(b,.25);assert.equal(u.skill.active,false);assert.equal(u.mem.regularFormVisual.clip,'Skill_3_End');
 assert.equal(!!u.s.flags.noSp,false);advance(b,.5);assert.equal(u.mem.regularFormVisual,null);
});
test('source evidence includes all native components, eight reachable templates and exact original facings',()=>{
 assert.equal(source.source.bundles.length,5);assert.equal(Object.keys(source.templates).length,8);assert.equal(source.frameParity,false);assert.equal(source.moduleSupport,false);assert.equal(source.nativeParticleSupport,false);
 for(const f of ['Front','Back']){assert.deepEqual(source.models[ID][f].hits.Skill_1,[.7,.967]);near(source.models[ID][f].durations.Skill_3_Begin,.5);}
});
