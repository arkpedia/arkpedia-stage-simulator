// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {storyGuardian} from '../server/sim/content/chapter16-story-guardian.js';
import {attach,installFeatureDispatch} from '../server/sim/content/enemies.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {verifiedNative,verifiedChapter16FamilyGraph} from '../tools/arkpedia/enemy-support.mjs';
import {parseSkel} from '../tools/assets/skel.mjs';
import {applySourceSlowDown,NATIVE_SLOW_DOWN_CONTRACT} from '../server/sim/content/arkpedia-slow-down.js';
import {miner as minerController} from '../server/sim/content/chapter16.js';
import {chapter16Shadow} from '../server/sim/content/chapter16-shadow.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {deriveEnemySupport,prefabPath} from '../shared/arkpedia/enemy-support.js';
const bytes=p=>readFileSync(new URL('../data/'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const records=read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const key='enemy_3011_dyegrd',record=records[key].levels[0],miner='enemy_3010_mcreep';
const review=read('candidates/arkpedia-ch16-reviewed-story-guardian.json');
const sha=x=>createHash('sha256').update(x).digest('hex');
function fixture({rejectDelay=false,unitCol=5,automatic=false}={}){
 const h=makeBattle({content:'generic',autoFinish:false,timeLimit:200,setup:automatic?installEnemyFeatures:installFeatureDispatch,
  defs:{enemies:{[key]:record,[miner]:records[miner].levels[0]},chess:{dummy:chessRec({id:'dummy',stats:{maxHp:1e6,atk:0,def:0,blockCnt:0}})}},
  units:[{chessId:'dummy',row:10,col:unitCol}]});
 h.b.start();if(rejectDelay)h.b.on('beforeBuff',c=>{if(c.buff.key==='dyegrd_t[delay_dot]')c.cancel=true;});
 const e=h.spawn(key,{pos:[10,7]}),a=automatic?e.mem.ab.list.find(a=>typeof a.disableDelay==='function'):storyGuardian(record);
 e.base.moveSpeed=0;e.markDirty();if(!automatic)attach(h.b,e,[a]);
 const hits=[];h.b.on('ch16GuardianHit',c=>hits.push({...c,time:h.b.time}));
 return{h,b:h.b,e,a,u:h.unit('dummy'),hits};
}
function addMiner(f,pos=[10,6]){
 const u=f.h.spawn(miner,{pos});u.base.moveSpeed=0;u.base.atk=0;u.base.maxHp=1e6;u.markDirty();u.hp=u.s.maxHp;
 u.profile.neutral=true;u.profile.noAttack=true;
 f.b.addBuff(u,{key:'enemy_mcreep_self_mark',persist:true});return u;
}

test('Guardian full source, native clocks and independent event25 disable aliases verify',()=>{
 for(const src of Object.values(review.sources))assert.equal(sha(readFileSync(new URL('../'+src.path,import.meta.url))),src.sha256);
 const index=read('arkpedia-enemy-clock-source.json');
 verifiedNative(read('candidates/arkpedia-ch16-story-guardian-native.json'),index.prefabs,sha(bytes('arkpedia-enemy-clock-source.json')),read('arkpedia-mvp.json').behaviors.source);
 verifiedChapter16FamilyGraph(bytes('candidates/arkpedia-ch16-story-guardian-source.json'),bytes('arkpedia-cn-native-source.json'),bytes('arkpedia-cn-enemy-native-source.json'),index);
 const anim=read('candidates/arkpedia-ch16-story-guardian-animation-source.json').enemies[key],raw=Buffer.from(anim.base64,'base64');
 assert.equal(sha(raw),anim.sha256);assert.equal(raw.length,anim.bytes);
 const skel=parseSkel(raw,undefined,{includeEventPayloads:true,includeExactDurations:true});
 assert.equal(skel.eventPayloads.Attack02[0].time,review.defaults.normalHit);
 assert.equal(skel.eventPayloads.Skill_01[0].time,review.defaults.skillHit);
 assert.equal(skel.exactDurations.Attack02,review.defaults.normalDuration);assert.equal(skel.exactDurations.Skill_01,review.defaults.skillDuration);
 const aliases=read('candidates/arkpedia-buff-event-alias-source.json');
 assert.equal(aliases.source.nativeInventory.sha256,sha(bytes('arkpedia-cn-native-source.json')));
 assert.deepEqual(aliases.source.namedTemplates,read('arkpedia-mvp.json').behaviors.source);
 const normalize=v=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='$type'?x.split(',')[0]:normalize(x)])):v;
 for(const [number,event]of Object.entries(aliases.events)){
  assert.ok(event.matchingTemplates>=3);assert.equal(new Set(event.witnesses.map(w=>w.template)).size,3);
  for(const w of event.witnesses){assert.equal(w.numeric,+number);assert.equal(w.name,event.name);assert.deepEqual(normalize(JSON.parse(w.nativeActionsJson)),normalize(w.namedActions));}
 }
 assert.equal(aliases.events[25].name,'ON_BUFF_DISABLE');
});

