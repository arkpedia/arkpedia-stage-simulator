// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec,enemyRec} from './helpers/battleHarness.js';
import saga from '../data/arkpedia-saga-prefabs.json' with {type:'json'};
import twins from '../data/candidates/arkpedia-ch17-mutwin-lifecycle-contract.json' with {type:'json'};
import {executeEnemyInstantKill as execute,verifyEnemyInstantKill as verify,currentEnemyInstantKillReceipt as receipt} from '../server/sim/enemy-instant-kill.js';
import {verifySagaInstantKillSource} from '../server/sim/content/arkpedia-saga.js';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import leakTerminal from '../data/candidates/arkpedia-leak-source-terminal-contract.json' with {type:'json'};
const normal=saga.templates.cripple.eventToActions.ON_BUFF_TRIGGER[2],skip=twins.markFinish[0]._succeedNodes[0];
function fixture({ranged=false}={}){
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{ik:enemyRec({key:'ik',hp:100,speed:0,atk:10,range:ranged?2:0})},chess:{op:chessRec({id:'op'})}},units:[{chessId:'op',row:10,col:4}]});h.b.start();
 const e=h.spawn('ik',{pos:[10,7]}),source=h.spawn('ik',{pos:[10,9]});return{h,b:h.b,e,source,op:h.allies()[0]};
}
test('the explicit native path bypasses damage/floors and preserves no-source kill accounting without changing Battle.kill',()=>{
 const f=fixture();f.b.addBuff(f.e,{key:'protection',flags:{invulnerable:true,undeadable:true},shield:1e6});let killer='unset',hits=0;f.b.on('kill',c=>{killer=c.killer;});f.b.on('hit',()=>hits++);
 const r=execute(f.b,{source:f.op,target:f.e,action:normal});assert.equal(r.status,'killed');assert.equal(f.e.alive,false);assert.equal(killer,null);assert.equal(hits,0);assert.equal(f.op.stats.dmg,0);assert.equal(f.op.stats.kills,0);assert.equal(f.b.killed,1);assert.deepEqual(f.b.errors,[]);
});
test('killSource selects the source enemy even when TARGET names another body, and skipReborn emits no admission hook',()=>{
 const f=fixture();let calls=0;f.b.on('enemyInstantKill',()=>calls++);const r=execute(f.b,{source:f.source,target:f.e,action:skip});
 assert.equal(r.status,'killed');assert.equal(f.source.alive,false);assert.equal(f.e.alive,true);assert.equal(calls,0);assert.deepEqual(f.b.errors,[]);
});
test('SOURCE and explicit BUFF_OWNER selection retain their literal recipient and source credit',()=>{
 for(const kind of ['SOURCE','BUFF_OWNER']){
  const f=fixture(),action={...normal,_targetType:kind,_noSource:false};const victim=kind==='SOURCE'?f.source:f.e;
  execute(f.b,{source:f.source,target:kind==='SOURCE'?f.e:f.source,buffOwner:f.e,action});assert.equal(victim.alive,false);assert.equal(f.source.stats.kills,1);assert.deepEqual(f.b.errors,[]);
 }
});

test('Leak Source terminal contract reproduces its complete original graphs without claiming caller kill credit',()=>{
 for(const pin of Object.values(leakTerminal.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+pin.path,import.meta.url))).digest('hex'),pin.sha256);
 execFileSync(process.execPath,['tools/arkpedia/leak-source-terminal-contract.mjs','--check'],{stdio:'pipe'});
 assert.equal(leakTerminal.runtimeIntegrated,false);assert.equal(leakTerminal.frameParity,false);
 assert.equal(leakTerminal.terminal.finish.action._targetType,'BUFF_OWNER');assert.equal(leakTerminal.terminal.contact.action._targetType,'BUFF_SOURCE');
 for(const entry of Object.values(leakTerminal.terminal)){
  const template=leakTerminal.templates[entry.template];assert.equal(createHash('sha256').update(template.originalJson).digest('hex'),template.sha256);
  const event=JSON.parse(template.originalJson).eventToActions._items.find(e=>e.key===entry.event);
  assert.deepEqual(JSON.parse(event.value.SerializedState)[entry.index],entry.action);assert.equal(entry.action._noSource,false);assert.equal(entry.action._skipReborn,false);
 }
});

test('BUFF_SOURCE selects a separate buff source body and gives only the explicitly supplied action source kill credit',()=>{
 const f=fixture(),action=leakTerminal.terminal.contact.action;let credit,captured;
 f.b.on('kill',c=>{credit=c.killer;});f.b.on('enemyInstantKill',ctx=>{captured=receipt(ctx,f.b);});
 const result=execute(f.b,{source:f.op,target:f.source,buffOwner:f.source,buffSource:f.e,action});
 assert.equal(result.status,'killed');assert.equal(f.e.alive,false);assert.ok(f.source.alive&&f.op.alive);assert.equal(credit,f.op);assert.equal(f.op.stats.kills,1);
 assert.equal(captured.buffOwner,f.source);assert.equal(captured.buffSource,f.e);assert.equal(captured.source,f.op);assert.equal(captured.unit,f.e);assert.deepEqual(f.b.errors,[]);
});

