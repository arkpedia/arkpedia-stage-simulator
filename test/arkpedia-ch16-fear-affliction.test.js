// SPDX-License-Identifier: GPL-3.0-or-later
// Internal native action receiver; no fear enemy/stage admission follows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { makeBattle, enemyRec } from './helpers/battleHarness.js';
import { compileStageLocalEnemy } from '../shared/arkpedia/enemy-records.js';
import { fearProjectileAfflictions } from '../server/sim/content/chapter16-fear-affliction.js';
import {applyFearProjectileImpact,fearProjectileDamageAction,fearProjectileSourceReference,fearProjectileEntityReference} from '../server/sim/content/chapter16-fear-impact.js';
import {fearProjectileHitLedger} from '../server/sim/content/chapter16-fear-delivery.js';
import {fearProjectileLifetime} from '../server/sim/content/chapter16-fear-clock.js';
import {fearProjectileAreaDelivery} from '../server/sim/content/chapter16-fear-area.js';
import {fearProjectileFlight} from '../server/sim/content/chapter16-fear-flight.js';
import {fearProjectileBuffIteration} from '../server/sim/content/chapter16-fear-buff-iteration.js';
import {fearProjectileBuffList} from '../server/sim/content/chapter16-fear-buff-list.js';
import {fearProjectileBuffPointers} from '../server/sim/content/chapter16-fear-buff-pointer.js';
import {fearProjectileFinishedBuffs} from '../server/sim/content/chapter16-fear-buff-cleanup.js';
import {fearProjectileFinishAndRemoveBuff,fearProjectileOverrideGroupRemove} from '../server/sim/content/chapter16-fear-buff-finish.js';
import {fearProjectileBuffRecycleQueue,fearProjectileClearRuntimeData} from '../server/sim/content/chapter16-fear-buff-recycle.js';
import {fearProjectileBuffIdentity,fearProjectileResetBuffLifecycle} from '../server/sim/content/chapter16-fear-buff-identity.js';
import {fearProjectileBuffTimer,fearProjectileResetBuffTriggers,fearProjectileBuffDurationKey,fearProjectileResetBuffLifetime,fearProjectileModifyBuffLifetime} from '../server/sim/content/chapter16-fear-buff-timing.js';
import {fearProjectileResetBuffBlackboard,fearProjectileBuffPrefixAssignments,fearProjectileBuffBlackboardWrites,fearProjectileBuffBlackboardReads,fearProjectileBuffBlackboardPairs} from '../server/sim/content/chapter16-fear-buff-blackboard.js';
import {fearProjectileFloatToRaw,fearProjectileFloorToInt} from '../server/sim/content/chapter16-fear-fixed-values.js';
import {fearProjectileBuffRecyclePool,fearProjectileDefaultBuffPool} from '../server/sim/content/chapter16-fear-buff-pool.js';
import {fearProjectileArrivalLayerMask} from '../server/sim/content/chapter16-fear-layers.js';
import {fearProjectileAttackWait,fearProjectileWaitFrameCount} from '../server/sim/content/chapter16-fear-cast-wait.js';
import {fearProjectileSpell} from '../server/sim/content/chapter16-fear-spell.js';
import {fearProjectileSelfDeath,fearProjectileSuicide,fearProjectileSelfDeathActivation,fearProjectileModeFsmRestart,fearProjectileModeSwitch,fearProjectileCollectModeAbilities,fearProjectileModeEffects,fearProjectileModeNotification,fearProjectileBuffModeChange} from '../server/sim/content/chapter16-fear-self-death.js';
import {fearProjectileTargetVerifier,fearProjectileSourceMotion} from '../server/sim/content/chapter16-fear-targets.js';
import {fearProjectileReached,fearProjectileMotionStep,fearProjectileMountReference,fearProjectileTraceMotion} from '../server/sim/content/chapter16-fear-movement.js';
import { battle as minerBattle, keys as minerKeys } from './helpers/ch17Harness.js';
import { chapter16Shadow } from '../server/sim/content/chapter16-shadow.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const parentKey='feawpj_a[mcreep_fear]';
const fpOne=1n<<32n;
test('original fear modes initialize general before shared combat/attack and retain one shared ranged ability',()=>{
 const source=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),graph=source.modeSwitch.graph;
 const resolve=ref=>ref.m_PathID==='0'?null:ref.m_PathID;
 const collect=role=>{
  const native=JSON.parse(graph[role].component.originalJson);
  return fearProjectileCollectModeAbilities({generalAbilities:native._generalAbilities.map(resolve),combat:resolve(native._combat),
   attack:resolve(native._attack),isValid:x=>x!==null,equals:(a,b)=>a===b});
 };
 assert.deepEqual(collect('mode0'),['-5760848500668714718','4729572091462136098']);
 assert.deepEqual(collect('mode1'),['-5930072227765702366']);
});

test('mode initialization uses swap-last removal and advances past the swapped entry exactly as the native loop does',()=>{
 const a={},b={},c={};
 const collect=generalAbilities=>fearProjectileCollectModeAbilities({generalAbilities,combat:null,attack:null,isValid:x=>x!==null,equals:(x,y)=>x===y});
 assert.deepEqual(collect([a,a,b,c]),[a,c,b]);
 assert.deepEqual(collect([a,a,a]),[a,a],'the swapped element is not rechecked at the same index');
});

test('mode initialization rejects invalid entries and delegates equality without substituting JavaScript reference equality',()=>{
 const a={id:1},duplicate={id:1},invalid={invalid:true},calls=[];
 const list=fearProjectileCollectModeAbilities({generalAbilities:[invalid,a],combat:duplicate,attack:null,
  isValid:x=>x!==null&&!x.invalid,equals:(left,right)=>{calls.push([left,right]);return left.id===right.id;}});
 assert.deepEqual(list,[a]);assert.deepEqual(calls,[[a,duplicate]]);
 assert.throws(()=>fearProjectileCollectModeAbilities({generalAbilities:[],combat:null,attack:null,isValid:()=>1,equals:()=>true}),/Boolean/);
});

test('default battle buff pool preloads100 without allocating identities and pops unused bodies in LIFO order',()=>{
 const counter={value:0},identity=fearProjectileBuffIdentity({counter});let created=0;
 const pool=fearProjectileDefaultBuffPool({createBuff:()=>({instanceUid:0,m_isValid:false,serial:++created}),onAllocate:identity.allocate,onRecycle:identity.recycle});
 assert.equal(created,100);assert.equal(counter.value,0);assert.equal(pool.availableUnusedCount,100);assert.equal(pool.allLoadedCount,100);assert.equal(pool.usingCount,0);
 const first=pool.allocate(),second=pool.allocate();assert.equal(first.serial,100);assert.equal(second.serial,99);
 assert.equal(first.instanceUid,1);assert.equal(second.instanceUid,2);assert.equal(pool.availableUnusedCount,98);assert.equal(pool.usingCount,2);
 assert.equal(pool.recycle(first),true);assert.equal(first.instanceUid,0);assert.equal(first.m_isValid,false);
 assert.equal(pool.allocate(),first);assert.equal(first.instanceUid,3);assert.equal(created,100);assert.equal(pool.allLoadedCount,100);
});

test('exhausting the default preload creates one new buff and never force-reuses a currently tracked body',()=>{
 let created=0,notifications=0;
 const pool=fearProjectileDefaultBuffPool({createBuff:()=>({serial:++created}),onAllocate:()=>notifications++,onRecycle:()=>{throw Error('auto reuse disabled');}});
 const loaded=[];for(let i=0;i<100;i++)loaded.push(pool.allocate());assert.equal(created,100);assert.equal(pool.availableUnusedCount,0);
 const extra=pool.allocate();assert.equal(created,101);assert.equal(extra.serial,101);assert.equal(loaded.includes(extra),false);
 assert.equal(notifications,101);assert.equal(pool.usingCount,101);assert.equal(pool.allLoadedCount,101);
});

test('null constructors are skipped during preload and a null allocation returns without notification',()=>{
 let created=0;const pool=fearProjectileDefaultBuffPool({createBuff:()=>{created++;return null;},onAllocate:()=>{throw Error('null allocation');},onRecycle:()=>{}});
 assert.equal(created,100);assert.equal(pool.allLoadedCount,0);assert.equal(pool.allocate(),null);assert.equal(created,101);assert.equal(pool.usingCount,0);
});

test('preload construction failure does not send allocation notifications',()=>{
 let created=0,allocated=0;
 assert.throws(()=>fearProjectileDefaultBuffPool({createBuff:()=>{if(++created===3)throw Error('construct');return{};},onAllocate:()=>allocated++,onRecycle:()=>{}}),/construct/);
 assert.equal(created,3);assert.equal(allocated,0);
});

test('allocation notification failure preserves popped-body membership and permits recycling it',()=>{
 let failed,throws=true;const counter={value:0},identity=fearProjectileBuffIdentity({counter});
 const pool=fearProjectileDefaultBuffPool({createBuff:()=>({instanceUid:0,m_isValid:false}),onAllocate:buff=>{
  if(throws){failed=buff;throw Error('allocate notification');}identity.allocate(buff);
 },onRecycle:identity.recycle});
 assert.throws(()=>pool.allocate(),/allocate notification/);assert.equal(pool.usingCount,1);assert.equal(pool.availableUnusedCount,99);
 assert.equal(pool.recycle(failed),true);throws=false;assert.equal(pool.allocate(),failed);assert.equal(failed.instanceUid,1);assert.equal(pool.allLoadedCount,100);
});

test('a duplicate factory result is not rejected when native HashSet.Add reports existing membership',()=>{
 const same={},pool=fearProjectileDefaultBuffPool({createBuff:()=>same,onAllocate:()=>{},onRecycle:()=>{}});
 assert.equal(pool.allocate(),same);assert.equal(pool.allocate(),same);assert.equal(pool.usingCount,1);assert.equal(pool.availableUnusedCount,98);
});

test('default allocation permits a nested allocation from the notification after the outer member is tracked',()=>{
 let pool,nested,first=true;
 pool=fearProjectileDefaultBuffPool({createBuff:()=>({}),onAllocate:()=>{if(first){first=false;assert.equal(pool.usingCount,1);nested=pool.allocate();}},onRecycle:()=>{}});
 const outer=pool.allocate();assert.notEqual(outer,nested);assert.equal(pool.usingCount,2);assert.equal(pool.availableUnusedCount,98);
});

test('default pool allocation, finish and native-frame recycling reuse a body with a fresh UID',()=>{
 const f=fixture(),counter={value:0},identity=fearProjectileBuffIdentity({counter}),p=fearProjectileBuffPointers({readUid:b=>b.instanceUid});let created=0,frame=10;
 const pool=fearProjectileDefaultBuffPool({createBuff:()=>{created++;return{instanceUid:0,m_isValid:false};},onAllocate:identity.allocate,onRecycle:identity.recycle}),
  queue=fearProjectileBuffRecycleQueue(f.b,{readFixedFrame:()=>frame,copyPointer:p.copy,isPointerValid:p.isValid,lockPointer:p.lock,recycleBuff:pool.recycle});
 const buff=pool.allocate(),old=p.capture(buff);assert.equal(buff.instanceUid,1);
 fearProjectileFinishAndRemoveBuff(f.b,{owner:f.source,buff,removeFromList:()=>true,readUid:b=>b.instanceUid,removeUidRegistration:()=>true,
  markFinish:()=>{},onFinish:()=>true,captureBuffPointer:p.capture,queueRecycleNextFrame:queue.enqueue}).run();
 queue.update();assert.equal(pool.usingCount,1);frame=11;queue.update();assert.equal(pool.usingCount,0);assert.equal(pool.availableUnusedCount,100);assert.equal(p.lock(old),null);
 assert.equal(pool.allocate(),buff);assert.equal(buff.instanceUid,2);assert.equal(p.lock(old),null);assert.equal(p.lock(p.capture(buff)),buff);assert.equal(created,100);queue.release();
});

test('buff recycle pool removes using membership and pushes the unused stack before notifying recycle',()=>{
 const buff={},usingBuffs=new Set([buff]),unusedBuffs=[];let calls=0,pool;
 pool=fearProjectileBuffRecyclePool({usingBuffs,unusedBuffs,onRecycle:value=>{
  assert.equal(value,buff);assert.equal(usingBuffs.has(buff),false);assert.deepEqual(unusedBuffs,[buff]);assert.equal(pool.recycle(buff),false);calls++;
 }});
 assert.equal(pool.recycle(buff),true);assert.equal(calls,1);assert.equal(pool.recycle(buff),false);assert.equal(calls,1);
});

test('buff recycle pool rejects null and foreign objects without changing either collection or calling the receiver',()=>{
 const tracked={},usingBuffs=new Set([tracked,null]),unusedBuffs=[],pool=fearProjectileBuffRecyclePool({usingBuffs,unusedBuffs,onRecycle:()=>{throw Error('foreign notification');}});
 assert.equal(pool.recycle(null),false);assert.equal(pool.recycle({}),false);assert.deepEqual([...usingBuffs],[tracked,null]);assert.deepEqual(unusedBuffs,[]);
});

test('recycle notification can recycle another tracked object in native stack order',()=>{
 const a={},b={},usingBuffs=new Set([a,b]),unusedBuffs=[],events=[];let pool;
 pool=fearProjectileBuffRecyclePool({usingBuffs,unusedBuffs,onRecycle:value=>{events.push(value);if(value===a)assert.equal(pool.recycle(b),true);}});
 assert.equal(pool.recycle(a),true);assert.deepEqual(events,[a,b]);assert.equal(usingBuffs.size,0);assert.equal(unusedBuffs.pop(),b);assert.equal(unusedBuffs.pop(),a);
});

test('recycle exceptions leave the using removal and unused push committed and block a duplicate notification',()=>{
 const buff={},usingBuffs=new Set([buff]),unusedBuffs=[];let calls=0;
 const pool=fearProjectileBuffRecyclePool({usingBuffs,unusedBuffs,onRecycle:()=>{calls++;throw Error('recycle notification');}});
 assert.throws(()=>pool.recycle(buff),/recycle notification/);assert.equal(usingBuffs.size,0);assert.deepEqual(unusedBuffs,[buff]);
 assert.equal(pool.recycle(buff),false);assert.equal(calls,1);
});

test('native-frame recycling composes pool membership and concrete UID invalidation for duplicate queued pointers',()=>{
 const f=fixture(),counter={value:0},identity=fearProjectileBuffIdentity({counter}),buff={instanceUid:0,m_isValid:false},p=fearProjectileBuffPointers({readUid:b=>b.instanceUid});
 identity.allocate(buff);const saved=p.capture(buff),usingBuffs=new Set([buff]),unusedBuffs=[];let notifications=0,frame=10;
 const pool=fearProjectileBuffRecyclePool({usingBuffs,unusedBuffs,onRecycle:b=>{identity.recycle(b);notifications++;}});
 const queue=fearProjectileBuffRecycleQueue(f.b,{readFixedFrame:()=>frame,copyPointer:p.copy,isPointerValid:p.isValid,lockPointer:p.lock,recycleBuff:pool.recycle});
 queue.enqueue(saved);queue.enqueue(saved);queue.update();assert.equal(notifications,0);frame=11;queue.update();
 assert.equal(notifications,1);assert.equal(usingBuffs.size,0);assert.deepEqual(unusedBuffs,[buff]);assert.equal(buff.instanceUid,0);assert.equal(buff.m_isValid,false);
 assert.equal(p.lock(saved),null);assert.equal(queue.pendingCount,0);queue.release();
});

test('queue passes a null Lock result to the concrete pool, whose native null gate returns false',()=>{
 const f=fixture(),unusedBuffs=[],usingBuffs=new Set(),pool=fearProjectileBuffRecyclePool({usingBuffs,unusedBuffs,onRecycle:()=>{throw Error('null recycled');}});let frame=10;
 const queue=fearProjectileBuffRecycleQueue(f.b,{readFixedFrame:()=>frame,copyPointer:x=>x,isPointerValid:()=>true,lockPointer:()=>null,recycleBuff:pool.recycle});
 queue.enqueue({});frame=11;queue.update();assert.deepEqual(unusedBuffs,[]);assert.equal(queue.pendingCount,0);queue.release();
});

test('buff allocation identity uses one supplied global UInt32 counter across adapters and recycled bodies',()=>{
 const counter={value:40},first=fearProjectileBuffIdentity({counter}),second=fearProjectileBuffIdentity({counter}),
  a={instanceUid:0,m_isValid:false},b={instanceUid:0,m_isValid:false};
 first.allocate(a);assert.deepEqual(a,{instanceUid:41,m_isValid:true});second.allocate(b);assert.equal(b.instanceUid,42);
 first.recycle(a);assert.deepEqual(a,{instanceUid:0,m_isValid:false});assert.equal(counter.value,42);
 second.allocate(a);assert.equal(a.instanceUid,43);assert.equal(a.m_isValid,true);assert.equal(counter.value,43);
});

test('native buff counter wrap does not silently skip UID zero',()=>{
 const counter={value:0xffffffff},identity=fearProjectileBuffIdentity({counter}),buff={instanceUid:7,m_isValid:true},p=fearProjectileBuffPointers({readUid:b=>b.instanceUid});
 identity.allocate(buff);assert.equal(counter.value,0);assert.deepEqual(buff,{instanceUid:0,m_isValid:true});assert.equal(p.isValid(p.capture(buff)),false);
 identity.allocate(buff);assert.equal(buff.instanceUid,1);assert.equal(p.lock(p.capture(buff)),buff);
});

test('recycle clears UID and native validity independently of finished/enabled state without advancing the counter',()=>{
 const counter={value:12},identity=fearProjectileBuffIdentity({counter}),buff={instanceUid:9,m_isValid:true,finished:false,isEnabled:true};
 identity.recycle(buff);assert.deepEqual(buff,{instanceUid:0,m_isValid:false,finished:false,isEnabled:true});assert.equal(counter.value,12);
 identity.recycle(buff);assert.equal(counter.value,12);assert.equal(buff.instanceUid,0);
});

test('recycled old pointers cannot lock a later allocation of the same buff body',()=>{
 const counter={value:0},identity=fearProjectileBuffIdentity({counter}),buff={instanceUid:0,m_isValid:false},p=fearProjectileBuffPointers({readUid:b=>b.instanceUid});
 identity.allocate(buff);const saved=p.capture(buff);assert.equal(p.lock(saved),buff);identity.recycle(buff);assert.equal(p.lock(saved),null);
 identity.allocate(buff);assert.equal(buff.instanceUid,2);assert.equal(p.lock(saved),null);assert.equal(p.lock(p.capture(buff)),buff);
});

test('buff identity requires mutable data fields and validates the shared counter before allocating',()=>{
 assert.throws(()=>fearProjectileBuffIdentity({counter:{value:-1}}),/UInt32/);
 const counter={value:7},identity=fearProjectileBuffIdentity({counter}),buff={instanceUid:0,m_isValid:false};
 assert.throws(()=>identity.allocate(Object.freeze({...buff})),/writable native data/);assert.equal(counter.value,7);
 counter.value=NaN;assert.throws(()=>identity.allocate(buff),/UInt32/);assert.deepEqual(buff,{instanceUid:0,m_isValid:false});
 identity.recycle(buff);assert.deepEqual(buff,{instanceUid:0,m_isValid:false},'OnRecycle does not read the static counter');
});

test('finish and native-frame queue use concrete buff recycle identity before the same body can be allocated again',()=>{
 const f=fixture(),counter={value:0},identity=fearProjectileBuffIdentity({counter}),buff={instanceUid:0,m_isValid:false},p=fearProjectileBuffPointers({readUid:b=>b.instanceUid});
 identity.allocate(buff);const old=p.capture(buff);let frame=10,recycled=0;
 const queue=fearProjectileBuffRecycleQueue(f.b,{readFixedFrame:()=>frame,copyPointer:p.copy,isPointerValid:p.isValid,lockPointer:p.lock,
  recycleBuff:b=>{assert.equal(b,buff);identity.recycle(b);recycled++;}});
 const finish=fearProjectileFinishAndRemoveBuff(f.b,{owner:f.source,buff,removeFromList:()=>true,readUid:b=>b.instanceUid,removeUidRegistration:()=>true,
  markFinish:()=>{},onFinish:()=>true,captureBuffPointer:p.capture,queueRecycleNextFrame:queue.enqueue});
 finish.run();queue.update();assert.equal(buff.instanceUid,1);assert.equal(buff.m_isValid,true);assert.equal(recycled,0);
 f.b.kill(f.source,null);frame=11;queue.update();assert.equal(recycled,1);assert.equal(buff.instanceUid,0);assert.equal(buff.m_isValid,false);assert.equal(p.lock(old),null);
 identity.allocate(buff);assert.equal(buff.instanceUid,2);assert.equal(p.lock(old),null);assert.equal(p.lock(p.capture(buff)),buff);queue.release();assert.deepEqual(f.b.errors,[]);
});

function pairAssignmentFixture(overrides={}){
 const entries=[],events=[];let active=true;
 const pairs=fearProjectileBuffBlackboardPairs({entries,compareIgnoreCase:(a,b,ignore)=>{events.push([a,b,ignore]);return a?.toLowerCase()===b?.toLowerCase()?0:1;},isActive:()=>active,...overrides});
 return{entries,events,pairs,set active(value){active=value;}};
}

test('ordinary pair assignment into an empty list preserves duplicates, key case and both value fields',()=>{
 const f=pairAssignmentFixture(),source=[{key:'UPPER',value:3,valueStr:'text'},{key:'UPPER',value:4,valueStr:null}];
 f.pairs.assign(source);assert.deepEqual(f.entries,source);assert.equal(f.events.length,0);
 assert.notEqual(f.entries[0],source[0]);source[0].value=9;assert.equal(f.entries[0].value,3);
});

test('ordinary pair assignment replaces first matches without lowering incoming keys or dropping secondary values',()=>{
 const f=pairAssignmentFixture();f.entries.push({key:'x',value:1,valueStr:null},{key:'X',value:2,valueStr:null});
 f.pairs.assign([{key:'X',value:7,valueStr:'both'},{key:'New',value:3,valueStr:''}]);
 assert.deepEqual(f.entries,[{key:'X',value:7,valueStr:'both'},{key:'X',value:2,valueStr:null},{key:'New',value:3,valueStr:''}]);
});

test('ContainsKey checks any pair including strings/null keys while numeric lookup remains separate',()=>{
 const f=pairAssignmentFixture();f.entries.push({key:'duration',value:0,valueStr:'text'},{key:null,value:1,valueStr:null});
 assert.equal(f.pairs.containsKey('DURATION'),true);assert.equal(f.pairs.containsKey(null),true);assert.equal(f.pairs.containsKey('absent'),false);
 f.pairs.clear();assert.deepEqual(f.entries,[]);assert.equal(f.pairs.containsKey(null),false);
});

test('ordinary assignment captures the incoming pair before destination comparison effects',()=>{
 const entries=[{key:'x',value:1,valueStr:null}],source=[{key:'x',value:7,valueStr:'before'}];
 const f=pairAssignmentFixture({entries,compareIgnoreCase:()=>{source[0].value=99;source[0].valueStr='after';return 0;}});
 f.pairs.assign(source);assert.deepEqual(entries,[{key:'x',value:7,valueStr:'before'}]);
});

test('pair assignment/lookup/clear share a guard before lifecycle and comparison callbacks',()=>{
 let f;f=pairAssignmentFixture({isActive:()=>{assert.equal(f.pairs.containsKey('nested'),null);return true;}});
 f.pairs.assign([{key:'x',value:1,valueStr:null}]);assert.equal(f.pairs.containsKey('x'),true);f.pairs.clear();assert.deepEqual(f.entries,[]);
});

test('pair assignment stops invalidated lives and preserves prior pairs when later comparison fails',()=>{
 let f;f=pairAssignmentFixture({compareIgnoreCase:()=>{f.active=false;return undefined;}});f.entries.push({key:'x',value:1,valueStr:null});
 assert.equal(f.pairs.assign([{key:'x',value:2,valueStr:null}]),null);assert.equal(f.entries[0].value,1);
 let fail=true;const g=pairAssignmentFixture({compareIgnoreCase:()=>{if(fail)throw Error('comparison');return 0;}});g.entries.push({key:'x',value:1,valueStr:null});
 assert.throws(()=>g.pairs.assign([{key:'x',value:2,valueStr:null}]),/comparison/);fail=false;g.pairs.assign([{key:'x',value:2,valueStr:null}]);assert.equal(g.entries[0].value,2);
});

test('ordinary Reset composition uses pair storage and numeric reads through heavy-enemy lifetime and trigger initialization',()=>{
 const entries=[],compareIgnoreCase=(a,b)=>a?.toLowerCase()===b?.toLowerCase()?0:1,pairs=fearProjectileBuffBlackboardPairs({entries,compareIgnoreCase,isActive:()=>true});
 const reads=fearProjectileBuffBlackboardReads({entries,compareIgnoreCase,isActive:()=>true});
 const buff={...resetBuffBody(),m_lifeTime:99n,m_remainingTime:98n,m_existingTime:97n,m_triggerCnt:99,m_triggerTimer:{m_periodTime:99n,m_remainingTime:98n}};
 const data={stripBlackboardParamsWithBuffKey:false,blackboard:[{key:'duration',value:5.5,valueStr:null},{key:'interval',value:0.25,valueStr:null},{key:'trig_cnt',value:2.8,valueStr:null}],
  lifeTimeType:1,lifeTime:3,triggerLifeType:1,triggerCnt:3,triggerInterval:1,waitFirstTriggerInterval:true,firstTriggerInterval:0.75};
 const reset=fearProjectileResetBuffBlackboard({first:[{key:'DURATION',value:9,valueStr:null}],second:null,readBlackboard:()=>entries,equals:(a,b)=>a===b,copyBlackboard:()=>{throw Error('unexpected alias');},
  resetLifecycle:()=>fearProjectileResetBuffLifecycle(buff),readDurationKey:()=>null,readData:()=>data,readBuffKey:()=> 'buff',clear:pairs.clear,assign:(_,source)=>pairs.assign(source),
  assignByPrefix:()=>{throw Error('prefix');},assignValueStrByPrefix:()=>{throw Error('prefix');},containsKey:(_,key)=>pairs.containsKey(key),tryGetFP:(_,key)=>reads.tryGetFP(key),assignFP:()=>{},isActive:()=>true});
 const {durationKey}=reset.run();
 const modifier=fearProjectileModifyBuffLifetime({buff,readOwner:()=>({mass:4}),isDestroyedOrNull:e=>e==null,asEnemy:e=>e,hasLevitate:()=>true,readMassLevel:e=>e.mass,isActive:()=>true});
 fearProjectileResetBuffLifetime({buff,durationKey,tryGetDuration:reads.tryGetFP,readData:()=>data,modifyLifeTimeFinally:modifier.run,isActive:()=>true}).run();
 fearProjectileResetBuffTriggers({buff,readData:()=>data,getFpOrDefault:reads.getFpOrDefault,getIntOrDefault:reads.getIntOrDefault,
  timer:fearProjectileBuffTimer(buff.m_triggerTimer),setTriggerable:value=>{buff.triggerable=value;},isActive:()=>true}).run();
 assert.equal(buff.m_isFinished,false);assert.equal(buff.m_remainingTime,11n<<30n);assert.equal(buff.m_existingTime,0n);
 assert.equal(buff.m_triggerCnt,2);assert.equal(buff.triggerable,true);assert.equal(buff.m_triggerTimer.m_remainingTime,1n<<30n);
});

test('native float-to-FP scalar conversion preserves float32 scaling and signed truncation',()=>{
 assert.equal(fearProjectileFloatToRaw(1.2),0x133333400n);assert.equal(fearProjectileFloatToRaw(-1.2),-0x133333400n);
 assert.equal(fearProjectileFloatToRaw(2**-32),1n);assert.equal(fearProjectileFloatToRaw(-(2**-32)),-1n);
 assert.equal(fearProjectileFloatToRaw(2**-33),0n);assert.equal(fearProjectileFloatToRaw(-(2**-33)),0n);
 assert.equal(fearProjectileFloatToRaw(-0),0n);assert.equal(fearProjectileFloatToRaw(2147483520),9223371487098961920n);
});

test('native float-to-FP conversion uses signed64 indefinite for NaN and overflowing float results',()=>{
 for(const value of [NaN,Infinity,-Infinity,2**31,Number.MAX_VALUE])assert.equal(fearProjectileFloatToRaw(value),-(1n<<63n));
 assert.equal(fearProjectileFloatToRaw(-(2**31)),-(1n<<63n));
});

test('native Int32 conversion floors the stored float rather than truncating or rounding fractions',()=>{
 for(const[value,expected]of [[1.5,1],[-1.5,-2],[0.5,0],[-0.5,-1],[2.9,2],[-2.1,-3],[-0,0],[-1.00000001,-1]])
  assert.equal(fearProjectileFloorToInt(value),expected,String(value));
 assert.equal(Object.is(fearProjectileFloorToInt(-0),-0),false);
});

test('native Int32 conversion handles float32 range boundaries and indefinite results',()=>{
 assert.equal(fearProjectileFloorToInt(2147483520),2147483520);
 for(const value of [2147483647,2**31,-2147483904,Infinity,-Infinity,NaN])assert.equal(fearProjectileFloorToInt(value),-(2**31));
});

test('default blackboard numeric conversions feed Reset without conversion stand-ins',()=>{
 const entries=[{key:'duration',value:1.5,valueStr:null},{key:'trig_cnt',value:-0.5,valueStr:null}],compareIgnoreCase=(a,b)=>a===b?0:1;
 const reads=fearProjectileBuffBlackboardReads({entries,compareIgnoreCase,isActive:()=>true});
 assert.deepEqual(reads.tryGetFP('duration'),{found:true,valueRaw:3n<<31n});assert.equal(reads.getIntOrDefault('trig_cnt',99),-1);
 const buff={m_lifeTime:99n,m_remainingTime:98n,m_existingTime:97n};
 fearProjectileResetBuffLifetime({buff,durationKey:'duration',tryGetDuration:reads.tryGetFP,readData:()=>({lifeTimeType:1}),modifyLifeTimeFinally:()=>{},isActive:()=>true}).run();
 assert.equal(buff.m_remainingTime,3n<<31n);
 const target={m_triggerCnt:99},timerState={m_periodTime:99n,m_remainingTime:98n};
 fearProjectileResetBuffTriggers({buff:target,readData:()=>({triggerLifeType:1,triggerCnt:2,triggerInterval:0.25,waitFirstTriggerInterval:true,firstTriggerInterval:0}),
  getFpOrDefault:reads.getFpOrDefault,getIntOrDefault:reads.getIntOrDefault,timer:fearProjectileBuffTimer(timerState),setTriggerable:()=>{},isActive:()=>true}).run();
 assert.equal(target.m_triggerCnt,-1);assert.equal(timerState.m_periodTime,1n<<30n);
});

