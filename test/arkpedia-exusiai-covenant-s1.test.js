// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import e from '../data/arkpedia-exusiai-covenant-prefabs.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {normalizeChess} from '../server/sim/simdata.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
import {EXUSIAI_COVENANT_ID as ID,selectedExusiaiCovenantBuild,
  prepareExusiaiCovenantS1} from '../server/sim/content/arkpedia-exusiai-covenant.js';
import {EXUSIAI_COVENANT_S1_CONTRACT} from '../server/sim/content/arkpedia-exusiai-covenant-s1.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function owner(b,{rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=1,dir='RIGHT',defer=false,row=5,col=5,contract=EXUSIAI_COVENANT_S1_CONTRACT}={}){
  const build={elite,level,potential,trust,skillId:`skchr_angel2_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedExusiaiCovenantBuild(build),c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,
    subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    tags:r.tags,
    skill:{...r.source,...r.source.spData,skillId:build.skillId,
      rangeGrid:r.source.rangeId?e.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir});
  const prepared=prepareExusiaiCovenantS1(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
  const hits=[],attacks=[],births=[],bombs=[];
  b.on('exusiaiCovenantS1ProjectileBirth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
  b.on('exusiaiCovenantBombBirth',ctx=>{if(ctx.owner===u)bombs.push({...ctx,time:b.time});});
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});
  
  const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));u.player.dp=99;};if(!defer)deploy();
  return {b,u,build,deploy,hits,attacks,births,bombs,...prepared};
}
function make(opts={}){
  const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_289_gyuki), {...defaultBuild(d.operators.char_1013_chen2),elite:2,level:90,skillId:'skchr_chen2_3',skillRank:10}, {...defaultBuild(d.operators.char_4039_horn),elite:2,level:90,skillId:'skchr_horn_2',skillRank:10}]});
  b.autoFinish=false;b.recordEvents=true;b.rng=()=>.99;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  return owner(b,opts);
}
function enemy(f,{row=5,col=6,hp=1e7,res=0,fly=false,taunt=0,flags={}}={}){
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(t.base,{maxHp:hp,atk:0,def:0,res,moveSpeed:0,tauntLevel:taunt});t.markDirty();void t.s;t.hp=hp;
  if(fly)t.motion='FLY';f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});
  f.b._buildEnemyIndex();return t;
}

const start=f=>{until(f,()=>f.u.skill.active,15);until(f,()=>f.controller.phase?.kind!=='s1-start');};

test('S1 requires its exact contract, complete source and selected skill; historical source enablement stays held',()=>{
  assert.throws(()=>make({contract:{...EXUSIAI_COVENANT_S1_CONTRACT}}),/contract/);
  assert.throws(()=>make({skill:2}),/first skill/);
  assert.ok(data.operators[ID]);assert.equal(REGULAR_OPERATORS[ID].mechanic,'exusiai-covenant');
  assert.deepEqual(e.enabledOperators,[]);
  const f=make({defer:true});assert.throws(()=>prepareExusiaiCovenantS1(f.b,f.u,{contract:EXUSIAI_COVENANT_S1_CONTRACT}),/fresh/);
});

test('all ten ranks activate naturally with no enemy and grant exactly eight rounds',()=>{
  for(let rank=1;rank<=10;rank++){
    const f=make({rank}),s=f.u.skill,source=e.tables.skills.skchr_angel2_1.levels[rank-1];
    near(s.spTotal,source.spData.initSp);advance(f.b,Math.max(0,12-source.spData.initSp-.15));
    assert.equal(s.active,false);until(f,()=>s.active);near(s.lastStart,12-source.spData.initSp,.1);
    assert.equal(s.ammoLeft,8);assert.equal(s.ammoMax,8);assert.equal(f.births.length,0);
    advance(f.b,4);assert.equal(s.spTotal,0);assert.equal(s.ammoLeft,8);
  }
});

test('S1 selects a flyer over an otherwise preferred ground enemy, one projectile per accepted attack',()=>{
  const f=make();start(f);const ground=enemy(f,{col:6}),flyer=enemy(f,{col:7,fly:true});
  until(f,()=>f.births.length===1);assert.equal(f.births[0].target,flyer);
  until(f,()=>f.hits.some(h=>h.dmg.tags.includes('angel2:s1-normal')));
  const hit=f.hits.find(h=>h.dmg.tags.includes('angel2:s1-normal'));
  near(hit.dmg.amount,f.u.s.atk*2.5);assert.equal(hit.target,flyer);near(ground.hp,ground.s.maxHp);
  assert.equal(f.u.skill.ammoLeft,7);assert.equal(f.attacks.length,1);
});

test('all facings retain original S1 OnAttack timing and the normal shot uses speed thirty',()=>{
  for(const dir of ['RIGHT','UP','LEFT','DOWN']){
    const f=make({dir});start(f);enemy(f,{row:dir==='UP'?6:dir==='DOWN'?4:5,col:dir==='RIGHT'?7:dir==='LEFT'?3:5});
    until(f,()=>f.controller.phase?.kind==='s1-attack');const p=f.controller.phase;
    assert.equal(p.clip,dir==='DOWN'?'Skill_Down_1_Loop':'Skill_1_Loop');
    advance(f.b,.2);assert.equal(f.births.length,0);until(f,()=>f.births.length===1);
    assert.ok(f.births[0].time+f.b.dt>=p.releaseAt);assert.equal(f.births[0].projectile.speed,30);
  }
});

test('normal S1 caps acceleration at the native maximum but supports slowed original clip clocks',()=>{
  for(const atkSpeedFlat of [100,-50]){
    const f=make();start(f);f.b.addBuff(f.u,{key:'fixture:speed',mods:{atkSpeedFlat}});enemy(f);
    until(f,()=>f.controller.phase?.kind==='s1-attack');
    near(f.controller.phase.speed,Math.min(1,f.u.base.bat/f.u.s.interval));
  }
});

test('normal ammo consumption heals once, free rounds do not consume or trigger ammo talents',()=>{
  const f=make();start(f);enemy(f);const receipts=[];f.b.on('ammoUsed',x=>{if(x.unit===f.u)receipts.push(x);});
  f.u.hp=100;const heals=[];f.b.on('calculatedHeal',x=>{if(x.target===f.u)heals.push(x);});
  until(f,()=>f.births.length===1);assert.equal(receipts.length,1);assert.equal(heals.length,1);
  const h=f.b.on('beforeAmmoUse',x=>{x.spareShotProb=1;});until(f,()=>f.births.length===2);
  assert.equal(f.u.skill.ammoLeft,7);assert.equal(receipts.length,1);assert.equal(heals.length,1);f.b.off(h);
});

test('manual stop snapshots remaining rounds, one ammo receipt and separate random-target births',()=>{
  const f=make();start(f);const a=enemy(f,{col:6}),z=enemy(f,{col:7});
  until(f,()=>f.births.length===1);f.u.skill.ammoLeft=3;
  const receipts=[];f.b.on('ammoUsed',x=>{if(x.unit===f.u)receipts.push({...x});});
  let draw=0;f.b.rng=()=>++draw%2?.1:.9;
  assert.equal(f.u.skill.spec.onManualCancel(),true);const c=f.controller.s1.burst;
  assert.equal(c.count,3);assert.equal(f.u.skill.spec.onManualCancel(),false);
  advance(f.b,.2);assert.equal(f.births.filter(x=>x.kind==='burst').length,0);
  until(f,()=>f.births.filter(x=>x.kind==='burst').length===3);
  const burst=f.births.filter(x=>x.kind==='burst');assert.deepEqual(burst.map(x=>x.round),[0,1,2]);
  assert.equal(receipts.length,1);assert.equal(receipts[0].count,3);assert.equal(receipts[0].left,0);
  assert.ok(burst.every(x=>[a,z].includes(x.target)));assert.equal(new Set(burst.map(x=>x.target)).size,2);
  assert.deepEqual(burst.map(x=>x.projectile.speed),[30,10,10]);
  assert.equal(f.attacks.length,2); // original normal attack plus one burst ability
  for(let i=0;i<3;i++)assert.ok(burst[i].time+f.b.dt>=c.releaseAt+i*.05000000074505806);
  assert.equal(f.u.skill.active,false);assert.equal(f.u.skill.spTotal,0);
  until(f,()=>!f.controller.s1.burst);assert.equal(f.u.findBuff('angel2:s1-close'),null);
  advance(f.b,.1);assert.ok(f.u.skill.spTotal>0);
});

test('manual close with no enemies drains its original ammo once and completes without fabricated hits',()=>{
  const f=make();start(f);assert.equal(f.u.skill.spec.onManualCancel(),true);
  until(f,()=>!f.controller.s1.burst);assert.equal(f.births.length,0);assert.equal(f.u.skill.active,false);
  assert.equal(f.u.skill.ammoLeft,0);assert.equal(f.u.findBuff('angel2:s1-close'),null);
});

test('normal windup control interruption preserves ammo and restarts with a fresh target',()=>{
  const f=make();start(f);const t=enemy(f);until(f,()=>f.controller.phase?.kind==='s1-attack');
  f.b.applyStatus(f.u,'stun',{duration:1,source:t});advance(f.b,.5);
  assert.equal(f.births.length,0);assert.equal(f.u.skill.ammoLeft,8);until(f,()=>f.births.length===1);
});

test('manual burst interruption cancels unborn rounds, while launched shots survive withdrawal',()=>{
  const f=make();start(f);enemy(f,{col:8});f.u.skill.ammoLeft=8;
  assert.ok(f.u.skill.spec.onManualCancel());until(f,()=>f.births.some(x=>x.kind==='burst'));
  const before=f.births.length;f.b.retreat(f.u);advance(f.b,1);
  assert.equal(f.births.length,before);assert.ok(f.hits.some(x=>x.dmg.tags.includes('angel2:s1-burst')));
  assert.equal(f.u.findBuff('angel2:s1-close'),null);assert.equal(f.controller.handles.length,0);
});

test('skill projectile retains selected scale after natural exhaustion and uses current ATK on arrival',()=>{
  const f=make();start(f);const t=enemy(f,{col:8});f.u.skill.ammoLeft=1;
  until(f,()=>f.births.length===1);assert.equal(f.u.skill.active,false);
  f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:.5}});
  until(f,()=>f.hits.some(x=>x.dmg.tags.includes('angel2:s1-normal')));
  near(f.hits.find(x=>x.dmg.tags.includes('angel2:s1-normal')).dmg.amount,f.u.s.atk*2.5);
  assert.ok(t.hp<t.s.maxHp);
});

test('dead, hidden and camouflaged targets cannot receive a late normal hit',()=>{
  for(const kind of ['dead','hidden','camou']){
    const f=make();start(f);const t=enemy(f,{col:8});until(f,()=>f.births.length===1);
    if(kind==='dead')f.b.kill(t,f.u);else if(kind==='hidden')t.hidden=true;else f.b.addBuff(t,{key:'fixture:camou',flags:{camou:true}});
    advance(f.b,.15);assert.equal(f.hits.filter(x=>x.dmg.tags.includes('angel2:s1-normal')).length,0);
  }
});

test('each selected rank uses its own physical scale, not the M3 multiplier',()=>{
  for(let rank=1;rank<=10;rank++){
    const f=make({rank});start(f);enemy(f);
    until(f,()=>f.hits.some(h=>h.dmg.tags.includes('angel2:s1-normal')));
    const hit=f.hits.find(h=>h.dmg.tags.includes('angel2:s1-normal'));
    near(hit.dmg.amount,f.u.s.atk*f.record.bb['attack@atk_scale']);
  }
});

test('source skill cannot be silenced and can start during the original Born animation',()=>{
  const f=make();f.b.addBuff(f.u,{key:'fixture:silence',flags:{silence:true}});
  f.u.skill.addCharge(1);advance(f.b,f.b.dt);
  assert.equal(f.u.skill.active,true);assert.equal(f.controller.phase.kind,'s1-start');
  assert.ok(f.b.time<1);assert.equal(f.u.skill.ammoLeft,8);
});

test('manual burst reselects on each birth after a target dies and accepts a new range entrant',()=>{
  const f=make();start(f);const a=enemy(f,{col:7});f.u.skill.ammoLeft=3;
  f.b.rng=()=>.99;assert.ok(f.u.skill.spec.onManualCancel());
  until(f,()=>f.births.some(x=>x.kind==='burst'));f.b.kill(a,f.u);
  const z=enemy(f,{col:8});until(f,()=>f.births.filter(x=>x.kind==='burst').length===3);
  assert.deepEqual(f.births.filter(x=>x.kind==='burst').map(x=>x.target),[a,z,z]);
});

test('burst talent receipt counts every spent bullet and never counts additional projectiles twice',()=>{
  const f=make();start(f);enemy(f);f.u.hp=10;f.u.skill.ammoLeft=8;
  let heals=0;f.b.on('calculatedHeal',x=>{if(x.target===f.u)heals++;});
  assert.ok(f.u.skill.spec.onManualCancel());until(f,()=>!f.controller.s1.burst);
  assert.equal(heals,8);assert.equal(f.births.filter(x=>x.kind==='burst').length,8);
  until(f,()=>f.hits.filter(x=>x.dmg.tags.includes('angel2:s1-burst')).length===8);
  const hits=f.hits.filter(x=>x.dmg.tags.includes('angel2:s1-burst'));
  assert.ok(hits[0].dmg.attackId>0);assert.equal(new Set(hits.map(x=>x.dmg.attackId)).size,1);
});

test('temporary hidden state cancels an unfinished close without retaining a permanent SP lock',()=>{
  const f=make();start(f);enemy(f,{col:8});assert.ok(f.u.skill.spec.onManualCancel());
  until(f,()=>f.births.some(x=>x.kind==='burst'));const born=f.births.length;
  f.u.hidden=true;advance(f.b,.5);assert.equal(f.controller.s1.burst,null);
  assert.equal(f.u.findBuff('angel2:s1-close'),null);assert.equal(f.births.length,born);
  f.u.hidden=false;advance(f.b,.2);assert.ok(f.u.skill.spTotal>0);
});

test('burst handles added ammunition beyond eight and clears all original projectiles at battle finish',()=>{
  const f=make();start(f);enemy(f);f.u.skill.addAmmo(32);assert.ok(f.u.skill.spec.onManualCancel());
  until(f,()=>f.births.filter(x=>x.kind==='burst').length===40,5);
  assert.equal(f.u.skill.ammoLeft,0);until(f,()=>!f.controller.s1.burst);
  f.b.finished=true;f.b.emit('battleEnd',{});
  assert.equal(f.b.projectiles.list.filter(p=>p.data?.exusiaiCovenantOwner===f.controller).length,0);
  assert.equal(f.controller.handles.length,0);assert.equal(f.u.findBuff('angel2:s1-close'),null);
});
