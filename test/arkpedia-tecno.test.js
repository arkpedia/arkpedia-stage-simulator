// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-tecno-prefabs.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {acquireTargets,effectiveProfile} from '../server/sim/ai.js';
import {regularTokenIdsFor,REGULAR_SUMMONS} from '../shared/arkpedia/summons.js';
const ID='char_4164_tecno',TOKEN='token_10042_tecno_puppet',ALLY='char_208_melan';
const near=(a,z,e=1e-5)=>assert.ok(Math.abs(a-z)<e,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,trust=0,level,dir='RIGHT'}={}){
 const d=structuredClone(data),o=d.operators[ID];d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const build={...defaultBuild(o),elite,level:level??o.phases[elite].maxLevel,trust,potential,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[ALLY])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.recordEvents=true;b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const deploy=(id=ID,r=5,c=5,f=dir)=>{b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,f);assert.ok(a);a.atkCd=1000;if(a.skill)a.skill.rule='NEVER';return a;};
 return {b,u:deploy(),deploy};
}
function enemy(b,{r=5,c=6,fly=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:100000,atk:100,def:0,res:50,moveSpeed:0});if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=100000;b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
const dancers=(b,u)=>b.allyUnits.filter(t=>t.defId===TOKEN&&t.ownerUnit===u&&t.alive&&t.deployed);
function puppet(b,u,r=5,c=6){b.kill(enemy(b,{r,c}),null);advance(b,.15);const t=dancers(b,u).find(t=>t.tileR===r&&t.tileC===c);assert.ok(t);u.atkCd=1000;t.atkCd=1000;return t;}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);u.atkCd=1000;}
function block(u,e){u.blocking.push(e);e.blockedBy=u;}