function blackboardReadsFixture(overrides={}){
 const entries=[],events=[];let active=true;
 const readers=fearProjectileBuffBlackboardReads({entries,compareIgnoreCase:(a,b,ignore)=>{events.push(['compare',a,b,ignore]);return a?.toLowerCase()===b.toLowerCase()?0:1;},
  floatToRaw:n=>{events.push(['fp',n]);return fearProjectileFloatToRaw(n);},floorToInt:n=>{events.push(['floor',n]);return fearProjectileFloorToInt(n);},isActive:()=>active,...overrides});
 return{entries,events,readers,set active(value){active=value;}};
}

test('blackboard numeric lookup skips nonnumeric duplicates but accepts empty string values',()=>{
 const f=blackboardReadsFixture();f.entries.push({key:'count',value:0,valueStr:'text'},{key:'COUNT',value:3,valueStr:''},{key:'count',value:4,valueStr:null});
 assert.deepEqual(f.readers.tryGetNumber('Count'),{found:true,value:3});assert.deepEqual(f.readers.tryGetFP('count'),{found:true,valueRaw:3n<<32n});
});

test('missing/null/empty numeric keys return zero out values and FP conversion still runs',()=>{
 const f=blackboardReadsFixture();for(const key of [null,'','missing']){
  assert.deepEqual(f.readers.tryGetNumber(key),{found:false,value:0});assert.deepEqual(f.readers.tryGetFP(key),{found:false,valueRaw:0n});
  assert.deepEqual(f.readers.tryGetInt(key),{found:false,value:0});
 }
 assert.equal(f.events.filter(e=>e[0]==='fp').length,3);assert.equal(f.events.some(e=>e[0]==='floor'),false);
});

test('default getters preserve their supplied fallback and selected default branch ignores the hotfix-only bool',()=>{
 const f=blackboardReadsFixture();for(const flag of [true,false]){
  assert.equal(f.readers.getFpOrDefault('absent',77n,flag),77n);assert.equal(f.readers.getIntOrDefault('absent',9,flag),9);
 }
 f.entries.push({key:'x',value:2,valueStr:null});assert.equal(f.readers.getFpOrDefault('x',77n,true),2n<<32n);
 assert.equal(f.readers.getIntOrDefault('x',9,true),2);
});

test('numeric lookup rereads the value after the numeric predicate instead of keeping the first DataPair snapshot',()=>{
 let reads=0;const entries=[];Object.defineProperty(entries,0,{get(){reads++;return{key:'x',value:reads===3?7:1,valueStr:reads===3?'later string':null};}});
 const f=blackboardReadsFixture({entries});assert.deepEqual(f.readers.tryGetNumber('x'),{found:true,value:7});assert.equal(reads,3);
});

test('Int32 getter delegates floor conversion of the stored float32 to the instrumented receiver',()=>{
 let seen;const f=blackboardReadsFixture({floorToInt:value=>{seen=value;return 7;}});f.entries.push({key:'x',value:6.7,valueStr:null});
 assert.deepEqual(f.readers.tryGetInt('x'),{found:true,value:7});assert.equal(seen,Math.fround(6.7));
});

test('numeric getters stop before conversion when comparison invalidates the life',()=>{
 let f;f=blackboardReadsFixture({compareIgnoreCase:()=>{f.active=false;return undefined;}});f.entries.push({key:'x',value:1,valueStr:null});
 assert.equal(f.readers.tryGetFP('x'),null);assert.equal(f.events.some(e=>e[0]==='fp'),false);
});

test('numeric getters share a recursion guard and preserve conversion exception ordering before fallback',()=>{
 let f,fail=true;f=blackboardReadsFixture({floatToRaw:()=>{assert.equal(f.readers.tryGetInt('x'),null);if(fail)throw Error('convert');return 0n;}});
 assert.throws(()=>f.readers.getFpOrDefault('absent',99n),/convert/);fail=false;assert.equal(f.readers.getFpOrDefault('absent',99n),99n);
});

test('concrete writes and numeric reads supply duration and trigger Reset without Map-backed getter stand-ins',()=>{
 const entries=[],writes=blackboardWritesFixture({entries}),reads=blackboardReadsFixture({entries});
 writes.writes.assignNumeric('duration',3);writes.writes.assignNumeric('interval',0.5);writes.writes.assignNumeric('trig_cnt',2);
 const f=lifetimeResetFixture();fearProjectileResetBuffLifetime({buff:f.buff,durationKey:'duration',tryGetDuration:reads.readers.tryGetFP,
  readData:()=>f.data,floatToRaw:()=>{throw Error('fallback');},modifyLifeTimeFinally:()=>{},isActive:()=>true}).run();assert.equal(f.buff.m_remainingTime,3n<<32n);
 const t=triggerResetFixture({getFpOrDefault:reads.readers.getFpOrDefault,getIntOrDefault:reads.readers.getIntOrDefault});t.reset.run();
 assert.equal(t.state.m_periodTime,1n<<31n);assert.equal(t.buff.m_triggerCnt,2);
});

function blackboardWritesFixture(overrides={}){
 const entries=[],events=[];let active=true;
 const callers={entries,toLower:key=>{events.push(['lower',key]);return key.toLowerCase();},
  compareIgnoreCase:(a,b,ignore)=>{events.push(['compare',a,b,ignore]);return a?.toLowerCase()===b.toLowerCase()?0:1;},isActive:()=>active,...overrides};
 const writes=fearProjectileBuffBlackboardWrites(callers);return{entries,events,writes,set active(value){active=value;}};
}

test('blackboard numeric/string writes replace whole pairs at the first matching index',()=>{
 const f=blackboardWritesFixture();f.writes.assignString('ATK','old');f.writes.assignNumeric('atk',1.2);
 assert.deepEqual(f.entries,[{key:'atk',value:Math.fround(1.2),valueStr:null}]);
 f.writes.assignString('Atk','new');assert.deepEqual(f.entries,[{key:'atk',value:0,valueStr:'new'}]);
});

test('blackboard writes preserve ordering and leave later duplicate keys untouched',()=>{
 const f=blackboardWritesFixture();f.entries.push({key:'first',value:1,valueStr:null},{key:'ATK',value:2,valueStr:null},{key:'atk',value:3,valueStr:null});
 f.writes.assignNumeric('Atk',4);assert.deepEqual(f.entries.map(e=>[e.key,e.value]),[['first',1],['atk',4],['atk',3]]);
 f.writes.assignNumeric('last',5);assert.equal(f.entries.at(-1).key,'last');
});

test('blackboard writes construct the lowered key but compare the original input using the native receiver',()=>{
 const entries=[{key:'existing',value:1,valueStr:null}],events=[];
 const f=blackboardWritesFixture({entries,toLower:key=>{events.push(['lower',key]);return'normalized';},
  compareIgnoreCase:(old,key,ignore)=>{events.push(['compare',old,key,ignore]);return 0;}});
 f.writes.assignString('ORIGINAL','value');assert.deepEqual(events,[['lower','ORIGINAL'],['compare','existing','ORIGINAL',true]]);
 assert.deepEqual(entries,[{key:'normalized',value:0,valueStr:'value'}]);
});

test('blackboard nullable/empty string values clear numeric storage independently of string-value predicate',()=>{
 const f=blackboardWritesFixture();f.writes.assignString('',null);f.writes.assignString('empty','');
 assert.deepEqual(f.entries,[{key:'',value:0,valueStr:null},{key:'empty',value:0,valueStr:''}]);
});

test('blackboard writes observe live list changes during comparison and reject a removed replacement slot',()=>{
 const entries=[{key:'a',value:1,valueStr:null}];let changed=false;
 const f=blackboardWritesFixture({entries,compareIgnoreCase:()=>{if(!changed){changed=true;entries.push({key:'b',value:2,valueStr:null});return 1;}return 0;}});
 f.writes.assignNumeric('new',3);assert.deepEqual(entries.map(e=>e.key),['a','new']);
 const g=blackboardWritesFixture({entries,compareIgnoreCase:()=>{entries.length=0;return 0;}});
 assert.throws(()=>g.writes.assignNumeric('new',4),/replacement index/);assert.deepEqual(entries,[]);
});

test('blackboard writes cancel after casing/comparison life invalidation without changing stored pairs',()=>{
 let f;f=blackboardWritesFixture({toLower:()=>{f.active=false;return undefined;}});assert.equal(f.writes.assignNumeric('x',1),null);assert.deepEqual(f.entries,[]);
 let g;g=blackboardWritesFixture({compareIgnoreCase:()=>{g.active=false;return undefined;}});g.entries.push({key:'x',value:2,valueStr:null});
 assert.equal(g.writes.assignString('x','replacement'),null);assert.equal(g.entries[0].value,2);
});

test('blackboard numeric/string writes share a reentry guard and recover after comparison errors',()=>{
 let f,fail=true;f=blackboardWritesFixture({compareIgnoreCase:()=>{
  assert.equal(f.writes.assignString('nested','x'),null);if(fail)throw Error('compare');return 0;
 }});f.entries.push({key:'x',value:1,valueStr:null});assert.throws(()=>f.writes.assignNumeric('x',2),/compare/);
 fail=false;f.writes.assignNumeric('x',3);assert.equal(f.entries[0].value,3);
});

test('prefix traversal and native pair writes compose without merging numeric and string fields',()=>{
 const f=blackboardWritesFixture(),prefix=fearProjectileBuffPrefixAssignments({startsWith:(k,p)=>k.startsWith(p),
  assignNumeric:f.writes.assignNumeric,assignString:f.writes.assignString,isActive:()=>true});
 const source=[{key:'buff.Label',value:7,valueStr:'name'},{key:'buff.atk',value:1.2,valueStr:null}];
 prefix.assignByPrefix(source,'buff.');prefix.assignValueStrByPrefix(source,'buff.');
 assert.deepEqual(f.entries,[{key:'label',value:0,valueStr:'name'},{key:'atk',value:Math.fround(1.2),valueStr:null}]);
});

function prefixAssignmentFixture(overrides={}){
 const events=[];let active=true;
 const callers={startsWith:(key,prefix,comparison)=>{events.push(['compare',comparison]);return key.startsWith(prefix);},
  assignNumeric:(key,value)=>events.push(['number',key,value]),assignString:(key,value)=>events.push(['string',key,value]),isActive:()=>active,...overrides};
 const operations=fearProjectileBuffPrefixAssignments(callers);return{events,operations,set active(value){active=value;}};
}

test('prefix assignment preserves numeric/string separation, strips keys and skips missing string values',()=>{
 const f=prefixAssignmentFixture(),source=[{key:'buff.atk',value:1.2,valueStr:null},{key:'other.atk',value:9,valueStr:'skip'},
  {key:'buff.label',value:0,valueStr:'name'},{key:'buff.empty',value:2,valueStr:''},{key:'buff.space',value:3,valueStr:' '}];
 f.operations.assignByPrefix(source,'buff.');f.operations.assignValueStrByPrefix(source,'buff.');
 assert.deepEqual(f.events.filter(e=>e[0]==='number'),[['number','atk',Math.fround(1.2)],['number','label',0],['number','empty',2],['number','space',3]]);
 assert.deepEqual(f.events.filter(e=>e[0]==='string'),[['string','label','name'],['string','space',' ']]);
 assert.ok(f.events.filter(e=>e[0]==='compare').every(e=>e[1]===5));
});

test('prefix traversal delegates comparison instead of replacing native OrdinalIgnoreCase with a JS fold',()=>{
 const f=prefixAssignmentFixture({startsWith:(key,prefix,comparison)=>{assert.equal(comparison,5);assert.equal(key,'BUFF.atk');assert.equal(prefix,'buff.');return true;}});
 f.operations.assignByPrefix([{key:'BUFF.atk',value:2,valueStr:null}],'buff.');assert.deepEqual(f.events,[['number','atk',2]]);
});

test('prefix numeric read retains the first key and rereads value after comparison effects',()=>{
 const source=[{key:'buff.old',value:1}];const f=prefixAssignmentFixture({startsWith:()=>{source[0]={key:'changed',value:7};return true;}});
 f.operations.assignByPrefix(source,'buff.');assert.deepEqual(f.events,[['number','old',7]]);
});

test('prefix string traversal rereads the value after its separate nonempty-string probe',()=>{
 let reads=0;const source=[];Object.defineProperty(source,0,{configurable:true,get(){reads++;return{key:'buff.name',value:0,valueStr:reads<3?'probe':null};}});
 const f=prefixAssignmentFixture();f.operations.assignValueStrByPrefix(source,'buff.');
 assert.equal(reads,3);assert.deepEqual(f.events.at(-1),['string','name',null]);
});

test('prefix traversal reads live list count and does not snapshot appended or removed entries',()=>{
 const source=[{key:'buff.a',value:1}];const events=[];const f=prefixAssignmentFixture({assignNumeric:(key,value)=>{
  events.push([key,value]);if(key==='a')source.push({key:'buff.b',value:2});
 }});f.operations.assignByPrefix(source,'buff.');assert.deepEqual(events,[['a',1],['b',2]]);
 const g=prefixAssignmentFixture({assignNumeric:()=>{source.length=0;}});g.operations.assignByPrefix(source,'buff.');assert.equal(source.length,0);
});

test('prefix traversal treats null source as empty and keeps native float nonfinite values',()=>{
 const f=prefixAssignmentFixture();f.operations.assignByPrefix(null,null);f.operations.assignValueStrByPrefix([],null);
 f.operations.assignByPrefix([{key:'buff.nan',value:NaN},{key:'buff.inf',value:Infinity}],'buff.');
 const values=f.events.filter(e=>e[0]==='number');assert.ok(Number.isNaN(values[0][2]));assert.equal(values[1][2],Infinity);
});

test('prefix operations share a reentry guard and can retry after a destination exception',()=>{
 let f,fail=true;f=prefixAssignmentFixture({assignNumeric:()=>{
  assert.equal(f.operations.assignValueStrByPrefix([],''),null);if(fail)throw Error('write');
 }});const source=[{key:'buff.a',value:1}];assert.throws(()=>f.operations.assignByPrefix(source,'buff.'),/write/);
 fail=false;assert.equal(f.operations.assignByPrefix(source,'buff.'),undefined);
});

test('prefix traversal stops after comparison invalidates its life before any write',()=>{
 let f;f=prefixAssignmentFixture({startsWith:()=>{f.active=false;return undefined;}});
 assert.equal(f.operations.assignByPrefix([{key:'buff.a',value:1}],'buff.'),null);assert.deepEqual(f.events,[]);
});

test('Reset prefix composition invokes both concrete traversals with native numeric and string write receivers',()=>{
 const destination=new Map(),source=[{key:'buff.duration',value:3,valueStr:null},{key:'buff.label',value:0,valueStr:'name'}];
 const prefixes=fearProjectileBuffPrefixAssignments({startsWith:(key,prefix)=>key.startsWith(prefix),
  assignNumeric:(key,value)=>destination.set(key,value),assignString:(key,value)=>destination.set(key,value),isActive:()=>true});
 const reset=fearProjectileResetBuffBlackboard({first:source,second:null,readBlackboard:()=>destination,equals:()=>false,copyBlackboard:()=>{throw Error('copy');},
  resetLifecycle:()=>{},readDurationKey:()=>null,readData:()=>({stripBlackboardParamsWithBuffKey:true,blackboard:[]}),readBuffKey:()=> 'buff',clear:t=>t.clear(),
  assign:()=>{},assignByPrefix:(_,s,p)=>prefixes.assignByPrefix(s,p),assignValueStrByPrefix:(_,s,p)=>prefixes.assignValueStrByPrefix(s,p),
  containsKey:(t,k)=>t.has(k),tryGetFP:()=>{throw Error('fallback');},assignFP:()=>{throw Error('assign FP');},isActive:()=>true});
 assert.deepEqual(reset.run(),{durationKey:'duration'});assert.equal(destination.get('duration'),3);assert.equal(destination.get('label'),'name');
});

function blackboardResetFixture(overrides={}){
 const destination=new Map([['stale',99n]]),first=new Map([['duration',3n],['a',1n]]),second=new Map([['duration',4n],['b',2n]]),events=[];
 const data={stripBlackboardParamsWithBuffKey:false,blackboard:new Map([['data',5n]])};let active=true;
 const callers={first,second,readBlackboard:()=>destination,equals:(a,b)=>a===b,copyBlackboard:a=>{events.push('copy');return new Map(a);},
  resetLifecycle:()=>events.push('lifecycle'),readDurationKey:()=>null,readData:()=>data,readBuffKey:()=> 'buff',
  clear:t=>{events.push('clear');t.clear();},assign:(t,input)=>{events.push('assign');if(input)for(const[k,v]of input)t.set(k,v);},
  assignByPrefix:(t,input,prefix)=>events.push(['prefix',input,prefix]),assignValueStrByPrefix:(t,input,prefix)=>events.push(['value-prefix',input,prefix]),
  containsKey:(t,key)=>t.has(key),tryGetFP:(t,key)=>({found:t.has(key),valueRaw:t.get(key)??0n}),
  assignFP:(t,key,value)=>{events.push(['duration',key,value]);t.set(key,value);},isActive:()=>active,...overrides};
 const reset=fearProjectileResetBuffBlackboard(callers);return{destination,first,second,data,events,reset,set active(value){active=value;}};
}

test('blackboard Reset clears stale contents and assigns first, second, then data before returning captured duration key',()=>{
 const f=blackboardResetFixture();assert.deepEqual(f.reset.run(),{durationKey:'duration'});
 assert.deepEqual([...f.destination],[['duration',4n],['a',1n],['b',2n],['data',5n]]);
 assert.deepEqual(f.events,['lifecycle','clear','assign','assign','assign']);
});

test('blackboard Reset copies aliasing input before lifecycle cleanup and destination clear',()=>{
 const destination=new Map([['kept',7n]]),events=[];
 const f=blackboardResetFixture({first:destination,second:null,readBlackboard:()=>destination,copyBlackboard:a=>{events.push('copy');return new Map(a);},resetLifecycle:()=>events.push('lifecycle')});
 f.reset.run();assert.deepEqual(events,['copy','lifecycle']);assert.equal(destination.get('kept'),7n);
});

test('blackboard alias protection uses the supplied native virtual equality result',()=>{
 let copies=0;const f=blackboardResetFixture({equals:()=>true,copyBlackboard:a=>{copies++;return new Map(a);}});
 f.reset.run();assert.equal(copies,2);
});

test('prefix Reset assigns numeric and string-value prefixes for each input before data and duration fallback',()=>{
 const f=blackboardResetFixture();f.data.stripBlackboardParamsWithBuffKey=true;f.reset.run();
 assert.deepEqual(f.events.slice(0,7),['lifecycle','clear',['prefix',f.first,'buff.'],['value-prefix',f.first,'buff.'],
  ['prefix',f.second,'buff.'],['value-prefix',f.second,'buff.'],'assign']);
 assert.deepEqual(f.events.at(-1),['duration','duration',4n]);assert.equal(f.destination.get('duration'),4n);
});

test('prefix Reset keeps a data-provided duration without probing unprefixed inputs',()=>{
 const f=blackboardResetFixture({tryGetFP:()=>{throw Error('unexpected duration lookup');}});f.data.stripBlackboardParamsWithBuffKey=true;
 f.data.blackboard.set('duration',9n);f.reset.run();assert.equal(f.destination.get('duration'),9n);
});

test('prefix duration fallback preserves both native out writes even when second lookup fails',()=>{
 const f=blackboardResetFixture();f.data.stripBlackboardParamsWithBuffKey=true;f.second.delete('duration');f.reset.run();
 assert.equal(f.destination.get('duration'),0n,'the failed second lookup overwrites the out value while the combined found result remains true');
});

test('prefix duration fallback does not assign when neither lookup succeeds',()=>{
 const f=blackboardResetFixture();f.data.stripBlackboardParamsWithBuffKey=true;f.first.delete('duration');f.second.delete('duration');f.reset.run();
 assert.equal(f.destination.has('duration'),false);assert.equal(f.events.some(e=>Array.isArray(e)&&e[0]==='duration'),false);
});

test('prefix key is sampled twice and the duration key is captured before merge effects',()=>{
 let calls=0;const f=blackboardResetFixture({readBuffKey:()=>++calls===1?'first':'second',readDurationKey:()=> 'chosen'});
 f.data.stripBlackboardParamsWithBuffKey=true;const result=f.reset.run();assert.deepEqual(result,{durationKey:'chosen'});
 assert.equal(f.events[2][2],'second.');assert.equal(calls,2);
});

test('empty prefix key uses the ordinary assignment branch without duration rescue',()=>{
 const f=blackboardResetFixture({readBuffKey:()=>'',tryGetFP:()=>{throw Error('unexpected fallback');}});f.data.stripBlackboardParamsWithBuffKey=true;
 f.reset.run();assert.equal(f.destination.get('duration'),4n);assert.deepEqual(f.events,['lifecycle','clear','assign','assign','assign']);
});

test('blackboard assignment failures preserve completed mutations and allow a subsequent Reset',()=>{
 let fail=true;const f=blackboardResetFixture({assign:(t,input)=>{if(fail)throw Error('assign failure');for(const[k,v]of input)t.set(k,v);}});
 assert.throws(()=>f.reset.run(),/assign failure/);assert.equal(f.destination.size,0);fail=false;f.reset.run();assert.equal(f.destination.get('duration'),4n);
});

for(const point of ['readBlackboard','equals','resetLifecycle','readDurationKey','readData','clear','assign'])test('blackboard Reset stops when life invalidates during '+point,()=>{
 let f;f=blackboardResetFixture({[point]:()=>{f.active=false;return undefined;}});assert.equal(f.reset.run(),null);assert.equal(f.reset.run(),null);
});

test('blackboard Reset rejects recursive processing during a native assignment',()=>{
 let f;f=blackboardResetFixture({assign:()=>assert.equal(f.reset.run(),null)});assert.deepEqual(f.reset.run(),{durationKey:'duration'});
});

test('pooled Reset composition carries alias-safe blackboard duration and trigger values through lifecycle initialization',()=>{
 const one=1n<<32n,identity=fearProjectileBuffIdentity({counter:{value:0}});
 const pool=fearProjectileDefaultBuffPool({createBuff:()=>({...resetBuffBody(),m_lifeTime:99n,m_remainingTime:98n,m_existingTime:97n,m_triggerCnt:99,
  m_triggerTimer:{m_periodTime:99n,m_remainingTime:98n}}),onAllocate:identity.allocate,onRecycle:identity.recycle});
 const buff=pool.allocate(),destination=new Map([['duration',10n*one],['interval',one/2n],['trig_cnt',2]]);
 const bb=blackboardResetFixture({first:destination,second:null,readBlackboard:()=>destination,resetLifecycle:()=>fearProjectileResetBuffLifecycle(buff)});
 const {durationKey}=bb.reset.run();assert.equal(buff.m_isFinished,false);assert.equal(buff.instanceUid,1);
 const data={lifeTime:3,lifeTimeType:1,triggerLifeType:1,triggerCnt:3,triggerInterval:2,waitFirstTriggerInterval:true,firstTriggerInterval:0};
 const modifier=fearProjectileModifyBuffLifetime({buff,readOwner:()=>null,isDestroyedOrNull:e=>e==null,asEnemy:e=>e,hasLevitate:()=>false,readMassLevel:()=>0,isActive:()=>true});
 const lifetime=fearProjectileResetBuffLifetime({buff,durationKey,tryGetDuration:key=>({found:destination.has(key),valueRaw:destination.get(key)??0n}),
  readData:()=>data,floatToRaw:n=>BigInt(n)*one,modifyLifeTimeFinally:modifier.run,isActive:()=>true});
 lifetime.run();
 fearProjectileResetBuffTriggers({buff,readData:()=>data,floatToRaw:n=>BigInt(n)*one,timer:fearProjectileBuffTimer(buff.m_triggerTimer),
  getFpOrDefault:(key,fallback)=>destination.get(key)??fallback,getIntOrDefault:(key,fallback)=>destination.get(key)??fallback,
  setTriggerable:value=>{buff.triggerable=value;},isActive:()=>true}).run();
 assert.equal(buff.m_lifeTime,10n*one);assert.equal(buff.m_remainingTime,10n*one);assert.equal(buff.m_existingTime,0n);
 assert.equal(buff.m_triggerCnt,2);assert.equal(buff.triggerable,true);assert.equal(buff.m_triggerTimer.m_periodTime,one/2n);
 assert.equal(buff.m_triggerTimer.m_remainingTime,one/2n);assert.equal(buff.instanceUid,1);assert.equal(buff.m_isValid,true);
});

function lifetimeModifierFixture(overrides={}){
 const buff={m_lifeTime:3n},enemy={mass:4},events=[];let active=true;
 const callers={buff,readOwner:()=>{events.push('owner');return enemy;},isDestroyedOrNull:e=>{events.push('validity');return e==null;},
  asEnemy:e=>{events.push('cast');return e;},hasLevitate:()=>{events.push('levitate');return true;},
  readMassLevel:e=>{events.push('mass');return e.mass;},isActive:()=>active,...overrides};
 const modifier=fearProjectileModifyBuffLifetime(callers);return{buff,enemy,events,modifier,set active(value){active=value;}};
}

test('heavy-enemy levitation modifier uses native rounded fixed-point division after repeated owner reads',()=>{
 const f=lifetimeModifierFixture();f.modifier.run();assert.equal(f.buff.m_lifeTime,2n);
 assert.deepEqual(f.events,['owner','validity','owner','cast','validity','levitate','mass']);
 f.buff.m_lifeTime=-3n;f.modifier.run();assert.equal(f.buff.m_lifeTime,-2n);
});

test('levitation mass threshold is strict and unrelated buffs preserve their lifetime',()=>{
 for(const mass of [0,3,4]){
  const f=lifetimeModifierFixture();f.enemy.mass=mass;f.buff.m_lifeTime=10n<<32n;f.modifier.run();assert.equal(f.buff.m_lifeTime,(mass>3?5n:10n)<<32n);
 }
 const f=lifetimeModifierFixture({hasLevitate:()=>false});f.modifier.run();assert.equal(f.buff.m_lifeTime,3n);assert.equal(f.events.includes('mass'),false);
});

test('modifier short circuits absent initial owner and non-enemy second owner',()=>{
 const f=lifetimeModifierFixture({readOwner:()=>null});f.modifier.run();assert.deepEqual(f.events,['validity']);
 const g=lifetimeModifierFixture({asEnemy:()=>null});g.modifier.run();assert.equal(g.events.includes('levitate'),false);assert.equal(g.buff.m_lifeTime,3n);
});

test('modifier type check uses the second owner instead of the validity-probed first owner',()=>{
 let f,reads=0;const second={mass:3};f=lifetimeModifierFixture({readOwner:()=>++reads===1?f.enemy:second});
 f.modifier.run();assert.equal(reads,2);assert.equal(f.buff.m_lifeTime,3n);
});

test('lifetime Reset copies the concrete heavy-enemy modifier result into remaining time',()=>{
 const f=lifetimeResetFixture();const modifier=fearProjectileModifyBuffLifetime({buff:f.buff,readOwner:()=>({mass:4}),isDestroyedOrNull:e=>e==null,
  asEnemy:e=>e,hasLevitate:()=>true,readMassLevel:e=>e.mass,isActive:()=>true});
 const reset=fearProjectileResetBuffLifetime({buff:f.buff,durationKey:'duration',tryGetDuration:()=>({found:true,valueRaw:10n<<32n}),readData:()=>f.data,
  floatToRaw:()=>{throw Error('fallback');},modifyLifeTimeFinally:modifier.run,isActive:()=>true});
 reset.run();assert.deepEqual(f.buff,{m_lifeTime:5n<<32n,m_remainingTime:5n<<32n,m_existingTime:0n});
});

test('modifier applies its native branch to negative lifetime sentinels without an invented exemption',()=>{
 const f=lifetimeModifierFixture();f.buff.m_lifeTime=-(1n<<32n);f.modifier.run();assert.equal(f.buff.m_lifeTime,-(1n<<31n));
});

for(const point of ['readOwner','isDestroyedOrNull','asEnemy','hasLevitate','readMassLevel'])test('lifetime modifier stops after life invalidation during '+point,()=>{
 let f;f=lifetimeModifierFixture({[point]:()=>{f.active=false;return undefined;}});assert.equal(f.modifier.run(),null);assert.equal(f.buff.m_lifeTime,3n);
});

test('lifetime modifier rejects recursive processing and allows a subsequent reset',()=>{
 let f;f=lifetimeModifierFixture({hasLevitate:()=>{assert.equal(f.modifier.run(),null);return true;}});
 f.modifier.run();assert.equal(f.buff.m_lifeTime,2n);f.modifier.run();assert.equal(f.buff.m_lifeTime,1n);
});

function lifetimeResetFixture(overrides={}){
 const events=[],buff={m_lifeTime:99n,m_remainingTime:98n,m_existingTime:97n},data={lifeTime:3,lifeTimeType:1};let active=true;
 const callers={buff,durationKey:'duration',tryGetDuration:key=>{events.push(['lookup',key]);return{found:false,valueRaw:0n};},
  readData:()=>data,floatToRaw:n=>BigInt(n)*(1n<<32n),modifyLifeTimeFinally:b=>events.push(['modify',b.m_lifeTime]),isActive:()=>active,...overrides};
 const reset=fearProjectileResetBuffLifetime(callers);return{events,buff,data,reset,set active(value){active=value;}};
}

test('duration key selection preserves custom/whitespace keys and falls back only for null or empty',()=>{
 for(const value of [null,undefined,''])assert.equal(fearProjectileBuffDurationKey(value),'duration');
 for(const value of ['custom',' '])assert.equal(fearProjectileBuffDurationKey(value),value);
 assert.throws(()=>fearProjectileBuffDurationKey(1),/native string/);
});

