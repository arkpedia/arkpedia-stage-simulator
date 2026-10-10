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
import { ROSMONTIS_S3_CONTRACT as CONTRACT, ROSMONTIS_EQUIPMENT, prepareRosmontisS3 } from '../server/sim/content/arkpedia-rosmontis-s3.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps, `${a} != ${z}`);
function advance(b,s) { for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++) b.step(); assert.deepEqual(b.errors,[]); }
function until(f,p,s=12) { const end=f.b.time+s; while(!p()&&f.b.time<end) advance(f.b,f.b.dt);
  assert.ok(p(),`Expected condition at ${f.b.time}, phase ${f.controller.phase?.kind}`); }
function make({rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=3,dir='RIGHT',defer=false,battle=null,contract=CONTRACT}={}) {
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
  const prepared=prepareRosmontisS3(b,u,{contract}); b._setupUnit(u,prepared.kit); prepared.controller.install();
  const deploy=()=>{assert.ok(b._deploy(u,{initial:false})); b.getPlayer('arkpedia').dp=99;};
  const hits=[],attacks=[],births=[];
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});
  b.on('rosmontisS3Birth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
  if(!defer)deploy(); return {b,u,build,deploy,hits,attacks,births,...prepared};
}
function enemy(f,{row=5,col=6,def=0,res=0,hp=1e7,fly=false,taunt=0,flags={}}={}) {
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  t.def={...t.def,immune:new Set(t.def.immune)};
  Object.assign(t.base,{maxHp:hp,atk:500,def,res,moveSpeed:0,tauntLevel:taunt}); t.markDirty();t.hp=hp;
  if(fly)t.motion='FLY'; f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});
  f.b._buildEnemyIndex();return t;
}
function legal(f,coords=[]){
  f.b.grid.tiles=f.b.grid.tiles.map(t=>({...t,build:'NONE'}));
  for(const [r,c] of coords)f.b.grid.tiles[f.b.grid.key(r,c)].build='MELEE';
}
function guard(f,{row=5,col=8,block=2,fly=false}={}){
  const def=normalizeChess({chessId:`fixture:${row}:${col}`,charId:'fixture',profession:'GUARD',
    stats:{maxHp:1e7,atk:1,def:0,blockCnt:block},rangeGrid:[[0,0]],skill:null});
  const a=f.b._makeAlly(f.u.player,def,'op',row,col);f.b._setupUnit(a,{trait:{noAttack:true},skill:null});
  if(fly)f.b.addBuff(a,{key:'fixture:fly-block',flags:{blockFly:true},allowDead:true,persist:true});
  assert.ok(f.b._deploy(a));return a;
}
const ready=f=>f.u.skill.addCharge(1);
const activate=f=>{ready(f);assert.equal(f.u.skill.activate('fixture'),true);};
const tokens=f=>[...f.controller.equipment.tokens.keys()];

