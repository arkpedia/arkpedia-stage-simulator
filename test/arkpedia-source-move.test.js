// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { sourceMoveRespawn, SOURCE_MOVE_REASON } from '../server/sim/content/arkpedia-source-move.js';
import { COLS } from '../server/sim/constants.js';
const ID = 'char_263_skadi', OTHER = 'char_208_melan';
const near = (x,y) => assert.ok(Math.abs(x-y)<1e-6, `${x} != ${y}`);
function make(id=ID) {
  const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];
  d.stage.battle.dp_per_second=0;
  const op=d.operators[id],build={...defaultBuild(op),elite:2,level:op.phases[2].maxLevel,
    skillId:op.skills[2]?.id ?? op.skills[0].id,skillRank:10};
  const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[OTHER])]});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  b.getPlayer('arkpedia').dp=99;
  const u=b.deployOperator(id,3,1,'RIGHT');u.profile.noAttack=true;u.skill.rule='NEVER';
  return{b,u,id};
}
const policy=(u,more={})=>({carryBuffKeys:u.buffs.map(x=>x.key),rebuildBuffs:[],
  checkBuild:true,clearSp:true,...more});
function step(b,secs) { const end=b.time+secs;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]); }
const snapshot=(b,u)=>({position:[u.tileR,u.tileC,u.x,u.y],seq:u.deploySeq,
  hp:u.hp,sp:u.skill.spTotal,dp:b.dp,slots:b.deployedSlots(),bench:{...b.bench[u.defId]},
  buffs:u.buffs.slice(),pending:u.skill.pending,reservations:[...(b._tileReservations??[])]});

test('source move preserves selected skill progress and reconstructs HP ratio without healing/damage/deploy/death',()=>{
  const{b,u}=make();step(b,.37);u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);
  step(b,2.3);u.hp=u.s.maxHp*.37;
  b.addBuff(u,{key:'test:stacks',stacks:2,mods:{hpFlat:120,atkFlat:30}});
  const ratio=u.hpRatio,timeLeft=u.skill.timeLeft,activation=u.skill.activations,skill=u.skill;
  const keep=u.findBuff('test:stacks'),events=[];
  for(const name of ['sourceMoveFinish','sourceMoveBorn','deploy','kill','death','retreat','healed','damaged'])
    b.on(name,c=>events.push({name,c}));
  const before=snapshot(b,u);
  assert.equal(sourceMoveRespawn(b,u,2,4,policy(u,{carryBuffKeys:['test:stacks'],
    rebuildBuffs:[{key:u.skill._buffKey,source:u,mods:{hpPct:.8,atkPct:2.6}}]})),true);
  assert.equal(u.skill,skill);assert.equal(u.skill.active,true);near(u.skill.timeLeft,timeLeft);
  assert.equal(u.skill.activations,activation);near(u.hpRatio,ratio);
  assert.equal(u.findBuff('test:stacks'),keep);assert.equal(keep.stacks,2);
  near(u.s.maxHp,(u.base.maxHp+240)*1.8);
  assert.ok(u.deploySeq>before.seq);near(u.deployedAt,b.time);near(b.dp,before.dp);
  assert.equal(b.deployedSlots(),before.slots);
  assert.equal(b.bench[u.defId].deployments,before.bench.deployments);
  assert.equal(b.bench[u.defId].lastCost,before.bench.lastCost);
  assert.equal(b.bench[u.defId].readyAt,before.bench.readyAt);
  assert.deepEqual(events.map(x=>x.name),['sourceMoveFinish','sourceMoveBorn']);
  assert.equal(events[0].c.reason,SOURCE_MOVE_REASON);
  near(u.skill.sp,0);assert.equal(u.skill.charges,0);
  const end=b.time+timeLeft;step(b,timeLeft+.1);assert.equal(u.skill.active,false);assert.ok(b.time>=end);
});

