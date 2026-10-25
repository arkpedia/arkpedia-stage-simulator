// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import {createHash}from'node:crypto';
import {pollutionFlyer}from'../server/sim/content/chapter17-flyer.js';
import {attach,installFeatureDispatch}from'../server/sim/content/enemies.js';
import {installEnemyFeatures}from'../server/sim/content/arkpedia-enemy-features.js';
import {deriveEnemySupport,prefabPath}from'../shared/arkpedia/enemy-support.js';
import {makeBattle,chessRec}from'./helpers/battleHarness.js';
import {verifiedNative,verifiedChapter16FamilyGraph}from'../tools/arkpedia/enemy-support.mjs';
import {parseSkel}from'../tools/assets/skel.mjs';
import {applySourceSlowDown,NATIVE_SLOW_DOWN_CONTRACT}from'../server/sim/content/arkpedia-slow-down.js';
const bytes=p=>readFileSync(new URL('../data/'+p,import.meta.url)),read=p=>JSON.parse(bytes(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const records=read('candidates/arkpedia-enemy-records.canonical.json').enemies,review=read('candidates/arkpedia-ch17-reviewed-flyer.json');
const keys=Object.keys(review.enemies),murad='enemy_10211_murad';
function fixture(key=keys[0],{autoFinish=false,automatic=false}={}){
 const h=makeBattle({content:'generic',autoFinish,timeLimit:90,setup:automatic?installEnemyFeatures:installFeatureDispatch,
  defs:{enemies:{[key]:records[key].levels[0],[murad]:records[murad].levels[0]},chess:{dummy:chessRec({id:'dummy',stats:{maxHp:1e6,atk:0,def:0,blockCnt:0}})}},
  units:[{chessId:'dummy',row:10,col:7}]});h.b.start();
 const e=h.spawn(key,{pos:[10,7]}),a=automatic?e.mem.ab.list.find(a=>a.trace):pollutionFlyer(records[key].levels[0]);if(!automatic)attach(h.b,e,[a]);
 e.base.moveSpeed=0;e.markDirty();const blasts=[];h.b.on('ch17FlyerBlast',c=>blasts.push(c));
 return{h,b:h.b,e,a,u:h.unit('dummy'),blasts};
}
function leak(f,pos=[10,7]){
 const t=f.h.spawn(murad,{pos});t.base.moveSpeed=0;t.profile.noAttack=true;t.markDirty();
 f.b.addBuff(t,{key:'fixture-hidden-source',persist:true,flags:{untargetable:true,noMove:true}});t.mem.regularHidden=true;
 return t;
}
function charge(f,target){f.a.trace.refresh(true);assert.equal(f.h.runUntil(()=>!!f.a.phase,1),true);assert.equal(f.a.phase.target,target);}

test('Flyer complete blackboard projectile closure, indexed native and bound change clocks verify',()=>{
 for(const p of Object.values(review.sources))assert.equal(sha(readFileSync(new URL('../'+p.path,import.meta.url))),p.sha256);
 const index=read('arkpedia-enemy-clock-source.json'),graph=bytes('candidates/arkpedia-ch17-flyer-source.json');
 verifiedNative(read('candidates/arkpedia-ch17-flyer-native.json'),index.prefabs,sha(bytes('arkpedia-enemy-clock-source.json')),read('arkpedia-mvp.json').behaviors.source);
 verifiedChapter16FamilyGraph(graph,bytes('arkpedia-cn-native-source.json'),bytes('arkpedia-cn-enemy-native-source.json'),index);
 const changed=JSON.parse(graph);changed.projectiles={};
 assert.throws(()=>verifiedChapter16FamilyGraph(JSON.stringify(changed),bytes('arkpedia-cn-native-source.json'),bytes('arkpedia-cn-enemy-native-source.json'),index),/blackboard projectile closure incomplete/);
 const g=JSON.parse(graph),projectile=Object.values(g.projectiles)[0].map(r=>JSON.parse(r.originalJson));
 assert.equal(projectile.find(n=>n.m_Radius!==undefined).m_Radius,review.defaults.blastRadius);
 const life=projectile.find(n=>n._lifeTime!==undefined);assert.equal(life._lifeTime,1);assert.equal(life._alwaysReachInTheEnd,1);assert.equal(life._stopWhenSourceInvalid,0);
 assert.equal(projectile.find(n=>n._onlyCheckHitWhenReachTarget!==undefined)._onlyCheckHitWhenReachTarget,1);
 for(const row of Object.values(read('candidates/arkpedia-ch17-flyer-animation-source.json').enemies)){
  const raw=Buffer.from(row.base64,'base64');assert.equal(sha(raw),row.sha256);
  const skel=parseSkel(raw,undefined,{includeEventPayloads:true,includeExactDurations:true});
  for(const name of ['Change_1','Change_2']){assert.equal(skel.eventPayloads[name][0].time,review.defaults.changeHit);assert.equal(skel.exactDurations[name],1);}
 }
});

for(const key of keys)test(key+' ignores source target-free state, commits at native marker and cannot charge twice from one marked source',()=>{
 const f=fixture(key),t=leak(f);charge(f,t);f.h.run(.6);assert.equal(f.a.mode,0);
 f.h.run(.1);assert.equal(f.a.mode,1);assert.equal(f.a.phase,null);assert.ok(t.findBuff('enemy_mufly_reached'));
 f.h.run(2);assert.equal(f.a.mode,1);assert.equal(f.e.stats.attacks,0);assert.deepEqual(f.b.errors,[]);
});

test('two distinct source contacts cap growth at two; other flyers retain independent contact markers',()=>{
 const f=fixture(),one=leak(f);charge(f,one);f.h.run(.7);const two=leak(f);charge(f,two);f.h.run(.7);
 assert.equal(f.a.mode,2);assert.equal(f.a.trace.state.enabled,false);
 const other=f.h.spawn(keys[0],{pos:[10,7]}),a=pollutionFlyer(records[keys[0]].levels[0]);other.base.moveSpeed=0;other.markDirty();attach(f.b,other,[a]);
 f.h.run(.8);assert.equal(a.mode,1);assert.equal(one.buffs.filter(b=>b.key==='enemy_mufly_reached').length,2);
 assert.deepEqual(f.b.errors,[]);
});

test('native trace chooses nearest source, pauses original waits/goals, emits movement and returns to original cursor',()=>{
 const f=fixture();f.e.base.moveSpeed=2;f.e.markDirty();
 f.e.route.legs=[{t:'wait',time:3},{t:'move',r:10,c:8,final:true}];f.e.route.legIdx=0;f.e.route.waitLeft=3;f.e.route.pts=null;
 const far=leak(f,[10,11]),near=leak(f,[9,7]);f.a.trace.refresh(true);assert.equal(f.a.trace.state.target,near);
 const moved=[];f.b.on('enemyMoved',c=>moved.push(c));f.h.run(.3);
 assert.ok(f.e.y<10);assert.equal(f.e.route.waitLeft,3);assert.equal(f.e.route.legIdx,0);assert.ok(moved.some(c=>c.kind==='native-trace'));
 f.b.kill(near,null);f.a.trace.refresh();assert.equal(f.a.trace.state.target,far);
 f.b.kill(far,null);f.h.run(.2);assert.ok(f.e.route.waitLeft<3);assert.deepEqual(f.b.errors,[]);
});

test('native cursor uses stage movement scale, stops at contact and cannot consume the old objective early',()=>{
 const f=fixture();f.e.base.moveSpeed=2;f.e.markDirty();f.b.flags.moveScale=.5;
 f.e.route.goal={x:f.e.x,y:f.e.y};f.e.route.visitEveryCheckPoint=false;
 const t=leak(f,[10,10]);f.a.trace.refresh(true);const x=f.e.x;f.h.run(.5);
 assert.ok(f.e.alive);assert.ok(Math.abs(f.e.x-x-.5)<f.b.dt+1e-6);
 f.h.run(3);assert.ok(Math.hypot(f.e.x-t.x,f.e.y-t.y)>=.35-1e-7);assert.deepEqual(f.b.errors,[]);
});

test('silence leaves growth active; accepted Charge grants only its source stun protection',()=>{
 const f=fixture();f.b.addBuff(f.e,{key:'fixture-silence',persist:true,flags:{silence:true}});const t=leak(f);charge(f,t);
 assert.equal(f.b.applyStatus(f.e,'stun',{duration:1}),false);
 f.h.run(.7);assert.equal(f.a.mode,1);assert.equal(f.e.s.flags.stun,false);
 const stun=f.b.applyStatus(f.e,'stun',{duration:1});assert.ok(stun);assert.deepEqual(f.b.errors,[]);
});

for(const status of ['freeze','sleep','levitate'])test('brief '+status+' interrupts an uncommitted charge without recalling its source marker',()=>{
 const f=fixture(),t=leak(f);charge(f,t);
 const control=f.b.addBuff(f.e,{key:'fixture-control',persist:true,flags:{[status]:true}});f.b.removeBuff(f.e,control);f.h.run(.8);
 assert.equal(f.a.mode,0);assert.equal(f.a.phase,null);assert.ok(t.findBuff('enemy_mufly_reached'));assert.deepEqual(f.b.errors,[]);
});

test('native slow_down scales the remaining change clock without inventing an ASPD change',()=>{
 const f=fixture(),t=leak(f);charge(f,t);f.h.run(.3);
 const buff=applySourceSlowDown(f.b,f.u,f.e,{key:'flyer-clock',increment:.5,maxStrength:.5,maxStacks:1,duration:10,contract:NATIVE_SLOW_DOWN_CONTRACT});
 f.h.run(.6);assert.equal(f.a.mode,0);f.b.removeBuff(f.e,buff);f.h.run(.1);assert.equal(f.a.mode,1);assert.deepEqual(f.b.errors,[]);
});

for(const mode of [0,1,2])test('committed mode '+mode+' owns one delayed physical blast with its exact damage coefficient',()=>{
 const f=fixture();for(let i=0;i<mode;i++){const t=leak(f);charge(f,t);f.h.run(.7);}
 const hp=f.u.hp;f.b.kill(f.e,null);f.h.run(.9);assert.equal(f.u.hp,hp);f.h.run(.2);
 assert.equal(hp-f.u.hp,350*(mode+1));assert.equal(f.blasts.length,1);assert.deepEqual(f.b.errors,[]);
});

test('born blast samples current same-life ATK and current victims at the fixed death point, bypassing camouflage',()=>{
 const f=fixture(),hp=f.u.hp;f.b.addBuff(f.u,{key:'fixture-camouflage',persist:true,flags:{camou:true}});
 f.b.kill(f.e,null);f.b.addBuff(f.e,{key:'fixture-atk',persist:true,allowDead:true,mods:{atkPct:1}});f.e.x=12;f.h.run(1.1);
 assert.equal(hp-f.u.hp,700);assert.equal(f.blasts[0].x,7);assert.deepEqual(f.b.errors,[]);
});

for(const event of ['silenced','leak','battleEnd'])test(event+' cannot emit a late Flyer death blast',()=>{
 const f=fixture(),hp=f.u.hp;
 if(event==='silenced')f.b.addBuff(f.e,{key:'fixture-silence',persist:true,flags:{silence:true}});
 if(event==='leak')f.b.leak(f.e);else f.b.kill(f.e,null);
 if(event==='battleEnd')f.b.emit('battleEnd',{});f.h.run(1.2);
 assert.equal(f.u.hp,hp);assert.equal(f.blasts.length,0);assert.deepEqual(f.b.errors,[]);
});

test('a last-enemy born projectile holds battle completion until its damage has resolved',()=>{
 const f=fixture(keys[0],{autoFinish:true}),hp=f.u.hp;f.b.kill(f.e,null);f.h.run(.2);
 assert.equal(f.b.finished,false);f.h.run(1);assert.equal(f.b.finished,true);assert.equal(hp-f.u.hp,350);
});

test('Flyer admission rejects missing family evidence, changed records, components and wrapper counts',()=>{
 const support=read('candidates/arkpedia-ch16-enemy-support.json'),native=read('candidates/arkpedia-ch17-flyer-native.json'),index=read('arkpedia-enemy-clock-source.json');
 const entries=Object.fromEntries(keys.map(key=>[key,records[key]]));
 const evidence={...native,chapter16Families:{flyer:{graphSha256:review.sources.graph.sha256}}};
 for(const key of keys){
  assert.equal(support.enemies[key].policy,'stats-attacks-and-features');
  assert.equal(deriveEnemySupport(entries,index.prefabs,evidence)[key].policy,'stats-attacks-and-features');
  assert.equal(deriveEnemySupport(entries,index.prefabs,native)[key].policy,null);
  const changed=structuredClone(evidence);changed.prefabs[prefabPath(key)][0].originalJson+=' ';
  assert.equal(deriveEnemySupport(entries,index.prefabs,changed)[key].policy,null);
  const wrong=structuredClone(entries);wrong[key].levels[0].talents.bb.extra=1;
  assert.equal(deriveEnemySupport(wrong,index.prefabs,evidence)[key].policy,null);
  const added=structuredClone(index.prefabs);added[prefabPath(key)].clockComponents.push({fields:{_familyMask:1,_trigger:{}}});
  assert.equal(deriveEnemySupport(entries,added,evidence)[key].policy,null);
  const record=structuredClone(records[key].levels[0]);record.skills[0].cooldown++;
  assert.throws(()=>pollutionFlyer(record),/Unreviewed/);
 }
});

test('a born blast cannot borrow ATK, modifiers or identity from a reused source deployment',()=>{
 const f=fixture(),hp=f.u.hp,life=f.e.deploySeq;f.b.kill(f.e,null);
 f.e.deploySeq++;f.e.base.atk=9999;f.e.markDirty();f.b.addBuff(f.e,{key:'fixture-new-life',persist:true,allowDead:true,mods:{dmgDealtMul:9}});f.h.run(1.1);
 assert.equal(hp-f.u.hp,350);assert.equal(f.blasts.length,1);assert.equal(f.blasts[0].source.deploySeq,life);assert.deepEqual(f.b.errors,[]);
});
for(const status of ['hidden','sleep','untargetable'])test('death projectile excludes a current '+status+' victim',()=>{
 const f=fixture(),hp=f.u.hp;f.b.kill(f.e,null);
 if(status==='hidden')f.u.hidden=true;else f.b.addBuff(f.u,{key:'fixture-select',persist:true,flags:{[status]:true}});
 f.h.run(1.1);assert.equal(f.u.hp,hp);assert.equal(f.blasts.length,1);assert.deepEqual(f.b.errors,[]);
});
test('a flying owner can hit a liftoff operator that retains ground motion',()=>{
 const f=fixture(),hp=f.u.hp;f.b.addBuff(f.u,{key:'fixture-liftoff',persist:true,flags:{liftoff:true}});
 f.b.kill(f.e,null);f.h.run(1.1);assert.equal(hp-f.u.hp,350);assert.deepEqual(f.b.errors,[]);
});

test('retired trace cursor rejects a target reused as another deployment',()=>{
 const f=fixture(),t=leak(f,[10,10]);f.a.trace.refresh(true);
 const seq=t.deploySeq;t.deploySeq++;t.hidden=true;f.a.trace.refresh();
 assert.equal(f.a.trace.state.target,null);t.hidden=false;t.deploySeq=seq;f.a.trace.refresh(true);assert.equal(f.a.trace.state.target,t);
 f.b.emit('battleEnd',{});assert.equal(f.e.profile.nativeFlyingTrace,undefined);assert.equal(f.a.active,false);
});
for(const key of keys)test(key+' automatically attaches one controller for both Charge records and all three blasts',()=>{
 const f=fixture(key,{automatic:true});assert.ok(f.a);assert.equal(f.e.mem.ab.list.filter(a=>a.trace).length,1);
 const t=leak(f);charge(f,t);f.h.run(.7);assert.equal(f.a.mode,1);
 const hits=[];f.b.on('damaged',c=>{if(c.source===f.e&&c.dmg?.tags?.includes('flyer-blast'))hits.push(c.amount);});
 f.b.kill(f.e,null);f.h.run(1.1);
 assert.deepEqual(hits,[f.e.s.atk*2]);assert.equal(f.blasts.length,1);assert.deepEqual(f.b.errors,[]);
});