test('S3 is private; fresh exact selected source and contract are required',()=>{
  assert.equal(REGULAR_OPERATORS[ID],undefined);assert.equal(data.operators[ID],undefined);
  assert.deepEqual(e.enabledOperators,[]);assert.equal(CONTRACT.frameParity,false);
  assert.throws(()=>make({skill:1}),/Incomplete/);assert.throws(()=>make({skill:2}),/Incomplete/);
  assert.throws(()=>make({contract:{...CONTRACT}}),/contract/);
  const f=make({defer:true});
  for(const change of [d=>d.stats.atk++,d=>d.skill.bb.def++,d=>d.skill.bb.stun++,
    d=>d.skill.spCost++,d=>d.skill.duration++,d=>d.rangeGrid=[],d=>d.raw.arkpedia.module='bombarder-x']){
    const def=structuredClone(f.u.def);change(def);const u=f.b._makeAlly(f.u.player,def,'op',7,7);
    assert.throws(()=>prepareRosmontisS3(f.b,u,{contract:CONTRACT}));
  }
  f.deploy();assert.throws(()=>prepareRosmontisS3(f.b,f.u,{contract:CONTRACT}),/fresh/);
});
test('all ten ranks retain paired equipment, source ATK, unchanged DEF and half attack interval',()=>{
  const scales=[.1,.15,.2,.25,.3,.35,.4,.5,.6,.75],durations=[25,25,25,26,26,26,27,28,29,30];
  const costs=[80,79,78,77,76,75,74,70,66,60];
  for(let rank=1;rank<=10;rank++){
    const f=make({rank});legal(f,[[5,6]]);enemy(f);near(f.u.skill.sp,35);
    const def=f.u.s.def;activate(f);near(f.u.s.atk,688*(1+scales[rank-1]));near(f.u.s.def,def);
    near(f.u.s.interval,1.05);near(f.u.skill.duration,durations[rank-1]);near(f.u.skill.spCost,costs[rank-1]);
    until(f,()=>f.births.length===2);near(f.hits[0].amount,688*(1+scales[rank-1]));
    near(f.hits[1].amount,344*(1+scales[rank-1]));assert.equal(f.attacks.length,1);
    assert.equal(f.record.tokenBb.stun,f.record.bb.stun);near(f.u.skill.sp,0);
  }
});
test('zero, one and two legal tiles never gate activation; equipment does not consume DP or slots',()=>{
  for(const coords of [[],[[5,6]],[[5,6],[5,7]]]){
    const f=make();legal(f,coords);const dp=f.u.player.dp;activate(f);
    assert.equal(tokens(f).length,coords.length);near(f.u.player.dp,dp);assert.equal(f.u.skill.active,true);
    for(const t of tokens(f)){assert.equal(t.kind,'token');assert.equal(t.deploymentSlotCost,0);assert.equal(t.def.spine,ROSMONTIS_EQUIPMENT);}
  }
});
test('equipment stats follow the selected owner level without trust or potential bonuses',()=>{
  for(const level of [1,45,90]){
    const f=make({level,potential:6,trust:200});legal(f,[[5,6]]);activate(f);const t=tokens(f)[0];
    const frames=e.tables.token.phases[2].attributesKeyFrames,a=frames[0],z=frames.at(-1),ratio=(level-a.level)/(z.level-a.level);
    for(const key of ['maxHp','atk','def'])near(t.base[key],Math.round(a.data[key]+(z.data[key]-a.data[key])*ratio));
    assert.equal(t.base.blockCnt,2);assert.equal(t.dir,'RIGHT');assert.deepEqual(t.rangeGrid,[[0,0]]);
  }
});
test('placement ranks enemy roots by minimum root taunt then nearby tiles',()=>{
  const f=make();legal(f,[[5,6],[5,7],[5,8],[4,6]]);enemy(f,{col:6,taunt:5});enemy(f,{col:6,taunt:-5});
  enemy(f,{col:8,taunt:0});f.b.rng=()=>.5;
  assert.deepEqual(f.controller.equipment.select().map(t=>[t.row,t.col]),[[5,8],[5,6]]);
  f.b.enemies.forEach(t=>f.b.kill(t));enemy(f,{col:6});legal(f,[[5,7],[5,8],[4,6]]);
  assert.deepEqual(f.controller.equipment.select().map(t=>[t.row,t.col]),[[4,6],[5,7]]);
});
test('placement excludes occupied, high, ranged-only, obstructed and out-of-range tiles',()=>{
  const f=make();legal(f,[[5,6],[5,7],[5,8],[4,6],[4,7],[5,4]]);guard(f,{col:6});
  f.b.grid.tile(5,7).height='HIGH';f.b.grid.tile(5,8).build='RANGED';f.b.grid.obstacle[f.b.grid.key(4,6)]=true;
  assert.deepEqual(f.controller.equipment.select().map(t=>[t.row,t.col]),[[4,7]]);
});
test('no target fallback random ties are reproducible and select distinct tiles',()=>{
  const f=make();legal(f,[[5,6],[5,7],[5,8]]);f.b.rng=()=>.5;
  assert.deepEqual(f.controller.equipment.select().map(t=>[t.row,t.col]),[[5,6],[5,7]]);
  activate(f);assert.deepEqual(tokens(f).map(t=>[t.tileR,t.tileC]),[[5,6],[5,7]]);
});
test('equipment Start holds blocking; completion stuns only source centre ground recipients',()=>{
  const f=make();legal(f,[[5,6]]);const a=enemy(f),outside=enemy(f,{col:7}),air=enemy(f,{fly:true});
  const applied=[];f.b.on('statusApplied',ctx=>{if(ctx.status==='stun')applied.push({...ctx,time:f.b.time});});
  activate(f);const t=tokens(f)[0];assert.equal(t.mem.regularFormVisual.clip,'Start');assert.ok(t.s.flags.noBlock);
  advance(f.b,.1);assert.equal(applied.length,0);assert.equal(a.blockedBy,null);
  until(f,()=>applied.length===1);near(applied[0].duration,3);near(applied[0].time,.13333334,f.b.dt);
  assert.equal(applied[0].target,a);assert.equal(t.mem.regularFormVisual.clip,'Idle');assert.equal(!!t.s.flags.noBlock,false);
  assert.equal(!!outside.s.flags.stun,false);assert.equal(!!air.s.flags.stun,false);
});
test('equipment blocks two actual enemies, reduces only their DEF and releases claims on unblock',()=>{
  const f=make();legal(f,[[5,6]]);const a=enemy(f,{def:500}),z=enemy(f,{def:500}),third=enemy(f,{def:500});activate(f);
  until(f,()=>a.blockedBy&&z.blockedBy);const t=tokens(f)[0];assert.equal(a.blockedBy,t);assert.equal(z.blockedBy,t);
  near(a.s.def,340);near(z.s.def,340);near(third.s.def,500);assert.equal(third.blockedBy,null);
  f.b.addBuff(t,{key:'fixture:no-block',flags:{noBlock:true}});advance(f.b,f.b.dt);
  assert.equal(a.blockedBy,null);near(a.s.def,500);near(z.s.def,500);assert.equal(f.controller.equipment.claims.size,0);
});
test('equipment heals and both regeneration additions are prohibited; enemies can damage and kill it',()=>{
  const f=make();legal(f,[[5,6]]);activate(f);const t=tokens(f)[0];f.b.loseHp(t,1000);near(t.hp,4000);
  near(f.b.heal(f.u,t,1000),0);f.b.addBuff(t,{key:'fixture:regen',mods:{hpRegenFlat:500,hpRegenPct:.1}});
  advance(f.b,1);near(t.hp,4000);const a=enemy(f);f.b.dealDamage(a,t,{amount:10000,type:'true'});
  assert.equal(t.alive,false);assert.equal(tokens(f).length,0);advance(f.b,2);assert.equal(tokens(f).length,0);
});
test('zero damage landing stun respects immunity and resistance',()=>{
  const f=make();legal(f,[[5,6]]);const a=enemy(f),immune=enemy(f);immune.def.immune.add('stun');
  f.b.applyStatus(a,'resist',{duration:10});const applied=[];
  f.b.on('statusApplied',ctx=>{if(ctx.status==='stun')applied.push(ctx);});activate(f);advance(f.b,.2);
  assert.equal(applied.length,1);near(applied[0].duration,1.5);assert.equal(applied[0].target,a);assert.equal(!!immune.s.flags.stun,false);
});
test('S3 attacks only blocked inputs and prefers own equipment over other blockers',()=>{
  const f=make();legal(f,[[5,6]]);const own=enemy(f,{col:6,taunt:-10}),g=guard(f,{col:8});
  const other=enemy(f,{col:8,taunt:10}),ignored=enemy(f,{col:9,taunt:100});own.def.immune.add('stun');activate(f);
  until(f,()=>f.births.length>=2);assert.equal(other.blockedBy,g);assert.equal(ignored.blockedBy,null);
  assert.deepEqual(f.births.filter(v=>v.index===0).map(v=>v.command.trace),[own,other]);assert.equal(f.attacks.length,1);
});
test('blocked flying primary receives main hit but never aftershock; nearby air is never splashed',()=>{
  const f=make();legal(f,[]);const g=guard(f,{col:7,fly:true,block:1}),a=enemy(f,{col:7,fly:true});
  const extra=enemy(f,{col:7.3,fly:true});activate(f);until(f,()=>f.births.length>=2);
  assert.equal(a.blockedBy,g);assert.equal(f.hits.filter(v=>v.target===a).length,1);
  assert.equal(f.hits.filter(v=>v.target===extra).length,0);
});
test('ground splash can damage unblocked nearby enemies but excludes outside, sleep and stealth',()=>{
  const f=make();legal(f,[]);guard(f,{col:7,block:1});const a=enemy(f,{col:7});
  const nearby=enemy(f,{col:7.8,flags:{camou:true}}),outside=enemy(f,{col:8}),sleep=enemy(f,{col:7.4,flags:{sleep:true}});
  activate(f);until(f,()=>f.births.length===2);assert.equal(nearby.blockedBy,null);assert.equal(f.hits.length,4);
  assert.deepEqual(new Set(f.hits.map(v=>v.target)),new Set([a,nearby]));near(outside.hp,1e7);near(sleep.hp,1e7);
});
test('explicit pre-delay/aftershock clocks preserve 1.05-second cadence independently of Loop clip length',()=>{
  const f=make();legal(f,[]);guard(f,{col:7});enemy(f,{col:7});activate(f);
  until(f,()=>f.births.length===1);near(f.births[0].time,.167+.17,f.b.dt*2);
  until(f,()=>f.births.length>=3);near(f.births[1].time-f.births[0].time,.15,f.b.dt);
  near(f.births[2].time-f.births[0].time,1.05,f.b.dt);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_Loop');
});
test('ASPD scales source pre-delay, aftershock delta and cadence while retaining the visual cap',()=>{
  const f=make();legal(f,[]);guard(f,{col:7});enemy(f,{col:7});activate(f);
  f.b.addBuff(f.u,{key:'fixture:speed',mods:{aspd:200}});until(f,()=>f.births.length>=3);
  near(f.births[1].time-f.births[0].time,.05,f.b.dt);near(f.births[2].time-f.births[0].time,.35,f.b.dt);
  near(f.u.mem.regularFormVisual.speed,1);
});
test('original Front and Back clips preserve all four facing attacks',()=>{
  for(const dir of ['RIGHT','LEFT','UP','DOWN']){
    const f=make({dir});legal(f,[]);const [row,col]={RIGHT:[5,7],LEFT:[5,3],UP:[7,5],DOWN:[3,5]}[dir];
    guard(f,{row,col});enemy(f,{row,col});activate(f);until(f,()=>f.births.length===2);assert.equal(f.hits.length,2);
  }
});
test('PRECAST inputs are not substituted when killed or changed before release',()=>{
  const f=make();legal(f,[]);guard(f,{col:7});const a=enemy(f,{col:7}),z=enemy(f,{col:7});activate(f);
  until(f,()=>f.controller.phase?.kind==='s3-attack');f.b.kill(a);z.deploySeq++;
  const replacement=enemy(f,{col:7});advance(f.b,.3);assert.equal(f.births.length,0);near(replacement.hp,1e7);
});
test('captured root centre survives input death; aftershock damages new ground arrivals',()=>{
  const f=make();legal(f,[]);guard(f,{col:7});const a=enemy(f,{col:7});activate(f);
  until(f,()=>f.births.length===1);f.b.kill(a);const z=enemy(f,{col:7.1});until(f,()=>f.births.length===2);
  assert.equal(f.hits.at(-1).target,z);near(f.hits.at(-1).amount,602);
});
test('accepted aftershock survives withdrawal and uses current unbuffed owner ATK',()=>{
  const f=make();legal(f,[]);guard(f,{col:7});enemy(f,{col:7});activate(f);until(f,()=>f.births.length===1);
  f.b.retreat(f.u,{permanent:true});until(f,()=>f.births.length===2);near(f.hits[0].amount,1204);near(f.hits[1].amount,344);
  assert.equal(f.controller.outputs.size,0);assert.equal(f.controller.finishHook,null);
});
test('control cancels unborn launches without ending the timed mode or withdrawing equipment',()=>{
  const f=make();legal(f,[[5,6]]);enemy(f);activate(f);until(f,()=>f.controller.phase?.kind==='s3-attack');
  f.b.addBuff(f.u,{key:'fixture:stun',flags:{stun:true}});advance(f.b,.5);assert.equal(f.births.length,0);
  assert.equal(f.u.skill.active,true);assert.equal(tokens(f).length,1);f.b.removeBuff(f.u,'fixture:stun');
  until(f,()=>f.births.length>=2);assert.equal(f.attacks.length,1);
});
test('equipment lives through source 30-second mode; ending removes it and blocks SP/casts through End',()=>{
  const f=make();legal(f,[[5,6]]);activate(f);advance(f.b,26);assert.equal(tokens(f).length,1);near(f.u.skill.sp,0);
  advance(f.b,4);assert.equal(f.u.skill.active,false);assert.equal(tokens(f).length,0);near(f.u.s.atk,688);
  assert.equal(f.controller.phase.kind,'s3-end');near(f.u.skill.sp,0);ready(f);assert.equal(f.u.skill.activate('fixture'),false);
  advance(f.b,.5);assert.equal(f.u.skill.activate('fixture'),true);
});
test('owner finish cancels equipment births and owned claims, with idempotent install/stop',()=>{
  const f=make();legal(f,[[5,6],[5,7]]);enemy(f);const handles=f.controller.handles.length;f.controller.install();
  assert.equal(f.controller.handles.length,handles);activate(f);const original=tokens(f);
  f.b.retreat(f.u,{permanent:true});assert.equal(tokens(f).length,0);assert.ok(original.every(t=>!t.alive));
  advance(f.b,.3);assert.equal(f.controller.equipment.claims.size,0);f.controller.stop();f.controller.install();
  assert.equal(f.controller.handles.length,0);
});
test('battle finish cancels accepted aftershock and withdraws equipment without leaked hooks',()=>{
  const f=make();legal(f,[[5,6]]);enemy(f);activate(f);
  f.b.on('rosmontisS3Birth',ctx=>{if(ctx.owner===f.u)f.b._finish('forced');});until(f,()=>f.b.finished);
  assert.equal(f.hits.length,0);assert.equal(tokens(f).length,0);assert.equal(f.controller.outputs.size,0);
  assert.equal(f.controller.finishHook,null);assert.equal(f.controller.handles.length,0);advance(f.b,1);
});
test('owner withdrawal during first equipment deploy cannot orphan a token or place a second',()=>{
  const f=make();legal(f,[[5,6],[5,7]]);const seen=[];
  f.b.on('deploy',({unit})=>{if(unit.mem.rosmontisEquipment){seen.push(unit);f.b.retreat(f.u,{permanent:true});}});
  activate(f);assert.equal(seen.length,1);assert.equal(seen[0].alive,false);assert.equal(tokens(f).length,0);
  assert.equal(f.u.findBuff('rosmontis:s3-mode'),null);advance(f.b,1);
});
test('mode finish during spawn hook removes all equipment before mode modifier installation',()=>{
  const f=make();legal(f,[[5,6],[5,7]]);
  f.b.on('rosmontisEquipmentSpawn',()=>f.u.skill.end('fixture'));activate(f);
  assert.equal(f.u.skill.active,false);assert.equal(tokens(f).length,0);near(f.u.s.atk,688);advance(f.b,1);
});
test('equipment death releases DEF claim; replacing that key externally is preserved',()=>{
  const f=make();legal(f,[[5,6]]);const a=enemy(f,{def:500});activate(f);until(f,()=>a.blockedBy);
  const claim=f.controller.equipment.claims.get(a);assert.ok(claim);f.b.removeBuff(a,claim.buff);
  const replacement=f.b.addBuff(a,{key:claim.key,mods:{defFlat:-20}});f.controller.equipment.sync();
  f.b.kill(tokens(f)[0]);assert.equal(a.findBuff(claim.key),replacement);near(a.s.def,480);
});
test('losing one PRECAST input preserves the other without substituting a third',()=>{
  const f=make();legal(f,[]);guard(f,{col:7});const a=enemy(f,{col:7}),z=enemy(f,{col:7});activate(f);
  until(f,()=>f.controller.phase?.kind==='s3-attack');f.b.kill(a);const replacement=enemy(f,{col:7});
  until(f,()=>f.births.length===2);assert.deepEqual(f.births.map(v=>v.command.trace),[z,z]);
  assert.equal(f.attacks.length,1);assert.equal(f.hits.filter(v=>v.target===replacement).length,2);
});
test('two overlapping inputs keep separate circles and four independently mitigated receipts',()=>{
  const f=make();legal(f,[]);guard(f,{col:7});const a=enemy(f,{col:7,def:500}),z=enemy(f,{col:7,def:500});activate(f);
  until(f,()=>f.births.length===4);assert.equal(f.attacks.length,1);assert.equal(f.hits.length,8);
  for(const target of [a,z]){
    const hits=f.hits.filter(v=>v.target===target);assert.equal(hits.length,4);
    near(hits[0].amount,864);near(hits[1].amount,864);near(hits[2].amount,262);near(hits[3].amount,262);
  }
});
test('accepted main and half-aftershock apply shields separately without extra attack events',()=>{
  const f=make();legal(f,[]);guard(f,{col:7});const a=enemy(f,{col:7});
  f.b.addBuff(a,{key:'fixture:shield',shieldHits:1});activate(f);until(f,()=>f.births.length===2);
  near(a.hp,1e7-602);assert.equal(f.attacks.length,1);assert.equal(f.hits.length,2);
  near(f.hits[0].amount,0);near(f.hits[1].amount,602);
});
test('accepted aftershock survives timed mode exit and reads changed current ATK',()=>{
  const f=make();legal(f,[]);guard(f,{col:7});enemy(f,{col:7});activate(f);until(f,()=>f.births.length===1);
  f.u.skill.end('fixture');f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkFlat:100}});
  until(f,()=>f.births.length===2);near(f.hits[1].amount,394);assert.equal(f.controller.phase.kind,'s3-end');
});
test('time SP makes S3 ready but never automatically casts; silence does not prevent activation',()=>{
  const f=make();legal(f,[]);advance(f.b,25.1);assert.equal(f.u.skill.ready,true);assert.equal(f.u.skill.active,false);
  f.b.addBuff(f.u,{key:'fixture:silence',flags:{silence:true}});assert.equal(f.u.skill.activate('fixture'),true);
  assert.equal(f.u.s.defIgnoreFlat,160);
});
test('rejected launch leaves duration and equipment active without issuing a command',()=>{
  const f=make();legal(f,[[5,6]]);const a=enemy(f);a.def.immune.add('stun');activate(f);
  f.b.on('beforeAttack',ctx=>{if(ctx.attacker===f.u)ctx.targets=[];});advance(f.b,5);
  assert.equal(f.births.length,0);assert.equal(f.attacks.length,0);assert.equal(f.u.skill.active,true);assert.equal(tokens(f).length,1);
});
test('landing callback withdrawal cannot stun enemies or leave equipment behind',()=>{
  const f=make();legal(f,[[5,6]]);const a=enemy(f);
  f.b.on('rosmontisEquipmentReady',()=>f.b.retreat(f.u,{permanent:true}));activate(f);advance(f.b,.3);
  assert.equal(!!a.s.flags.stun,false);assert.equal(tokens(f).length,0);assert.equal(f.controller.handles.length,0);
});
test('reentrant owner withdrawal while adding a blockee DEF buff cannot orphan a claim',()=>{
  const f=make();legal(f,[[5,6]]);const a=enemy(f,{def:500});a.def.immune.add('stun');
  f.b.on('beforeBuff',ctx=>{if(ctx.unit===a&&ctx.buff.key.startsWith('rosmontis:block-def:'))f.b.retreat(f.u,{permanent:true});});
  activate(f);advance(f.b,.3);assert.equal(tokens(f).length,0);assert.equal(f.controller.equipment.claims.size,0);
  near(a.s.def,500);assert.equal(a.blockedBy,null);
});
test('unavailable tiles after PRECAST placement snapshot are skipped instead of selecting replacements',()=>{
  const f=make();legal(f,[[5,6],[5,7],[5,8]]);f.b.rng=()=>.5;
  f.b.on('rosmontisEquipmentSpawn',()=>{f.b.grid.tile(5,7).build='NONE';});activate(f);
  assert.deepEqual(tokens(f).map(t=>[t.tileR,t.tileC]),[[5,6]]);assert.equal(f.u.skill.active,true);
});
test('battle finish during equipment spawn terminates the skill and cancels remaining placements',()=>{
  const f=make();legal(f,[[5,6],[5,7]]);f.b.on('rosmontisEquipmentSpawn',()=>f.b._finish('forced'));activate(f);
  assert.equal(f.u.skill.active,false);assert.equal(tokens(f).length,0);assert.equal(f.controller.outputs.size,0);
  assert.equal(f.controller.handles.length,0);assert.equal(f.controller.finishHook,null);
});
