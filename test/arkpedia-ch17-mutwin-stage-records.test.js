// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {installChapter17MutwinCore as install} from '../server/sim/content/chapter17-mutwin-core.js';
import {chapter17StagedTwinRecord as record} from '../server/sim/content/chapter17-mutwin-stage-records.js';
import {reviewStagedTwinRecords,mutwinStageRecordContract} from '../tools/arkpedia/mutwin-stage-record-contract.mjs';
const bytes=p=>readFileSync(new URL('../'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const contract=read('data/candidates/arkpedia-ch17-mutwin-stage-record-contract.json'),foundation=read('data/candidates/arkpedia-ch17-mutwin-lifecycle-contract.json'),source=read('data/candidates/arkpedia-stage-17-18-source.json'),keys=Object.keys(contract.enemies);
const canonical=read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
function fixture({records=Object.fromEntries(keys.map(k=>[k,record('17-18',k)]))}={}){
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:1e6,rect:{r0:0,r1:16,c0:0,c1:10},defs:{enemies:records,chess:{stage_op:chessRec({id:'stage_op',stats:{maxHp:50000,blockCnt:0}})}},units:[{chessId:'stage_op',row:10,col:2}]});
 h.b.start();h.allies()[0].profile.noAttack=true;
 const twins=keys.map((key,i)=>{const raw=source.rawLevel.routes[19+i],pair=p=>[p.row,p.col];return h.spawn(key,{pos:pair(raw.startPosition),route:{motion:'WALK',start:pair(raw.startPosition),end:pair(raw.endPosition),checkpoints:raw.checkpoints.map(cp=>({type:'MOVE',pos:pair(cp.position)}))}});});
 return {h,b:h.b,twins,rooms:[],cores:[]};
}
function compose(f){for(const e of f.twins)f.cores.push(install(f.b,e,{stage:'17-18',finishRoom:r=>f.rooms.push(r)}));return f;}
test('staged twin receipt binds retained sources and changes only the exact canonical room string',()=>{
 for(const s of Object.values(contract.sources))assert.equal(createHash('sha256').update(bytes(s.path)).digest('hex'),s.sha256);
 assert.deepEqual(reviewStagedTwinRecords(source.rawLevel,foundation,canonical),contract.enemies);
 for(const key of keys){const expected=structuredClone(canonical[key].levels[0]);expected.talents.bbStr['DamageResistance.boss_room']='(0,10,0)';assert.deepEqual(record('17-18',key),expected);assert.ok(Object.isFrozen(record('17-18',key).talents.bbStr));}
 assert.throws(()=>record('17-17',keys[0]),/Unreviewed/);assert.throws(()=>record('17-18','enemy_1590_muama'),/Unreviewed/);
});
test('staged core requires explicit stage selection and rejects record changes before installing actors',()=>{
 const f=fixture();assert.throws(()=>install(f.b,f.twins[0],{finishRoom:()=>{}}),/Unreviewed/);
 for(const change of [r=>r.talents.bbStr['DamageResistance.boss_room']='(0,11,0)',r=>r.stats.atk++,r=>r.talents.bb['Reborn.duration']=1,r=>r.skills[0].cooldown++,r=>r.abilities=[],r=>r.notCountInTotal=true]){
  const records=Object.fromEntries(keys.map(k=>[k,structuredClone(record('17-18',k))]));change(records[keys[0]]);const g=fixture({records});
  assert.throws(()=>install(g.b,g.twins[0],{stage:'17-18',finishRoom:()=>{}}),/Unreviewed/);assert.equal(g.twins[0].mem.ch17MuamaCombat,undefined);
 }
 assert.throws(()=>install(f.b,f.twins[0],{stage:'17-17',finishRoom:()=>{}}),/Unreviewed/);assert.deepEqual(f.b.errors,[]);
});
test('paired staged twins retain rebirth and recovery and emit the staged first-room action exactly once',()=>{
 const f=compose(fixture()),[a,b]=f.twins,[ca,cb]=f.cores;
 f.b.loseHp(a,1e6,{source:f.h.allies()[0]});f.h.runUntil(()=>ca.lifecycle.phase==='fake',1);assert.equal(a.hp,1000);assert.ok(a.findBuff('ally_alive'));assert.equal(f.rooms.length,0);
 f.h.runUntil(()=>ca.lifecycle.phase==='active',26);assert.equal(a.hp,50000);assert.ok(cb.lifecycle.valid());
 f.b.kill(a,null);assert.equal(f.rooms.length,1);assert.equal(f.rooms[0].room,'(0,10,0)');assert.equal(f.rooms[0].source,a);assert.deepEqual(f.rooms[0].actions,foundation.roomFinish);
 f.b.kill(b,null);assert.equal(f.rooms.length,1);ca.stop();cb.stop();assert.equal(f.rooms.length,1);assert.deepEqual(f.b.errors,[]);
});
test('staged Blink advances the actual stage route checkpoint and preserves the staged room receipt',()=>{
 const f=compose(fixture()),e=f.twins[0],core=f.cores[0];f.h.allies()[0].hidden=true;
 const expected=source.rawLevel.routes[19].checkpoints[0].position;core.actions.blink.cooldown=0;assert.equal(core.actions.blink.cast(),true);f.h.run(3.6);
 assert.deepEqual([e.y,e.x],[expected.row,expected.col]);assert.equal(e.route.legIdx,1);assert.ok(core.actions.combat.wall.sides.every(s=>!s.broken));
 // A later caller mutation cannot rewrite the already admitted room action.
 e.def={...e.def,raw:structuredClone(e.def.raw)};e.def.raw.talents.bbStr['DamageResistance.boss_room']='(0,99,0)';f.b.kill(e,null);
 assert.equal(f.rooms[0].room,'(0,10,0)');assert.deepEqual(f.b.errors,[]);
});
test('staged twin reference review fails closed on active numeric, skill, identity and blackboard overrides',()=>{
 const changeRef=(s)=>s.enemyDbRefs.find(r=>r.id===keys[0]);
 for(const change of [r=>r.useDb=false,r=>r.level=1,r=>r.overwrittenData.attributes.atk.m_defined=true,r=>r.overwrittenData.skills=[],r=>r.overwrittenData.talentBlackboard.pop(),r=>r.overwrittenData.talentBlackboard.find(x=>x.key==='DamageResistance.boss_room').valueStr='(0,9,0)',r=>r.overwrittenData.talentBlackboard.find(x=>x.key==='Reborn.duration').value=2]){
  const s=structuredClone(source.rawLevel);change(changeRef(s));assert.throws(()=>reviewStagedTwinRecords(s,foundation,canonical),/Unreviewed/);
 }
 const s=structuredClone(source.rawLevel);s.enemyDbRefs.push(structuredClone(changeRef(s)));assert.throws(()=>reviewStagedTwinRecords(s,foundation,canonical),/Unreviewed/);
});
test('staged source regeneration rejects corrupt canonical bytes and inconsistent provenance',async()=>{
 await assert.rejects(mutwinStageRecordContract({fetchImpl:async()=>({ok:true,arrayBuffer:async()=>Buffer.from('{}')})}),/checksum/);
 await assert.rejects(mutwinStageRecordContract({read:async url=>{const b=readFileSync(url);if(!url.pathname.endsWith('/arkpedia-stage-17-18-source.json'))return b;const s=JSON.parse(b);s.canonicalData.commit='0'.repeat(40);return Buffer.from(JSON.stringify(s));},fetchImpl:async()=>{throw Error('Must not fetch');}}),/provenance/);
});
test('staged record review grants no enemy policy or stage admission and missing room receivers roll back composition',()=>{
 const f=fixture();assert.throws(()=>install(f.b,f.twins[0],{stage:'17-18'}),/receiver/);
 assert.equal(f.twins[0].mem.ch17MuamaActions,undefined);assert.equal(f.twins[0].mem.ch17MuamaCombat,undefined);
 const support=read('data/candidates/arkpedia-ch16-enemy-support.json');for(const key of keys){assert.equal(support.enemies[key].policy,null);assert.equal(canonical[key].levels[0].talents.bbStr['DamageResistance.boss_room'],'(0,6,0)');}
 assert.equal(read('data/arkpedia-stages.json').stages.some(s=>s.code==='17-18'),false);assert.deepEqual(f.b.errors,[]);
});
