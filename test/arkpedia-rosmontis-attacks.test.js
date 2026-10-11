// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type:'json' };
import e from '../data/arkpedia-rosmontis-prefabs.json' with { type:'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { ROSMONTIS_ID as ID, ROSMONTIS_ATTACK_CONTRACT as CONTRACT, selectedRosmontisBuild,
  prepareRosmontisAttacks } from '../server/sim/content/arkpedia-rosmontis-attacks.js';
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
  b.autoFinish=false; b.recordEvents=true; b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const build={elite,level,potential,trust,skillId:`skchr_rosmon_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedRosmontisBuild(build), c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,
    subProfessionId:c.subProfessionId,position:c.position,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',5,5,{dir});
  const prepared=prepareRosmontisAttacks(b,u,{contract}); b._setupUnit(u,prepared.kit); prepared.controller.install();
  const deploy=()=>{assert.ok(b._deploy(u,{initial:false})); b.getPlayer('arkpedia').dp=99;};
  const hits=[],attacks=[],births=[];
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});
  b.on('rosmontisProjectileBirth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
  if(!defer)deploy(); return {b,u,build,deploy,hits,attacks,births,...prepared};
}
function enemy(f,{row=5,col=6,def=0,res=0,hp=1e7,fly=false,taunt=0,flags={}}={}) {
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
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

test('ordinary/S1 adapter retains exact contracts after public integration',()=>{
  assert.equal(REGULAR_OPERATORS[ID].mechanic,'rosmontis');assert.ok(data.operators[ID]);
  assert.deepEqual(e.enabledOperators,[ID]);assert.deepEqual(e.heldOperators,[]);
  assert.equal(CONTRACT.frameParity,false); assert.throws(()=>make({skill:2}),/Incomplete/);
  assert.throws(()=>make({skill:3}),/Incomplete/); assert.throws(()=>make({contract:{...CONTRACT}}),/contract/);
});
test('source build uses level, trust, potential and elite-specific talents',()=>{
  const build={elite:2,level:90,potential:1,trust:0,skillId:'skchr_rosmon_1',skillRank:10};
  const r=selectedRosmontisBuild(build); near(r.stats.maxHp,1944);near(r.stats.atk,688);near(r.stats.def,245);
  near(r.stats.baseAttackTime,2.1);near(r.stats.magicResistance,15);near(r.penetration,160);near(r.aura,.08);
  const z=selectedRosmontisBuild({...build,potential:6,trust:200});near(z.stats.atk,780);near(z.stats.def,275);
  near(z.stats.cost,23);near(z.stats.respawnTime,66);near(z.penetration,175);
  const low=selectedRosmontisBuild({...build,elite:0,level:1,skillRank:1});near(low.penetration,0);near(low.aura,0);
  const one=selectedRosmontisBuild({...build,elite:1,level:1,skillRank:7});near(one.penetration,90);near(one.aura,0);
  near(selectedRosmontisBuild({...build,elite:1,level:1,skillRank:7,potential:5}).penetration,105);
  for(const change of [{level:0},{level:91},{potential:7},{trust:201},{skillRank:11},{module:'bombarder-x'},
    {elite:0,level:1,skillRank:1,skillId:'skchr_rosmon_2'}])assert.throws(()=>selectedRosmontisBuild({...build,...change}));
});
test('preparation rejects altered stats, ranges, ranks and native skill fields before adding hooks',()=>{
  const f=make({defer:true});
  for(const mutate of [d=>{d.stats.atk++;},d=>{d.skill.bb.extra_atk_scale++;},d=>{d.skill.spCost++;},
    d=>{d.skill.initSp++;},d=>{d.skill.maxCharges++;},d=>{d.skill.duration++;},d=>{d.skill.spType='time';},
    d=>{d.skill.skillType='MANUAL';},d=>{d.skill.rangeGrid=[[0,1]];},d=>{d.rangeGrid=[];},
    d=>{d.talents[0].bb.def_penetrate_fixed++;},d=>{d.raw.arkpedia.skillRank=9;}]){
    const def=structuredClone(f.u.def);mutate(def);const u=f.b._makeAlly(f.u.player,def,'op',7,7);
    const before=Object.values(f.b._hooks).flat().length;
    assert.throws(()=>prepareRosmontisAttacks(f.b,u,{contract:CONTRACT}));
    assert.equal(Object.values(f.b._hooks).flat().length,before);
  }
  assert.throws(()=>prepareRosmontisAttacks(f.b,f.u,{contract:CONTRACT}),/fresh/);
});
test('all four facings wait for original entrance/event and emit distinct main and half-strength aftershock',()=>{
  for(const dir of ['RIGHT','LEFT','UP','DOWN']){
    const f=make({dir}),[row,col]={RIGHT:[5,6],LEFT:[5,4],UP:[6,5],DOWN:[4,5]}[dir];enemy(f,{row,col});
    advance(f.b,1.4);assert.equal(f.hits.length,0);until(f,()=>f.hits.length===2);
    near(f.hits[0].amount,688);near(f.hits[1].amount,344);near(f.hits[0].time,1+.533333,f.b.dt*2+1e-6);
    near(f.hits[1].time-f.hits[0].time,.15,f.b.dt*2+1e-6);
    assert.equal(f.attacks.length,1);assert.equal(f.births.length,2);near(f.u.skill.sp,1);
    assert.equal(f.births[0].command.attackId,f.births[1].command.attackId);
  }
});
test('ordinary A/B alternate while S1 uses A without advancing the ordinary sequence',()=>{
  const f=make();enemy(f);until(f,()=>f.attacks.length===1);assert.equal(f.controller.nextOrdinary,'Attack_B');
  until(f,()=>f.attacks.length===2);assert.equal(f.controller.nextOrdinary,'Attack_A');
  until(f,()=>f.controller.phase?.skill);assert.equal(f.controller.phase.clip,'Attack_A');
  until(f,()=>f.attacks.length===3);assert.equal(f.controller.nextOrdinary,'Attack_A');
});
test('DEF penetration applies to each Physical receipt, not the combined damage',()=>{
  const f=make();enemy(f,{def:500,res:50});until(f,()=>f.hits.length===2);
  near(f.hits[0].amount,348);near(f.hits[1].amount,17.2);
  const g=make({potential:5});enemy(g,{def:500});until(g,()=>g.hits.length===2);
  near(g.hits[0].amount,395);near(g.hits[1].amount,35);
});
test('all ten S1 ranks add one independent Arts receipt and retain a Physical aftershock',()=>{
  const scales=[.8,.85,.95,1,1.05,1.1,1.2,1.4,1.6,1.8],costs=[4,4,4,4,4,4,3,3,3,2];
  for(let rank=1;rank<=10;rank++){
    const f=make({rank});enemy(f,{def:300,res:25});ready(f);until(f,()=>f.hits.length===3);
    near(f.hits[0].amount,548);near(f.hits[1].amount,688*scales[rank-1]*.75);near(f.hits[2].amount,204);
    assert.equal(f.u.skill.spCost,costs[rank-1]);assert.equal(f.attacks.length,1);near(f.u.skill.sp,0);
    assert.equal(f.u.skill.active,false);assert.equal(f.births[0].command.isSkill,true);
  }
});
test('splash uses new victims at each retained birth centre and includes camouflage, not air/sleep/stealth',()=>{
  const f=make(),a=enemy(f);const z=enemy(f,{col:6.5,flags:{camou:true}});
  const outside=enemy(f,{col:7});enemy(f,{col:6,fly:true});enemy(f,{col:6,flags:{sleep:true}});
  enemy(f,{col:6,flags:{stealth:true}});until(f,()=>f.hits.length===2);
  assert.deepEqual(new Set(f.hits.map(h=>h.target)),new Set([a,z]));
  a.x=9;a.tileC=9;z.x=9;z.tileC=9;const newcomer=enemy(f,{col:6.3});f.b._buildEnemyIndex();
  until(f,()=>f.births.length===2);assert.equal(f.hits.length,3);assert.equal(f.hits[2].target,newcomer);
  near(outside.hp,1e7);
});
test('primary selection is ground-only and refuses unblocked camouflage or invisible inputs',()=>{
  for(const options of [{fly:true},{flags:{camou:true}},{flags:{sleep:true}},{flags:{stealth:true}},
    {flags:{untargetable:true}}]){const f=make();enemy(f,options);advance(f.b,4);assert.equal(f.hits.length,0);}
});
test('PRECAST target identity survives priority/range changes and samples centre at birth',()=>{
  const f=make(),a=enemy(f);until(f,()=>f.controller.phase?.kind==='attack');
  const other=enemy(f,{col:7,taunt:10});a.x=10;a.tileC=10;f.b._buildEnemyIndex();
  until(f,()=>f.births.length===1);near(f.births[0].command.x,10);assert.equal(f.hits[0].target,a);
  near(other.hp,1e7);
});
test('lost S1 input refunds its charge without substituting another target',()=>{
  for(const changeLife of [false,true]){
    const f=make(),a=enemy(f);ready(f);until(f,()=>f.controller.phase?.skill);
    if(changeLife)a.deploySeq++;else f.b.kill(a);const other=enemy(f,{col:7});advance(f.b,.4);
    assert.equal(f.hits.length,0);near(other.hp,1e7);assert.equal(f.u.skill.ready,true);
    assert.equal(f.u.skill.active,false);assert.equal(f.u.findBuff('rosmontis:cast'),null);
  }
});
test('control interruption cancels unborn S1 without refunding, including between-tick control',()=>{
  for(const flag of ['stun','disarm','freeze','sleep']){
    const f=make();enemy(f);ready(f);until(f,()=>f.controller.phase?.skill);
    f.b.addBuff(f.u,{key:'fixture:interrupt',flags:{[flag]:true}});advance(f.b,.6);
    assert.equal(f.hits.length,0);near(f.u.skill.sp,0);assert.equal(f.u.skill.active,false);
  }
  const f=make();enemy(f);ready(f);until(f,()=>f.controller.phase?.skill);
  f.b.addBuff(f.u,{key:'fixture:interrupt',flags:{stun:true}});f.b.removeBuff(f.u,'fixture:interrupt');advance(f.b,.6);
  assert.equal(f.hits.length,0);assert.equal(f.u.skill.active,false);
});
test('a hook-rejected release generates no receipts, projectile or offensive SP',()=>{
  const f=make();enemy(f);f.b.on('beforeAttack',ctx=>{if(ctx.attacker===f.u)ctx.targets=[];});
  advance(f.b,4);assert.equal(f.hits.length,0);assert.equal(f.births.length,0);assert.equal(f.attacks.length,0);
  near(f.u.skill.sp,0);
});
test('accepted aftershock survives owner withdrawal and does not generate another offensive SP',()=>{
  const f=make();enemy(f);until(f,()=>f.births.length===1);f.b.retreat(f.u,{permanent:true});
  until(f,()=>f.births.length===2);assert.equal(f.hits.length,2);assert.equal(f.attacks.length,1);
  assert.equal(f.controller.outputs.size,0);assert.equal(f.controller.finishHook,null);
});
test('post-birth control cannot cancel accepted aftershock; battle end cancels all pending output',()=>{
  const f=make();enemy(f);until(f,()=>f.births.length===1);
  f.b.addBuff(f.u,{key:'fixture:interrupt',flags:{stun:true}});until(f,()=>f.births.length===2);
  assert.equal(f.hits.length,2);
  const g=make();enemy(g);until(g,()=>g.births.length===1);g.b.finished=true;g.b.emit('battleEnd',{});
  assert.equal(g.controller.outputs.size,0);assert.equal(g.controller.finishHook,null);
  advance(g.b,.5);assert.equal(g.hits.length,1);
});
test('captured ASPD scales original main event and aftershock delta without changing coefficients',()=>{
  const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:speed',mods:{aspd:100}});
  until(f,()=>f.hits.length===2);near(f.hits[0].time,1+.533333/2,f.b.dt*2+1e-6);
  near(f.hits[1].time-f.hits[0].time,.15/2,f.b.dt*2+1e-6);near(f.hits[1].amount,344);
  near(f.u.mem.regularFormVisual.speed,2);
});
test('main and aftershock use current ATK separately, not cached launch damage',()=>{
  const f=make();enemy(f);until(f,()=>f.births.length===1);
  f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});until(f,()=>f.births.length===2);
  near(f.hits[0].amount,688);near(f.hits[1].amount,688);
});
test('S1 blocks offensive SP for the full captured clip and silence falls back to ordinary attacks',()=>{
  const f=make();enemy(f);ready(f);until(f,()=>f.hits.length===3);assert.ok(f.u.findBuff('rosmontis:cast'));
  f.u.skill.gainSp(1);near(f.u.skill.sp,0);until(f,()=>!f.u.findBuff('rosmontis:cast'));
  f.u.skill.gainSp(1);near(f.u.skill.sp,1);
  const g=make();enemy(g);ready(g);g.b.addBuff(g.u,{key:'fixture:silence',flags:{silence:true}});
  until(g,()=>g.hits.length===2);assert.equal(g.births[0].command.isSkill,false);assert.equal(g.u.skill.ready,true);
});
test('talent self condition follows Caster presence; only one recipient gets the bonus',()=>{
  const f=make();near(f.u.s.atk,688);const a=caster(f);near(f.u.s.atk,688*1.08);near(a.s.atk,108);
  const z=caster(f,{row:6});near(z.s.atk,100);f.b.retreat(a,{permanent:true});near(f.u.s.atk,688*1.08);
  near(z.s.atk,100);const later=caster(f,{row:7});near(later.s.atk,108);
  f.b.retreat(z,{permanent:true});f.b.retreat(later,{permanent:true});near(f.u.s.atk,688);
});
test('owner deployment chooses one existing Caster and E0/E1 do not get the E2 aura',()=>{
  const f=make({defer:true}),a=caster(f),z=caster(f,{row:6});f.b.rng=()=>.99;f.deploy();
  near(a.s.atk,100);near(z.s.atk,108);near(f.u.s.atk,743.04);
  for(const elite of [0,1]){const g=make({elite});const c=caster(g);near(c.s.atk,100);near(g.u.s.atk,g.record.stats.atk);}
});
test('caster isolation suspends only the extra recipient and returns it without reselecting',()=>{
  const f=make(),a=caster(f);const z=caster(f,{row:6});
  f.b.addBuff(a,{key:'fixture:isolated',flags:{isolated:true}});advance(f.b,f.b.dt);
  near(a.s.atk,100);near(f.u.s.atk,743.04);near(z.s.atk,100);
  f.b.removeBuff(a,'fixture:isolated');advance(f.b,f.b.dt);near(a.s.atk,108);
});
test('caster target-free/heal-free are accepted while other professions and tokens do not qualify',()=>{
  const f=make();caster(f,{profession:'MEDIC'});caster(f,{row:7,kind:'token'});near(f.u.s.atk,688);
  const a=caster(f,{row:6,flags:{untargetable:true,healFree:true}});near(a.s.atk,108);near(f.u.s.atk,743.04);
});
test('owner cleanup removes only its own aura claims and leaves no pending controller hooks',()=>{
  const f=make(),a=caster(f);const g=make({battle:f.b,defer:true});g.u.homeR=7;g.u.homeC=7;g.deploy();
  near(a.s.atk,116);f.b.retreat(f.u,{permanent:true});near(a.s.atk,108);
  assert.equal(f.controller.handles.length,0);assert.equal(f.controller.finishHook,null);
  g.b.retreat(g.u,{permanent:true});near(a.s.atk,100);
});
test('skill-start hooks withdrawing or controlling the owner cannot leave a pending S1',()=>{
  for(const mode of ['withdraw','control']){
    const f=make();enemy(f);ready(f);
    f.b.on('skillStart',ctx=>{if(ctx.unit===f.u || ctx.owner===f.u){
      if(mode==='withdraw')f.b.retreat(f.u,{permanent:true});
      else f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true}});
    }});
    advance(f.b,2);assert.equal(f.hits.length,0);assert.equal(f.u.skill.active,false);
    assert.equal(f.u.skill.pending,false);assert.equal(f.u.findBuff('rosmontis:cast'),null);
  }
});

test('intermediate levels and trust combine before rounding integral source stats once',()=>{
  for(const elite of [0,1,2]) for(const level of [1,17,38,e.tables.character.phases[elite].maxLevel])
    for(const trust of [1,17,33,81,100,200]){
      const build={elite,level,potential:1,trust,skillId:'skchr_rosmon_1',skillRank:1};
      const r=selectedRosmontisBuild(build),frames=e.tables.character.phases[elite].attributesKeyFrames;
      const a=frames[0],z=frames.at(-1),f=e.tables.character.favorKeyFrames;
      const t=(level-a.level)/(z.level-a.level),v=(Math.min(100,trust)/2-f[0].level)/(f.at(-1).level-f[0].level);
      for(const k of ['maxHp','atk','def'])near(r.stats[k],Math.round(a.data[k]+t*(z.data[k]-a.data[k])
        +f[0].data[k]+v*(f.at(-1).data[k]-f[0].data[k])));
      near(r.stats.baseAttackTime,2.1);
    }
});
test('single hit barriers and typed shields resolve separately for main, Arts and aftershock',()=>{
  const f=make(),a=enemy(f);ready(f);f.b.addBuff(a,{key:'fixture:barrier',shieldHits:1});
  f.b.addBuff(a,{key:'fixture:arts',shield:500,shieldTypes:['arts']});until(f,()=>f.births.length===2);
  near(1e7-a.hp,688*1.8-500+344);assert.equal(a.findBuff('fixture:barrier'),null);
  assert.equal(a.findBuff('fixture:arts'),null);assert.equal(f.attacks.length,1);
});
test('physical dodge leaves the independent S1 Arts receipt and produces only one command',()=>{
  const f=make(),a=enemy(f);ready(f);f.b.addBuff(a,{key:'fixture:dodge',mods:{dodgePhys:1}});
  until(f,()=>f.births.length===2);near(1e7-a.hp,688*1.8);assert.equal(f.attacks.length,1);
  assert.equal(f.hits.length,1);near(f.u.skill.sp,0);
});
test('separate aftershock kills award owner credit without duplicate attack or S1 Arts on new victims',()=>{
  const f=make();const a=enemy(f,{hp:900});until(f,()=>f.births.length===2);
  assert.equal(a.alive,false);assert.equal(f.u.stats.kills,1);assert.equal(f.attacks.length,1);near(f.u.skill.sp,1);
  const g=make(),old=enemy(g);ready(g);until(g,()=>g.births.length===1);old.x=9;old.tileC=9;
  const newVictim=enemy(g,{col:6.2});g.b._buildEnemyIndex();until(g,()=>g.births.length===2);
  assert.equal(g.hits.filter(h=>h.target===newVictim).length,1);near(newVictim.hp,1e7-344);
});
test('accepted output uses post-withdrawal live source stats rather than retaining aura/penetration claims',()=>{
  const f=make(),a=enemy(f,{def:500});caster(f);until(f,()=>f.births.length===1);
  near(f.hits[0].amount,743.04-340);f.b.retreat(f.u,{permanent:true});until(f,()=>f.births.length===2);
  near(f.hits[1].amount,344*.05);assert.equal(f.u.findBuff('rosmontis:penetration'),null);
  near(1e7-a.hp,f.hits[0].amount+f.hits[1].amount,.00001);
});
test('already born output keeps the captured speed even if ASPD changes before aftershock',()=>{
  const f=make();enemy(f);until(f,()=>f.births.length===1);f.b.addBuff(f.u,{key:'fixture:late-speed',mods:{aspd:300}});
  until(f,()=>f.births.length===2);near(f.births[1].time-f.births[0].time,.15,f.b.dt+1e-6);
});
test('aura reapplication recovers its removed buff while preserving an external replacement',()=>{
  const f=make(),a=caster(f),key=f.controller.aura.key;
  f.b.removeBuff(a,key);advance(f.b,f.b.dt);near(a.s.atk,108);
  const external=f.b.addBuff(a,{key,mods:{atkPct:.5}});advance(f.b,f.b.dt);
  assert.equal(a.findBuff(key),external);near(a.s.atk,150);
  f.b.retreat(f.u,{permanent:true});assert.equal(a.findBuff(key),external);near(a.s.atk,150);
});
test('reentrant aura rejection, caster removal and owner withdrawal leave no orphan claims or hook errors',()=>{
  for(const mode of ['reject','caster-leaves','owner-leaves']){
    const f=make({defer:true}),a=caster(f);let acted=false;
    f.b.on('beforeBuff',ctx=>{if(ctx.buff.key.startsWith('rosmontis:aura:')&&!acted){acted=true;
      if(mode==='reject')ctx.cancel=true;
      if(mode==='caster-leaves')f.b.retreat(a,{permanent:true});
      if(mode==='owner-leaves')f.b.retreat(f.u,{permanent:true});
      f.controller.aura.refresh();
    }});f.deploy();advance(f.b,.1);assert.deepEqual(f.b.errors,[]);
    if(mode==='reject'){near(a.s.atk,108);near(f.u.s.atk,743.04);}
    else {near(f.u.s.atk,688);near(a.s.atk,100);assert.equal(f.controller.aura.claims.size,0);}
  }
});
test('skill-start target death/changed-life refunds S1 before a phase or output is created',()=>{
  for(const changeLife of [false,true]){
    const f=make(),a=enemy(f);ready(f);let acted=false;
    f.b.on('skillStart',ctx=>{if(ctx.unit===f.u&&!acted){acted=true;
      if(changeLife)a.deploySeq++;else f.b.kill(a);
    }});until(f,()=>acted);assert.equal(f.u.skill.active,false);assert.equal(f.u.skill.ready,true);
    assert.equal(f.controller.phase,null);assert.equal(f.births.length,0);
  }
});
test('control applied and removed synchronously in skillStart still cancels the spent S1',()=>{
  const f=make();enemy(f);ready(f);let acted=false;
  f.b.on('skillStart',ctx=>{if(ctx.unit===f.u){acted=true;
    f.b.addBuff(f.u,{key:'fixture:momentary',flags:{stun:true}});f.b.removeBuff(f.u,'fixture:momentary');
  }});until(f,()=>acted);assert.equal(f.u.skill.pending,false);assert.equal(f.u.skill.active,false);
  near(f.u.skill.sp,0);assert.equal(f.controller.phase,null);assert.equal(f.births.length,0);
});
