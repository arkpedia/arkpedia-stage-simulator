// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type:'json' };
import e from '../data/arkpedia-wisadel-prefabs.json' with { type:'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { WISADEL_ID as ID, WISADEL_ATTACK_CONTRACT as CONTRACT, selectedWisadelBuild,
  prepareWisadelAttacks } from '../server/sim/content/arkpedia-wisadel-attacks.js';
import { WISADEL_AFTERIMAGE as MARK } from '../server/sim/content/arkpedia-wisadel-projectiles.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps, `${a} != ${z}`);
function advance(b,s) { for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++) b.step(); assert.deepEqual(b.errors,[]); }
function until(f,p,s=12) { const end=f.b.time+s; while(!p()&&f.b.time<end) advance(f.b,f.b.dt);
  assert.ok(p(),`Expected condition at ${f.b.time}, phase ${f.controller.phase?.kind}`); }
function make({rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=1,dir='RIGHT',defer=false,battle=null,contract=CONTRACT}={}) {
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
  const prepared=prepareWisadelAttacks(b,u,{contract}); b._setupUnit(u,prepared.kit); prepared.controller.install();
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

test('private Wisadel ordinary/S1 remains outside public coverage and requires exact contract',()=>{
  assert.equal(REGULAR_OPERATORS[ID],undefined);assert.equal(data.operators[ID],undefined);
  assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);
  assert.equal(CONTRACT.frameParity,false);
  assert.throws(()=>make({contract:{...CONTRACT}}),/contract/);
  assert.throws(()=>make({skill:2}),/Incomplete/);assert.throws(()=>make({skill:3}),/Incomplete/);
});
test('selected source stats combine level, trust and potentials with elite-dependent talents',()=>{
  const build={elite:2,level:90,potential:1,trust:0,skillId:'skchr_wisdel_1',skillRank:10};
  const r=selectedWisadelBuild(build);near(r.stats.maxHp,1888);near(r.stats.atk,687);near(r.stats.def,256);
  near(r.stats.cost,25);near(r.stats.baseAttackTime,2.1);near(r.talent['attack@main_atk_scale'],1.15);
  const z=selectedWisadelBuild({...build,potential:6,trust:200});near(z.stats.atk,809);near(z.stats.cost,23);
  near(z.stats.respawnTime,66);near(z.talent['attack@bomb_atk_scale'],1.6);
  const one=selectedWisadelBuild({...build,elite:1,level:1,skillRank:7});near(one.talent['attack@main_atk_scale'],1);
  near(one.talent['attack@bomb_atk_scale'],1.2);
  assert.deepEqual(selectedWisadelBuild({...build,elite:0,level:1,skillRank:1}).talent,{});
  for(const change of [{elite:3},{level:0},{level:91},{potential:0},{potential:7},{trust:201},{skillRank:11},
    {module:'siege-x'},{elite:0,level:1,skillRank:1,skillId:'skchr_wisdel_2'}])
    assert.throws(()=>selectedWisadelBuild({...build,...change}));
});
test('altered source stats, ranges and skill fields fail before hook installation',()=>{
  const f=make({defer:true});
  for(const mutate of [d=>d.stats.atk++,d=>d.skill.spCost++,d=>d.skill.initSp++,d=>d.skill.duration++,
    d=>d.skill.bb.append_atk_scale++,d=>{d.skill.spType='time';},d=>{d.rangeGrid=[];},
    d=>d.talents[0].bb['attack@main_atk_scale']++,d=>{d.raw.arkpedia.skillRank=9;}]){
    const def=structuredClone(f.u.def);mutate(def);const u=f.b._makeAlly(f.u.player,def,'op',7,7);
    const hooks=Object.values(f.b._hooks).flat().length;
    assert.throws(()=>prepareWisadelAttacks(f.b,u,{contract:CONTRACT}));
    assert.equal(Object.values(f.b._hooks).flat().length,hooks);
  }
  assert.throws(()=>prepareWisadelAttacks(f.b,f.u,{contract:CONTRACT}),/fresh/);
});
test('all facings use source entrance/event, a real flight, then an absolute half-strength aftershock',()=>{
  for(const dir of ['RIGHT','LEFT','UP','DOWN']){
    const f=make({dir}),[row,col]={RIGHT:[5,6],LEFT:[5,4],UP:[6,5],DOWN:[4,5]}[dir];const t=enemy(f,{row,col});
    advance(f.b,1.5);assert.equal(f.hits.length,0);until(f,()=>f.hits.length===2);
    near(f.hits[0].amount,687*1.15);near(f.hits[1].amount,687*.5*1.15);
    near(f.births[0].time,1+.6,f.b.dt*2);near(f.hits[0].time-f.births[0].time,.1,f.b.dt*2);
    near(f.hits[1].time-f.hits[0].time,.15,f.b.dt*2);
    assert.equal(f.attacks.length,1);assert.equal(f.births.length,1);near(f.u.skill.sp,1);
    assert.equal(t.findBuff(MARK).source,f.u);assert.equal(f.controller.projectiles.marks.size,1);
  }
});
test('ordinary animation excludes previous accepted clip while S1 uses its original clip',()=>{
  const f=make();enemy(f);f.b.rng=()=>.99;
  until(f,()=>f.attacks.length===1);assert.equal(f.controller.lastOrdinary,'Attack_C');
  until(f,()=>f.attacks.length===2);assert.equal(f.controller.lastOrdinary,'Attack_B');
  until(f,()=>f.controller.phase?.skill);assert.equal(f.controller.phase.clip,'Skill_1');
  until(f,()=>f.attacks.length===3);assert.equal(f.controller.lastOrdinary,'Attack_B');
});
test('all ten S1 ranks produce one main and three independently mitigated aftershocks',()=>{
  const scales=[.6,.65,.7,.75,.8,.85,.9,1,1.1,1.2],costs=[4,4,4,4,4,4,3,3,3,2];
  for(let rank=1;rank<=10;rank++){
    const f=make({rank}),t=enemy(f,{def:200});ready(f);until(f,()=>f.hits.length===1);
    const stun=t.findBuff('stun');assert.ok(stun);near(stun.duration,rank<=6?.5:rank<=9?1:1.5);
    until(f,()=>f.hits.length===4);
    near(f.hits[0].amount,687*1.15-200);
    for(const h of f.hits.slice(1))near(h.amount,687*1.15*scales[rank-1]-200);
    assert.equal(f.u.skill.spCost,costs[rank-1]);assert.equal(f.attacks.length,1);near(f.u.skill.sp,0);
    assert.equal(f.births.length,1);assert.equal(f.impacts.length,4);
    for(const [i,delay]of [.15,.5,.65].entries())near(f.hits[i+1].time-f.hits[0].time,delay,f.b.dt*2);
  }
});
test('splash receives base scales while only the captured primary receives the main-target bonus',()=>{
  const f=make(),a=enemy(f),z=enemy(f,{col:6.5,flags:{camou:true}});enemy(f,{col:6,fly:true});
  enemy(f,{col:6,flags:{sleep:true}});enemy(f,{col:6,flags:{stealth:true}});
  until(f,()=>f.hits.length===4);
  assert.deepEqual(f.hits.map(h=>h.target),[a,z,a,z]);
  near(f.hits[0].amount,790.05);near(f.hits[1].amount,687);near(f.hits[2].amount,395.025);near(f.hits[3].amount,343.5);
  assert.ok(a.findBuff(MARK));assert.equal(z.findBuff(MARK),null);
});
test('primary selection refuses air, unblocked camouflage, sleep, stealth and untargetable units',()=>{
  for(const options of [{fly:true},{flags:{camou:true}},{flags:{sleep:true}},{flags:{stealth:true}},
    {flags:{untargetable:true}}]){const f=make();enemy(f,options);advance(f.b,4);assert.equal(f.hits.length,0);}
});
test('successful afterimage explosion consumes only its mark and damages/stuns ground and air',()=>{
  const f=make(),a=enemy(f),z=enemy(f,{col:6,fly:true});until(f,()=>f.hits.length===1);
  f.b.rng=()=>0;until(f,()=>f.explosions.length===1);
  assert.equal(f.hits.length,4);near(f.hits[2].amount,1030.5);near(f.hits[3].amount,1030.5);
  assert.equal(f.hits[2].target,a);assert.equal(f.hits[3].target,z);
  assert.equal(a.findBuff(MARK),null);assert.ok(a.findBuff('stun'));assert.ok(z.findBuff('stun'));
  assert.equal(f.attacks.length,1);near(f.u.skill.sp,1);assert.equal(f.controller.projectiles.marks.size,0);
});
test('failed probability retains the mark; an unmarked shock victim still consumes a Dice roll',()=>{
  const f=make(),a=enemy(f);enemy(f,{col:6.5});until(f,()=>f.hits.length===2);
  let rolls=0;f.b.rng=()=>{rolls++;return .99;};until(f,()=>f.hits.length===4);
  assert.equal(rolls,2);assert.ok(a.findBuff(MARK));assert.equal(f.explosions.length,0);
});
test('E0 has neither afterimage nor explosion roll and does not inherit E2 primary scale',()=>{
  const f=make({elite:0,rank:1}),a=enemy(f);until(f,()=>f.hits.length===1);
  let rolls=0;f.b.rng=()=>{rolls++;return 0;};until(f,()=>f.hits.length===2);
  near(f.hits[0].amount,f.u.base.atk);near(f.hits[1].amount,f.u.base.atk*.5);
  assert.equal(a.findBuff(MARK),null);assert.equal(rolls,0);assert.equal(f.explosions.length,0);
});
test('S1 mark can explode once across its three shocks without multiplying offensive SP',()=>{
  const f=make(),a=enemy(f);ready(f);until(f,()=>f.hits.length===1);f.b.rng=()=>0;
  until(f,()=>f.impacts.length===4);assert.equal(f.explosions.length,1);assert.equal(f.hits.length,5);
  assert.equal(a.findBuff(MARK),null);assert.equal(f.attacks.length,1);near(f.u.skill.sp,0);
});
test('homing follows a moving original life then retains its impact centre for later shocks',()=>{
  const f=make(),a=enemy(f);until(f,()=>f.births.length===1);
  a.x=9;a.tileC=9;f.b._buildEnemyIndex();advance(f.b,.1);assert.equal(f.hits.length,0);
  until(f,()=>f.hits.length===1);near(f.births[0].command.x,9);
  a.x=12;a.tileC=12;const newcomer=enemy(f,{col:9.2});f.b._buildEnemyIndex();
  until(f,()=>f.impacts.length===2);assert.equal(f.hits.length,2);assert.equal(f.hits[1].target,newcomer);
  near(f.hits[1].amount,343.5);assert.equal(newcomer.findBuff(MARK),null);
});
test('projectile cannot inherit a changed target life or chase its new coordinates',()=>{
  const f=make(),a=enemy(f);until(f,()=>f.births.length===1);
  a.deploySeq++;a.x=12;a.tileC=12;const z=enemy(f,{col:6});f.b._buildEnemyIndex();
  until(f,()=>f.impacts.length===2);near(f.births[0].command.x,6);
  assert.deepEqual(f.hits.map(h=>h.target),[z,z]);near(f.hits[0].amount,687);near(f.hits[1].amount,343.5);
  assert.equal(a.findBuff(MARK),null);assert.equal(z.findBuff(MARK),null);
});
test('lost PRECAST S1 input refunds without substituting a different enemy',()=>{
  for(const changedLife of [false,true]){
    const f=make(),a=enemy(f);ready(f);until(f,()=>f.controller.phase?.skill);
    if(changedLife)a.deploySeq++;else f.b.kill(a);enemy(f,{col:7});advance(f.b,.4);
    assert.equal(f.births.length,0);assert.equal(f.hits.length,0);assert.ok(f.u.skill.ready);
    assert.equal(f.u.skill.active,false);assert.equal(f.u.findBuff('wisadel:cast'),null);
  }
});
test('control cancels an unborn S1 without refund, including between-tick control',()=>{
  for(const flag of ['stun','disarm','freeze','sleep']){
    const f=make();enemy(f);ready(f);until(f,()=>f.controller.phase?.skill);
    f.b.addBuff(f.u,{key:'fixture:interrupt',flags:{[flag]:true}});advance(f.b,.7);
    assert.equal(f.births.length,0);near(f.u.skill.sp,0);assert.equal(f.u.skill.active,false);
  }
  const f=make();enemy(f);ready(f);until(f,()=>f.controller.phase?.skill);
  f.b.addBuff(f.u,{key:'fixture:interrupt',flags:{stun:true}});f.b.removeBuff(f.u,'fixture:interrupt');advance(f.b,.6);
  assert.equal(f.births.length,0);assert.equal(f.u.skill.active,false);
});
test('hook-rejected releases create no output, damage or attack SP',()=>{
  const f=make();enemy(f);f.b.on('beforeAttack',ctx=>{if(ctx.attacker===f.u)ctx.targets=[];});
  advance(f.b,4);assert.equal(f.hits.length,0);assert.equal(f.births.length,0);assert.equal(f.attacks.length,0);
  near(f.u.skill.sp,0);
});
test('withdrawal preserves born flight/aftershock but removes parent marks and primary bonus',()=>{
  for(const beforeImpact of [true,false]){
    const f=make(),a=enemy(f);until(f,()=>beforeImpact?f.births.length===1:f.hits.length===1);
    f.b.retreat(f.u,{permanent:true});assert.equal(a.findBuff(MARK),null);
    f.b.rng=()=>0;until(f,()=>f.impacts.length===2);
    assert.equal(f.hits.length,2);near(f.hits[0].amount,beforeImpact?687:790.05);near(f.hits[1].amount,343.5);
    assert.equal(f.explosions.length,0);assert.equal(f.attacks.length,1);
    assert.equal(f.controller.handles.length,0);assert.equal(f.controller.projectiles.outputs.size,0);
    assert.equal(f.controller.projectiles.handles.length,0);assert.equal(f.controller.projectiles.marks.size,0);
  }
});
test('control after birth preserves output; battle finish cancels flight, delays and claims',()=>{
  const f=make();enemy(f);until(f,()=>f.births.length===1);
  f.b.addBuff(f.u,{key:'fixture:stun',flags:{stun:true}});until(f,()=>f.hits.length===2);
  for(const afterImpact of [false,true]){
    const g=make(),a=enemy(g);until(g,()=>afterImpact?g.hits.length===1:g.births.length===1);
    g.b.finished=true;g.b.emit('battleEnd',{});advance(g.b,1);
    assert.equal(g.hits.length,afterImpact?1:0);assert.equal(g.controller.projectiles.outputs.size,0);
    assert.equal(a.findBuff(MARK),null);assert.equal(g.controller.projectiles.handles.length,0);
  }
});
test('offensive SP is held through S1 original clip; silence leaves its charge available',()=>{
  const f=make();enemy(f);ready(f);until(f,()=>f.impacts.length===4);assert.ok(f.u.findBuff('wisadel:cast'));
  f.u.skill.gainSp(1);near(f.u.skill.sp,0);until(f,()=>!f.u.findBuff('wisadel:cast'));
  f.u.skill.gainSp(1);near(f.u.skill.sp,1);
  const g=make();enemy(g);ready(g);g.b.addBuff(g.u,{key:'fixture:silence',flags:{silence:true}});
  until(g,()=>g.impacts.length===2);assert.equal(g.births[0].command.isSkill,false);assert.ok(g.u.skill.ready);
});
test('ASPD speeds ordinary clips but S1 caps at one; native flight/shock delays remain absolute',()=>{
  for(const skill of [false,true]){
    const f=make();enemy(f);if(skill)ready(f);f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd:100}});
    until(f,()=>f.impacts.length===(skill?4:2));near(f.births[0].time,1+.6/(skill?1:2),f.b.dt*2);
    near(f.hits[1].time-f.hits[0].time,.15,f.b.dt*2);
    if(skill){near(f.hits[2].time-f.hits[0].time,.5,f.b.dt*2);near(f.hits[3].time-f.hits[0].time,.65,f.b.dt*2);}
  }
});
test('each receipt reads current ATK without caching flight or main damage',()=>{
  const f=make();enemy(f);until(f,()=>f.births.length===1);
  f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});until(f,()=>f.hits.length===1);near(f.hits[0].amount,1580.1);
  f.b.removeBuff(f.u,'fixture:atk');until(f,()=>f.hits.length===2);near(f.hits[1].amount,395.025);
});
test('nondamage-missable afterimage and S1 stun survive physical dodge without damage/SP duplication',()=>{
  const f=make(),a=enemy(f);ready(f);f.b.addBuff(a,{key:'fixture:dodge',mods:{dodgePhys:1}});
  until(f,()=>f.impacts.length===1);assert.ok(a.findBuff(MARK));assert.ok(a.findBuff('stun'));
  until(f,()=>f.impacts.length===4);assert.equal(f.hits.length,0);near(a.hp,1e7);
  assert.equal(f.attacks.length,1);near(f.u.skill.sp,0);
});
test('single-hit barriers and typed shields resolve independent receipts and preserve status',()=>{
  const f=make(),a=enemy(f);ready(f);f.b.addBuff(a,{key:'fixture:barrier',shieldHits:1});
  f.b.addBuff(a,{key:'fixture:shield',shield:100,shieldTypes:['phys']});until(f,()=>f.impacts.length===4);
  near(1e7-a.hp,3*(687*1.15*1.2)-100);assert.equal(a.findBuff('fixture:barrier'),null);
  assert.equal(a.findBuff('fixture:shield'),null);assert.ok(a.findBuff(MARK));assert.equal(f.attacks.length,1);
});
test('separate aftershock and explosion kills credit owner without additional offensive SP',()=>{
  const f=make(),a=enemy(f,{hp:1000});until(f,()=>f.impacts.length===2);
  assert.equal(a.alive,false);assert.equal(f.u.stats.kills,1);near(f.u.skill.sp,1);
  const g=make();enemy(g);const z=enemy(g,{col:6,fly:true,hp:500});until(g,()=>g.hits.length===1);
  g.b.rng=()=>0;until(g,()=>g.explosions.length===1);assert.equal(z.alive,false);assert.equal(g.u.stats.kills,1);
  assert.equal(g.attacks.length,1);near(g.u.skill.sp,1);
});
test('shared nonstacking mark can be consumed by another source and parent cleanup preserves foreign claims',()=>{
  const f=make(),a=enemy(f);const g=make({battle:f.b,defer:true});g.u.homeR=7;g.u.homeC=7;g.deploy();
  g.controller.projectiles.attach(a,a.deploySeq);const mark=a.findBuff(MARK);assert.equal(mark.source,g.u);
  until(f,()=>f.hits.length===1);assert.equal(a.findBuff(MARK),mark);assert.equal(f.controller.projectiles.marks.size,0);
  f.b.rng=()=>0;until(f,()=>f.explosions.length===1);assert.equal(a.findBuff(MARK),null);
  assert.equal(g.controller.projectiles.marks.size,0);
  g.controller.projectiles.attach(a,a.deploySeq);const next=a.findBuff(MARK);
  f.b.retreat(f.u,{permanent:true});assert.equal(a.findBuff(MARK),next);
  g.b.retreat(g.u,{permanent:true});assert.equal(a.findBuff(MARK),null);
});
test('rejected marks and parent withdrawal inside beforeBuff cannot leave orphan claims',()=>{
  for(const mode of ['reject','withdraw','changed-life']){
    const f=make(),a=enemy(f);let acted=false;
    f.b.on('beforeBuff',ctx=>{if(ctx.buff.key===MARK&&!acted){acted=true;
      if(mode==='reject')ctx.cancel=true;
      if(mode==='withdraw')f.b.retreat(f.u,{permanent:true});
      if(mode==='changed-life')a.deploySeq++;
    }});
    until(f,()=>f.impacts.length===2);assert.equal(a.findBuff(MARK),null);
    assert.equal(f.controller.projectiles.marks.size,0);assert.equal(f.explosions.length,0);
  }
});
test('victim life changes inside damage callbacks cannot inherit explosion or S1 stun',()=>{
  for(const skill of [false,true]){
    const f=make(),a=enemy(f);if(skill)ready(f);let acted=false;
    f.b.on('damaged',ctx=>{if(ctx.source===f.u&&!acted){acted=true;a.deploySeq++;}});
    until(f,()=>f.impacts.length===(skill?4:2));assert.equal(f.explosions.length,0);
    assert.equal(a.findBuff('stun'),null);
  }
});
test('S1 native parts retain independent five/eight-second timeout clocks',()=>{
  const f=make(),a=enemy(f);ready(f);until(f,()=>f.births.length===1);
  f.b.addBuff(f.u,{key:'fixture:stop-new-attacks',flags:{disarm:true}});
  const command=f.births[0].command;
  function moveUntil(seconds){while(f.b.time-command.bornAt<seconds){a.x=f.b.tickCount%2?0:20;
    a.tileC=Math.round(a.x);f.b._buildEnemyIndex();advance(f.b,f.b.dt);}}
  moveUntil(5.25);assert.equal(command.parts[0].done,true);
  assert.ok(command.parts.slice(1).every(p=>!p.arrived));assert.equal(f.controller.projectiles.outputs.size,1);
  moveUntil(8.75);assert.ok(command.parts.every(p=>p.done));assert.equal(f.controller.projectiles.outputs.size,0);
  assert.equal(f.attacks.length,1);assert.equal(f.births.length,1);assert.equal(f.impacts.length,4);
});
test('battle finish inside a main receipt prevents further packet damage, stun or pending outputs',()=>{
  const f=make(),a=enemy(f);enemy(f,{col:6.5});ready(f);
  f.b.on('damaged',ctx=>{if(ctx.source===f.u){f.b.finished=true;f.b.emit('battleEnd',{});}});
  until(f,()=>f.hits.length===1);assert.equal(f.hits.length,1);assert.equal(a.findBuff('stun'),null);
  assert.equal(a.findBuff(MARK),null);assert.equal(f.controller.projectiles.outputs.size,0);
  assert.equal(f.controller.projectiles.handles.length,0);assert.equal(f.controller.handles.length,0);
});
test('skill-start hooks removing owner or controlling it leave no unborn S1 or cast-SP flag',()=>{
  for(const mode of ['withdraw','control']){
    const f=make();enemy(f);ready(f);
    f.b.on('skillStart',ctx=>{if(ctx.unit===f.u||ctx.owner===f.u){
      if(mode==='withdraw')f.b.retreat(f.u,{permanent:true});
      else f.b.addBuff(f.u,{key:'fixture:stun',flags:{stun:true}});
    }});
    advance(f.b,2);assert.equal(f.births.length,0);assert.equal(f.u.skill.active,false);
    assert.equal(f.u.skill.pending,false);assert.equal(f.u.findBuff('wisadel:cast'),null);
  }
});
test('owner finish preserves a foreign replacement installed by mark removal callback',()=>{
  const f=make(),a=enemy(f);until(f,()=>f.hits.length===1);
  const owned=a.findBuff(MARK);let replacement;
  owned.onRemove=()=>{replacement=f.b.addBuff(a,{key:MARK,source:null,data:{wisadelLife:a.deploySeq}});};
  f.b.retreat(f.u,{permanent:true});assert.equal(a.findBuff(MARK),replacement);
  assert.equal(f.controller.projectiles.marks.size,0);
});
test('elite/potential-specific explosion coefficients and stun duration come from the selected talent',()=>{
  for(const [elite,potential,scale,stun]of [[1,1,1.2,.5],[1,5,1.3,.5],[2,1,1.5,1],[2,5,1.6,1]]){
    const f=make({elite,potential}),a=enemy(f);until(f,()=>f.hits.length===1);
    f.b.rng=()=>0;until(f,()=>f.explosions.length===1);
    near(f.hits.at(-1).amount,f.u.base.atk*scale);near(a.findBuff('stun').duration,stun);
    assert.equal(a.findBuff(MARK),null);
  }
});
test('stun immunity and Resist affect status without suppressing physical explosion damage',()=>{
  for(const mode of ['immune','resist']){
    const f=make(),a=enemy(f);if(mode==='immune')a.def.immune.add('stun');
    else f.b.applyStatus(a,'resist',{duration:20,value:.5});
    until(f,()=>f.hits.length===1);f.b.rng=()=>0;until(f,()=>f.explosions.length===1);
    near(f.hits.at(-1).amount,1030.5);
    if(mode==='immune')assert.equal(a.findBuff('stun'),null);else near(a.findBuff('stun').duration,.5);
  }
});
test('explosion damage callbacks cannot apply stun to a new victim life',()=>{
  const f=make();enemy(f);const a=enemy(f,{fly:true});until(f,()=>f.hits.length===1);
  f.b.rng=()=>0;f.b.on('damaged',ctx=>{if(ctx.source===f.u&&ctx.target===a)a.deploySeq++;});
  until(f,()=>f.explosions.length===1);assert.equal(a.findBuff('stun'),null);assert.equal(f.hits.at(-1).target,a);
});
test('a lethal aftershock can detonate a dead original-life centre and kill a nearby flyer',()=>{
  const f=make(),a=enemy(f,{hp:1000}),z=enemy(f,{fly:true,hp:500});until(f,()=>f.hits.length===1);
  f.b.rng=()=>0;until(f,()=>f.impacts.length===2);assert.equal(a.alive,false);assert.equal(z.alive,false);
  assert.equal(f.explosions.length,1);assert.equal(f.explosions[0].target,a);assert.equal(f.u.stats.kills,2);
  assert.equal(a.findBuff(MARK),null);assert.equal(f.controller.projectiles.marks.size,0);
  assert.equal(f.attacks.length,1);near(f.u.skill.sp,1);
});
test('another owner can detonate a foreign afterimage after a lethal shock without orphan cleanup',()=>{
  const f=make(),a=enemy(f,{hp:1000});const g=make({battle:f.b,defer:true});g.u.homeR=7;g.u.homeC=7;g.deploy();
  g.controller.projectiles.attach(a,a.deploySeq);until(f,()=>f.hits.length===1);f.b.rng=()=>0;
  until(f,()=>f.impacts.length===2);assert.equal(a.alive,false);assert.equal(f.explosions.length,1);
  assert.equal(g.controller.projectiles.marks.size,0);assert.equal(a.findBuff(MARK),null);
});
