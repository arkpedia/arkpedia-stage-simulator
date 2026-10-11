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
  prepareExusiaiCovenantS3} from '../server/sim/content/arkpedia-exusiai-covenant.js';
import {EXUSIAI_COVENANT_S3_CONTRACT} from '../server/sim/content/arkpedia-exusiai-covenant-s3.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function owner(b,{rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=3,dir='RIGHT',defer=false,row=5,col=5,contract=EXUSIAI_COVENANT_S3_CONTRACT}={}){
  const build={elite,level,potential,trust,skillId:`skchr_angel2_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedExusiaiCovenantBuild(build),c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,
    subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    tags:r.tags,
    skill:{...r.source,...r.source.spData,skillId:build.skillId,
      rangeGrid:r.source.rangeId?e.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir});
  const prepared=prepareExusiaiCovenantS3(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
  const hits=[],attacks=[],births=[],bombs=[];
  b.on('exusiaiCovenantS3ProjectileBirth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
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

function start(f){until(f,()=>f.u.skill.ready,15);assert.equal(f.u.skill.activate('manual'),true);until(f,()=>f.controller.phase?.kind!=='s3-start');}
const shots=f=>f.hits.filter(h=>h.dmg.tags.includes('angel2:s3'));

test('S3 requires its exact reviewed contract and selected third skill; historical volley-only scope remains separate from public coordinates',()=>{
  assert.throws(()=>make({contract:{...EXUSIAI_COVENANT_S3_CONTRACT}}),/contract/);
  assert.throws(()=>make({skill:2}),/third skill/);
  assert.ok(data.operators[ID]);assert.equal(REGULAR_OPERATORS[ID].mechanic,'exusiai-covenant');assert.deepEqual(e.enabledOperators,[]);
  assert.match(EXUSIAI_COVENANT_S3_CONTRACT.scope,/Coordinates.*held/);
});

test('all ten ranks require manual activation and preserve fifty rounds, source ATK bonus and per-hit physical scale',()=>{
  for(let rank=1;rank<=10;rank++){
    const f=make({rank});until(f,()=>f.u.skill.ready,20);advance(f.b,1);assert.equal(f.u.skill.active,false);
    const baseline=f.u.s.atk;start(f);assert.equal(f.u.skill.ammoLeft,50);assert.equal(f.u.skill.ammoMax,50);
    near(f.u.s.atk,baseline+f.u.base.atk*f.record.bb.atk);
    enemy(f);until(f,()=>shots(f).length===5);
    assert.equal(f.u.skill.ammoLeft,45);assert.equal(f.attacks.length,1);
    for(const h of shots(f))near(h.dmg.amount,f.u.s.atk*f.record.bb['attack@atk_scale']);
    f.u.skill.end('manual');near(f.u.s.atk,baseline);
  }
});

test('all four facings use the original first hit event and native additional timer rather than five copied animation events',()=>{
  for(const dir of ['RIGHT','UP','DOWN','LEFT']){
    const f=make({dir});start(f);enemy(f,{row:dir==='UP'?7:dir==='DOWN'?3:5,col:dir==='RIGHT'?8:dir==='LEFT'?2:5});
    until(f,()=>f.controller.phase?.kind==='s3-attack');const p=f.controller.phase;
    const clip=dir==='DOWN'?'Skill_Down_3_Loop':'Skill_3_Loop';
    assert.equal(f.u.mem.regularFormVisual.clip,clip);near(p.speed,1);
    const m=e.models[ID][['UP','LEFT'].includes(dir)?'Back':'Front'];
    near(p.releaseAt-(p.readyAt-Math.max(f.u.s.interval,m.durations[clip])),m.eventPayloads[clip][0].time);
    assert.equal(f.births.length,0);until(f,()=>f.births.length===5);
    f.births.forEach((v,i)=>{assert.equal(v.round,i);assert.equal(v.projectile.speed,30);near(v.time-f.births[0].time,i*.1,f.b.dt+1e-6);});
    assert.equal(new Set(f.births.map(v=>v.attackId)).size,1);
    assert.equal(f.u.mem.regularVisualDirection,['UP','LEFT'].includes(dir)?'UP':'RIGHT');
  }
});

test('one accepted attack consumes five actual rounds and heals five times without duplicate attack hooks',()=>{
  const f=make();start(f);enemy(f);f.u.hp=1;const heal=[],ammo=[];
  f.b.on('heal',c=>{if(c.target===f.u)heal.push(c);});
  f.b.on('ammoUsed',c=>{if(c.unit===f.u)ammo.push(c);});
  until(f,()=>f.births.length===5);assert.equal(f.attacks.length,1);assert.equal(ammo.length,1);
  assert.equal(ammo[0].count,5);assert.equal(ammo[0].left,45);assert.equal(heal.length,5);
  near(f.u.hp,1+f.u.s.maxHp*.06*5);
});

test('the shared free-command decision supplies five shots without consumption or ammunition-talent healing',()=>{
  const f=make();start(f);enemy(f);let receipts=0,rolls=0;
  f.b.rng=()=>{rolls++;return 0;};f.b.on('beforeAmmoUse',c=>{if(c.unit===f.u)c.spareShotProb=1;});
  f.b.on('ammoUsed',c=>{if(c.unit===f.u)receipts++;});f.u.hp=1;
  until(f,()=>f.births.length===5);assert.equal(f.u.skill.ammoLeft,50);assert.equal(receipts,0);
  assert.equal(rolls,1);near(f.u.hp,1);assert.equal(f.bombs.length,0);
});

test('the final five-round command retains all shots and its ATK bonus before natural exhaustion',()=>{
  const f=make();start(f);enemy(f);f.u.skill.ammoLeft=5;const atk=f.u.s.atk;
  until(f,()=>f.births.length===1);assert.equal(f.u.skill.ammoLeft,0);assert.equal(f.u.skill.active,true);
  until(f,()=>shots(f).length===5);assert.equal(f.attacks.length,1);
  for(const h of shots(f))near(h.dmg.amount,atk*1.6);
  until(f,()=>!f.u.skill.active);assert.equal(f.births.length,5);assert.equal(f.controller.phase.kind,'s3-end');
  assert.equal(f.u.skill.spTotal,0);assert.ok(f.u.s.atk<atk);
});

test('surplus rounds support another command and report only the actual remainder to talents',()=>{
  const f=make();start(f);enemy(f);f.u.skill.ammoLeft=3;const counts=[];
  f.b.on('ammoUsed',c=>{if(c.unit===f.u)counts.push(c.count);});
  until(f,()=>f.births.length===5);until(f,()=>!f.u.skill.active);
  assert.deepEqual(counts,[3]);assert.equal(f.births.length,5);assert.equal(f.attacks.length,1);
});

test('natural fifty-round exhaustion delivers ten complete commands and fifty individually mitigated shots',()=>{
  const f=make();start(f);enemy(f);const counts=[];
  f.b.on('ammoUsed',c=>{if(c.unit===f.u)counts.push(c.count);});
  until(f,()=>!f.u.skill.active,25);
  assert.deepEqual(counts,Array(10).fill(5));assert.equal(f.births.length,50);assert.equal(shots(f).length,50);
  assert.equal(new Set(f.births.map(v=>v.attackId)).size,10);assert.equal(f.attacks.length,10);
});

test('ammunition granted during a depleted command is retained for the next command rather than erased by a stale exhaustion flag',()=>{
  const f=make();start(f);enemy(f);f.u.skill.ammoLeft=5;let count=0;
  f.b.on('ammoUsed',c=>{if(c.unit===f.u&&++count===1)f.u.skill.addAmmo(5);});
  until(f,()=>!f.u.skill.active,8);assert.equal(f.births.length,10);assert.equal(shots(f).length,10);assert.equal(count,2);
});

test('additional rounds reselect a newly arrived eligible target after the primary target dies',()=>{
  const f=make();start(f);const first=enemy(f);until(f,()=>f.births.length===1);
  f.b.kill(first,f.u);const second=enemy(f,{col:7});until(f,()=>f.births.length===5);
  assert.equal(f.births[0].target,first);for(const v of f.births.slice(1))assert.equal(v.target,second);
  assert.equal(f.u.skill.ammoLeft,45);assert.equal(f.attacks.length,1);
});

test('each physical projectile is a single hit with independent mitigation, never splash',()=>{
  const f=make();start(f);const a=enemy(f),z=enemy(f,{col:7});a.base.def=1000;a.markDirty();
  until(f,()=>shots(f).length===5);assert.equal(shots(f).filter(h=>h.target===z).length,0);
  for(const h of shots(f)){assert.equal(h.target,a);assert.equal(h.dmg.isSplash,false);near(h.hpLoss,Math.max(h.dmg.amount-1000,h.dmg.amount*.05));}
});

test('a lost primary before the first accepted birth neither spends ammo nor fabricates later rounds',()=>{
  const f=make();start(f);const a=enemy(f);until(f,()=>f.controller.phase?.kind==='s3-attack');
  f.b.kill(a,f.u);advance(f.b,2);assert.equal(f.births.length,0);assert.equal(f.u.skill.ammoLeft,50);assert.equal(f.attacks.length,0);
});

test('an attack hook rejecting the first input cannot start the command or consume ammunition',()=>{
  const f=make();start(f);enemy(f);f.b.on('beforeAttack',c=>{if(c.attacker===f.u)c.targets=[];});
  advance(f.b,2);assert.equal(f.births.length,0);assert.equal(f.attacks.length,0);assert.equal(f.u.skill.ammoLeft,50);
});

test('stun or disarm before the first event cancels the unfired command and leaves all ammo',()=>{
  for(const flags of [{stun:true},{disarm:true}]){
    const f=make();start(f);enemy(f);until(f,()=>f.controller.phase?.kind==='s3-attack');
    f.b.addBuff(f.u,{key:'fixture:control',flags});advance(f.b,1);
    assert.equal(f.births.length,0);assert.equal(f.u.skill.ammoLeft,50);f.b.removeBuff(f.u,'fixture:control');until(f,()=>f.births.length===5);
    assert.equal(f.u.skill.ammoLeft,45);
  }
});

test('control after the first birth cancels unborn rounds while a fired projectile survives',()=>{
  const f=make();start(f);enemy(f,{col:8});until(f,()=>f.births.length===1);
  f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true}});advance(f.b,1);
  assert.equal(f.births.length,1);assert.equal(shots(f).length,1);assert.equal(f.u.skill.ammoLeft,45);
});

test('manual stop cancels unborn rounds, removes the ATK bonus and plays the original End clip',()=>{
  const f=make();start(f);enemy(f,{col:8});until(f,()=>f.births.length===1);const boosted=f.u.s.atk;
  f.u.skill.end('manual');assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_End');advance(f.b,.7);
  assert.equal(f.births.length,1);assert.equal(shots(f).length,1);assert.ok(f.u.s.atk<boosted);
  near(shots(f)[0].dmg.amount,f.u.s.atk*1.6);
});

test('withdrawal cancels unborn rounds, clears the controller and preserves an already born projectile',()=>{
  const f=make();start(f);enemy(f,{col:8});until(f,()=>f.births.length===1);f.b.retreat(f.u);advance(f.b,1);
  assert.equal(f.births.length,1);assert.equal(shots(f).length,1);assert.equal(f.controller.stopped,true);
  assert.equal(f.u.mem.regularFormVisual,null);assert.equal(f.controller.handles.length,0);
});

test('current ATK is read per arrival and late camouflage, hidden state or life replacement prevents damage',()=>{
  const f=make();start(f);enemy(f,{col:8});until(f,()=>f.births.length===1);
  f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});until(f,()=>shots(f).length===1);
  near(shots(f)[0].dmg.amount,f.u.s.atk*1.6);
  for(const invalid of ['camou','hidden','life']){
    const q=make();start(q);const a=enemy(q,{col:8});until(q,()=>q.births.length===1);
    if(invalid==='camou')q.b.addBuff(a,{key:'fixture:camou',flags:{camou:true}});
    if(invalid==='hidden')a.hidden=true;if(invalid==='life')a.deploySeq++;
    q.u.skill.end('manual');advance(q.b,.5);assert.equal(shots(q).length,0);
  }
});

test('hidden state cancels unborn rounds and ends a depleted command without leaving SP permanently locked',()=>{
  const f=make();start(f);enemy(f);f.u.skill.ammoLeft=5;until(f,()=>f.births.length===1);
  f.u.hidden=true;advance(f.b,.5);assert.equal(f.u.skill.active,false);assert.equal(f.births.length,1);
  f.u.hidden=false;advance(f.b,.5);assert.equal(f.controller.stopped,false);assert.ok(f.u.skill.spTotal>0);
});

test('original normal clip speed is capped with fast ASPD and slows all mapped births with slow ASPD',()=>{
  for(const aspd of [200,50]){
    const f=make();start(f);f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd:aspd-100}});enemy(f);
    until(f,()=>f.controller.phase?.kind==='s3-attack');const p=f.controller.phase;
    near(p.speed,Math.min(1,f.u.base.bat/f.u.s.interval));until(f,()=>f.births.length===5);
    near(f.births[4].time-f.births[0].time,.4/p.speed,f.b.dt+1e-5);
  }
});

test('five-bullet consumption supplies five separate talent rolls and ordered healing before the first roll',()=>{
  const f=make();start(f);enemy(f);f.u.hp=1;let calls=0;const hp=[];
  f.b.rng=()=>{calls++;hp.push(f.u.hp);return 0;};until(f,()=>f.births.length===5);
  assert.equal(calls,5);for(const v of hp)near(v,1+f.u.s.maxHp*.06*5);
  until(f,()=>f.bombs.length===5);
  assert.equal(f.bombs.length,5);assert.equal(f.u.skill.ammoLeft,45);
});

test('a removal during the consumption receipt does not resurrect extra rounds or duplicate ammo',()=>{
  const f=make();start(f);enemy(f,{col:8});let receipts=0;
  f.b.on('ammoUsed',c=>{if(c.unit===f.u){receipts++;f.b.retreat(f.u);}});
  until(f,()=>receipts===1);advance(f.b,1);assert.equal(f.births.length,1);assert.equal(receipts,1);assert.equal(f.controller.stopped,true);
});

test('native no-target, Born and silence permissions remain usable through the private runtime',()=>{
  const f=make();f.b.addBuff(f.u,{key:'fixture:silence',flags:{silence:true}});f.u.skill.charges=1;
  assert.equal(f.controller.phase.kind,'entrance');assert.equal(f.u.skill.activate('manual'),true);advance(f.b,.5);
  assert.equal(f.u.skill.active,true);assert.equal(f.u.skill.ammoLeft,50);assert.equal(f.births.length,0);
  f.u.skill.end('manual');advance(f.b,1.1);assert.equal(f.u.skill.active,false);assert.equal(f.controller.phase,null);
});

test('battle finish clears all born projectiles and detached S3 command state',()=>{
  const f=make();start(f);enemy(f,{col:8});until(f,()=>f.births.length===1);f.b._finish('victory');advance(f.b,.5);
  assert.equal(shots(f).length,0);assert.equal(f.controller.stopped,true);assert.equal(f.controller.phase,null);
  assert.equal(f.b.projectiles.list.filter(p=>p.data?.exusiaiCovenantOwner===f.controller).length,0);
});