test('exact Guardian native evidence, family binding and record signatures are all required for support',()=>{
 const index=read('arkpedia-enemy-clock-source.json'),native=read('candidates/arkpedia-ch16-story-guardian-native.json');
 const entries={[key]:records[key]},evidence={...native,chapter16Families:{storyGuardian:{graphSha256:review.sources.graph.sha256}}};
 assert.equal(deriveEnemySupport(entries,index.prefabs,evidence)[key].policy,'stats-attacks-and-features');
 assert.equal(deriveEnemySupport(entries,index.prefabs,native)[key].policy,null);
 const changed=structuredClone(evidence);changed.prefabs[prefabPath(key)][0].originalJson+=' ';
 assert.equal(deriveEnemySupport(entries,index.prefabs,changed)[key].policy,null);
 for(const mutate of [r=>r.talents.bb['DelayBloodDot.hp_ratio']=.1,r=>r.skills[0].bb.damage_scale=3,r=>r.prefabKey='enemy_1505_dyeb']){
  const wrong=structuredClone(entries);mutate(wrong[key].levels[0]);
  assert.equal(deriveEnemySupport(wrong,index.prefabs,evidence)[key].policy,null);
  assert.throws(()=>storyGuardian(wrong[key].levels[0]),/Unreviewed/);
 }
 const counts=structuredClone(index.prefabs);counts[prefabPath(key)].clockComponents.push({fields:{_familyMask:1,_trigger:{}}});
 assert.equal(deriveEnemySupport(entries,counts,evidence)[key].policy,null);
});

test('automatic dispatch attaches exactly one Guardian controller for both talent and skill and keeps16-9 unadmitted',()=>{
 const f=fixture({automatic:true});assert.ok(f.a);
 assert.equal(f.e.mem.ab.list.filter(a=>typeof a.disableDelay==='function').length,1);
 assert.equal(read('candidates/arkpedia-ch16-enemy-support.json').enemies[key].policy,'stats-attacks-and-features');
 assert.equal(read('arkpedia-stages.json').stages.some(s=>s.code==='16-9'),false);
 f.b.removeBuff(f.e,f.a.delay);f.h.run(1.1);assert.equal(f.e.hp,f.e.s.maxHp-2000);assert.deepEqual(f.b.errors,[]);
});

test('75-second accepted parent starts one immobilizing core, whose first pure pulse waits a full second',()=>{
 const f=fixture(),hp=f.e.hp;f.h.run(74.9);assert.equal(f.e.hp,hp);assert.equal(f.a.core,null);
 f.h.run(.2);assert.ok(f.a.core);assert.equal(f.e.s.flags.noMove,true);assert.equal(f.e.hp,hp);
 f.h.run(.8);assert.equal(f.e.hp,hp);f.h.run(.2);assert.equal(f.e.hp,hp-2000);
 assert.equal(f.e.buffs.filter(b=>b.key==='dyegrd_t[delay_dot_core]').length,1);assert.deepEqual(f.b.errors,[]);
});