test('lifetime reset uses the captured key and fallback before copying the final modified lifetime',()=>{
 let f;f=lifetimeResetFixture({durationKey:'captured',modifyLifeTimeFinally:b=>{f.events.push(['modify',b.m_lifeTime]);b.m_lifeTime/=2n;}});
 f.reset.run();assert.deepEqual(f.events,[['lookup','captured'],['modify',3n<<32n]]);
 assert.deepEqual(f.buff,{m_lifeTime:3n<<31n,m_remainingTime:3n<<31n,m_existingTime:0n});
});

test('successful duration lookup skips fallback conversion and preserves signed raw precision',()=>{
 const value=(1n<<62n)+1n;const f=lifetimeResetFixture({tryGetDuration:()=>({found:true,valueRaw:value}),floatToRaw:()=>{throw Error('unexpected fallback');}});
 f.reset.run();assert.equal(f.buff.m_lifeTime,value);assert.equal(f.buff.m_remainingTime,value);assert.equal(f.buff.m_existingTime,0n);
});

test('lifetime type selection applies zero and negative-one-second sentinel before final modification',()=>{
 for(const[type,expected]of [[0,0n],[2,-(1n<<32n)],[1,3n<<32n],[3,3n<<32n]]){
  const f=lifetimeResetFixture();f.data.lifeTimeType=type;f.reset.run();
  assert.deepEqual(f.events.at(-1),['modify',expected]);assert.equal(f.buff.m_remainingTime,expected);
 }
});

test('negative finite lifetime remains negative rather than becoming an infinite or zero substitute',()=>{
 const f=lifetimeResetFixture({tryGetDuration:()=>({found:true,valueRaw:-1n})});f.reset.run();assert.equal(f.buff.m_remainingTime,-1n);
});

test('failed duration fallback retains the native out write and skips remaining/existing resets',()=>{
 const f=lifetimeResetFixture({tryGetDuration:()=>({found:false,valueRaw:5n}),floatToRaw:()=>{throw Error('convert');}});
 assert.throws(()=>f.reset.run(),/convert/);assert.deepEqual(f.buff,{m_lifeTime:5n,m_remainingTime:98n,m_existingTime:97n});
});

test('final lifetime modifier failure preserves its mutation and does not copy it to remaining time',()=>{
 const f=lifetimeResetFixture({modifyLifeTimeFinally:b=>{b.m_lifeTime=4n;throw Error('modify');}});
 assert.throws(()=>f.reset.run(),/modify/);assert.deepEqual(f.buff,{m_lifeTime:4n,m_remainingTime:98n,m_existingTime:97n});
});

test('lifetime type is read after fallback conversion effects and recursive reset is rejected',()=>{
 let f;f=lifetimeResetFixture({floatToRaw:()=>{assert.equal(f.reset.run(),null);f.data.lifeTimeType=2;return 3n<<32n;}});
 f.reset.run();assert.equal(f.buff.m_remainingTime,-(1n<<32n));
});

for(const point of ['tryGetDuration','readData','floatToRaw','modifyLifeTimeFinally'])test('lifetime reset stops after life invalidation in '+point,()=>{
 let f;f=lifetimeResetFixture({[point]:()=>{f.active=false;return undefined;}});assert.equal(f.reset.run(),null);
 assert.equal(f.buff.m_remainingTime,98n);assert.equal(f.buff.m_existingTime,97n);assert.equal(f.reset.run(),null);
});

function triggerResetFixture(overrides={}){
 const events=[],buff={m_triggerCnt:99},state={m_periodTime:99n,m_remainingTime:98n};
 const data={triggerLifeType:1,triggerCnt:3,triggerInterval:2,waitFirstTriggerInterval:true,firstTriggerInterval:0};
 const concrete=fearProjectileBuffTimer(state);let active=true;
 const callers={buff,readData:()=>data,floatToRaw:n=>BigInt(n)*(1n<<32n),
  getFpOrDefault:(key,value,strip)=>{events.push([key,value,strip]);return value;},
  getIntOrDefault:(key,value,strip)=>{events.push([key,value,strip]);return value;},
  timer:Object.fromEntries(['reset','markInvalid','setRemainingTime'].map(name=>[name,(...args)=>{events.push([name,...args]);concrete[name](...args);}])) ,
  setTriggerable:value=>events.push(['triggerable',value]),isActive:()=>active,...overrides};
 const reset=fearProjectileResetBuffTriggers(callers);return{events,buff,state,data,reset,callers,set active(value){active=value;}};
}

test('trigger reset initializes enabled count and interval with exact blackboard keys and lookup flags',()=>{
 const f=triggerResetFixture();f.reset.run();assert.equal(f.buff.m_triggerCnt,3);assert.deepEqual(f.state,{m_periodTime:2n<<32n,m_remainingTime:2n<<32n});
 assert.deepEqual(f.events,[['interval',2n<<32n,false],['trig_cnt',3,false],['reset',2n<<32n,true],
  ['first_trigger_interval',0n,false],['triggerable',true]]);
});

test('disabled trigger life invalidates the old timer without reading blackboard defaults',()=>{
 const f=triggerResetFixture();f.data.triggerLifeType=0;f.data.triggerCnt=NaN;f.reset.run();
 assert.equal(f.buff.m_triggerCnt,0);assert.deepEqual(f.events,[['markInvalid'],['triggerable',false]]);
 assert.deepEqual(f.state,{m_periodTime:-(1n<<32n),m_remainingTime:-(1n<<32n)});
});

test('byte-conditional trigger count preserves the native infinite sentinel and other nonzero cases',()=>{
 const f=triggerResetFixture();f.data.triggerLifeType=2;f.data.triggerCnt=NaN;f.reset.run();
 assert.equal(f.buff.m_triggerCnt,-1);assert.deepEqual(f.events.at(-1),['triggerable',false]);
 f.data.triggerLifeType=3;f.data.triggerCnt=7;f.reset.run();assert.equal(f.buff.m_triggerCnt,7);assert.deepEqual(f.events.at(-1),['triggerable',true]);
});

test('blackboard trigger overrides replace finite count and cap positive first delay through the concrete timer',()=>{
 const f=triggerResetFixture({getFpOrDefault:(key,value)=>key==='interval'?3n<<32n:key==='first_trigger_interval'?5n<<32n:value,getIntOrDefault:()=>0});
 f.reset.run();assert.equal(f.buff.m_triggerCnt,0);assert.deepEqual(f.state,{m_periodTime:3n<<32n,m_remainingTime:3n<<32n});
 assert.deepEqual(f.events.at(-1),['triggerable',false]);assert.ok(f.events.some(e=>e[0]==='setRemainingTime'&&e[1]===5n<<32n));
});

test('zero and negative first-delay overrides preserve the initial-wait selection',()=>{
 for(const wait of [true,false])for(const first of [0,-1]){
  const f=triggerResetFixture();f.data.waitFirstTriggerInterval=wait;f.data.firstTriggerInterval=first;f.reset.run();
  assert.equal(f.state.m_remainingTime,wait?2n<<32n:0n);assert.equal(f.events.some(e=>e[0]==='setRemainingTime'),false);
 }
});

test('trigger reset rereads data after lookup effects rather than snapshotting the entire configuration',()=>{
 let f;f=triggerResetFixture({getIntOrDefault:()=>{f.data.waitFirstTriggerInterval=false;return 5;}});
 f.reset.run();assert.equal(f.state.m_remainingTime,0n);assert.equal(f.buff.m_triggerCnt,5);
});

test('trigger reset exceptions leave earlier count assignment committed and allow another native reset',()=>{
 let fail=true;const f=triggerResetFixture({getFpOrDefault:(key,value)=>{if(fail)throw Error('lookup');return value;}});
 assert.throws(()=>f.reset.run(),/lookup/);assert.equal(f.buff.m_triggerCnt,3);assert.equal(f.events.length,0);
 fail=false;f.reset.run();assert.deepEqual(f.events.at(-1),['triggerable',true]);
});

for(const point of ['readData','floatToRaw','getFpOrDefault','getIntOrDefault','setTriggerable'])test('trigger reset cancels life invalidation during '+point,()=>{
 let f;f=triggerResetFixture({[point]:()=>{f.active=false;return undefined;}});assert.equal(f.reset.run(),null);
 assert.equal(f.events.some(e=>e[0]==='reset'),point==='setTriggerable');assert.equal(f.reset.run(),null);
});

test('trigger reset rejects recursion without repeating lookup or timer effects',()=>{
 let f;f=triggerResetFixture({getFpOrDefault:(key,value)=>{assert.equal(f.reset.run(),null);return value;}});
 f.reset.run();assert.equal(f.events.filter(e=>e[0]==='reset').length,1);
});

test('buff timer Reset replaces stale timing with either immediate or delayed first-trigger state',()=>{
 const state={m_periodTime:999n,m_remainingTime:-99n},timer=fearProjectileBuffTimer(state),period=(1n<<32n)+1n;
 timer.reset(period,true);assert.equal(state.m_periodTime,period);assert.equal(state.m_remainingTime,period);
 timer.reset(period,false);assert.equal(state.m_remainingTime,0n);assert.equal(state.m_periodTime,period);
 timer.reset(-1n,true);assert.equal(state.m_periodTime,0n);assert.equal(state.m_remainingTime,0n);
});

test('invalid buff timer uses negative one second for both fields and can be reset for reuse',()=>{
 const state={m_periodTime:0n,m_remainingTime:0n},timer=fearProjectileBuffTimer(state);timer.markInvalid();
 assert.deepEqual(state,{m_periodTime:-(1n<<32n),m_remainingTime:-(1n<<32n)});
 timer.reset(10n<<32n,true);assert.deepEqual(state,{m_periodTime:10n<<32n,m_remainingTime:10n<<32n});
});

test('buff timer first-delay override caps at the period but preserves negative and sub-tick values',()=>{
 const state={m_periodTime:0n,m_remainingTime:0n},timer=fearProjectileBuffTimer(state);timer.reset(3n<<32n,true);
 timer.setRemainingTime(5n<<32n);assert.equal(state.m_remainingTime,3n<<32n);
 timer.setRemainingTime(1n);assert.equal(state.m_remainingTime,1n);
 timer.setRemainingTime(-1n);assert.equal(state.m_remainingTime,-1n);
 timer.setRemainingTime(-(1n<<63n));assert.equal(state.m_remainingTime,-(1n<<63n));
 timer.markInvalid();timer.setRemainingTime(0n);assert.equal(state.m_remainingTime,-(1n<<32n));
});

test('buff timer preserves signed64 precision and rejects malformed raw values before mutation',()=>{
 const state={m_periodTime:0n,m_remainingTime:0n},timer=fearProjectileBuffTimer(state),max=(1n<<63n)-1n;
 timer.reset(max,true);timer.setRemainingTime(max-1n);assert.equal(state.m_remainingTime,max-1n);
 for(const value of [1,NaN,1n<<63n,-(1n<<63n)-1n]){
  assert.throws(()=>timer.reset(value,false),/Q32.32/);assert.throws(()=>timer.setRemainingTime(value),/Q32.32/);
 }
 assert.equal(state.m_periodTime,max);assert.equal(state.m_remainingTime,max-1n);
 assert.throws(()=>timer.reset(0n,1),/Boolean initial-wait/);assert.equal(state.m_periodTime,max);
});

test('pool reallocation resets lifecycle and its retained timer object without changing the new UID',()=>{
 const identity=fearProjectileBuffIdentity({counter:{value:0}});
 const pool=fearProjectileDefaultBuffPool({createBuff:()=>({...resetBuffBody(),m_triggerTimer:{m_periodTime:999n,m_remainingTime:888n}}),onAllocate:identity.allocate,onRecycle:identity.recycle});
 const buff=pool.allocate(),timerState=buff.m_triggerTimer,timer=fearProjectileBuffTimer(timerState);
 timer.markInvalid();pool.recycle(buff);assert.equal(pool.allocate(),buff);fearProjectileResetBuffLifecycle(buff);timer.reset(1n<<32n,false);
 assert.equal(buff.instanceUid,2);assert.equal(buff.m_triggerTimer,timerState);assert.equal(timerState.m_remainingTime,0n);assert.equal(buff.m_isFinished,false);
});

const resetFlagNames=['m_started','m_isFinished','m_needRemove','m_isActuallyEnabled','m_isLateEnabled','m_isManuallyEnabled','m_isActuallyFinished'];
function resetBuffBody(){return{instanceUid:0,m_isValid:false,...Object.fromEntries(resetFlagNames.map(n=>[n,true])),m_derivedBuffs:[{id:'old child'}]};}

test('Reset lifecycle clears prior execution flags and derived references without finishing child buffs',()=>{
 const buff=resetBuffBody(),child=buff.m_derivedBuffs[0],list=buff.m_derivedBuffs;child.m_isFinished=false;
 Object.assign(buff,{instanceUid:71,m_isValid:true,m_lifeTime:123n,m_source:{id:'source'},m_blackboard:{key:3}});
 fearProjectileResetBuffLifecycle(buff);
 for(const key of resetFlagNames)assert.equal(buff[key],false,key);
 assert.equal(buff.m_derivedBuffs,list);assert.deepEqual(list,[]);assert.equal(child.m_isFinished,false);
 assert.equal(buff.instanceUid,71);assert.equal(buff.m_isValid,true);assert.equal(buff.m_lifeTime,123n);
 assert.deepEqual(buff.m_source,{id:'source'});assert.deepEqual(buff.m_blackboard,{key:3});
});

test('Reset lifecycle accepts absent native derived-list contents and remains repeatable',()=>{
 const buff=resetBuffBody();buff.m_derivedBuffs=null;fearProjectileResetBuffLifecycle(buff);
 assert.equal(buff.m_derivedBuffs,null);buff.m_started=true;buff.m_needRemove=true;fearProjectileResetBuffLifecycle(buff);
 assert.equal(buff.m_started,false);assert.equal(buff.m_needRemove,false);
});

test('recycled pooled buff keeps its new allocation identity while Reset removes old-life execution state',()=>{
 const f=fixture(),identity=fearProjectileBuffIdentity({counter:{value:0}}),p=fearProjectileBuffPointers({readUid:b=>b.instanceUid});
 const pool=fearProjectileDefaultBuffPool({createBuff:resetBuffBody,onAllocate:identity.allocate,onRecycle:identity.recycle});
 const queue=fearProjectileBuffRecycleQueue(f.b,{readFixedFrame:()=>10,copyPointer:p.copy,isPointerValid:p.isValid,lockPointer:p.lock,recycleBuff:pool.recycle});
 const buff=pool.allocate(),old=p.capture(buff);assert.equal(buff.m_isFinished,true);queue.enqueue(old);queue.flushImmediately();
 assert.equal(buff.instanceUid,0);assert.equal(buff.m_isValid,false);assert.equal(buff.m_isFinished,true,'recycling itself does not Reset');
 assert.equal(pool.allocate(),buff);const current=p.capture(buff);assert.equal(buff.instanceUid,2);
 fearProjectileResetBuffLifecycle(buff);assert.equal(p.lock(current),buff);assert.equal(p.lock(old),null);assert.equal(buff.m_isValid,true);
 for(const key of resetFlagNames)assert.equal(buff[key],false,key);assert.deepEqual(buff.m_derivedBuffs,[]);queue.release();
});

test('Reset lifecycle rejects accessor projections without executing user code',()=>{
 let calls=0;const buff=resetBuffBody();Object.defineProperty(buff,'m_started',{get(){calls++;return true;}});
 assert.throws(()=>fearProjectileResetBuffLifecycle(buff),/Boolean lifecycle data fields/);assert.equal(calls,0);
});

function runtimeCleanupFixture(overrides={}){
 const f=fixture(),events=[],globalBuffs=[{id:'a'},null,{id:'b'}];
 const effects=['clearLogger','clearRunes','clearGlobalBuffList','resetGlobalBlackboard','removeAllGlobalEnvironments',
  'resetAllSpineShaders','clearResourcesInHolder','flushDelayedBuffs','clearStaticVariables'];
 const callers=Object.fromEntries(effects.map(name=>[name,()=>{events.push(name);if(name==='clearGlobalBuffList')globalBuffs.length=0;}]));
 Object.assign(callers,{readGlobalBuffCount:()=>globalBuffs.length,readGlobalBuff:i=>globalBuffs[i],isDestroyedOrNull:b=>b==null,
  recycleGlobalBuff:b=>events.push(b.id)},overrides);
 const cleanup=fearProjectileClearRuntimeData(f.b,callers);return{...f,events,globalBuffs,cleanup,callers};
}

test('runtime cleanup recycles valid global objects before subsystems, delayed buffs and static state',()=>{
 const f=runtimeCleanupFixture();f.cleanup.run();assert.deepEqual(f.events,['clearLogger','clearRunes','a','b','clearGlobalBuffList',
  'resetGlobalBlackboard','removeAllGlobalEnvironments','resetAllSpineShaders','clearResourcesInHolder','flushDelayedBuffs','clearStaticVariables']);
 assert.deepEqual(f.globalBuffs,[]);f.cleanup.release();
});

test('runtime cleanup resamples the live global-buff list after each recycled object',()=>{
 let f;f=runtimeCleanupFixture({recycleGlobalBuff:b=>{f.events.push(b.id);if(b.id==='a')f.globalBuffs.push({id:'c'});}});
 f.cleanup.run();assert.deepEqual(f.events.slice(0,5),['clearLogger','clearRunes','a','b','c']);f.cleanup.release();
});

test('runtime cleanup list shrink does not recycle stale snapshot objects',()=>{
 let f;f=runtimeCleanupFixture({recycleGlobalBuff:b=>{f.events.push(b.id);f.globalBuffs.length=0;}});
 f.cleanup.run();assert.deepEqual(f.events.slice(0,4),['clearLogger','clearRunes','a','clearGlobalBuffList']);f.cleanup.release();
});

test('runtime cleanup flushes retained next-frame pointers after held resources and before static cleanup',()=>{
 let f;const order=[],p=fearProjectileBuffPointers({readUid:b=>b.uid});let queue;
 f=runtimeCleanupFixture({clearResourcesInHolder:()=>order.push('resources'),flushDelayedBuffs:()=>queue.flushImmediately(),clearStaticVariables:()=>{
  assert.equal(queue.pendingCount,0);order.push('static');
 }});
 queue=fearProjectileBuffRecycleQueue(f.b,{readFixedFrame:()=>10,copyPointer:p.copy,isPointerValid:p.isValid,lockPointer:p.lock,recycleBuff:b=>{order.push('buff');b.uid=0;}});
 queue.enqueue(p.capture({uid:1}));f.cleanup.run();assert.deepEqual(order,['resources','buff','static']);queue.release();f.cleanup.release();
});

test('runtime cleanup failure preserves committed effects and skips later static cleanup',()=>{
 let f,fail=true;f=runtimeCleanupFixture({flushDelayedBuffs:()=>{f.events.push('flush');if(fail)throw Error('flush failed');}});
 assert.throws(()=>f.cleanup.run(),/flush failed/);assert.equal(f.events.includes('clearStaticVariables'),false);assert.deepEqual(f.globalBuffs,[]);
 fail=false;f.cleanup.run();assert.equal(f.events.at(-1),'clearStaticVariables');f.cleanup.release();
});

for(const point of ['clearLogger','clearRunes','readGlobalBuffCount','readGlobalBuff','isDestroyedOrNull','recycleGlobalBuff',
 'clearGlobalBuffList','resetGlobalBlackboard','removeAllGlobalEnvironments','resetAllSpineShaders','clearResourcesInHolder',
 'flushDelayedBuffs','clearStaticVariables'])test('runtime cleanup cancels local battle end during '+point,()=>{
 let f;f=runtimeCleanupFixture({[point]:(...args)=>{f.b.emit('battleEnd',{});return args[0];}});
 assert.equal(f.cleanup.run(),null);assert.equal(f.cleanup.run(),null);assert.deepEqual(f.b.errors,[]);
});

test('runtime cleanup rejects recursive cleanup while global objects recycle',()=>{
 let f;f=runtimeCleanupFixture({recycleGlobalBuff:()=>assert.equal(f.cleanup.run(),null)});f.cleanup.run();f.cleanup.release();
});

test('runtime cleanup rejects invalid native count and validity results before later effects',()=>{
 for(const value of [-1,NaN,1.5,2**31]){
  const f=runtimeCleanupFixture({readGlobalBuffCount:()=>value});assert.throws(()=>f.cleanup.run(),/Int32 list count/);
  assert.deepEqual(f.events,['clearLogger','clearRunes']);f.cleanup.release();
 }
 const f=runtimeCleanupFixture({isDestroyedOrNull:()=>undefined});assert.throws(()=>f.cleanup.run(),/Boolean object validity/);f.cleanup.release();
});

function recycleQueueFixture(overrides={}){
 const f=fixture(),events=[],pointers=fearProjectileBuffPointers({readUid:b=>b.uid});let frame=10,reads=0;
 const callers={readFixedFrame:()=>{reads++;return frame;},copyPointer:pointers.copy,isPointerValid:pointers.isValid,lockPointer:pointers.lock,
  recycleBuff:buff=>events.push(buff),...overrides};
 const queue=fearProjectileBuffRecycleQueue(f.b,callers);
 return{...f,queue,pointers,events,get frame(){return frame;},set frame(value){frame=value;},get reads(){return reads;}};
}

test('immediate recycling visits all buckets in insertion order without reading the frame',()=>{
 const f=recycleQueueFixture(),a={uid:1},b={uid:2},c={uid:3};
 f.frame=99;f.queue.enqueue(f.pointers.capture(a));f.frame=10;f.queue.enqueue(f.pointers.capture(b));
 f.frame=99;f.queue.enqueue(f.pointers.capture(c));f.queue.enqueue(f.pointers.capture(null));
 const reads=f.reads;f.frame=NaN;f.queue.flushImmediately();
 assert.equal(f.reads,reads);assert.deepEqual(f.events,[a,c,b]);assert.equal(f.queue.pendingCount,0);
 f.queue.flushImmediately();assert.deepEqual(f.events,[a,c,b]);f.queue.release();
});

test('immediate recycle and default pool clear identities once across duplicate pointers',()=>{
 const f=fixture(),identity=fearProjectileBuffIdentity({counter:{value:0}}),p=fearProjectileBuffPointers({readUid:b=>b.instanceUid});
 const pool=fearProjectileDefaultBuffPool({createBuff:()=>({instanceUid:0,m_isValid:false}),onAllocate:identity.allocate,onRecycle:identity.recycle});
 let frame=10;const queue=fearProjectileBuffRecycleQueue(f.b,{readFixedFrame:()=>frame,copyPointer:p.copy,isPointerValid:p.isValid,lockPointer:p.lock,recycleBuff:pool.recycle});
 const a=pool.allocate(),old=p.capture(a);queue.enqueue(old);frame=20;queue.enqueue(old);
 queue.flushImmediately();assert.equal(pool.usingCount,0);assert.equal(pool.availableUnusedCount,100);assert.equal(p.lock(old),null);
 assert.equal(pool.allocate(),a);assert.equal(a.instanceUid,2);assert.equal(p.lock(old),null);queue.release();
});

test('immediate flush passes a separately invalidated Lock result to the pool',()=>{
 const f=recycleQueueFixture({isPointerValid:()=>true,lockPointer:()=>null});
 f.queue.enqueue(f.pointers.capture({uid:1}));f.queue.flushImmediately();assert.deepEqual(f.events,[null]);f.queue.release();
});

test('immediate pool failure retains all buckets and committed earlier recycle effects',()=>{
 let f,fail=true;const a={uid:1},b={uid:2};f=recycleQueueFixture({recycleBuff:buff=>{
  if(buff===b&&fail)throw Error('flush failure');f.events.push(buff);buff.uid=0;
 }});
 f.queue.enqueue(f.pointers.capture(a));f.frame=20;f.queue.enqueue(f.pointers.capture(b));
 assert.throws(()=>f.queue.flushImmediately(),/flush failure/);assert.equal(f.queue.pendingCount,2);assert.deepEqual(f.events,[a]);
 fail=false;f.queue.flushImmediately();assert.deepEqual(f.events,[a,b]);assert.equal(f.queue.pendingCount,0);f.queue.release();
});

test('immediate flush rejects new outer buckets after completing the current bucket',()=>{
 let f,changed=false;const a={uid:1},b={uid:2},c={uid:3};f=recycleQueueFixture({recycleBuff:buff=>{
  f.events.push(buff);if(!changed){changed=true;f.frame=20;f.queue.enqueue(f.pointers.capture(c));}
 }});
 f.queue.enqueue(f.pointers.capture(a));f.queue.enqueue(f.pointers.capture(b));
 assert.throws(()=>f.queue.flushImmediately(),/bucket list changed/);assert.deepEqual(f.events,[a,b]);assert.equal(f.queue.pendingCount,3);f.queue.release();
});

test('immediate flush rejects mutation even on the final inner MoveNext',()=>{
 let f;const a={uid:1};f=recycleQueueFixture({recycleBuff:buff=>f.queue.enqueue(f.pointers.capture(buff))});
 f.queue.enqueue(f.pointers.capture(a));assert.throws(()=>f.queue.flushImmediately(),/recycle list changed/);
 assert.equal(f.queue.pendingCount,2);f.queue.release();
});

test('immediate flush sees changes to a later existing bucket when it opens that list',()=>{
 let f;const a={uid:1},b={uid:2},c={uid:3};f=recycleQueueFixture({recycleBuff:buff=>{
  f.events.push(buff);if(buff===a){f.frame=20;f.queue.enqueue(f.pointers.capture(c));}
 }});
 f.queue.enqueue(f.pointers.capture(a));f.frame=20;f.queue.enqueue(f.pointers.capture(b));
 f.queue.flushImmediately();assert.deepEqual(f.events,[a,b,c]);assert.equal(f.queue.pendingCount,0);f.queue.release();
});

test('immediate and timed traversals reject recursive traversal across both entry points',()=>{
 let f;f=recycleQueueFixture({recycleBuff:buff=>{
  assert.equal(f.queue.update(),null);assert.equal(f.queue.flushImmediately(),null);f.events.push(buff);
 }});
 f.queue.enqueue(f.pointers.capture({uid:1}));f.queue.flushImmediately();f.queue.enqueue(f.pointers.capture({uid:2}));
 f.frame=11;f.queue.update();assert.equal(f.events.length,2);f.queue.release();
});

for(const point of ['copyPointer','isPointerValid','lockPointer','recycleBuff'])test('immediate flush cancels local battle end during '+point,()=>{
 const f=fixture();let stop=false;const p=fearProjectileBuffPointers({readUid:b=>b.uid});
 const base={readFixedFrame:()=>10,copyPointer:p.copy,isPointerValid:p.isValid,lockPointer:p.lock,recycleBuff:()=>{}},callers={};
 for(const[name,fn]of Object.entries(base))callers[name]=(...args)=>{if(stop&&name===point)f.b.emit('battleEnd',{});return fn(...args);};
 const q=fearProjectileBuffRecycleQueue(f.b,callers);q.enqueue(p.capture({uid:1}));stop=true;
 assert.equal(q.flushImmediately(),null);assert.equal(q.pendingCount,0);assert.equal(q.flushImmediately(),null);assert.deepEqual(f.b.errors,[]);
});

test('buff recycle queue processes only the exact next native frame and skips invalid pointers',()=>{
 const f=recycleQueueFixture(),buff={uid:7};f.queue.enqueue(f.pointers.capture(buff));f.queue.enqueue(f.pointers.capture(null));
 assert.equal(f.queue.pendingCount,2);assert.equal(f.queue.update(),undefined);assert.deepEqual(f.events,[]);
 f.frame=12;f.queue.update();assert.equal(f.queue.pendingCount,2,'skipping frame11 does not catch up its bucket');
 f.frame=11;f.queue.update();assert.deepEqual(f.events,[buff]);assert.equal(f.queue.pendingCount,0);f.queue.release();
});

test('next-frame queue keys wrap as native UInt32 rather than signed Int32 or float time',()=>{
 const f=recycleQueueFixture(),buff={uid:7};f.frame=0xffffffff;f.queue.enqueue(f.pointers.capture(buff));f.frame=0;
 f.queue.update();assert.deepEqual(f.events,[buff]);assert.equal(f.queue.pendingCount,0);f.queue.release();
});

test('queue stores pointer values and owner retirement does not cancel a battle-scoped pending recycle',()=>{
 const f=recycleQueueFixture(),buff={uid:7},pointer={obj:buff,cachedUid:7};f.queue.enqueue(pointer);pointer.obj=null;pointer.cachedUid=0;
 f.b.kill(f.source,null);f.frame=11;f.queue.update();assert.deepEqual(f.events,[buff]);f.queue.release();assert.deepEqual(f.b.errors,[]);
});

test('recycling can enqueue a future-frame pointer without changing the enumerated list',()=>{
 let f;const a={uid:1},b={uid:2};f=recycleQueueFixture({recycleBuff:buff=>{f.events.push(buff);if(buff===a)f.queue.enqueue(f.pointers.capture(b));}});
 f.queue.enqueue(f.pointers.capture(a));f.frame=11;f.queue.update();assert.deepEqual(f.events,[a]);assert.equal(f.queue.pendingCount,1);
 f.frame=12;f.queue.update();assert.deepEqual(f.events,[a,b]);assert.equal(f.queue.pendingCount,0);f.queue.release();
});

test('mutation of the currently enumerated recycle bucket throws and leaves its bucket for later checking',()=>{
 let f;const a={uid:1},b={uid:2};let changed=false;
 f=recycleQueueFixture({recycleBuff:buff=>{
  f.events.push(buff);if(!changed){changed=true;a.uid=3;f.frame=10;f.queue.enqueue(f.pointers.capture(b));f.frame=11;}
 }});
 f.queue.enqueue(f.pointers.capture(a));f.frame=11;assert.throws(()=>f.queue.update(),/changed during enumeration/);
 assert.equal(f.queue.pendingCount,2);assert.deepEqual(f.events,[a]);f.queue.update();assert.deepEqual(f.events,[a,b]);assert.equal(f.queue.pendingCount,0);f.queue.release();
});

test('bucket removal resamples the frame counter after recycling instead of reusing the lookup frame',()=>{
 let f;const a={uid:1},b={uid:2};f=recycleQueueFixture({recycleBuff:buff=>{f.events.push(buff);f.frame=12;}});
 f.queue.enqueue(f.pointers.capture(a));f.frame=11;f.queue.enqueue(f.pointers.capture(b));f.queue.update();
 assert.deepEqual(f.events,[a]);assert.equal(f.queue.pendingCount,1,'frame12 bucket was removed by the fresh frame sample');f.queue.release();
});

