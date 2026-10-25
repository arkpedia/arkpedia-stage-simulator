// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {chapter17AttackClock,CHAPTER17_ATTACK_CLOCK_BINDINGS as bindings} from '../server/sim/content/chapter17-attack-clocks.js';
import {applySourceSlowDown,NATIVE_SLOW_DOWN_CONTRACT} from '../server/sim/content/arkpedia-slow-down.js';
const read=p=>JSON.parse(readFileSync(new URL('../data/'+p,import.meta.url)));
const records=read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const contract=read('candidates/arkpedia-ch17-attack-clock-contract.json'),packets=contract.enemies;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function fixture(id){
 const h=makeBattle({content:'none',autoFinish:false,setup:installEnemyFeatures,defs:{enemies:{[id]:records[id].levels[0]}}});
 h.b.start();const e=h.spawn(id,{pos:[10,7]});e.route={legs:[{t:'wait',time:100}],legIdx:0,waitLeft:100};
 return{h,b:h.b,e};
}
const slow=f=>applySourceSlowDown(f.b,{id:'fixture:closur'},f.e,{key:'combat-clock',increment:.5,maxStrength:.5,maxStacks:1,duration:30,contract:NATIVE_SLOW_DOWN_CONTRACT});

test('the compact clock contract reproduces from the pinned graphs and exact canonical record levels',()=>{
 for(const r of Object.values(contract.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+r.path,import.meta.url))).digest('hex'),r.sha256);
 execFileSync(process.execPath,['tools/arkpedia/ch17-attack-clock-contract.mjs','--check'],{stdio:'pipe'});
 assert.deepEqual(Object.keys(packets),['enemy_10201_muinf','enemy_10201_muinf_2','enemy_10203_mumag','enemy_10203_mumag_2','enemy_10208_mucow','enemy_10208_mucow_2']);
 for(const id of Object.keys(packets))for(const r of Object.values(records[id].levels))assert.deepEqual(chapter17AttackClock(r),{affectedBySlowDown:true});
});

test('each selected Combat reference resolves to the exact retained native Attack component',()=>{
 const infantry=read('candidates/arkpedia-ch17-infantry-bow-source.json'),carrier=read('candidates/arkpedia-ch17-channel-carrier-source.json');
 for(const [id,pathId]of Object.entries(bindings)){
  const graph=(id.includes('muinf')?infantry:carrier).prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];
  const row=graph.find(c=>c.pathId===pathId);assert.ok(row);assert.equal(createHash('sha256').update(row.originalJson).digest('hex'),row.sha256);
  assert.ok(packets[id].native.includes(row.originalJson));const attack=JSON.parse(row.originalJson);
  assert.equal(attack._animKey,'Attack');assert.equal(attack._affectedBySlowDown,1);
  assert.deepEqual(chapter17AttackClock(records[id].levels[0]),{affectedBySlowDown:true});
 }
});

for(const id of Object.keys(bindings))test(`${id} receives its source clock on real feature dispatch and consumes changing eligible elapsed time`,()=>{
 const f=fixture(id);assert.equal(f.e.profile.attackCooldownAffectedBySlowDown,true);f.e.atkCd=4;
 const buff=slow(f);assert.ok(buff);near(f.e.s.slowDownRate,.5);f.h.run(.4);near(f.e.atkCd,3.8);
 f.b.removeBuff(f.e,buff);f.h.run(.4);near(f.e.atkCd,3.4);
 f.b.applyStatus(f.e,'stun',{duration:1});f.h.run(.4);near(f.e.atkCd,3.4);
 assert.deepEqual(f.b.errors,[]);
});

test('an unbound enemy does not acquire a native clock merely because it has a slowdown buff',()=>{
 const f=fixture('enemy_1007_slime');assert.equal(chapter17AttackClock(records.enemy_1007_slime.levels[0]),null);
 assert.equal(f.e.profile.attackCooldownAffectedBySlowDown,undefined);f.e.atkCd=4;slow(f);f.h.run(.4);near(f.e.atkCd,3.6);assert.deepEqual(f.b.errors,[]);
});

test('a real blocked infantry attack waits for its slowed remaining Combat cooldown',()=>{
 const id='enemy_10201_muinf_2',sink=chessRec({id:'sink',stats:{maxHp:1e8,atk:0,def:0}});
 const h=makeBattle({content:'none',autoFinish:false,setup:installEnemyFeatures,defs:{enemies:{[id]:records[id].levels[0]},chess:{sink}},units:[{chessId:'sink',row:10,col:7}]});
 h.b.start();const e=h.spawn(id,{pos:[10,7]}),f={h,b:h.b,e};
 h.runUntil(()=>e.stats.attacks===1,2);assert.ok(e.blockedBy);const remaining=e.atkCd;assert.ok(remaining>1);
 slow(f);h.run(remaining*2-.1);assert.equal(e.stats.attacks,1);h.run(.15);assert.equal(e.stats.attacks,2);assert.deepEqual(h.b.errors,[]);
});

test('the separate unmarked ChargeRift cooldown stays on world time while Combat slows',()=>{
 const f=fixture('enemy_10203_mumag_2'),channel=f.e.mem.ab.list.find(a=>Object.hasOwn(a,'left'));
 assert.ok(channel);const native=read('candidates/arkpedia-ch17-reviewed-channel-carrier.json').enemies.enemy_10203_mumag_2.native.map(JSON.parse);
 assert.ok(native.some(c=>c._affectedBySlowDown===0&&c._cooldown===.4000000059604645));
 channel.left=3;f.e.atkCd=4;slow(f);f.h.run(.4);near(channel.left,2.6);near(f.e.atkCd,3.8);assert.deepEqual(f.b.errors,[]);
});

test('record and native clock mutations cannot silently change a selected binding',()=>{
 const id='enemy_10203_mumag_2',r=records[id].levels[0];
 for(const mutate of [p=>{const i=p.native.findIndex(s=>JSON.parse(s)._animKey==='Attack'),n=JSON.parse(p.native[i]);n._affectedBySlowDown=0;p.native[i]=JSON.stringify(n);},
  p=>{const i=p.native.findIndex(s=>JSON.parse(s)._combat),n=JSON.parse(p.native[i]);n._combat.m_PathID='other';p.native[i]=JSON.stringify(n);},
  p=>p.native.push(p.native.find(s=>JSON.parse(s)._animKey==='Attack'))]){
  const p=structuredClone(packets[id]);mutate(p);assert.throws(()=>chapter17AttackClock(r,p),/Unreviewed.*binding/);
 }
 const changed=structuredClone(r);changed.skills[0].cooldown++;assert.throws(()=>chapter17AttackClock(changed),/Unreviewed.*record/);
 assert.equal(chapter17AttackClock(records.enemy_10202_mubow_2.levels[0]),null,'unreviewed multiple-mode bow remains separate');
});
