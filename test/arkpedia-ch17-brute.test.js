// SPDX-License-Identifier: GPL-3.0-or-later
// Direct native-event candidate. Runtime/support admission is a separate gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pollutionBrute} from '../server/sim/content/chapter17-brute.js';
import {pollute} from '../server/sim/content/chapter17.js';
import {attach,installFeatureDispatch} from '../server/sim/content/enemies.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {verifiedNative,verifiedChapter16FamilyGraph} from '../tools/arkpedia/enemy-support.mjs';
import {parseSkel} from '../tools/assets/skel.mjs';
const bytes=p=>readFileSync(new URL('../data/'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const records=read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const review=read('candidates/arkpedia-ch17-reviewed-brute.json');
const keys=Object.keys(review.enemies);
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(key=keys[0]) {
  const h=makeBattle({content:'generic',autoFinish:false,setup:installFeatureDispatch,
    defs:{enemies:{[key]:records[key].levels[0]},chess:{dummy:chessRec({id:'dummy',stats:{maxHp:1e6,atk:0,def:0,blockCnt:1}})}},
    units:[{chessId:'dummy',row:10,col:7}]});
  h.b.start();
  const e=h.spawn(key,{pos:[10,7]}),a=pollutionBrute(records[key].levels[0]);attach(h.b,e,[a]);
  e.base.moveSpeed=0;e.markDirty();
  const hits=[];h.b.on('ch17BruteHit',c=>hits.push({...c,time:h.b.time}));
  return{h,b:h.b,e,a,u:h.unit('dummy'),hits};
}
function begin(f,enhanced=false) {
  if(enhanced)pollute(f.b,f.e);
  assert.equal(f.h.runUntil(()=>!!f.a.pending,1),true);
  return f.a.pending;
}
test('Brute exact source closure, indexed claims and original three-event clock bindings verify',()=>{
  for(const p of Object.values(review.sources))assert.equal(hash(readFileSync(new URL('../'+p.path,import.meta.url))),p.sha256);
  const index=read('arkpedia-enemy-clock-source.json');
  verifiedNative(read('candidates/arkpedia-ch17-brute-native.json'),index.prefabs,hash(bytes('arkpedia-enemy-clock-source.json')),read('arkpedia-mvp.json').behaviors.source);
  verifiedChapter16FamilyGraph(bytes('candidates/arkpedia-ch17-brute-source.json'),bytes('arkpedia-cn-native-source.json'),bytes('arkpedia-cn-enemy-native-source.json'),index);
  for(const row of Object.values(read('candidates/arkpedia-ch17-brute-animation-source.json').enemies)) {
    const raw=Buffer.from(row.base64,'base64');assert.equal(raw.length,row.bytes);assert.equal(hash(raw),row.sha256);
    assert.equal(hash(row.skeletonDataOriginalJson),row.skeletonDataSha256);
    assert.equal(row.prefabBinding.m_PathID,row.skeletonDataPathId);
    const skel=parseSkel(raw,undefined,{includeExactDurations:true,includeEventPayloads:true});
    assert.deepEqual(skel.eventPayloads.Skill.map(e=>e.time),review.defaults.enhancedHits);
    assert.equal(skel.exactDurations.Skill,review.defaults.enhancedDuration);
  }
});
for(const key of keys)test(key+' default melee waits for the real Attack event rather than dealing an immediate hit',()=>{
  const f=fixture(key),p=begin(f),hp=f.u.hp;
  f.h.run(.8);assert.equal(f.u.hp,hp);f.h.run(.05);
  assert.equal(hp-f.u.hp,f.e.s.atk);assert.equal(f.hits.length,1);
  assert.ok(Math.abs(f.hits[0].time-p.startedAt-review.defaults.normalHit)<=f.b.dt+1e-8);
  f.h.run(.8);assert.equal(f.a.pending,null);assert.equal(f.e.stats.attacks,1);assert.deepEqual(f.b.errors,[]);
});
for(const key of keys)test(key+' pollution arms exactly one three-hit cast at the three original Skill events',()=>{
  const f=fixture(key),p=begin(f,true),hp=f.u.hp;
  f.h.run(1.8);assert.equal(hp-f.u.hp,3*f.e.s.atk);assert.equal(f.hits.length,3);
  for(let i=0;i<3;i++)assert.ok(Math.abs(f.hits[i].time-p.startedAt-review.defaults.enhancedHits[i])<=f.b.dt+1e-8);
  assert.equal(new Set(f.hits.map(c=>c.attackId)).size,1);
  f.h.run(.5);assert.equal(f.a.mode,0);assert.equal(f.a.pending,null);
  assert.ok(f.a.cooldown>5.8&&f.a.cooldown<=6);assert.deepEqual(f.b.errors,[]);
});
test('repeated pollution while armed does not queue another charge or replace a born cast',()=>{
  const f=fixture(),p=begin(f,true);
  pollute(f.b,f.e);assert.equal(f.a.pending,p);f.h.run(.9);pollute(f.b,f.e);assert.equal(f.a.pending,p);
  f.h.run(1.4);assert.equal(f.a.mode,0);assert.equal(f.hits.length,3);
  const n=f.hits.length;f.h.run(5);assert.equal(f.hits.length,n);assert.deepEqual(f.b.errors,[]);
});
test('each remaining hit reads live ATK while retaining its original target deployment',()=>{
  const f=fixture();begin(f,true);const hp=f.u.hp,atk=f.e.s.atk;
  f.h.run(.9);assert.equal(hp-f.u.hp,atk);
  f.b.addBuff(f.e,{key:'fixture-atk-up',persist:true,mods:{atkPct:1}});f.h.run(.9);
  assert.equal(hp-f.u.hp,5*atk);assert.deepEqual(f.b.errors,[]);
});
test('removing the original target cannot transfer later hits to a replacement deployment',()=>{
  const f=fixture();begin(f,true);f.h.run(.9);assert.equal(f.hits.length,1);
  f.b.kill(f.u,null);const remaining=f.hits.length;f.h.run(1.4);
  assert.equal(f.hits.length,remaining);assert.equal(f.a.mode,0);assert.deepEqual(f.b.errors,[]);
});
for(const status of ['stun','freeze','sleep','levitate','disarm'])test('brief '+status+' cancels unborn hits and finishes the charged mode',()=>{
  const f=fixture();begin(f,true);
  const control=f.b.addBuff(f.e,{key:'fixture-control',persist:true,flags:{[status]:true}});
  f.b.removeBuff(f.e,control);f.h.run(2.4);
  assert.equal(f.hits.length,0);assert.equal(f.a.pending,null);assert.equal(f.a.mode,0);
  assert.equal(f.e.findBuff('ch17:brute-cast'),null);assert.deepEqual(f.b.errors,[]);
});
for(const event of ['death','battleEnd'])test(event+' cancels owned hits and removes the pollution hook and cast hold',()=>{
  const f=fixture();begin(f,true);
  if(event==='death')f.b.kill(f.e,null);else f.b.emit('battleEnd',{});
  f.h.run(3);assert.equal(f.hits.length,0);assert.equal(f.a.active,false);
  assert.equal(f.e.mem.ch17PollutionReaction,undefined);assert.equal(f.e.findBuff('ch17:brute-cast'),null);
  assert.deepEqual(f.b.errors,[]);
});
test('unfinished rate/FSM review cannot be bypassed by retaining source or manually exercising the candidate',()=>{
  const support=read('candidates/arkpedia-ch16-enemy-support.json');
  for(const key of keys)assert.equal(support.enemies[key].policy,null);
  for(const mutate of [r=>{r.abilities[0].text+=' changed';},r=>{r.prefabKey='enemy_10207_mubrut';}]) {
    const r=structuredClone(records[keys[1]].levels[0]);mutate(r);
    assert.throws(()=>pollutionBrute(r),/Unreviewed/);
  }
});