test('pool receives Lock null when a pointer changes between separate validity and lock operations',()=>{
 const f=recycleQueueFixture({isPointerValid:()=>true,lockPointer:()=>null});f.queue.enqueue(f.pointers.capture({uid:7}));f.frame=11;
 f.queue.update();assert.deepEqual(f.events,[null]);f.queue.release();
});

test('pool exceptions preserve the current bucket and permit a later nonrecursive retry',()=>{
 let fail=true;const f=recycleQueueFixture({recycleBuff:()=>{if(fail)throw Error('pool failure');}});f.queue.enqueue(f.pointers.capture({uid:7}));f.frame=11;
 assert.throws(()=>f.queue.update(),/pool failure/);assert.equal(f.queue.pendingCount,1);fail=false;f.queue.update();assert.equal(f.queue.pendingCount,0);f.queue.release();
});

test('invalid native frame values fail before enqueueing and do not hold the reentry guard',()=>{
 const f=recycleQueueFixture();for(const frame of [-1,2**32,NaN,1.5]){f.frame=frame;assert.throws(()=>f.queue.enqueue(f.pointers.capture({uid:7})),/UInt32 fixedFrameCnt/);}
 assert.equal(f.queue.pendingCount,0);f.frame=10;f.queue.enqueue(f.pointers.capture({uid:7}));assert.equal(f.queue.pendingCount,1);f.queue.release();
});

test('recursive enqueue and update callbacks cannot duplicate acquisition or recycling',()=>{
 let f,checkingEnqueue=true;f=recycleQueueFixture({copyPointer:pointer=>{if(checkingEnqueue)assert.equal(f.queue.enqueue(pointer),null);return f.pointers.copy(pointer);},
  recycleBuff:buff=>{assert.equal(f.queue.update(),null);f.events.push(buff);}});
 f.queue.enqueue(f.pointers.capture({uid:7}));checkingEnqueue=false;f.frame=11;f.queue.update();assert.equal(f.events.length,1);assert.equal(f.queue.pendingCount,0);f.queue.release();
});

for(const point of ['readFixedFrame','copyPointer','isPointerValid','lockPointer','recycleBuff'])test('recycle queue cancels battle end during '+point,()=>{
 const f=fixture();let frame=10,stop=false;
 const p=fearProjectileBuffPointers({readUid:b=>b.uid}),base={readFixedFrame:()=>frame,copyPointer:p.copy,isPointerValid:p.isValid,lockPointer:p.lock,recycleBuff:()=>{}},callers={};
 for(const [name,fn]of Object.entries(base))callers[name]=(...args)=>{if(stop&&name===point)f.b.emit('battleEnd',{});return fn(...args);};
 const queue=fearProjectileBuffRecycleQueue(f.b,callers);queue.enqueue(p.capture({uid:7}));frame=11;stop=true;
 assert.equal(queue.update(),null);assert.equal(queue.pendingCount,0);assert.equal(queue.enqueue(p.capture({uid:8})),null);assert.deepEqual(f.b.errors,[]);
});

test('finish path queues a captured buff value for native frame+1 without recycling it during finish',()=>{
 const f=fixture(),buff={uid:7},p=fearProjectileBuffPointers({readUid:b=>b.uid});let frame=20,recycled=0,queued;
 const queue=fearProjectileBuffRecycleQueue(f.b,{readFixedFrame:()=>frame,copyPointer:p.copy,isPointerValid:p.isValid,lockPointer:p.lock,
  recycleBuff:b=>{assert.equal(b,buff);recycled++;b.uid=0;}});
 const finish=fearProjectileFinishAndRemoveBuff(f.b,{owner:f.source,buff,removeFromList:()=>false,readUid:b=>b.uid,removeUidRegistration:()=>false,
  markFinish:()=>{},onFinish:()=>true,captureBuffPointer:p.capture,queueRecycleNextFrame:pointer=>{queued=pointer;queue.enqueue(pointer);}});
 assert.equal(finish.run(),undefined);assert.equal(recycled,0);queue.update();assert.equal(recycled,0);assert.equal(p.lock(queued),buff);
 frame=21;queue.update();assert.equal(recycled,1);assert.equal(p.lock(queued),null);assert.equal(queue.pendingCount,0);queue.release();
});

function finishEffectFixture(overrides={}){
 const f=fixture(),buff={uid:7},events=[],pointer={obj:buff,cachedUid:7};
 const callers={owner:f.source,buff,removeFromList:b=>{assert.equal(b,buff);events.push('list');return false;},
  readUid:b=>b.uid,removeUidRegistration:uid=>{assert.equal(uid,buff.uid);events.push('uid');return false;},
  markFinish:(b,flags)=>{assert.equal(b,buff);assert.deepEqual(flags,{updateOverrideMap:true});events.push('mark');},
  onFinish:(b,flags)=>{assert.equal(b,buff);assert.deepEqual(flags,{immediatelyFinishEffect:false});events.push('finish');return true;},
  captureBuffPointer:b=>{assert.equal(b,buff);events.push('capture');return pointer;},
  queueRecycleNextFrame:value=>{assert.equal(value,pointer);events.push('queue');},...overrides};
 return{...f,buff,events,pointer,callers};
}

test('buff finish removes list/UID registration before mark and finish even when removal reports false',()=>{
 const f=finishEffectFixture(),finish=fearProjectileFinishAndRemoveBuff(f.b,f.callers);
 assert.equal(finish.run(),undefined);assert.equal(finish.run(),null);
 assert.deepEqual(f.events,['list','uid','mark','finish','capture','queue']);assert.deepEqual(f.b.errors,[]);
});

test('OnFinish false skips pointer capture and next-frame recycling but preserves earlier finish effects',()=>{
 const f=finishEffectFixture({onFinish:()=>false});assert.equal(fearProjectileFinishAndRemoveBuff(f.b,f.callers).run(),undefined);
 assert.deepEqual(f.events,['list','uid','mark']);
});

test('finish samples the current UID after list removal instead of caching the earlier list key',()=>{
 const f=finishEffectFixture();f.callers.removeFromList=()=>{f.buff.uid=8;};
 f.callers.removeUidRegistration=uid=>{assert.equal(uid,8);f.events.push('uid8');};
 assert.equal(fearProjectileFinishAndRemoveBuff(f.b,f.callers).run(),undefined);assert.equal(f.events[0],'uid8');
});

for(const point of ['removeFromList','readUid','removeUidRegistration','markFinish','onFinish','captureBuffPointer','queueRecycleNextFrame'])
 for(const boundary of ['reuse','battleEnd','recursive'])test('buff finish guards '+boundary+' during '+point,()=>{
  const f=finishEffectFixture();let finish;const original=f.callers[point];f.callers[point]=(...args)=>{
   if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});else assert.equal(finish.run(),null);
   return boundary==='recursive'?original(...args):undefined;
  };
  finish=fearProjectileFinishAndRemoveBuff(f.b,f.callers);assert.equal(finish.run(),boundary==='recursive'?undefined:null);
  assert.equal(finish.run(),null);assert.deepEqual(f.b.errors,[]);
 });

test('malformed OnFinish results fail before capture/queue rather than becoming a recycle request',()=>{
 const f=finishEffectFixture({onFinish:()=>undefined}),finish=fearProjectileFinishAndRemoveBuff(f.b,f.callers);
 assert.throws(()=>finish.run(),/OnFinish Boolean/);assert.equal(f.events.includes('capture'),false);assert.equal(finish.run(),null);
});

for(const removed of [false,true])test('override group removal updates its internals only after member removal '+removed,()=>{
 const f=fixture(),group={},buff={},events=[];
 const effect=fearProjectileOverrideGroupRemove(f.b,{owner:f.source,group,buff,removeMember:(g,b)=>{
  assert.equal(g,group);assert.equal(b,buff);events.push('remove');return removed;
 },updateInternal:g=>{assert.equal(g,group);events.push('update');}});
 assert.equal(effect.run(),undefined);assert.equal(effect.run(),null);assert.deepEqual(events,removed?['remove','update']:['remove']);
});

for(const point of ['removeMember','updateInternal'])for(const boundary of ['reuse','battleEnd','recursive'])
 test('override group removal guards '+boundary+' during '+point,()=>{
  const f=fixture();let effect;const callers={owner:f.source,group:{},buff:{},removeMember:()=>true,updateInternal:()=>{}};
  const original=callers[point];callers[point]=(...args)=>{
   if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});else assert.equal(effect.run(),null);
   return boundary==='recursive'?original(...args):undefined;
  };
  effect=fearProjectileOverrideGroupRemove(f.b,callers);assert.equal(effect.run(),boundary==='recursive'?undefined:null);assert.equal(effect.run(),null);
 });

test('concrete cleanup removes registration before queuing a still UID-valid pointer and updating its override group',()=>{
 const f=fixture(),buff={uid:7,priority:1,key:'g',finished:true},pointers=fearProjectileBuffPointers({readUid:b=>b.uid}),
  list=fearProjectileBuffList(f.b,{owner:f.source,copyEntry:pointers.copy,isEntryValid:pointers.isValid,resolveEntry:pointers.lock,readPriority:b=>b.priority,readUid:b=>b.uid}),
  uidMap=new Map([[7,buff]]),group={members:[buff]},queue=[],events=[];
 list.add(pointers.capture(buff));
 const cleanup=fearProjectileFinishedBuffs(f.b,{owner:f.source,openReverseIterator:()=>list.openReverseIterator(),isFinished:b=>b.finished,
  finishAndRemoveBuff:b=>fearProjectileFinishAndRemoveBuff(f.b,{owner:f.source,buff:b,removeFromList:b=>{events.push('list');return list.remove(b);},
   readUid:b=>b.uid,removeUidRegistration:uid=>{events.push('uid');return uidMap.delete(uid);},
   markFinish:()=>events.push('mark'),onFinish:()=>{events.push('finish');assert.equal(uidMap.has(7),false);return true;},
   captureBuffPointer:b=>pointers.capture(b),queueRecycleNextFrame:p=>{events.push('queue');queue.push(p);}}).run(),
  readOverrideKey:b=>b.key,tryGetOverrideGroup:()=>({found:true,group}),
  removeFromOverrideGroup:(g,b)=>fearProjectileOverrideGroupRemove(f.b,{owner:f.source,group:g,buff:b,
   removeMember:(g,b)=>{events.push('group-remove');const index=g.members.indexOf(b);if(index<0)return false;g.members.splice(index,1);return true;},
   updateInternal:()=>events.push('group-update')}).run(),clearInvalidElementsIfNotLoop:()=>list.clearInvalidElementsIfNotLoop()});
 assert.equal(cleanup.run(),undefined);assert.deepEqual(events,['list','uid','mark','finish','queue','group-remove','group-update']);
 assert.equal(list.count,0);assert.equal(uidMap.size,0);assert.equal(group.members.length,0);assert.equal(queue.length,1);
 assert.equal(pointers.lock(queue[0]),buff,'removal from the UID map does not itself reset Buff.instanceUid');
 buff.uid=8;assert.equal(pointers.lock(queue[0]),null);assert.equal(list.openCount,0);list.release();
});

test('forward and reverse buff iterators share one cached view with independent cursor positions',()=>{
 const f=buffIterationFixture(),forward=f.iteration.openIterator();f.entries.splice(0,2,'new');
 const reverse=f.iteration.openReverseIterator();assert.equal(f.iteration.openCount,2);
 assert.throws(()=>reverse.current(),/no current/);assert.equal(reverse.moveNext(),true);assert.equal(reverse.current(),'b');
 assert.equal(forward.moveNext(),true);assert.equal(forward.current(),'a');assert.equal(reverse.moveNext(),true);assert.equal(reverse.current(),'a');
 assert.equal(reverse.moveNext(),false);assert.throws(()=>reverse.current(),/no current/);reverse.dispose();forward.dispose();
 const fresh=f.iteration.openReverseIterator();assert.equal(fresh.moveNext(),true);assert.equal(fresh.current(),'new');assert.equal(fresh.moveNext(),false);
 fresh.dispose();f.iteration.release();
});

function finishedBuffFixture(overrides={}){
 const f=fixture(),events=[],buffs=[{id:'first',finished:true,key:'group'},null,{id:'active',finished:false,key:'group'},
  {id:'empty',finished:true,key:''},{id:'last',finished:true,key:'group'}],group={};
 const callers={owner:f.source,openReverseIterator:()=>{
  events.push('open');let index=buffs.length;return{moveNext:()=>--index>=0,current:()=>buffs[index],dispose:()=>events.push('dispose')};
 },isFinished:buff=>buff.finished,finishAndRemoveBuff:buff=>events.push('finish:'+buff.id),
 readOverrideKey:buff=>{events.push('key:'+buff.id);return buff.key;},tryGetOverrideGroup:key=>{events.push('lookup:'+key);return{found:true,group};},
 removeFromOverrideGroup:(value,buff)=>{assert.equal(value,group);events.push('group:'+buff.id);},
 clearInvalidElementsIfNotLoop:()=>events.push('prune'),...overrides};
 return{...f,buffs,group,events,callers};
}

test('finished buff cleanup traverses backward, updates groups after finish and prunes null entries after disposal',()=>{
 const f=finishedBuffFixture(),cleanup=fearProjectileFinishedBuffs(f.b,f.callers);
 assert.equal(cleanup.run(),undefined);assert.equal(cleanup.run(),null);
 assert.deepEqual(f.events,['open','finish:last','key:last','key:last','lookup:group','group:last',
  'finish:empty','key:empty','finish:first','key:first','key:first','lookup:group','group:first','dispose','prune']);
 assert.deepEqual(f.b.errors,[]);
});

test('finished cleanup does not prune an all-valid list merely because it removed finished entries',()=>{
 const f=finishedBuffFixture();f.buffs.splice(0,5,{id:'finished',finished:true,key:null});
 assert.equal(fearProjectileFinishedBuffs(f.b,f.callers).run(),undefined);assert.deepEqual(f.events,['open','finish:finished','key:finished','dispose']);
});

test('override lookup uses a second key sample after finish and the first null-or-empty test',()=>{
 const f=finishedBuffFixture();f.buffs.splice(0,5,{id:'changing',finished:true,key:'before'});let samples=0;
 f.callers.finishAndRemoveBuff=buff=>{buff.key='after';};
 f.callers.readOverrideKey=buff=>++samples===1?buff.key:'lookup-key';
 f.callers.tryGetOverrideGroup=key=>{assert.equal(key,'lookup-key');return{found:false,group:null};};
 assert.equal(fearProjectileFinishedBuffs(f.b,f.callers).run(),undefined);assert.equal(samples,2);assert.deepEqual(f.events,['open','dispose']);
});

test('finish exceptions close the reverse iterator and skip null-entry pruning',()=>{
 const f=finishedBuffFixture({finishAndRemoveBuff:()=>{throw Error('finish effect');}}),cleanup=fearProjectileFinishedBuffs(f.b,f.callers);
 assert.throws(()=>cleanup.run(),/finish effect/);assert.deepEqual(f.events,['open','dispose']);assert.equal(cleanup.run(),null);
});

test('a successful override lookup with a null group fails rather than dropping its remove effect',()=>{
 const f=finishedBuffFixture({tryGetOverrideGroup:()=>({found:true,group:null})});
 assert.throws(()=>fearProjectileFinishedBuffs(f.b,f.callers).run(),/cannot be null/);assert.equal(f.events.at(-1),'dispose');assert.equal(f.events.includes('prune'),false);
});

for(const point of ['isFinished','finishAndRemoveBuff','readOverrideKey','tryGetOverrideGroup','removeFromOverrideGroup','clearInvalidElementsIfNotLoop'])
 for(const boundary of ['reuse','battleEnd','recursive'])test('finished buff pass guards '+boundary+' during '+point,()=>{
  const f=finishedBuffFixture();let cleanup;const original=f.callers[point];f.callers[point]=(...args)=>{
   if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});else assert.equal(cleanup.run(),null);
   return boundary==='recursive'?original(...args):undefined;
  };
  cleanup=fearProjectileFinishedBuffs(f.b,f.callers);assert.equal(cleanup.run(),boundary==='recursive'?undefined:null);
  assert.equal(cleanup.run(),null);assert.ok(f.events.includes('dispose'));assert.deepEqual(f.b.errors,[]);
 });

test('finished cleanup composes concrete pointers and sorted list without changing an outer forward snapshot',()=>{
 const f=fixture(),pointers=fearProjectileBuffPointers({readUid:b=>b.uid}),list=fearProjectileBuffList(f.b,{owner:f.source,copyEntry:pointers.copy,
  isEntryValid:pointers.isValid,resolveEntry:pointers.lock,readPriority:b=>b.priority,readUid:b=>b.uid});
 const active={uid:1,priority:10,finished:false},done={uid:2,priority:5,finished:true};
 list.add(pointers.capture(active));list.add(pointers.capture(done));list.add(pointers.capture(null));const outer=list.openIterator(),events=[];
 const cleanup=()=>fearProjectileFinishedBuffs(f.b,{owner:f.source,openReverseIterator:()=>list.openReverseIterator(),isFinished:b=>b.finished,
  finishAndRemoveBuff:b=>{events.push(b.uid);list.remove(b);},readOverrideKey:()=>'',tryGetOverrideGroup:()=>{throw Error('empty key');},
  removeFromOverrideGroup:()=>{throw Error('empty key');},clearInvalidElementsIfNotLoop:()=>list.clearInvalidElementsIfNotLoop()}).run();
 assert.equal(cleanup(),undefined);assert.deepEqual(events,[2]);assert.equal(list.count,2,'invalid entry remains while outer cursor is open');
 const saved=[];while(outer.moveNext())saved.push(outer.current());assert.deepEqual(saved,[active,done,null]);outer.dispose();
 assert.equal(cleanup(),undefined);assert.equal(list.count,1);assert.equal(list.openCount,0);list.release();
});

test('mode dispatch closes its old snapshot before finished cleanup refreshes and removes newly finished buffs',()=>{
 const f=fixture(),pointers=fearProjectileBuffPointers({readUid:b=>b.uid}),list=fearProjectileBuffList(f.b,{owner:f.source,copyEntry:pointers.copy,
  isEntryValid:pointers.isValid,resolveEntry:pointers.lock,readPriority:b=>b.priority,readUid:b=>b.uid});
 const a={id:'a',uid:1,priority:10,action:true},b={id:'b',uid:2,priority:5,action:false},c={id:'c',uid:3,priority:0,finished:true},
  added={id:'added',uid:4,priority:7,action:true},events=[];
 for(const buff of [a,b,c])list.add(pointers.capture(buff));
 const cleanup=()=>fearProjectileFinishedBuffs(f.b,{owner:f.source,openReverseIterator:()=>list.openReverseIterator(),isFinished:b=>!!b.finished,
  finishAndRemoveBuff:b=>{events.push('finish:'+b.id);list.remove(b);},readOverrideKey:()=>'',tryGetOverrideGroup:()=>{throw Error('empty key');},
  removeFromOverrideGroup:()=>{throw Error('empty key');},clearInvalidElementsIfNotLoop:()=>list.clearInvalidElementsIfNotLoop()}).run();
 const dispatch=()=>fearProjectileBuffModeChange(f.b,{owner:f.source,openIterator:()=>list.openIterator(),isFinishedOrDisabled:b=>!!b.finished,
  isActionValid:b=>!!b.action,runActions:b=>{events.push('run:'+b.id);if(b===a){a.finished=true;list.add(pointers.capture(added));}},
  checkFinishedBuffs:()=>{assert.equal(list.openCount,0);cleanup();}}).run();
 assert.equal(dispatch(),true);assert.deepEqual(events,['run:a','finish:c','finish:a']);assert.equal(list.count,2);assert.equal(list.openCount,0);
 events.length=0;assert.equal(dispatch(),true);assert.deepEqual(events,['run:added']);assert.equal(list.count,2);list.release();
});

test('buff ObjectPtr capture rejects null and initial zero UID before storing an object',()=>{
 let reads=0;const pointers=fearProjectileBuffPointers({readUid:b=>{reads++;return b.uid;}});
 const nil=pointers.capture(null);assert.deepEqual(nil,{obj:null,cachedUid:0});assert.equal(reads,0);assert.equal(pointers.isValid(nil),false);
 const zero=pointers.capture({uid:0});assert.deepEqual(zero,{obj:null,cachedUid:0});assert.equal(reads,1);assert.equal(pointers.lock(zero),null);
});

test('buff ObjectPtr constructor resamples UID after the nonzero test instead of caching the first read',()=>{
 const buff={};let samples=[1,0,0,0],reads=0;
 const pointers=fearProjectileBuffPointers({readUid:()=>{reads++;return samples.shift();}}),pointer=pointers.capture(buff);
 assert.equal(pointer.obj,buff);assert.equal(pointer.cachedUid,0);assert.equal(reads,2);
 assert.equal(pointers.isValid(pointer),true);assert.equal(pointers.lock(pointer),buff);assert.equal(reads,4);
});

test('finished, disabled and owner-retired buff objects retain ObjectPtr validity until instance UID changes',()=>{
 const f=fixture(),buff={uid:7,isFinished:true,isEnabled:false,removed:true,alive:false};
 const pointers=fearProjectileBuffPointers({readUid:b=>b.uid}),pointer=pointers.capture(buff);
 assert.equal(pointers.isValid(pointer),true);assert.equal(pointers.lock(pointer),buff);
 f.b.kill(f.source,null);assert.equal(pointers.lock(pointer),buff);
 buff.uid=8;assert.equal(pointers.isValid(pointer),false);assert.equal(pointers.lock(pointer),null);
 assert.equal(pointers.lock(pointers.capture(buff)),buff);assert.deepEqual(f.b.errors,[]);
});

test('buff ObjectPtr copies retain value fields without aliasing a later wrapper mutation',()=>{
 const buff={uid:0xffffffff},pointers=fearProjectileBuffPointers({readUid:b=>b.uid}),original={obj:buff,cachedUid:0xffffffff},copy=pointers.copy(original);
 original.obj=null;original.cachedUid=0;assert.equal(pointers.lock(copy),buff);assert.equal(Object.isFrozen(copy),true);
 assert.equal(pointers.isValid({obj:null,cachedUid:7}),false);
 for(const uid of [-1,2**32,NaN,'1'])assert.throws(()=>pointers.capture({uid}),/UInt32/);
});

test('concrete buff pointers feed sorted mutation, nested iteration and mode dispatch without using enabled state as identity',()=>{
 const f=fixture(),pointers=fearProjectileBuffPointers({readUid:b=>b.uid}),list=fearProjectileBuffList(f.b,{owner:f.source,
  copyEntry:pointers.copy,isEntryValid:pointers.isValid,resolveEntry:pointers.lock,readPriority:b=>b.priority,readUid:b=>b.uid});
 const finished={id:'finished',uid:1,priority:10,isFinished:true},disabled={id:'disabled',uid:2,priority:5,isEnabled:false},ready={id:'ready',uid:3,priority:0};
 for(const buff of [ready,finished,disabled])list.add(pointers.capture(buff));assert.equal(list.count,3);
 const events=[],dispatch=fearProjectileBuffModeChange(f.b,{owner:f.source,openIterator:()=>list.openIterator(),
  isFinishedOrDisabled:b=>!!b.isFinished||b.isEnabled===false,isActionValid:()=>true,
  runActions:b=>events.push(b.id),checkFinishedBuffs:()=>{events.push('cleanup');list.clearInvalidElementsIfNotLoop();}});
 assert.equal(dispatch.run(),true);assert.deepEqual(events,['ready','cleanup']);assert.equal(list.count,3,'disabled/finished pointers remain UID-valid');
 finished.uid=4;list.clearInvalidElementsIfNotLoop();assert.equal(list.count,2);list.release();
});

function buffListFixture(overrides={}){
 const f=fixture(),defaults={copyEntry:e=>({...e}),isEntryValid:e=>e.buff!=null&&e.uid===e.buff.uid&&!e.buff.retired,
  resolveEntry:e=>e.buff!=null&&e.uid===e.buff.uid&&!e.buff.retired?e.buff:null,readPriority:buff=>buff.priority,readUid:buff=>buff.uid};
 const callers={owner:f.source,...defaults,...overrides};
 const list=fearProjectileBuffList(f.b,callers),entry=buff=>({buff,uid:buff?.uid??0});
 const values=()=>{const cursor=list.openIterator(),out=[];try{while(cursor.moveNext())out.push(cursor.current());}finally{cursor.dispose();}return out;};
 return{...f,list,entry,values,defaults};
}

test('buff sorted insertion is descending by event priority and stable for equal priorities',()=>{
 const f=buffListFixture(),buffs=[{id:'low',uid:1,priority:-5},{id:'high',uid:2,priority:10},{id:'mid',uid:3,priority:2},{id:'equal',uid:4,priority:2}];
 for(const buff of buffs)assert.equal(f.list.add(f.entry(buff)),undefined);
 assert.deepEqual(f.values().map(b=>b.id),['high','mid','equal','low']);assert.equal(f.list.count,4);f.list.release();
});

test('buff insertion compares current priorities without resorting existing entries after a field change',()=>{
 const f=buffListFixture(),a={id:'a',uid:1,priority:10},b={id:'b',uid:2,priority:5},c={id:'c',uid:3,priority:7};
 f.list.add(f.entry(a));f.list.add(f.entry(b));a.priority=0;f.list.add(f.entry(c));
 assert.deepEqual(f.values().map(b=>b.id),['c','a','b']);f.list.release();
});

test('buff removal scans backward and matches UID rather than object identity',()=>{
 const f=buffListFixture(),a={id:'first',uid:0xffffffff,priority:1},b={id:'last',uid:0xffffffff,priority:1};
 f.list.add(f.entry(a));f.list.add(f.entry(b));assert.equal(f.list.remove({uid:0xffffffff}),true);
 assert.deepEqual(f.values(),[a]);assert.equal(f.list.remove(null),false);assert.equal(f.list.remove({uid:8}),false);f.list.release();
});

test('invalid buff pointers append without locking and are removed only outside an iterator loop',()=>{
 const f=buffListFixture(),buff={uid:1,priority:2};f.list.add(f.entry(buff));f.list.add({buff:null,uid:0});
 assert.equal(f.list.count,2);assert.deepEqual(f.values(),[buff,null]);
 const cursor=f.list.openIterator();f.list.clearInvalidElementsIfNotLoop();assert.equal(f.list.count,2);
 cursor.dispose();f.list.clearInvalidElementsIfNotLoop();assert.equal(f.list.count,1);assert.deepEqual(f.values(),[buff]);f.list.release();
 const g=buffListFixture({resolveEntry:()=>{throw Error('invalid pointer locked');}});
 g.list.add({buff:null,uid:0});assert.equal(g.list.count,1);g.list.release();
});

test('list mutation leaves an open snapshot intact and a later traversal observes the new sorted contents',()=>{
 const f=buffListFixture(),a={uid:1,priority:10},b={uid:2,priority:1},c={uid:3,priority:5};
 f.list.add(f.entry(a));f.list.add(f.entry(b));const cursor=f.list.openIterator();assert.equal(cursor.moveNext(),true);assert.equal(cursor.current(),a);
 f.list.remove(b);f.list.add(f.entry(c));const nested=f.list.openIterator();const view=[];
 while(nested.moveNext())view.push(nested.current());assert.deepEqual(view,[a,b]);nested.dispose();
 assert.equal(cursor.moveNext(),true);assert.equal(cursor.current(),b);cursor.dispose();assert.deepEqual(f.values(),[a,c]);f.list.release();
});

test('an invalidated UID cannot donate a saved buff entry to its replacement life',()=>{
 const f=buffListFixture(),buff={uid:7,priority:0},entry=f.entry(buff);f.list.add(entry);const cursor=f.list.openIterator();
 entry.uid=8;buff.uid=8;assert.equal(cursor.moveNext(),true);assert.equal(cursor.current(),null);cursor.dispose();
 assert.equal(f.list.remove({uid:7}),false);f.list.clearInvalidElementsIfNotLoop();assert.equal(f.list.count,0);f.list.release();
});

test('sorted list and two-pass mode dispatcher preserve native event-priority order through nested mutations',()=>{
 const f=buffListFixture(),a={id:'a',uid:1,priority:10},b={id:'b',uid:2,priority:1},c={id:'c',uid:3,priority:5},events=[];
 f.list.add(f.entry(b));f.list.add(f.entry(a));let nested=false;
 const callers={owner:f.source,openIterator:()=>f.list.openIterator(),isFinishedOrDisabled:()=>false,isActionValid:()=>true,
  runActions:buff=>{events.push(buff.id);if(buff===a&&!nested){nested=true;f.list.remove(b);f.list.add(f.entry(c));assert.equal(fearProjectileBuffModeChange(f.b,callers).run(),true);}},
  checkFinishedBuffs:()=>f.list.clearInvalidElementsIfNotLoop()};
 assert.equal(fearProjectileBuffModeChange(f.b,callers).run(),true);assert.deepEqual(events,['a','a','b','b']);assert.equal(f.list.openCount,0);
 events.length=0;assert.equal(fearProjectileBuffModeChange(f.b,callers).run(),true);assert.deepEqual(events,['a','c']);f.list.release();
});

test('failed priority/UID readers do not leave mutation reentry locked or silently accept malformed native values',()=>{
 const f=buffListFixture(),a={uid:1,priority:1},bad={uid:2,priority:NaN};f.list.add(f.entry(a));
 assert.throws(()=>f.list.add(f.entry(bad)),/Int32 priority/);assert.equal(f.list.count,1);
 assert.throws(()=>f.list.remove({uid:-1}),/UInt32 UID/);assert.equal(f.list.remove({uid:1}),true);f.list.release();
});

for(const point of ['copyEntry','isEntryValid','resolveEntry','readPriority','readUid'])test('buff list cancels owner reuse in '+point,()=>{
 const f=fixture(),buff={uid:1,priority:1};let retire=false;
 const base={copyEntry:e=>({...e}),isEntryValid:()=>true,resolveEntry:e=>e.buff,readPriority:b=>b.priority,readUid:b=>b.uid},callers={owner:f.source};
 for(const [name,fn]of Object.entries(base))callers[name]=(...args)=>{if(retire&&name===point)f.source.deploySeq++;return fn(...args);};
 const list=fearProjectileBuffList(f.b,callers);list.add({buff,uid:1});retire=true;
 assert.equal(point==='readUid'?list.remove(buff):list.add({buff:{uid:2,priority:2},uid:2}),null);
 assert.equal(list.count,0);assert.equal(list.openCount,0);assert.equal(list.openIterator(),null);assert.deepEqual(f.b.errors,[]);
});

