// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {installChapter17SnakeLine as install} from '../server/sim/content/chapter17-snake-line.js';
import {installChapter17SnakeCore} from '../server/sim/content/chapter17-snake-core.js';
import {snakeLineContract} from '../tools/arkpedia/snake-line-contract.mjs';
import {chapter17BossCounterSnapshot as snapshot,clickChapter17BossCounter as click} from '../server/sim/content/chapter17-boss-counter.js';
const bytes=p=>readFileSync(new URL('../'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const contract=read('data/candidates/arkpedia-ch17-snake-line-contract.json'),key=contract.enemy;
function fixture({positions=[[10,5]],core=false}={}){
 const chess=Object.fromEntries(positions.map((_,i)=>['line_op_'+i,chessRec({id:'line_op_'+i,stats:{maxHp:10000}})]));
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:1e6,defs:{enemies:{[key]:read('data/candidates/arkpedia-enemy-records.canonical.json').enemies[key].levels[0]},chess},
  units:positions.map(([row,col],i)=>({chessId:'line_op_'+i,row,col}))});
 h.b.start();h.b.life=100;for(const t of h.allies())t.profile.noAttack=true;
 const e=h.spawn(key,{pos:[10,6]}),waves=[],owner=core?installChapter17SnakeCore(h.b,e,{finishWave:r=>waves.push(r)}):install(h.b,e);
 return{h,b:h.b,e,line:core?owner.line:owner,core:core?owner:null,waves,t:h.allies()[0],targets:h.allies()};
}
function cast(f){f.line.cooldown=0;assert.equal(f.line.cast(),true);}
function impact(f){cast(f);f.h.run(2.65);assert.ok(f.line.output.impacts.has(f.t));}
function taps(f,c){for(let i=0;i<c.required;i++)assert.equal(click(f.b,c),true);}