test('explicit carry policy keeps identity/deadline, drops omitted controls and rebuilds only one selected parent',()=>{
  const{b,u}=make();b.addBuff(u,{key:'foreign:carry',duration:9,mods:{atkPct:.2}});
  b.addBuff(u,{key:'foreign:drop',duration:7,mods:{defFlat:17}});b.applyStatus(u,'stun',{duration:4});
  const carry=u.findBuff('foreign:carry');step(b,.4);const remaining=carry.timeLeft;
  assert.equal(sourceMoveRespawn(b,u,2,4,policy(u,{carryBuffKeys:['foreign:carry'],
    rebuildBuffs:[{key:'source:parent',source:u,flags:{noSp:true},mods:{atkPct:2.6,hpPct:.8}}]})),true);
  assert.equal(u.findBuff('foreign:carry'),carry);near(carry.timeLeft,remaining);
  assert.equal(u.findBuff('foreign:drop'),null);assert.equal(u.findBuff('stun'),null);
  assert.equal(u.buffs.filter(x=>x.key==='source:parent').length,1);assert.equal(u.s.flags.noSp,true);
  near(u.s.atk,u.base.atk*3.8);step(b,remaining+.1);assert.equal(u.findBuff('foreign:carry'),null);
});

test('origin reservation has no unit/obstacle/slot cost and blocks operators, tokens, devices and ordinary movement',()=>{
  const{b,u}=make();const units=b.allyUnits.length,slots=b.deployedSlots();
  assert.equal(sourceMoveRespawn(b,u,2,4,policy(u,{reserveOrigin:true,reservationKey:'token_10039_ulpia_block'})),true);
  assert.equal(b.allyUnits.length,units);assert.equal(b.deployedSlots(),slots);
  assert.equal(b._occ[3*COLS+1],null);assert.equal(b.grid.tile(3,1).build,'ALL');
  assert.equal(b.tileReservation(3,1).owner,u);
  assert.match(b.placementError(OTHER,3,1),/reserved/);
  assert.equal(b.spawnDevice('test',3,1),null);
  const ally=b.deployOperator(OTHER,3,2,'RIGHT');assert.equal(b.relocate(ally,3,1),false);
  // The actual low-level token/operator deployment gate also rejects it.
  assert.equal(b._deploy({alive:false,deployed:false,homeR:3,homeC:1}),false);
  assert.equal(sourceMoveRespawn(b,u,3,1,policy(u)),true);
  b.releaseTileReservations(u,'token_10039_ulpia_block');
  assert.equal(b.tileReservation(3,1),null);assert.equal(b._occ[3*COLS+1],u);
  near(b.dp,99-b.bench[ID].lastCost-b.bench[OTHER].lastCost);
});

test('true withdrawal and death clear the footprint and never resurrect or perform a return',()=>{
  for(const death of [false,true]) {
    const{b,u}=make();sourceMoveRespawn(b,u,2,4,policy(u,{reserveOrigin:true,reservationKey:'source:return'}));
    let born=0;b.on('sourceMoveBorn',()=>born++);
    if(death)b.kill(u);else b.retreatOperator(ID);
    assert.equal(b.tileReservation(3,1),null);assert.equal(u.alive,false);assert.equal(u.deployed,false);
    assert.equal(sourceMoveRespawn(b,u,3,1,policy(u)),false);assert.equal(born,0);
    assert.deepEqual([u.tileR,u.tileC],[2,4]);
  }
});

test('preflight refuses invalid endpoints, foreign reservations, occupied tiles and malformed carry before mutation',()=>{
  const{b,u}=make();const ally=b.deployOperator(OTHER,3,2,'RIGHT');
  assert.equal(b.reserveTile(ally,2,5,'other'),true);
  b.grid.tile(2,6).build='RANGED';const before=snapshot(b,u);
  const cases=[[-1,4,policy(u)],[2.1,4,policy(u)],[99,99,policy(u)],
    [3,2,policy(u)],[2,5,policy(u)],[2,6,policy(u)],[3,1,policy(u)],
    [2,4,{}],[2,4,policy(u,{carryBuffKeys:[7]})],
    [2,4,policy(u,{rebuildBuffs:[{key:'x'},{key:'x'}]})],
    [2,4,policy(u,{carryBuffKeys:['x'],rebuildBuffs:[{key:'x'}]})],
    [2,4,policy(u,{reserveOrigin:true})]];
  let events=0;b.on('sourceMoveBorn',()=>events++);
  for(const[r,c,p]of cases){assert.equal(sourceMoveRespawn(b,u,r,c,p),false);assert.deepEqual(snapshot(b,u),before);}
  assert.equal(events,0);
});