test('recursive priority effects cannot duplicate insertion while a nested iterator sees the pre-insertion snapshot',()=>{
 const f=fixture(),a={uid:1,priority:1},b={uid:2,priority:2};let list,checked=false,cursor;
 list=fearProjectileBuffList(f.b,{owner:f.source,copyEntry:e=>({...e}),isEntryValid:()=>true,resolveEntry:e=>e.buff,readUid:b=>b.uid,
  readPriority:buff=>{if(!checked){checked=true;assert.equal(list.add({buff:b,uid:2}),null);cursor=list.openIterator();}return buff.priority;}});
 list.add({buff:a,uid:1});list.add({buff:b,uid:2});assert.equal(list.count,2);
 assert.equal(cursor.moveNext(),true);assert.equal(cursor.current(),a);assert.equal(cursor.moveNext(),false);cursor.dispose();list.release();
});

function buffIterationFixture(overrides={}){
 const f=fixture(),entries=['a','b'],events=[];
 const callers={owner:f.source,readInternalEntries:()=>{events.push('snapshot');return entries;},copyEntry:entry=>entry,
  resolveEntry:entry=>entry,...overrides};
 const iteration=fearProjectileBuffIteration(f.b,callers);return{...f,entries,events,callers,iteration};
}

test('nested buff iterators share the outer snapshot while the next outer iterator sees current entries',()=>{
 const f=buffIterationFixture(),outer=f.iteration.openIterator();assert.equal(f.iteration.openCount,1);
 f.entries.splice(0,2,'replacement');const nested=f.iteration.openIterator();assert.equal(f.iteration.openCount,2);
 assert.equal(outer.moveNext(),true);assert.equal(outer.current(),'a');assert.equal(nested.moveNext(),true);assert.equal(nested.current(),'a');
 outer.dispose();assert.equal(f.iteration.openCount,1);assert.equal(nested.moveNext(),true);assert.equal(nested.current(),'b');
 nested.dispose();nested.dispose();assert.equal(f.iteration.openCount,0);assert.deepEqual(f.events,['snapshot']);
 const fresh=f.iteration.openIterator();assert.equal(fresh.moveNext(),true);assert.equal(fresh.current(),'replacement');
 fresh.dispose();f.iteration.release();assert.deepEqual(f.events,['snapshot','snapshot']);
});

test('buff iterator copies ObjectPtr values at snapshot and current rather than aliasing their mutable wrappers',()=>{
 const entity={},entry={entity,uid:7};let resolved;
 const f=buffIterationFixture({readInternalEntries:()=>[entry],copyEntry:ref=>({...ref}),resolveEntry:ref=>{resolved=ref.uid;ref.uid=99;return ref.entity;}});
 const cursor=f.iteration.openIterator();entry.uid=8;
 assert.equal(cursor.moveNext(),true);assert.equal(cursor.current(),entity);assert.equal(resolved,7);
 assert.equal(cursor.current(),entity);assert.equal(resolved,7);assert.equal(entry.uid,8);
 cursor.dispose();f.iteration.release();
});

test('buff cursor movement is explicit and retired cursors cannot consume a later traversal',()=>{
 const f=buffIterationFixture(),cursor=f.iteration.openIterator();assert.throws(()=>cursor.current(),/no current/);
 assert.equal(cursor.moveNext(),true);assert.equal(cursor.current(),'a');assert.equal(cursor.moveNext(),true);assert.equal(cursor.current(),'b');
 assert.equal(cursor.moveNext(),false);assert.throws(()=>cursor.current(),/no current/);cursor.dispose();
 const next=f.iteration.openIterator();assert.equal(cursor.moveNext(),false);assert.equal(cursor.current(),null);
 assert.equal(next.moveNext(),true);assert.equal(next.current(),'a');next.dispose();f.iteration.release();
});

for(const boundary of ['reuse','battleEnd','removed'])test('buff iterator manager closes every cursor on '+boundary,()=>{
 const f=buffIterationFixture(),a=f.iteration.openIterator(),b=f.iteration.openIterator();
 if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});else f.b.emit('removed',{unit:f.source});
 assert.equal(a.moveNext(),false);assert.equal(b.current(),null);assert.equal(f.iteration.openCount,0);assert.equal(f.iteration.openIterator(),null);
 a.dispose();b.dispose();assert.equal(f.iteration.openCount,0);assert.deepEqual(f.b.errors,[]);
});

test('buff snapshot failure rolls back acquisition and allows a later valid traversal',()=>{
 const f=fixture();let fail=true;
 const iteration=fearProjectileBuffIteration(f.b,{owner:f.source,readInternalEntries:()=>{if(fail)throw Error('snapshot');return['valid'];},copyEntry:x=>x,resolveEntry:x=>x});
 assert.throws(()=>iteration.openIterator(),/snapshot/);assert.equal(iteration.openCount,0);fail=false;
 const cursor=iteration.openIterator();assert.equal(cursor.moveNext(),true);assert.equal(cursor.current(),'valid');cursor.dispose();iteration.release();
});

test('owner retirement during snapshot copying leaves no phantom iterator counter',()=>{
 const f=fixture();const iteration=fearProjectileBuffIteration(f.b,{owner:f.source,readInternalEntries:()=>['entry'],
  copyEntry:()=>{f.source.deploySeq++;return'entry';},resolveEntry:x=>x});
 assert.equal(iteration.openIterator(),null);assert.equal(iteration.openCount,0);
});

test('recursive buff snapshot acquisition and recursive current locking cannot duplicate cursor work',()=>{
 const f=fixture();let iteration,cursor;
 iteration=fearProjectileBuffIteration(f.b,{owner:f.source,readInternalEntries:()=>{assert.equal(iteration.openIterator(),null);return['entry'];},
  copyEntry:x=>x,resolveEntry:x=>{assert.equal(cursor.current(),null);return x;}});
 cursor=iteration.openIterator();assert.equal(cursor.moveNext(),true);assert.equal(cursor.current(),'entry');cursor.dispose();iteration.release();
});

test('mode-change dispatch uses the shared outer snapshot through nested buff notifications and refreshes after disposal',()=>{
 const f=buffIterationFixture(),events=[];let nesting=false,nestedCalled=false;
 const callers={owner:f.source,openIterator:()=>f.iteration.openIterator(),isFinishedOrDisabled:()=>false,isActionValid:()=>true,
  runActions:buff=>{
   events.push((nesting?'inner:':'outer:')+buff);
   if(buff==='a'&&!nestedCalled){
    nestedCalled=true;f.entries.splice(0,2,'a','c');nesting=true;
    assert.equal(fearProjectileBuffModeChange(f.b,callers).run(),true);nesting=false;
   }
  },checkFinishedBuffs:()=>events.push('cleanup')};
 assert.equal(fearProjectileBuffModeChange(f.b,callers).run(),true);
 assert.deepEqual(events,['outer:a','inner:a','inner:b','cleanup','outer:b','cleanup']);assert.equal(f.iteration.openCount,0);
 events.length=0;assert.equal(fearProjectileBuffModeChange(f.b,callers).run(),true);
 assert.deepEqual(events,['outer:a','outer:c','cleanup']);assert.equal(f.iteration.openCount,0);f.iteration.release();
});

function buffModeFixture(overrides={}){
 const f=fixture(),events=[],buffs=[null,{id:'disabled',disabled:true,valid:true},{id:'empty',disabled:false,valid:false},{id:'ready',disabled:false,valid:true}];
 const callers={owner:f.source,openIterator:phase=>{
  events.push('open:'+phase);let index=-1;
  return{moveNext:()=>++index<buffs.length,current:()=>buffs[index],dispose:()=>events.push('dispose:'+phase)};
 },isFinishedOrDisabled:buff=>{events.push('state:'+buff.id);return buff.disabled;},
 isActionValid:(buff,event)=>{assert.equal(event,75);events.push('check:'+buff.id);return buff.valid;},
 runActions:(buff,options)=>{assert.deepEqual(options,{event:75,setTargetToOwner:false});events.push('run:'+buff.id);},
 checkFinishedBuffs:owner=>{assert.equal(owner,f.source);events.push('cleanup');},...overrides};
 return{...f,buffs,events,callers};
}

test('buff mode change probes eligibility then opens a fresh iterator and cleans finished buffs after disposal',()=>{
 const f=buffModeFixture(),dispatch=fearProjectileBuffModeChange(f.b,f.callers);
 assert.equal(dispatch.run(),true);assert.equal(dispatch.run(),null);
 assert.deepEqual(f.events,['open:probe','state:disabled','state:empty','check:empty','state:ready','check:ready','dispose:probe',
  'open:dispatch','state:disabled','state:empty','check:empty','state:ready','check:ready','run:ready','dispose:dispatch','cleanup']);
 assert.deepEqual(f.b.errors,[]);
});

test('an empty buff action probe skips dispatch and finished-buff cleanup',()=>{
 const f=buffModeFixture();f.buffs.at(-1).valid=false;
 assert.equal(fearProjectileBuffModeChange(f.b,f.callers).run(),false);
 assert.equal(f.events.includes('open:dispatch'),false);assert.equal(f.events.includes('cleanup'),false);assert.equal(f.events.at(-1),'dispose:probe');
});

test('probe iterator stops at the first eligible buff and does not inspect later entries',()=>{
 const f=buffModeFixture();f.buffs.splice(0,4,{id:'first',valid:true},{id:'later',valid:true});let phase;
 const open=f.callers.openIterator;f.callers.openIterator=p=>{phase=p;return open(p);};
 f.callers.isFinishedOrDisabled=b=>{if(phase==='probe'&&b.id==='later')throw Error('probe scanned beyond first match');return false;};
 assert.equal(fearProjectileBuffModeChange(f.b,f.callers).run(),true);assert.ok(f.events.includes('run:later'));
});

test('dispatch rereads buff action eligibility and does not reuse the probe result',()=>{
 const f=buffModeFixture();f.buffs.splice(0,4,{id:'changing',disabled:false,valid:true});let checks=0;
 f.callers.isActionValid=()=>++checks===1;
 assert.equal(fearProjectileBuffModeChange(f.b,f.callers).run(),true);assert.equal(checks,2);assert.equal(f.events.includes('run:changing'),false);
 assert.equal(f.events.at(-1),'cleanup');
});

test('probe disposal can change which buffs the fresh dispatch iterator sees',()=>{
 const f=buffModeFixture(),open=f.callers.openIterator;
 f.callers.openIterator=phase=>{const iterator=open(phase),dispose=iterator.dispose;iterator.dispose=()=>{
  dispose();if(phase==='probe')f.buffs.splice(0,4,{id:'replacement',disabled:false,valid:true});
 };return iterator;};
 assert.equal(fearProjectileBuffModeChange(f.b,f.callers).run(),true);assert.ok(f.events.includes('run:replacement'));assert.equal(f.events.includes('run:ready'),false);
});

test('a buff action exception disposes the dispatch iterator and skips later cleanup',()=>{
 const f=buffModeFixture({runActions:()=>{throw Error('buff action');}}),dispatch=fearProjectileBuffModeChange(f.b,f.callers);
 assert.throws(()=>dispatch.run(),/buff action/);assert.equal(f.events.at(-1),'dispose:dispatch');assert.equal(f.events.includes('cleanup'),false);assert.equal(dispatch.run(),null);
});

for(const point of ['isFinishedOrDisabled','isActionValid','runActions','checkFinishedBuffs'])for(const boundary of ['reuse','battleEnd','recursive'])
 test('buff mode change guards '+boundary+' in '+point,()=>{
  const f=buffModeFixture();let dispatch;const original=f.callers[point];f.callers[point]=(...args)=>{
   if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});else assert.equal(dispatch.run(),null);
   return boundary==='recursive'?original(...args):undefined;
  };
  dispatch=fearProjectileBuffModeChange(f.b,f.callers);assert.equal(dispatch.run(),boundary==='recursive'?true:null);
  assert.equal(dispatch.run(),null);assert.ok(f.events.some(e=>e.startsWith('dispose:')));assert.deepEqual(f.b.errors,[]);
 });

test('retirement during iterator acquisition closes a returned cursor without consuming it',()=>{
 const f=buffModeFixture(),dispatch=fearProjectileBuffModeChange(f.b,{...f.callers,openIterator:()=>{
  f.source.deploySeq++;return{moveNext:()=>{throw Error('replacement cursor');},current:()=>null,dispose:()=>f.events.push('closed')};
 }});
 assert.equal(dispatch.run(),null);assert.deepEqual(f.events,['closed']);
});

test('retirement inside a buff mode action stops enemy skill notifications and still disposes the cursor',()=>{
 const f=modeNotificationFixture(),buffEvents=[],buff={};
 f.callers.onBuffModeChanged=()=>fearProjectileBuffModeChange(f.b,{owner:f.source,
  openIterator:phase=>{let moved=false;return{moveNext:()=>{if(moved)return false;moved=true;return true;},current:()=>buff,
   dispose:()=>buffEvents.push('dispose:'+phase)};},
  isFinishedOrDisabled:()=>false,isActionValid:()=>true,runActions:()=>{buffEvents.push('retire');f.b.kill(f.source,null);},
  checkFinishedBuffs:()=>{throw Error('retired owner cleanup');}}).run();
 const notification=fearProjectileModeNotification(f.b,f.callers);
 assert.equal(notification.run(),null);assert.deepEqual(f.events,['restart','range']);
 assert.deepEqual(buffEvents,['dispose:probe','retire','dispose:dispatch']);assert.deepEqual(f.b.errors,[]);
});

function modeNotificationFixture(overrides={}){
 const f=fixture(),next={},last={},other={},events=[];
 const skills=[{id:'root',root:true,parent:next},{id:'old',root:false,parent:last},{id:'new',root:false,parent:next},{id:'other',root:false,parent:other}];
 const callers={owner:f.source,nextMode:next,lastMode:last,restartFsm:()=>{events.push('restart');return false;},
  onAttackRangeChanged:()=>events.push('range'),onBuffModeChanged:()=>events.push('buff'),readEnemySkills:()=>skills,
  isRootSkill:s=>s.root,readParentMode:s=>s.parent,sameMode:(a,b)=>a===b,
  attachSkill:s=>events.push('attach:'+s.id),detachSkill:s=>events.push('detach:'+s.id),...overrides};
 return{...f,next,last,other,skills,events,callers};
}

test('enemy mode notification runs Unit base notifications before processing nonroot skills in order',()=>{
 const f=modeNotificationFixture(),notification=fearProjectileModeNotification(f.b,f.callers);
 assert.equal(notification.run(),true);assert.equal(notification.run(),null);
 assert.deepEqual(f.events,['restart','range','buff','detach:old','attach:new']);assert.deepEqual(f.b.errors,[]);
});

test('next-mode match takes precedence over previous-mode equality',()=>{
 const f=modeNotificationFixture();f.callers.lastMode=f.next;
 assert.equal(fearProjectileModeNotification(f.b,f.callers).run(),true);
 assert.deepEqual(f.events,['restart','range','buff','attach:new']);
});

test('previous-mode comparison rereads a skill parent instead of caching the next-mode comparison value',()=>{
 const f=modeNotificationFixture();f.skills.splice(0,4,{id:'changed',root:false});let reads=0;
 f.callers.readParentMode=()=>++reads===1?f.other:f.last;
 assert.equal(fearProjectileModeNotification(f.b,f.callers).run(),true);assert.equal(reads,2);
 assert.deepEqual(f.events,['restart','range','buff','detach:changed']);
});

test('root skills skip both parent reads and attachment effects',()=>{
 const f=modeNotificationFixture();f.skills.splice(1);f.callers.readParentMode=()=>{throw Error('root parent read');};
 assert.equal(fearProjectileModeNotification(f.b,f.callers).run(),true);assert.deepEqual(f.events,['restart','range','buff']);
});

test('buff notification can replace the skill list before the enemy override reads it',()=>{
 const f=modeNotificationFixture();f.callers.onBuffModeChanged=()=>{f.events.push('buff');f.skills.splice(0,4,{id:'inserted',root:false,parent:f.next});};
 assert.equal(fearProjectileModeNotification(f.b,f.callers).run(),true);
 assert.deepEqual(f.events,['restart','range','buff','attach:inserted']);
});

test('enemy skill effects observe appended entries without filtering through unrelated ability validity',()=>{
 const f=modeNotificationFixture();f.skills.splice(0,4,{id:'first',root:false,parent:f.next});
 f.callers.attachSkill=s=>{f.events.push('attach:'+s.id);if(s.id==='first')f.skills.push({id:'appended',root:false,parent:f.next});};
 assert.equal(fearProjectileModeNotification(f.b,f.callers).run(),true);
 assert.deepEqual(f.events,['restart','range','buff','attach:first','attach:appended']);
});

for(const point of ['restartFsm','onAttackRangeChanged','onBuffModeChanged','isRootSkill','readParentMode','sameMode','detachSkill','attachSkill'])
 for(const boundary of ['reuse','battleEnd','recursive'])test('enemy mode notification guards '+boundary+' in '+point,()=>{
  const f=modeNotificationFixture();let notification;const original=f.callers[point];
  f.callers[point]=(...args)=>{
   if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});else assert.equal(notification.run(),null);
   return boundary==='recursive'?original(...args):undefined;
  };
  notification=fearProjectileModeNotification(f.b,f.callers);
  assert.equal(notification.run(),boundary==='recursive'?true:null);assert.equal(notification.run(),null);assert.deepEqual(f.b.errors,[]);
 });

test('invalid enemy notification predicates and null skill entries fail and retire their handler',()=>{
 for(const kind of ['predicate','entry']){
  const f=modeNotificationFixture();if(kind==='predicate')f.callers.isRootSkill=()=>1;else f.skills[0]=null;
  const notification=fearProjectileModeNotification(f.b,f.callers);
  assert.throws(()=>notification.run(),kind==='predicate'?/Boolean/:/cannot be null/);assert.equal(notification.run(),null);
 }
});

function modeEffectsFixture(operation,overrides={}){
 const f=fixture(),mode={},events=[],talents=[{id:'valid',valid:true,attached:operation==='inactivate'},
  {id:'invalid',valid:false,attached:true},{id:'unchanged',valid:true,attached:operation!=='inactivate'}],dynamic=['dynamic1','dynamic2'];
 const callers={owner:f.source,mode,operation,readTalents:()=>talents,readDynamicAbilities:()=>dynamic,
  isTalentValid:t=>t.valid,isTalentAttached:t=>t.attached,
  attachTalent:(t,owner)=>{assert.equal(owner,f.source);events.push('talent+'+t.id);t.attached=true;},
  detachTalent:t=>{events.push('talent-'+t.id);t.attached=false;},
  attachAbility:(a,owner)=>{assert.equal(owner,f.source);events.push('ability+'+a);},
  detachAbility:a=>events.push('ability-'+a),...overrides};
 return{...f,mode,events,talents,dynamic,callers};
}

for(const operation of ['activate','inactivate'])test('mode '+operation+' applies eligible talent effects before dynamic ability effects',()=>{
 const f=modeEffectsFixture(operation),effects=fearProjectileModeEffects(f.b,f.callers),sign=operation==='activate'?'+':'-';
 assert.equal(effects.run(),true);assert.equal(effects.run(),null);
 assert.deepEqual(f.events,['talent'+sign+'valid','ability'+sign+'dynamic1','ability'+sign+'dynamic2']);
 assert.deepEqual(f.b.errors,[]);
});

test('initial mode activation skips talent predicates and still attaches dynamic abilities',()=>{
 const unexpected=()=>{throw Error('initial talent scan');};
 const f=modeEffectsFixture('activate',{isInit:true,readTalents:unexpected,isTalentValid:unexpected,isTalentAttached:unexpected});
 assert.equal(fearProjectileModeEffects(f.b,f.callers).run(),true);assert.deepEqual(f.events,['ability+dynamic1','ability+dynamic2']);
});

test('mode activation rereads the talent entry after validity and attachment predicates',()=>{
 const f=modeEffectsFixture('activate'),original=f.talents[0],middle={id:'middle',valid:true,attached:false},last={id:'last',valid:true,attached:false};
 f.talents.splice(1);f.dynamic.length=0;
 f.callers.isTalentValid=t=>{assert.equal(t,original);f.talents[0]=middle;return true;};
 f.callers.isTalentAttached=t=>{assert.equal(t,middle);f.talents[0]=last;return false;};
 assert.equal(fearProjectileModeEffects(f.b,f.callers).run(),true);assert.deepEqual(f.events,['talent+last']);
});

test('mode inactivation keeps its captured talent entry through validity and attachment predicates',()=>{
 const f=modeEffectsFixture('inactivate'),original=f.talents[0],other={id:'other',valid:true,attached:true};
 f.talents.splice(1);f.dynamic.length=0;
 f.callers.isTalentValid=t=>{assert.equal(t,original);f.talents[0]=other;return true;};
 f.callers.isTalentAttached=t=>{assert.equal(t,original);return true;};
 assert.equal(fearProjectileModeEffects(f.b,f.callers).run(),true);assert.deepEqual(f.events,['talent-valid']);assert.equal(other.attached,true);
});

test('dynamic ability callbacks observe collection growth without filtering entries through talent validity',()=>{
 const f=modeEffectsFixture('activate');f.talents.length=0;f.dynamic.splice(1);
 f.callers.attachAbility=a=>{f.events.push(a);if(a==='dynamic1')f.dynamic.push('appended');};
 assert.equal(fearProjectileModeEffects(f.b,f.callers).run(),true);assert.deepEqual(f.events,['dynamic1','appended']);
});

for(const operation of ['activate','inactivate'])for(const boundary of ['reuse','battleEnd','recursive'])
 test('mode '+operation+' handles '+boundary+' during talent effects before reaching dynamic abilities',()=>{
  const f=modeEffectsFixture(operation);let effects;
  const effect=()=>{if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});else assert.equal(effects.run(),null);};
  f.callers[operation==='activate'?'attachTalent':'detachTalent']=effect;
  effects=fearProjectileModeEffects(f.b,f.callers);assert.equal(effects.run(),boundary==='recursive'?true:null);
  assert.equal(f.events.some(e=>e.startsWith('ability')),boundary==='recursive');assert.deepEqual(f.b.errors,[]);
 });

function modeFixture(overrides={}){
 const f=fixture(),events=[],old={abilities:['attack','attack',null,'general']},next={abilities:['empty']};
 let current=old;
 const pose={x:1,y:0};
 const callers={owner:f.source,nextMode:next,readCurrentMode:()=>current,sameMode:(a,b)=>a===b,isModeValid:x=>x!=null,
  readFacing:()=>pose,readBodyDirection:()=>pose,readAbilities:mode=>mode.abilities,
  detachAbility:a=>events.push('detach:'+a),onInactivate:()=>events.push('inactive'),
  setModeActive:(mode,value)=>events.push((mode===old?'old':'new')+':'+value),
  writeCurrentMode:(_owner,mode)=>{current=mode;events.push('write');},readStartIniting:()=>true,
  attachAbility:(a,owner)=>{assert.equal(owner,f.source);events.push('attach:'+a);},
  onActivate:(mode,last,options)=>{assert.equal(mode,next);assert.equal(last,old);assert.deepEqual(options,{isInit:false});events.push('activate');},
  onSwitchMode:(_owner,mode,last,options)=>{assert.equal(mode,next);assert.equal(last,old);assert.deepEqual(options,{restartFSM:true});events.push('notify');pose.x=0;},
  faceTo:(_owner,value,options)=>{assert.deepEqual(value,{x:1,y:0});assert.deepEqual(options,{force:true});events.push('face');},
  setBodyDirection:(_owner,value,options)=>{assert.deepEqual(value,{x:1,y:0});assert.deepEqual(options,{force:true});events.push('direction');},...overrides};
 return{...f,events,old,next,callers,get current(){return current;},set current(value){current=value;}};
}

test('mode handoff composes static, talent and dynamic effects before notification without attaching new static abilities outside startIniting',()=>{
 const f=modeFixture({readStartIniting:()=>false});
 f.old.abilities=['old-static'];f.next.abilities=['new-static'];
 f.old.talents=[{id:'old-talent',attached:true}];f.next.talents=[{id:'new-talent',attached:false}];
 f.old.dynamic=['old-dynamic'];f.next.dynamic=['new-dynamic'];
 const effects=(mode,operation)=>fearProjectileModeEffects(f.b,{owner:f.source,mode,operation,
  readTalents:m=>m.talents,readDynamicAbilities:m=>m.dynamic,isTalentValid:()=>true,isTalentAttached:t=>t.attached,
  attachTalent:t=>{t.attached=true;f.events.push('talent+'+t.id);},detachTalent:t=>{t.attached=false;f.events.push('talent-'+t.id);},
  attachAbility:a=>f.events.push('dynamic+'+a),detachAbility:a=>f.events.push('dynamic-'+a)}).run();
 f.callers.onInactivate=mode=>effects(mode,'inactivate');f.callers.onActivate=mode=>effects(mode,'activate');
 assert.equal(fearProjectileModeSwitch(f.b,f.callers).run(),true);
 assert.deepEqual(f.events,['detach:old-static','talent-old-talent','dynamic-old-dynamic','old:false','write','new:true',
  'talent+new-talent','dynamic+new-dynamic','notify','face','direction']);
 assert.equal(f.old.talents[0].attached,false);assert.equal(f.next.talents[0].attached,true);
});

test('null dynamic ability entries fail rather than silently passing a validity filter',()=>{
 const f=modeEffectsFixture('activate');f.talents.length=0;f.dynamic.splice(0,2,null);
 const effects=fearProjectileModeEffects(f.b,f.callers);
 assert.throws(()=>effects.run(),/cannot be null/);assert.equal(effects.run(),null);assert.deepEqual(f.events,[]);
});

test('mode handoff detaches duplicate ability entries before inactivation and preserves captured pose through notification',()=>{
 const f=modeFixture(),handoff=fearProjectileModeSwitch(f.b,f.callers);
 assert.equal(handoff.run(),true);assert.equal(handoff.run(),null);assert.equal(f.current,f.next);
 assert.deepEqual(f.events,['detach:attack','detach:attack','detach:general','inactive','old:false','write','new:true','attach:empty','activate','notify','face','direction']);
 assert.deepEqual(f.b.errors,[]);
});

test('mode attachment uses startIniting, while activation and notification still run when that gate is false',()=>{
 const f=modeFixture({readStartIniting:()=>false});
 assert.equal(fearProjectileModeSwitch(f.b,f.callers).run(),true);
 assert.equal(f.events.some(e=>e.startsWith('attach:')),false);assert.ok(f.events.includes('activate'));assert.ok(f.events.includes('notify'));
});

test('same-mode nonforced switch returns false before pose reads or mode effects',()=>{
 const f=modeFixture();f.current=f.next;f.callers.readFacing=()=>{throw Error('no pose read');};
 assert.equal(fearProjectileModeSwitch(f.b,f.callers).run(),false);assert.deepEqual(f.events,[]);
});

test('inactivation may change currentMode before native lastMode is sampled for activation and notification',()=>{
 const f=modeFixture(),replacement={abilities:[]};
 f.callers.onInactivate=()=>{f.current=replacement;};
 f.callers.onActivate=(_mode,last)=>assert.equal(last,replacement);
 f.callers.onSwitchMode=(_owner,_mode,last)=>assert.equal(last,replacement);
 assert.equal(fearProjectileModeSwitch(f.b,f.callers).run(),true);assert.equal(f.current,f.next);
});

test('mode is sampled after pose reads before inactivation, rather than using the earlier equality-check value',()=>{
 const f=modeFixture(),replacement={abilities:['changed']};
 f.callers.readBodyDirection=()=>{f.current=replacement;return{x:1,y:0};};
 f.callers.onInactivate=mode=>assert.equal(mode,replacement);
 f.callers.onActivate=(_mode,last)=>assert.equal(last,replacement);
 f.callers.onSwitchMode=(_owner,_mode,last)=>assert.equal(last,replacement);
 assert.equal(fearProjectileModeSwitch(f.b,f.callers).run(),true);
 assert.deepEqual(f.events.slice(0,2),['detach:changed','new:false']);
});

test('self-death composes mode detachment and saved-state restart before immunity and zero HP',()=>{
 const f=modeFixture({readStartIniting:()=>false});let state=12;
 const restart=fearProjectileModeFsmRestart(f.b,{owner:f.source,isRunning:()=>true,readState:()=>state,
  stop:()=>{f.events.push('stop');state=-1;},start:(_owner,saved)=>{f.events.push('start');state=saved;}});
 f.callers.onSwitchMode=()=>restart.run();
 const handoff=fearProjectileModeSwitch(f.b,f.callers);
 const suicide=fearProjectileSuicide(f.b,{target:f.source,readAlive:()=>f.source.alive,
  markSuicide:()=>f.events.push('suicide'),setHpInternal:()=>{f.events.push('zero HP');f.source.alive=false;}});
 const activation=fearProjectileSelfDeathActivation(f.b,{owner:f.source,readAbnormalFlag:()=>false,readAbnormalCombo:()=>false,
  switchMode:()=>handoff.run(),createImmunityBuff:()=>{f.events.push('immunity');return true;},instantKill:()=>suicide.run()});
 assert.equal(activation.run(),false);assert.equal(state,12);assert.equal(f.current,f.next);assert.equal(f.source.alive,false);
 assert.deepEqual(f.events,['detach:attack','detach:attack','detach:general','inactive','old:false','write','new:true','activate','stop','start','face','direction','immunity','suicide','zero HP']);
});

test('mode ability iteration observes appended entries rather than snapshotting or deduplicating the initialized array',()=>{
 const f=modeFixture();f.old.abilities=['first'];
 f.callers.detachAbility=a=>{f.events.push('detach:'+a);if(a==='first')f.old.abilities.push('appended');};
 assert.equal(fearProjectileModeSwitch(f.b,f.callers).run(),true);
 assert.deepEqual(f.events.slice(0,2),['detach:first','detach:appended']);
});

for(const point of ['detachAbility','onInactivate','writeCurrentMode','attachAbility','onActivate','onSwitchMode','faceTo'])
 for(const boundary of ['reuse','battleEnd'])test('mode switch stops at '+point+' on '+boundary,()=>{
  const f=modeFixture();f.callers[point]=()=>{if(boundary==='reuse')f.source.deploySeq++;else f.b.emit('battleEnd',{});};
  const handoff=fearProjectileModeSwitch(f.b,f.callers);
  assert.equal(handoff.run(),null);assert.equal(handoff.run(),null);assert.equal(f.events.includes('direction'),false);assert.deepEqual(f.b.errors,[]);
 });

