// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeBattle} from './helpers/battleHarness.js';
import {installChapter17SnakeTimeout as install} from '../server/sim/content/chapter17-snake-timeout.js';
import {installChapter17SnakeTerminal} from '../server/sim/content/chapter17-snake-terminal.js';
import {chapter17BossCounterSnapshot as counters,clickChapter17BossCounter as click} from '../server/sim/content/chapter17-boss-counter.js';
import {snakeTimeoutContract} from '../tools/arkpedia/snake-timeout-contract.mjs';
import {snakeCounterContract} from '../tools/arkpedia/snake-counter-contract.mjs';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
const bytes=p=>readFileSync(new URL('../'+p,import.meta.url)),read=p=>JSON.parse(bytes(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const contract=read('data/candidates/arkpedia-ch17-snake-timeout-contract.json'),key=contract.enemy;
const raw=()=>read('data/candidates/arkpedia-enemy-records.canonical.json').enemies[key].levels[0];
function fixture({life=60,beforeInstall=()=>{}}={}){
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:2000,defs:{enemies:{[key]:raw()}}});h.b.start();const b=h.b;b.life=life;
 const e=h.spawn(key,{pos:[10,6]});e.base.moveSpeed=0;e.profile.noAttack=true;e.markDirty();beforeInstall(b,e);
 const t=install(b,e),events=[];b.on('ch17SnakeTimeout',r=>events.push(r));return{h,b,e,t,events};
}
const fire=f=>{f.b.time=f.t.deadline;f.b.step();};