test('explicit in-place respawn advances the lifetime without fabricating a phantom return tile',()=>{
  const{b,u}=make(),seq=u.deploySeq;let inPlace=false;b.on('sourceMoveBorn',c=>inPlace=c.inPlace);
  assert.equal(sourceMoveRespawn(b,u,3,1,policy(u,{allowInPlace:true,reserveOrigin:true,reservationKey:'source:return'})),true);
  assert.ok(u.deploySeq>seq);assert.equal(inPlace,true);assert.equal(b.tileReservation(3,1),null);
});

test('resident removal callbacks cannot resurrect a unit killed during the accepted move',()=>{
  const{b,u}=make();b.addBuff(u,{key:'lethal:on-remove',onRemove:()=>b.kill(u)});
  let born=0;b.on('sourceMoveBorn',()=>born++);
  assert.equal(sourceMoveRespawn(b,u,2,4,policy(u,{carryBuffKeys:[],rebuildBuffs:[],
    reserveOrigin:true,reservationKey:'source:return'})),true);
  assert.equal(u.alive,false);near(u.hp,0);assert.equal(born,0);assert.equal(b.tileReservation(3,1),null);
});

test('move refreshes range/occupancy/block ownership while existing ordinary relocation still retains resident state',()=>{
  const{b,u}=make();const e=b.spawnEnemy('enemy_1007_slime',{pos:[3,1]});
  e.blockedBy=u;u.blocking=[e];b.addBuff(u,{key:'foreign:ordinary',mods:{atkFlat:3}});
  const buff=u.findBuff('foreign:ordinary');assert.equal(b.moveRedeploy(u,2,4),true);
  assert.equal(u.findBuff('foreign:ordinary'),buff);assert.equal(e.blockedBy,null);assert.deepEqual(u.blocking,[]);
  assert.equal(b._occ[3*COLS+1],null);assert.equal(b._occ[2*COLS+4],u);
  assert.ok(u.rangeKeys.includes(2*COLS+4));assert.equal(b.tileReservation(3,1),null);
});

test('new lifetime cancels unborn attacks but preserves an already emitted unowned projectile',()=>{
  const{b,u}=make('char_103_angel');u.profile.noAttack=false;u.atkCd=1000;
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[3,7]});
  Object.assign(e.base,{maxHp:100000,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=100000;
  b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();
  const output=[];b.on('damaged',c=>{if(c.source===u&&c.target===e)output.push(c);});
  assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;
  assert.equal(sourceMoveRespawn(b,u,2,1,policy(u)),true);u.atkCd=1000;
  step(b,.8);assert.equal(output.length,0);
  Object.assign(e,{x:4,y:2,tileR:2,tileC:4});b._enemiesDirty=true;b._buildEnemyIndex();
  u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);
  assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;
  for(let i=0;i<60&&!b.projectiles.list.length;i++)b.step();
  assert.ok(b.projectiles.list.length);const born=b.projectiles.list[0];
  assert.equal(sourceMoveRespawn(b,u,3,1,policy(u)),true);u.atkCd=1000;
  assert.ok(b.projectiles.list.includes(born));step(b,.8);
  assert.equal(output.length,1,'born flight hits, detached unborn additional shots do not');
});

test('repeated moves do not reinstall damage handlers or reapply owned allied benefits',()=>{
  const{b,u}=make();const ally=b.deployOperator(OTHER,3,2,'RIGHT');
  const benefit=b.addBuff(ally,{key:'source:ally-stacks',source:u,mods:{hpFlat:60,atkFlat:15},stacks:2});
  let receipts=0;b.on('damaged',c=>{if(c.target===u)receipts++;},{owner:u});
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[3,7]});
  b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});
  for(let i=0;i<5;i++) {
    assert.equal(sourceMoveRespawn(b,u,2,i%2?3:4,policy(u)),true);
    assert.equal(ally.findBuff('source:ally-stacks'),benefit);assert.equal(benefit.stacks,2);
    b.dealDamage(e,u,{amount:10,type:'true'});
  }
  assert.equal(receipts,5);
});