test('mode handoff rejects reentry during detachment without losing the original transition',()=>{
 const f=modeFixture();let handoff;f.callers.detachAbility=()=>assert.equal(handoff.run(),null);
 handoff=fearProjectileModeSwitch(f.b,f.callers);assert.equal(handoff.run(),true);assert.equal(f.events.at(-1),'direction');
});

test('mode restart preserves the state captured before Stop changes the state machine',()=>{
 const f=fixture(),events=[];let state=42,running=true;
 const restart=fearProjectileModeFsmRestart(f.b,{owner:f.source,isRunning:()=>running,readState:()=>state,
  stop:owner=>{assert.equal(owner,f.source);events.push('stop:'+state);state=-1;running=false;},
  start:(owner,saved)=>{assert.equal(owner,f.source);events.push('start:'+saved);state=saved;running=true;}});
 assert.equal(restart.run(),true);assert.equal(state,42);assert.equal(running,true);
 assert.deepEqual(events,['stop:42','start:42']);assert.equal(restart.run(),null);
});

test('mode restart does not start a stopped state machine or read an arbitrary default state',()=>{
 const f=fixture();const unexpected=()=>{throw Error('stopped FSM');};
 const restart=fearProjectileModeFsmRestart(f.b,{owner:f.source,isRunning:()=>false,readState:unexpected,stop:unexpected,start:unexpected});
 assert.equal(restart.run(),false);assert.equal(restart.run(),null);
});

for(const boundary of ['reuse','battleEnd','recursive'])test('mode FSM restart guards '+boundary+' while stopping',()=>{
 const f=fixture();let starts=0,restart;
 restart=fearProjectileModeFsmRestart(f.b,{owner:f.source,isRunning:()=>true,readState:()=>7,
  stop:()=>{if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});
   else assert.equal(restart.run(),null);},start:()=>starts++});
 assert.equal(restart.run(),boundary==='recursive'?true:null);assert.equal(starts,boundary==='recursive'?1:0);
 assert.deepEqual(f.b.errors,[]);
});

test('selected mode restart can precede immunity and suicide without changing its saved FSM state',()=>{
 const f=fixture(),events=[];let state=12;
 const restart=fearProjectileModeFsmRestart(f.b,{owner:f.source,isRunning:()=>true,readState:()=>state,
  stop:()=>{events.push('stop');state=-1;},start:(_owner,saved)=>{events.push('start');state=saved;}});
 const activation=fearProjectileSelfDeathActivation(f.b,{owner:f.source,readAbnormalFlag:()=>false,readAbnormalCombo:()=>false,
  switchMode:()=>{events.push('mode1');restart.run();return true;},
  createImmunityBuff:()=>{events.push('immunity');return true;},instantKill:()=>{events.push('suicide');return false;}});
 assert.equal(activation.run(),false);assert.equal(state,12);assert.deepEqual(events,['mode1','stop','start','immunity','suicide']);
});

test('native self-death activation binds TARGET and BUFF_OWNER to the owner despite an incoming different target',()=>{
 const f=fixture(),events=[];
 const activation=fearProjectileSelfDeathActivation(f.b,{owner:f.source,target:f.target,buffOwner:f.target,
  readAbnormalFlag:unit=>{assert.equal(unit,f.source);return false;},readAbnormalCombo:unit=>{assert.equal(unit,f.source);return false;},
  switchMode:unit=>{assert.equal(unit,f.source);events.push('mode1');return true;},
  createImmunityBuff:unit=>{assert.equal(unit,f.source);events.push('immunity');return true;},
  instantKill:unit=>{assert.equal(unit,f.source);events.push('suicide');return false;}});
 assert.equal(activation.run(),false);assert.equal(activation.run(),null);assert.deepEqual(events,['mode1','immunity','suicide']);
 assert.equal(f.target.alive,true);
});

test('activation binds its original owner life and never redirects the action chain to a reused body',()=>{
 const f=fixture();let callbacks=0;
 const activation=fearProjectileSelfDeathActivation(f.b,{owner:f.source,readAbnormalFlag:()=>{callbacks++;return false;},
  readAbnormalCombo:()=>false,switchMode:()=>true,createImmunityBuff:()=>true,instantKill:()=>true});
 f.source.deploySeq++;assert.equal(activation.run(),null);assert.equal(callbacks,0);
});

test('selected InstantKill marks suicide before forced zero HP and returns the post-action alive state',()=>{
 const f=fixture(),events=[];
 const suicide=fearProjectileSuicide(f.b,{target:f.source,readAlive:unit=>{events.push('alive');return unit.alive;},
  markSuicide:unit=>{assert.equal(unit,f.source);events.push('suicide');},
  setHpInternal:(unit,options)=>{
   assert.equal(unit,f.source);assert.deepEqual(options,{valueRaw:0n,force:true,noSource:false,skipReborn:false});
   events.push('zero HP');unit.alive=false;
  }});
 assert.equal(suicide.run(),false);assert.deepEqual(events,['alive','suicide','zero HP','alive']);assert.equal(suicide.run(),null);
});

test('already non-alive suicide target receives no mark or HP write but preserves final alive query',()=>{
 const f=fixture();f.source.alive=false;let reads=0;
 const suicide=fearProjectileSuicide(f.b,{target:f.source,readAlive:()=>{reads++;return false;},
  markSuicide:()=>{throw Error('dead target');},setHpInternal:()=>{throw Error('dead target');}});
 assert.equal(suicide.run(),false);assert.equal(reads,2);
});

for(const boundary of ['reuse','battleEnd','recursive'])test('suicide primitive guards '+boundary+' while marking its target',()=>{
 const f=fixture();let writes=0,suicide;
 suicide=fearProjectileSuicide(f.b,{target:f.source,readAlive:()=>true,markSuicide:()=>{
  if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});
  else assert.equal(suicide.run(),null);
 },setHpInternal:()=>writes++});
 assert.equal(suicide.run(),boundary==='recursive'?true:null);assert.equal(writes,boundary==='recursive'?1:0);
 assert.deepEqual(f.b.errors,[]);
});

test('self-death chain retains false native return after zero-HP death rather than treating it as a failed action',()=>{
 const f=fixture(),events=[];
 const suicide=fearProjectileSuicide(f.b,{target:f.source,readAlive:unit=>unit.alive,
  markSuicide:()=>events.push('suicide'),setHpInternal:unit=>{events.push('zero HP');unit.alive=false;}});
 const action=fearProjectileSelfDeath(f.b,{buffOwner:f.source,target:f.source,readAbnormalFlag:()=>false,
  readAbnormalCombo:()=>false,switchMode:()=>{events.push('mode1');return true;},
  createImmunityBuff:()=>{events.push('immunity');return true;},instantKill:()=>suicide.run()});
 assert.equal(action.run(),false);assert.equal(f.source.alive,false);assert.deepEqual(events,['mode1','immunity','suicide','zero HP']);
});

function selfDeathFixture(overrides={}){
 const f=fixture(),events=[];
 const action=fearProjectileSelfDeath(f.b,{buffOwner:f.source,target:f.source,
  readAbnormalFlag:(_unit,flag)=>{events.push(flag);return false;},
  readAbnormalCombo:(_unit,combo)=>{events.push(combo);return false;},
  switchMode:(_unit,options)=>{events.push(options);return true;},
  createImmunityBuff:()=>{events.push('immunity');return true;},instantKill:(_unit,options)=>{events.push(options);return true;},...overrides});
 return{...f,action,events};
}

test('self-death action order switches mode then creates immunity before invoking explicit kill semantics',()=>{
 const f=selfDeathFixture();assert.equal(f.action.run(),true);
 assert.deepEqual(f.events.slice(0,4),['LEVITATE','FROZEN','STUNNED','SLEEPING']);
 assert.deepEqual(f.events[4],{modeIndex:1,loadModeFromBlackboard:false,restoreDefault:false,restartFSM:true});
 assert.equal(f.events[5],'immunity');assert.deepEqual(f.events[6],{killSource:false,noSource:false,
  withdrawIfRallyPoint:false,resultIfInRallyPointMode:false,skipReborn:false,noReason:false,markReachExit:false,switchState:false});
 assert.equal(f.action.run(),null);
});

for(const flag of ['LEVITATE','FROZEN','STUNNED','SLEEPING'])test('failed '+flag+' unset check stops before mode switch and never reaches AlwaysNext',()=>{
 const f=selfDeathFixture({readAbnormalFlag:(_unit,key)=>key===flag,readAbnormalCombo:(_unit,key)=>key===flag});
 assert.equal(f.action.run(),false);assert.deepEqual(f.events,[]);
});

test('a failed mode switch stops before immunity and kill',()=>{
 const f=selfDeathFixture({switchMode:()=>false});assert.equal(f.action.run(),false);
 assert.deepEqual(f.events,['LEVITATE','FROZEN','STUNNED','SLEEPING']);
});

test('AlwaysNext after immunity creation permits kill even when that creation fails',()=>{
 const f=selfDeathFixture({createImmunityBuff:()=>{f.events.push('rejected immunity');return false;}});
 assert.equal(f.action.run(),true);assert.equal(f.events[5],'rejected immunity');assert.equal(f.events[6].killSource,false);
});

test('self-death action preserves separate BUFF_OWNER and TARGET contexts',()=>{
 const f=fixture(),events=[];
 const action=fearProjectileSelfDeath(f.b,{buffOwner:f.source,target:f.target,
  readAbnormalFlag:unit=>{assert.equal(unit,f.source);return false;},
  readAbnormalCombo:unit=>{assert.equal(unit,f.source);return false;},
  switchMode:unit=>{assert.equal(unit,f.target);events.push('mode');return true;},
  createImmunityBuff:unit=>{assert.equal(unit,f.source);events.push('immunity');return true;},
  instantKill:unit=>{assert.equal(unit,f.target);events.push('kill');return true;}});
 assert.equal(action.run(),true);assert.deepEqual(events,['mode','immunity','kill']);
});

for(const boundary of ['reuse','battleEnd','recursive'])test('self-death action guards '+boundary+' during mode switching',()=>{
 let f;f=selfDeathFixture({switchMode:()=>{
  if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});
  else assert.equal(f.action.run(),null);return true;
 }});
 assert.equal(f.action.run(),boundary==='recursive'?true:null);
 assert.equal(f.events.includes('immunity'),boundary==='recursive');assert.deepEqual(f.b.errors,[]);
});

function spellFixture(overrides={}){
 const f=fixture(),events=[];
 const spell=fearProjectileSpell(f.b,{owner:f.source,onSpellStart:()=>{events.push('start');return true;},
  isCasting:()=>{events.push('casting');return true;},emitSpellEnd:({event,spellCount})=>{
   assert.equal(event,5);assert.equal(spellCount,1);events.push('end');},
  mayBeginPostDelay:()=>{events.push('canPost');return true;},beginPostDelay:()=>events.push('post'),...overrides});
 return{...f,spell,events};
}

test('single-spell continuation launches before event5 and checks post-delay afterward',()=>{
 const f=spellFixture();assert.deepEqual(f.spell.run(),{started:true,spellEnd:true,postDelay:true});
 assert.deepEqual(f.events,['start','casting','end','canPost','post']);assert.equal(f.spell.run(),null);
});

for(const [key,expected]of [['onSpellStart',{started:false,spellEnd:false,postDelay:false}],
 ['isCasting',{started:true,spellEnd:false,postDelay:false}],['mayBeginPostDelay',{started:true,spellEnd:true,postDelay:false}]])
test('spell continuation preserves the false '+key+' gate',()=>{
 const f=spellFixture({[key]:()=>false});assert.deepEqual(f.spell.run(),expected);
 assert.equal(f.events.includes('post'),false);if(key!=='mayBeginPostDelay')assert.equal(f.events.includes('end'),false);
});

test('event5 owner removal prevents post-delay without suppressing the completed spell event',()=>{
 let f;f=spellFixture({emitSpellEnd:()=>{f.events.push('end');f.b.kill(f.source,null);}});
 assert.deepEqual(f.spell.run(),{started:true,spellEnd:true,postDelay:false});
 assert.deepEqual(f.events,['start','casting','end']);assert.equal(f.spell.run(),null);assert.deepEqual(f.b.errors,[]);
});

test('recursive spell continuations cannot duplicate launch or spell-end callbacks',()=>{
 let f;f=spellFixture({onSpellStart:()=>{assert.equal(f.spell.run(),null);f.events.push('start');return true;},
  emitSpellEnd:()=>{assert.equal(f.spell.run(),null);f.events.push('end');}});
 f.spell.run();assert.deepEqual(f.events,['start','casting','end','canPost','post']);
});

test('owner reuse while testing casting prevents spell-end and post-delay for the replacement',()=>{
 let f;f=spellFixture({isCasting:()=>{f.source.deploySeq++;return true;}});
 assert.equal(f.spell.run(),null);assert.deepEqual(f.events,['start']);
});

test('bounded wait, initialized modes, event5 self-death and independent flight compose without canceling born damage',()=>{
 const f=modeFixture({readStartIniting:()=>false});f.source.base.atk=175;f.source.markDirty();f.target.nativeUid=1;
 const graph=read('data/candidates/arkpedia-windows-fear-self-death-source.json').modeSwitch.graph;
 for(const [role,mode]of [['mode0',f.old],['mode1',f.next]]){
  const native=JSON.parse(graph[role].component.originalJson),resolve=ref=>ref.m_PathID==='0'?null:ref.m_PathID;
  mode.abilities=fearProjectileCollectModeAbilities({generalAbilities:native._generalAbilities.map(resolve),combat:resolve(native._combat),
   attack:resolve(native._attack),isValid:x=>x!==null,equals:(a,b)=>a===b});
 }
 let state=12,casting=true;
 const restart=fearProjectileModeFsmRestart(f.b,{owner:f.source,isRunning:()=>true,readState:()=>state,
  stop:()=>{state=-1;},start:(_owner,saved)=>{state=saved;}});
 const detached=[];f.callers.detachAbility=ability=>{detached.push(ability);casting=false;};
 const skillEvents=[],skills=[{root:true,parent:f.old},{root:false,parent:f.old},{root:false,parent:f.next}];
 f.callers.onSwitchMode=(_owner,nextMode,lastMode)=>fearProjectileModeNotification(f.b,{owner:f.source,nextMode,lastMode,
  restartFsm:()=>restart.run(),onAttackRangeChanged:()=>skillEvents.push('range'),onBuffModeChanged:()=>skillEvents.push('buff'),
  readEnemySkills:()=>skills,isRootSkill:s=>s.root,readParentMode:s=>s.parent,sameMode:(a,b)=>a===b,
  attachSkill:()=>skillEvents.push('attach'),detachSkill:()=>skillEvents.push('detach')}).run();
 const handoff=fearProjectileModeSwitch(f.b,f.callers);
 const suicide=fearProjectileSuicide(f.b,{target:f.source,readAlive:()=>f.source.alive,markSuicide:()=>{},
  setHpInternal:()=>f.b.kill(f.source,null)});
 const activation=fearProjectileSelfDeathActivation(f.b,{owner:f.source,readAbnormalFlag:()=>false,readAbnormalCombo:()=>false,
  switchMode:()=>handoff.run(),createImmunityBuff:()=>true,instantKill:()=>suicide.run()});
 const source=fearProjectileSourceReference(f.b,f.source),damage=fearProjectileDamageAction(f.b,source),events=[];
 let flight;
 const spell=fearProjectileSpell(f.b,{owner:f.source,onSpellStart:()=>{
  events.push('birth');flight=fearProjectileFlight(f.b,{from:{x:0,y:0,z:0},initialTarget:{x:1,y:0,z:0},
   resolveTargetPosition:()=>null,resolveTraceTarget:()=>f.target,
   area:{queryOverlaps:()=>[f.target],resolveEntity:u=>u,readUid:u=>u.nativeUid,isCandidate:()=>true,
    verifyTarget:()=>true,deterministic:true,resolveSource:source.resolveSource,onSelected:()=>{}},
   runHit:({target})=>applyFearProjectileImpact(f.b,{source:f.source,target,applyAttachments:()=>{},runActions:damage}),
   onStopped:()=>{},scheduleCompletion:()=>()=>{}});return true;
 },isCasting:()=>casting,emitSpellEnd:()=>{events.push('event5');assert.equal(activation.run(),null);},
 mayBeginPostDelay:()=>{throw Error('removed owner');},beginPostDelay:()=>{throw Error('removed owner');}});
 const wait=fearProjectileAttackWait(f.b,{owner:f.source,cachedDurationRaw:fpOne,readDeltaPlayTime:()=>1,
  isCastActive:()=>true,subscribeAttackEvent:()=>()=>{},onReady:()=>spell.run()});
 wait.resume();assert.equal(flight,undefined);wait.resume();assert.deepEqual(events,['birth','event5']);
 assert.equal(state,12);assert.equal(casting,false);assert.equal(f.current,f.next);
 assert.deepEqual(skillEvents,['range','buff','detach','attach']);
 assert.deepEqual(detached,['-5760848500668714718','4729572091462136098']);
 const hp=f.target.hp;flight.advance(fpOne/10n,fpOne);assert.equal(hp-f.target.hp,175);
 assert.ok(f.target.findBuff(parentKey));assert.equal(wait.resume(),null);assert.equal(spell.run(),null);
 flight.release();source.release();assert.deepEqual(f.b.errors,[]);
});

test('cast wait frame conversion rounds FP quotient ties to even and clamps to one',()=>{
 for(const [raw,expected]of [[fpOne,1],[3n*fpOne/2n,2],[5n*fpOne/2n,2],[7n*fpOne/2n,4],
  [0n,1],[-5n*fpOne/2n,1]])assert.equal(fearProjectileWaitFrameCount(raw,1),expected);
 assert.equal(fearProjectileWaitFrameCount(fpOne,1/30),30);
 assert.equal(fearProjectileWaitFrameCount(3n*fpOne,1/30),90);
 assert.equal(fearProjectileWaitFrameCount(fpOne,.25),4);
 assert.equal(fearProjectileWaitFrameCount(fpOne,0),1);
 assert.equal(fearProjectileWaitFrameCount(fpOne,Number.MIN_VALUE),1);
});

test('FP division raw rounding can change a later halfway frame decision',()=>{
 assert.equal(fearProjectileWaitFrameCount(5n*fpOne,2),2);
 assert.equal(fearProjectileWaitFrameCount(5n*fpOne+1n,2),3);
 assert.equal(fearProjectileWaitFrameCount(5n*fpOne-1n,2),2);
 // One division overflow result rounds through signed64 and low32 conversion.
 assert.equal(fearProjectileWaitFrameCount((1n<<63n)-1n,2**-32),1);
 for(const raw of [1,1n<<63n,-(1n<<63n)-1n])assert.throws(()=>fearProjectileWaitFrameCount(raw,.1),/Q32.32/);
 for(const delta of [NaN,Infinity,2**31])assert.throws(()=>fearProjectileWaitFrameCount(fpOne,delta),/deltaPlayTime/);
});

test('computed native count drives timeout without using the visual clip duration',()=>{
 const count=fearProjectileWaitFrameCount(fpOne,.25),f=castWaitFixture({frameCount:count});
 assert.equal(count,4);assert.equal(f.wait.resume().waiting,true);
 for(let i=1;i<count;i++)assert.equal(f.wait.resume().waiting,true);
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'timeout'});assert.equal(f.wait.framesWaited,4);
});

function castWaitFixture({frameCount=3,...overrides}={}){
 const f=fixture(),events=[];let receive=()=>{},unsubscribed=0;
 const wait=fearProjectileAttackWait(f.b,{owner:f.source,cachedDurationRaw:BigInt(frameCount)*fpOne,readDeltaPlayTime:()=>1,isCastActive:()=>true,
  subscribeAttackEvent:({owner,event,onEvent})=>{
   assert.equal(owner,f.source);assert.equal(event,19);receive=onEvent;events.push('subscribe');
   return()=>{unsubscribed++;events.push('unsubscribe');};
  },onReady:({cause})=>events.push(cause),...overrides});
 return{...f,events,wait,receive:()=>receive(),get unsubscribed(){return unsubscribed;}};
}

test('cast wait samples deltaPlayTime once at first resume and freezes its native frame limit',()=>{
 let delta=.25,reads=0,duration=3n*fpOne;
 const f=castWaitFixture({cachedDurationRaw:duration,readDeltaPlayTime:()=>{reads++;return delta;}});
 assert.equal(reads,0);duration=99n*fpOne;delta=2;
 assert.deepEqual(f.wait.resume(),{waiting:true,index:0,frameCount:2});assert.equal(reads,1);
 delta=.01;assert.deepEqual(f.wait.resume(),{waiting:true,index:1,frameCount:2});
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'timeout'});assert.equal(reads,1);
});

test('attack registration precedes timing sampling and an event during sampling still yields',()=>{
 let f,reads=0;f=castWaitFixture({readDeltaPlayTime:()=>{
  assert.deepEqual(f.events,['subscribe']);f.receive();reads++;
  assert.equal(f.wait.resume(),null);return .1;
 }});
 assert.deepEqual(f.wait.resume(),{waiting:true,index:0,frameCount:30});
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'event'});assert.equal(reads,1);
 assert.deepEqual(f.events,['subscribe','unsubscribe','event']);
});

test('cancellation during native timing sampling removes the attack subscription without readiness',()=>{
 let f;f=castWaitFixture({readDeltaPlayTime:()=>{f.b.emit('battleEnd',{});return NaN;}});
 assert.equal(f.wait.resume(),null);assert.equal(f.wait.resume(),null);assert.equal(f.unsubscribed,1);
 assert.deepEqual(f.events,['subscribe','unsubscribe']);assert.deepEqual(f.b.errors,[]);
});

test('invalid sampled timing closes the wait and cannot leave a live attack-event handler',()=>{
 const f=castWaitFixture({readDeltaPlayTime:()=>Infinity});
 assert.throws(()=>f.wait.resume(),/deltaPlayTime/);assert.equal(f.unsubscribed,1);
 f.receive();assert.equal(f.wait.resume(),null);assert.deepEqual(f.events,['subscribe','unsubscribe']);
});

test('event-free selected cast reaches its bounded wait limit without inventing an attack event',()=>{
 const f=castWaitFixture();assert.deepEqual(f.wait.resume(),{waiting:true,index:0,frameCount:3});
 assert.deepEqual(f.wait.resume(),{waiting:true,index:1,frameCount:3});
 assert.deepEqual(f.wait.resume(),{waiting:true,index:2,frameCount:3});
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'timeout'});
 assert.deepEqual(f.events,['subscribe','unsubscribe','timeout']);assert.equal(f.wait.resume(),null);
 assert.equal(f.unsubscribed,1);
});

test('attack event releases the wait on resumption and unsubscribes before readiness',()=>{
 const f=castWaitFixture();f.wait.resume();f.receive();f.receive();
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'event'});f.receive();assert.equal(f.wait.resume(),null);
 assert.deepEqual(f.events,['subscribe','unsubscribe','event']);assert.equal(f.wait.framesWaited,0);
});

test('event received during subscription still yields before the bounded wait can finish',()=>{
 let unsubscribed=0;const f=castWaitFixture({frameCount:1,subscribeAttackEvent:({onEvent})=>{onEvent();return()=>unsubscribed++;}});
 assert.equal(f.wait.resume().waiting,true);assert.deepEqual(f.events,[]);
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'event'});assert.equal(unsubscribed,1);
});

test('selected target death does not cancel the wait or fabricate readiness before timeout',()=>{
 const f=castWaitFixture({frameCount:1});f.wait.resume();f.b.kill(f.target,null);
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'timeout'});assert.deepEqual(f.events,['subscribe','unsubscribe','timeout']);
});

for(const boundary of ['ownerReuse','ownerRemoval','battleEnd','castInactive'])test('cast wait cancels on '+boundary+' without launch readiness',()=>{
 let active=true;const f=castWaitFixture({isCastActive:()=>active});f.wait.resume();
 if(boundary==='ownerReuse')f.source.deploySeq++;
 else if(boundary==='ownerRemoval')f.b.emit('removed',{unit:f.source});
 else if(boundary==='battleEnd')f.b.emit('battleEnd',{});else active=false;
 assert.equal(f.wait.resume(),null);f.receive();assert.equal(f.wait.resume(),null);
 assert.equal(f.unsubscribed,1);assert.deepEqual(f.events,['subscribe','unsubscribe']);assert.deepEqual(f.b.errors,[]);
});

test('reentrant cast resumes cannot skip the initial yield or duplicate readiness',()=>{
 let f;f=castWaitFixture({frameCount:1,isCastActive:()=>{assert.equal(f.wait.resume(),null);return true;},
  onReady:()=>{assert.equal(f.wait.resume(),null);f.events.push('ready');}});
 f.wait.resume();f.wait.resume();assert.deepEqual(f.events,['subscribe','unsubscribe','ready']);
});

test('battle end inside event subscription immediately disposes the returned registration',()=>{
 let f,disposed=0;f=castWaitFixture({subscribeAttackEvent:()=>{f.b.emit('battleEnd',{});return()=>disposed++;}});
 assert.equal(f.wait.resume(),null);assert.equal(disposed,1);assert.equal(f.wait.resume(),null);assert.deepEqual(f.events,[]);
});

test('bounded cast readiness can create one independent flight which survives later owner removal',()=>{
 const f=fixture();f.source.base.atk=175;f.source.markDirty();f.target.nativeUid=1;
 const source=fearProjectileSourceReference(f.b,f.source),damage=fearProjectileDamageAction(f.b,source);
 let flight,births=0;
 const wait=fearProjectileAttackWait(f.b,{owner:f.source,cachedDurationRaw:fpOne,readDeltaPlayTime:()=>1,isCastActive:()=>true,
  subscribeAttackEvent:()=>()=>{},onReady:()=>{
   births++;
   flight=fearProjectileFlight(f.b,{from:{x:0,y:0,z:0},initialTarget:{x:1,y:0,z:0},
    resolveTargetPosition:()=>null,resolveTraceTarget:()=>f.target,
    area:{queryOverlaps:()=>[f.target],resolveEntity:u=>u,readUid:u=>u.nativeUid,
     isCandidate:()=>true,verifyTarget:()=>true,deterministic:true,resolveSource:source.resolveSource,onSelected:()=>{}},
    runHit:({target})=>applyFearProjectileImpact(f.b,{source:f.source,target,applyAttachments:()=>{},runActions:damage}),
    onStopped:()=>{},scheduleCompletion:()=>()=>{}});
  }});
 wait.resume();assert.equal(flight,undefined);wait.resume();assert.equal(births,1);
 f.b.kill(f.source,null);const hp=f.target.hp;flight.advance(fpOne/10n,fpOne);
 assert.equal(hp-f.target.hp,175);assert.ok(f.target.findBuff(parentKey));assert.equal(wait.resume(),null);
 assert.equal(births,1);flight.release();source.release();assert.deepEqual(f.b.errors,[]);
});

test('enemy arrival query includes the configured ally and neutral layers',()=>{
 const layerIndices={ALLY:8,ENEMY:9,NEUTRAL:28};
 assert.deepEqual(fearProjectileArrivalLayerMask({sourceSide:2,layerIndices}),{sideMask:5,layerMask:(1<<8)|(1<<28)});
 for(const sourceSide of [0,1,4])assert.deepEqual(fearProjectileArrivalLayerMask({sourceSide,layerIndices}),{sideMask:2,layerMask:1<<9});
 // Opposite-side lookup tests equality with single bits, not set membership.
 for(const sourceSide of [3,5,6,7,8,-1])assert.deepEqual(fearProjectileArrivalLayerMask({sourceSide,layerIndices}),{sideMask:0,layerMask:0});
});

test('arrival mask uses supplied layer layout and signed Int32 bit shifts',()=>{
 assert.deepEqual(fearProjectileArrivalLayerMask({sourceSide:2,layerIndices:{ALLY:31,ENEMY:1,NEUTRAL:0}}),
  {sideMask:5,layerMask:-2147483647});
 for(const layerIndices of [undefined,{ALLY:-1,ENEMY:9,NEUTRAL:28},{ALLY:8,ENEMY:32,NEUTRAL:28}])
  assert.throws(()=>fearProjectileArrivalLayerMask({sourceSide:2,layerIndices}),/actual named/);
 assert.throws(()=>fearProjectileArrivalLayerMask({sourceSide:undefined,layerIndices:{ALLY:8,ENEMY:9,NEUTRAL:28}}),/native Int32/);
});

test('selected arrival mask reproduces original Windows ally and neutral layer bits',()=>{
 const settings=read('data/candidates/arkpedia-windows-physics-settings-source.json');
 assert.deepEqual(fearProjectileArrivalLayerMask({sourceSide:2,layerIndices:settings.layerIndices}),
  {sideMask:5,layerMask:268436480});
 const owner=read('data/candidates/arkpedia-windows-fear-area-source.json').minerColliderOwnership;
 assert.equal(JSON.parse(owner.geometry.root.originalJson).m_Layer,settings.layerIndices.NEUTRAL);
 assert.equal(JSON.parse(owner.geometry.collisionHolder.originalJson).m_Layer,settings.layerIndices.ENEMY_COLLIDER);
 // Matching static indices do not establish CN runtime settings or world size.
 assert.equal(settings.crossVersionParity,false);assert.equal(owner.physicsOverlapParity,false);
});

test('arrival area query can use the explicit layer mask without losing neutral recipients',()=>{
 const f=fixture(),layerIndices={ALLY:8,ENEMY:9,NEUTRAL:28};f.target.nativeUid=1;
 const {layerMask}=fearProjectileArrivalLayerMask({sourceSide:2,layerIndices});
 const other={nativeUid:2,deploySeq:2},enemy={nativeUid:3,deploySeq:3},hits=[];
 const colliders=[{unit:f.target,layer:28},{unit:other,layer:8},{unit:enemy,layer:9}];
 const area=areaFixture(f,[],{queryOverlaps:()=>colliders.filter(c=>((1<<c.layer)&layerMask)!==0),
  hitTarget:unit=>{hits.push(unit);return true;}});
 assert.deepEqual(area.deliver(),{selected:2,attempted:2,hits:2});assert.deepEqual(hits,[f.target,other]);
});

