// SPDX-License-Identifier: GPL-3.0-or-later
// Internal source-clock and output-life checks, never stage admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { lightArtillery } from '../server/sim/content/chapter16-artillery.js';
import { attach, installFeatureDispatch } from '../server/sim/content/enemies.js';
import { applySourceSlowDown, NATIVE_SLOW_DOWN_CONTRACT } from '../server/sim/content/arkpedia-slow-down.js';
const read = p => JSON.parse(readFileSync(new URL('../'+p, import.meta.url)));
const records = read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
const ids = ['enemy_10122_uacann', 'enemy_10122_uacann_2'];
function fixture(id = ids[0], second = false) {
  const h = makeBattle({ content:'generic', autoFinish:false, setup:installFeatureDispatch,
    defs:{ enemies:{ [id]:records[id].levels[0] }, chess:{ dummy:chessRec({ id:'dummy', stats:{maxHp:1e6,atk:0,def:0,blockCnt:0} }) } },
    units:[{chessId:'dummy',row:10,col:5}, ...(second ? [{chessId:'dummy',row:11,col:5}] : [])] });
  h.b.start(); const e = h.spawn(id,{pos:[10,7]}); e.base.moveSpeed=0; e.markDirty();
  const a=lightArtillery(records[id].levels[0]); attach(h.b,e,[a]); e.profile.noAttack=true;
  return {h,b:h.b,e,a,u:h.unit('dummy')};
}
function begin(f) { assert.equal(f.a.ordinary.begin([f.u]),true); return f.a.ordinary.pending; }
function slow(f) { return applySourceSlowDown(f.b,f.u,f.e,{key:'artillery-clock-test',increment:.5,maxStrength:.5,maxStacks:1,duration:30,contract:NATIVE_SLOW_DOWN_CONTRACT}); }

