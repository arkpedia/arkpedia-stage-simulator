// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {makeBattle} from './helpers/battleHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {currentEnemyInstantKillReceipt} from '../server/sim/enemy-instant-kill.js';
import {verifyBagFeedingSource} from '../server/sim/content/chapter17-bag-feeding-source.js';
const read=p=>JSON.parse(readFileSync(new URL('../data/'+p,import.meta.url)));
const contract=read('candidates/arkpedia-ch17-bag-feeding-contract.json'),records=read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const MURAD='enemy_10211_murad',keys=Object.keys(contract.enemies);
function fixture(key=keys[0]){
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:180,setup:installEnemyFeatures,
  defs:{enemies:{[key]:records[key].levels[0],[MURAD]:records[MURAD].levels[0]}}});h.b.start();
 const b=h.b,e=h.spawn(key,{pos:[10,7]}),target=h.spawn(MURAD,{pos:[10,7]}),a=e.mem.ab.list.find(a=>a.contacts),consumed=[];
 b.on('ch17BagConsumed',c=>consumed.push(c));h.runUntil(()=>!!a.phase,1);return{h,b,e,target,a,p:a.phase,consumed};
}
const age=(f,time)=>f.h.run(Math.max(0,time-(f.b.time-f.p.startedAt)));

test('feeding source contract reproduces from every pinned original and retains literal non-skipping native kill fields',()=>{
 for(const p of Object.values(contract.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+p.path,import.meta.url))).digest('hex'),p.sha256);
 execFileSync(process.execPath,['tools/arkpedia/bag-feeding-contract.mjs','--check'],{stdio:'pipe'});
 for(const key of keys){const c=verifyBagFeedingSource(key);assert.equal(c.killAction._targetType,'BUFF_OWNER');assert.equal(c.killAction._skipReborn,false);
  assert.equal(c.killAction._noSource,false);assert.equal(c.feedingDuration,10.5);assert.equal(c.phaseDuration,11);assert.equal(c.skillAffectedBySlowDown,false);assert.equal(c.feedingSourceStatusResistable,false);}
});

for(const key of keys)test(key+' consumes through the authenticated native action with Bag kill credit and no damage packet',()=>{
 const f=fixture(key),seen=[];let killCredit=null,packets=0;
 f.b.on('enemyInstantKill',ctx=>{const r=currentEnemyInstantKillReceipt(ctx,f.b);seen.push({ctx,r});});
 f.b.on('kill',c=>{if(c.victim===f.target)killCredit=c.killer;});f.b.on('damaged',c=>{if(c.target===f.target)packets++;});
 f.b.addBuff(f.target,{key:'fixture:protected',flags:{invulnerable:true,undeadable:true},shield:1e6});age(f,10.4);assert.equal(seen.length,0);age(f,10.6);
 assert.equal(seen.length,1);const{ctx,r}=seen[0];assert.equal(r.unit,f.target);assert.equal(r.unitLife,f.target.deploySeq);assert.equal(r.source,f.e);assert.equal(r.owner,f.e);
 assert.equal(r.action._targetType,'BUFF_OWNER');assert.equal(r.action._skipReborn,false);assert.equal(currentEnemyInstantKillReceipt(ctx,f.b),null);
 assert.equal(f.target.alive,false);assert.equal(killCredit,f.e);assert.equal(packets,0);assert.equal(f.consumed.length,1);assert.deepEqual(f.b.errors,[]);
});

test('native rebirth admission prevents consumption rather than being bypassed by the Bag',()=>{
 const f=fixture();let requested=0;f.b.on('enemyInstantKill',ctx=>{if(ctx.unit===f.target){requested++;assert.ok(currentEnemyInstantKillReceipt(ctx,f.b));ctx.reborn=true;ctx.unit.hp=1234;}});
 age(f,10.6);assert.equal(requested,1);assert.equal(f.target.alive,true);assert.equal(f.target.hp,1234);assert.equal(f.consumed.length,0);
 age(f,11.2);assert.equal(f.a.phase,null);assert.equal(f.e.findBuff('enemy_mubag_atk_up'),null);assert.deepEqual(f.b.errors,[]);
});

test('a target life replaced during native admission is not killed or reported consumed through the old parent',()=>{
 const f=fixture();let oldLife;
 f.b.on('enemyInstantKill',ctx=>{if(ctx.unit===f.target){oldLife=currentEnemyInstantKillReceipt(ctx,f.b).unitLife;ctx.unit.deploySeq++;ctx.unit.hp=4321;}});
 age(f,10.6);assert.equal(f.target.deploySeq,oldLife+1);assert.equal(f.target.alive,true);assert.equal(f.target.hp,4321);assert.equal(f.consumed.length,0);assert.deepEqual(f.b.errors,[]);
});

test('battle completion during native admission restores pending HP and clears the feeding owner without a late consume',()=>{
 const f=fixture(),hp=f.target.hp;f.b.on('enemyInstantKill',()=>f.b._finish('cleared'));age(f,10.6);
 assert.equal(f.b.finished,true);assert.equal(f.target.alive,true);assert.equal(f.target.hp,hp);assert.equal(f.a.active,false);
 assert.equal(f.e.findBuff('enemy_mubag_atk_up'),null);assert.equal(f.consumed.length,0);assert.deepEqual(f.b.errors,[]);
});

test('clock, recipient, source-credit, rebirth and nonstatus parent mutations fail closed',()=>{
 for(const mutate of [c=>c.consume[1]._skipReborn=true,c=>c.consume[1]._noSource=true,c=>c.consume[1]._targetType='TARGET',
  c=>c.eventNames.trigger='ON_OWNER_KILLED',c=>c.enemies[keys[0]].feeding.attributes.abnormalFlags.push(2),
  c=>{const r=c.enemies[keys[0]],s=JSON.parse(r.skillOriginalJson);s._affectedBySlowDown=1;r.skillOriginalJson=JSON.stringify(s);},
  c=>c.finishTrigger[0]._triggerAllBuffs=true]){
  const c=structuredClone(contract);mutate(c);assert.throws(()=>verifyBagFeedingSource(keys[0],c),/Unreviewed/);
 }
});
