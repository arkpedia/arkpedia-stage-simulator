// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type:'json' };
import e from '../data/arkpedia-wisadel-prefabs.json' with { type:'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { WISADEL_ID as ID, selectedWisadelBuild } from '../server/sim/content/arkpedia-wisadel-attacks.js';
import { WISADEL_S2_CONTRACT as CONTRACT,prepareWisadelS2 } from '../server/sim/content/arkpedia-wisadel-s2.js';
import { WISADEL_AFTERIMAGE as MARK } from '../server/sim/content/arkpedia-wisadel-projectiles.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps, `${a} != ${z}`);
function advance(b,s) { for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++) b.step(); assert.deepEqual(b.errors,[]); }
function until(f,p,s=12) { const end=f.b.time+s; while(!p()&&f.b.time<end) advance(f.b,f.b.dt);
  assert.ok(p(),`Expected condition at ${f.b.time}, phase ${f.controller.phase?.kind}`); }
function make({rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=2,dir='RIGHT',defer=false,battle=null,contract=CONTRACT}={}) {
  const d=structuredClone(data); d.stage.geometry.waves[0].spawns=[]; d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19; d.stage.geometry.cols=21;
  d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const b=battle??new StandardBattle(d,{operators:[defaultBuild(d.operators.char_289_gyuki)]});
  b.rng=()=>.99; b.autoFinish=false; b.recordEvents=true; b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const build={elite,level,potential,trust,skillId:`skchr_wisdel_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedWisadelBuild(build), c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,
    subProfessionId:c.subProfessionId,position:c.position,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',5,5,{dir});
  const prepared=prepareWisadelS2(b,u,{contract}); b._setupUnit(u,prepared.kit); prepared.controller.install();
  const deploy=()=>{assert.ok(b._deploy(u,{initial:false})); b.getPlayer('arkpedia').dp=99;};
  const hits=[],attacks=[],births=[],impacts=[],explosions=[];
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});
  b.on('wisadelProjectileBirth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
  b.on('wisadelProjectileImpact',ctx=>{if(ctx.owner===u)impacts.push({...ctx,time:b.time});});
  b.on('wisadelAfterimageExplosion',ctx=>{if(ctx.owner===u)explosions.push({...ctx,time:b.time});});
  if(!defer)deploy(); return {b,u,build,deploy,hits,attacks,births,impacts,explosions,...prepared};
}
function enemy(f,{row=5,col=6,def=0,res=0,hp=1e7,fly=false,taunt=0,flags={}}={}) {
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(t.base,{maxHp:hp,atk:500,def,res,moveSpeed:0,tauntLevel:taunt}); t.markDirty();t.hp=hp;
  if(fly)t.motion='FLY'; f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});
  f.b._buildEnemyIndex();return t;
}
const ready=f=>f.u.skill.addCharge(1);

const activate=f=>{ready(f);assert.equal(f.u.skill.activate('fixture'),true);};
const s2Births=f=>f.births.filter(v=>v.command.mode==='s2');
const s2Hits=f=>f.hits.filter(v=>v.dmg?.isSkill);
const overload=f=>{advance(f.b,25.25);assert.equal(f.controller.mode,2);};

test('private S2 retains exact source/contract gates and does not increase playable coverage',()=>{
  assert.equal(REGULAR_OPERATORS[ID],undefined);assert.equal(data.operators[ID],undefined);
  assert.deepEqual(e.enabledOperators,[]);assert.equal(CONTRACT.frameParity,false);
  assert.throws(()=>make({skill:1}),/Incomplete/);assert.throws(()=>make({skill:3}),/Incomplete/);
  assert.throws(()=>make({contract:{...CONTRACT}}),/contract/);
  const f=make({defer:true});
  for(const mutate of [d=>d.stats.atk++,d=>{d.rangeGrid=[];},d=>d.skill.spCost++,d=>d.skill.initSp++,
    d=>d.skill.duration++,d=>{d.skill.spType='attack';},d=>{d.skill.skillType='AUTO';},
    d=>d.skill.bb.atk++,d=>d.skill.bb.base_attack_time++,d=>d.skill.bb['attack@atk_scale_ol']++,
    d=>{d.raw.arkpedia.module='siege-x';}]){
    const def=structuredClone(f.u.def);mutate(def);const u=f.b._makeAlly(f.u.player,def,'op',7,7);
    const hooks=Object.values(f.b._hooks).flat().length;
    assert.throws(()=>prepareWisadelS2(f.b,u,{contract:CONTRACT}));assert.equal(Object.values(f.b._hooks).flat().length,hooks);
  }
});
test('all ten S2 ranks preserve manual/time SP, additive BAT, ATK and two source-duration phases',()=>{
  const atk=[.1,.12,.14,.16,.18,.2,.25,.28,.3,.35],bat=[1.6,1.6,1.6,1.6,1.6,1.6,1.4,1.4,1.4,1.4];
  const costs=[35,34,33,32,31,30,29,28,27,25];
  for(let rank=1;rank<=10;rank++){
    const f=make({rank});enemy(f);near(f.u.skill.sp,15);assert.equal(f.u.skill.manual,true);activate(f);
    near(f.u.s.atk,687*(1+atk[rank-1]));near(f.u.s.bat,bat[rank-1]);near(f.u.s.interval,bat[rank-1]);
    near(f.u.skill.spCost,costs[rank-1]);near(f.u.skill.duration,50);near(f.u.skill.sp,0);
    until(f,()=>s2Hits(f).length===2);near(s2Hits(f)[0].amount,687*(1+atk[rank-1])*1.15);
    near(s2Hits(f)[1].amount,687*(1+atk[rank-1])*1.15*.5);assert.equal(f.attacks.length,1);
  }
});
test('all four facings wait for entrance and original S2 marker before static projectile clocks',()=>{
  for(const dir of ['RIGHT','LEFT','UP','DOWN']){
    const f=make({dir}),[row,col]={RIGHT:[5,6],LEFT:[5,4],UP:[6,5],DOWN:[4,5]}[dir];enemy(f,{row,col});activate(f);
    advance(f.b,1.2);assert.equal(f.births.length,0);until(f,()=>f.hits.length===2);
    near(f.births[0].time,1+.26666668,f.b.dt*2);near(f.hits[0].time-f.births[0].time,.1,f.b.dt*2);
    near(f.hits[1].time-f.hits[0].time,.15,f.b.dt*2);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Loop');
  }
});
test('normal phase fires up to three separate priority-target projectiles in one attack',()=>{
  const f=make(),a=enemy(f,{taunt:3}),b=enemy(f,{row:6,col:7,taunt:2}),z=enemy(f,{row:4,col:7,taunt:1}),d=enemy(f,{col:8,taunt:10});
  activate(f);until(f,()=>s2Births(f).length===3);
  assert.deepEqual(s2Births(f).map(v=>v.command.target),[d,a,b]);until(f,()=>f.hits.length===6);
  assert.equal(f.attacks.length,1);assert.equal(new Set(f.births.map(v=>v.command.attackId)).size,1);
  assert.equal(z.findBuff(MARK),null);for(const t of [a,b,d])assert.equal(t.findBuff(MARK).source,f.u);
});
test('no enemy is required to activate; time SP never auto-activates and stays blocked in both phases',()=>{
  const f=make();advance(f.b,10.1);assert.ok(f.u.skill.ready);assert.equal(f.u.skill.active,false);
  assert.equal(f.births.length,0);assert.ok(f.u.skill.activate('fixture'));f.u.skill.gainSp(99);near(f.u.skill.sp,0);
  overload(f);f.u.skill.gainSp(99);near(f.u.skill.sp,0);assert.equal(f.controller.mode,2);
  advance(f.b,25);assert.equal(f.u.skill.active,false);near(f.u.s.atk,687);near(f.u.s.bat,2.1);
  assert.ok(f.u.skill.sp>0);assert.equal(f.births.length,0);
});
test('normal selection occurs at strike, allowing a different target after windup priority/range changes',()=>{
  const f=make(),a=enemy(f);activate(f);until(f,()=>f.controller.phase?.kind==='s2-attack');
  a.x=12;a.tileC=12;const z=enemy(f,{col:6,taunt:10});f.b._buildEnemyIndex();until(f,()=>s2Births(f).length===1);
  assert.equal(f.births[0].command.target,z);assert.equal(f.u.skill.active,true);assert.equal(a.findBuff(MARK),null);
});
test('normal target-free filters reject air, sleep, stealth and unblocked camouflage, but splash includes camouflage',()=>{
  const f=make(),a=enemy(f),z=enemy(f,{col:6.5,flags:{camou:true}});
  enemy(f,{col:6,fly:true});enemy(f,{col:6,flags:{sleep:true}});enemy(f,{col:6,flags:{stealth:true}});
  enemy(f,{col:6,flags:{untargetable:true}});activate(f);until(f,()=>f.impacts.length===2);
  assert.equal(f.births.length,1);assert.deepEqual(f.hits.map(v=>v.target),[a,z,a,z]);
  near(f.hits[0].amount,1066.5675);near(f.hits[1].amount,927.45);assert.equal(z.findBuff(MARK),null);
});
test('static S2 projectiles retain their birth centre instead of homing after the target moves',()=>{
  const f=make(),a=enemy(f);activate(f);until(f,()=>f.births.length===1);
  a.x=10;a.tileC=10;const z=enemy(f,{col:6.2});f.b._buildEnemyIndex();until(f,()=>f.impacts.length===2);
  assert.deepEqual(f.hits.map(v=>v.target),[z,z]);near(f.hits[0].amount,927.45);near(f.hits[1].amount,463.725);
  assert.equal(z.findBuff(MARK),null);assert.equal(a.findBuff(MARK),null);
});
test('overload begins after the first 25 seconds and uses its original transition/loop marker',()=>{
  const f=make();activate(f);advance(f.b,24.9);assert.equal(f.controller.mode,1);
  advance(f.b,.2);assert.equal(f.controller.mode,2);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Overload_Begin');
  advance(f.b,.2);enemy(f);until(f,()=>f.births.length===1);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Overload_Loop');near(f.births[0].command.scale,.8);
  assert.equal(f.u.skill.spec.overloadState(),true);
});
test('all ten overload ranks emit four independent shots at 0.1 spacing with selected scale',()=>{
  const scales=[.6,.6,.6,.65,.65,.65,.7,.75,.75,.8];
  for(let rank=1;rank<=10;rank++){
    const f=make({rank});activate(f);overload(f);enemy(f);until(f,()=>f.births.length===4);
    assert.equal(f.attacks.length,1);assert.equal(f.controller.volleys.size,0);
    for(let i=0;i<4;i++)near(f.births[i].time-f.births[0].time,i*.1,f.b.dt*2);
    until(f,()=>f.impacts.length===8);assert.equal(f.hits.length,8);
    const a=f.u.s.atk,full=a*scales[rank-1]*1.15;
    const expected=[...Array(4).fill(full),...Array(4).fill(full*.5)].sort((a,b)=>a-b);
    for(const [i,h]of [...f.hits].sort((a,b)=>a.amount-b.amount).entries())near(h.amount,expected[i]);
    near(f.u.skill.sp,0);assert.deepEqual(f.births.map(v=>v.command.emission),[0,1,2,3]);
  }
});
test('overload selects with replacement and can fire every shot at the same current enemy',()=>{
  const f=make();activate(f);overload(f);enemy(f);const z=enemy(f,{col:8});f.b.rng=()=>.99;
  until(f,()=>f.births.length===4);assert.ok(f.births.every(v=>v.command.target===z));
  assert.equal(f.attacks.length,1);assert.equal(f.births.length,4);
});
test('each overload emission sees current target availability instead of retaining first-round victims',()=>{
  const f=make();activate(f);overload(f);const a=enemy(f);until(f,()=>f.births.length===1);
  a.x=12;a.tileC=12;const z=enemy(f,{col:6});f.b._buildEnemyIndex();until(f,()=>f.births.length===4);
  assert.equal(f.births[0].command.target,a);assert.ok(f.births.slice(1).every(v=>v.command.target===z));
  assert.equal(f.attacks.length,1);
});
test('additional overload emissions without a target are skipped without creating fake attack events',()=>{
  const f=make();activate(f);overload(f);const a=enemy(f);until(f,()=>f.births.length===1);
  f.b.kill(a);advance(f.b,.4);assert.equal(f.births.length,1);assert.equal(f.attacks.length,1);
  assert.equal(f.controller.volleys.size,0);assert.equal(f.hits.length,0);assert.equal(f.u.skill.active,true);
});
test('active-phase control cancels unborn attack/emissions without ending S2 or clearing born outputs',()=>{
  for(const afterBirth of [false,true]){
    const f=make();activate(f);overload(f);enemy(f);
    until(f,()=>afterBirth?f.births.length===1:f.controller.phase?.kind==='s2-attack');
    f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true}});advance(f.b,.6);
    assert.equal(f.births.length,afterBirth?1:0);assert.equal(f.impacts.length,afterBirth?2:0);
    assert.equal(f.u.skill.active,true);assert.equal(f.controller.volleys.size,0);near(f.u.skill.sp,0);
  }
});
test('between-tick control invalidates future overload emissions even after the flag was removed',()=>{
  const f=make();activate(f);overload(f);enemy(f);until(f,()=>f.births.length===1);
  f.b.addBuff(f.u,{key:'fixture:brief',flags:{freeze:true}});f.b.removeBuff(f.u,'fixture:brief');advance(f.b,.6);
  assert.equal(f.births.length,1);assert.equal(f.impacts.length,2);assert.equal(f.controller.volleys.size,0);
  assert.equal(f.u.skill.active,true);
});
test('manual cancel through the existing battle action stops unborn shots and keeps born output coefficient/live ATK',()=>{
  const f=make();f.b.bench[ID]={unit:f.u};activate(f);overload(f);enemy(f);until(f,()=>f.births.length===1);
  assert.equal(f.b.activateOperator(ID),true);assert.equal(f.u.skill.active,false);assert.equal(f.controller.mode,0);
  near(f.u.s.atk,687);near(f.u.s.bat,2.1);advance(f.b,.4);
  assert.equal(f.births.length,1);assert.equal(f.impacts.length,2);near(f.hits[0].amount,632.04);near(f.hits[1].amount,316.02);
  assert.equal(f.controller.volleys.size,0);assert.equal(f.controller.projectiles.outputs.size,0);
});
test('owner finish cancels unborn overload shots, removes parent marks, and lets born outputs finish',()=>{
  const f=make();activate(f);overload(f);const a=enemy(f);until(f,()=>f.births.length===1);
  f.b.retreat(f.u,{permanent:true});advance(f.b,.6);
  assert.equal(f.births.length,1);assert.equal(f.impacts.length,2);assert.equal(f.hits.length,2);
  near(f.hits[0].amount,687*.8);near(f.hits[1].amount,687*.8*.5);assert.equal(a.findBuff(MARK),null);
  assert.equal(f.controller.volleys.size,0);assert.equal(f.controller.handles.length,0);
  assert.equal(f.controller.projectiles.handles.length,0);
});
test('battle finish cancels the full volley and all born static delays',()=>{
  const f=make();activate(f);overload(f);enemy(f);until(f,()=>f.births.length===1);
  f.b.finished=true;f.b.emit('battleEnd',{});advance(f.b,1);assert.equal(f.hits.length,0);
  assert.equal(f.controller.volleys.size,0);assert.equal(f.controller.projectiles.outputs.size,0);
  assert.equal(f.controller.handles.length,0);assert.equal(f.controller.projectiles.handles.length,0);
});
test('ASPD changes cadence independently of capped playback and fixed projectile delays',()=>{
  const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd:100}});activate(f);
  until(f,()=>f.births.length===3);near(f.u.s.interval,.7);near(f.u.mem.regularFormVisual.speed,1);
  near(f.births[1].time-f.births[0].time,.7,f.b.dt*2);near(f.births[2].time-f.births[1].time,.7,f.b.dt*2);
  near(f.impacts[0].time-f.births[0].time,.1,f.b.dt*2);near(f.impacts[1].time-f.impacts[0].time,.15,f.b.dt*2);
  for(const aspd of [100,-50]){
    const g=make();g.b.addBuff(g.u,{key:'fixture:aspd',mods:{aspd}});activate(g);overload(g);enemy(g);
    until(g,()=>g.births.length===4);const gap=aspd===100?.1:.2;
    for(let i=1;i<4;i++)near(g.births[i].time-g.births[i-1].time,gap,g.b.dt*2);
    near(g.u.mem.regularFormVisual.speed,aspd===100?1:.5);
  }
});
test('normal/overload phase end removes ATK and additive BAT but preserves another producer buffs',()=>{
  const f=make();f.b.addBuff(f.u,{key:'fixture:external',mods:{atkPct:.5,batFlat:.2}});activate(f);
  near(f.u.s.atk,687*1.85);near(f.u.s.bat,1.6);overload(f);f.u.skill.end('manual');
  near(f.u.s.atk,687*1.5);near(f.u.s.bat,2.3);assert.ok(f.u.findBuff('fixture:external'));
});
test('deactivation during entrance preserves its original completion time on both model faces',()=>{
  for(const dir of ['RIGHT','LEFT']){
    const f=make({dir}),t=enemy(f,{col:dir==='RIGHT'?6:4});activate(f);advance(f.b,.1);f.u.skill.end('manual');
    advance(f.b,.8);assert.equal(f.births.length,0);until(f,()=>f.births.length===1);
    assert.ok(f.births[0].time>=1.6-1e-6);assert.equal(f.births[0].command.isSkill,false);
    assert.equal(f.births[0].command.mode,'ordinary');assert.ok(t.alive);
  }
});
test('starting S2 cancels an unborn ordinary command and resetting the mode never cancels its born projectile',()=>{
  for(const afterBirth of [false,true]){
    const f=make();enemy(f);until(f,()=>afterBirth?f.births.length===1:f.controller.phase?.kind==='attack');
    activate(f);advance(f.b,.3);assert.equal(f.births.length,afterBirth?1:0);
    if(afterBirth){assert.ok(f.impacts.length>=2);assert.equal(f.births[0].command.isSkill,false);}
    until(f,()=>s2Births(f).length===1);assert.equal(f.u.skill.active,true);
  }
});
test('active silence preserves S2 and its native nondamage-missable marks',()=>{
  const f=make(),a=enemy(f);activate(f);f.b.addBuff(f.u,{key:'fixture:silence',flags:{silence:true}});
  until(f,()=>f.impacts.length===2);assert.equal(f.u.skill.active,true);assert.ok(a.findBuff(MARK));
  assert.equal(f.controller.mode,1);assert.equal(f.hits.length,2);
});
test('S2 afterimage explosion uses talent ATK independently of overload coefficient and admits air',()=>{
  const f=make();activate(f);overload(f);const a=enemy(f),z=enemy(f,{fly:true});until(f,()=>f.hits.length===1);
  f.b.rng=()=>0;until(f,()=>f.explosions.length>=1);
  const air=f.hits.find(h=>h.target===z);assert.ok(air);near(air.amount,927.45*1.5);
  assert.ok(z.findBuff('stun'));assert.equal(f.attacks.length,1);
  assert.ok(f.hits.some(h=>Math.abs(h.amount-927.45*.8*.5*1.15)<1e-5));assert.ok(a.alive);
});
test('main and aftershock each read current ATK and DEF separately',()=>{
  const f=make();enemy(f,{def:500});activate(f);until(f,()=>f.hits.length===1);
  near(f.hits[0].amount,927.45*1.15-500);f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});
  until(f,()=>f.hits.length===2);near(f.hits[1].amount,687*2.35*.5*1.15-500);
});
test('physical dodge does not suppress native afterimage marks or successful explosion stun',()=>{
  const f=make(),a=enemy(f);f.b.addBuff(a,{key:'fixture:dodge',mods:{dodgePhys:1}});activate(f);
  until(f,()=>f.impacts.length===1);assert.ok(a.findBuff(MARK));f.b.rng=()=>0;
  until(f,()=>f.impacts.length===2);assert.equal(f.hits.length,0);assert.equal(f.explosions.length,1);
  assert.equal(a.findBuff(MARK),null);assert.ok(a.findBuff('stun'));near(a.hp,1e7);
});
test('a normal main-target bonus never transfers to a changed-life target at the retained centre',()=>{
  const f=make(),a=enemy(f);activate(f);until(f,()=>f.births.length===1);a.deploySeq++;
  until(f,()=>f.impacts.length===2);near(f.hits[0].amount,927.45);near(f.hits[1].amount,463.725);
  assert.equal(a.findBuff(MARK),null);assert.equal(f.explosions.length,0);
});
test('beforeAttack rejection cannot manufacture S2 projectile births or damage',()=>{
  const f=make();enemy(f);activate(f);f.b.on('beforeAttack',ctx=>{if(ctx.attacker===f.u)ctx.targets=[];});
  advance(f.b,3);assert.equal(f.births.length,0);assert.equal(f.hits.length,0);assert.equal(f.attacks.length,0);
  assert.equal(f.u.skill.active,true);near(f.u.skill.sp,0);
});
test('owner removal inside the first normal birth prevents the remaining unaccepted target births',()=>{
  const f=make();enemy(f);enemy(f,{row:6,col:7});enemy(f,{row:4,col:7});activate(f);
  f.b.on('wisadelProjectileBirth',ctx=>{if(ctx.owner===f.u)f.b.retreat(f.u,{permanent:true});});
  until(f,()=>f.births.length===1);advance(f.b,.4);assert.equal(f.births.length,1);assert.equal(f.impacts.length,2);
  assert.equal(f.controller.handles.length,0);assert.equal(f.controller.projectiles.handles.length,0);
});
test('manual mode exit during an overload RNG callback cannot emit another stale-generation shot',()=>{
  const f=make();activate(f);overload(f);enemy(f);until(f,()=>f.births.length===1);
  f.b.rng=()=>{f.u.skill.end('manual');return .99;};advance(f.b,.4);
  assert.equal(f.births.length,1);assert.equal(f.controller.volleys.size,0);assert.equal(f.u.skill.active,false);
});
test('changed-life selection inside an overload RNG callback cannot inherit an old candidate',()=>{
  const f=make();activate(f);overload(f);const a=enemy(f);let calls=0;
  f.b.rng=()=>{calls++;a.deploySeq++;return .99;};advance(f.b,1);
  assert.ok(calls>0);assert.equal(f.births.length,0);assert.equal(f.attacks.length,0);assert.equal(a.findBuff(MARK),null);
});
test('normal-to-overload transition cancels its unborn loop but preserves born normal coefficients',()=>{
  for(const alreadyBorn of [false,true]){
    // Leave a full native event/tick margin before the mode boundary. The
    // unrounded .2666666806 event is slightly later than eight exact JS ticks.
    const f=make();activate(f);advance(f.b,alreadyBorn?24.6:24.9);enemy(f);
    if(alreadyBorn)until(f,()=>f.births.length===1);
    advance(f.b,.4);assert.equal(f.controller.mode,2);
    const normal=f.births.filter(v=>v.command.mode==='s2'&&v.command.scale===1);
    assert.equal(normal.length,alreadyBorn?1:0);
    if(alreadyBorn){assert.ok(f.impacts.length>=2);near(f.hits[0].amount,1066.5675);near(f.hits[1].amount,533.28375);}
  }
});
test('natural 50-second end cancels remaining overload emissions while earlier births finish',()=>{
  const f=make();activate(f);advance(f.b,49.5);enemy(f);until(f,()=>f.births.length===1);
  advance(f.b,.5);assert.equal(f.u.skill.active,false);assert.equal(f.controller.mode,0);
  assert.equal(f.births.length,2);assert.ok(f.births.every(v=>v.time<50));assert.equal(f.impacts.length,4);
  assert.equal(f.controller.volleys.size,0);assert.equal(f.controller.projectiles.outputs.size,0);
});
test('control immunity preserves an accepted overload sequence without corrupting its epoch',()=>{
  const f=make();activate(f);overload(f);enemy(f);until(f,()=>f.births.length===1);
  const epoch=f.u.attackControlEpoch;f.u.def.immune.add('stun');
  assert.equal(f.b.applyStatus(f.u,'stun',{duration:2}),false);assert.equal(f.u.attackControlEpoch,epoch);
  until(f,()=>f.impacts.length===8);assert.equal(f.births.length,4);assert.equal(f.attacks.length,1);
});
test('late ASPD changes cannot retime already-captured overload emissions',()=>{
  const f=make();activate(f);overload(f);enemy(f);until(f,()=>f.births.length===1);
  f.b.addBuff(f.u,{key:'fixture:late-aspd',mods:{aspd:300}});until(f,()=>f.births.length===4);
  for(let i=1;i<4;i++)near(f.births[i].time-f.births[0].time,i*.1,f.b.dt*2);
});
test('manual mode exit from a normal birth callback cancels later unaccepted target births',()=>{
  const f=make();enemy(f);enemy(f,{row:6,col:7});enemy(f,{row:4,col:7});activate(f);
  f.b.on('wisadelProjectileBirth',ctx=>{if(ctx.owner===f.u)f.u.skill.end('manual');});
  until(f,()=>f.births.length===1);advance(f.b,.4);assert.equal(f.births.length,1);assert.equal(f.impacts.length,2);
  assert.equal(f.u.skill.active,false);assert.equal(f.controller.mode,0);near(f.hits[0].amount,790.05);
});
test('parent withdrawal inside S2 mark attachment cannot leave an orphan talent claim',()=>{
  const f=make(),a=enemy(f);activate(f);let acted=false;
  f.b.on('beforeBuff',ctx=>{if(ctx.buff.key===MARK&&!acted){acted=true;f.b.retreat(f.u,{permanent:true});}});
  until(f,()=>f.impacts.length===2);assert.equal(a.findBuff(MARK),null);
  assert.equal(f.controller.projectiles.marks.size,0);assert.equal(f.controller.projectiles.handles.length,0);
  assert.equal(f.controller.volleys.size,0);assert.equal(f.controller.handles.length,0);
});
test('S2 lethal aftershock detonates a dead original-life centre and credits its ground/air kills',()=>{
  const f=make(),a=enemy(f,{hp:1200}),z=enemy(f,{fly:true,hp:900});activate(f);
  until(f,()=>f.hits.length===1);f.b.rng=()=>0;until(f,()=>f.impacts.length===2);
  assert.equal(a.alive,false);assert.equal(z.alive,false);assert.equal(f.explosions.length,1);
  assert.equal(f.u.stats.kills,2);assert.equal(a.findBuff(MARK),null);assert.equal(f.attacks.length,1);
});
test('battle end during first static main impact cancels all simultaneous normals and statuses',()=>{
  const f=make(),a=enemy(f);enemy(f,{row:6,col:7});enemy(f,{row:4,col:7});activate(f);
  f.b.on('damaged',ctx=>{if(ctx.source===f.u){f.b.finished=true;f.b.emit('battleEnd',{});}});
  until(f,()=>f.hits.length===1);assert.equal(f.births.length,3);assert.equal(f.hits.length,1);
  assert.equal(f.controller.projectiles.outputs.size,0);assert.equal(a.findBuff(MARK),null);
  assert.equal(f.controller.projectiles.handles.length,0);assert.equal(f.controller.handles.length,0);
});