test('source motion uses current native motion while alive-or-dying and captured motion afterward',()=>{
 const f=fixture(),ref=fearProjectileEntityReference(f.b,f.source);let motion=1,valid=true;
 const snapshot=fearProjectileSourceMotion(f.b,{source:f.source,resolveSource:ref.resolveEntity,
  readMotionMode:()=>motion,isValidAndAliveOrDying:()=>valid});
 assert.equal(snapshot.capturedMotionMode,1);motion=0;assert.equal(snapshot.readSourceMotionMode(),0);
 // Merely setting local alive=false does not substitute for the native predicate.
 f.source.alive=false;assert.equal(snapshot.readSourceMotionMode(),0);
 valid=false;assert.equal(snapshot.readSourceMotionMode(),1);motion=2;assert.equal(snapshot.readSourceMotionMode(),1);
 f.source.deploySeq++;assert.equal(snapshot.readSourceMotionMode(),1);ref.release();snapshot.release();
});

test('missing source snapshot yields native fallback motion2 without reading another entity',()=>{
 const f=fixture();const snapshot=fearProjectileSourceMotion(f.b,{source:null,resolveSource:()=>null,
  readMotionMode:()=>{throw Error('no source');},isValidAndAliveOrDying:()=>{throw Error('no source');}});
 assert.equal(snapshot.readSourceMotionMode(),2);snapshot.release();assert.equal(snapshot.readSourceMotionMode(),null);
});

for(const boundary of ['reuse','removed','battleEnd'])test('source motion lookup rejects '+boundary+' during the native motion read',()=>{
 const f=fixture(),ref=fearProjectileEntityReference(f.b,f.source);let armed=false;
 const snapshot=fearProjectileSourceMotion(f.b,{source:f.source,resolveSource:ref.resolveEntity,
  isValidAndAliveOrDying:()=>true,readMotionMode:()=>{
   if(armed){if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='removed')f.b.emit('removed',{unit:f.source});else f.b.emit('battleEnd',{});}
   return armed?0:1;
  }});
 armed=true;assert.equal(snapshot.readSourceMotionMode(),null);
 assert.equal(snapshot.readSourceMotionMode(),boundary==='battleEnd'?null:1);snapshot.release();ref.release();assert.deepEqual(f.b.errors,[]);
});

test('source motion cannot use a replacement resolved between validity and the live read',()=>{
 const f=fixture();let replacement=false,reads=0;
 const snapshot=fearProjectileSourceMotion(f.b,{source:f.source,resolveSource:()=>replacement?f.target:f.source,
  readMotionMode:()=>{reads++;return 1;},isValidAndAliveOrDying:()=>{replacement=true;return true;}});
 assert.equal(snapshot.readSourceMotionMode(),null);assert.equal(reads,1);
 assert.equal(snapshot.readSourceMotionMode(),1);snapshot.release();
});

test('arrival eligibility consumes the source motion snapshot after its source becomes invalid',()=>{
 const f=fixture();let motion=1,valid=true,seen=[];
 const snapshot=fearProjectileSourceMotion(f.b,{source:f.source,resolveSource:()=>f.source,
  readMotionMode:()=>motion,isValidAndAliveOrDying:()=>valid});
 const verifier=fearProjectileTargetVerifier(f.b,{sourceSide:2,readMotionMode:()=>0,readCategory:()=>1,readSide:()=>1,
  isTargetFree:()=>false,isAllyTargetFree:()=>false,readSourceMotionMode:snapshot.readSourceMotionMode,
  isStillMotionTargetFree:(_target,{sourceMotion})=>{seen.push(sourceMotion);return sourceMotion!==0;}});
 motion=0;assert.equal(verifier.verifyTarget(f.target),true);
 valid=false;assert.equal(verifier.verifyTarget(f.target),false);assert.deepEqual(seen,[0,1]);
 verifier.release();snapshot.release();
});

function targetVerifierFixture(overrides={}){
 const f=fixture(),calls=[];
 const verifier=fearProjectileTargetVerifier(f.b,{sourceSide:2,
  readMotionMode:()=>{calls.push('motion');return 0;},readCategory:()=>{calls.push('category');return 1;},
  readSide:()=>{calls.push('side');return 1;},isTargetFree:()=>{calls.push('free');return false;},
  isAllyTargetFree:()=>{calls.push('allyFree');return false;},
  readSourceMotionMode:()=>{calls.push('sourceMotion');return 1;},
  isStillMotionTargetFree:(_target,args)=>{calls.push(args);return false;},...overrides});
 return{...f,verifier,calls};
}

test('selected arrival verifier evaluates motion/category then source-relative target-free rules',()=>{
 const f=targetVerifierFixture();assert.equal(f.verifier.verifyTarget(f.target),true);
 assert.deepEqual(f.calls,['motion','category','side','free','sourceMotion',{flags:44,combo:2,sourceMotion:1},'allyFree']);
 f.verifier.release();assert.equal(f.verifier.verifyTarget(f.target),false);
});
for(const [key,value]of [['readMotionMode',1],['readMotionMode',2],['readCategory',0],['isTargetFree',true],['isStillMotionTargetFree',true]])
test('selected arrival verifier rejects '+key+'='+value,()=>{
 const f=targetVerifierFixture({[key]:()=>value});assert.equal(f.verifier.verifyTarget(f.target),false);f.verifier.release();
});

test('ally-target-free rejects the same side but does not reject another side',()=>{
 const same=targetVerifierFixture({readSide:()=>2,isAllyTargetFree:()=>true});
 assert.equal(same.verifier.verifyTarget(same.target),false);
 assert.equal(same.calls.includes('free'),false);assert.equal(same.calls.includes('sourceMotion'),false);same.verifier.release();
 const other=targetVerifierFixture({isAllyTargetFree:()=>true});assert.equal(other.verifier.verifyTarget(other.target),true);other.verifier.release();
});

test('native source-side zero skips source-relative advanced free gates',()=>{
 const f=targetVerifierFixture({sourceSide:0,isTargetFree:()=>{throw Error('unreached');},
  isAllyTargetFree:()=>{throw Error('unreached');}});
 assert.equal(f.verifier.verifyTarget(f.target),true);assert.deepEqual(f.calls,['motion','category']);f.verifier.release();
});

test('target verifier rejects missing native state values instead of treating them as targetable',()=>{
 for(const key of ['readMotionMode','readCategory','readSide','readSourceMotionMode','isTargetFree','isAllyTargetFree','isStillMotionTargetFree']){
  const f=targetVerifierFixture({[key]:()=>undefined});assert.throws(()=>f.verifier.verifyTarget(f.target),/native/);f.verifier.release();
 }
});

for(const boundary of ['reuse','battleEnd','recursive'])test('target verification guards '+boundary+' during a native reader',()=>{
 let f;f=targetVerifierFixture({isTargetFree:()=>{
  if(boundary==='reuse')f.target.deploySeq++;
  else if(boundary==='battleEnd')f.b.emit('battleEnd',{});
  else assert.equal(f.verifier.verifyTarget(f.target),false);
  return false;
 }});
 assert.equal(f.verifier.verifyTarget(f.target),boundary==='recursive');f.verifier.release();assert.deepEqual(f.b.errors,[]);
});

test('area delivery uses the selected verifier after source retirement without skipping its captured side rules',()=>{
 let blocked=false;const f=targetVerifierFixture({isTargetFree:()=>blocked});f.target.nativeUid=1;
 f.b.kill(f.source,null);let hits=0;
 const area=areaFixture(f,[f.target],{verifyTarget:f.verifier.verifyTarget,resolveSource:()=>null,
  hitTarget:()=>{hits++;return true;}});
 blocked=true;assert.deepEqual(area.deliver(),{selected:0,attempted:0,hits:0});assert.equal(hits,0);
 assert.equal(f.verifier.verifyTarget(f.target),false);blocked=false;assert.equal(f.verifier.verifyTarget(f.target),true);
 f.verifier.release();
});

function flightFixture(overrides={}){
 const f=fixture(),events=[];let completion=null,cancellations=0;
 f.target.nativeUid=1;
 const options={from:{x:0,y:0,z:0},initialTarget:{x:1,y:0,z:0},
  resolveTargetPosition:()=>{events.push('position');return{x:1,y:0,z:0};},resolveTraceTarget:()=>f.target,
  area:{queryOverlaps:()=>{events.push('query');return[f.target];},resolveEntity:u=>u,readUid:u=>u.nativeUid,
   isCandidate:()=>true,verifyTarget:()=>true,deterministic:true,resolveSource:()=>f.source,
   onSelected:()=>events.push('selected')},
  runHit:({forced})=>events.push(forced?'forced':'hit'),onStopped:()=>events.push('stop'),
  scheduleCompletion:callback=>{events.push('schedule');completion=callback;return()=>{cancellations++;};},...overrides};
 const flight=fearProjectileFlight(f.b,options);
 return{...f,flight,events,complete:()=>completion?.(),get cancellations(){return cancellations;}};
}

test('flight composes movement, one arrival and trace clearing before deferred completion',()=>{
 const f=flightFixture(),result=f.flight.advance(fpOne/10n,fpOne);
 assert.deepEqual(result.motion,{x:1,y:0,z:0,reached:true});
 assert.deepEqual(result.delivery,{selected:1,attempted:1,hits:1});
 assert.deepEqual(f.events,['position','query','selected','hit','schedule']);
 assert.equal(f.flight.ended,false);assert.equal(f.flight.reached,true);assert.equal(f.flight.traceCleared,true);
 assert.equal(f.flight.elapsedRaw,10n*fpOne);assert.equal(f.flight.count,1);
 assert.equal(f.complete(),true);assert.equal(f.complete(),false);assert.equal(f.flight.stop(),false);
 assert.equal(f.cancellations,1);assert.deepEqual(f.events,['position','query','selected','hit','schedule','stop']);
});

test('arrival lifetime reset lets the next expiry win without another area or forced trace hit',()=>{
 const f=flightFixture();f.flight.advance(fpOne/10n,fpOne);
 assert.equal(f.flight.advance(0n,fpOne).expired,true);assert.equal(f.flight.ended,true);
 assert.equal(f.complete(),false);assert.equal(f.flight.count,1);assert.equal(f.cancellations,1);
 assert.equal(f.events.filter(e=>e==='query').length,1);assert.equal(f.events.includes('forced'),false);
});

test('flight expiry precedes movement and forces only the saved trace recipient',()=>{
 const f=flightFixture();const result=f.flight.advance(10n*fpOne,fpOne);
 assert.equal(result.expired,true);assert.equal(f.flight.reached,false);assert.equal(f.flight.traceCleared,false);
 assert.deepEqual(f.events,['forced','stop']);assert.deepEqual(f.flight.position,{x:0,y:0,z:0});
 assert.equal(f.flight.advance(fpOne,fpOne),null);assert.equal(f.flight.count,1);
});

test('eliminating a flight suppresses terminal damage and does not synthesize arrival',()=>{
 const f=flightFixture();assert.equal(f.flight.stop({eliminated:true}),true);
 assert.deepEqual(f.events,['stop']);assert.equal(f.flight.count,0);assert.equal(f.flight.ended,true);
});

test('battle end cancels pending flight completion and all later callbacks',()=>{
 const f=flightFixture();f.flight.advance(fpOne/10n,fpOne);f.b.emit('battleEnd',{});
 assert.equal(f.cancellations,1);assert.equal(f.complete(),false);assert.equal(f.flight.advance(fpOne,fpOne),null);
 assert.equal(f.events.includes('stop'),false);assert.equal(f.flight.ended,true);assert.deepEqual(f.b.errors,[]);
});

test('flight cancellation from the area query prevents hits, trace clearing and completion scheduling',()=>{
 const f=flightFixture();
 f.flight.release();assert.equal(f.flight.advance(fpOne/10n,fpOne),null);assert.deepEqual(f.events,[]);
 const g=fixture(),events=[];g.target.nativeUid=1;
 const flight=fearProjectileFlight(g.b,{from:{x:0,y:0,z:0},initialTarget:{x:1,y:0,z:0},
  resolveTargetPosition:()=>null,resolveTraceTarget:()=>g.target,
  area:{queryOverlaps:()=>{g.b.emit('battleEnd',{});return[g.target];},resolveEntity:u=>u,
   readUid:u=>u.nativeUid,isCandidate:()=>true,verifyTarget:()=>true,deterministic:true,
   resolveSource:()=>g.source,onSelected:()=>events.push('selected')},
  runHit:()=>events.push('hit'),onStopped:()=>events.push('stop'),scheduleCompletion:()=>{events.push('schedule');return()=>{};}});
 flight.advance(fpOne/10n,fpOne);assert.deepEqual(events,[]);assert.equal(flight.traceCleared,false);assert.equal(flight.ended,true);
});

test('recursive flight advancement and stopping cannot duplicate arrival or final output',()=>{
 let f;f=flightFixture({runHit:()=>{
  f.events.push('hit');assert.equal(f.flight.advance(fpOne,fpOne),null);
  assert.equal(f.flight.stop(),true);assert.equal(f.flight.stop(),false);
 }});
 f.flight.advance(fpOne/10n,fpOne);
 assert.deepEqual(f.events,['position','query','selected','hit','stop']);
 assert.equal(f.flight.count,1);assert.equal(f.flight.ended,true);assert.equal(f.flight.traceCleared,false);
});

test('selected flight rejects a same-stack completion scheduler and closes its lifecycle',()=>{
 const f=flightFixture({scheduleCompletion:callback=>{callback();return()=>{};}});
 assert.throws(()=>f.flight.advance(fpOne/10n,fpOne),/must defer/);
 assert.equal(f.flight.ended,true);assert.equal(f.flight.advance(fpOne,fpOne),null);assert.equal(f.events.includes('stop'),false);
});

test('native lifetime ensure sets signed remaining time without same-stack expiry',()=>{
 let expires=0;const clock=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>expires++});
 clock.advance(fpOne,fpOne);assert.equal(clock.ensureLifeTime(2n*fpOne),true);
 assert.equal(clock.elapsedRaw,8n*fpOne);assert.equal(clock.advance(fpOne,fpOne).expired,false);
 assert.equal(clock.ensureLifeTime(0n),true);assert.equal(expires,0);
 assert.equal(clock.advance(0n,0n).expired,true);assert.equal(expires,1);assert.equal(clock.ensureLifeTime(fpOne),false);
 const wrap=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>{}});
 wrap.ensureLifeTime(-(1n<<63n));assert.equal(wrap.elapsedRaw,BigInt.asIntN(64,10n*fpOne+(1n<<63n)));
});

test('flight arrival still afflicts and damages once after its launch source retires',()=>{
 const f=fixture();f.source.base.atk=175;f.source.markDirty();f.target.nativeUid=1;
 const source=fearProjectileSourceReference(f.b,f.source),trace=fearProjectileEntityReference(f.b,f.target);
 const damage=fearProjectileDamageAction(f.b,source);let completion,notifications=0;
 const flight=fearProjectileFlight(f.b,{from:{x:0,y:0,z:0},initialTarget:{x:1,y:0,z:0},
  resolveTargetPosition:()=>null,resolveTraceTarget:trace.resolveEntity,
  area:{queryOverlaps:()=>[f.target,f.target],resolveEntity:u=>u,readUid:u=>u.nativeUid,
   isCandidate:()=>true,verifyTarget:()=>true,deterministic:true,resolveSource:source.resolveSource,
   onSelected:()=>notifications++},
  runHit:({target})=>applyFearProjectileImpact(f.b,{source:f.source,target,applyAttachments:()=>{},runActions:damage}),
  onStopped:()=>{},scheduleCompletion:callback=>{completion=callback;return()=>{};}});
 f.b.kill(f.source,null);const hp=f.target.hp;
 flight.advance(fpOne/10n,fpOne);assert.equal(hp-f.target.hp,175);assert.ok(f.target.findBuff(parentKey));
 assert.equal(notifications,0);completion();assert.equal(flight.count,1);assert.equal(hp-f.target.hp,175);
 source.release();trace.release();assert.deepEqual(f.b.errors,[]);
});

test('lost trace reference preserves last position but cannot force-hit a recycled target',()=>{
 const f=fixture(),trace=fearProjectileEntityReference(f.b,f.target),mount=fearProjectileMountReference(f.b,f.target,()=>({x:1000,y:0,z:0}));
 let hits=0;const flight=fearProjectileFlight(f.b,{from:{x:0,y:0,z:0},initialTarget:{x:1000,y:0,z:0},
  resolveTargetPosition:mount.resolvePosition,resolveTraceTarget:trace.resolveEntity,
  area:{queryOverlaps:()=>[],resolveEntity:u=>u,readUid:()=>1,isCandidate:()=>true,
   verifyTarget:()=>true,deterministic:true,resolveSource:()=>null,onSelected:()=>{}},
  runHit:()=>hits++,onStopped:()=>{},scheduleCompletion:()=>()=>{}});
 f.target.deploySeq++;const step=flight.advance(fpOne,fpOne);assert.equal(step.motion.x,10);
 assert.equal(flight.advance(9n*fpOne,fpOne).expired,true);assert.equal(hits,0);
 trace.release();mount.release();assert.deepEqual(f.b.errors,[]);
});

test('lifetime ensure rejects reentrant clock mutations through the lifecycle reader',()=>{
 let clock;clock=fearProjectileLifetime({isBattleActive:()=>{
  assert.equal(clock.ensureLifeTime(0n),false);assert.equal(clock.advance(fpOne,fpOne),null);return true;
 },onExpire:()=>{}});
 assert.equal(clock.ensureLifeTime(fpOne),true);assert.equal(clock.elapsedRaw,9n*fpOne);
});
function areaFixture(f,units,overrides={}){
 return fearProjectileAreaDelivery(f.b,{queryOverlaps:()=>units.map(unit=>({unit})),resolveEntity:c=>c.unit,
  readUid:u=>u.nativeUid,isCandidate:()=>true,verifyTarget:()=>true,deterministic:true,
  resolveSource:()=>f.source,onSelected:()=>{},hitTarget:()=>true,...overrides});
}
test('area query deduplicates collider entities and truncates physics order before UID sorting',()=>{
 const f=fixture(),units=Array.from({length:130},(_,i)=>({nativeUid:500-i,deploySeq:i}));
 const colliders=units.flatMap(u=>[u,u]);const hits=[],selected=[];let verifies=0;
 const area=areaFixture(f,colliders,{verifyTarget:()=>{verifies++;return true;},
  onSelected:e=>selected.push(e.count),hitTarget:u=>{hits.push(u.nativeUid);return true;}});
 assert.deepEqual(area.deliver(),{selected:128,attempted:128,hits:128});
 assert.equal(verifies,128);assert.deepEqual(selected,[128]);
 assert.deepEqual(hits,units.slice(0,128).map(u=>u.nativeUid).sort((a,b)=>a-b));
 assert.equal(hits.includes(371),false);assert.equal(hits.includes(372),false);assert.equal(area.deliver(),null);
});

test('non-deterministic area dispatch keeps supplied collider order',()=>{
 const f=fixture(),hits=[],units=[3,1,2].map(id=>({nativeUid:id,deploySeq:id}));
 const area=areaFixture(f,units,{deterministic:false,hitTarget:u=>{hits.push(u.nativeUid);return true;}});
 area.deliver();assert.deepEqual(hits,[3,1,2]);
});

test('area admits an identity only after validity and target-option verification',()=>{
 const f=fixture(),rejected={nativeUid:1,deploySeq:1},retry={nativeUid:2,deploySeq:2},hits=[];let verifies=0;
 const area=areaFixture(f,[rejected,retry,retry],{isCandidate:u=>u!==rejected,
  verifyTarget:()=>++verifies===2,hitTarget:u=>{hits.push(u.nativeUid);return true;}});
 assert.deepEqual(area.deliver(),{selected:1,attempted:1,hits:1});assert.equal(verifies,2);assert.deepEqual(hits,[2]);
});

test('source notification precedes hits and cannot redirect captured recipients to recycled lives',()=>{
 const f=fixture(),units=[1,2].map(id=>({nativeUid:id,deploySeq:id})),events=[];
 const area=areaFixture(f,units,{onSelected:({count})=>{events.push('selected:'+count);units[0].deploySeq++;units[0].nativeUid=99;},
  hitTarget:u=>{events.push('hit:'+u.nativeUid);return true;}});
 assert.deepEqual(area.deliver(),{selected:2,attempted:1,hits:1});assert.deepEqual(events,['selected:2','hit:2']);
});

test('area still dispatches found targets after the born source reference retires',()=>{
 const f=fixture(),u={nativeUid:1,deploySeq:1};let notified=0,hits=0;
 const area=areaFixture(f,[u],{resolveSource:()=>null,onSelected:()=>notified++,hitTarget:()=>{hits++;return true;}});
 area.deliver();assert.equal(notified,0);assert.equal(hits,1);
});

test('battle end while stabilizing a query result prevents later collider and hit callbacks',()=>{
 const f=fixture(),units=[1,2].map(id=>({nativeUid:id,deploySeq:id}));let reads=0,resolves=0,hits=0;
 const area=areaFixture(f,units,{resolveEntity:c=>{resolves++;return c.unit;},
  readUid:u=>{if(++reads===2)f.b.emit('battleEnd',{});return u.nativeUid;},hitTarget:()=>{hits++;return true;}});
 assert.equal(area.deliver(),null);assert.equal(resolves,1);assert.equal(hits,0);assert.deepEqual(f.b.errors,[]);
});

test('reentrant area calls cannot repeat the selected notification or impacts',()=>{
 const f=fixture(),u={nativeUid:1,deploySeq:1};let area,hits=0,notified=0;
 area=areaFixture(f,[u],{onSelected:()=>{notified++;assert.equal(area.deliver(),null);},
  hitTarget:()=>{hits++;assert.equal(area.deliver(),null);return true;}});
 area.deliver();assert.equal(hits,1);assert.equal(notified,1);
});

test('area-to-ledger composition applies one affliction/damage receipt despite duplicate colliders and stop',()=>{
 const f=fixture();f.target.nativeUid=123;f.source.base.atk=175;f.source.markDirty();
 const source=fearProjectileSourceReference(f.b,f.source),target=fearProjectileEntityReference(f.b,f.target);
 const damage=fearProjectileDamageAction(f.b,source);
 const ledger=fearProjectileHitLedger(f.b,{resolveTraceTarget:target.resolveEntity,
  runHit:({target})=>applyFearProjectileImpact(f.b,{source:f.source,target,applyAttachments:()=>{},runActions:damage}),onStopped:()=>{}});
 const area=areaFixture(f,[f.target,f.target],{resolveSource:source.resolveSource,hitTarget:ledger.hit});
 f.b.kill(f.source,null);const hp=f.target.hp;
 assert.deepEqual(area.deliver(),{selected:1,attempted:1,hits:1});ledger.stop();
 assert.equal(hp-f.target.hp,175);assert.equal(ledger.count,1);assert.ok(f.target.findBuff(parentKey));
 assert.deepEqual(f.b.errors,[]);source.release();target.release();
});

test('native clock expires at the Q32.32 boundary rather than rounded float seconds',()=>{
 let expires=0;const clock=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>expires++});
 assert.equal(clock.elapsedRaw,0n);
 assert.equal(clock.advance(5n*fpOne-1n,fpOne).expired,false);
 assert.equal(clock.advance(5n*fpOne,fpOne).expired,false);
 assert.equal(clock.elapsedRaw,10n*fpOne-1n);assert.equal(expires,0);
 const final=clock.advance(1n,fpOne);assert.equal(final.expired,true);assert.equal(expires,1);
 assert.equal(final.elapsedRaw,10n*fpOne);assert.equal('effectiveDt' in final,false);
 assert.equal(clock.advance(fpOne,fpOne),null);assert.equal(expires,1);
});

test('movement scale affects lifetime and motion delta through fixed-point multiplication',()=>{
 const clock=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>{}});
 const paused=clock.advance(fpOne,0n);assert.equal(paused.elapsedRaw,0n);assert.equal(paused.effectiveDt,0);
 const slow=clock.advance(fpOne,fpOne/2n);assert.equal(slow.elapsedRaw,fpOne/2n);assert.equal(slow.effectiveDt,.5);
 for(let i=0;i<9;i++)assert.equal(clock.advance(fpOne,fpOne).expired,false);
 assert.equal(clock.advance(fpOne,fpOne/2n).expired,true);
});

test('Q32.32 multiply truncates fractional raw bits and wraps signed64 arithmetic',()=>{
 const clock=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>{}});
 assert.equal(clock.advance(1n,fpOne/2n).deltaRaw,0n);
 const wrapped=clock.advance((1n<<63n)-1n,2n*fpOne);
 assert.equal(wrapped.deltaRaw,-2n);assert.equal(wrapped.elapsedRaw,-2n);
 assert.equal(wrapped.effectiveDt,-(2**-31));clock.release();
});

test('raw signed64 to float32 conversion avoids double rounding at a halfway boundary',()=>{
 const clock=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>{}});
 const raw=-((1n<<62n)+(1n<<38n)+1n),step=clock.advance(raw,fpOne);
 assert.equal(step.effectiveDt,-1073741952);
 assert.notEqual(step.effectiveDt,Math.fround(Number(raw)*2**-32));clock.release();
});

test('clock rejects non-raw inputs and prevents recursive or post-end expiry callbacks',()=>{
 let clock,active=true,recursive,expires=0;
 clock=fearProjectileLifetime({isBattleActive:()=>{recursive=clock.advance(fpOne,fpOne);return active;},
  onExpire:()=>{expires++;assert.equal(clock.advance(fpOne,fpOne),null);}});
 assert.throws(()=>clock.advance(1,fpOne),/Q32/);assert.throws(()=>clock.advance(1n<<63n,fpOne),/Q32/);
 assert.equal(clock.advance(10n*fpOne,fpOne).expired,true);assert.equal(recursive,null);assert.equal(expires,1);
 active=false;assert.equal(clock.advance(fpOne,fpOne),null);
});

test('clock lifecycle cancellation is permanent and expiry exceptions cannot repeat stop dispatch',()=>{
 let active=false,expires=0;
 const cancelled=fearProjectileLifetime({isBattleActive:()=>active,onExpire:()=>expires++});
 assert.equal(cancelled.advance(fpOne,fpOne),null);active=true;
 assert.equal(cancelled.advance(10n*fpOne,fpOne),null);assert.equal(cancelled.elapsedRaw,0n);
 const failed=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>{expires++;throw Error('stop callback');}});
 assert.throws(()=>failed.advance(10n*fpOne,fpOne),/stop callback/);
 assert.equal(failed.advance(fpOne,fpOne),null);assert.equal(expires,1);
});

test('lifetime expiry stops before movement and applies only the final saved-target hit',()=>{
 const f=fixture();f.source.base.atk=125;f.source.markDirty();
 const source=fearProjectileSourceReference(f.b,f.source),target=fearProjectileEntityReference(f.b,f.target);
 const damage=fearProjectileDamageAction(f.b,source);let moves=0,arrivals=0,stops=0;
 const ledger=fearProjectileHitLedger(f.b,{resolveTraceTarget:target.resolveEntity,
  runHit:({target})=>applyFearProjectileImpact(f.b,{source:f.source,target,applyAttachments:()=>{},runActions:damage}),
  onStopped:()=>stops++});
 const trace=fearProjectileTraceMotion({from:{x:0,y:0,z:1},initialTarget:{x:1000,y:0,z:1},
  resolveTargetPosition:()=>null,isBattleActive:source.isBattleActive});
 const clock=fearProjectileLifetime({isBattleActive:source.isBattleActive,onExpire:()=>ledger.stop()});
 f.b.kill(f.source,null);const hp=f.target.hp;
 for(let i=0;i<10;i++){
  const step=clock.advance(fpOne,fpOne);
  if(!step.expired){moves++;if(trace.advance(step.effectiveDt)?.reached)arrivals++;}
 }
 assert.equal(moves,9);assert.equal(arrivals,0);assert.equal(stops,1);assert.equal(ledger.count,1);
 assert.equal(trace.position.x,90);assert.equal(hp-f.target.hp,125);assert.deepEqual(f.b.errors,[]);
 trace.release();target.release();source.release();
});

test('forced trace hit bypasses the 128 normal-hit cap once without an area-arrival dispatch',()=>{
 const f=fixture(),trace={deploySeq:999},hits=[];let stops=0;
 const ledger=fearProjectileHitLedger(f.b,{runHit:event=>hits.push(event),resolveTraceTarget:()=>trace,onStopped:()=>stops++});
 for(let i=0;i<128;i++)assert.equal(ledger.hit({deploySeq:i}),true);
 assert.equal(ledger.count,128);assert.equal(ledger.stop(),true);
 assert.equal(ledger.count,129);assert.equal(hits.at(-1).target,trace);assert.equal(hits.at(-1).forced,true);
 assert.equal(stops,1);assert.equal(ledger.stop(),false);assert.equal(ledger.hitTraceTarget(),false);
});

test('normal cap rejection still reserves an identity before the forced-hit path checks it',()=>{
 const f=fixture(),trace={deploySeq:999};let hits=0;
 const ledger=fearProjectileHitLedger(f.b,{runHit:()=>hits++,resolveTraceTarget:()=>trace,onStopped:()=>{}});
 for(let i=0;i<128;i++)ledger.hit({deploySeq:i});
 assert.equal(ledger.hit(trace),false);assert.equal(ledger.hitTraceTarget(),false);
 assert.equal(ledger.hasHitTraceTarget,true);assert.equal(ledger.count,128);assert.equal(hits,128);
 ledger.stop();
});

test('hit reservation precedes callbacks while the hit count increments after they return',()=>{
 const f=fixture(),target={deploySeq:1};let ledger,recursive,countDuring;
 ledger=fearProjectileHitLedger(f.b,{runHit:()=>{countDuring=ledger.count;recursive=ledger.hit(target);},
  resolveTraceTarget:()=>target,onStopped:()=>{}});
 assert.equal(ledger.hit(target),true);assert.equal(recursive,false);assert.equal(countDuring,0);assert.equal(ledger.count,1);
 assert.equal(ledger.hitTraceTarget(),false,'normal arrival must not be repeated as a terminal trace hit');
 target.deploySeq++;assert.equal(ledger.hit(target),true,'a replacement UID is a different normal-hit identity');
 assert.equal(ledger.count,2);ledger.release();
});

test('recursive stop from a hit callback cannot repeat final trace damage or stop actions',()=>{
 const f=fixture();let ledger,hits=0,stops=0;
 ledger=fearProjectileHitLedger(f.b,{runHit:()=>{hits++;ledger.stop();},resolveTraceTarget:()=>f.target,onStopped:()=>stops++});
 assert.equal(ledger.stop(),true);assert.equal(hits,1);assert.equal(stops,1);assert.equal(ledger.count,1);
});