test('early removal runs ON_BUFF_DISABLE once; a rejected delay parent cannot start the core',()=>{
 const f=fixture(),hp=f.e.hp;f.b.removeBuff(f.e,f.a.delay);assert.ok(f.a.core);
 f.b.removeBuff(f.e,f.a.delay);f.h.run(.9);assert.equal(f.e.hp,hp);f.h.run(.2);assert.equal(f.e.hp,hp-2000);
 assert.equal(f.e.buffs.filter(b=>b.key==='dyegrd_t[delay_dot_core]').length,1);
 const g=fixture({rejectDelay:true});assert.equal(g.a.delay,null);g.h.run(78);
 assert.equal(g.a.core,null);assert.equal(g.e.hp,g.e.s.maxHp);assert.deepEqual([...f.b.errors,...g.b.errors],[]);
});

test('self loss samples current max HP and damage modifiers, survives silence/stun and can kill the owner',()=>{
 const f=fixture();f.b.removeBuff(f.e,f.a.delay);
 f.b.addBuff(f.e,{key:'fixture-hp-and-resistance',persist:true,mods:{hpPct:1,trueTakenMul:.5}});f.e.hp=f.e.s.maxHp;
 f.b.addBuff(f.e,{key:'fixture-control',persist:true,flags:{silence:true,stun:true}});
 const hp=f.e.hp;f.h.run(1.1);assert.equal(hp-f.e.hp,2000);
 f.e.hp=100;f.h.run(1);assert.equal(f.e.alive,false);assert.equal(f.a.active,false);assert.deepEqual(f.b.errors,[]);
});

test('global marked-miner presence survives source hiding and one provider death, then releases on final retirement',()=>{
 const f=fixture(),u=addMiner(f,[9,2]);f.h.run(.1);assert.ok(u.findBuff('gyegrd_a[exist]'));
 assert.equal(f.u.findBuff('gyegrd_a[exist]'),null,'unmarked operators are not recipients');
 const second=f.h.spawn(key,{pos:[12,9]}),a2=storyGuardian(record);second.base.moveSpeed=0;second.markDirty();attach(f.b,second,[a2]);
 f.e.hidden=true;f.h.run(.1);assert.ok(u.findBuff('gyegrd_a[exist]'));
 f.b.kill(f.e,null);f.h.run(.1);assert.equal(u.findBuff('gyegrd_a[exist]').source,second);
 f.b.kill(second,null);f.h.run(.1);assert.equal(u.findBuff('gyegrd_a[exist]'),null);assert.deepEqual(f.b.errors,[]);
});

test('the actual miner controller cannot suppress fog while Guardian exists, then resumes after its retirement',()=>{
 const f=fixture(),u=addMiner(f,[9,2]);attach(f.b,u,[minerController(records[miner].levels[0])]);
 const shadow=chapter16Shadow(f.b);shadow.setShadowSource(f.u,[[u.tileR,u.tileC]]);
 f.h.run(.4);assert.ok(u.findBuff('gyegrd_a[exist]'));assert.equal(shadow.isShadow(u.tileR,u.tileC),true);
 f.b.kill(f.e,null);f.h.run(.4);assert.equal(u.findBuff('gyegrd_a[exist]'),null);
 assert.equal(shadow.isShadow(u.tileR,u.tileC),false);assert.deepEqual(f.b.errors,[]);
});

test('ordinary attacks capture a marked miner and wait for the original Attack02 marker',()=>{
 const f=fixture(),u=addMiner(f);assert.equal(f.h.runUntil(()=>!!f.a.phase,1),true);
 const hp=u.hp;f.h.run(.7);assert.equal(u.hp,hp);f.h.run(.1);assert.equal(hp-u.hp,f.e.s.atk-u.s.def);
 assert.equal(f.u.hp,f.u.s.maxHp,'nearby ordinary operators are not direct inputs');
 assert.equal(f.hits.length,1);assert.equal(f.hits[0].kind,'normal');assert.deepEqual(f.b.errors,[]);
});

