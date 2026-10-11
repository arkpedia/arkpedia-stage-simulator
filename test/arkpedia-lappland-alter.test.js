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
    skill:{...r.source,...r.source.spData,skillId:build.skillId,
      rangeGrid:r.source.rangeId?e.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
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

test('three-skill component remains private until the full Lappland kit is reviewed',()=>{
  assert.equal(REGULAR_OPERATORS[ID],undefined);assert.equal(data.operators[ID],undefined);
  assert.deepEqual(e.enabledOperators,[]);assert.equal(CONTRACT.frameParity,false);
  assert.throws(()=>make({contract:{...CONTRACT}}),/contract/);
  assert.ok(make({skill:3}).controller.s3);
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

for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank}: selected initial SP, timed ATK, four drones, range and duration`,()=>{
  const f=make({skill:2,rank}),t=enemy(f,{row:7,col:5});
  near(f.u.skill.sp,[0,2,4,6,8,10,12,14,16,18][rank-1]);
  assert.equal(f.controller.count(),1);assert.equal(f.controller.targets().includes(t),false);
  active(f);assert.equal(f.u.skill.kind,'duration');assert.equal(f.controller.count(),4);
  assert.equal(f.controller.toggle(),false);assert.equal(f.u.liveRangeGrid.length,14);
  near(f.u.skill.timeLeft,[12,13,14,15,16,17,18,20,21,22][rank-1]);
  until(f,()=>f.strikes.length===4);assert.equal(f.attacks.length,1);
  for(const x of f.hits.filter(x=>x.dmg.tags.includes('lappland:remote-drone')))
    near(x.amount,342*(1+[.4,.45,.5,.6,.65,.7,.8,.95,1.05,1.2][rank-1])*.2);
  near(f.u.skill.sp,0);assert.equal(f.u.skill.gainSp(20,'test'),0);
  until(f,()=>!f.u.skill.active,24);near(f.b.time,f.record.source.duration,f.b.dt*2);
  near(f.u.s.atk,342);assert.equal(f.controller.count(),1);assert.equal(f.controller.targets().includes(t),false);
  assert.deepEqual(f.u.liveRangeGrid,f.record.rangeGrid);assert.ok(f.controller.slots.every(s=>!s.lock));
});
for(const dir of ['RIGHT','LEFT','UP','DOWN'])test(`S2 ${dir}: facing range, original begin/attack event and owner caster`,()=>{
  const f=make({skill:2,dir}),[row,col]={RIGHT:[7,5],LEFT:[3,5],UP:[5,3],DOWN:[5,7]}[dir];
  enemy(f,{row,col});active(f);until(f,()=>f.strikes.length===4);
  near(f.strikes[0].time,1.4,f.b.dt*2);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Loop');
  assert.equal(f.births.filter(x=>x.kind==='caster').length,1);
  until(f,()=>f.hits.length>=5);near(f.hits.find(x=>x.dmg.tags.includes('lappland:caster')).amount,752.4);
});
test('S2 selected ordinary attacks start with one drone, including E1 rank seven',()=>{
  const f=make({skill:2,elite:1,rank:7});enemy(f);until(f,()=>f.hits.length===2);
  assert.equal(f.births.length,2);assert.equal(f.births.filter(x=>x.kind==='normal-drone').length,1);
  near(f.hits[1].amount,f.u.s.atk*.2);
});
test('S2 each free slot independently draws a random target with replacement, ignoring caster priority',()=>{
  const f=make({skill:2}),a=enemy(f,{taunt:100}),z=enemy(f,{col:7});
  const draws=[.99,.99,0,.99,.99,.99,0,.99];let n=0;f.b.rng=()=>draws[n++]??.99;
  active(f);until(f,()=>f.locks.length===4);
  assert.deepEqual(f.locks.map(x=>x.target),[z,a,z,a]);assert.equal(n,8);
  assert.equal(f.births[0].target,a);assert.deepEqual(f.strikes.map(x=>x.scale),[.2,.2,.2,.2]);
});
test('S2 locks keep moving targets outside acquisition range until their life becomes invalid',()=>{
  const f=make({skill:2}),t=enemy(f);active(f);until(f,()=>f.strikes.length===4);
  f.b.on('tick',()=>{t.moving=true;},{priority:100});t.x=17;t.y=10;
  advance(f.b,2);assert.ok(f.strikes.length>=8);assert.ok(f.controller.slots.slice(0,4).every(s=>s.lock===t));
  assert.equal(f.controller.targets(true).includes(t),false);
  t.deploySeq++;advance(f.b,f.b.dt);assert.ok(f.controller.slots.every(s=>!s.lock));
  const old=f.strikes.length;advance(f.b,2);assert.equal(f.strikes.length,old);
});
test('S2 new targets exclude hidden, camouflage, stealth and enemies outside its expanded range',()=>{
  const f=make({skill:2});const good=enemy(f,{row:7,col:5,fly:true});
  enemy(f,{row:8,col:5});enemy(f,{row:7,col:6,flags:{camou:true}});
  enemy(f,{row:6,col:5,flags:{stealth:true}});const hidden=enemy(f,{col:7});hidden.hidden=true;
  active(f);until(f,()=>f.locks.length===4);assert.ok(f.locks.every(x=>x.target===good));
});
test('S2 target death reselects independently and resets each affected slot ramp',()=>{
  const f=make({skill:2}),a=enemy(f);active(f);until(f,()=>f.strikes.length===8);
  f.b.kill(a,f.u);const z=enemy(f,{col:7});until(f,()=>f.locks.length===8);
  assert.ok(f.locks.slice(4).every(x=>x.target===z));assert.ok(f.strikes.slice(8,12).every(x=>x.scale===.2));
});
test('S2 a lethal early drone makes later selectors use the remaining live target',()=>{
  const f=make({skill:2}),a=enemy(f,{hp:1}),z=enemy(f,{col:7,taunt:100});f.b.rng=()=>.99;
  // Put the lethal target last in regular priority so the .99 draw selects it.
  active(f);until(f,()=>f.locks.length===4);
  assert.equal(f.locks[0].target,a);assert.ok(f.locks.slice(1).every(x=>x.target===z));
});
test('S2 Fear rolls only for actual drones; zero rolls apply source duration and source stamp',()=>{
  const f=make({skill:2}),t=enemy(f);const rolls=[];
  f.b.rng=()=>0;f.b.on('lapplandFearRoll',x=>rolls.push(x));active(f);until(f,()=>f.strikes.length===4);
  assert.equal(rolls.length,4);assert.ok(rolls.every(x=>x.success));assert.ok(t.s.flags.fear);
  near(t.findBuff('fear').duration,1);assert.equal(t.findBuff('fear').data.fear.sx,f.u.x);
  until(f,()=>f.hits.some(x=>x.dmg.tags.includes('lappland:caster')));assert.equal(rolls.length,4);
});
test('S2 Fear honors immunity and status resistance',()=>{
  for(const immune of [true,false]){
    const f=make({skill:2}),t=enemy(f);f.b.rng=()=>0;
    if(immune)t.def.immune.add('feared');
    else f.b.applyStatus(t,'resist',{value:.5,duration:50});
    active(f);until(f,()=>f.strikes.length===4);
    if(immune)assert.equal(t.s.flags.fear,undefined);else near(t.findBuff('fear').duration,.5);
  }
});
test('S2 damage-missable Fear skips evasion but survives complete shield absorption',()=>{
  for(const shield of [false,true]){
    const f=make({skill:2}),t=enemy(f);f.b.rng=()=>0;
    f.b.addBuff(t,shield?{key:'fixture:shield',shield:1e8}:{key:'fixture:evade',mods:{dodgeArts:1}});
    active(f);until(f,()=>f.strikes.length===4);near(t.hp,1e7);
    assert.equal(!!t.s.flags.fear,shield);
    assert.equal((f.b._hooks.calculatedDamage??[]).length,0);
  }
});
test('S2 control keeps existing drones but prevents acquisitions until the owner can act',()=>{
  const f=make({skill:2}),a=enemy(f);active(f);until(f,()=>f.strikes.length===4);
  f.b.applyStatus(f.u,'stun',{duration:3});advance(f.b,1.5);assert.ok(f.strikes.length>=8);
  f.b.kill(a,f.u);enemy(f,{col:7});const old=f.locks.length;advance(f.b,1);assert.equal(f.locks.length,old);
  until(f,()=>f.locks.length===old+4);
});
test('S2 callback removal cancels later drone receipts and Fear; caster birth remains independent',()=>{
  const f=make({skill:2});enemy(f);let rolls=0;
  f.b.on('lapplandFearRoll',()=>rolls++);
  f.b.on('damaged',x=>{if(x.source===f.u&&x.dmg.tags.includes('lappland:remote-drone'))f.b.retreat(f.u,{permanent:true});});
  active(f);until(f,()=>f.controller.stopped);
  assert.equal(f.strikes.length,1);assert.equal(rolls,0);assert.equal(f.controller.handles.length,0);
  const before=f.hits.length;advance(f.b,1);assert.equal(f.hits.length,before+1);
});
test('S2 Fear-roll callback mode exit cannot attach the status or emit later slots',()=>{
  const f=make({skill:2}),t=enemy(f);f.b.rng=()=>0;
  f.b.on('lapplandFearRoll',()=>f.u.skill.end('fixture'));active(f);until(f,()=>!f.u.skill.active);
  assert.equal(f.strikes.length,1);assert.equal(t.s.flags.fear,undefined);
});
test('S2 upgrades to five drones after Alpha Wolf without granting the S1 passive',()=>{
  const f=make({skill:2,potential:6});advance(f.b,48.1);const t=enemy(f);assert.equal(f.controller.count(),2);
  active(f);until(f,()=>f.strikes.length===5);assert.equal(f.controller.count(),5);
  assert.equal(f.controller.slots[4].lock,t);assert.equal(f.controller.slots[5].lock,null);
  assert.ok(t.s.flags.silence);near(t.findBuff('silence').duration,2);
});
test('S2 casts without enemies, spends exactly 28 SP and returns to normal after its selected duration',()=>{
  const f=make({skill:2});advance(f.b,10.1);assert.equal(f.u.skill.charges,1);
  assert.equal(f.controller.toggle(),true);near(f.u.skill.sp,0);
  advance(f.b,23);assert.equal(f.u.skill.active,false);assert.equal(f.births.length,0);
  assert.equal(f.locks.length,0);assert.equal(f.u.skill.activations,1);
});
test('S2 skill end detaches drones; already-born caster uses live ordinary ATK on impact',()=>{
  const f=make({skill:2});enemy(f,{row:7,col:5});active(f);until(f,()=>f.births.length===1);
  assert.equal(f.strikes.length,4);f.u.skill.end('fixture');const old=f.strikes.length;
  until(f,()=>f.hits.some(x=>x.dmg.tags.includes('lappland:caster')));
  near(f.hits.find(x=>x.dmg.tags.includes('lappland:caster')).amount,342);assert.equal(f.strikes.length,old);
});
test('S2 attack-speed changes cap the owner loop while attached drone periods use live interval',()=>{
  const f=make({skill:2});enemy(f);f.b.addBuff(f.u,{key:'fixture:haste',mods:{aspd:100}});active(f);
  until(f,()=>f.strikes.length>=12);assert.ok(f.attacks.length<=3);
  near(f.strikes[4].time-f.strikes[0].time,.65,f.b.dt*2);
  if(f.attacks.length>1)near(f.attacks[1].time-f.attacks[0].time,1.3,f.b.dt*2);
  assert.equal(f.u.mem.regularFormVisual.speed,1);
});
test('S2 failed casts and interrupted unborn attacks do not spend charges or launch outputs',()=>{
  const f=make({skill:2});enemy(f);f.u.skill.addCharge(1);
  for(const flags of [{stun:true},{disarm:true}]){
    f.b.addBuff(f.u,{key:'fixture:control',flags});assert.equal(f.controller.toggle(),false);
    assert.equal(f.u.skill.charges,1);f.b.removeBuff(f.u,'fixture:control');
  }
  assert.equal(f.controller.toggle(),true);until(f,()=>f.controller.phase?.kind==='attack');
  f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true}});f.b.removeBuff(f.u,'fixture:control');
  advance(f.b,.45);assert.equal(f.births.length,0);assert.equal(f.strikes.length,0);
});
test('S2 damage callback changed target life cannot attach Fear to the replacement',()=>{
  const f=make({skill:2}),t=enemy(f);f.b.rng=()=>0;let once=false;
  f.b.on('damaged',x=>{if(!once&&x.source===f.u&&x.dmg.tags.includes('lappland:remote-drone')){
    once=true;t.deploySeq++;f.b.applyStatus(f.u,'stun',{duration:2});
  }});
  active(f);until(f,()=>once);assert.equal(f.strikes.length,1);assert.equal(t.s.flags.fear,undefined);
  advance(f.b,.1);assert.ok(f.controller.slots.every(s=>!s.lock));
});

function s3Fixture(options={}){
  const f=make({skill:3,...options}),droneHits=[],areaHits=[],attaches=[],traces=[],droneBirths=[],reappear=[];
  f.b.on('lapplandS3DroneStrike',x=>{if(x.owner===f.u)droneHits.push({...x,time:f.b.time});});
  f.b.on('lapplandS3AreaTick',x=>{if(x.owner===f.u)areaHits.push({...x,time:f.b.time});});
  f.b.on('lapplandS3Attach',x=>{if(x.owner===f.u)attaches.push({...x,time:f.b.time});});
  f.b.on('lapplandS3Trace',x=>{if(x.owner===f.u)traces.push({...x,time:f.b.time});});
  f.b.on('lapplandS3DroneBirth',x=>{if(x.owner===f.u)droneBirths.push({...x,time:f.b.time});});
  f.b.on('lapplandS3Reappear',x=>{if(x.owner===f.u)reappear.push({...x,x:x.drone.x,y:x.drone.y,time:f.b.time});});
  return Object.assign(f,{droneHits,areaHits,attaches,traces,droneBirths,reappear,s3:f.controller.s3});
}
for(let rank=1;rank<=10;rank++)test(`S3 rank ${rank}: source SP, ATK, three cruise drones and forty-second cleanup`,()=>{
  const f=s3Fixture({rank});near(f.u.skill.sp,38);assert.equal(f.u.skill.spCost,[75,73,71,69,67,65,63,60,57,54][rank-1]);
  assert.equal(f.controller.count(),1);active(f);assert.equal(f.droneBirths.length,3);assert.equal(f.controller.count(),3);
  near(f.u.s.atk,342*(1+[.3,.35,.4,.45,.5,.55,.6,.65,.7,.8][rank-1]));
  assert.equal(f.controller.toggle(),false);near(f.u.skill.timeLeft,40);near(f.u.skill.sp,0);
  assert.equal(f.u.skill.gainSp(30,'test'),0);
  for(const d of f.s3.drones)near(Math.hypot(d.x-f.u.x,d.y-f.u.y),.5);
  advance(f.b,40.1);assert.equal(f.u.skill.active,false);assert.equal(f.s3.running,false);
  assert.equal(f.u.mem.lapplandS3Drones,null);assert.equal(f.s3.drones.length,0);near(f.u.s.atk,342);
});
for(const dir of ['RIGHT','LEFT','UP','DOWN'])test(`S3 ${dir}: initial radial facing, uncapped ordinary and separate original caster loop`,()=>{
  const f=s3Fixture({dir}),[row,col]={RIGHT:[5,6],LEFT:[5,4],UP:[6,5],DOWN:[4,5]}[dir];
  enemy(f,{row,col});active(f);const d=f.s3.drones[0];
  near(d.x-f.u.x,.5*f.u.fwd[1]);near(d.y-f.u.y,.5*f.u.fwd[0]);
  until(f,()=>f.births.length===1);assert.equal(f.births[0].kind,'caster');near(f.births[0].time,1.4,f.b.dt*2);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_Loop');assert.equal(f.births.filter(x=>x.kind==='normal-drone').length,0);
  until(f,()=>f.hits.some(x=>x.dmg.tags.includes('lappland:caster')));
  near(f.hits.find(x=>x.dmg.tags.includes('lappland:caster')).amount,615.6);
});
test('S3 source spread integrates acceleration then capped speed and uses original 1.25-radius orbit',()=>{
  const f=s3Fixture();active(f);advance(f.b,1.3);const d=f.s3.drones[0];
  near(d.x-f.u.x,2.0833333,1e-4);near(d.y,f.u.y);assert.equal(d.phase,'spread');
  advance(f.b,f.b.dt);near(d.x-f.u.x,2.15,1e-4);assert.equal(d.phase,'orbit');
  const center={...d.orbit};advance(f.b,1);near(Math.hypot(d.x-center.x,d.y-center.y),1.25);
  near(d.speed,2);assert.equal(f.traces.length,0);
});
test('S3 every drone finds its nearest global enemy rather than the owner priority target',()=>{
  const f=s3Fixture();const a=enemy(f,{col:12}),z=enemy(f,{row:3,col:2,taunt:100});
  active(f);until(f,()=>f.traces.length===3);assert.equal(f.traces[0].target,a);
  assert.ok(f.traces.slice(1).some(x=>x.target===z));assert.equal(f.attacks.length,0);
});
test('S3 chase preserves inertia and limits turns rather than snapping directly to a target',()=>{
  const f=s3Fixture();active(f);const t=enemy(f,{col:12});until(f,()=>f.s3.drones[0].phase==='chase');
  const d=f.s3.drones[0],heading=d.heading,x=d.x;t.x=d.x-3;t.y=d.y;
  advance(f.b,f.b.dt);near(Math.abs(Math.atan2(Math.sin(d.heading-heading),Math.cos(d.heading-heading))),5*f.b.dt,1e-5);
  assert.ok(d.x>x);assert.equal(d.phase,'chase');assert.ok(d.speed>2&&d.speed<=4);
});
test('S3 attachment applies arrival Fear and independent initial ramp once, then live attack intervals',()=>{
  const f=s3Fixture(),t=enemy(f,{col:17});active(f);until(f,()=>f.droneHits.length>=3,15);
  assert.equal(f.births.length,0);assert.equal(f.attacks.length,0);assert.ok(t.s.flags.fear);
  near(t.findBuff('fear').duration,3);assert.equal(t.findBuff('fear').data.fear.sx,f.u.x);
  for(const d of f.droneHits.filter((x,i,a)=>a.findIndex(z=>z.drone===x.drone)===i))near(d.scale,.2);
  const first=f.droneHits[0];until(f,()=>f.droneHits.some(x=>x.drone===first.drone&&x.time>first.time));
  const second=f.droneHits.find(x=>x.drone===first.drone&&x.time>first.time);near(second.time-first.time,1.3,f.b.dt*2);near(second.scale,.35);
  assert.ok(f.hits.filter(x=>x.dmg.tags.includes('lappland:s3-drone')).every(x=>!x.dmg.isAttack&&!x.dmg.isSkill));
});
test('S3 area coverage immediately slows and hits once per second despite overlapping drones',()=>{
  const f=s3Fixture(),t=enemy(f,{col:5});active(f);advance(f.b,f.b.dt);
  assert.equal(f.areaHits.length,1);near(t.s.moveSpeed,0);near(t.findBuff('lappland:s3-area').mods.moveMul,.5);
  near(f.hits.find(x=>x.dmg.tags.includes('lappland:s3-area')).amount,738.72);
  // Keep every drone over this one recipient to exercise actual shared coverage.
  f.b.on('tick',()=>{for(const d of f.s3.drones){d.x=t.x;d.y=t.y;d.phase='orbit';d.orbit=null;d.lastAt=f.b.time;}},{priority:100});
  advance(f.b,2.1);assert.equal(f.areaHits.length,3);near(f.areaHits[1].time-f.areaHits[0].time,1,f.b.dt*2);
  assert.equal(t.buffs.filter(x=>x.key==='lappland:s3-area').length,1);
  assert.ok(f.hits.filter(x=>x.dmg.tags.includes('lappland:s3-area')).every(x=>!x.dmg.isAttack&&!x.dmg.isSkill));
});
test('S3 leaving the area immediately removes slow; reentry starts a fresh first receipt',()=>{
  const f=s3Fixture(),t=enemy(f,{col:5});active(f);advance(f.b,f.b.dt);assert.ok(t.findBuff('lappland:s3-area'));
  t.x=18;t.y=15;advance(f.b,f.b.dt);assert.equal(t.findBuff('lappland:s3-area'),null);
  const d=f.s3.drones[0];t.x=d.x;t.y=d.y;advance(f.b,f.b.dt);assert.equal(f.areaHits.length,2);
});
test('S3 area damage reads live ATK and RES separately and does not advance the attached Funnel ramp',()=>{
  const f=s3Fixture(),t=enemy(f,{col:5,res:50});active(f);advance(f.b,f.b.dt);
  near(f.hits[0].amount,369.36);assert.ok(f.s3.drones.every(d=>d.ramp.scale===0));
  f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});
  f.b.on('tick',()=>{for(const d of f.s3.drones){d.x=t.x;d.y=t.y;d.phase='orbit';d.orbit=null;d.lastAt=f.b.time;}},{priority:100});
  advance(f.b,1.1);near(f.hits.filter(x=>x.dmg.tags.includes('lappland:s3-area'))[1].amount,574.56);
});
test('S3 arrival Fear bypasses damage evasion while honoring source immunity and resistance',()=>{
  for(const state of ['evade','immune','resist']){
    const f=s3Fixture(),t=enemy(f,{col:17});
    if(state==='evade')f.b.addBuff(t,{key:'fixture:evade',mods:{dodgeArts:1}});
    if(state==='immune')t.def.immune.add('feared');
    if(state==='resist')f.b.applyStatus(t,'resist',{duration:100,value:.5});
    active(f);until(f,()=>f.attaches.length>0,15);
    if(state==='immune')assert.equal(t.s.flags.fear,undefined);else near(t.findBuff('fear').duration,state==='resist'?1.5:3);
  }
});
test('S3 attached target death reappears at source square offsets and resets ramp on the next enemy',()=>{
  const f=s3Fixture(),t=enemy(f,{col:12});active(f);until(f,()=>f.droneHits.length>0,15);
  const d=f.droneHits[0].drone,x=d.lastTargetX,y=d.lastTargetY;f.b.kill(t,f.u);f.b.rng=()=>0;
  const z=enemy(f,{row:8,col:15});until(f,()=>f.reappear.length>0);
  const first=f.reappear.find(v=>v.drone===d);near(first.x,x-.75);near(first.y,y-.75);
  until(f,()=>f.droneHits.some(v=>v.drone===d&&v.target===z),15);
  near(f.droneHits.find(v=>v.drone===d&&v.target===z).scale,.2);
});
test('S3 changed-life targets never receive old attached damage or reappear at a replacement position',()=>{
  const f=s3Fixture(),t=enemy(f,{col:12});active(f);until(f,()=>f.droneHits.length>0,15);
  const d=f.droneHits[0].drone,x=d.lastTargetX,y=d.lastTargetY,old=f.droneHits.length;
  t.deploySeq++;t.x=18;t.y=15;t.hidden=true;f.b.rng=()=>.99;advance(f.b,f.b.dt);
  assert.equal(f.droneHits.length,old);const p=f.reappear.find(v=>v.drone===d);
  near(p.x,x+.735);near(p.y,y+.735);assert.equal(t.findBuff('lappland:s3-attach'),null);
});
test('S3 autonomous drones and their area continue through owner control, while caster attacks stop',()=>{
  const f=s3Fixture(),t=enemy(f,{col:17});active(f);until(f,()=>f.droneHits.length>=3,15);
  const old=f.droneHits.length;f.b.applyStatus(f.u,'stun',{duration:5});f.b.applyStatus(f.u,'disarm',{duration:5});
  advance(f.b,2);assert.ok(f.droneHits.length>old);assert.equal(f.attacks.length,0);assert.ok(t.findBuff('lappland:s3-area'));
});
test('S3 third Alpha Wolf upgrade releases one new drone, leaving existing drone positions and phases intact',()=>{
  const f=s3Fixture({potential:6});advance(f.b,32.1);active(f);advance(f.b,15.8);
  const before=f.s3.drones.slice();assert.equal(before.length,3);until(f,()=>f.s3.drones.length===4);
  assert.deepEqual(f.s3.drones.slice(0,3),before);const last=f.s3.drones[3];assert.equal(last.phase,'spread');near(last.age,0);
  assert.equal(f.droneBirths.length,4);
});
test('S3 owner withdrawal immediately removes cruise, attach, trace and area state',()=>{
  const f=s3Fixture(),t=enemy(f,{col:12});active(f);until(f,()=>f.attaches.length>0,15);
  assert.ok(t.findBuff('lappland:s3-attach'));assert.ok(t.findBuff('lappland:s3-area'));
  f.b.retreat(f.u,{permanent:true});assert.equal(f.controller.stopped,true);assert.equal(f.s3.running,false);
  for(const key of ['lappland:s3-trace','lappland:s3-attach','lappland:s3-area'])assert.equal(t.findBuff(key),null);
  const old=f.hits.length;advance(f.b,2);assert.equal(f.hits.length,old);assert.equal(f.u.mem.lapplandS3Drones,null);
});
test('S3 birth and arrival callbacks cannot leave orphan drones, Fear or later receipts after removal',()=>{
  const birth=s3Fixture();birth.b.on('lapplandS3DroneBirth',()=>birth.b.retreat(birth.u,{permanent:true}));active(birth);
  assert.equal(birth.droneBirths.length,1);assert.equal(birth.s3.drones.length,0);assert.equal(birth.u.mem.lapplandS3Drones,null);
  const f=s3Fixture(),t=enemy(f,{col:17});f.b.on('lapplandS3Attach',()=>f.b.retreat(f.u,{permanent:true}));
  active(f);until(f,()=>f.controller.stopped,15);assert.equal(t.s.flags.fear,undefined);assert.equal(f.droneHits.length,0);
});
test('S3 area callback skill exit cancels its pending receipt and cleans slow in the same tick',()=>{
  const f=s3Fixture(),t=enemy(f,{col:5});f.b.on('lapplandS3AreaTick',()=>f.u.skill.end('fixture'));
  active(f);advance(f.b,f.b.dt);assert.equal(f.hits.length,0);assert.equal(t.findBuff('lappland:s3-area'),null);
  assert.equal(f.s3.running,false);assert.equal(f.u.mem.lapplandS3Drones,null);
});
function secondS3(f){
  const def=structuredClone(f.u.def),u=f.b._makeAlly(f.u.player,def,'op',8,5,{dir:'RIGHT'});
  const prepared=prepareLapplandAttacks(f.b,u,{contract:CONTRACT});f.b._setupUnit(u,prepared.kit);prepared.controller.install();
  assert.ok(f.b._deploy(u,{initial:false}));u.player.dp=99;u.skill.addCharge(1);assert.ok(prepared.controller.toggle());
  return {u,...prepared,s3:prepared.controller.s3};
}
function pinS3(f,t,others=[]){
  f.b.on('tick',()=>{for(const s3 of [f.s3,...others])if(s3.valid())for(const d of s3.drones){
    d.x=t.x;d.y=t.y;d.phase='orbit';d.orbit=null;d.lastAt=f.b.time;
  }},{priority:100});
}
test('S3 multiple owners share one area clock and handoff keeps its pending next tick',()=>{
  const f=s3Fixture(),t=enemy(f,{col:10});active(f);const z=secondS3(f);pinS3(f,t,[z.s3]);
  const receipts=[];f.b.on('damaged',x=>{if(x.dmg.tags.includes('lappland:s3-area'))receipts.push({...x,time:f.b.time});});
  advance(f.b,1.1);assert.equal(receipts.length,2);assert.ok(receipts.every(x=>x.source===f.u));
  f.b.retreat(f.u,{permanent:true});assert.equal(t.findBuff('lappland:s3-area').source,z.u);
  advance(f.b,.5);assert.equal(receipts.length,2);advance(f.b,.6);assert.equal(receipts.length,3);
  assert.equal(receipts[2].source,z.u);near(receipts[2].time-receipts[1].time,1,f.b.dt*2);
  z.u.skill.end('fixture');assert.equal(t.findBuff('lappland:s3-area'),null);
});
test('S3 callback owner handoff cancels that pending receipt without resetting the shared clock',()=>{
  const f=s3Fixture(),t=enemy(f,{col:10});active(f);const z=secondS3(f);pinS3(f,t,[z.s3]);
  const receipts=[];f.b.on('damaged',x=>{if(x.dmg.tags.includes('lappland:s3-area'))receipts.push({...x,time:f.b.time});});
  let fired=false;f.b.on('lapplandS3AreaTick',x=>{if(!fired&&x.owner===f.u){fired=true;f.u.skill.end('fixture');}});
  advance(f.b,.5);assert.equal(receipts.length,0);advance(f.b,.6);assert.equal(receipts.length,1);
  assert.equal(receipts[0].source,z.u);near(receipts[0].time,1,f.b.dt*2);
});
test('S3 cancelled area-buff creation never produces an area receipt; later acceptance starts normally',()=>{
  const f=s3Fixture(),t=enemy(f,{col:5});active(f);pinS3(f,t);
  const h=f.b.on('beforeBuff',x=>{if(x.buff.key==='lappland:s3-area')x.cancel=true;});
  advance(f.b,.5);assert.equal(f.areaHits.length,0);assert.equal(t.findBuff('lappland:s3-area'),null);
  f.b.off(h);advance(f.b,f.b.dt);assert.equal(f.areaHits.length,1);
});
test('S3 beforeBuff owner retirement cannot orphan area or shared target markers',()=>{
  for(const key of ['lappland:s3-area','lappland:s3-trace','lappland:s3-attach']){
    const f=s3Fixture(),t=enemy(f,{col:key.endsWith('area')?5:12});active(f);
    f.b.on('beforeBuff',x=>{if(x.buff.key===key)f.b.retreat(f.u,{permanent:true});});
    until(f,()=>f.controller.stopped,15);assert.equal(f.u.mem.lapplandS3Drones,null);
    for(const k of ['lappland:s3-area','lappland:s3-trace','lappland:s3-attach'])assert.equal(t.findBuff(k),null);
  }
});
test('S3 shared trace marker counts pursuing drones and decrements on individual attachment',()=>{
  const f=s3Fixture(),t=enemy(f,{col:17});active(f);until(f,()=>f.traces.length===3);
  assert.equal(t.findBuff('lappland:s3-trace').stacks,3);until(f,()=>f.attaches.length===1,15);
  assert.equal(t.findBuff('lappland:s3-trace').stacks,2);assert.ok(t.findBuff('lappland:s3-attach'));
  until(f,()=>f.attaches.length===3,15);assert.equal(t.findBuff('lappland:s3-trace'),null);
  assert.equal(t.buffs.filter(x=>x.key==='lappland:s3-attach').length,1);
});
test('S3 battle finish erases all fields and hooks, preventing future autonomous damage',()=>{
  const f=s3Fixture(),t=enemy(f,{col:12});active(f);until(f,()=>f.attaches.length>0,15);
  f.b.forceEnd();assert.equal(f.s3.running,false);assert.equal(f.s3.manager,null);
  assert.equal(f.controller.handles.length,0);assert.equal(t.findBuff('lappland:s3-area'),null);
  const old=f.hits.length;advance(f.b,3);assert.equal(f.hits.length,old);
});
test('S3 reactivation creates fresh drones and ramps rather than reusing ended attachments',()=>{
  const f=s3Fixture(),t=enemy(f,{col:12});active(f);until(f,()=>f.droneHits.length>3,15);
  const original=f.s3.drones.slice();f.u.skill.end('fixture');active(f);
  assert.ok(f.s3.drones.every(d=>!original.includes(d)&&d.ramp.scale===0));assert.equal(f.s3.drones.length,3);
  const old=f.droneHits.length;until(f,()=>f.droneHits.length>old,15);near(f.droneHits[old].scale,.2);
  assert.ok(t.alive);
});
test('S3 Alpha Wolf raises only attached drone caps and adds source silence after its second reward',()=>{
  const f=s3Fixture();advance(f.b,20.1);const t=enemy(f,{col:17});active(f);
  until(f,()=>f.droneHits.some(x=>x.scale>=1.21-1e-9),20);near(Math.max(...f.droneHits.map(x=>x.scale)),1.21);
  until(f,()=>t.s.flags.silence,20);near(t.findBuff('silence').duration,2);
  assert.equal(f.controller.alphaStage,2);assert.equal(f.s3.drones.length,3);
  const area=f.hits.filter(x=>x.dmg.tags.includes('lappland:s3-area'));
  assert.ok(area.length>2);for(const x of area)near(x.amount,738.72);
});
test('S3 live ASPD changes attached cadence while its shared area remains one second',()=>{
  const f=s3Fixture();enemy(f,{col:17});f.b.addBuff(f.u,{key:'fixture:haste',mods:{aspd:100}});active(f);
  until(f,()=>f.droneHits.length>3,15);const d=f.droneHits[0].drone,rows=f.droneHits.filter(x=>x.drone===d);
  until(f,()=>f.droneHits.filter(x=>x.drone===d).length>1);const next=f.droneHits.filter(x=>x.drone===d)[1];
  near(next.time-rows[0].time,.65,f.b.dt*2);
  until(f,()=>f.areaHits.length>1);near(f.areaHits[1].time-f.areaHits[0].time,1,f.b.dt*2);
});
test('S3 cannot attach through a changed target life from an arrival callback',()=>{
  const f=s3Fixture(),t=enemy(f,{col:17});let done=false;
  f.b.on('lapplandS3Attach',()=>{if(!done){done=true;t.deploySeq++;t.hidden=true;}});
  active(f);until(f,()=>done,15);assert.equal(t.s.flags.fear,undefined);assert.equal(f.droneHits.length,0);
});
test('S3 reentrant activation during old field removal keeps the new field and controller alive',()=>{
  const f=s3Fixture(),t=enemy(f,{col:5});active(f);advance(f.b,f.b.dt);
  let restarted=false;t.findBuff('lappland:s3-area').onRemove=()=>{
    if(restarted)return;restarted=true;f.u.skill.addCharge(1);assert.equal(f.controller.toggle(),true);
  };
  f.u.skill.end('fixture');assert.equal(restarted,true);assert.equal(f.u.skill.active,true);
  assert.ok(f.s3.manager&&!f.s3.manager.ended);assert.equal(f.s3.drones.length,3);
  const old=f.areaHits.length;advance(f.b,f.b.dt);assert.equal(f.areaHits.length,old+1);
  assert.ok(t.findBuff('lappland:s3-area'));f.u.skill.end('fixture');assert.equal(t.findBuff('lappland:s3-area'),null);
});
test('S3 restarted birth, arrival or strike callbacks cannot continue old drone iterations',()=>{
  for(const event of ['lapplandS3DroneBirth','lapplandS3Attach','lapplandS3DroneStrike']){
    const f=s3Fixture(),t=enemy(f,{col:17});let restarted=false;
    f.b.on(event,()=>{if(!restarted){restarted=true;f.u.skill.end('fixture');f.u.skill.addCharge(1);assert.equal(f.controller.toggle(),true);}});
    active(f);until(f,()=>restarted,15);assert.equal(f.s3.drones.length,3);
    assert.equal(f.droneBirths.length,4+(event==='lapplandS3DroneBirth'?0:2));
    assert.ok(f.s3.drones.every(d=>d.phase==='spread'&&d.epoch===f.controller.modeEpoch));
    assert.equal(f.hits.filter(x=>x.dmg.tags.includes('lappland:s3-drone')).length,0);
    if(event==='lapplandS3Attach')assert.equal(t.s.flags.fear,undefined);
  }
});
