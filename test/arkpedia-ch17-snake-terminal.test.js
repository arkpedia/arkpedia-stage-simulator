// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeBattle} from './helpers/battleHarness.js';
import {installChapter17SnakeTerminal as install} from '../server/sim/content/chapter17-snake-terminal.js';
import {chapter17BossCounterSnapshot as snapshot,clickChapter17BossCounter as click} from '../server/sim/content/chapter17-boss-counter.js';
import {currentHpZeroAttemptReceipt} from '../server/sim/damage.js';
import {snakeTerminalContract} from '../tools/arkpedia/snake-terminal-contract.mjs';
const bytes=p=>readFileSync(new URL('../'+p,import.meta.url)),read=p=>JSON.parse(bytes(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const contract=read('data/candidates/arkpedia-ch17-snake-terminal-contract.json'),key=contract.enemy;
function fixture({beforeInstall=()=>{},finishWave}={}){
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:1e6,defs:{enemies:{[key]:read('data/candidates/arkpedia-enemy-records.canonical.json').enemies[key].levels[0]}}});
 h.b.start();const e=h.spawn(key,{pos:[10,6]});e.base.moveSpeed=0;e.profile.noAttack=true;e.markDirty();const waves=[];
 beforeInstall(h.b,e);const p=install(h.b,e,{finishWave:finishWave??(r=>waves.push(r))});return{h,b:h.b,e,p,waves};
}
const lethal=f=>f.b.dealDamage(null,f.e,{amount:f.e.s.maxHp*2,type:'true'});
function button(f){lethal(f);f.h.run(.51);assert.equal(f.p.mode,'button');const c=snapshot(f.b)[0];assert.ok(c);return c;}
function taps(f,c,n){for(let i=0;i<n;i++)assert.equal(click(f.b,c),true);}