test('eliminated projectiles run stop actions without inventing a final hit',()=>{
 const f=fixture();let hits=0,stops=0;
 const ledger=fearProjectileHitLedger(f.b,{runHit:()=>hits++,resolveTraceTarget:()=>f.target,onStopped:()=>stops++});
 ledger.stop({eliminated:true});assert.equal(hits,0);assert.equal(stops,1);assert.equal(ledger.hasHitTraceTarget,false);
});

test('battle end during trace resolution prevents both final damage and late stop actions',()=>{
 const f=fixture();let hits=0,stops=0;
 const ledger=fearProjectileHitLedger(f.b,{runHit:()=>hits++,resolveTraceTarget:()=>{f.b.emit('battleEnd',{});return f.target;},onStopped:()=>stops++});
 ledger.stop();assert.equal(hits,0);assert.equal(stops,0);assert.equal(ledger.count,0);assert.equal(ledger.hasHitTraceTarget,false);
});

test('terminal impact uses the live trace identity and cached source damage after source removal',()=>{
 const f=fixture();f.source.base.atk=125;f.source.markDirty();
 const source=fearProjectileSourceReference(f.b,f.source),target=fearProjectileEntityReference(f.b,f.target);
 const damage=fearProjectileDamageAction(f.b,source);let stopped=0;
 const ledger=fearProjectileHitLedger(f.b,{resolveTraceTarget:target.resolveEntity,
  runHit:({target})=>applyFearProjectileImpact(f.b,{source:f.source,target,applyAttachments:()=>{},runActions:damage}),
  onStopped:()=>{stopped++;target.release();source.release();}});
 f.b.kill(f.source,null);const hp=f.target.hp;ledger.stop();
 assert.equal(hp-f.target.hp,125);assert.ok(f.target.findBuff(parentKey));assert.equal(stopped,1);
 assert.equal(ledger.count,1);assert.deepEqual(f.b.errors,[]);
});

test('terminal impact never follows a recycled trace body',()=>{
 const f=fixture(),target=fearProjectileEntityReference(f.b,f.target);let hits=0;
 const ledger=fearProjectileHitLedger(f.b,{resolveTraceTarget:target.resolveEntity,runHit:()=>hits++,onStopped:target.release});
 f.target.deploySeq++;ledger.stop();assert.equal(hits,0);assert.equal(ledger.hasHitTraceTarget,false);
});

test('mount reference follows the same unretired entity life and copies supplied 3D coordinates',()=>{
 const f=fixture();let mount={x:1,y:2,z:3},reads=0;
 const ref=fearProjectileMountReference(f.b,f.target,()=>{reads++;return mount;});
 const first=ref.resolvePosition();assert.deepEqual(first,mount);first.x=999;
 f.target.hidden=true;f.target.alive=false;f.target.deployed=false;mount={x:4,y:5,z:6};
 assert.deepEqual(ref.resolvePosition(),mount,'visibility/combat flags do not replace ObjectPtr validity');
 f.target.deploySeq++;assert.equal(ref.resolvePosition(),null);assert.equal(reads,2);
 ref.release();assert.equal(ref.isBattleActive(),false);
});

for(const retire of ['removed','reuse','battleEnd'])test('mount reader '+retire+' reentrancy cannot return replacement coordinates',()=>{
 const f=fixture();const ref=fearProjectileMountReference(f.b,f.target,()=>{
  if(retire==='removed')f.b.kill(f.target,null);
  else if(retire==='reuse')f.target.deploySeq++;
  else f.b.emit('battleEnd',{});
  return undefined;
 });
 assert.equal(ref.resolvePosition(),null);assert.deepEqual(f.b.errors,[]);ref.release();
});

test('trace motion retains the last 3D destination after native reference retirement',()=>{
 const f=fixture();let mount={x:5,y:0,z:0};
 const ref=fearProjectileMountReference(f.b,f.target,()=>mount);
 const trace=fearProjectileTraceMotion({from:{x:0,y:0,z:0},initialTarget:ref.resolvePosition(),
  resolveTargetPosition:ref.resolvePosition,isBattleActive:ref.isBattleActive});
 assert.deepEqual(trace.advance(.1),{x:1,y:0,z:0,reached:false});
 mount={x:1,y:5,z:0};assert.deepEqual(trace.advance(.1),{x:1,y:1,z:0,reached:false});
 f.b.kill(f.target,null);f.target.deploySeq++;mount={x:999,y:999,z:999};
 assert.deepEqual(trace.advance(.1),{x:1,y:2,z:0,reached:false});
 assert.deepEqual(trace.destination,{x:1,y:5,z:0});
 const copy=trace.destination;copy.z=999;assert.equal(trace.destination.z,0);
 assert.equal(trace.advance(.3).reached,true);assert.equal(trace.advance(.1),null);
 trace.release();ref.release();
});

test('trace motion rejects recursive advancement and permanently retires on lifecycle end',()=>{
 let active=true,trace,recursive;
 trace=fearProjectileTraceMotion({from:{x:0,y:0,z:0},initialTarget:{x:5,y:0,z:0},
  resolveTargetPosition:()=>{recursive=trace.advance(.2);return{x:5,y:0,z:0};},isBattleActive:()=>active});
 assert.deepEqual(trace.advance(.1),{x:1,y:0,z:0,reached:false});assert.equal(recursive,null);
 active=false;assert.equal(trace.advance(.1),null);active=true;assert.equal(trace.advance(.1),null);
 assert.equal(trace.position.x,1);
});

test('trace release while resolving coordinates prevents a late movement commit',()=>{
 let trace;trace=fearProjectileTraceMotion({from:{x:0,y:0,z:0},initialTarget:{x:5,y:0,z:0},
  resolveTargetPosition:()=>{trace.release();return{x:999,y:0,z:0};},isBattleActive:()=>true});
 assert.equal(trace.advance(.1),null);assert.deepEqual(trace.position,{x:0,y:0,z:0});
});

test('trace lifecycle resolver cannot recursively advance before the position read',()=>{
 let trace,recursive,reads=0;
 trace=fearProjectileTraceMotion({from:{x:0,y:0,z:0},initialTarget:{x:5,y:0,z:0},
  resolveTargetPosition:()=>{reads++;return null;},isBattleActive:()=>{recursive=trace.advance(.2);return true;}});
 assert.deepEqual(trace.advance(.1),{x:1,y:0,z:0,reached:false});assert.equal(recursive,null);assert.equal(reads,1);
 trace.release();
});

test('battle end from a mount reader cancels shared-system movement before arrival',()=>{
 const f=fixture();let end=false,hits=0;
 const mount=fearProjectileMountReference(f.b,f.target,u=>{
  if(end){f.b.emit('battleEnd',{});return undefined;}
  return{x:u.x,y:u.y,z:.2};
 });
 const trace=fearProjectileTraceMotion({from:{x:f.source.x,y:f.source.y,z:.2},initialTarget:mount.resolvePosition(),
  resolveTargetPosition:mount.resolvePosition,isBattleActive:mount.isBattleActive});
 const initial=trace.position;
 f.b.addProjectile({from:initial,to:trace.destination,maxAge:10,advanceMotion:({dt})=>trace.advance(dt),onHit:()=>hits++});
 end=true;f.b.projectiles.update(.2);
 assert.equal(hits,0);assert.deepEqual(trace.position,initial);assert.equal(f.b.projectiles.list.length,0);
 assert.deepEqual(f.b.errors,[]);trace.release();mount.release();
});

test('shared projectile system carries reviewed trace motion and cached impact after source removal',()=>{
 const f=fixture();f.source.base.atk=200;f.source.markDirty();
 const sourceRef=fearProjectileSourceReference(f.b,f.source);
 const mount=fearProjectileMountReference(f.b,f.target,u=>({x:u.x,y:u.y,z:.2}));
 const trace=fearProjectileTraceMotion({from:{x:f.source.x,y:f.source.y,z:.2},initialTarget:mount.resolvePosition(),
  resolveTargetPosition:mount.resolvePosition,isBattleActive:sourceRef.isBattleActive});
 const damage=fearProjectileDamageAction(f.b,sourceRef);let hits=0;
 f.b.addProjectile({from:trace.position,to:trace.destination,source:f.source,maxAge:10,
  advanceMotion:({dt})=>trace.advance(dt),onHit:()=>{
   hits++;applyFearProjectileImpact(f.b,{source:f.source,target:f.target,applyAttachments:()=>{},runActions:damage});
   mount.release();trace.release();sourceRef.release();
  }});
 f.b.kill(f.source,null);const hp=f.target.hp;f.h.run(.3);
 assert.equal(hits,1);assert.equal(hp-f.target.hp,200);assert.ok(f.target.findBuff(parentKey));
 assert.equal(f.b.projectiles.list.length,0);f.h.run(.2);assert.equal(hits,1);assert.deepEqual(f.b.errors,[]);
});

test('selected speed-10 motion advances in three dimensions and snaps without overshoot',()=>{
 const origin={x:0,y:0,z:0};
 for(const axis of ['x','y','z']){
  const target={...origin,[axis]:5};
  assert.deepEqual(fearProjectileMotionStep(origin,target,.1),{...origin,[axis]:1,reached:false});
  assert.deepEqual(fearProjectileMotionStep(origin,target,1),{...target,reached:true});
  assert.deepEqual(target,{...origin,[axis]:5});
 }
 const diagonal=fearProjectileMotionStep(origin,{x:3,y:4,z:0},.1);
 assert.equal(diagonal.x,Math.fround(.6));
 // Native component*delta then *speed rounds twice: this is one ULP above
 // float32(0.8), which a combined distance multiplier would incorrectly return.
 assert.equal(diagonal.y,.8000000715255737);assert.equal(diagonal.z,0);
 assert.equal(diagonal.reached,false);assert.deepEqual(origin,{x:0,y:0,z:0});
});

test('motion uses the supplied current 3D destination and arrival tolerance after movement',()=>{
 const first=fearProjectileMotionStep({x:0,y:0,z:0},{x:5,y:0,z:0},.1);
 const second=fearProjectileMotionStep(first,{x:1,y:0,z:5},.1);
 assert.deepEqual(second,{x:1,y:0,z:1,reached:false});
 assert.deepEqual(fearProjectileMotionStep({x:0,y:0,z:0},{x:.09,y:0,z:0},0),{x:0,y:0,z:0,reached:true});
 assert.deepEqual(fearProjectileMotionStep({x:0,y:0,z:0},{x:0,y:0,z:0},0),{x:0,y:0,z:0,reached:true});
 for(const delta of [-1,NaN,Infinity])assert.throws(()=>fearProjectileMotionStep(first,second,delta));
 assert.throws(()=>fearProjectileMotionStep({x:0,y:0},{x:1,y:1,z:0},.1),/3D/);
});

test('native arrival includes the float32 0.1 boundary and checks all three mount-point axes',()=>{
 const zero={x:0,y:0,z:0},radius=Math.fround(.1),outside=Math.fround(radius+2**-27);
 const source=read('data/candidates/arkpedia-windows-fear-movement-source.json');
 assert.equal(source.arrivalTolerance.float32,radius);assert.equal(source.arrivalTolerance.dimensions,3);
 for(const axis of ['x','y','z']){
  assert.equal(fearProjectileReached(zero,{...zero,[axis]:radius}),true,axis+' inclusive');
  assert.equal(fearProjectileReached(zero,{...zero,[axis]:outside}),false,axis+' outside');
 }
 assert.equal(fearProjectileReached(zero,{x:.06,y:.06,z:.06}),false,'3D distance exceeds radius despite each axis fitting');
 assert.equal(fearProjectileReached({x:12,y:-3,z:4},{x:12.05,y:-3.05,z:4}),true);
 assert.equal(fearProjectileReached(zero,{x:0,y:0}),false,'missing mount-point height is not silently flattened');
 for(const value of [NaN,Infinity,-Infinity])assert.equal(fearProjectileReached(zero,{x:0,y:0,z:value}),false);
 assert.equal(fearProjectileReached(null,zero),false);
});
function fixture({marked=true,full=false,local=false}={}){
 const ref=read('data/candidates/arkpedia-stage-16-9-source.json').rawLevel.enemyDbRefs.find(r=>r.useDb===false);
 const targetRec=local?compileStageLocalEnemy(ref,{damageType:'PHYSIC'}):enemyRec({key:'recipient',maxHp:1000,atk:0,moveSpeed:0});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{enemies:{source:enemyRec({key:'source',atk:0,moveSpeed:0}),[targetRec.key]:targetRec}}});
 h.b.start();const source=h.spawn('source',{pos:[10,6]}),target=h.spawn(targetRec.key,{pos:[10,7]});
 for(const u of [source,target]){u.profile.noAttack=true;u.base.moveSpeed=0;u.markDirty();}
 if(marked)h.b.addBuff(target,{key:'enemy_mcreep_self_mark',persist:true});
 target.hp=full?target.s.maxHp:target.s.maxHp/2;
 return{h,b:h.b,source,target,manager:fearProjectileAfflictions(h.b)};
}
function apply(f){const p=f.manager.apply(f.source,f.target);assert.ok(p);return p;}
function assertClean(f){assert.equal(f.target.findBuff(parentKey),null);assert.equal(f.target.buffs.some(b=>b.key.startsWith('ch16:fearpj:')),false);assert.deepEqual(f.b.errors,[]);}

test('born source reference captures preprocessing ATK but resolves later same-life ATK',()=>{
 const f=fixture();f.source.base.atk=200;f.source.markDirty();const ref=fearProjectileSourceReference(f.b,f.source);
 f.source.base.atk=325;f.source.markDirty();const hp=f.target.hp;
 fearProjectileDamageAction(f.b,ref)({target:f.target});assert.equal(ref.cachedAtk,200);assert.equal(hp-f.target.hp,325);
 ref.release();assert.equal(ref.resolveSource(),null);assert.deepEqual(f.b.errors,[]);
});

test('dead or inactive but unretired source keeps its same-life reference until removal',()=>{
 const f=fixture(),ref=fearProjectileSourceReference(f.b,f.source);
 f.source.alive=false;f.source.deployed=false;f.b.emit('death',{unit:f.source});
 assert.equal(ref.resolveSource(),f.source);f.b.emit('removed',{unit:f.source});assert.equal(ref.resolveSource(),null);
});

for(const retire of ['removed','reuse','battleEnd'])test('source reference '+retire+' preserves cached damage and rejects replacement stats',()=>{
 const f=fixture();f.source.base.atk=210;f.source.markDirty();const ref=fearProjectileSourceReference(f.b,f.source);
 if(retire==='removed')f.b.kill(f.source,null);else if(retire==='reuse')f.source.deploySeq++;else f.b.emit('battleEnd',{});
 f.source.base.atk=9999;f.source.markDirty();assert.equal(ref.resolveSource(),null);assert.equal(ref.cachedAtk,210);
 const hp=f.target.hp;fearProjectileDamageAction(f.b,ref)({target:f.target});
 assert.equal(hp-f.target.hp,retire==='battleEnd'?0:210);assert.deepEqual(f.b.errors,[]);
});

for(const retiredFirst of [false,true])test('source reference prevents post-battle cached output without affliction manager, retired='+retiredFirst,()=>{
 const h=makeBattle({content:'generic',autoFinish:false,defs:{enemies:{source:enemyRec({key:'source',atk:200,moveSpeed:0}),target:enemyRec({key:'target',maxHp:1000,moveSpeed:0})}}});
 h.b.start();const source=h.spawn('source',{pos:[10,6]}),target=h.spawn('target',{pos:[10,7]});
 const ref=fearProjectileSourceReference(h.b,source);assert.equal(h.b.chapter16FearAfflictions,undefined);
 if(retiredFirst)h.b.kill(source,null);
 h.b.emit('battleEnd',{});const hp=target.hp;fearProjectileDamageAction(h.b,ref)({target});
 assert.equal(target.hp,hp);assert.equal(ref.isBattleActive(),false);
});

test('impact damage reads the resolved source ATK after buff and attachment callbacks',()=>{
 const f=fixture(),hp=f.target.hp,damage=fearProjectileDamageAction(f.b,{cachedAtk:200,resolveSource:()=>f.source});
 applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>{f.b.addBuff(f.source,{key:'impact-atk',persist:true,mods:{atkFlat:350}});},runActions:damage});
 assert.equal(hp-f.target.hp,350);assert.deepEqual(f.b.errors,[]);
});

test('missing source reference uses the supplied preprocessed ATK without transferring damage credit',()=>{
 const f=fixture(),hp=f.target.hp,packets=[];
 f.b.on('damaged',c=>{if(c.target===f.target)packets.push(c);});
 const damage=fearProjectileDamageAction(f.b,{cachedAtk:225,resolveSource:()=>null});
 applyFearProjectileImpact(f.b,{source:f.source,target:f.target,applyAttachments:()=>{},runActions:damage});
 assert.equal(hp-f.target.hp,225);assert.equal(packets.length,1);assert.equal(packets[0].source,null);
 assert.deepEqual(f.b.errors,[]);
});

test('source alive flag alone does not override an explicit native-reference resolver',()=>{
 const f=fixture(),hp=f.target.hp;f.source.base.atk=175;f.source.markDirty();f.b.kill(f.source,null);
 const amount=f.source.s.atk,damage=fearProjectileDamageAction(f.b,{cachedAtk:999,resolveSource:()=>f.source});
 applyFearProjectileImpact(f.b,{source:f.source,target:f.target,applyAttachments:()=>{},runActions:damage});
 assert.equal(hp-f.target.hp,amount);assert.deepEqual(f.b.errors,[]);
});

test('reentrant source resolution cannot damage a replacement recipient life',()=>{
 const f=fixture(),hp=f.target.hp;
 const damage=fearProjectileDamageAction(f.b,{cachedAtk:225,resolveSource:()=>{f.target.deploySeq++;return null;}});
 damage({target:f.target});assert.equal(f.target.hp,hp);
 for(const cachedAtk of [-1,NaN,Infinity])assert.throws(()=>fearProjectileDamageAction(f.b,{cachedAtk,resolveSource:()=>null}),/requires/);
});

test('an ended battle rejects damage before invoking a source resolver',()=>{
 const f=fixture();f.b.emit('battleEnd',{});let calls=0;
 fearProjectileDamageAction(f.b,{cachedAtk:200,resolveSource:()=>{calls++;return f.source;}})({target:f.target});
 assert.equal(calls,0);assert.deepEqual(f.b.errors,[]);
});

test('impact runs the caller attachments and damage actions after Fear/Disarm admission',()=>{
 const f=fixture(),order=[],hp=f.target.hp;
 const ok=applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:({target})=>{assert.equal(target.s.flags.disarm,true);assert.equal(target.s.flags.fear,true);order.push('attachments');},
  runActions:({source,target})=>{assert.equal(target.s.flags.disarm,true);order.push('damage');f.b.dealDamage(source,target,{amount:100,type:'arts',canDodge:false});}});
 assert.equal(ok,true);assert.deepEqual(order,['attachments','damage']);assert.equal(f.target.hp,hp-100);
 assert.deepEqual(f.b.errors,[]);
});

test('unmarked impact recipients still receive caller actions after the parent finishes',()=>{
 const f=fixture({marked:false});let count=0;
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>{count++;},runActions:()=>{count++;}}),true);
 assert.equal(count,2);assertClean(f);
});

for(const event of ['death','reuse','battleEnd'])test('impact '+event+' during buff admission prevents later output for that recipient life',()=>{
 const f=fixture();let calls=0;
 f.b.on('beforeBuff',c=>{if(c.unit!==f.target||c.buff.key!==parentKey)return;
  if(event==='death')f.b.kill(f.target,null);else if(event==='reuse')f.target.deploySeq++;else f.b.emit('battleEnd',{});});
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>calls++,runActions:()=>calls++}),false);
 assert.equal(calls,0);
});

test('impact revalidates the recipient after attachment callbacks before running damage actions',()=>{
 const f=fixture();let calls=0;
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>{f.target.deploySeq++;},runActions:()=>calls++}),false);
 assert.equal(calls,0);
});

test('a completed battle rejects later impacts even when the caller still holds live object references',()=>{
 const f=fixture();f.b.emit('battleEnd',{});let calls=0;
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>calls++,runActions:()=>calls++}),false);
 assert.equal(calls,0);assertClean(f);
});

test('born impact accepts an explicitly retained dead source and does not choose its damage packet',()=>{
 const f=fixture();f.b.kill(f.source,null);let actionSource;
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>{},runActions:({source})=>{actionSource=source;}}),true);
 assert.equal(actionSource,f.source);assert.equal(f.target.s.flags.disarm,true);
 assert.throws(()=>applyFearProjectileImpact(f.b,{source:f.source,target:f.target,runActions:()=>{}}),/explicit/);
});
test('affliction producer reproduces native graph, alias receipt and exact derived-buff action contract',()=>{
 const c=read('data/candidates/arkpedia-ch16-fear-affliction-contract.json');assert.equal(c.testOnly,true);assert.equal(c.frameParity,false);
 for(const row of Object.values(c.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+row.path,import.meta.url))).digest('hex'),row.sha256);
 assert.equal(c.defaults.interval,.5);assert.equal(c.defaults.fearDuration,999999);
 execFileSync(process.execPath,['tools/arkpedia/fear-affliction-contract.mjs','--check'],{stdio:'pipe'});
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies.enemy_10128_fearpj.policy,null);
 assert.equal(read('data/arkpedia-stages.json').stages.some(s=>s.code==='16-9'),false);
});
test('unmarked recipients finish the parent without fear or disarm',()=>{
 const f=fixture({marked:false});assert.equal(f.manager.apply(f.source,f.target),null);
 assert.equal(!!f.target.s.flags.fear,false);assert.equal(!!f.target.s.flags.disarm,false);assertClean(f);
});
test('marked injured recipient retains derived fear/disarm until the first full-HP sampled trigger',()=>{
 const f=fixture(),p=apply(f);assert.equal(p.children.length,2);assert.equal(f.target.s.flags.fear,true);assert.equal(f.target.s.flags.disarm,true);
 f.h.run(.3);f.b.heal(f.source,f.target,1e6);assert.equal(f.target.hp,f.target.s.maxHp);f.h.run(.1);assert.equal(p.active,true);
 f.h.run(.11);assert.equal(p.active,false);assert.equal(!!f.target.s.flags.fear,false);assert.equal(!!f.target.s.flags.disarm,false);assertClean(f);
});
test('initial full HP still waits for the first half-second parent trigger',()=>{
 const f=fixture({full:true}),p=apply(f);f.h.run(.4);assert.equal(p.active,true);f.h.run(.11);assert.equal(p.active,false);assertClean(f);
});
test('the literal16-9 miner rejects Fear through its actual immunity while derived Disarm remains owned',()=>{
 const f=fixture({local:true}),p=apply(f);assert.ok(f.target.def.immune.has('feared'));
 assert.equal(!!f.target.s.flags.fear,false);assert.equal(f.target.s.flags.disarm,true);assert.equal(p.children.length,1);
 f.b.heal(f.source,f.target,1e6);f.h.run(.51);assert.equal(!!f.target.s.flags.disarm,false);assertClean(f);
});
test('finishing one parent preserves unrelated fear and disarm status owners',()=>{
 const f=fixture();f.b.applyStatus(f.target,'fear',{key:'other-fear',duration:30,source:f.source});
 const other=f.b.addBuff(f.target,{key:'other-disarm',persist:true,flags:{disarm:true}}),p=apply(f);
 f.manager.finish(p);assertClean(f);assert.ok(f.target.findBuff('other-fear'));assert.ok(f.target.buffs.includes(other));
 assert.equal(f.target.s.flags.fear,true);assert.equal(f.target.s.flags.disarm,true);
});
test('parent replacement retires only its old children and resets its own half-second trigger',()=>{
 const f=fixture(),old=apply(f);f.h.run(.3);const next=apply(f);
 assert.equal(old.active,false);assert.ok(old.children.length===0);assert.equal(next.active,true);
 assert.equal(f.target.buffs.filter(b=>b.key===parentKey).length,1);assert.equal(f.target.buffs.filter(b=>b.key.startsWith('ch16:fearpj:')).length,2);
 f.b.heal(f.source,f.target,1e6);f.h.run(.3);assert.equal(next.active,true);f.h.run(.21);assert.equal(next.active,false);assertClean(f);
});
test('removing the miner mark after activation does not invent a periodic marker check',()=>{
 const f=fixture(),p=apply(f);f.b.removeBuff(f.target,'enemy_mcreep_self_mark');f.h.run(1.1);
 assert.equal(p.active,true);assert.equal(f.target.s.flags.fear,true);f.manager.finish(p);assertClean(f);
});
for(const control of ['stun','silence','freeze','sleep','levitate'])test('parent full-HP check is not paused by recipient '+control,()=>{
 const f=fixture(),p=apply(f);f.b.addBuff(f.target,{key:'control',persist:true,flags:{[control]:true}});
 f.target.hp=f.target.s.maxHp;f.h.run(.51);assert.equal(p.active,false);assertClean(f);
});
for(const invalid of ['sourceDeath','sourceReuse','recipientDeath','recipientReuse','recipientRemoved','battleEnd','parentRemoved','parentReplaced'])
test('derived ownership handles '+invalid+' without donating children or removing replacements',()=>{
 const f=fixture(),p=apply(f),original=p.source;
 if(invalid==='sourceDeath')f.b.kill(f.source,null);
 else if(invalid==='sourceReuse'){f.source.deploySeq++;f.source.stats={...f.source.stats};}
 else if(invalid==='recipientDeath')f.b.kill(f.target,null);
 else if(invalid==='recipientReuse')f.target.deploySeq++;
 else if(invalid==='recipientRemoved'){f.target.deployed=false;f.b.emit('removed',{unit:f.target});}
 else if(invalid==='battleEnd')f.b.emit('battleEnd',{});
 else if(invalid==='parentRemoved')f.b.removeBuff(f.target,p.parent);
 else f.b.addBuff(f.target,{key:parentKey,persist:true});
 f.h.run(.6);
 if(invalid.startsWith('source')){
  assert.equal(p.active,true);assert.equal(p.source,original);assert.notEqual(p.source,f.source);assert.equal(f.target.s.flags.disarm,true);f.manager.finish(p);assertClean(f);
 }else{
  assert.equal(p.active,false);
  if(invalid==='parentReplaced'){assert.ok(f.target.findBuff(parentKey));assert.equal(f.target.buffs.some(b=>b.key.startsWith('ch16:fearpj:')),false);}
  else assertClean(f);
 }
 assert.deepEqual(f.b.errors,[]);
});
for(const reject of ['parent','fear','disarm'])test('rejected '+reject+' never creates orphan derived output',()=>{
 const f=fixture();f.b.on('beforeBuff',c=>{if(reject==='parent'?c.buff.key===parentKey:c.buff.key.startsWith(`ch16:fearpj:${reject}:`))c.cancel=true;});
 const p=f.manager.apply(f.source,f.target);
 if(reject==='parent'){assert.equal(p,null);assertClean(f);}else{assert.ok(p);assert.equal(p.children.length,1);f.manager.finish(p);assertClean(f);}
});
for(const at of ['beforeStatus','statusApplied','disarmBeforeBuff'])test('reentrant parent finish at '+at+' leaves no orphan child',()=>{
 const f=fixture();const stop=()=>f.b.removeBuff(f.target,parentKey);
 if(at==='disarmBeforeBuff')f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('ch16:fearpj:disarm:'))stop();});
 else f.b.on(at,c=>{if(c.target===f.target&&c.status==='fear')stop();});
 assert.equal(f.manager.apply(f.source,f.target),null);assertClean(f);
});
test('reentrant application while retiring old children preserves the newer parent without orphan statuses',()=>{
 const f=fixture(),old=apply(f);let newer;
 old.children[0].onRemove=()=>{newer=f.manager.apply(f.source,f.target);};
 assert.equal(f.manager.apply(f.source,f.target),null);
 assert.ok(newer?.active);assert.equal(f.target.buffs.filter(b=>b.key===parentKey).length,1);
 assert.equal(f.target.buffs.filter(b=>b.key.startsWith('ch16:fearpj:')).length,2);
 f.manager.finish(newer);assertClean(f);
});
test('recipient replacement during old-child cleanup refuses the pending new application',()=>{
 const f=fixture(),old=apply(f);old.children[0].onRemove=()=>{f.target.deploySeq++;};
 assert.equal(f.manager.apply(f.source,f.target),null);assertClean(f);
});
test('almost-full HP never finishes the literal full-HP recovery check',()=>{
 const f=fixture(),p=apply(f);f.target.hp=f.target.s.maxHp-.01;f.h.run(1.1);
 assert.equal(p.active,true);f.manager.finish(p);assertClean(f);
});
test('source replacement during old-child cleanup cannot donate replacement stats or credit',()=>{
 const f=fixture(),old=apply(f),stats=f.source.stats,atk=f.source.s.atk;
 old.children[0].onRemove=()=>{f.source.deploySeq++;f.source.stats={...stats};f.source.base.atk=99999;f.source.markDirty();};
 const next=apply(f);assert.equal(next.source.stats,stats);assert.equal(next.source.s.atk,atk);
 f.manager.finish(next);assertClean(f);
});
test('actual miner fear-loss and shadow suppression recover after the owned parent clears at full HP',()=>{
 const{h,b,e}=minerBattle(minerKeys[0],[{stats:{atk:0}}]);h.run(.31);
 const env=chapter16Shadow(b),tile=10*21+6,prior=env.shadowSuppressedUntil.get(tile);e.hp=2000;
 const p=fearProjectileAfflictions(b).apply(h.allies()[0],e);assert.ok(p);
 h.run(1.4);assert.equal(e.hp,1800);assert.equal(env.shadowSuppressedUntil.get(tile),prior);
 b.heal(h.allies()[0],e,1e6);h.run(.6);assert.equal(p.active,false);assert.equal(e.hp,e.s.maxHp);
 assert.ok(env.shadowSuppressedUntil.get(tile)>prior);assert.equal(!!e.s.flags.fear,false);assert.equal(!!e.s.flags.disarm,false);
 h.run(1.1);assert.equal(e.hp,e.s.maxHp);assert.deepEqual(b.errors,[]);
});
test('a hidden recipient keeps its parent clock and can recover at full HP without being selectable',()=>{
 const f=fixture(),p=apply(f);f.target.hidden=true;f.h.run(.6);assert.equal(p.active,true);
 f.target.hp=f.target.s.maxHp;f.h.run(.41);assert.equal(p.active,false);assertClean(f);
});
