// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import e from '../data/arkpedia-lappland-alter-prefabs.json' with {type:'json'};
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { LAPPLAND_ALTER_ID as ID,LAPPLAND_ATTACK_CONTRACT as CONTRACT,
  selectedLapplandBuild,prepareLapplandAttacks } from '../server/sim/content/arkpedia-lappland-alter.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function make({rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=1,dir='RIGHT',defer=false,contract=CONTRACT}={}){
  const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;
  d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_289_gyuki)]});
  b.autoFinish=false;b.recordEvents=true;b.rng=()=>.99;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const build={elite,level,potential,trust,skillId:`skchr_whitw2_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedLapplandBuild(build),c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,
    subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    tags:[c.nationId,c.groupId,c.teamId].filter(v=>typeof v==='string'&&v),
    skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',5,5,{dir});
  const prepared=prepareLapplandAttacks(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
  const hits=[],attacks=[],births=[],strikes=[],locks=[],rewards=[];
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});
  b.on('lapplandProjectileBirth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
  b.on('lapplandDroneStrike',ctx=>{if(ctx.owner===u)strikes.push({...ctx,time:b.time});});
  b.on('lapplandDroneLock',ctx=>{if(ctx.owner===u)locks.push({...ctx,time:b.time});});
  b.on('lapplandAlphaWolf',ctx=>{if(ctx.owner===u)rewards.push({...ctx,time:b.time});});
  const deploy=()=>{assert.ok(b._deploy(u,{initial:false}));u.player.dp=99;};if(!defer)deploy();
  return {b,u,build,deploy,hits,attacks,births,strikes,locks,rewards,...prepared};
}
function enemy(f,{row=5,col=6,hp=1e7,res=0,fly=false,taunt=0,flags={}}={}){
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(t.base,{maxHp:hp,atk:0,def:0,res,moveSpeed:0,tauntLevel:taunt});t.markDirty();t.hp=hp;
  if(fly)t.motion='FLY';f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});
  f.b._buildEnemyIndex();return t;
}
function active(f){f.u.skill.addCharge(1);assert.equal(f.controller.toggle(),true);}

test('ordinary/S1 remains private until the full Lappland kit is reviewed',()=>{
  assert.equal(REGULAR_OPERATORS[ID],undefined);assert.equal(data.operators[ID],undefined);
  assert.deepEqual(e.enabledOperators,[]);assert.equal(CONTRACT.frameParity,false);
  assert.throws(()=>make({contract:{...CONTRACT}}),/contract/);
  assert.throws(()=>make({skill:2}),/Incomplete/);assert.throws(()=>make({skill:3}),/Incomplete/);
});
test('selected source combines exact promotion, trust, potential and unlocks',()=>{
  const b={elite:2,level:90,potential:1,trust:0,skillId:'skchr_whitw2_1',skillRank:10};
  const r=selectedLapplandBuild(b);near(r.stats.maxHp,1503);near(r.stats.atk,342);near(r.stats.def,117);
  near(r.stats.cost,22);near(r.stats.baseAttackTime,1.3);near(r.alpha.interval,20);near(r.honor.sp,5);
  const z=selectedLapplandBuild({...b,potential:6,trust:200});near(z.stats.atk,427);near(z.stats.cost,20);
  near(z.alpha.interval,16);near(z.honor.sp,6);
  assert.deepEqual(selectedLapplandBuild({...b,elite:0,level:1,skillRank:1}).alpha,{});
  assert.deepEqual(selectedLapplandBuild({...b,elite:1,level:1,skillRank:7}).honor,{});
  for(const change of [{elite:3},{level:0},{level:91},{potential:0},{potential:7},{trust:201},
    {skillRank:11},{module:'x'},{elite:0,level:1,skillRank:1,skillId:'skchr_whitw2_2'}])
    assert.throws(()=>selectedLapplandBuild({...b,...change}));
});
test('modified selected records fail before installing any hooks',()=>{
  const f=make({defer:true});
  for(const change of [d=>d.stats.atk++,d=>d.skill.spCost++,d=>d.skill.initSp++,d=>d.skill.duration++,
    d=>d.skill.bb.atk++,d=>{d.skill.spType='hurt';},d=>{d.rangeGrid=[];},
    d=>d.talents[0].bb.interval++,d=>{d.raw.arkpedia.skillRank=9;},d=>{d.tags=[];}]){
    const d=structuredClone(f.u.def);change(d);const u=f.b._makeAlly(f.u.player,d,'op',7,7);
    const hooks=Object.values(f.b._hooks).flat().length;
    assert.throws(()=>prepareLapplandAttacks(f.b,u,{contract:CONTRACT}));
    assert.equal(Object.values(f.b._hooks).flat().length,hooks);
  }
  assert.throws(()=>prepareLapplandAttacks(f.b,f.u,{contract:CONTRACT}),/fresh/);
});
for(const dir of ['RIGHT','LEFT','UP','DOWN'])test(`${dir}: source entrance/event, caster flight and separate half-second drones`,()=>{
  const f=make({dir}),[row,col]={RIGHT:[5,6],LEFT:[5,4],UP:[6,5],DOWN:[4,5]}[dir];enemy(f,{row,col});
  advance(f.b,1.35);assert.equal(f.hits.length,0);until(f,()=>f.hits.length===3);
  assert.equal(f.attacks.length,1);assert.equal(f.births.length,3);
  near(f.births[0].time,1.4,f.b.dt*2);near(f.hits[0].time-f.births[0].time,.1,f.b.dt*2);
  near(f.hits[1].time-f.births[1].time,.5,f.b.dt*2);
  near(f.hits[0].amount,342);near(f.hits[1].amount,68.4);near(f.hits[2].amount,68.4);
  near(f.u.skill.sp,f.b.time,f.b.dt*2);
});
test('normal extra drones share one ramp increment per command through six increments and cap',()=>{
  const f=make({elite:0,rank:1}),t=enemy(f);until(f,()=>f.attacks.length===8);
  const births=f.births.filter(x=>x.kind==='normal-drone');
  assert.equal(births.length,16);
  for(let i=0;i<8;i++)for(const x of births.slice(i*2,i*2+2))near(x.scale,Math.min(1.1,.2+.15*i));
  assert.equal(f.controller.normalRamp.target,t);
});
test('retargeting and changed life reset the shared normal ramp',()=>{
  const f=make(),a=enemy(f);until(f,()=>f.attacks.length===3);
  const z=enemy(f,{col:7,taunt:100});until(f,()=>f.attacks.length===4);
  near(f.births.at(-1).scale,.2);assert.equal(f.births.at(-1).target,z);
  z.deploySeq++;until(f,()=>f.attacks.length===5);near(f.births.at(-1).scale,.2);
  assert.notEqual(f.controller.normalRamp.target,a);
});
test('Arts mitigation is independent per drone and uses live source ATK on impact',()=>{
  const f=make();enemy(f,{res:50});until(f,()=>f.births.length===3);
  f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});until(f,()=>f.hits.length===3);
  near(f.hits[0].amount,342);near(f.hits[1].amount,68.4);near(f.hits[2].amount,68.4);
});
for(let rank=1;rank<=10;rank++)test(`S1 rank ${rank}: passive extra drone, ATK toggle and held SP`,()=>{
  const f=make({rank}),t=enemy(f);active(f);until(f,()=>f.strikes.length===2);
  const atk=342*(1+e.tables.skills.skchr_whitw2_1.levels[rank-1].blackboard.find(x=>x.key==='atk').value);
  const remote=f.hits.filter(x=>x.dmg.tags.includes('lappland:remote-drone'));
  assert.equal(remote.length,2);for(const h of remote){near(h.amount,atk*.2);assert.equal(h.target,t);}
  advance(f.b,3);near(f.u.skill.sp,0);assert.equal(f.u.skill.active,true);
  assert.equal(f.controller.toggle(),true);near(f.u.s.atk,342);
  advance(f.b,1);assert.ok(f.u.skill.sp>0);assert.ok(f.controller.slots.every(s=>!s.lock));
});
test('S1 acquires a stationary enemy across the field without inventing a ranged caster hit',()=>{
  const f=make(),t=enemy(f,{col:17,fly:true});active(f);until(f,()=>f.strikes.length===2);
  assert.equal(f.births.length,0);assert.equal(f.attacks.length,0);
  assert.deepEqual(f.hits.map(h=>h.target),[t,t]);near(f.hits[0].amount,342*1.35*.2);
});
test('S1 release event caps animation speed at one while ordinary has no cap',()=>{
  const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:fast',mods:{aspd:100}});
  until(f,()=>f.births.length===3);near(f.births[0].time,1+.2,f.b.dt*2);
  active(f);until(f,()=>f.strikes.length===2);
  // Each of the original begin/event boundaries rounds independently on the
  // fixed simulation clock, plus at most one tick to observe the cast.
  const delay=f.strikes[0].time-f.u.skill.lastStart;
  assert.ok(delay>=1/3-1e-9&&delay<=1/3+3*f.b.dt+1e-9);
  assert.equal(f.controller.phase.kind,'attack');assert.equal(f.u.mem.regularFormVisual.speed,1);
});
test('remote locks keep their own target/ramp when another enemy gets higher priority',()=>{
  const f=make(),a=enemy(f,{col:17});active(f);until(f,()=>f.strikes.length===2);
  const z=enemy(f,{col:16,taunt:100});until(f,()=>f.strikes.length===4);
  for(const s of f.strikes.slice(2)){assert.equal(s.target,a);near(s.scale,.35);}
  // Mark it as walking after enemy AI, before the controller samples the tick.
  const h=f.b.on('tick',()=>{a.moving=true;},{priority:100});
  until(f,()=>f.locks.some(x=>x.target===z));f.b.off(h);
  for(const s of f.strikes.filter(x=>x.target===z).slice(0,2))near(s.scale,.2);
});
test('moving, hidden, sleeping, untargetable and stealthed recipients cannot acquire S1 locks',()=>{
  for(const flags of [{sleep:true},{untargetable:true},{stealth:true},{camou:true}]){
    const f=make();enemy(f,{col:17,flags});active(f);advance(f.b,4);assert.equal(f.strikes.length,0);
  }
  const f=make(),t=enemy(f,{col:17});f.b.on('tick',()=>{t.moving=true;},{priority:100});
  active(f);advance(f.b,4);assert.equal(f.strikes.length,0);
});
test('remote changed life reacquires with initial scale and never inherits old ramps',()=>{
  const f=make(),t=enemy(f,{col:17});active(f);until(f,()=>f.strikes.length===4);t.deploySeq++;
  until(f,()=>f.strikes.length===6);for(const s of f.strikes.slice(4))near(s.scale,.2);
});
for(const flag of ['stun','disarm','freeze','sleep'])test(`${flag}: cancels unborn owner shots while born remote drones keep ticking`,()=>{
  const f=make();enemy(f);until(f,()=>f.controller.phase?.kind==='attack');
  f.b.addBuff(f.u,{key:'fixture:control',flags:{[flag]:true}});advance(f.b,1);assert.equal(f.births.length,0);
  const z=make();enemy(z,{col:17});active(z);until(z,()=>z.strikes.length===2);
  z.b.addBuff(z.u,{key:'fixture:control',flags:{[flag]:true}});until(z,()=>z.strikes.length===4);
});
test('between-tick control cancels the captured ordinary attack',()=>{
  const f=make();enemy(f);until(f,()=>f.controller.phase?.kind==='attack');
  f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true}});f.b.removeBuff(f.u,'fixture:control');
  advance(f.b,.4);assert.equal(f.births.length,0);
});
test('beforeAttack rejection creates no caster or drone receipt',()=>{
  const f=make();enemy(f);f.b.on('beforeAttack',ctx=>{if(ctx.attacker===f.u)ctx.targets=[];});
  advance(f.b,4);assert.equal(f.births.length,0);assert.equal(f.hits.length,0);assert.equal(f.attacks.length,0);
});
test('withdrawal preserves the caster projectile and cancels source-bound drones',()=>{
  const f=make();enemy(f);until(f,()=>f.births.length===3);f.b.retreat(f.u,{permanent:true});
  until(f,()=>f.hits.length===1);advance(f.b,1);assert.equal(f.hits.length,1);
  near(f.hits[0].amount,342);assert.equal(f.controller.handles.length,0);
  assert.equal(f.b.projectiles.list.some(p=>p.data?.lapplandKind==='drone'),false);
});
test('mode changes cancel old ordinary drones without cancelling the born caster',()=>{
  const f=make();enemy(f);until(f,()=>f.births.length===3);active(f);advance(f.b,.2);
  assert.equal(f.hits.filter(h=>h.dmg.tags.includes('lappland:normal-drone')).length,0);
  assert.ok(f.hits.some(h=>h.dmg.tags.includes('lappland:caster')));
});
test('Alpha Wolf gives three ordered rewards and a terminal timer branch without unlimited growth',()=>{
  const f=make();advance(f.b,19.9);assert.equal(f.rewards.length,0);advance(f.b,.2);
  near(f.controller.capMultiplier,1.1);assert.equal(f.controller.silence,false);assert.equal(f.controller.count(),2);
  advance(f.b,20);assert.equal(f.controller.silence,true);assert.equal(f.controller.count(),2);
  advance(f.b,20);assert.equal(f.controller.count(),3);advance(f.b,60);
  assert.deepEqual(f.rewards.map(x=>x.stage),[1,2,3,4]);assert.equal(f.controller.count(),3);
});
test('source elite/potential intervals and silence duration are preserved',()=>{
  for(const [elite,potential,interval,duration] of [[1,1,30,1],[1,6,26,1],[2,1,20,2],[2,6,16,2]]){
    const f=make({elite,potential});advance(f.b,interval*2+.1);enemy(f,{col:17});active(f);
    until(f,()=>f.strikes.length===2);const t=f.strikes[0].target;assert.ok(t.s.flags.silence);
    near(t.findBuff('silence').duration,duration);
  }
});
test('original caster alone never applies the unlocked drone silence',()=>{
  const f=make();advance(f.b,40.1);const t=enemy(f);until(f,()=>f.hits.length===1);
  assert.equal(t.s.flags.silence,undefined);until(f,()=>f.hits.length===3);assert.ok(t.s.flags.silence);
});
test('Alpha Wolf and drone callbacks cannot create damage after finishing their owner',()=>{
  const f=make();f.b.on('lapplandAlphaWolf',()=>f.b.retreat(f.u,{permanent:true}));advance(f.b,21);
  assert.equal(f.controller.stopped,true);assert.equal(f.rewards.length,1);assert.equal(f.controller.handles.length,0);
  const z=make();enemy(z,{col:17});z.b.on('lapplandDroneStrike',()=>z.b.retreat(z.u,{permanent:true}));
  active(z);until(z,()=>z.controller.stopped);assert.equal(z.hits.length,0);
});
test('battle finish drops locks, timers and controller hooks',()=>{
  const f=make();enemy(f,{col:17});active(f);until(f,()=>f.strikes.length===2);f.b.forceEnd();
  assert.equal(f.controller.stopped,true);assert.equal(f.u.skill.active,false);
  assert.equal(f.controller.handles.length,0);assert.ok(f.controller.slots.every(s=>!s.lock));
});
test('S1 independent slots reselect after one lethal recipient without double-hitting its later life',()=>{
  const f=make(),a=enemy(f,{col:17,hp:1,taunt:100}),z=enemy(f,{col:16});active(f);
  until(f,()=>f.strikes.length===2);assert.equal(a.alive,false);
  assert.equal(f.strikes[0].target,a);assert.equal(f.strikes[1].target,z);near(f.strikes[1].scale,.2);
  assert.equal(f.hits.filter(h=>h.target===a).length,1);
});
test('a lock callback changing recipient life cannot deliver a stale immediate strike',()=>{
  const f=make(),t=enemy(f,{col:17});let changed=false;
  f.b.on('lapplandDroneLock',ctx=>{if(!changed&&ctx.target===t){changed=true;t.deploySeq++;}});
  active(f);until(f,()=>f.strikes.length===1);
  assert.equal(f.strikes[0].slot,1);near(f.strikes[0].scale,.2);
});
test('a projectile birth callback finishing the owner leaves no source-bound drone birth',()=>{
  const f=make();enemy(f);f.b.on('lapplandProjectileBirth',ctx=>{
    if(ctx.kind==='caster')f.b.retreat(f.u,{permanent:true});
  });until(f,()=>f.births.length===1);advance(f.b,1);
  assert.equal(f.births.length,1);assert.equal(f.hits.length,1);
});
test('a drone strike callback switching mode prevents that receipt and later slot receipts',()=>{
  const f=make();enemy(f,{col:17});f.b.on('lapplandDroneStrike',()=>f.controller.toggle());
  active(f);until(f,()=>f.strikes.length===1);advance(f.b,1);
  assert.equal(f.hits.length,0);assert.equal(f.strikes.length,1);assert.equal(f.u.skill.active,false);
});
test('acquiring new remote locks waits for owner control to end',()=>{
  const f=make();active(f);f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true}});
  enemy(f,{col:17});advance(f.b,3);assert.equal(f.locks.length,0);
  f.b.removeBuff(f.u,'fixture:control');until(f,()=>f.locks.length===2);
});
test('lock callback control stops later acquisitions but keeps the already attached drone',()=>{
  const f=make();enemy(f,{col:17});f.b.on('lapplandDroneLock',ctx=>{
    if(ctx.slot===0)f.b.addBuff(f.u,{key:'fixture:control',flags:{disarm:true}});
  });active(f);until(f,()=>f.strikes.length===2,5);
  assert.deepEqual(f.locks.map(x=>x.slot),[0]);assert.deepEqual(f.strikes.map(x=>x.slot),[0,0]);
});
test('the third Alpha Wolf reward activates a new remote slot with its own initial ramp',()=>{
  const f=make();enemy(f,{col:17});active(f);until(f,()=>f.controller.alphaStage===3,61);
  until(f,()=>f.strikes.some(x=>x.slot===2));
  const first=f.strikes.find(x=>x.slot===2);near(first.scale,.2);
  assert.equal(f.births.length,0);assert.equal(f.attacks.length,0);
});
test('silence immunity and source resistance apply through the engine status pipeline',()=>{
  const f=make();advance(f.b,40.1);const t=enemy(f,{col:17});t.def.immune.add('silence');active(f);
  until(f,()=>f.strikes.length===2);assert.equal(t.s.flags.silence,undefined);
  const z=make();advance(z.b,40.1);const q=enemy(z,{col:17});
  z.b.applyStatus(q,'resist',{duration:100,value:.5});active(z);until(z,()=>z.strikes.length===2);
  near(q.findBuff('silence').duration,1);
});
test('same drone target caps at the upgraded Alpha Wolf multiplier without buffing caster shots',()=>{
  const f=make();advance(f.b,20.1);enemy(f,{col:17});active(f);until(f,()=>f.strikes.length===18,16);
  for(const s of f.strikes.slice(-2))near(s.scale,1.21);
  near(f.u.s.atk,342*1.35);
});
function squadAlly(f,{tags=['siracusa'],kind='op',player=f.u.player,flags={}}={}){
  const def=structuredClone(f.u.def);def.charId='fixture:squad';def.tags=tags;
  const u=f.b._makeAlly(player,def,kind,7,7);f.b._setupUnit(u,{trait:{noAttack:true},skill:{kind:'toggle'}});
  if(Object.keys(flags).length)f.b.addBuff(u,{key:'fixture:birth',flags,persist:true,allowDead:true});
  return u;
}
test('Honor of Siracusa is installed before deployment and includes the undeployed owner',()=>{
  for(const potential of [1,3,6]){
    const f=make({potential,defer:true});assert.equal(f.controller.installSquad(),true);
    const t=squadAlly(f);assert.ok(f.b._deploy(t,{initial:false}));near(t.skill.sp,potential===1?5:6);
    assert.equal(f.u.deploySeq,0);f.deploy();near(f.u.skill.sp,potential===1?5:6);
  }
  const f=make({elite:1,defer:true});assert.equal(f.controller.installSquad(),false);
  assert.throws(()=>make().controller.installSquad(),/before/);
});
test('squad SP ignores other factions, tokens, another player and moved/repeated born events',()=>{
  const f=make({defer:true});f.controller.installSquad();
  for(const opts of [{tags:['rhodes']},{kind:'token'}]){
    const t=squadAlly(f,opts);assert.ok(f.b._deploy(t,{initial:false}));near(t.skill.sp,0);
    f.b.retreat(t,{permanent:true});
  }
  const t=squadAlly(f);assert.ok(f.b._deploy(t,{initial:false}));near(t.skill.sp,5);
  f.b.emit('deploy',{unit:t});near(t.skill.sp,5);
  t.skill.sp=0;f.b.emit('deploy',{unit:t,move:true});near(t.skill.sp,0);
  // A different player can share faction tags without belonging to this deck.
  t.player={...f.u.player,id:'fixture:other'};t.deploySeq++;f.b.emit('deploy',{unit:t});near(t.skill.sp,0);
});
test('squad SP persists after owner withdrawal, resets on recipient redeploy and respects no-SP',()=>{
  const f=make({defer:true});f.controller.installSquad();f.deploy();f.b.retreat(f.u,{permanent:true});
  const t=squadAlly(f);assert.ok(f.b._deploy(t,{initial:false}));near(t.skill.sp,5);
  // StandardBattle's deployment deck creates a new body for a redeployment.
  f.b.retreat(t,{permanent:true});const again=squadAlly(f);
  assert.ok(f.b._deploy(again,{initial:false}));near(again.skill.sp,5);
  f.b.retreat(again,{permanent:true});const z=squadAlly(f,{flags:{noSp:true}});
  assert.ok(f.b._deploy(z,{initial:false}));near(z.skill.sp,0);
  f.b.forceEnd();const hooks=Object.values(f.b._hooks).flat().filter(h=>!h.removed);
  assert.equal(hooks.some(h=>h.name==='deploy'&&!h.owner),false);
});