test('artillery clock contract reproduces native graph and original skeleton provenance',()=>{
  const c=read('data/candidates/arkpedia-ch16-artillery-clock-contract.json');
  assert.equal(c.testOnly,true); assert.equal(c.frameParity,false);
  assert.deepEqual(Object.keys(c.enemies).sort(),ids);
  for(const row of Object.values(c.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../'+row.path,import.meta.url))).digest('hex'),row.sha256);
  execFileSync(process.execPath,['tools/arkpedia/artillery-clock-contract.mjs','--check'],{stdio:'pipe'});
});

for(const id of ids) test(id+': original release marker, clip hold and shared ordinary cooldown',()=>{
  const f=fixture(id), events=[]; f.b.on('attack',c=>{if(c.attacker===f.e)events.push(c);});
  const p=begin(f); assert.equal(p.rate,1); assert.equal(f.e.profile.attackCooldowns,undefined);
  assert.equal(f.e.stats.attacks,1); f.h.run(.4); assert.equal(f.b.projectiles.list.length,0);
  f.h.run(.1); assert.equal(f.b.projectiles.list.length,1); assert.equal(events.length,1);
  assert.equal(events[0].attackId,p.attackId); assert.equal(f.a.ordinary.pending,p);
  f.h.run(.6); assert.equal(f.a.ordinary.pending,p); f.h.run(.2); assert.equal(f.a.ordinary.pending,null);
  assert.equal(f.e.findBuff('ch16:artillery-ordinary'),null); assert.equal(events.length,1); assert.deepEqual(f.b.errors,[]);
});
for(const id of ids) for(const aspd of [-50,900]) test(id+': sampled playback rate at ASPD '+aspd,()=>{
  const f=fixture(id); f.b.addBuff(f.e,{key:'rate',persist:true,mods:{aspd}});
  const p=begin(f), rate=aspd<0?.5:1; assert.equal(p.rate,rate);
  f.h.run(.4/rate); assert.equal(p.released,false); f.h.run(.12/rate); assert.equal(p.released,true);
  assert.deepEqual(f.b.errors,[]);
});
for(const id of ids) test(id+': clip and cooldown consume live slowdown once; projectile remains a world clock',()=>{
  const f=fixture(id), p=begin(f); f.h.run(.1); const age=p.age, cd=f.e.atkCd;
  const buff=slow(f); f.h.run(.4); assert.ok(Math.abs(p.age-age-.2)<=f.b.dt+1e-7);
  assert.ok(Math.abs(f.e.atkCd-cd+.2)<=f.b.dt+1e-7); assert.equal(p.released,false);
  f.b.removeBuff(f.e,buff); f.h.run(.2); assert.equal(p.released,true);
  slow(f); const hp=f.u.hp; f.h.run(.6); assert.equal(hp-f.u.hp,f.e.s.atk); assert.deepEqual(f.b.errors,[]);
});
for(const flag of ['stun','freeze','sleep','levitate','fear','disarm']) test('unborn artillery is cancelled by '+flag,()=>{
  const f=fixture(); begin(f); f.h.run(.1);
  const buff=f.b.addBuff(f.e,{key:'control',persist:true,flags:{[flag]:true}});
  if(flag==='fear')f.b.step(); f.b.removeBuff(f.e,buff); f.h.run(2);
  assert.equal(f.b.projectiles.list.length,0); assert.equal(f.a.ordinary.pending,null); assert.deepEqual(f.b.errors,[]);
});
for(const invalid of ['death','reuse','removed','battleEnd']) test('unborn artillery ends at source '+invalid,()=>{
  const f=fixture(); begin(f); f.h.run(.1);
  if(invalid==='death')f.b.kill(f.e,null);
  else if(invalid==='reuse')f.e.deploySeq++;
  else if(invalid==='removed'){f.e.deployed=false;f.b.emit('removed',{unit:f.e});}
  else f.b.emit('battleEnd',{});
  f.h.run(2); assert.equal(f.b.projectiles.list.length,0); assert.equal(f.a.ordinary.pending,null);
  assert.equal(f.a.ordinary.begin([f.u]),false); assert.deepEqual(f.b.errors,[]);
});
for(const reuse of [false,true]) test('input target '+(reuse?'redeployment':'death')+' never transfers a release',()=>{
  const f=fixture(); begin(f); f.h.run(.1); if(reuse)f.u.deploySeq++;else f.b.kill(f.u,null);
  f.h.run(2); assert.equal(f.b.projectiles.list.length,0); assert.deepEqual(f.b.errors,[]);
});
test('born shell survives source death but not battle end and never uses replacement source stats or credit',()=>{
  for(const invalid of ['death','reuse','battleEnd']){
    const f=fixture(), hp=f.u.hp, atk=f.e.s.atk, damage=[];
    f.b.on('damaged',c=>damage.push(c)); begin(f); f.h.run(.5); assert.equal(f.b.projectiles.list.length,1);
    const oldStats=f.e.stats;
    if(invalid==='death')f.b.kill(f.e,null);
    else if(invalid==='reuse'){f.e.deploySeq++; f.e.stats={...f.e.stats}; f.e.base.atk=99999;f.e.markDirty();}
    else f.b.emit('battleEnd',{});
    f.h.run(4); assert.equal(hp-f.u.hp,invalid==='battleEnd'?0:atk);
    if(invalid==='reuse'){assert.notEqual(damage[0].source,f.e);assert.equal(damage[0].source.stats,oldStats);}
    assert.equal(f.u.buffs.filter(x=>x.key.startsWith('ch16:burn:')).length,0); assert.deepEqual(f.b.errors,[]);
  }
});
test('burning fields retain original source credit across replacement and stop at battle end',()=>{
  const f=fixture(), oldStats=f.e.stats, damage=[]; f.b.on('damaged',c=>damage.push(c));
  f.b.chapter16Artillery.add(f.e,f.u.x,f.u.y,3,100); f.e.deploySeq++; f.e.stats={...f.e.stats};
  const hp=f.u.hp;f.h.run(1.1);assert.equal(hp-f.u.hp,100);
  assert.notEqual(damage[0].source,f.e); assert.equal(damage[0].source.stats,oldStats);
  f.b.emit('battleEnd',{}); f.h.run(3); assert.equal(hp-f.u.hp,100); assert.deepEqual(f.b.errors,[]);
});
test('area callbacks cannot donate a later victim or source life to an existing shell',()=>{
  const f=fixture(ids[0],true), units=[...f.b.allyUnits], hp=units.map(u=>u.hp), atk=f.e.s.atk;
  begin(f); f.h.run(.5);
  f.b.on('damaged',c=>{if(c.target===units[0]){units[1].deploySeq++;f.e.deploySeq++;f.e.base.atk=99999;f.e.markDirty();}});
  f.h.run(1); assert.equal(hp[0]-units[0].hp,atk);assert.equal(units[1].hp,hp[1]);assert.deepEqual(f.b.errors,[]);
});

test('a replacement recipient gets a fresh burn clock and no inherited receipt',()=>{
  const f=fixture(); f.b.chapter16Artillery.add(f.e,f.u.x,f.u.y,3,100);
  const old=f.u.buffs.find(x=>x.key.startsWith('ch16:burn:')), hp=f.u.hp;
  f.h.run(.5); f.u.deploySeq++; f.h.run(.6);
  assert.equal(f.u.buffs.includes(old),false); assert.equal(hp-f.u.hp,0);
  assert.equal(f.u.buffs.filter(x=>x.key.startsWith('ch16:burn:')).length,1);
  f.h.run(.5); assert.equal(hp-f.u.hp,100);f.b.emit('battleEnd',{});
  assert.equal(f.u.buffs.filter(x=>x.key.startsWith('ch16:burn:')).length,0);assert.deepEqual(f.b.errors,[]);
});
