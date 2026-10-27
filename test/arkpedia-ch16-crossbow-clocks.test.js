// SPDX-License-Identifier: GPL-3.0-or-later
// Source clocks/lives only; native mode handoff and frame parity remain held.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { mobileCrossbow } from '../server/sim/content/chapter16-crossbow.js';
import { attach, installFeatureDispatch } from '../server/sim/content/enemies.js';
import { applySourceSlowDown, NATIVE_SLOW_DOWN_CONTRACT } from '../server/sim/content/arkpedia-slow-down.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const records=read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
const ids=['enemy_10121_uasnip','enemy_10121_uasnip_2'];
function fixture(mode='attack',id=ids[0]){
  const h=makeBattle({content:'generic',autoFinish:false,setup:installFeatureDispatch,
    defs:{enemies:{[id]:records[id].levels[0]},chess:{dummy:chessRec({id:'dummy',stats:{maxHp:1e6,atk:0,def:0,blockCnt:mode==='combat'?2:0}})}},
    units:[{chessId:'dummy',row:10,col:5}]});
  h.b.start();const e=h.spawn(id,{pos:[10,mode==='combat'?5:7]});e.base.moveSpeed=0;e.markDirty();
  const a=mobileCrossbow(records[id].levels[0]);attach(h.b,e,[a]);e.profile.noAttack=true;h.run(.11);
  assert.equal(e.profile.attackMode(),mode);if(mode==='attack')assert.equal(a.ranged,true);
  return{h,b:h.b,e,a,u:h.unit('dummy'),mode};
}
function begin(f){assert.equal(f.a.ordinary.begin([f.u]),true);return f.a.ordinary.pending;}
function slow(f){return applySourceSlowDown(f.b,f.u,f.e,{key:'crossbow-clock-test',increment:.5,maxStrength:.5,maxStacks:1,duration:30,contract:NATIVE_SLOW_DOWN_CONTRACT});}
test('crossbow clock producer binds exact graph/index/JSON animation source hashes',()=>{
  const c=read('data/candidates/arkpedia-ch16-crossbow-clock-contract.json');
  assert.equal(c.testOnly,true);assert.equal(c.frameParity,false);assert.deepEqual(Object.keys(c.enemies).sort(),ids);
  for(const row of Object.values(c.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+row.path,import.meta.url))).digest('hex'),row.sha256);
  execFileSync(process.execPath,['tools/arkpedia/crossbow-clock-contract.mjs','--check'],{stdio:'pipe'});
  assert.throws(()=>mobileCrossbow({...records[ids[0]].levels[0],prefabKey:'other'}),/identity/);
});
for(const id of ids)for(const mode of ['attack','combat'])test(id+' '+mode+': release only at original marker and keep the accepted clip hold',()=>{
  const f=fixture(mode,id),events=[],hp=f.u.hp;f.b.on('attack',c=>{if(c.attacker===f.e)events.push(c);});const p=begin(f);
  const hit=mode==='attack'?.5:.53329998254776;f.h.run(hit-.1);assert.equal(events.length,0);assert.equal(f.u.hp,hp);
  f.h.run(.15);assert.equal(events.length,1);assert.equal(events[0].crossbowMode,mode);assert.equal(events[0].attackId,p.attackId);
  assert.equal(f.e.stats.attacks,1);assert.ok(f.e.findBuff('ch16:crossbow-ordinary'));assert.equal(p.mode,mode);
  f.h.run(.5);assert.equal(f.a.ordinary.pending,p);f.h.run(1);assert.equal(f.a.ordinary.pending,null);
  assert.equal(f.e.findBuff('ch16:crossbow-ordinary'),null);assert.equal(events.length,1);
  assert.equal(hp-f.u.hp,f.e.s.atk*(mode==='attack'?2.5:1));assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['attack','combat'])for(const aspd of [-50,900])test(mode+': sampled capped playback at ASPD '+aspd,()=>{
  const f=fixture(mode);f.b.addBuff(f.e,{key:'rate',persist:true,mods:{aspd}});
  const p=begin(f),rate=aspd<0?.5:1;assert.equal(p.rate,rate);
  f.h.run(.4/rate);assert.equal(p.released,false);f.h.run(.2/rate);assert.equal(p.released,true);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['attack','combat'])test(mode+': cast and independent cooldowns consume live slowdown exactly once',()=>{
  const f=fixture(mode),p=begin(f);f.e.profile.attackCooldowns[mode==='attack'?'combat':'attack']=100;
  f.h.run(.1);const age=p.age,before={...f.e.profile.attackCooldowns},buff=slow(f);f.h.run(.4);
  assert.ok(Math.abs(p.age-age-.2)<=f.b.dt+1e-7);assert.equal(p.released,false);
  for(const key of ['attack','combat'])assert.ok(Math.abs(f.e.profile.attackCooldowns[key]-before[key]+.2)<=f.b.dt+1e-7,key);
  f.b.removeBuff(f.e,buff);f.h.run(.3);assert.equal(p.released,true);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['attack','combat'])for(const flag of ['stun','freeze','sleep','levitate','fear','disarm'])test(mode+': '+flag+' cancels unborn output',()=>{
  const f=fixture(mode),hp=f.u.hp;begin(f);f.h.run(.1);const buff=f.b.addBuff(f.e,{key:'control',persist:true,flags:{[flag]:true}});
  if(flag==='fear')f.b.step();f.b.removeBuff(f.e,buff);f.h.run(2);
  assert.equal(f.u.hp,hp);assert.equal(f.b.projectiles.list.length,0);assert.equal(f.a.ordinary.pending,null);
  assert.equal(f.e.findBuff('ch16:crossbow-ordinary'),null);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['attack','combat'])for(const invalid of ['death','reuse','removed','battleEnd'])test(mode+': source '+invalid+' retires the accepted clip',()=>{
  const f=fixture(mode),hp=f.u.hp;begin(f);f.h.run(.1);
  if(invalid==='death')f.b.kill(f.e,null);else if(invalid==='reuse')f.e.deploySeq++;
  else if(invalid==='removed'){f.e.deployed=false;f.b.emit('removed',{unit:f.e});}else f.b.emit('battleEnd',{});
  f.h.run(2);assert.equal(f.u.hp,hp);assert.equal(f.a.ordinary.pending,null);assert.equal(f.a.ordinary.begin([f.u]),false);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['attack','combat'])for(const reuse of [false,true])test(mode+': captured target '+(reuse?'reuse':'death')+' cannot transfer a hit',()=>{
  const f=fixture(mode);begin(f);f.h.run(.1);if(reuse)f.u.deploySeq++;else f.b.kill(f.u,null);
  const hp=f.u.hp;f.h.run(2);assert.equal(f.u.hp,hp);assert.equal(f.b.projectiles.list.length,0);assert.deepEqual(f.b.errors,[]);
});
test('born ranged shots use live same-life ATK and world travel despite source slowdown',()=>{
  const f=fixture(),hp=f.u.hp;begin(f);f.h.run(.52);assert.equal(f.b.projectiles.list.length,1);
  slow(f);f.b.addBuff(f.e,{key:'live-attack',persist:true,mods:{atkFlat:100}});f.h.run(.25);
  assert.equal(hp-f.u.hp,f.e.s.atk*2.5);assert.deepEqual(f.b.errors,[]);
});
for(const invalid of ['death','reuse','battleEnd','targetReuse'])test('born ranged shot handles '+invalid+' without transferring damage/credit',()=>{
  const f=fixture(),hp=f.u.hp,atk=f.e.s.atk,oldStats=f.e.stats,damage=[];f.b.on('damaged',c=>damage.push(c));
  begin(f);f.h.run(.52);assert.equal(f.b.projectiles.list.length,1);
  if(invalid==='death')f.b.kill(f.e,null);
  else if(invalid==='reuse'){f.e.deploySeq++;f.e.stats={...oldStats};f.e.base.atk=99999;f.e.markDirty();}
  else if(invalid==='battleEnd')f.b.emit('battleEnd',{});else f.u.deploySeq++;
  f.h.run(2);assert.equal(hp-f.u.hp,['death','reuse'].includes(invalid)?atk*2.5:0);
  if(invalid==='reuse'){assert.notEqual(damage[0].source,f.e);assert.equal(damage[0].source.stats,oldStats);}
  assert.deepEqual(f.b.errors,[]);
});
test('accepted mode and input target are stable when nearby interference changes before release',()=>{
  const f=fixture(),events=[];f.b.on('attack',c=>{if(c.attacker===f.e)events.push(c);});const p=begin(f);f.h.run(.1);
  f.u.base.blockCnt=2;f.u.markDirty();f.e.x=f.u.x;assert.equal(f.b._checkBlock(f.e),true);
  f.h.run(.45);assert.equal(p.mode, 'attack');assert.equal(events[0].crossbowMode,'attack');
  assert.equal(f.b.projectiles.list[0]?.target??events[0].targets[0],f.u);assert.equal(f.e.stats.attacks,1);
  assert.deepEqual(f.b.errors,[]);
});
