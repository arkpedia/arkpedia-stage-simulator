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
  prepareExusiaiCovenantS2} from '../server/sim/content/arkpedia-exusiai-covenant.js';
import {EXUSIAI_COVENANT_S2_CONTRACT} from '../server/sim/content/arkpedia-exusiai-covenant-s2.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function owner(b,{rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=2,dir='RIGHT',defer=false,row=5,col=5,contract=EXUSIAI_COVENANT_S2_CONTRACT}={}){
  const build={elite,level,potential,trust,skillId:`skchr_angel2_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedExusiaiCovenantBuild(build),c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,
    subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    tags:r.tags,
    skill:{...r.source,...r.source.spData,skillId:build.skillId,
      rangeGrid:r.source.rangeId?e.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir});
  const prepared=prepareExusiaiCovenantS2(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
  const hits=[],attacks=[],births=[],bombs=[];
  b.on('exusiaiCovenantS2ProjectileBirth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
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

function ally(f,{row=5,col=6,hp=9000,aspd=100,kind='op',flags={}}={}){
  const def=normalizeChess({chessId:'fixture:ally',charId:'fixture:ally',profession:'GUARD',stats:{maxHp:hp,atk:0,def:0,attackSpeed:aspd,baseAttackTime:1},rangeGrid:[[0,0]]});
  const a=f.b._makeAlly(f.u.player,def,kind,row,col,{dir:'RIGHT'});
  f.b._setupUnit(a,{trait:{noAttack:true},talents:[],skill:{kind:'instant',trigger:{rule:'NEVER'}}});
  a.player.dp=99;assert.ok(f.b._deploy(a,{initial:false}));f.b.addBuff(a,{key:'fixture:flags',flags});return a;
}
function start(f){until(f,()=>f.u.skill.ready,15);assert.equal(f.u.skill.activate('manual'),true);until(f,()=>f.controller.phase?.kind!=='s2-start');}
const shield=a=>a.findBuff('angel2:s2-shield');

test('S2 enforces its exact contract and selected second skill while the native receipt retains its historical hold',()=>{
  assert.throws(()=>make({contract:{...EXUSIAI_COVENANT_S2_CONTRACT}}),/contract/);
  assert.throws(()=>make({skill:1}),/second skill/);
  assert.ok(data.operators[ID]);assert.equal(REGULAR_OPERATORS[ID].mechanic,'exusiai-covenant');assert.deepEqual(e.enabledOperators,[]);
});

test('all ten ranks require manual activation, grant thirty-five rounds and snapshot source self-shield capacity',()=>{
  for(let rank=1;rank<=10;rank++){
    const f=make({rank});until(f,()=>f.u.skill.ready);advance(f.b,1);assert.equal(f.u.skill.active,false);
    start(f);assert.equal(f.u.skill.ammoLeft,35);assert.equal(f.u.skill.ammoMax,35);
    near(shield(f.u).shield,f.u.s.maxHp*f.record.bb.shield_max_hp_ratio);
    near(f.u.s.bat,f.u.base.bat-.7);advance(f.b,1);assert.equal(f.u.skill.spTotal,0);
  }
});

test('one in-range operator supplies seventy ASPD, five extra rounds and a shield based on Exusiai rather than recipient HP',()=>{
  const f=make(),a=ally(f,{hp:9999}),out=ally(f,{col:12});const before=a.s.aspd;
  start(f);near(a.s.aspd,before-70);near(f.u.s.aspd,f.u.base.aspd+70);
  assert.equal(f.u.skill.ammoLeft,40);assert.equal(f.u.skill.ammoMax,40);
  const capacity=f.u.s.maxHp*2.5;near(shield(a).shield,capacity);near(shield(f.u).shield,capacity);
  assert.notEqual(capacity,a.s.maxHp*2.5);assert.equal(shield(out),null);
  near(out.s.aspd,100);assert.equal(f.controller.s2.loan.target,a);
});

test('cast-time ally selection excludes summons, self, isolated, hidden, sleeping and target-free recipients',()=>{
  for(const opts of [{kind:'token'},{flags:{isolated:true}},{flags:{untargetable:true}},{flags:{sleep:true}},{hidden:true}]){
    const f=make(),a=ally(f,opts);if(opts.hidden)a.hidden=true;
    start(f);assert.equal(f.u.skill.ammoLeft,35);assert.equal(f.controller.s2.loan,null);
    near(f.u.s.aspd,f.u.base.aspd);assert.equal(shield(a),null);
  }
});

test('selected latest-deployment mapping borrows from only one ally and never redistributes on later deployments',()=>{
  const f=make(),a=ally(f,{col:6}),z=ally(f,{col:7});start(f);
  assert.equal(f.controller.s2.loan.target,z);near(a.s.aspd,100);near(z.s.aspd,30);
  const later=ally(f,{col:8});advance(f.b,1);near(later.s.aspd,100);assert.equal(shield(later),null);
});

test('retiring a selected ally restores its debuff but retains owner speed and already granted ammunition',()=>{
  const f=make(),a=ally(f);start(f);f.b.retreat(a);advance(f.b,f.b.dt);
  assert.equal(f.controller.s2.loan,null);near(f.u.s.aspd,f.u.base.aspd+70);assert.equal(f.u.skill.ammoLeft,40);
  near(a.s.aspd,100);assert.equal(f.controller.s2.monitor,null);assert.equal(shield(a),null);
});

test('manual end clears source-owned speed and interval changes but does not erase either independent shield',()=>{
  const f=make(),a=ally(f);start(f);const self=shield(f.u),other=shield(a);
  f.u.skill.end('manual');near(f.u.s.aspd,f.u.base.aspd);near(a.s.aspd,100);near(f.u.s.bat,f.u.base.bat);
  assert.equal(shield(f.u),self);assert.equal(shield(a),other);advance(f.b,1);
  near(other.shield,other.data.exusiaiCovenantS2Shield.capacity*29/30);
  assert.equal(f.controller.s2.monitor,null);
});

test('both barriers decay their remaining capacity once a second and use a snapshot despite later Max HP buffs',()=>{
  const f=make(),a=ally(f);start(f);const sa=shield(a),su=shield(f.u),cap=sa.shield;
  f.b.addBuff(f.u,{key:'fixture:hp',mods:{hpPct:1}});void f.u.s;
  const hp=a.hp;near(f.b.dealDamage(f.u,a,{amount:100,type:'true'}),0);near(a.hp,hp);near(sa.shield,cap-100);
  advance(f.b,.8);near(sa.shield,cap-100);advance(f.b,.25);near(sa.shield,cap-cap/30-100);near(su.shield,cap*29/30);
  advance(f.b,29.1);assert.equal(shield(a),null);assert.equal(shield(f.u),null);assert.equal(f.controller.s2.shieldHooks.length,0);
});

test('damage exhaustion immediately removes only the broken barrier',()=>{
  const f=make(),a=ally(f);start(f);const total=shield(a).shield,hp=a.hp;
  near(f.b.dealDamage(f.u,a,{amount:total+50,type:'true'}),50);near(a.hp,hp-50);
  assert.equal(shield(a),null);assert.ok(shield(f.u));
});

test('withdrawal restores the borrowed ally but its independent barrier keeps decaying and fully cleans up',()=>{
  const f=make(),a=ally(f);start(f);const s=shield(a),capacity=s.shield;
  f.b.retreat(f.u);near(a.s.aspd,100);assert.equal(shield(a),s);assert.equal(f.controller.s2.monitor,null);
  advance(f.b,1.1);near(s.shield,capacity*29/30);advance(f.b,29);
  assert.equal(shield(a),null);assert.equal(f.controller.s2.shieldHooks.length,0);
});

test('all facings release eventless single projectiles at attack start, with native speed and cached ATK',()=>{
  for(const dir of ['RIGHT','UP','DOWN','LEFT']){
    const f=make({dir});start(f);enemy(f,{row:dir==='UP'?7:dir==='DOWN'?3:5,col:dir==='RIGHT'?8:dir==='LEFT'?2:5});
    until(f,()=>f.births.length===1);const shot=f.births[0];assert.equal(shot.projectile.speed,30);
    assert.equal(f.u.mem.regularFormVisual.clip,dir==='DOWN'?'Skill_Down_2_Loop':'Skill_2_Loop');
    assert.equal(f.u.skill.ammoLeft,34);f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});
    until(f,()=>f.hits.some(h=>h.dmg.tags.includes('angel2:s2')));
    near(f.hits.find(h=>h.dmg.tags.includes('angel2:s2')).dmg.amount,shot.cachedAtk*3);
  }
});

test('shortened source interval determines S2 cadence instead of waiting for the capped visual loop',()=>{
  const f=make();ally(f);start(f);enemy(f);until(f,()=>f.births.length>=3);
  const interval=(f.u.base.bat-.7)*100/(f.u.base.aspd+70);
  for(let i=1;i<3;i++)near(f.births[i].time-f.births[i-1].time,interval,f.b.dt+.001);
  assert.ok(interval<.8);assert.equal(f.u.mem.regularFormVisual.speed,1);
});

test('free S2 rounds avoid ammunition talents; a spent round heals once and the final emitted shot survives natural end',()=>{
  const f=make();start(f);enemy(f,{col:8});let heals=0;f.u.hp=10;
  f.b.on('calculatedHeal',x=>{if(x.target===f.u)heals++;});const h=f.b.on('beforeAmmoUse',x=>{x.spareShotProb=1;});
  until(f,()=>f.births.length===1);assert.equal(f.u.skill.ammoLeft,35);assert.equal(heals,0);f.b.off(h);
  f.u.skill.ammoLeft=1;until(f,()=>f.births.length===2);assert.equal(heals,1);assert.equal(f.u.skill.active,false);
  until(f,()=>f.hits.filter(h=>h.dmg.tags.includes('angel2:s2')).length===2);
});

test('death before the Begin work prevents borrowing, while stun pauses attacks without ending an active loan',()=>{
  const f=make(),a=ally(f);until(f,()=>f.u.skill.ready);assert.ok(f.u.skill.activate());f.b.retreat(a);
  until(f,()=>f.controller.phase?.kind!=='s2-start');assert.equal(f.u.skill.ammoLeft,35);near(f.u.s.aspd,f.u.base.aspd);
  const z=make(),partner=ally(z);start(z);const t=enemy(z);z.b.applyStatus(z.u,'stun',{duration:1,source:t});
  advance(z.b,.5);assert.equal(z.births.length,0);near(partner.s.aspd,30);near(z.u.s.aspd,z.u.base.aspd+70);
  until(z,()=>z.births.length===1);
});

test('battle completion removes both independent shields, transfer modifiers and all emitted projectiles',()=>{
  const f=make(),a=ally(f);start(f);enemy(f);until(f,()=>f.births.length===1);
  f.b.finished=true;f.b.emit('battleEnd',{});assert.equal(shield(f.u),null);assert.equal(shield(a),null);
  assert.equal(f.controller.s2.shieldHooks.length,0);assert.equal(f.controller.s2.monitor,null);
  assert.equal(f.b.projectiles.list.filter(p=>p.data?.exusiaiCovenantOwner===f.controller).length,0);
  near(a.s.aspd,100);
});

test('every selected rank uses its own S2 damage multiplier and cached source ATK',()=>{
  for(let rank=1;rank<=10;rank++){
    const f=make({rank});start(f);enemy(f,{col:8});until(f,()=>f.births.length===1);
    const shot=f.births[0];until(f,()=>f.hits.some(h=>h.dmg.tags.includes('angel2:s2')));
    near(f.hits.find(h=>h.dmg.tags.includes('angel2:s2')).dmg.amount,shot.cachedAtk*f.record.bb['attack@atk_scale']);
  }
});

test('an emitted S2 projectile retains its cached damage after owner withdrawal',()=>{
  const f=make();start(f);enemy(f,{col:8});until(f,()=>f.births.length===1);const shot=f.births[0];
  f.b.retreat(f.u);until(f,()=>f.hits.some(h=>h.dmg.tags.includes('angel2:s2')));
  near(f.hits.find(h=>h.dmg.tags.includes('angel2:s2')).dmg.amount,shot.cachedAtk*3);
  assert.equal(f.controller.handles.length,0);
});

test('independent barriers replace previous shared barriers without stranding producer hooks',()=>{
  const f=make(),a=ally(f);start(f);const old=shield(a);f.u.skill.end('manual');
  until(f,()=>f.controller.phase?.kind!=='s2-end');const oldState=old.data.exusiaiCovenantS2Shield;
  f.u.skill.addCharge(1);assert.ok(f.u.skill.activate());until(f,()=>f.controller.phase?.kind!=='s2-start');
  assert.notEqual(shield(a),old);assert.equal(f.controller.s2.shields.has(oldState),false);
  assert.equal(f.controller.s2.shields.size,2);assert.equal(f.controller.s2.shieldHooks.length,3);
  f.u.skill.end('manual');advance(f.b,30.1);assert.equal(f.controller.s2.shields.size,0);
  assert.equal(f.controller.s2.shieldHooks.length,0);
});

test('cleanup checks the loan source and overlapping steals use the strongest victim loss',()=>{
  const f=make(),a=ally(f);start(f);
  const z=owner(f.b,{skill:2,row:5,col:4});start(z);
  assert.equal(z.controller.s2.loan.target,a);near(a.s.aspd,30);
  const secondKey=z.controller.s2.loan.key;
  f.u.skill.end('manual');assert.ok(a.findBuff(secondKey));near(a.s.aspd,30);
  near(z.u.s.aspd,z.u.base.aspd+70);z.u.skill.end('manual');near(a.s.aspd,100);
});

test('target invalidation retains owner gain until skill end and restores bonus bar capacity without deleting ammunition',()=>{
  const f=make(),a=ally(f);start(f);f.u.skill.ammoLeft=30;
  f.b.addBuff(a,{key:'fixture:isolate',flags:{isolated:true}});advance(f.b,f.b.dt);
  assert.equal(f.u.skill.ammoLeft,30);assert.equal(f.u.skill.ammoMax,35);near(a.s.aspd,100);
  near(f.u.s.aspd,f.u.base.aspd+70);f.u.skill.end('manual');near(f.u.s.aspd,f.u.base.aspd);
});

test('source skill can start in Born or under silence through the held private runtime',()=>{
  const f=make();f.b.addBuff(f.u,{key:'fixture:silence',flags:{silence:true}});
  f.u.skill.addCharge(1);assert.ok(f.u.skill.activate());assert.equal(f.controller.phase.kind,'s2-start');
  assert.ok(f.b.time<1);until(f,()=>f.controller.phase?.kind!=='s2-start');assert.ok(shield(f.u));
});

test('the Geek drain bypasses both shield and damage modifiers rather than consuming S2 capacity',()=>{
  const f=make();start(f);const cap=shield(f.u).shield;
  f.b.addBuff(f.u,{key:'fixture:invuln',flags:{invulnerable:true},mods:{dmgTakenMul:0}});
  const hp=f.u.hp,nextDrain=f.controller.drainAt;until(f,()=>f.controller.drainAt>nextDrain);
  assert.ok(f.u.hp<hp);near(shield(f.u).shield,cap);
});