test('terminal contract reproduces original floor, delayed derived child, literal finish key and wave action',async()=>{
 assert.deepEqual(await snakeTerminalContract(),contract);for(const file of Object.values(contract.sources))assert.equal(sha(bytes(file.path)),file.sha256);
 assert.deepEqual(contract.beforeDead.attributes.abnormalFlags,[6]);assert.equal(contract.admission[0]._buff.triggerInterval,.5);
 assert.equal(contract.admission[0]._buff.triggerCnt,1);assert.equal(contract.admission[0]._isDerivedBuff,true);assert.equal(contract.admission[0]._finishDerivedBuffIfParentFinish,true);
 assert.equal(contract.finish[0]._buffKey,'enemy_musnak_before_dead');assert.equal(contract.finish.find(n=>n.$type.endsWith('+InstantKill'))._markReachExit,false);
 assert.equal(contract.finish.find(n=>n.$type.endsWith('+FinishCurrentWave'))._finishAndSkip,true);
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies[key].policy,null);
});
test('a real lethal HP-set attempt floors HP and admits one terminal button only after the source half-second delay',()=>{
 const f=fixture();lethal(f);assert.equal(f.e.alive,true);assert.equal(f.e.hp,1);assert.equal(f.p.mode,'waiting');assert.deepEqual(snapshot(f.b),[]);
 const pending=f.p.pending;for(let i=0;i<3;i++)lethal(f);assert.equal(f.p.pending,pending);
 f.h.run(.49);assert.deepEqual(snapshot(f.b),[]);f.h.run(.04);const c=snapshot(f.b)[0];assert.equal(c.required,15);assert.equal(c.kind,'final');assert.equal(f.waves.length,0);assert.deepEqual(f.b.errors,[]);
});
test('fifteen terminal clicks kill the original source and hand off the exact wave-finish intent once, without leaking',()=>{
 const f=fixture(),c=button(f),life=f.e.deploySeq;taps(f,c,14);assert.equal(f.e.alive,true);taps(f,c,1);
 assert.equal(f.e.alive,false);assert.equal(f.e.removeReason,'killed');assert.equal(f.p.active,false);assert.equal(f.waves.length,1);
 assert.equal(f.waves[0].source,f.e);assert.equal(f.waves[0].sourceLife,life);assert.equal(f.waves[0].action._finishAndSkip,true);
 assert.equal(f.b.leakedCount,0);assert.equal(click(f.b,c),false);assert.deepEqual(snapshot(f.b),[]);assert.deepEqual(f.b.errors,[]);
});
test('the terminal deadline dispatches the same retained self-kill/wave-finish path',()=>{
 const f=fixture(),c=button(f);f.b.time+=c.remaining;assert.equal(click(f.b,c),false);
 assert.equal(f.e.alive,false);assert.equal(f.waves.length,1);assert.equal(f.b.leakedCount,0);assert.deepEqual(f.b.errors,[]);
});
test('fabricated and replayed HP-attempt observations cannot start the terminal phase',()=>{
 const f=fixture(),fake={unit:f.e,amount:1e9,before:f.e.hp};f.b.emit('hpZeroAttempt',fake);assert.equal(f.p.mode,'idle');
 let captured,receipt;f.b.on('hpZeroAttempt',ctx=>{captured=ctx;receipt=currentHpZeroAttemptReceipt(ctx,f.b);});lethal(f);
 assert.equal(receipt.unit,f.e);assert.equal(receipt.unitLife,f.e.deploySeq);assert.equal(currentHpZeroAttemptReceipt(captured,f.b),null);
 assert.equal(currentHpZeroAttemptReceipt(captured,{}),null);const pending=f.p.pending;f.b.emit('hpZeroAttempt',captured);assert.equal(f.p.pending,pending);assert.deepEqual(f.b.errors,[]);
});
test('immutable authentic HP receipts preserve source identity even when an older observer edits the legacy object',()=>{
 let original,bogus;const f=fixture({beforeInstall:(b,e)=>{
  original=e;bogus={alive:true};b.on('hpZeroAttempt',ctx=>{ctx.unit=bogus;ctx.amount=0;ctx.before=1e9;},{priority:100});
 }});lethal(f);assert.equal(f.p.mode,'waiting');assert.equal(f.e,original);assert.equal(f.e.hp,1);assert.deepEqual(f.b.errors,[]);
});
test('reentrant emission of the same active HP attempt cannot recreate a cancelled terminal child',()=>{
 const f=fixture();const handle=f.b.on('hpZeroAttempt',ctx=>{
  f.b.off(handle);f.p.cancelPending(f.p.pending);f.b.emit('hpZeroAttempt',ctx);
 });lethal(f);assert.equal(f.p.mode,'idle');f.h.run(.6);assert.deepEqual(snapshot(f.b),[]);
 lethal(f);f.h.run(.51);assert.equal(snapshot(f.b).length,1);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['shield','invulnerable','nonlethal','cancelled'])test('no false terminal admission from '+mode,()=>{
 const f=fixture();if(mode==='shield')f.b.addBuff(f.e,{key:'fixture-shield',shield:1e9});
 if(mode==='invulnerable')f.b.addBuff(f.e,{key:'fixture-inv',flags:{invulnerable:true}});
 if(mode==='cancelled')f.b.on('hit',c=>{if(c.target===f.e)c.dmg.cancel=true;});
 if(mode==='nonlethal')f.b.dealDamage(null,f.e,{amount:1,type:'true'});else lethal(f);
 assert.equal(f.p.mode,'idle');assert.deepEqual(snapshot(f.b),[]);assert.equal(f.waves.length,0);assert.deepEqual(f.b.errors,[]);
});
test('direct HP loss triggers the same genuine pre-floor path, while scripted kill bypasses it',()=>{
 const f=fixture();f.b.loseHp(f.e,1e9);assert.equal(f.p.mode,'waiting');assert.equal(f.e.hp,1);f.b.kill(f.e,null);f.h.run(.6);
 assert.equal(f.p.active,false);assert.equal(f.waves.length,0);assert.deepEqual(snapshot(f.b),[]);
});
for(const moment of ['waiting','button'])for(const retirement of ['death','reuse','battleEnd','floorRemoval','childRemoval'])test(moment+' terminal cleanup on '+retirement,()=>{
 const f=fixture();lethal(f);if(moment==='button')f.h.run(.51);const old=snapshot(f.b)[0],child=f.p.pending.child;
 if(retirement==='death')f.b.kill(f.e,null);if(retirement==='reuse')f.e.deploySeq++;if(retirement==='battleEnd')f.b.forceEnd();
 if(retirement==='floorRemoval')f.b.removeBuff(f.e,f.p.floor);if(retirement==='childRemoval')f.b.removeBuff(f.e,child);
 if(!f.b.finished)f.h.run(.7);assert.deepEqual(snapshot(f.b),[]);assert.equal(f.waves.length,0);if(old)assert.equal(click(f.b,old),false);
 if(retirement==='childRemoval'){assert.equal(f.p.mode,'idle');assert.equal(f.e.s.flags.undeadable,true);lethal(f);f.h.run(.51);assert.equal(snapshot(f.b).length,1);}
 else{assert.equal(f.p.active,false);assert.ok(!Object.values(f.b._hooks).flat().some(h=>h.owner===f.p));}
 assert.deepEqual(f.b.errors,[]);
});
test('a pooled body can install a fresh terminal controller without transferring its old delayed task',()=>{
 const f=fixture();lethal(f);f.e.deploySeq++;const life=f.e.deploySeq,next=install(f.b,f.e,{finishWave:r=>f.waves.push(r)});f.e.hp=f.e.s.maxHp;
 f.h.run(.6);assert.equal(next.mode,'idle');assert.equal(f.p.active,false);assert.deepEqual(snapshot(f.b),[]);lethal(f);f.h.run(.51);const c=snapshot(f.b)[0];assert.equal(c.ownerLife,life);
 taps(f,c,15);assert.equal(f.waves.length,1);assert.equal(f.waves[0].sourceLife,life);assert.deepEqual(f.b.errors,[]);
});
test('reusing a recipient inside the lethal observer prevents the old HP assignment from touching the new life',()=>{
 const f=fixture();f.b.on('hpZeroAttempt',()=>{f.e.deploySeq++;f.e.hp=777;},{priority:100});lethal(f);
 assert.equal(f.e.hp,777);assert.equal(f.e.alive,true);f.h.run(.6);assert.deepEqual(snapshot(f.b),[]);assert.equal(f.waves.length,0);assert.deepEqual(f.b.errors,[]);
});
test('rejected terminal child admission can retry on a later real lethal attempt',()=>{
 const f=fixture(),reject=f.b.on('beforeBuff',c=>{if(c.buff.key==='enemy_musnake_during_click')c.cancel=true;});lethal(f);assert.equal(f.p.mode,'idle');assert.equal(f.e.hp,1);
 f.b.off(reject);const c=button(f);taps(f,c,15);assert.equal(f.waves.length,1);assert.deepEqual(f.b.errors,[]);
});
test('a rejected floor, duplicate installer or missing wave receiver cannot leave a partial controller',()=>{
 const f=fixture();assert.throws(()=>install(f.b,f.e,{finishWave:()=>{}}),/only one/);assert.throws(()=>install(f.b,f.e),/wave receiver/);f.p.stop();
 f.b.on('beforeBuff',c=>{if(c.buff.key==='enemy_musnake_before_dead')c.cancel=true;});assert.throws(()=>install(f.b,f.e,{finishWave:()=>{}}),/admission failed/);
 assert.equal(f.e.mem.ch17SnakeTerminal,undefined);assert.ok(!f.e.findBuff('enemy_musnake_before_dead'));assert.deepEqual(snapshot(f.b),[]);assert.deepEqual(f.b.errors,[]);
});
test('native AlwaysNext wave handoff survives a self-kill observer revival and runs once',()=>{
 const f=fixture(),c=button(f);f.b.on('kill',({victim})=>{if(victim===f.e)victim.hp=50;});taps(f,c,15);
 assert.equal(f.e.alive,true);assert.equal(f.e.hp,50);assert.equal(f.waves.length,1);assert.equal(f.p.active,false);assert.ok(!f.e.s.flags.undeadable);assert.equal(click(f.b,c),false);assert.deepEqual(f.b.errors,[]);
});
test('terminal handoff errors still retire the phase and counter without replay',()=>{
 const f=fixture({finishWave:()=>{throw Error('fixture wave receiver');}}),c=button(f);taps(f,c,14);assert.throws(()=>click(f.b,c),/fixture wave receiver/);
 assert.equal(f.e.alive,false);assert.equal(f.p.active,false);assert.deepEqual(snapshot(f.b),[]);assert.equal(click(f.b,c),false);
});