test('Tecno retains six native bundles,11 reachable templates,all20 ranks and a single original Puppet Dancer skeleton',()=>{
 assert.equal(evidence.source.bundles.length,6);assert.equal(Object.keys(evidence.templates).length,11);assert.equal(evidence.frameParity,false);assert.equal(evidence.moduleSupport,false);
 for(const s of data.operators[ID].skills)assert.deepEqual(s.levels.map(({rangeGrid,...v})=>v),evidence.tables.skills[s.id].levels);
 assert.deepEqual(regularTokenIdsFor([ID]),[TOKEN]);assert.equal(REGULAR_SUMMONS[ID],undefined);
 for(const face of ['Front','Back']){near(evidence.models[ID][face].hits.Attack[0],.633);near(evidence.models[ID][face].hits.Skill_2_Loop[0],.667);near(evidence.models[TOKEN][face].hits.Attack[0],.433);near(evidence.models[TOKEN][face].hits.Skill_2_Loop[0],.5);}
 assert.deepEqual(evidence.tokenArtwork.models[TOKEN].facings.front.originalPathIds,evidence.tokenArtwork.models[TOKEN].facings.back.originalPathIds);
});
test('all20 ranks preserve source costs,durations,self and dancer modifiers without copying owner ATK',()=>{
 for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,u}=make({skill,rank}),t=puppet(b,u),s=u.def.skill,bb=s.bb;cast(b,u);
  near(u.skill.timeLeft,s.duration);assert.equal(u.skill.spCost,data.operators[ID].skills[skill].levels[rank-1].spData.spCost);
  near(t.s.atk,t.base.atk);
  if(skill===0){near(u.s.atk,u.base.atk*(1+bb.atk));near(t.s.maxHp,t.base.maxHp*(1+bb.max_hp));near(t.s.def,t.base.def*(1+bb.def));near(t.s.blockCnt,1+bb.block_cnt);}
  else{near(u.s.aspd,100+bb.attack_speed);near(t.s.aspd,100+bb['tecno_s_2[token][mode].attack_speed']);assert.deepEqual(u.skill.spec.targeting.rangeGrid,s.rangeGrid);}
  const before=u.skill.spTotal;advance(b,1);near(u.skill.spTotal,before);assert.equal(u.skill.active,true);
 }
});
test('promotion caps2/3/5 recheck simultaneous queued deaths and never use DP or deployment slots',()=>{
 for(const[elite,cap]of[[0,2],[1,3],[2,5]]){const{b,u}=make({elite});const dp=b.dp;
  for(const[r,c]of[[5,6],[5,7],[6,6],[4,6],[6,7],[4,7]])b.kill(enemy(b,{r,c}));
  assert.equal(dancers(b,u).length,0);advance(b,.15);assert.equal(dancers(b,u).length,cap);near(b.dp,dp);assert.equal(b.deployedSlots(),1);assert.ok(dancers(b,u).every(t=>t.deploymentSlotCost===0));
 }
});
test('any-source ground deaths in current range spawn at corpse after .1; leaks,flyers,hidden,stealth,free and out of range do not',()=>{
 for(const mode of ['valid','fly','hidden','stealth','free','outside','leak']){const{b,u}=make();const e=enemy(b,{fly:mode==='fly',c:mode==='outside'?12:6});
  if(mode==='hidden')e.hidden=true;if(mode==='stealth')b.addBuff(e,{key:'stealth',flags:{stealth:true}});if(mode==='free')b.addBuff(e,{key:'free',flags:{untargetable:true}});
  if(mode==='leak')b._remove(e,'leak');else b.kill(e,null);advance(b,.05);assert.equal(dancers(b,u).length,0);advance(b,.1);assert.equal(dancers(b,u).length,mode==='valid'?1:0);
 }
});
test('corpse placement rejects occupied,high,ranged,unbuildable,obstacle and impassable tiles without moving to a neighbor',()=>{
 for(const mode of ['occupied','high','ranged','none','obstacle','impassable']){const{b,u,deploy}=make();const k=5*21+6;
  if(mode==='occupied')deploy(ALLY,5,6);if(mode==='high')b.grid.tiles[k].height='HIGH';if(mode==='ranged')b.grid.tiles[k].build='RANGED';if(mode==='none')b.grid.tiles[k].build='NONE';if(mode==='obstacle')b.grid.setObstacle(5,6,true);if(mode==='impassable')b.grid.tiles[k].pass='NONE';
  b.kill(enemy(b));advance(b,.2);assert.equal(dancers(b,u).length,0);
 }
});
test('Puppet Dancer stats interpolate its own phase/level and ignore owner trust,potential and stat buffs',()=>{
 for(const[elite,level]of[[0,1],[0,25],[1,35],[2,40],[2,80]]){const{b,u}=make({elite,level,trust:100,potential:6});b.addBuff(u,{key:'owner',mods:{atkPct:2,hpPct:2,defPct:2}});const t=puppet(b,u);const p=data.tokens[TOKEN].phases[elite],lo=p.attributesKeyFrames[0],hi=p.attributesKeyFrames.at(-1),ratio=(level-lo.level)/(hi.level-lo.level);
  for(const k of ['maxHp','atk','def'])near(t.base[k],Math.round(lo.data[k]+(hi.data[k]-lo.data[k])*ratio));near(t.s.res,20);near(t.base.bat,2.5);assert.deepEqual(t.def.talents,[]);
 }
});
test('normal Tecno attack is single-target Arts ground/air with .633 start selection and speed10 tracking',()=>{
 const{b,u}=make(),e=enemy(b,{fly:true}),z=enemy(b,{c:6.1});b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.6);near(e.hp,100000);advance(b,.1);near(e.hp,100000);advance(b,.15);near(e.hp,100000-u.s.atk*.5);near(z.hp,100000);
});
test('Tecno can attack enemies blocked by her dancer outside her own range and only one per attack',()=>{
 const{b,u}=make(),t=puppet(b,u);t.tileC=12;t.x=12;const e=enemy(b,{c:12}),z=enemy(b,{c:12.1});block(t,e);block(t,z);b._buildEnemyIndex();const p=effectiveProfile(u),targets=acquireTargets(b,u,p);assert.equal(targets.length,1);assert.equal(targets[0],e);b.forceAttack(u,targets);u.atkCd=1000;advance(b,1.6);assert.ok(e.hp<100000);near(z.hp,100000);
});
test('normal dancers cannot attack during original birth; afterwards only one blocked ground enemy takes Arts damage',()=>{
 const{b,u}=make(),t=puppet(b,u),e=enemy(b,{c:7}),f=enemy(b,{c:7,fly:true});assert.equal(t.mem.regularFormVisual.clip,'Start');block(t,e);block(t,f);t.atkCd=0;advance(b,.5);assert.equal(t.stats.attacks,0);near(e.hp,100000);t.blocking=[];e.blockedBy=null;f.blockedBy=null;advance(b,.6);t.atkCd=1000;u.atkCd=1000;e.x=6;f.x=6;b._buildEnemyIndex();block(t,e);block(t,f);const p=effectiveProfile(t);assert.deepEqual(acquireTargets(b,t,p),[e]);b.forceAttack(t,[e]);t.atkCd=1000;advance(b,.5);near(e.hp,100000-t.s.atk*.5);near(f.hp,100000);
});
test('native maxAnimScale1 preserves all normal/S2 hit clocks under fast ASPD and stretches slowdown',()=>{
 for(const skill of [0,1])for(const aspd of [-50,200]){const{b,u}=make({skill}),t=puppet(b,u);advance(b,1.1);t.atkCd=1000;u.atkCd=1000;if(skill)cast(b,u);b.addBuff(u,{key:'speed',mods:{aspd}});b.addBuff(t,{key:'speed',mods:{aspd}});const p=effectiveProfile(u),q=effectiveProfile(t);near(p.windup(b,u),(skill?.667:.633)/Math.min(1,u.base.bat/u.s.interval));near(q.windup(b,t),(skill?.5:.433)/Math.min(1,t.base.bat/t.s.interval));}
});
test('ordinary Medics cannot heal dancers; Tecno heals own injured dancer with source MAX_HP and skips modifiers/events',()=>{
 const{b,u}=make(),t=puppet(b,u);advance(b,1.1);u.atkCd=1000;t.atkCd=1000;t.hp=1;b.addBuff(u,{key:'healmod',mods:{hpMul:.2,healingDealtMul:3}});b.addBuff(t,{key:'healmod',mods:{healingTakenMul:3}});let hooks=0;b.on('heal',()=>hooks++);near(b.heal(u,t,100),0);const p=effectiveProfile(u);assert.deepEqual(acquireTargets(b,u,p),[t]);const amount=u.s.maxHp;b.forceAttack(u,[t]);u.atkCd=1000;advance(b,.7);near(t.hp,1+amount);assert.equal(hooks,0);near(u.stats.heal,amount);
});
test('healFree opt-in never admits unrelated tokens,operators,noHeal,isolation or untargetable recipients',()=>{
 const{b,u,deploy}=make(),t=puppet(b,u),a=deploy(ALLY,5,7);t.hp=1;a.hp=1;let p=effectiveProfile(u);p={...p,acquireTargets:()=>[a,t]};assert.deepEqual(acquireTargets(b,u,p),[a,t]);b.addBuff(a,{key:'free',flags:{healFree:true}});assert.deepEqual(acquireTargets(b,u,p),[t]);
 for(const flag of ['noHeal','isolated','untargetable']){b.addBuff(t,{key:'gate',flags:{[flag]:true}});assert.deepEqual(acquireTargets(b,u,p),[]);b.removeBuff(t,'gate');}
 assert.deepEqual(acquireTargets(b,u,{...p,heal:null}),[]);
});
test('at cap eligible death heals one dancer immediately; excess queued corpse rechecks cap and heals instead',()=>{
 for(const queued of [false,true]){const{b,u}=make({elite:0});const t=puppet(b,u,5,6);if(!queued)puppet(b,u,5,7);t.hp=1;
  if(queued){b.kill(enemy(b,{r:6,c:6}));b.kill(enemy(b,{r:4,c:6}));}else b.kill(enemy(b,{r:6,c:6}));
  if(!queued)near(t.hp,t.s.maxHp);advance(b,.2);assert.equal(dancers(b,u).length,2);near(t.hp,t.s.maxHp);
 }
});
test('S1 also buffs newly born dancers and restores original HP/DEF/block when ending',()=>{
 const{b,u}=make();cast(b,u);const t=puppet(b,u);near(t.s.blockCnt,2);near(t.s.maxHp,t.base.maxHp*1.5);near(t.s.def,t.base.def*2);u.skill.end('test');near(t.s.blockCnt,1);near(t.s.maxHp,t.base.maxHp);near(t.s.def,t.base.def);assert.equal(t.alive,true);
});
test('S2 dancers use host enlarged range, hit flyers by speed10 projectile and use original Skill_2_Loop .5 hit',()=>{
 const{b,u}=make({skill:1}),t=puppet(b,u);advance(b,1.1);t.atkCd=1000;cast(b,u);const e=enemy(b,{c:8,fly:true}),z=enemy(b,{c:8.1});assert.ok(!t.rangeKeySet.has(5*21+8));const p=effectiveProfile(t);assert.deepEqual(acquireTargets(b,t,p),[e]);assert.equal(p.attackVisual(b,t),'Skill_2_Loop');b.forceAttack(t,[e]);t.atkCd=1000;advance(b,.45);near(e.hp,100000);advance(b,.4);near(e.hp,100000-t.s.atk*.5);near(z.hp,100000);
});
test('S2 end rebuilds only survivors at closest legal tiles, with full HP,fresh identities,zero DP/slots and .1 sequencing',()=>{
 const{b,u}=make({skill:1});const a=puppet(b,u,5,7),z=puppet(b,u,6,6),dead=puppet(b,u,4,6);advance(b,1.1);u.atkCd=1000;cast(b,u);b.kill(dead);a.hp=1;z.hp=2;const dp=b.dp;u.skill.end('test');assert.equal(a.alive,false);assert.equal(z.alive,false);assert.equal(dancers(b,u).length,1);advance(b,.15);const ts=dancers(b,u);assert.equal(ts.length,2);assert.ok(ts.every(t=>Math.abs(t.tileR-5)+Math.abs(t.tileC-5)===1));assert.ok(ts.every(t=>t.hp===t.s.maxHp&&t.s.aspd===100&&t!==a&&t!==z));near(b.dp,dp);assert.equal(b.deployedSlots(),1);
});
test('S2 relocation no-space consumes attempts without illegal spawns or infinite retries',()=>{
 const{b,u}=make({skill:1}),a=puppet(b,u,5,7),z=puppet(b,u,6,6);cast(b,u);b.grid.tiles=b.grid.tiles.map(t=>({...t,build:'NONE'}));u.skill.end('test');advance(b,1);assert.equal(a.alive,false);assert.equal(z.alive,false);assert.equal(dancers(b,u).length,0);b.grid.tiles=b.grid.tiles.map(t=>({...t,build:'ALL'}));advance(b,1);assert.equal(dancers(b,u).length,0);
});
test('owner death/retreat removes unborn dancers and cancels pending corpses/relocations',()=>{
 for(const mode of ['corpse','born','relocate'])for(const reason of ['death','retreat']){const{b,u}=make({skill:1});if(mode==='corpse')b.kill(enemy(b));else{puppet(b,u,5,7);puppet(b,u,6,6);if(mode==='relocate'){cast(b,u);u.skill.end('test');}}
  if(reason==='death')b.kill(u);else b.retreatOperator(ID);advance(b,2);assert.equal(dancers(b,u).length,0);
 }
});
test('unfired attacks cancel on brief control or S2 mode change, but launched projectile survives owner retreat',()=>{
 for(const mode of ['control','skill','retreat']){const{b,u}=make({skill:1}),e=enemy(b);b.forceAttack(u,[e]);u.atkCd=1000;if(mode==='control')b.applyStatus(u,'stun',{duration:b.dt/4});if(mode==='skill')cast(b,u);if(mode==='retreat'){advance(b,.65);assert.equal(b.projectiles.list.length,1);b.retreatOperator(ID);}advance(b,.4);near(e.hp,mode==='retreat'?100000-u.s.atk*.5:100000);}
});
test('S1 mode switch does not cancel an unfired normal attack, and live ATK buff applies at impact',()=>{
 const{b,u}=make(),e=enemy(b);b.forceAttack(u,[e]);u.atkCd=1000;cast(b,u);advance(b,1);near(e.hp,100000-u.s.atk*.5);
});
