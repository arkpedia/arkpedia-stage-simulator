// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeBattle} from './helpers/battleHarness.js';
import {installChapter17SnakeHealth as install} from '../server/sim/content/chapter17-snake-health.js';
import {installChapter17SnakeTerminal} from '../server/sim/content/chapter17-snake-terminal.js';
import {snakeInteractionWaiting} from '../server/sim/content/chapter17-snake-wait.js';
import {hpLossStages} from '../server/sim/content/hp-loss-stages.js';
import {chapter17BossCounterSnapshot as snapshot,clickChapter17BossCounter as click} from '../server/sim/content/chapter17-boss-counter.js';
import {snakeHealthContract} from '../tools/arkpedia/snake-health-contract.mjs';
const bytes=p=>readFileSync(new URL('../'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const contract=read('data/candidates/arkpedia-ch17-snake-health-contract.json'),key=contract.enemy;
function fixture({ratio=1,interruptCurrent}={}){
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:1e6,defs:{enemies:{[key]:read('data/candidates/arkpedia-enemy-records.canonical.json').enemies[key].levels[0]}}});
 h.b.start();const e=h.spawn(key,{pos:[10,6]});e.profile.noAttack=true;e.markDirty();e.hp=e.s.maxHp*ratio;const interrupts=[];
 const p=install(h.b,e,{interruptCurrent:interruptCurrent??(r=>interrupts.push(r))});return{h,b:h.b,e,p,interrupts};
}
function window(f,ratio=.79){f.e.hp=f.e.s.maxHp*ratio;f.h.run(.15);const c=snapshot(f.b)[0];assert.equal(c?.kind,'step');return c;}
function taps(f,c){for(let i=0;i<c.required;i++)assert.equal(click(f.b,c),true);}