test('an omitted or retired BUFF_SOURCE never falls back to SOURCE, TARGET or BUFF_OWNER',()=>{
 const f=fixture(),action=leakTerminal.terminal.contact.action;
 assert.equal(execute(f.b,{source:f.source,target:f.e,buffOwner:f.e,action}).status,'inactive');
 assert.ok(f.e.alive&&f.source.alive);assert.equal(f.b.killed,0);
 f.b.kill(f.e,null);assert.equal(execute(f.b,{source:f.source,target:f.source,buffOwner:f.source,buffSource:f.e,action}).status,'inactive');assert.ok(f.source.alive);
 assert.throws(()=>execute(f.b,{source:f.source,buffSource:f.op,action}),/enemy recipient/);assert.ok(f.op.alive);assert.deepEqual(f.b.errors,[]);
});

test('BUFF_SOURCE preserves noSource and explicit killSource precedence independently of both buff identities',()=>{
 const f=fixture(),action={...leakTerminal.terminal.contact.action,_noSource:true};let credit='unset';f.b.on('kill',c=>{credit=c.killer;});
 execute(f.b,{source:f.op,target:f.source,buffOwner:f.source,buffSource:f.e,action});assert.equal(credit,null);assert.equal(f.op.stats.kills,0);assert.ok(f.source.alive);
 const g=fixture();execute(g.b,{source:g.source,target:g.e,buffOwner:g.e,buffSource:g.e,action:{...action,_killSource:true}});assert.equal(g.source.alive,false);assert.ok(g.e.alive);assert.deepEqual([...f.b.errors,...g.b.errors],[]);
});

test('BUFF_SOURCE admits rebirth once and cannot retire a replacement deployment during its admission',()=>{
 for(const replace of [false,true]){
  const f=fixture();f.b.on('enemyInstantKill',ctx=>{assert.equal(receipt(ctx,f.b).buffSource,f.e);ctx.unit.hp=17;if(replace)ctx.unit.deploySeq++;else ctx.reborn=true;});
  const result=execute(f.b,{source:f.op,buffOwner:f.source,buffSource:f.e,action:leakTerminal.terminal.contact.action});
  assert.equal(result.status,replace?'retired':'reborn');assert.ok(f.e.alive&&f.source.alive);assert.equal(f.e.hp,17);assert.equal(f.b.killed,0);assert.deepEqual(f.b.errors,[]);
 }
});

test('BUFF_SOURCE cancels on a deferred battle end and restores untouched pending HP',()=>{
 const f=fixture(),hp=f.e.hp;let result;f.b.on('enemyInstantKill',()=>f.b.forceEnd());
 f.b.after(0,()=>{result=execute(f.b,{source:f.op,buffOwner:f.source,buffSource:f.e,action:leakTerminal.terminal.contact.action});});f.b.step();
 assert.equal(result.status,'cancelled');assert.equal(f.e.hp,hp);assert.ok(f.e.alive&&f.source.alive);assert.equal(f.b.killed,0);assert.ok(f.b.finished);assert.deepEqual(f.b.errors,[]);
});
test('native admission exposes a frozen battle/life/action receipt only during its actual dispatch',()=>{
 const f=fixture(),other=fixture();let captured,r;f.b.on('enemyInstantKill',ctx=>{captured=ctx;r=receipt(ctx,f.b);assert.equal(receipt(ctx,other.b),null);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.action));});
 execute(f.b,{source:f.op,target:f.e,action:normal});assert.equal(r.unit,f.e);assert.equal(r.unitLife,f.e.deploySeq);assert.equal(receipt(captured,f.b),null);assert.equal(receipt({...captured},f.b),null);assert.deepEqual(f.b.errors,[]);
});
test('a recipient reused during admission cannot be killed by the previous deployment action',()=>{
 const f=fixture(),life=f.e.deploySeq;f.b.on('enemyInstantKill',ctx=>{ctx.unit.deploySeq++;ctx.unit.hp=42;});const r=execute(f.b,{source:f.op,target:f.e,action:normal});
 assert.equal(r.status,'retired');assert.equal(r.unitLife,life);assert.ok(f.e.alive);assert.equal(f.e.hp,42);assert.equal(f.b.killed,0);assert.deepEqual(f.b.errors,[]);
});
test('explicit rebirth acceptance must repair positive HP; a flag alone cannot leave a zero-HP living enemy',()=>{
 const f=fixture();f.b.on('enemyInstantKill',ctx=>{ctx.reborn=true;});assert.equal(execute(f.b,{source:f.op,target:f.e,action:normal}).status,'killed');assert.equal(f.e.hp,0);assert.equal(f.e.alive,false);
 const g=fixture();g.b.on('enemyInstantKill',ctx=>{ctx.unit.hp=2;ctx.reborn=true;});assert.equal(execute(g.b,{source:g.op,target:g.e,action:normal}).status,'reborn');assert.ok(g.e.alive);assert.equal(g.e.hp,2);assert.equal(g.b.killed,0);
});
test('battle-end cancellation restores untouched pending HP without killing after finalization',()=>{
 const f=fixture();f.b.on('enemyInstantKill',()=>f.b._finish('defeat'));assert.equal(execute(f.b,{source:f.op,target:f.e,action:normal}).status,'cancelled');assert.ok(f.e.alive);assert.equal(f.e.hp,100);assert.equal(f.b.killed,0);
});