test('line contract reproduces original clocks, projectile and fixed damage with separate support gates',async()=>{
 assert.deepEqual(await snakeLineContract(),contract);for(const s of Object.values(contract.sources))assert.equal(createHash('sha256').update(bytes(s.path)).digest('hex'),s.sha256);
 assert.deepEqual(contract.defaults,{initialCooldown:15,cooldown:25,hit:2.4666666984558105,duration:6,speed:10,maxAge:10,radius:.5,interval:1,dotDuration:10,damage:300,borderToPeel:1});
 assert.equal(contract.ability._atkScale,0);assert.equal(contract.projectile._stopWhenSourceInvalid,0);
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies[key].policy,null);
});
test('automatic no-target casting waits canonical initial cooldown and restarts cooldown at clip end',()=>{
 const f=fixture({positions:[]});f.h.run(14.9);assert.equal(f.line.pending,null);f.h.run(.15);assert.ok(f.line.pending);
 f.h.run(5.8);assert.ok(f.line.pending);f.h.run(.25);assert.equal(f.line.pending,null);assert.ok(f.line.cooldown>24.8);
 assert.equal(f.e.stats.attacks,0);assert.deepEqual(f.b.errors,[]);
});
test('one downward ray per retained column starts on the top inner row after the literal marker',()=>{
 const f=fixture({positions:[]});cast(f);f.h.run(2.4);assert.equal(f.line.output.beams.size,0);f.h.run(.07);
 assert.equal(f.line.output.beams.size,9);assert.deepEqual([...f.line.output.beams].map(p=>p.x),[1,2,3,4,5,6,7,8,9]);
 assert.ok([...f.line.output.beams].every(p=>p.y===11));assert.deepEqual(f.b.errors,[]);
});
test('first contact applies no initial damage and ten delayed fixed true ticks with a linked stun',()=>{
 const f=fixture();impact(f);assert.equal(f.t.hp,10000);assert.equal(f.t.s.flags.stun,true);f.h.run(.8);assert.equal(f.t.hp,10000);
 f.h.run(.3);assert.equal(f.t.hp,9700);f.h.run(9);assert.equal(f.t.hp,7000);assert.ok(!f.t.s.flags.stun);
 assert.equal(f.line.output.impacts.size,0);assert.deepEqual(f.b.errors,[]);
});
test('the nearest contact stops its ray and leaves a lower ally in the same column untouched',()=>{
 const f=fixture({positions:[[10,5],[9,5]]});impact(f);assert.ok(!f.line.output.impacts.has(f.targets[1]));f.h.run(1.1);
 assert.equal(f.targets[0].hp,9700);assert.equal(f.targets[1].hp,10000);assert.deepEqual(f.b.errors,[]);
});
for(const flag of ['untargetable','stealth','camou','liftoff'])test('direct ground collision ignores target-free '+flag,()=>{
 const f=fixture();f.b.addBuff(f.t,{key:'fixture-'+flag,flags:{[flag]:true}});impact(f);f.h.run(1.1);
 assert.equal(f.t.hp,9700);assert.equal(f.t.s.flags.stun,true);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['FLY','device','hidden'])test('line skips '+mode+' bodies and hits the next ground ally',()=>{
 const f=fixture({positions:[[10,5],[9,5]]});if(mode==='FLY')f.t.motion='FLY';if(mode==='device')f.t.kind='device';if(mode==='hidden')f.t.hidden=true;
 cast(f);f.h.run(2.8);assert.ok(!f.line.output.impacts.has(f.t));assert.ok(f.line.output.impacts.has(f.targets[1]));assert.deepEqual(f.b.errors,[]);
});
test('stun immunity rejects the derived status without suppressing parent damage',()=>{
 const f=fixture();f.t.def={...f.t.def,immune:new Set(['stun'])};impact(f);assert.ok(!f.t.s.flags.stun);f.h.run(1.1);assert.equal(f.t.hp,9700);assert.deepEqual(f.b.errors,[]);
});
test('resistance shortens only the derived stun; DOT retains its ten-second parent',()=>{
 const f=fixture();f.b.applyStatus(f.t,'resist',{duration:30,value:.5});impact(f);f.h.run(5.2);
 assert.ok(!f.t.s.flags.stun);assert.ok(f.line.output.impacts.has(f.t));f.h.run(5);assert.equal(f.t.hp,7000);assert.deepEqual(f.b.errors,[]);
});
test('replacing a named impact resets its tick clock, cleans its own stun and never stacks DOT',()=>{
 const f=fixture();impact(f);f.h.run(1.1);const old=f.line.output.impacts.get(f.t),oldChild=old.child;
 f.line.interrupt();cast(f);f.h.run(2.65);const next=f.line.output.impacts.get(f.t);assert.notEqual(next,old);assert.equal(old.active,false);
 assert.ok(!f.t.buffs.includes(oldChild));assert.equal(f.t.buffs.filter(b=>b.key==='enemy_musnake_line_buff').length,1);
 const hp=f.t.hp;f.h.run(1.1);assert.equal(f.t.hp,hp-300);assert.deepEqual(f.b.errors,[]);
});
test('removing the parent removes only its own stun and stops future ticks',()=>{
 const f=fixture();impact(f);const q=f.line.output.impacts.get(f.t);f.b.applyStatus(f.t,'stun',{key:'fixture-other-stun',duration:20});
 f.b.removeBuff(f.t,q.parent);assert.equal(q.active,false);assert.ok(f.t.s.flags.stun);assert.ok(!f.t.buffs.includes(q.child));
 f.h.run(2);assert.equal(f.t.hp,10000);assert.deepEqual(f.b.errors,[]);
});
test('removing just the derived stun does not remove its independent damage parent',()=>{
 const f=fixture();impact(f);const q=f.line.output.impacts.get(f.t);f.b.removeBuff(f.t,q.child);assert.ok(!f.t.s.flags.stun);
 f.h.run(1.1);assert.equal(f.t.hp,9700);assert.equal(q.active,true);assert.deepEqual(f.b.errors,[]);
});
test('literal cast time ignores ASPD but consumes live source slowdown exactly once',()=>{
 const f=fixture({positions:[]});f.b.addBuff(f.e,{key:'fixture-speed',mods:{aspd:900,slowDownMul:.5}});cast(f);f.h.run(4.85);
 assert.equal(f.line.output.beams.size,0);f.h.run(.15);assert.equal(f.line.pending.released,true);f.h.run(6.9);assert.ok(f.line.pending);f.h.run(.2);assert.equal(f.line.pending,null);
 assert.deepEqual(f.b.errors,[]);
});
test('silence does not block the skill and cast-only stun immunity handles both status and plain buffs',()=>{
 const f=fixture();f.b.applyStatus(f.e,'silence',{duration:20});cast(f);assert.equal(f.b.applyStatus(f.e,'stun',{duration:1}),false);
 assert.equal(f.b.addBuff(f.e,{key:'fixture-plain-stun',flags:{stun:true}}),null);f.h.run(2.65);assert.ok(f.line.output.impacts.has(f.t));
 f.h.run(3.5);assert.equal(f.line.pending,null);assert.equal(f.b.applyStatus(f.e,'stun',{duration:1}),true);assert.deepEqual(f.b.errors,[]);
});
test('interrupting before release cancels unborn output while born output survives an interruption',()=>{
 const f=fixture();cast(f);f.h.run(2);f.line.interrupt();f.h.run(.7);assert.equal(f.line.output.beams.size,0);assert.equal(f.t.hp,10000);
 cast(f);f.h.run(2.47);assert.equal(f.line.output.beams.size,9);f.line.interrupt();f.h.run(.2);assert.ok(f.line.output.impacts.has(f.t));assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['death','reuse'])test('born output survives source '+mode+' without reading replacement modifiers',()=>{
 const f=fixture();cast(f);f.h.run(2.47);const oldLife=f.e.deploySeq;
 if(mode==='death')f.b.kill(f.e,null);else{f.e.deploySeq++;f.b.addBuff(f.e,{key:'fixture-new-damage',mods:{dmgDealtMul:10}});}
 f.h.run(1.3);assert.equal(f.t.hp,9700);const q=f.line.output.impacts.get(f.t);assert.equal(q.source.deploySeq,oldLife);assert.equal(f.line.active,false);assert.deepEqual(f.b.errors,[]);
});
test('reusing the recipient ends its old impact without damaging or clearing a new stun',()=>{
 const f=fixture();impact(f);const q=f.line.output.impacts.get(f.t);f.t.deploySeq++;f.t.hp=9999;f.b.applyStatus(f.t,'stun',{key:'fixture-new-life',duration:20});f.h.run(1.2);
 assert.equal(f.t.hp,9999);assert.equal(q.active,false);assert.ok(f.t.findBuff('fixture-new-life'));assert.deepEqual(f.b.errors,[]);
});
test('an already attached impact cannot read a replacement source life',()=>{
 const f=fixture();impact(f);const q=f.line.output.impacts.get(f.t),life=f.e.deploySeq;f.e.deploySeq++;
 f.b.addBuff(f.e,{key:'fixture-new-life-damage',mods:{dmgDealtMul:10}});f.h.run(1.1);
 assert.equal(f.t.hp,9700);assert.equal(q.source.deploySeq,life);assert.notEqual(q.source,f.e);assert.deepEqual(f.b.errors,[]);
});
test('a hidden recipient retains the damage parent while the ordinary damage pipeline suppresses hidden-body hits',()=>{
 const f=fixture();impact(f);f.t.hidden=true;f.h.run(1.1);assert.equal(f.t.hp,10000);assert.ok(f.line.output.impacts.has(f.t));
 f.t.hidden=false;f.h.run(1);assert.equal(f.t.hp,9700);assert.deepEqual(f.b.errors,[]);
});
test('battle end retires all born output and owned impact resources',()=>{
 const f=fixture();impact(f);const q=f.line.output.impacts.get(f.t);f.b.forceEnd();assert.equal(f.line.active,false);
 assert.equal(f.line.output.beams.size,0);assert.equal(f.line.output.impacts.size,0);assert.ok(!f.t.buffs.includes(q.parent));assert.ok(!f.t.buffs.includes(q.child));assert.deepEqual(f.b.errors,[]);
});
test('integrated HP interaction blocks a new cast and successful injury interrupts an unborn line',()=>{
 const f=fixture({core:true});cast(f);f.h.run(1);f.e.hp=f.e.s.maxHp*.79;f.h.run(.15);const c=snapshot(f.b)[0];assert.equal(c?.kind,'step');
 taps(f,c);assert.equal(f.line.pending,null);assert.ok(f.core.health.injured);f.h.run(2);assert.equal(f.line.output.beams.size,0);
 f.line.cooldown=0;assert.equal(f.line.cast(),false);f.h.run(5.1);assert.ok(f.line.pending);assert.deepEqual(f.b.errors,[]);
});
test('integrated injury after release cancels the cast tail while born rays still hit',()=>{
 const f=fixture({core:true});cast(f);f.h.run(2.47);f.e.hp=f.e.s.maxHp*.79;f.h.run(.12);const c=snapshot(f.b)[0];assert.equal(c?.kind,'step');
 taps(f,c);assert.equal(f.line.pending,null);assert.ok(f.core.health.injured);f.h.run(1.1);
 assert.equal(f.t.hp,9700);assert.ok(f.line.output.impacts.has(f.t));assert.deepEqual(f.b.errors,[]);
});
test('integrated timeout retires an invulnerable step window and spends real LP without a wave handoff',()=>{
 const f=fixture({core:true});f.e.hp=f.e.s.maxHp*.79;f.h.run(.15);const c=snapshot(f.b)[0];assert.equal(c?.kind,'step');
 f.b.time=f.core.timeout.deadline-.01;f.h.run(.05);assert.equal(f.e.alive,false);assert.equal(f.b.life,50);
 assert.equal(f.waves.length,0);assert.equal(f.core.active,false);assert.equal(click(f.b,c),false);assert.deepEqual(snapshot(f.b),[]);assert.deepEqual(f.b.errors,[]);
});
test('integrated terminal completion owns final clicks and wave receipt, retiring every phase once',()=>{
 const f=fixture({core:true});f.b.loseHp(f.e,1e9);f.h.run(.55);const c=snapshot(f.b)[0];assert.equal(c?.kind,'final');
 f.line.cooldown=0;assert.equal(f.line.cast(),false);taps(f,c);assert.equal(f.e.alive,false);assert.equal(f.waves.length,1);assert.equal(f.core.active,false);
 assert.equal(f.core.timeout.active,false);assert.equal(f.core.health.active,false);assert.equal(f.line.active,false);assert.equal(f.b.life,100);assert.deepEqual(f.b.errors,[]);
});
test('terminal AlwaysNext handoff retires the integrated actor even when a kill observer revives it',()=>{
 const f=fixture({core:true});f.b.loseHp(f.e,1e9);f.h.run(.55);const c=snapshot(f.b)[0];f.b.on('kill',({victim})=>{if(victim===f.e)victim.hp=50;});taps(f,c);
 assert.equal(f.e.alive,true);assert.equal(f.e.hp,50);assert.equal(f.waves.length,1);assert.equal(f.core.active,false);assert.equal(f.line.active,false);
 assert.equal(f.core.timeout.active,false);assert.equal(f.core.health.active,false);assert.ok(!f.e.s.flags.undeadable);assert.deepEqual(f.b.errors,[]);
});
test('partial core admission rolls back its earlier phases when the floor is rejected',()=>{
 const f=fixture();f.line.stop();f.b.on('beforeBuff',c=>{if(c.buff.key==='enemy_musnake_before_dead')c.cancel=true;});
 assert.throws(()=>installChapter17SnakeCore(f.b,f.e,{finishWave:()=>{}}),/admission failed/);
 assert.equal(f.e.mem.ch17SnakeCore,undefined);assert.equal(f.e.mem.ch17SnakeLine,undefined);assert.equal(f.e.mem.ch17SnakeHealth,undefined);
 assert.ok(!f.e.buffs.some(b=>b.key==='enemy_musnake_hp_ratio_trigger'));assert.deepEqual(f.b.errors,[]);
});
test('a body removed reentrantly while its interaction result admits injury cannot start a new line',()=>{
 const f=fixture({core:true});f.e.hp=f.e.s.maxHp*.79;f.h.run(.15);const c=snapshot(f.b)[0];
 f.b.on('beforeBuff',q=>{if(q.buff.key==='enemy_jmusnake_injury_action')f.b.kill(f.e,null);});taps(f,c);
 assert.equal(f.core.active,false);assert.equal(f.line.pending,null);assert.equal(f.line.output.beams.size,0);
 assert.ok(!f.e.buffs.some(b=>b.key==='enemy_jmusnake_injury_action'));assert.deepEqual(f.b.errors,[]);
});
test('contract reproduction rejects altered source clocks and canonical skill values',async()=>{
 for(const [file,mutate]of [['arkpedia-ch17-firewall-boss-animation-source.json',d=>{d.enemies[key].base64='AA==';}],
  ['arkpedia-ch17-snake-health-contract.json',d=>{d.record.skills[0].bb.value=999;}]])
  await assert.rejects(()=>snakeLineContract({read:async url=>{const v=readFileSync(url);if(!url.pathname.endsWith(file))return v;const data=JSON.parse(v);mutate(data);return Buffer.from(JSON.stringify(data));}}));
});
