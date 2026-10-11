// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type:'json' };
import e from '../data/arkpedia-rosmontis-prefabs.json' with { type:'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { ROSMONTIS_ID as ID, selectedRosmontisBuild } from '../server/sim/content/arkpedia-rosmontis-attacks.js';
import { ROSMONTIS_S2_CONTRACT as CONTRACT, prepareRosmontisS2 } from '../server/sim/content/arkpedia-rosmontis-s2.js';
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
  b.autoFinish=false; b.recordEvents=true; b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const build={elite,level,potential,trust,skillId:`skchr_rosmon_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedRosmontisBuild(build), c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,
    subProfessionId:c.subProfessionId,position:c.position,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',5,5,{dir});
  const prepared=prepareRosmontisS2(b,u,{contract}); b._setupUnit(u,prepared.kit); prepared.controller.install();
  const deploy=()=>{assert.ok(b._deploy(u,{initial:false})); b.getPlayer('arkpedia').dp=99;};
  const hits=[],attacks=[],births=[],impacts=[],rolls=[];
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});
  b.on('rosmontisS2Birth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
  b.on('rosmontisS2Impact',ctx=>{if(ctx.owner===u)impacts.push({...ctx,time:b.time});});
  b.on('rosmontisS2StunRoll',ctx=>{if(ctx.owner===u)rolls.push({...ctx,time:b.time});});
  if(!defer)deploy(); return {b,u,build,deploy,hits,attacks,births,impacts,rolls,...prepared};
}
function enemy(f,{row=5,col=6,def=0,res=0,hp=1e7,fly=false,taunt=0,flags={}}={}) {
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  t.def={...t.def,immune:new Set(t.def.immune)};
  Object.assign(t.base,{maxHp:hp,atk:500,def,res,moveSpeed:0,tauntLevel:taunt}); t.markDirty();t.hp=hp;
  if(fly)t.motion='FLY'; f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});
  f.b._buildEnemyIndex();return t;
}
function caster(f,{row=4,col=5,profession='CASTER',kind='op',flags={}}={}) {
  const def=normalizeChess({chessId:`fixture:${row}:${col}`,charId:'fixture',profession,
    stats:{maxHp:10000,atk:100,def:0,blockCnt:0},rangeGrid:[[0,0]],skill:null});
  const a=f.b._makeAlly(f.u.player,def,kind,row,col);f.b._setupUnit(a,{trait:{noAttack:true},skill:null});
  if(Object.keys(flags).length) f.b.addBuff(a,{key:'fixture:flags',flags,allowDead:true,persist:true});
  assert.ok(f.b._deploy(a));return a;
}
const ready=f=>f.u.skill.addCharge(1);

const activate=f=>{ready(f);assert.equal(f.u.skill.activate('fixture'),true);};

test('S2 adapter rejects other skills, fabricated contracts, modules and changed source fields',()=>{
  assert.equal(REGULAR_OPERATORS[ID].mechanic,'rosmontis');assert.ok(data.operators[ID]);
  assert.equal(CONTRACT.frameParity,false);assert.deepEqual(e.enabledOperators,[ID]);
  assert.throws(()=>make({skill:1}),/Incomplete/);assert.throws(()=>make({skill:3}),/Incomplete/);
  assert.throws(()=>make({contract:{...CONTRACT}}),/contract/);
  const f=make({defer:true});
  for(const mutate of [d=>{d.stats.atk++;},d=>{d.rangeGrid=[];},d=>{d.skill.spType='attack';},
    d=>{d.skill.skillType='AUTO';},d=>{d.skill.initSp=0;},d=>{d.skill.spCost=1;},d=>{d.skill.duration=1;},
    d=>{d.skill.bb.base_attack_time=.1;},d=>{d.skill.bb['attack@prob']=1;},d=>{d.raw.arkpedia.module='bombarder-x';}]){
    const def=structuredClone(f.u.def);mutate(def);const u=f.b._makeAlly(f.u.player,def,'op',7,7);
    const before=Object.values(f.b._hooks).flat().length;assert.throws(()=>prepareRosmontisS2(f.b,u,{contract:CONTRACT}));
    assert.equal(Object.values(f.b._hooks).flat().length,before);
  }
  assert.throws(()=>prepareRosmontisS2(f.b,f.u,{contract:CONTRACT}),/fresh/);
});
test('all ten ranks preserve manual activation, source ATK/interval, duration and four separate Physical receipts',()=>{
  const scales=[.1,.1,.1,.2,.2,.2,.3,.37,.45,.55],durations=[30,31,32,33,34,35,36,37,38,40];
  const costs=[40,39,38,37,36,35,34,33,32,30],stuns=[.7,.7,.7,.9,.9,.9,1.1,1.2,1.3,1.5];
  for(let rank=1;rank<=10;rank++){
    const f=make({rank});enemy(f);near(f.u.skill.sp,20);assert.equal(f.u.skill.manual,true);
    activate(f);near(f.u.s.atk,688*(1+scales[rank-1]));near(f.u.s.bat,3.15);near(f.u.s.interval,3.15);
    near(f.u.skill.duration,durations[rank-1]);near(f.u.skill.spCost,costs[rank-1]);f.b.rng=()=>0;
    until(f,()=>f.hits.length===4);near(f.hits[0].amount,688*(1+scales[rank-1]));
    for(const hit of f.hits.slice(1))near(hit.amount,688*(1+scales[rank-1])*.5);
    assert.equal(f.births.length,4);assert.equal(f.impacts.length,4);assert.equal(f.attacks.length,1);
    assert.equal(new Set(f.births.map(v=>v.command.attackId)).size,1);
    assert.equal(f.rolls.length,4);assert.ok(f.rolls.every(v=>v.success));
    near(f.record.bb['attack@stun'],stuns[rank-1]);near(f.u.skill.sp,0);
  }
});
test('CAST births happen before damage; each impact waits its own native lifetime',()=>{
  const f=make();enemy(f);activate(f);until(f,()=>f.births.length===4);assert.equal(f.hits.length,0);
  for(let i=0;i<4;i++)near(f.births[i].time-f.births[0].time,.15*i,f.b.dt+1e-6);
  until(f,()=>f.impacts.length===4);
  for(let i=0;i<4;i++)near(f.impacts[i].time-f.births[i].time,1.2,f.b.dt+1e-6);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2');near(f.u.mem.regularFormVisual.speed,1);
});
test('all four facings retain normal ground selection and original S2 visual',()=>{
  for(const dir of ['RIGHT','LEFT','UP','DOWN']){
    const f=make({dir}),[row,col]={RIGHT:[5,6],LEFT:[5,4],UP:[6,5],DOWN:[4,5]}[dir];
    enemy(f,{row,col});activate(f);until(f,()=>f.impacts.length===4);assert.equal(f.hits.length,4);
    assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2');
  }
});
test('S2 is ready after source time SP recovery but never automatically activates',()=>{
  const f=make();enemy(f);advance(f.b,11);assert.equal(f.u.skill.ready,true);assert.equal(f.u.skill.active,false);
  assert.equal(f.births.length,0);assert.ok(f.attacks.length>=3);assert.ok(f.hits.every(v=>v.amount===688||v.amount===344));
});
test('manual S2 permits no enemy and activation during entrance; attacks still wait for entrance completion',()=>{
  const f=make();activate(f);advance(f.b,.5);assert.equal(f.births.length,0);enemy(f);
  until(f,()=>f.births.length===1);assert.ok(f.births[0].time>=1);near(f.hits.length,0);
  const g=make();activate(g);advance(g.b,2);assert.equal(g.u.skill.active,true);assert.equal(g.births.length,0);
});
test('S2 radius 1.5 selects camouflage splash recipients but excludes outside, air, stealth and sleep',()=>{
  const f=make(),a=enemy(f),z=enemy(f,{col:7.4,flags:{camou:true}}),outside=enemy(f,{col:7.6,flags:{camou:true}});
  enemy(f,{col:6,fly:true});enemy(f,{col:6,flags:{stealth:true}});enemy(f,{col:6,flags:{sleep:true}});
  activate(f);until(f,()=>f.impacts.length===4);assert.equal(f.hits.length,8);
  assert.deepEqual(new Set(f.hits.map(v=>v.target)),new Set([a,z]));near(outside.hp,1e7);
});
test('aftershock CAST emissions reselect current priority and retain their separate birth centres',()=>{
  const f=make(),a=enemy(f);activate(f);until(f,()=>f.births.length===1);
  const z=enemy(f,{col:8,taunt:10});until(f,()=>f.births.length===4);
  near(f.births[0].projectile.x,6);for(const birth of f.births.slice(1))near(birth.projectile.x,8);
  a.x=10;a.tileC=10;z.x=11;z.tileC=11;f.b._buildEnemyIndex();
  const first=enemy(f,{col:6}),later=enemy(f,{col:8});until(f,()=>f.impacts.length===4);
  assert.equal(f.hits.filter(v=>v.target===first).length,1);assert.equal(f.hits.filter(v=>v.target===later).length,3);
  near(first.hp,1e7-1066.4);near(later.hp,1e7-533.2*3);near(a.hp,1e7);near(z.hp,1e7);
});
test('missing later CAST inputs suppress only those emissions and finish the accepted command without a leak',()=>{
  const f=make(),a=enemy(f);activate(f);until(f,()=>f.births.length===1);f.b.kill(a);
  advance(f.b,1.8);assert.equal(f.births.length,1);assert.equal(f.impacts.length,1);assert.equal(f.hits.length,0);
  assert.equal(f.controller.outputs.size,0);assert.equal(f.attacks.length,1);
});
test('birth centre survives original input death; impact damages new arrivals without tracking the old life',()=>{
  const f=make(),a=enemy(f);activate(f);until(f,()=>f.births.length===4);f.b.kill(a);
  const z=enemy(f,{col:6.1});until(f,()=>f.impacts.length===4);assert.equal(f.hits.length,4);
  assert.ok(f.hits.every(v=>v.target===z));assert.equal(f.u.stats.kills,0);
});
test('independent stun rolls cover every recipient and every projectile, including exact probability boundary',()=>{
  const f=make();enemy(f);enemy(f,{col:6.4});activate(f);until(f,()=>f.births.length===4);
  const values=[0,.2,.19,.99,.1,.21,.1999,1];let index=0;f.b.rng=()=>values[index++];
  until(f,()=>f.impacts.length===4);assert.equal(f.rolls.length,8);assert.equal(index,8);
  assert.deepEqual(f.rolls.map(v=>v.success),[true,false,true,false,true,false,true,false]);
});
test('stun follows immunity, status resistance and refresh without merging damage receipts',()=>{
  const f=make(),a=enemy(f),immune=enemy(f,{col:6.4});immune.def.immune.add('stun');
  f.b.applyStatus(a,'resist',{duration:10});const applied=[];
  f.b.on('statusApplied',ctx=>{if(ctx.status==='stun')applied.push(ctx);});f.b.rng=()=>0;
  activate(f);until(f,()=>f.impacts.length===4);assert.equal(f.hits.length,8);
  assert.equal(applied.length,4);assert.ok(applied.every(v=>v.target===a));for(const v of applied)near(v.duration,.75);
  assert.equal(!!immune.s.flags.stun,false);
});
test('stun survives a dodged or shielded Physical hit because the native active buff is not damage-missable',()=>{
  for(const protection of ['dodge','barrier']){
    const f=make(),a=enemy(f);activate(f);
    f.b.addBuff(a,protection==='dodge'?{key:'fixture:dodge',mods:{dodgePhys:1}}:{key:'fixture:barrier',shieldHits:4});
    f.b.rng=()=>0;until(f,()=>f.impacts.length===4);near(a.hp,1e7);assert.equal(f.rolls.length,4);
    assert.ok(a.s.flags.stun);assert.equal(f.attacks.length,1);
  }
});
test('source penetration mitigates each half receipt separately; no module Arts or extra stun is fabricated',()=>{
  const f=make();enemy(f,{def:500,res:50});activate(f);f.b.rng=()=>.99;until(f,()=>f.hits.length===4);
  near(f.hits[0].amount,1066.4-340);for(const hit of f.hits.slice(1))near(hit.amount,533.2-340);
  assert.equal(f.rolls.length,4);assert.ok(f.rolls.every(v=>!v.success));
});
test('accepted volleys finish after control or withdrawal and cleanup cancels only on battle finish',()=>{
  for(const mode of ['control','withdraw']){
    const f=make();enemy(f);activate(f);until(f,()=>f.births.length===1);
    if(mode==='control')f.b.addBuff(f.u,{key:'fixture:stun',flags:{stun:true}});
    else f.b.retreat(f.u,{permanent:true});until(f,()=>f.impacts.length===4);
    assert.equal(f.hits.length,4);assert.equal(f.attacks.length,1);assert.equal(f.controller.outputs.size,0);
    if(mode==='withdraw'){assert.equal(f.controller.finishHook,null);assert.equal(f.controller.handles.length,0);}
  }
});
test('battle finish from a birth callback cancels the whole volley and releases timers/hooks',()=>{
  const f=make();enemy(f);activate(f);f.b.on('rosmontisS2Birth',ctx=>{if(ctx.owner===f.u)f.b._finish('forced');});
  until(f,()=>f.b.finished);assert.equal(f.hits.length,0);assert.equal(f.controller.outputs.size,0);
  assert.equal(f.controller.finishHook,null);assert.equal(f.controller.handles.length,0);advance(f.b,2);
});
test('rejected main launch emits nothing and does not cancel the timed S2',()=>{
  const f=make();enemy(f);activate(f);f.b.on('beforeAttack',ctx=>{if(ctx.attacker===f.u)ctx.targets=[];});
  advance(f.b,5);assert.equal(f.births.length,0);assert.equal(f.hits.length,0);assert.equal(f.attacks.length,0);
  assert.equal(f.u.skill.active,true);near(f.u.skill.sp,0);
});
test('mode start cancels an unborn ordinary input without duplicating its attack or inherited generic aftershock',()=>{
  const f=make();enemy(f);until(f,()=>f.controller.phase?.kind==='attack');activate(f);
  until(f,()=>f.impacts.length===4);assert.equal(f.hits.length,4);assert.equal(f.attacks.length,1);
  assert.equal(f.births.length,4);assert.equal(f.hits[0].amount,1066.4);
});
test('already accepted ordinary aftershock survives mode start and reads current buffed ATK',()=>{
  const f=make();enemy(f);until(f,()=>f.hits.length===1);activate(f);until(f,()=>f.hits.length===2);
  near(f.hits[0].amount,688);near(f.hits[1].amount,533.2);assert.equal(f.impacts.length,0);
});
test('ASPD changes emission cadence but not absolute projectile lifetime; visual cap does not lock attack cooldown',()=>{
  const f=make();enemy(f);activate(f);f.b.addBuff(f.u,{key:'fixture:speed',mods:{aspd:200}});
  until(f,()=>f.births.length>=5);near(f.u.s.interval,1.05);near(f.u.mem.regularFormVisual.speed,1);
  const first=f.births.slice(0,4);for(let i=0;i<4;i++)near(first[i].time-first[0].time,.05*i,f.b.dt+1e-6);
  near(f.births[4].time-first[0].time,1.05,f.b.dt+1e-6);assert.equal(f.attacks.length,2);
  until(f,()=>f.impacts.length>=4);for(let i=0;i<4;i++)near(f.impacts[i].time-first[i].time,1.2,f.b.dt+1e-6);
});
test('born projectile reads live ATK at impact; stopping S2 removes its bonus without changing splash or stun',()=>{
  const f=make();enemy(f);activate(f);until(f,()=>f.births.length===4);f.u.skill.end('fixture');
  until(f,()=>f.impacts.length===4);near(f.hits[0].amount,688);for(const hit of f.hits.slice(1))near(hit.amount,344);
  assert.equal(f.rolls.length,4);near(f.u.s.interval,2.1);
});
test('full source duration expires once, blocks time SP while active and resumes source SP afterward',()=>{
  const f=make({rank:1});activate(f);advance(f.b,29);assert.equal(f.u.skill.active,true);near(f.u.skill.sp,0);
  advance(f.b,1.1);assert.equal(f.u.skill.active,false);near(f.u.s.atk,688);near(f.u.s.interval,2.1);
  assert.ok(f.u.skill.sp>0&&f.u.skill.sp<.3);advance(f.b,1);assert.ok(f.u.skill.sp>1);
});
test('silence leaves nonsilenceable S2 and talents active, while stun prevents new commands',()=>{
  const f=make();caster(f);enemy(f);f.b.addBuff(f.u,{key:'fixture:silence',flags:{silence:true}});activate(f);
  until(f,()=>f.impacts.length===4);near(f.u.s.atk,688*(1+.08+.55));assert.equal(f.u.s.defIgnoreFlat,160);
  f.b.addBuff(f.u,{key:'fixture:stun',flags:{stun:true}});const count=f.attacks.length;advance(f.b,4);
  assert.equal(f.attacks.length,count);assert.equal(f.u.skill.active,true);
});
test('stun callbacks replacing a target life cannot transfer the selected status to that life',()=>{
  const f=make(),a=enemy(f);activate(f);f.b.rng=()=>0;
  f.b.on('rosmontisS2StunRoll',ctx=>{if(ctx.target===a)a.deploySeq++;});until(f,()=>f.impacts.length===4);
  assert.equal(f.rolls.length,4);assert.equal(!!a.s.flags.stun,false);
});

test('E1 potential/trust selection keeps source S2 coefficients and flat 105 DEF penetration without an E2 aura',()=>{
  const f=make({elite:1,potential:5,trust:100});const a=caster(f);enemy(f,{def:300});activate(f);
  near(f.u.base.atk,676);near(f.u.s.atk,676*1.3);near(f.u.s.defIgnoreFlat,105);near(a.s.atk,100);
  until(f,()=>f.impacts.length===4);near(f.hits[0].amount,878.8-195);
  for(const hit of f.hits.slice(1))near(hit.amount,439.4-195);
});
test('late ASPD changes cannot reschedule already accepted aftershock emissions or impacts',()=>{
  const f=make();enemy(f);activate(f);until(f,()=>f.births.length===1);
  f.b.addBuff(f.u,{key:'fixture:late-speed',mods:{aspd:200}});until(f,()=>f.impacts.length===4);
  for(let i=0;i<4;i++)near(f.births[i].time-f.births[0].time,.15*i,f.b.dt+1e-6);
  for(let i=0;i<4;i++)near(f.impacts[i].time-f.births[i].time,1.2,f.b.dt+1e-6);
});
test('ending S2 between emissions preserves the accepted volley but no longer contributes S2 ATK',()=>{
  const f=make();enemy(f);activate(f);until(f,()=>f.births.length===1);f.u.skill.end('fixture');
  until(f,()=>f.impacts.length===4);assert.equal(f.births.length,4);assert.equal(f.attacks.length,1);
  near(f.hits[0].amount,688);for(const hit of f.hits.slice(1))near(hit.amount,344);assert.equal(f.rolls.length,4);
});
test('control inside beforeAttack rejects an unborn launch and leaves the source timed skill active',()=>{
  const f=make();enemy(f);activate(f);
  f.b.on('beforeAttack',ctx=>{if(ctx.attacker===f.u)f.b.applyStatus(f.u,'stun',{duration:.001});});
  advance(f.b,4);assert.equal(f.births.length,0);assert.equal(f.attacks.length,0);assert.equal(f.u.skill.active,true);
  assert.equal(f.controller.outputs.size,0);assert.equal(f.u.skill.pending,false);
});
test('skill-start withdrawal clears aura and active skill; skill-start control delays attacks without ending S2',()=>{
  for(const mode of ['withdraw','control']){
    const f=make();caster(f);enemy(f);
    f.b.on('skillStart',ctx=>{if(ctx.unit===f.u){
      if(mode==='withdraw')f.b.retreat(f.u,{permanent:true});else f.b.applyStatus(f.u,'stun',{duration:5});
    }});activate(f);advance(f.b,2);assert.equal(f.births.length,0);assert.equal(f.controller.outputs.size,0);
    assert.equal(f.u.skill.active,mode==='control');
    if(mode==='withdraw'){assert.equal(f.controller.aura.claims.size,0);assert.equal(f.controller.handles.length,0);}
  }
});
test('battle finish from an impact callback cancels damage, stun and later impacts',()=>{
  const f=make();enemy(f);activate(f);f.b.on('rosmontisS2Impact',ctx=>{if(ctx.owner===f.u)f.b._finish('forced');});
  until(f,()=>f.b.finished);assert.equal(f.hits.length,0);assert.equal(f.rolls.length,0);
  assert.equal(f.controller.outputs.size,0);assert.equal(f.controller.finishHook,null);
});
test('battle finish from a damage callback stops later recipients and status transfer',()=>{
  const f=make();enemy(f);enemy(f,{col:6.4});activate(f);
  f.b.on('damaged',ctx=>{if(ctx.source===f.u)f.b._finish('forced');});until(f,()=>f.b.finished);
  assert.equal(f.hits.length,1);assert.equal(f.rolls.length,0);assert.equal(f.controller.outputs.size,0);
});
test('four distinct receipts retain one command and ordinary owner kill credit',()=>{
  const f=make(),a=enemy(f,{hp:2300});activate(f);f.b.rng=()=>.99;until(f,()=>f.impacts.length===4);
  assert.equal(a.alive,false);assert.equal(f.hits.length,4);assert.equal(f.u.stats.kills,1);
  assert.equal(f.attacks.length,1);assert.equal(f.controller.outputs.size,0);
});
test('fresh owner cannot inherit old S2 mode, SP, pending output or aura claims',()=>{
  const f=make();enemy(f);activate(f);until(f,()=>f.births.length===1);f.b.retreat(f.u,{permanent:true});
  const g=make({battle:f.b,defer:true});g.u.homeR=7;g.u.homeC=7;g.deploy();
  near(g.u.skill.sp,20);assert.equal(g.u.skill.active,false);assert.equal(g.controller.outputs.size,0);
  assert.equal(g.controller.phase.kind,'entrance');until(f,()=>f.impacts.length===4);
  assert.equal(f.hits.length,4);assert.equal(g.hits.length,0);assert.equal(f.controller.finishHook,null);
});

test('external percentage BAT modifiers combine additively with S2 and slow captured emission/visual clocks',()=>{
  const f=make();enemy(f);activate(f);f.b.addBuff(f.u,{key:'fixture:slow',mods:{batPct:.5}});
  near(f.u.s.bat,4.2);near(f.u.s.interval,4.2);until(f,()=>f.births.length===4);
  near(f.u.mem.regularFormVisual.speed,.75);
  for(let i=0;i<4;i++)near(f.births[i].time-f.births[0].time,.2*i,f.b.dt+1e-6);
  until(f,()=>f.impacts.length===4);for(let i=0;i<4;i++)near(f.impacts[i].time-f.births[i].time,1.2,f.b.dt+1e-6);
});
