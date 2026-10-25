// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {chapter17AttackEvents,CHAPTER17_ATTACK_CLOCK_BINDINGS as bindings} from '../server/sim/content/chapter17-attack-clocks.js';
import {applySourceSlowDown,NATIVE_SLOW_DOWN_CONTRACT} from '../server/sim/content/arkpedia-slow-down.js';
import {chapter17Environment} from '../server/sim/content/chapter17.js';
const records=JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-enemy-records.canonical.json',import.meta.url))).enemies;
const ID='enemy_10201_muinf_2',CASTER='enemy_10203_mumag_2';
function fixture(id=ID){
 const caster=id.includes('mumag'),sink=chessRec({id:'sink',stats:{maxHp:1e8,atk:0,def:0}});
 const h=makeBattle({content:'none',autoFinish:false,setup:installEnemyFeatures,defs:{enemies:{[id]:records[id].levels[0]},chess:{sink}},units:[{chessId:'sink',row:10,col:7}]});
 h.b.start();const b=h.b,u=h.allies()[0],e=h.spawn(id,{pos:[10,caster?6:7]}),a=e.mem.ch17OrdinaryAttack;
 e.route={legs:[{t:'wait',time:100}],legIdx:0,waitLeft:100};assert.ok(a);
 const hits=[],shots=[],attacks=[];b.on('damaged',c=>{if(c.source?.id===e.id)hits.push({...c,time:b.time});});
 b.on('attack',c=>{if(c.attacker===e)attacks.push({...c,time:b.time});});
 const add=b.addProjectile.bind(b);b.addProjectile=p=>{if(p.source===e)shots.push({time:b.time,...p});return add(p);};
 return{h,b,u,e,a,hits,shots,attacks,timing:chapter17AttackEvents(records[id].levels[0]),caster};
}
const begin=f=>{f.h.runUntil(()=>!!f.a.pending,2);return f.a.pending;};
const slow=f=>applySourceSlowDown(f.b,{id:'fixture:closur'},f.e,{key:'ordinary-clock',increment:.5,maxStrength:.5,maxStacks:1,duration:30,contract:NATIVE_SLOW_DOWN_CONTRACT});

for(const id of Object.keys(bindings))test(`${id} releases once at the retained OnAttack event and finishes its original clip`,()=>{
 const f=fixture(id),p=begin(f),start=p.startedAt;
 f.h.run(f.timing.hit-1.5*f.b.dt);assert.equal(f.hits.length,0);assert.equal(f.shots.length,0);assert.equal(f.attacks.length,0);
 f.h.run(.1);assert.equal(f.attacks.length,1);assert.ok(f.attacks[0].time-start>=f.timing.hit-1e-6);
 assert.ok(f.attacks[0].time-start<f.timing.hit+f.b.dt+1e-6);assert.equal(f.attacks[0].attackId,p.attackId);
 assert.equal(f.shots.length,f.caster?1:0);f.h.run(.2);assert.equal(f.hits.length,1);assert.equal(f.hits[0].type,f.timing.damageType);
 assert.equal(f.hits[0].dmg.attackId,p.attackId);assert.equal(f.hits[0].amount,f.e.s.atk);assert.ok(f.a.pending);assert.ok(f.e.s.flags.noMove);
 f.h.runUntil(()=>f.a.pending!==p,3);assert.ok(f.b.time-start>=f.timing.duration-1e-6);assert.ok(!f.e.s.flags.noMove);assert.deepEqual(f.b.errors,[]);
});

test('live slowdown changes only remaining ordinary clip work, independently of the Combat cooldown',()=>{
 const f=fixture(),p=begin(f);f.h.run(.1);const age=p.age,buff=slow(f);f.h.run(.4);
 assert.ok(Math.abs(p.age-age-.2)<f.b.dt);assert.equal(f.hits.length,0);f.b.removeBuff(f.e,buff);f.h.run(.1);assert.equal(f.hits.length,1);
 assert.equal(f.a.pending,p);slow(f);const after=p.age;f.h.run(.4);assert.ok(Math.abs(p.age-after-.2)<f.b.dt);assert.equal(f.hits.length,1);assert.deepEqual(f.b.errors,[]);
});

test('native maxAnimScale1 caps an ordinary clip even when its attack interval is much shorter',()=>{
 const f=fixture();f.b.addBuff(f.e,{key:'fixture:fast',mods:{aspd:900}});const p=begin(f);assert.equal(p.rate,1);
 f.h.run(.3);assert.equal(f.hits.length,0);f.h.run(.1);assert.equal(f.hits.length,1);f.h.run(1.3);assert.equal(f.e.stats.attacks,1);assert.equal(f.a.pending,p);assert.deepEqual(f.b.errors,[]);
});

