// SPDX-License-Identifier: GPL-3.0-or-later
// Original alias/clock and captured-life checks, not native FSM/frame proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { applySourceSlowDown, NATIVE_SLOW_DOWN_CONTRACT } from '../server/sim/content/arkpedia-slow-down.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const records=read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
const key='enemy_1107_uoffcr',miner='enemy_3010_mcreep';
function fixture(mode='attack'){
  const h=makeBattle({content:'generic',autoFinish:false,setup:installEnemyFeatures,
    defs:{enemies:Object.fromEntries([key,miner].map(k=>[k,records[k].levels[0]])),
      chess:{dummy:chessRec({id:'dummy',stats:{maxHp:1e6,atk:0,def:0,blockCnt:mode==='combat'?2:0}})}},
    units:[{chessId:'dummy',row:10,col:mode==='combat'?7:5}]});
  h.b.start();const e=h.spawn(key,{pos:[10,7]});e.base.moveSpeed=0;e.markDirty();e.profile.noAttack=true;
  const target=mode==='combat'?h.unit('dummy'):h.spawn(miner,{pos:[10,8.2]});
  if(mode==='attack'){target.base.moveSpeed=0;target.base.def=0;target.base.maxHp=1e6;target.markDirty();target.hp=target.s.maxHp;}
  h.run(.1);assert.equal(e.profile.attackMode(),mode);
  const a=e.mem.ab.list.find(a=>a.ordinary);assert.ok(a);
  return{h,b:h.b,e,a,u:target,mode};
}
function begin(f){assert.equal(f.a.ordinary.begin([f.u]),true);return f.a.ordinary.pending;}
function slow(f){return applySourceSlowDown(f.b,f.h.unit('dummy'),f.e,{key:'patrol-clock-test',increment:.5,maxStrength:.5,maxStacks:1,duration:30,contract:NATIVE_SLOW_DOWN_CONTRACT});}
test('Patrol clock recipe binds body, mode, animator aliases and original skeleton byte hashes',()=>{
  const c=read('data/candidates/arkpedia-ch16-patrol-clock-contract.json');
  assert.equal(c.testOnly,true);assert.equal(c.frameParity,false);assert.deepEqual(Object.keys(c.enemies),[key]);
  for(const row of Object.values(c.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+row.path,import.meta.url))).digest('hex'),row.sha256);
  const p=c.enemies[key];assert.notEqual(p.casts.attack.pathId,p.casts.combat.pathId);
  assert.deepEqual(p.casts.attack.alias,{animKey:'Attack_01',animName:'Attack',ignoreMissing:0,loop:0,speed:1});
  assert.deepEqual(p.casts.combat.alias,{animKey:'Attack_02',animName:'Combat',ignoreMissing:0,loop:0,speed:1});
  execFileSync(process.execPath,['tools/arkpedia/patrol-clock-contract.mjs','--check'],{stdio:'pipe'});
});
for(const mode of ['attack','combat'])test(mode+': releases at original 0.5s event and holds original one-second clip',()=>{
  const f=fixture(mode),hp=f.u.hp,events=[];f.b.on('attack',c=>{if(c.attacker===f.e)events.push(c);});const p=begin(f);
  f.h.run(.4);assert.equal(f.u.hp,hp);assert.equal(events.length,0);
  f.h.run(.15);assert.equal(events.length,1);assert.equal(events[0].patrolMode,mode);assert.equal(events[0].attackId,p.attackId);
  assert.equal(f.e.stats.attacks,1);assert.equal(f.a.ordinary.pending,p);assert.ok(f.e.findBuff('ch16:patrol-ordinary'));
  f.h.run(.3);assert.equal(f.a.ordinary.pending,p);f.h.run(.2);assert.equal(f.a.ordinary.pending,null);
  assert.equal(f.e.findBuff('ch16:patrol-ordinary'),null);assert.equal(hp-f.u.hp,f.e.s.atk);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['attack','combat'])for(const aspd of [-50,900])test(mode+': sampled rate at ASPD '+aspd+' respects native cap',()=>{
  const f=fixture(mode);f.b.addBuff(f.e,{key:'rate',persist:true,mods:{aspd}});const p=begin(f),rate=aspd<0?.5:1;
  assert.equal(p.rate,rate);f.h.run(.4/rate);assert.equal(p.released,false);f.h.run(.2/rate);assert.equal(p.released,true);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['attack','combat'])test(mode+': clip and both cooldowns consume live slowdown exactly once',()=>{
  const f=fixture(mode),p=begin(f);f.e.profile.attackCooldowns[mode==='attack'?'combat':'attack']=100;
  f.h.run(.1);const age=p.age,before={...f.e.profile.attackCooldowns},buff=slow(f);f.h.run(.4);
  assert.ok(Math.abs(p.age-age-.2)<=f.b.dt+1e-7);assert.equal(p.released,false);
  for(const k of ['attack','combat'])assert.ok(Math.abs(f.e.profile.attackCooldowns[k]-before[k]+.2)<=f.b.dt+1e-7,k);
  f.b.removeBuff(f.e,buff);f.h.run(.3);assert.equal(p.released,true);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['attack','combat'])for(const flag of ['stun','freeze','sleep','levitate','fear','disarm'])test(mode+': '+flag+' cancels unborn output',()=>{
  const f=fixture(mode),hp=f.u.hp;begin(f);f.h.run(.1);const buff=f.b.addBuff(f.e,{key:'control',persist:true,flags:{[flag]:true}});
  if(flag==='fear')f.b.step();f.b.removeBuff(f.e,buff);f.h.run(2);
  assert.equal(f.u.hp,hp);assert.equal(f.b.projectiles.list.length,0);assert.equal(f.a.ordinary.pending,null);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['attack','combat'])for(const invalid of ['death','reuse','removed','battleEnd'])test(mode+': source '+invalid+' retires the pending clip and hold',()=>{
  const f=fixture(mode),hp=f.u.hp;begin(f);f.h.run(.1);
  if(invalid==='death')f.b.kill(f.e,null);else if(invalid==='reuse')f.e.deploySeq++;
  else if(invalid==='removed'){f.e.deployed=false;f.b.emit('removed',{unit:f.e});}else f.b.emit('battleEnd',{});
  f.h.run(2);assert.equal(f.u.hp,hp);assert.equal(f.a.ordinary.pending,null);assert.equal(f.a.ordinary.begin([f.u]),false);
  assert.equal(f.e.findBuff('ch16:patrol-ordinary'),null);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['attack','combat'])for(const reuse of [false,true])test(mode+': accepted target '+(reuse?'reuse':'death')+' never transfers a hit',()=>{
  const f=fixture(mode);begin(f);f.h.run(.1);if(reuse)f.u.deploySeq++;else f.b.kill(f.u,null);
  const hp=f.u.hp;f.h.run(2);assert.equal(f.u.hp,hp);assert.equal(f.b.projectiles.list.length,0);assert.deepEqual(f.b.errors,[]);
});
test('born shot reads live same-life ATK and keeps world travel through source slowdown',()=>{
  const f=fixture(),hp=f.u.hp;begin(f);f.h.run(.51);assert.equal(f.b.projectiles.list.length,1);
  slow(f);f.b.addBuff(f.e,{key:'live-atk',persist:true,mods:{atkFlat:100}});f.h.run(.2);
  assert.equal(hp-f.u.hp,f.e.s.atk);assert.deepEqual(f.b.errors,[]);
});
for(const invalid of ['death','reuse','battleEnd','targetReuse'])test('born shot handles '+invalid+' without inherited damage or credit',()=>{
  const f=fixture(),hp=f.u.hp,atk=f.e.s.atk,stats=f.e.stats,damage=[];f.b.on('damaged',c=>damage.push(c));
  begin(f);f.h.run(.51);assert.equal(f.b.projectiles.list.length,1);
  if(invalid==='death')f.b.kill(f.e,null);
  else if(invalid==='reuse'){f.e.deploySeq++;f.e.stats={...stats};f.e.base.atk=99999;f.e.markDirty();}
  else if(invalid==='battleEnd')f.b.emit('battleEnd',{});else f.u.deploySeq++;
  f.h.run(2);assert.equal(hp-f.u.hp,['death','reuse'].includes(invalid)?atk:0);
  if(invalid==='reuse'){assert.notEqual(damage[0].source,f.e);assert.equal(damage[0].source.stats,stats);}
  assert.deepEqual(f.b.errors,[]);
});
test('explicit port retains its accepted input mode and target across a later block',()=>{
  const f=fixture(),events=[];f.b.on('attack',c=>{if(c.attacker===f.e)events.push(c);});const p=begin(f);f.h.run(.1);
  const blocker=f.h.unit('dummy');blocker.base.blockCnt=2;blocker.markDirty();f.e.x=blocker.x;assert.equal(f.b._checkBlock(f.e),true);
  f.h.run(.45);assert.equal(p.mode,'attack');assert.equal(events[0].patrolMode,'attack');assert.deepEqual(events[0].targets,[f.u]);
  assert.equal(f.e.stats.attacks,1);assert.deepEqual(f.b.errors,[]);
});
