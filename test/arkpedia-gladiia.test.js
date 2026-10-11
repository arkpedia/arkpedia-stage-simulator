// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-gladiia-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID='char_474_glady';
const near=(a,z,tol=1e-5)=>assert.ok(Math.abs(a-z)<tol,`${a} != ${z}`);
function advance(b,t){const until=b.time+t;while(b.time<until-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',others=[]}={}){
 const d=structuredClone(data),o=d.operators[ID];d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(o),elite,potential,level:o.phases[elite].maxLevel,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(d,{operators:[build,...others.map(id=>defaultBuild(d.operators[id]))]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.addDp('arkpedia',99);
 const u=b.deployOperator(ID,3,4,dir);assert.ok(u);u.atkCd=1000;u.profile.canAttack=()=>false;u.skill.rule='NEVER';
 const hits=[];b.on('damaged',c=>hits.push({...c,time:b.time}));advance(b,1.1);return{b,u,hits};
}
function enemy(b,{x=6,y=3,hp=100000,def=300,res=0,mass=10,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:hp,def,res,massLevel:mass,moveSpeed:0,atk:0});e.markDirty();void e.s;e.hp=hp;
 e.def={...e.def,immune:new Set(e.def.immune)};if(fly)e.motion='FLY';b.addBuff(e,{key:'test:quiet',flags:{disarm:true}});b._buildEnemyIndex();return e;
}
function cast(u){u.skill.setSpTotal(u.skill.spCost*u.skill.maxCharges);assert.equal(u.skill.activate('test'),true);}
function shot(b,u){const p=effectiveProfile(u),es=acquireTargets(b,u,p);assert.ok(es.length);performAttack(b,u,p,es);u.atkCd=1000;}
const own=(hits,u)=>hits.filter(h=>h.source===u);
const bbFor=(n,rank)=>Object.fromEntries(source.tables.skills[`skchr_glady_${n}`].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
for(let rank=1;rank<=10;rank++)test(`S1 rank ${rank}: one charged hook, source damage and force`,()=>{
 const{b,u,hits}=make({rank}),bb=bbFor(1,rank),e=enemy(b),nearer=enemy(b,{x:5});const pulls=[];
 const pull=b.pullToFront.bind(b);b.pullToFront=(target,unit,force)=>{pulls.push({target,force});return pull(target,unit,force);};
 cast(u);assert.equal(u.skill.maxCharges,bb.cnt);assert.equal(u.skill.manual,false);shot(b,u);advance(b,.3);assert.equal(own(hits,u).length,0);
 advance(b,.4);assert.equal(own(hits,u).length,1);assert.equal(own(hits,u)[0].target,e);near(own(hits,u)[0].amount,u.s.atk*bb.atk_scale-300);
 near(nearer.hp,nearer.s.maxHp);assert.equal(pulls[0].force,bb.force);assert.equal(u.skill.charges,bb.cnt-1);const sp=u.skill.spTotal;
 advance(b,1);near(u.skill.spTotal,sp);advance(b,2);assert.ok(u.mem.gladiiaCast==null);assert.ok(u.skill.spTotal>sp);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank}: timed two-target hook, blocked priority and extended range`,()=>{
 const{b,u,hits}=make({skill:1,rank,others:['char_208_melan']}),bb=bbFor(2,rank),a=enemy(b,{x:7,y:4}),blocked=enemy(b,{x:7,y:2}),other=enemy(b,{x:5,y:3});
 b.addDp('arkpedia',99);const blocker=b.deployOperator('char_208_melan',2,6,'RIGHT');blocker.profile.canAttack=()=>false;blocked.blockedBy=blocker;blocker.blocking.push(blocked);const forces=[];b.pullToFront=(e,_u,f)=>{forces.push(f);return 0;};
 cast(u);near(u.s.interval,u.base.bat+.5);assert.deepEqual(u.liveRangeGrid,u.def.skill.rangeGrid);advance(b,.6);assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],blocked);shot(b,u);advance(b,.8);
 const hs=own(hits,u);assert.equal(hs.length,2);assert.ok(hs.some(h=>h.target===blocked));assert.equal(hs.some(h=>h.target===a)||hs.some(h=>h.target===other),true);
 for(const h of hs)near(h.amount,u.s.atk*bb['attack@atk_scale']-300);assert.deepEqual(forces,[bb['attack@force'],bb['attack@force']]);
 advance(b,20);assert.equal(u.skill.active,false);assert.deepEqual(u.liveRangeGrid,u.def.rangeGrid);assert.ok(u.mem.gladiiaCast==null);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank ${rank}: six immediate/1.5s Arts pulses, fixed center and zero-damage final hook`,()=>{
 const{b,u,hits}=make({skill:2,rank}),bb=bbFor(3,rank),main=enemy(b,{x:7}),nearby=enemy(b,{x:6.5,y:4}),outside=enemy(b,{x:5});
 const forces=[];b.pull=(e,f,opts)=>{forces.push({e,f,opts});return 0;};b.pullToFront=(e,_u,f)=>{forces.push({e,f,final:true});return 0;};
 cast(u);const start=b.time;advance(b,.5);const center=u.mem.gladiiaCast.center;assert.deepEqual(center,{x:7,y:3});assert.ok(main.s.flags.bind);near(nearby.s.moveSpeed,0);
 advance(b,8);assert.equal(own(hits,u).filter(h=>h.target===main).length,6);assert.equal(own(hits,u).filter(h=>h.target===nearby).length,6);
 near(outside.hp,outside.s.maxHp);const hs=own(hits,u).filter(h=>h.target===main);for(const h of hs)near(h.amount,u.s.atk*bb.atk_scale);
 near(hs[0].time-start,.4,.04);for(let i=1;i<hs.length;i++)near(hs[i].time-hs[i-1].time,1.5,.04);
 advance(b,4);assert.equal(own(hits,u).length,12);assert.ok(forces.some(f=>f.final&&f.e===main&&f.f===bb['attack@force']));
 assert.equal(u.skill.active,false);assert.ok(u.mem.gladiiaCast==null);assert.equal(!!main.s.flags.bind,false);
});
test('whirlpool retains its center after the main enemy dies and admits later enemies',()=>{
 const{b,u,hits}=make({skill:2}),main=enemy(b,{x:7,hp:100});b.pull=()=>0;cast(u);advance(b,.5);assert.equal(main.alive,false);
 const newcomer=enemy(b,{x:7,y:4});advance(b,1.6);assert.ok(own(hits,u).some(h=>h.target===newcomer));assert.deepEqual(u.mem.gladiiaCast.center,{x:7,y:3});
});
test('S3 refuses an empty or untargetable range without spending SP',()=>{
 const{b,u}=make({skill:2});u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),false);near(u.skill.spTotal,u.skill.spCost);
 const e=enemy(b);b.addBuff(e,{key:'test:hidden',flags:{stealth:true}});assert.equal(u.skill.activate('test'),false);near(u.skill.spTotal,u.skill.spCost);
});
for(const cancel of ['stun','retreat'])test(`${cancel} tears down all whirlpool jobs and owned bind`,()=>{
 const{b,u,hits}=make({skill:2}),e=enemy(b,{x:7});cast(u);advance(b,.5);assert.ok(e.s.flags.bind);
 if(cancel==='stun')b.applyStatus(u,'stun',{duration:.2});else b.retreatOperator(ID);
 advance(b,.1);const count=own(hits,u).length;assert.ok(u.mem.gladiiaCast==null);assert.equal(!!e.s.flags.bind,false);advance(b,15);assert.equal(own(hits,u).length,count);
});
test('S1 does not lose another charge or deal delayed damage when stunned during windup',()=>{
 const{b,u,hits}=make();enemy(b);cast(u);shot(b,u);b.applyStatus(u,'stun',{duration:.2});advance(b,4);assert.equal(own(hits,u).length,0);assert.equal(u.skill.charges,2);
});
for(const [elite,potential,scale]of[[1,1,1],[2,1,1.3],[2,5,1.36]])test(`Survival E${elite}/P${potential} scales before mitigation at mass 3, not mass 4`,()=>{
 const{b,u,hits}=make({elite,potential}),light=enemy(b,{mass:3}),heavy=enemy(b,{x:5,mass:4});
 b.dealDamage(u,light,{amount:1000,type:'phys'});b.dealDamage(u,heavy,{amount:1000,type:'phys'});near(own(hits,u)[0].amount,1000*scale-300);near(own(hits,u)[1].amount,700);
});
test('Waves heals Abyssal recipients deployed later and cuts only Sea Monster physical/Arts damage',()=>{
 const{b,u}=make({others:['char_263_skadi','char_208_melan']});b.addDp('arkpedia',99);const ally=b.deployOperator('char_263_skadi',2,3,'RIGHT'),other=b.deployOperator('char_208_melan',2,5,'RIGHT');
 ally.profile.canAttack=()=>false;other.profile.canAttack=()=>false;advance(b,1.1);near(ally.s.hpRegen,ally.s.maxHp*.025);near(other.s.hpRegen,0);
 const e=enemy(b);e.tags.add('seamonster');const hp=ally.hp;b.dealDamage(e,ally,{amount:100,type:'arts'});near(hp-ally.hp,75);
 const hp2=ally.hp;b.dealDamage(e,ally,{amount:100,type:'true'});near(hp2-ally.hp,100);
 e.tags.delete('seamonster');const hp3=ally.hp;b.dealDamage(e,ally,{amount:100,type:'arts'});near(hp3-ally.hp,100);
 b.retreatOperator(ID);near(ally.s.hpRegen,0);assert.equal(u.alive,false);
});
test('S1 original facings expose .333 hook and .567 normal attack events; no invented down clips',()=>{
 for(const face of ['Front','Back']){near(source.models[ID][face].hits.Skill_1_Begin[0],.333,.001);near(source.models[ID][face].hits.Attack[0],.567,.001);}
 assert.equal(source.source.bundles.length,5);assert.equal(Object.keys(source.templates).length,6);assert.equal(source.frameParity,false);assert.equal(source.moduleSupport,false);assert.equal(source.nativeParticleSupport,false);
});
for(const dir of ['RIGHT','LEFT','UP','DOWN'])test(`${dir}: ordinary one-target original hit and air targeting`,()=>{
 const{b,u,hits}=make({dir}),e=enemy(b,{x:dir==='RIGHT'?5:dir==='LEFT'?3:4,y:dir==='UP'?4:dir==='DOWN'?2:3,fly:true});
 shot(b,u);advance(b,.5);assert.equal(own(hits,u).length,0);advance(b,.3);assert.equal(own(hits,u).length,1);assert.equal(own(hits,u)[0].target,e);
});
test('S1 pull applies on a dodged physical hit and force changes movement with enemy weight',()=>{
 for(const mass of [0,3,10]){
  const{b,u,hits}=make(),e=enemy(b,{mass});b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});const x=e.x;
  cast(u);shot(b,u);advance(b,.8);near(e.hp,e.s.maxHp);assert.equal(own(hits,u).length,0);
  if(mass<10)assert.ok(e.x<x);else near(e.x,x);
 }
});
test('S3 can bind a shift-immune target and still applies Arts damage',()=>{
 const{b,u,hits}=make({skill:2}),e=enemy(b,{x:7});b.addBuff(e,{key:'test:shift-immune',flags:{noDisplace:true}});const x=e.x;cast(u);advance(b,.5);
 assert.equal(!!e.s.flags.bind,true);near(e.x,x);assert.equal(own(hits,u).length,1);
});
test('later whirlpool pulses sample current occupants rather than retaining the first area group',()=>{
 const{b,u,hits}=make({skill:2}),main=enemy(b,{x:7}),leaving=enemy(b,{x:6.5,y:4}),incoming=enemy(b,{x:5});b.pull=()=>0;
 cast(u);advance(b,.5);leaving.x=4;incoming.x=7;b._buildEnemyIndex();advance(b,1.5);
 assert.equal(own(hits,u).filter(h=>h.target===leaving).length,1);assert.equal(own(hits,u).filter(h=>h.target===incoming).length,1);assert.ok(main.alive);
});
for(const elite of [0,1,2])test(`E${elite} selects the source self-recovery tier`,()=>{
 const{u}=make({elite});near(u.s.hpRegen,u.s.maxHp*[0,.015,.025][elite]);
});
test('S3 weight talent scales the Arts receipt before RES, including its periodic projectile',()=>{
 const{b,u,hits}=make({skill:2,potential:5}),e=enemy(b,{x:7,mass:3,res:50});b.pull=()=>0;cast(u);advance(b,.5);
 near(own(hits,u)[0].amount,u.s.atk*1.3*1.36*.5);assert.equal(own(hits,u)[0].target,e);
});
test('S2 interrupted in a linked cast removes pending damage and returns to its timed stance',()=>{
 const{b,u,hits}=make({skill:1});enemy(b);cast(u);advance(b,.6);shot(b,u);advance(b,.5);
 b.applyStatus(u,'stun',{duration:.2});advance(b,.2);assert.ok(u.mem.gladiiaCast==null);assert.equal(u.skill.active,true);
 const n=own(hits,u).length;advance(b,1);assert.equal(own(hits,u).length,n);
});

test('source trait allows both ground and raised deployment tiles',()=>{
 const{b}=make();b.retreatOperator(ID);advance(b,b.bench[ID].readyAt-b.time+1);b.addDp('arkpedia',99);
 b.grid.tiles[b.grid.key(2,6)]={...b.grid.tile(2,6),build:'RANGED'};
 assert.equal(b.grid.tile(2,6).build,'RANGED');assert.equal(b.placementError(ID,2,6),null);
 const u=b.deployOperator(ID,2,6,'UP');assert.ok(u);advance(b,1.1);assert.deepEqual(b.errors,[]);
});
test('whirlpool HUD counts down its actual field and stays at zero through the finishing hook',()=>{
 const{b,u}=make({skill:2});enemy(b,{x:7});b.pull=()=>0;cast(u);
 near(skillHud(u.skill).fraction,1);advance(b,.5);assert.ok(skillHud(u.skill).fraction<1);
 advance(b,4);assert.ok(skillHud(u.skill).fraction<.6);advance(b,5);
 assert.equal(u.skill.active,true);assert.equal(skillHud(u.skill).fraction,0);
 advance(b,4);assert.equal(u.skill.active,false);assert.equal(skillHud(u.skill).state,'charging');
});
