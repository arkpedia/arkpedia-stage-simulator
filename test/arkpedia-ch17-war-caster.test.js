// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import {createHash}from'node:crypto';
import {makeBattle,chessRec}from'./helpers/battleHarness.js';
import {installEnemyFeatures}from'../server/sim/content/arkpedia-enemy-features.js';
import {pollute}from'../server/sim/content/chapter17.js';
import {strongWarCaster}from'../server/sim/content/chapter17-war-caster.js';
import {verifiedNative,verifiedChapter16FamilyGraph}from'../tools/arkpedia/enemy-support.mjs';
import {deriveEnemySupport,prefabPath}from'../shared/arkpedia/enemy-support.js';
import {parseSkel}from'../tools/assets/skel.mjs';
import {assertCandidatePredefines}from'../tools/arkpedia/candidate-predefines.mjs';
const bytes=p=>readFileSync(new URL('../data/'+p,import.meta.url)),read=p=>JSON.parse(bytes(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const records=read('candidates/arkpedia-enemy-records.canonical.json').enemies,review=read('candidates/arkpedia-ch17-reviewed-war-caster.json');
const key='enemy_10210_muwiz_2',normal='enemy_10210_muwiz';
function fixture(id=key,{units=1,atk=1000}={}){
 const chess=Object.fromEntries(Array.from({length:units},(_,i)=>['dummy'+i,chessRec({id:'dummy'+i,stats:{maxHp:1e6,atk,def:0,res:0,blockCnt:0}})]));
 const h=makeBattle({content:'generic',autoFinish:false,timeLimit:180,setup:installEnemyFeatures,
  defs:{enemies:{[key]:records[key].levels[0],[normal]:records[normal].levels[0]},chess},
  kits:Object.fromEntries(Object.keys(chess).map(k=>[k,()=>({trait:{noAttack:true},skill:{kind:'instant',trigger:'NEVER'}})])),
  units:Object.keys(chess).map((k,i)=>({chessId:k,row:10,col:8+i}))});
 h.b.start();const e=h.spawn(id,{pos:[10,6]}),a=e.mem.ab.list[0];e.base.moveSpeed=0;e.profile.noAttack=true;e.atkCd=1e6;e.markDirty();
 const leaves=[];h.b.on('ch17WarCasterLeave',c=>leaves.push(c));return{h,b:h.b,e,a,u:h.unit('dummy0'),v:h.unit('dummy1'),leaves};
}
function begin(f){f.a.left=0;f.h.run(.1);assert.equal(f.a.target,f.u);}
const normalize=n=>Array.isArray(n)?n.map(normalize):n&&typeof n==='object'?Object.fromEntries(Object.entries(n).map(([k,v])=>[k,k==='$type'?v.split(',')[0]:normalize(v)])):n;
test('stronger source binds complete graphs, indexed claims, original clocks and independently corroborated callback aliases',()=>{
 for(const p of Object.values(review.sources))assert.equal(sha(readFileSync(new URL('../'+p.path,import.meta.url))),p.sha256);
 const index=read('arkpedia-enemy-clock-source.json'),native=read('candidates/arkpedia-ch17-war-caster-native.json');
 verifiedNative(native,index.prefabs,sha(bytes('arkpedia-enemy-clock-source.json')),read('arkpedia-mvp.json').behaviors.source);
 verifiedChapter16FamilyGraph(bytes('candidates/arkpedia-ch17-war-caster-source.json'),bytes('arkpedia-cn-native-source.json'),bytes('arkpedia-cn-enemy-native-source.json'),index);
 const events=read('candidates/arkpedia-war-caster-event-alias-source.json');
 for(const[n,name]of [[10,'ON_TAKE_DAMAGE'],[61,'ON_BEFORE_TARGET_APPLY_MODIFIER']]){
  const e=events.events[n];assert.equal(e.name,name);assert.ok(e.matchingTemplates>=3);assert.equal(new Set(e.witnesses.map(w=>w.template)).size,3);
  for(const w of e.witnesses)assert.deepEqual(normalize(JSON.parse(w.nativeActionsJson)),normalize(w.namedActions));
 }
 const clocks=read('candidates/arkpedia-ch17-war-caster-animation-source.json');assert.equal(clocks.source.graph.sha256,review.sources.graph.sha256);
 for(const row of Object.values(clocks.enemies)){const raw=Buffer.from(row.base64,'base64');assert.equal(sha(raw),row.sha256);assert.ok(parseSkel(raw).animations.includes('Leave'));}
 const g=read('candidates/arkpedia-ch17-war-caster-source.json'),leave=JSON.parse(g.templates.enemy_muwiz_s_leave.originalJson);
 const actions=JSON.parse(leave.eventToActions._items.find(e=>e.key===0).value.SerializedState);assert.deepEqual(actions[0]._replaceAnimPairs,[{fromAnimKey:'Die',toAnimKey:'Leave'}]);assert.ok(actions[2].$type.endsWith('+InstantKill'));assert.equal(actions[2]._markReachExit,false);
 const parts=g.prefabs[prefabPath(key)].map(r=>JSON.parse(r.originalJson));assert.ok(parts.some(n=>n._maxTriggerTime===1&&n._ignoreSilence===1&&n._immuneStunWhenAffecting===1));
});
test('Leave retires one counted zero-LP body at120 seconds without using the Leave clip as a kill delay',()=>{
 const f=fixture(),life=f.b.life;f.h.run(119.9);assert.ok(f.e.alive);f.h.run(.2);
 assert.equal(f.e.alive,false);assert.equal(f.e.lpr,0);assert.equal(f.b.life,life);assert.equal(f.leaves.length,1);assert.ok(Math.abs(f.leaves[0].age-120)<=f.b.dt);
 assert.equal(f.e.mem.ch17WarCasterLeave,true);assert.equal(f.a.active,false);f.h.run(4);assert.equal(f.leaves.length,1);assert.deepEqual(f.b.errors,[]);
});
test('normal caster has no synthetic120-second Leave skill',()=>{const f=fixture(normal);f.h.run(125);assert.ok(f.e.alive);assert.equal(f.leaves.length,0);assert.deepEqual(f.b.errors,[]);});
test('Leave ignores forced silence and a nonattack disarm',()=>{
 const f=fixture();f.b.addBuff(f.e,{key:'fixture-flags',persist:true,flags:{silence:true,disarm:true}});f.h.run(120.1);
 assert.equal(f.leaves.length,1);assert.equal(f.e.alive,false);assert.deepEqual(f.b.errors,[]);
});
test('Leave cooldown becomes ready under control and commits only after the owner can act',()=>{
 const f=fixture();f.h.run(119);assert.equal(f.b.applyStatus(f.e,'stun',{duration:3}),true);f.h.run(2.9);assert.ok(f.e.alive);f.h.run(.3);
 assert.equal(f.leaves.length,1);assert.ok(Math.abs(f.leaves[0].age-122)<2*f.b.dt);assert.deepEqual(f.b.errors,[]);
});
test('Leave waits through a hidden route interval',()=>{const f=fixture();f.e.hidden=true;f.h.run(121);assert.ok(f.e.alive);f.e.hidden=false;f.h.run(.1);assert.equal(f.leaves.length,1);assert.deepEqual(f.b.errors,[]);});
test('priority-one Leave interrupts an older lock and restores its victim contribution',()=>{
 const f=fixture();f.a.left=1e6;f.h.run(119);begin(f);f.h.run(.8);assert.equal(f.a.target,f.u);assert.ok(f.u.s.atk<1000);f.h.run(.3);
 assert.equal(f.leaves.length,1);assert.equal(f.a.target,null);assert.equal(f.u.s.atk,1000);assert.equal(f.e.findBuff('ch16:lock'),null);assert.equal(f.e.mem.ch16RestoreShield,undefined);assert.deepEqual(f.b.errors,[]);
});
test('genuine accepted zero-HP damage receipts steal before mitigation while fabricated receipts cannot',()=>{
 const f=fixture();begin(f);const hp=f.u.hp;
 f.b.emit('beforeTargetModifier',{source:f.e,target:f.u,targetLife:f.u.deploySeq,outcome:'accepted',dmg:{type:'arts',amount:0}});assert.equal(f.u.s.atk,1000);
 f.b.dealDamage(f.e,f.u,{amount:0,type:'arts',canDodge:false});assert.equal(f.u.hp,hp);assert.equal(f.u.s.atk,950);assert.equal(f.a.totalStolen,50);assert.deepEqual(f.b.errors,[]);
});
test('fully absorbed channel damage still has an accepted theft modifier',()=>{
 const f=fixture();f.b.addBuff(f.u,{key:'fixture-shield',persist:true,shield:1e6});const hp=f.u.hp;begin(f);f.h.run(.3);
 assert.equal(f.u.hp,hp);assert.equal(f.u.s.atk,950);assert.equal(f.a.totalStolen,50);assert.deepEqual(f.b.errors,[]);
});
for(const outcome of ['protected','cancelled','missed'])test(outcome+' damage cannot grant a theft contribution',()=>{
 const f=fixture();begin(f);
 if(outcome==='protected')f.b.addBuff(f.u,{key:'fixture-protect',flags:{invulnerable:true}});
 if(outcome==='cancelled')f.b.on('hit',c=>{if(c.source===f.e)c.cancel=true;});
 if(outcome==='missed')f.b.addBuff(f.u,{key:'fixture-dodge',mods:{dodgeArts:1}});
 f.b.dealDamage(f.e,f.u,{amount:100,type:'arts',canDodge:true});assert.equal(f.u.s.atk,1000);assert.equal(f.a.totalStolen??0,0);assert.deepEqual(f.b.errors,[]);
});
test('active lock buff also observes a born ordinary splash modifier on each current recipient',()=>{
 const f=fixture(key,{units:2});begin(f);f.a.next=100;f.a.attack({targets:[f.u]},f.b,f.e,f.a);f.h.run(.4);
 assert.equal(f.u.s.atk,950);assert.equal(f.v.s.atk,950);assert.equal(f.a.totalStolen,100);assert.deepEqual(f.b.errors,[]);
});
test('modifier-owned theft retains the canonical2050 source cap and at least one target ATK',()=>{
 const f=fixture(key,{atk:100000});begin(f);for(let i=0;i<50;i++)f.b.dealDamage(f.e,f.u,{amount:0,type:'arts'});
 assert.equal(f.a.totalStolen,2050);assert.equal(f.u.s.atk,97950);f.a.retire();assert.equal(f.u.s.atk,100000);assert.deepEqual(f.b.errors,[]);
 const low=fixture(key,{atk:20});begin(low);low.b.dealDamage(low.e,low.u,{amount:0,type:'arts'});assert.equal(low.u.s.atk,1);assert.equal(low.a.totalStolen,19);
});
for(const event of ['death','removed','battleEnd','reuse'])test(event+' retires lock, shield callback, theft ownership and future Leave',()=>{
 const f=fixture();begin(f);f.b.dealDamage(f.e,f.u,{amount:0,type:'arts'});assert.equal(f.u.s.atk,950);const restore=f.e.mem.ch16RestoreShield;
 if(event==='death')f.b.kill(f.e,null);else if(event==='removed'){f.e.deployed=false;f.b.emit('removed',{unit:f.e});}else if(event==='battleEnd')f.b.emit('battleEnd',{});else f.e.deploySeq++;
 f.h.run(.1);restore();f.h.run(125);
 assert.equal(f.a.active,false);assert.equal(f.a.target,null);assert.equal(f.u.s.atk,1000);assert.equal(f.e.findBuff('ch16:lock'),null);assert.equal(f.e.findBuff('ch16:shield'),null);assert.equal(f.e.mem.ch16RestoreShield,undefined);assert.equal(f.leaves.length,0);assert.deepEqual(f.b.errors,[]);
});
for(const status of ['stun','freeze','sleep','levitate','silence'])test('accepted brief '+status+' interrupts unborn channel pulses without recalling earned theft',()=>{
 const f=fixture();begin(f);f.b.dealDamage(f.e,f.u,{amount:0,type:'arts'});
 const buff=f.b.addBuff(f.e,{key:'fixture-control',persist:true,flags:{[status]:true}});f.b.removeBuff(f.e,buff);f.h.run(1);
 assert.equal(f.a.target,null);assert.equal(f.u.s.atk,950);assert.equal(f.e.findBuff('ch16:lock'),null);assert.deepEqual(f.b.errors,[]);
});
test('source death inside modifier dispatch cannot continue the lock pulse loop',()=>{
 const f=fixture();begin(f);let calls=0;f.b.on('beforeTargetModifier',c=>{if(c.source===f.e){calls++;f.b.kill(f.e,null);}});f.h.run(2);
 assert.equal(calls,1);assert.equal(f.a.active,false);assert.equal(f.a.target,null);assert.equal(f.u.s.atk,1000);assert.deepEqual(f.b.errors,[]);
});
test('owner death while accepting the lock hold cannot leave an orphan hold or dereference a retired target',()=>{
 const f=fixture();f.b.on('beforeBuff',c=>{if(c.buff.key==='ch16:lock')f.b.kill(f.e,null);});f.a.left=0;f.h.run(.3);
 assert.equal(f.a.active,false);assert.equal(f.e.findBuff('ch16:lock'),null);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['death','reuse','targetReuse'])test('born splash protects '+mode+' deployment ownership',()=>{
 const f=fixture();f.a.attack({targets:[f.u]},f.b,f.e,f.a);const hp=f.u.hp;
 if(mode==='death')f.b.kill(f.e,null);if(mode==='reuse'){f.e.deploySeq++;f.e.base.atk=9999;f.e.markDirty();f.b.addBuff(f.e,{key:'fixture-new-life',mods:{dmgDealtMul:9}});}if(mode==='targetReuse')f.u.deploySeq++;
 f.h.run(.4);assert.equal(hp-f.u.hp,mode==='targetReuse'?0:750);assert.deepEqual(f.b.errors,[]);
});
test('stronger War Caster gate rejects absent evidence, changed records/native strings and unclaimed wrappers',()=>{
 const native=read('candidates/arkpedia-ch17-war-caster-native.json'),index=read('arkpedia-enemy-clock-source.json'),entries={[key]:records[key]},evidence={...native,chapter16Families:{warCaster:{graphSha256:review.sources.graph.sha256}}};
 assert.equal(read('candidates/arkpedia-ch16-enemy-support.json').enemies[key].policy,'stats-attacks-and-features');assert.equal(deriveEnemySupport(entries,index.prefabs,evidence)[key].policy,'stats-attacks-and-features');assert.equal(deriveEnemySupport(entries,index.prefabs,native)[key].policy,null);
 const changed=structuredClone(evidence);changed.prefabs[prefabPath(key)][0].originalJson+=' ';assert.equal(deriveEnemySupport(entries,index.prefabs,changed)[key].policy,null);
 const wrong=structuredClone(entries);wrong[key].levels[0].skills[2].initCooldown--;assert.equal(deriveEnemySupport(wrong,index.prefabs,evidence)[key].policy,null);assert.throws(()=>strongWarCaster(wrong[key].levels[0]),/Unreviewed/);
 const added=structuredClone(index.prefabs);added[prefabPath(key)].clockComponents.push({fields:{_familyMask:1,_trigger:{}}});assert.equal(deriveEnemySupport(entries,added,evidence)[key].policy,null);
 assert.equal(fixture().e.mem.ab.list.length,1);
});
test('candidate compiler refuses unsupported predefined operators and tutorial card activations',()=>{
 for(const code of ['17-14','17-16'])assert.throws(()=>assertCandidatePredefines(read('candidates/arkpedia-stage-'+code+'-source.json')),/predefined operator/);
 const s=structuredClone(read('candidates/arkpedia-stage-17-16-source.json'));s.rawLevel.predefines.characterInsts=[];assert.throws(()=>assertCandidatePredefines(s),/hidden operator-card/);
 s.geometry.suppliedUnits.fixed_squad=[];assert.throws(()=>assertCandidatePredefines(s),/operator-card activation/);
 assert.doesNotThrow(()=>assertCandidatePredefines(read('candidates/arkpedia-stage-17-17-source.json')));
});