for(const stop of ['death','battleEnd','control','source-reuse'])test(`${stop} cancels an unreleased ordinary Attack without a stale hit`,()=>{
 const f=fixture(),p=begin(f);f.h.run(.1);
 if(stop==='death')f.b.kill(f.e,null);else if(stop==='battleEnd')f.b.emit('battleEnd',{});else if(stop==='control'){f.b.applyStatus(f.e,'stun',{duration:.01});f.b.removeBuff(f.e,'stun');}else f.e.deploySeq++;
 f.h.run(.8);assert.equal(f.hits.length,0);assert.equal(f.a.pending,null);assert.ok(!f.e.buffs.includes(p.hold));assert.deepEqual(f.b.errors,[]);
 if(stop==='source-reuse'){assert.equal(f.a.active,false);assert.equal(f.a.begin([f.u]),false);f.h.run(3);assert.equal(f.e.stats.attacks,1);}
});

test('a replacement target life is not adopted and the noninterrupting clip completes without a hit',()=>{
 const f=fixture(),p=begin(f);f.u.deploySeq++;f.h.runUntil(()=>f.a.pending!==p,3);
 assert.equal(f.hits.length,0);assert.equal(f.attacks[0].targets.length,0);assert.ok(f.b.time-p.startedAt>=f.timing.duration-1e-6);assert.deepEqual(f.b.errors,[]);
});

test('beforeAttack rejection creates no source cast, cooldown, packet or movement hold',()=>{
 const f=fixture();f.b.on('beforeAttack',c=>{if(c.attacker===f.e)c.targets=[];});f.h.run(1);
 assert.equal(f.e.stats.attacks,0);assert.equal(f.a.pending,null);assert.equal(f.hits.length,0);assert.ok(!f.e.s.flags.noMove);assert.deepEqual(f.b.errors,[]);
});

test('the caster launches at its source event and the born projectile can finish after source death',()=>{
 const f=fixture(CASTER);begin(f);f.h.runUntil(()=>f.shots.length===1,2);assert.equal(f.hits.length,0);
 f.b.kill(f.e,null);f.h.run(.3);assert.equal(f.hits.length,1);assert.equal(f.hits[0].type,'arts');assert.equal(f.a.active,false);assert.deepEqual(f.b.errors,[]);
});

test('an unreleased caster shot is cancelled on retirement',()=>{
 const f=fixture(CASTER);begin(f);f.h.run(.1);f.b.kill(f.e,null);f.h.run(2);
 assert.equal(f.shots.length,0);assert.equal(f.hits.length,0);assert.deepEqual(f.b.errors,[]);
});

test('a born caster projectile cannot hit a reused target life',()=>{
 const f=fixture(CASTER);begin(f);f.h.runUntil(()=>f.shots.length===1,2);f.u.deploySeq++;f.h.run(.3);
 assert.equal(f.hits.length,0);assert.deepEqual(f.b.errors,[]);
});

test('ChargeRift interrupts an unreleased ordinary shot without losing its own channel hold',()=>{
 const f=fixture(CASTER),p=begin(f),channel=f.e.mem.ab.list.find(a=>Object.hasOwn(a,'left'));
 const marker={alive:true,x:f.e.x,y:f.e.y,sp:0,spCost:10000,s:{taunt:0},deploySeq:0,cycle:0,gainSp(n){this.sp+=n;}};
 chapter17Environment(f.b).rifts.push(marker);channel.left=0;f.h.run(.1);
 assert.equal(channel.target,marker);assert.equal(f.a.pending,null);assert.ok(!f.e.buffs.includes(p.hold));
 assert.ok(f.e.s.flags.disarm);assert.ok(f.e.s.flags.noMove);f.h.run(1);assert.ok(marker.sp>0);assert.equal(f.shots.length,0);assert.deepEqual(f.b.errors,[]);
});

test('source death inside a melee damage callback retires the owned cast without a later release',()=>{
 const f=fixture();begin(f);f.b.on('damaged',c=>{if(c.source===f.e)f.b.kill(f.e,null);});f.h.run(3);
 assert.equal(f.hits.length,1);assert.equal(f.e.alive,false);assert.equal(f.a.active,false);assert.equal(f.a.pending,null);assert.deepEqual(f.b.errors,[]);
});