test('health source contract reproduces native actions, parameters and separate research pins',async()=>{
 assert.deepEqual(await snakeHealthContract(),contract);
 for(const source of Object.values(contract.sources))assert.equal(createHash('sha256').update(bytes(source.path)).digest('hex'),source.sha256);
 assert.deepEqual(contract.defaults,{interval:.10000000149011612,step:.2,heal:.2,injury:.05,duration:7});
 assert.deepEqual(contract.parent.attributes.abnormalFlags,[22]);assert.equal(contract.poll[0]._condType,'GT');
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies[key].policy,null);
});
test('persistent HP stages require strict positive-HP loss, skip overshot stages and never reset on recovery',()=>{
 const p=hpLossStages(1,.2);assert.equal(p.consume(.8),null);assert.equal(p.consume(0),null);
 assert.deepEqual(p.consume(.39),{stage:1,nextStage:4,lostRatio:.61});assert.equal(p.consume(.99),null);
 assert.equal(p.consume(.4),null);assert.equal(p.consume(.2),null);assert.equal(p.consume(.19).stage,4);assert.equal(p.nextStage,5);
 for(const args of [[0,.2],[1,0],[NaN,.2],[1,Infinity]])assert.throws(()=>hpLossStages(...args),/ratios/);
});
test('polling waits its first interval, uses the initial ratio and holds damage without ordinary silence',()=>{
 const f=fixture({ratio:.9});f.e.hp=f.e.s.maxHp*.69;f.h.run(.05);assert.deepEqual(snapshot(f.b),[]);f.h.run(.1);
 assert.equal(f.p.tracker.initialRatio,.9);assert.equal(snapshot(f.b).length,1);assert.equal(snakeInteractionWaiting(f.e),true);
 assert.equal(f.e.s.flags.invulnerable,true);assert.ok(!f.e.s.flags.silence);assert.equal(f.e.s.flags.noMove,true);
 assert.ok(!f.e.s.flags.selfBound);assert.ok(!f.e.s.flags.noDisplace);const hp=f.e.hp;
 f.b.dealDamage(null,f.e,{amount:1e9,type:'true'});assert.equal(f.e.hp,hp);assert.deepEqual(f.b.errors,[]);
});
test('a completed step interrupts the actor, damages at injury start and holds action for seven seconds without stun',()=>{
 const f=fixture(),c=window(f);taps(f,c);assert.equal(f.interrupts.length,1);assert.equal(f.interrupts[0].sourceLife,f.e.deploySeq);
 assert.equal(f.interrupts[0].action._skillName,'Injured');assert.ok(Math.abs(f.e.hp/f.e.s.maxHp-.74)<1e-9);
 assert.equal(f.e.s.flags.disarm,true);assert.ok(!f.e.s.flags.stun);assert.equal(snakeInteractionWaiting(f.e),false);
 f.h.run(6.95);assert.ok(f.p.injured);f.h.run(.1);assert.equal(f.p.injured,null);assert.ok(!f.e.s.flags.disarm);assert.deepEqual(f.b.errors,[]);
});
test('an expired step heals current maximum HP, logs the attempt, and does not reset the next threshold',()=>{
 const f=fixture(),c=window(f),logs=[];f.b.on('ch17SnakeRecovery',r=>logs.push(r));f.b.time+=c.remaining;
 assert.equal(click(f.b,c),false);assert.ok(Math.abs(f.e.hp/f.e.s.maxHp-.99)<1e-9);assert.equal(logs.length,1);
 f.e.hp=f.e.s.maxHp*.61;f.h.run(.2);assert.deepEqual(snapshot(f.b),[]);assert.equal(f.p.tracker.nextStage,2);
 const next=window(f,.59);assert.notEqual(next.counterId,c.counterId);assert.deepEqual(f.b.errors,[]);
});
test('recovery respects heal prohibition and still emits its AlwaysNext log',()=>{
 const f=fixture(),c=window(f);f.b.addBuff(f.e,{key:'fixture-heal-free',flags:{healFree:true}});const hp=f.e.hp,logs=[];
 f.b.on('ch17SnakeRecovery',r=>logs.push(r));f.b.time+=c.remaining;click(f.b,c);
 assert.equal(f.e.hp,hp);assert.equal(logs.length,1);assert.equal(f.p.window,null);assert.deepEqual(f.b.errors,[]);
});
test('one overshoot produces one counter; injury damage can independently cross the following threshold',()=>{
 const f=fixture(),c=window(f,.41);assert.equal(f.p.tracker.nextStage,3);taps(f,c);assert.ok(f.p.injured);
 f.h.run(.2);const next=snapshot(f.b)[0];assert.equal(next?.kind,'step');assert.ok(f.p.injured);assert.equal(f.p.tracker.nextStage,4);
 const hp=f.e.hp;taps(f,next);assert.equal(f.interrupts.length,1);assert.equal(f.e.hp,hp);assert.deepEqual(f.b.errors,[]);
});
for(const flag of ['stun','freeze','levitate','sleep'])test('forced injury does not pass intrinsic '+flag,()=>{
 const f=fixture(),c=window(f);f.b.addBuff(f.e,{key:'fixture-'+flag,flags:{[flag]:true}});const hp=f.e.hp;taps(f,c);
 assert.equal(f.p.injured,null);assert.equal(f.e.hp,hp);assert.equal(f.interrupts.length,0);assert.equal(f.p.window,null);
});
test('silence and disarm do not prevent the retained forced injury',()=>{
 const f=fixture(),c=window(f);f.b.addBuff(f.e,{key:'fixture-silent-disarm',flags:{silence:true,disarm:true}});taps(f,c);
 assert.ok(f.p.injured);assert.equal(f.interrupts.length,1);assert.deepEqual(f.b.errors,[]);
});
for(const moment of ['waiting','injury'])test('terminal admission immediately retires '+moment+' resources and owns its own waiting child',()=>{
 const f=fixture();const terminal=installChapter17SnakeTerminal(f.b,f.e,{finishWave:()=>{}}),c=window(f);
 if(moment==='injury')taps(f,c);else f.p.cancelWindow();
 f.b.loseHp(f.e,1e9);assert.equal(terminal.mode,'waiting');assert.equal(f.p.window,null);assert.equal(f.p.injured,null);
 assert.equal(snakeInteractionWaiting(f.e),true);assert.equal(f.e.s.flags.invulnerable,true);assert.ok(!f.e.s.flags.silence);
 f.h.run(.55);assert.equal(snapshot(f.b)[0]?.kind,'final');assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['death','reuse','battleEnd','parentRemoval'])test('health resources retire on '+mode,()=>{
 const f=fixture(),c=window(f);
 if(mode==='death')f.b.kill(f.e,null);if(mode==='reuse')f.e.deploySeq++;if(mode==='battleEnd')f.b.forceEnd();if(mode==='parentRemoval')f.b.removeBuff(f.e,f.p.parent);
 if(!f.b.finished)f.h.run(.2);assert.equal(f.p.active,false);assert.equal(click(f.b,c),false);assert.deepEqual(snapshot(f.b),[]);
 assert.ok(!f.e.buffs.some(b=>b.source===f.e&&b.data?.snakeInteractionLife));assert.deepEqual(f.b.errors,[]);
});
test('rejected child and parent admissions cannot leave immunity or orphan counters',()=>{
 const f=fixture(),reject=f.b.on('beforeBuff',c=>{if(c.buff.key==='enemy_musnake_during_click')c.cancel=true;});
 f.e.hp=f.e.s.maxHp*.79;f.h.run(.2);assert.equal(f.p.window,null);assert.deepEqual(snapshot(f.b),[]);assert.ok(!f.e.s.flags.invulnerable);f.b.off(reject);
 assert.throws(()=>install(f.b,f.e,{interruptCurrent:()=>{}}),/only one/);assert.throws(()=>install(f.b,f.e),/interrupt receiver/);f.p.stop();
 f.b.on('beforeBuff',c=>{if(c.buff.key===contract.parent.buffKey)c.cancel=true;});assert.throws(()=>install(f.b,f.e,{interruptCurrent:()=>{}}),/admission failed/);
 assert.equal(f.e.mem.ch17SnakeHealth,undefined);assert.deepEqual(f.b.errors,[]);
});
test('a counter-start observer retiring or reusing the body cannot leave an old waiting buff',()=>{
 for(const reuse of [false,true]){
  const f=fixture();f.b.on('ch17BossCounterStarted',()=>{if(reuse)f.e.deploySeq++;else f.b.kill(f.e,null);});
  f.e.hp=f.e.s.maxHp*.79;f.h.run(.2);assert.equal(f.p.window,null);assert.deepEqual(snapshot(f.b),[]);assert.ok(!f.e.s.flags.invulnerable);assert.deepEqual(f.b.errors,[]);
 }
});
test('HP loss and recovery use live maximum HP while the starting ratio stays fixed',()=>{
 const f=fixture(),initial=f.e.s.maxHp;f.b.addBuff(f.e,{key:'fixture-max-hp',mods:{hpMul:2}});
 assert.equal(f.e.s.maxHp,initial*2);f.e.hp=initial;f.h.run(.2);const c=snapshot(f.b)[0];assert.ok(c);
 assert.equal(f.p.tracker.initialRatio,1);assert.equal(f.p.tracker.nextStage,3);f.b.time+=c.remaining;click(f.b,c);
 assert.ok(Math.abs(f.e.hp-initial*1.4)<1e-6);assert.deepEqual(f.b.errors,[]);
});
test('injury uses the true-damage pipeline and respects a live true-damage shield',()=>{
 const f=fixture(),c=window(f),hp=f.e.hp,amount=f.e.s.maxHp*.05;
 const shield=f.b.addBuff(f.e,{key:'fixture-shield',shield:amount+1});taps(f,c);
 assert.equal(f.e.hp,hp);assert.ok(Math.abs(shield.shield-1)<1e-6);assert.ok(f.p.injured);assert.deepEqual(f.b.errors,[]);
});
test('cast-interrupt retirement does not apply damage or action flags to a reused body',()=>{
 const f=fixture({interruptCurrent:({source})=>{source.deploySeq++;source.hp=777;}}),c=window(f);taps(f,c);f.h.run(.2);
 assert.equal(f.e.hp,777);assert.equal(f.p.active,false);assert.ok(!f.e.s.flags.disarm);assert.ok(!f.e.s.flags.invulnerable);assert.deepEqual(f.b.errors,[]);
});
test('rejected injury action produces no damage and cannot retain a seven-second task',()=>{
 const f=fixture(),c=window(f),hp=f.e.hp;f.b.on('beforeBuff',q=>{if(q.buff.key==='enemy_jmusnake_injury_action')q.cancel=true;});taps(f,c);
 assert.equal(f.e.hp,hp);assert.equal(f.p.injured,null);assert.ok(!f.e.s.flags.disarm);f.h.run(7.1);assert.equal(f.e.hp,hp);assert.deepEqual(f.b.errors,[]);
});
test('lookalike waiting metadata cannot fabricate the owned ability-trigger hold',()=>{
 const f=fixture();f.b.addBuff(f.e,{key:'fixture-lookalike',source:f.e,data:{snakeInteractionLife:f.e.deploySeq}});
 assert.equal(snakeInteractionWaiting(f.e),false);window(f);assert.equal(snakeInteractionWaiting(f.e),true);
});
test('health installation rejects changed canonical mechanics instead of broadening support',()=>{
 const f=fixture();f.p.stop();const saved=f.e.def,raw=structuredClone(saved.raw);raw.talents.bb['StepKill.hp_ratio']=.25;
 try{f.e.def={...saved,raw};assert.throws(()=>install(f.b,f.e,{interruptCurrent:()=>{}}),/Unreviewed/);}
 finally{f.e.def=saved;}
 assert.equal(f.e.mem.ch17SnakeHealth,undefined);assert.deepEqual(snapshot(f.b),[]);
});
test('supplemental semantic drift and altered native component bytes fail contract reproduction',async()=>{
 for(const [name,mutate] of [
  ['arkpedia-ch17-boss-mechanics-notes.json',d=>{d.hpLoss.resetOnHealing=true;}],
  ['arkpedia-ch17-firewall-boss-native.json',d=>{const parts=d.prefabs['dyn/battle/prefabs/enemies/'+key+'.prefab'];
   const row=parts.find(p=>p.originalJson.includes('enemy_musnake_hp_ratio_trigger'));row.originalJson=row.originalJson.replace('0.10000000149011612','0.2');}],
 ])await assert.rejects(()=>snakeHealthContract({read:async url=>{
  const value=readFileSync(url);if(!url.pathname.endsWith(name))return value;const data=JSON.parse(value);mutate(data);return Buffer.from(JSON.stringify(data));
 }}));
});