test('ready AOE uses its captured miner center, live ATK, separate cooldown and ground/selectability filters',()=>{
 const f=fixture({unitCol:4}),u=addMiner(f),near=f.u;f.a.skillCd=0;
 assert.equal(f.h.runUntil(()=>f.a.phase?.kind==='skill',1),true);const hp=u.hp,allyHp=near.hp;
 f.h.run(1);assert.equal(u.hp,hp);f.b.addBuff(f.e,{key:'fixture-atk',persist:true,mods:{atkPct:1}});f.h.run(.1);
 assert.equal(hp-u.hp,4800-u.s.def);assert.equal(allyHp-near.hp,4800);
 f.h.run(.8);assert.equal(f.a.phase?.kind,'normal');assert.ok(f.a.skillCd>9.8);assert.deepEqual(f.b.errors,[]);
});

for(const status of ['stun','freeze','sleep','levitate','disarm'])test('brief '+status+' cancels an unborn AOE even after the sampled flag is gone',()=>{
 const f=fixture();addMiner(f);f.a.skillCd=0;assert.equal(f.h.runUntil(()=>!!f.a.phase,1),true);
 const buff=f.b.addBuff(f.e,{key:'fixture-control',persist:true,flags:{[status]:true}});f.b.removeBuff(f.e,buff);
 f.h.run(2);assert.equal(f.hits.filter(c=>c.kind==='skill').length,0);assert.ok(f.a.skillCd>8);assert.deepEqual(f.b.errors,[]);
});

for(const flag of ['liftoff','untargetable','sleep'])test('Guardian AOE excludes a nearby operator with '+flag,()=>{
 const f=fixture({unitCol:4}),u=addMiner(f),hp=u.hp;
 f.b.addBuff(f.u,{key:'fixture-target-filter',persist:true,flags:{[flag]:true}});f.a.skillCd=0;
 assert.equal(f.h.runUntil(()=>f.a.phase?.kind==='skill',1),true);f.h.run(1.2);
 assert.equal(f.u.hp,f.u.s.maxHp);assert.equal(hp-u.hp,2400-u.s.def);assert.deepEqual(f.b.errors,[]);
});

test('live slow_down changes only remaining cast progress; lost input life never retargets another miner',()=>{
 const f=fixture(),u=addMiner(f);f.a.skillCd=0;assert.equal(f.h.runUntil(()=>!!f.a.phase,1),true);
 f.h.run(.5);const slow=applySourceSlowDown(f.b,f.u,f.e,{key:'guardian-clock',increment:.5,maxStrength:.5,maxStacks:1,duration:30,contract:NATIVE_SLOW_DOWN_CONTRACT});
 f.h.run(.8);assert.equal(f.hits.length,0);f.b.removeBuff(f.e,slow);
 f.b.kill(u,null);const other=addMiner(f,[10,6.5]),hp=other.hp;f.h.run(.5);
 assert.equal(other.hp,hp);assert.equal(f.hits.length,0);assert.deepEqual(f.b.errors,[]);
});

test('battle end cancels pending hit, parent/core callbacks and global fog without spawning a replacement core',()=>{
 const f=fixture(),u=addMiner(f);f.a.skillCd=0;f.h.run(.1);f.b.emit('battleEnd',{});f.h.run(80);
 assert.equal(f.a.active,false);assert.equal(f.a.phase,null);assert.equal(f.hits.length,0);
 assert.equal(f.e.findBuff('dyegrd_t[delay_dot_core]'),null);assert.equal(u.findBuff('gyegrd_a[exist]'),null);
 assert.deepEqual(f.b.errors,[]);
});