test('timeout contract reproduces the native one-shot 998/999 clock and distinct LP action',async()=>{
 assert.deepEqual(await snakeTimeoutContract(),contract);for(const file of Object.values(contract.sources))assert.equal(sha(bytes(file.path)),file.sha256);
 assert.deepEqual(contract.defaults,{interval:998,duration:999,lifePointDelta:-50});assert.equal(contract.buff.triggerCnt,1);
 assert.equal(contract.start[0]._countDownKey,'interval');assert.equal(contract.trigger[0]._buffKey,'enemy_musnak_before_dead');
 const kill=contract.trigger.find(n=>n.$type.endsWith('+InstantKill'));assert.equal(kill._noReason,true);assert.equal(kill._markReachExit,false);
 const lp=contract.trigger.find(n=>n.$type.endsWith('+ModifyLifePoint'));assert.equal(lp._blackboardKey,'value');assert.equal(lp._isReachExit,false);assert.equal(lp._isSub,false);
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies[key].policy,null);
});
test('source derivation refuses missing callback aliases and newly inserted unimplemented timeout actions',async()=>{
 const reader=change=>async url=>{const raw=readFileSync(url);if(!String(url).endsWith(change.file))return raw;
  const value=JSON.parse(raw);change.update(value);return Buffer.from(JSON.stringify(value));};
 await assert.rejects(snakeTimeoutContract({read:reader({file:'arkpedia-buff-event-alias-source.json',update:v=>{v.events['0'].name='UNKNOWN';}})}),/Stale snake counter foundation/);
 const changed=reader({file:'arkpedia-ch17-firewall-boss-source.json',update:v=>{
  const t=v.templates.enemy_musnake_time_out,value=JSON.parse(t.originalJson),event=value.eventToActions._items.find(e=>e.key===2),nodes=JSON.parse(event.value.SerializedState);
  nodes.push({$type:'Torappu.Battle.Action.Nodes+UnimplementedAction'});event.value.SerializedState=JSON.stringify(nodes);t.originalJson=JSON.stringify(value);t.sha256=sha(t.originalJson);
 }}),counter=Buffer.from(JSON.stringify(await snakeCounterContract({read:changed}),null,2)+'\n');
 await assert.rejects(snakeTimeoutContract({read:async url=>String(url).endsWith('arkpedia-ch17-snake-counter-contract.json')?counter:changed(url)}),/Unreviewed snake timeout actions/);
});
test('the real simulation clock fires at 998 once, before the 999-second parent expiry, with no kill or leak',()=>{
 const f=fixture();let kills=0;f.b.on('kill',()=>kills++);assert.equal(f.t.buff.duration,999);f.h.run(997.8);
 assert.equal(f.b.life,60);assert.equal(f.e.alive,true);assert.equal(f.events.length,0);f.h.run(.3);
 assert.equal(f.b.life,10);assert.equal(f.e.alive,false);assert.equal(f.e.hp,0);assert.equal(f.e.removeReason,'ch17-snake-timeout');
 assert.equal(kills,0);assert.equal(f.b.killed,0);assert.equal(f.b.leakedCount,0);assert.equal(f.events.length,1);
 assert.equal(f.events[0].lifePointDelta,-50);assert.equal(f.events[0].before,60);assert.equal(f.events[0].after,10);assert.equal(f.events[0].sourceLife,f.e.deploySeq);
 f.h.run(2);assert.equal(f.b.life,10);assert.equal(f.events.length,1);assert.deepEqual(f.b.errors,[]);
});
test('countdown snapshots use world time without resetting the source deadline',()=>{
 const f=fixture(),deadline=f.t.deadline;f.h.run(.5);const s=f.t.snapshot();assert.ok(s.remaining>997&&s.remaining<998);assert.equal(s.ownerId,f.e.id);assert.equal(s.ownerLife,f.e.deploySeq);
 s.remaining=0;assert.equal(f.t.deadline,deadline);assert.ok(f.t.snapshot().remaining>997);f.b.time=deadline-1;f.b.step();assert.equal(f.events.length,0);assert.equal(f.e.alive,true);
 fire(f);assert.equal(f.events.length,1);assert.equal(f.t.snapshot(),null);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['silence','stun','freeze','hidden'])test('timeout world clock continues through '+mode,()=>{
 const f=fixture();if(mode==='hidden')f.e.hidden=true;else f.b.addBuff(f.e,{key:'fixture-'+mode,persist:true,flags:{[mode]:true}});
 fire(f);assert.equal(f.b.life,10);assert.equal(f.events.length,1);assert.equal(f.e.alive,false);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['death','removed','reuse','battleEnd','buffRemoval','undeployed'])test('timeout retires without spending LP on '+mode,()=>{
 const f=fixture();if(mode==='death')f.b.kill(f.e,null);if(mode==='removed')f.b.emit('removed',{unit:f.e});if(mode==='reuse')f.e.deploySeq++;
 if(mode==='battleEnd')f.b.forceEnd();if(mode==='buffRemoval')f.b.removeBuff(f.e,f.t.buff);if(mode==='undeployed')f.e.deployed=false;
 if(!f.b.finished)fire(f);assert.equal(f.b.life,60);assert.equal(f.events.length,0);assert.equal(f.t.snapshot(),null);assert.equal(f.t.active,false);
 assert.ok(!Object.values(f.b._hooks).flat().some(h=>h.owner===f.t));assert.deepEqual(f.b.errors,[]);
});
test('timeout cancels a terminal button and never substitutes the successful wave-finish handoff',()=>{
 const f=fixture(),waves=[],terminal=installChapter17SnakeTerminal(f.b,f.e,{finishWave:r=>waves.push(r)});
 f.b.dealDamage(null,f.e,{amount:1e9,type:'true'});f.h.run(.51);const input=counters(f.b)[0];assert.ok(input);
 fire(f);assert.equal(terminal.active,false);assert.equal(f.b.life,10);assert.equal(waves.length,0);assert.equal(click(f.b,input),false);assert.deepEqual(counters(f.b),[]);assert.deepEqual(f.b.errors,[]);
});
test('successful terminal completion cancels the timeout without a later LP modification',()=>{
 const f=fixture(),waves=[];installChapter17SnakeTerminal(f.b,f.e,{finishWave:r=>waves.push(r)});
 f.b.dealDamage(null,f.e,{amount:1e9,type:'true'});f.h.run(.51);const input=counters(f.b)[0];for(let i=0;i<15;i++)assert.equal(click(f.b,input),true);
 assert.equal(waves.length,1);fire(f);assert.equal(f.b.life,60);assert.equal(f.events.length,0);assert.equal(f.t.active,false);assert.deepEqual(f.b.errors,[]);
});
test('a rejected timeout buff cannot leave a countdown or mutate the ordinary-stage life ledger',()=>{
 let owner;assert.throws(()=>fixture({beforeInstall:(b,e)=>{owner=e;b.on('beforeBuff',c=>{if(c.buff.key==='enemy_musnake_time_out')c.cancel=true;});}}),/admission failed/);
 assert.equal(owner.mem.ch17SnakeTimeout,undefined);assert.ok(!owner.findBuff('enemy_musnake_time_out'));
});
test('missing life, late installation and a duplicate controller fail before replacing a valid timeout',()=>{
 const f=fixture();assert.throws(()=>install(f.b,f.e),/only one/);assert.equal(f.t.active,true);
 f.b.life=undefined;assert.throws(()=>install(f.b,f.e),/life ledger/);f.b.life=60;f.b.time+=1;assert.throws(()=>install(f.b,f.e),/fresh live deployment/);
 assert.equal(f.t.active,true);assert.equal(f.t.deadline,998);assert.deepEqual(f.b.errors,[]);
});
test('changed canonical records are rejected without overwriting an accepted source countdown',()=>{
 const f=fixture(),original=f.e.def;f.e.def={...original,raw:structuredClone(original.raw)};f.e.def.raw.talents.bb['TimeOut.value']=-5;
 assert.throws(()=>install(f.b,f.e),/Unreviewed/);assert.equal(f.t.active,true);f.e.def=original;fire(f);assert.equal(f.b.life,10);
});
test('a reused deployment can start a new countdown without an old delayed task spending its LP',()=>{
 const f=fixture();f.e.deploySeq++;f.e.deployedAt=f.b.time;const next=install(f.b,f.e);assert.equal(f.t.active,false);assert.equal(next.active,true);next.stop();fire(f);
 assert.equal(f.b.life,60);assert.equal(f.events.length,0);assert.deepEqual(f.b.errors,[]);
});
test('AlwaysNext applies the original LP change after a retirement callback reuses the body',()=>{
 const f=fixture(),life=f.e.deploySeq;f.b.on('death',({unit})=>{if(unit===f.e){unit.deploySeq++;unit.alive=true;unit.deployed=true;unit.removed=false;unit.hp=777;}});fire(f);
 assert.equal(f.b.life,10);assert.equal(f.e.hp,777);assert.equal(f.events.length,1);assert.equal(f.events[0].sourceLife,life);assert.notEqual(f.e.deploySeq,life);assert.deepEqual(f.b.errors,[]);
});
test('a corrupted life ledger is reported without retiring the source or manufacturing replacement LP',()=>{
 const f=fixture();f.b.life=NaN;fire(f);assert.equal(f.e.alive,true);assert.equal(f.t.active,false);assert.equal(f.events.length,0);assert.ok(Number.isNaN(f.b.life));
 assert.equal(f.b.errors.length,1);assert.match(JSON.stringify(f.b.errors),/life ledger became invalid/);
});
test('defeat follows the real StandardBattle LP path while complete snake catalogue admission remains refused',()=>{
 const mvp=read('data/arkpedia-mvp.json'),data=structuredClone(mvp);data.stage.geometry.waves=[];
 const rejected=structuredClone(data);rejected.enemies[key]=raw();assert.throws(()=>new StandardBattle(rejected,{operators:[defaultBuild(mvp.operators.char_122_beagle)]}),/Unsupported regular-stage enemy/);
 const b=new StandardBattle(data,{operators:[defaultBuild(mvp.operators.char_122_beagle)]});b.timeLimit=1100;
 // Inline diagnostic body exercises the actual LP engine; it changes neither
 // the source catalogue nor the unsupported-enemy constructor guard above.
 const e=b.spawnEnemy(key,{def:raw(),pos:[1,1]});e.base.moveSpeed=0;e.profile.noAttack=true;e.markDirty();const life=b.life,t=install(b,e);
 b.time=t.deadline;b.step();assert.equal(b.life,life-50);assert.equal(b.finished,true);assert.equal(b.reason,'defeated');assert.equal(e.alive,false);
 assert.equal(b.leakedCount,0);assert.equal(b.killed,0);assert.deepEqual(b.errors,[]);
});