test('a deferred end request during native admission cancels before kill bookkeeping or further native actions',()=>{
 const f=fixture(),hp=f.e.hp;let first,second,calls=0;f.b.on('enemyInstantKill',()=>{calls++;f.b.forceEnd();});
 f.b.after(0,()=>{first=execute(f.b,{source:f.op,target:f.e,action:normal});second=execute(f.b,{source:f.op,target:f.source,action:normal});});f.b.step();
 assert.equal(first.status,'cancelled');assert.equal(second.status,'inactive');assert.equal(calls,1);assert.equal(f.e.hp,hp);assert.ok(f.e.alive&&f.source.alive);assert.equal(f.b.killed,0);assert.ok(f.b.finished);assert.equal(f.b.result().killed,0);assert.deepEqual(f.b.errors,[]);
});
test('unsupported noReason/exit/rally/state variants, unknown fields and ally recipients fail closed',()=>{
 for(const key of ['_noReason','_markReachExit','_withdrawIfRallyPoint','_resultIfInRallyPointMode','_switchState'])assert.throws(()=>verify({...normal,[key]:true}),/Unreviewed/);
 assert.throws(()=>verify({...normal,_skipReborn:0}),/Unreviewed/);assert.throws(()=>verify({...normal,extra:true}),/Unreviewed/);
 const f=fixture();assert.throws(()=>execute(f.b,{source:f.source,target:f.op,action:normal}),/enemy recipient/);assert.equal(f.e.hp,100);assert.ok(f.op.alive);
});
test('Saga kill fields must agree with the original serialized template, including its non-skipping flag',()=>{
 assert.equal(verifySagaInstantKillSource().length,3);for(const mode of ['skip','raw','wound']){
  const source=structuredClone(saga);if(mode==='skip')source.templates.cripple.eventToActions.ON_BUFF_TRIGGER[2]._skipReborn=true;
  else if(mode==='wound')source.templates.saga_t_1.eventToActions.ON_AFTER_OUTPUT_DAMAGE[3]._buff.attributes.abnormalFlags.push('UNBLOCKABLE');
  else{const row=source.originalTemplates.cripple.eventToActions._items.find(x=>x.key===2),actions=JSON.parse(row.value.SerializedState);actions[2]._noSource=false;row.value.SerializedState=JSON.stringify(actions);}
  assert.throws(()=>verifySagaInstantKillSource(source),/Changed original/);
 }
});
for(const ranged of [false,true])test('DISABLE_COMBAT retains an existing block, forbids blocking attacks and permits only unblocked ranged attacks: ranged='+ranged,()=>{
 const f=fixture({ranged});f.op.ground=true;f.op.profile.noAttack=true;f.e.x=f.op.x;f.e.y=f.op.y;assert.equal(f.b._checkBlock(f.e),true);
 f.b.addBuff(f.e,{key:'native-disable-combat',flags:{noCombat:true},data:{nativeUnblockableImmune:true}});f.h.run(.1);
 assert.equal(f.e.blockedBy,f.op);assert.equal(f.e.stats.attacks,0);assert.equal(f.e.s.flags.unblockable,false);f.b._unblock(f.e);assert.equal(f.b._checkBlock(f.e),false);f.h.run(.1);
 assert.equal(f.e.stats.attacks,ranged?1:0);f.b.removeBuff(f.e,'native-disable-combat');assert.equal(f.b._checkBlock(f.e),true);assert.equal(f.e.blockedBy,f.op);assert.deepEqual(f.b.errors,[]);
});
test('enemy-only DISABLE_COMBAT does not replace an allied unit noBlock flag',()=>{
 const f=fixture();f.op.ground=true;f.op.profile.noAttack=true;f.e.x=f.op.x;f.e.y=f.op.y;assert.equal(f.b._checkBlock(f.e),true);
 f.b.addBuff(f.op,{key:'native-disable-combat',flags:{noCombat:true}});f.h.run(.1);assert.equal(f.e.blockedBy,f.op);f.b._unblock(f.e);assert.equal(f.b._checkBlock(f.e),true);assert.deepEqual(f.b.errors,[]);
});
