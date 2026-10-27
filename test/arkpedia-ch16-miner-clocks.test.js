// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {battle,keys} from './helpers/ch17Harness.js';
import {applySourceSlowDown,NATIVE_SLOW_DOWN_CONTRACT} from '../server/sim/content/arkpedia-slow-down.js';
import {stageLocalMiner} from '../server/sim/content/chapter16.js';
import {attach,installFeatureDispatch} from '../server/sim/content/enemies.js';
import {makeBattle,enemyRec,chessRec} from './helpers/battleHarness.js';
import {chapter16Shadow} from '../server/sim/content/chapter16-shadow.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const contract=read('data/candidates/arkpedia-ch16-miner-clock-contract.json');
function fixture(){
 const f=battle(keys[0],[{stats:{maxHp:1e6,atk:0,def:0,blockCnt:0}}]);
 f.u=f.h.allies()[0];f.a=f.e.mem.ch16MinerAttack;
 // Direct native port tests isolate cast ownership from the separately tested
 // hostile-neutral target selector. The player-side dummy cannot be selected by AI.
 assert.ok(f.a);return f;
}
const begin=f=>{assert.equal(f.a.begin([f.u]),true);return f.a.pending;};

function localFixture({medics=false}={}){
 const record=structuredClone(contract.local.record);
 const chess=medics?Object.fromEntries([['medic',400,'MEDIC'],['second',150,'MEDIC'],['caster',999,'CASTER']]
  .map(([id,atk,profession])=>[id,chessRec({id,profession,stats:{atk,blockCnt:0},rangeGrid:[[0,0],[0,1],[0,2],[0,3]]})])):{};
 const h=makeBattle({content:'generic',autoFinish:false,setup:installFeatureDispatch,
  defs:{enemies:{[record.key]:record,hostile:enemyRec({key:'hostile',maxHp:1e6,atk:0,def:0,moveSpeed:0})},chess},
  kits:Object.fromEntries(Object.keys(chess).map(id=>[id,()=>({trait:{noAttack:true},skill:{kind:'instant',trigger:'NEVER'}})])),
  units:Object.keys(chess).map((chessId,i)=>({chessId,row:10,col:5-i}))});
 h.b.start();const e=h.spawn(record.key,{pos:[10,6]});attach(h.b,e,[stageLocalMiner(record)]);
 e.base.moveSpeed=0;e.markDirty();
 return{h,b:h.b,e,a:e.mem.ch16MinerAttack,record};
}

test('stage-local miner composes neutral marks, elemental immunity and its own zero-duration listeners',()=>{
 const f=localFixture(),env=chapter16Shadow(f.b);env.setShadowSource(f.e,[[10,6]]);
 assert.equal(f.e.profile.friendly,true);assert.equal(f.e.profile.neutral,true);
 assert.equal(f.e.s.flags.unblockable,true);assert.ok(f.e.findBuff('enemy_mcreep_self_mark'));
 assert.ok(f.e.findBuff('mark_neutral[effect]'));assert.equal(f.e.s.taunt,-1);
 assert.equal(f.e.s.maxHp,12000);assert.equal(f.e.s.atk,500);assert.ok(f.e.def.immune.has('feared'));
 const c={target:f.e,cancel:false};f.b.emit('elementHit',c);assert.equal(c.cancel,true);
 f.h.run(.65);assert.equal(env.isShadow(10,6),true);assert.ok(f.e.mem.ch16MinerListeners.shadow);
 assert.deepEqual(f.b.errors,[]);
});

test('stage-local miner AI uses its physical native attack against a hostile enemy',()=>{
 const f=localFixture(),hostile=f.h.spawn('hostile',{pos:[10,6.8]});hostile.profile.noAttack=true;
 const hp=hostile.hp;f.e.atkCd=0;
 f.h.runUntil(()=>!!f.a.pending,1);assert.equal(f.a.pending.targets[0].unit,hostile);
 f.h.run(.5);assert.equal(hostile.hp,hp);f.h.run(.15);assert.equal(hp-hostile.hp,500);
 assert.deepEqual(f.b.errors,[]);
});

test('stage-local miner receives each in-range Medic ATK once per second without a catalogue heal scale',()=>{
 const f=localFixture({medics:true});f.e.hp=1000;
 f.h.run(.8);assert.equal(f.e.hp,1000);f.h.run(.25);assert.equal(f.e.hp,1550);
 f.h.run(1);assert.equal(f.e.hp,2100);assert.deepEqual(f.b.errors,[]);
});

test('miner healing rechecks full HP before the next Medic aura action',()=>{
 const f=localFixture({medics:true}),heals=[];f.e.hp=f.e.s.maxHp-100;
 f.b.on('heal',c=>{if(c.target===f.e)heals.push(c.source);});
 f.h.run(1.05);assert.equal(f.e.hp,f.e.s.maxHp);assert.equal(heals.length,1);
 f.h.run(1);assert.equal(heals.length,1,'full HP skips the next sampled healing action');
});

test('miner healing rejects a later Medic retired by an earlier healing callback',()=>{
 const f=localFixture({medics:true}),second=f.h.unit('second');assert.ok(second);f.e.hp=1000;
 f.b.on('heal',c=>{if(c.target===f.e&&c.source===f.h.unit('medic'))second.deployed=false;});
 f.h.run(1.05);assert.equal(f.e.hp,1400);assert.deepEqual(f.b.errors,[]);
});

for(const event of ['death','reuse','removed','battleEnd'])test('stage-local miner '+event+' retires attack and listener ownership together',()=>{
 const f=localFixture(),target=f.h.spawn('hostile',{pos:[10,8]});target.profile.noAttack=true;
 assert.equal(f.a.begin([target]),true);const hp=target.hp;
 if(event==='death')f.b.kill(f.e,null);else if(event==='reuse')f.e.deploySeq++;
 else if(event==='removed'){f.e.deployed=false;f.b.emit('removed',{unit:f.e});}else f.b.emit('battleEnd',{});
 f.h.run(.7);assert.equal(target.hp,hp);assert.equal(f.a.active,false);assert.equal(f.a.pending,null);
 assert.equal(f.e.mem.ch16MinerListeners.active,false);assert.deepEqual(f.b.errors,[]);
});

test('stage-local miner factory rejects altered records and leaves the supplied source untouched',()=>{
 const r=structuredClone(contract.local.record),before=structuredClone(r);stageLocalMiner(r);assert.deepEqual(r,before);
 for(const change of [r=>r.stats.atk=501,r=>r.prefabKey='enemy_3010_mcreep_a',r=>r.talents.bb['TileEscapeShadowManager.times']=3]){
  const r=structuredClone(before);change(r);assert.throws(()=>stageLocalMiner(r),/Unreviewed stage-local/);
 }
});
test('miner full graph, prefab-bound JSON clocks and isolated local record reproduce',()=>{
 assert.equal(contract.testOnly,true);assert.equal(contract.frameParity,false);
 for(const pin of Object.values(contract.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+pin.path,import.meta.url))).digest('hex'),pin.sha256);
 assert.equal(contract.cast.hit,.5666999816894531);assert.equal(contract.cast.duration,1.5333000421524048);
 assert.equal(contract.cast.damageType,'phys');assert.equal(contract.local.record.stats.dmgType,'phys');
 assert.deepEqual(contract.local.record.talents.bb,{'FearLoseBlood.value':0});
 assert.deepEqual(Object.keys(contract.talentBindings).sort(),['FearLoseBlood','GetHeal','TileEscapeShadowManager']);
 execFileSync(process.execPath,['tools/arkpedia/miner-clock-contract.mjs','--check'],{stdio:'pipe'});
});
test('miner releases physical damage at original marker and holds the complete clip',()=>{
 const f=fixture(),hp=f.u.hp,p=begin(f),events=[];
 f.b.on('attack',c=>{if(c.attacker===f.e)events.push(c);});
 f.h.run(.5);assert.equal(f.u.hp,hp);assert.equal(p.released,false);
 f.h.run(.15);assert.equal(hp-f.u.hp,f.e.s.atk);assert.equal(events.length,1);assert.equal(events[0].attackId,p.attackId);
 assert.equal(f.a.pending,p);assert.ok(p.hold);f.h.run(.8);assert.equal(f.a.pending,p);
 f.h.run(.2);assert.equal(f.a.pending,null);assert.equal(f.e.findBuff(p.hold.key),null);assert.deepEqual(f.b.errors,[]);
});
for(const aspd of [-50,900])test('miner sampled ASPD '+aspd+' respects maxAnimScale one',()=>{
 const f=fixture();f.b.addBuff(f.e,{key:'rate',persist:true,mods:{aspd}});
 const p=begin(f),rate=aspd<0?.5:1;assert.equal(p.rate,rate);
 f.h.run(.5/rate);assert.equal(p.released,false);f.h.run(.15/rate);assert.equal(p.released,true);
});
test('miner consumes live slowdown once for cast and cooldown, then resumes',()=>{
 const f=fixture(),p=begin(f);f.h.run(.1);const age=p.age,cd=f.e.atkCd;
 const slow=applySourceSlowDown(f.b,f.u,f.e,{key:'miner-test-slow',increment:.5,maxStrength:.5,maxStacks:1,duration:30,contract:NATIVE_SLOW_DOWN_CONTRACT});
 f.h.run(.4);assert.ok(Math.abs(p.age-age-.2)<=f.b.dt+1e-7);assert.ok(Math.abs(f.e.atkCd-cd+.2)<=f.b.dt+1e-7);
 assert.equal(p.released,false);f.b.removeBuff(f.e,slow);f.h.run(.4);assert.equal(p.released,true);
});
for(const flag of ['stun','freeze','sleep','levitate','fear','disarm'])test('miner '+flag+' cancels unborn damage and movement hold',()=>{
 const f=fixture(),hp=f.u.hp,p=begin(f);f.h.run(.1);
 f.b.addBuff(f.e,{key:'control',persist:true,flags:{[flag]:true}});f.h.run(.1);
 assert.equal(f.a.pending,null);assert.equal(f.e.findBuff(p.hold.key),null);assert.equal(f.u.hp,hp);assert.deepEqual(f.b.errors,[]);
});
for(const event of ['death','removed','reuse','battleEnd','portReplacement'])test('miner source '+event+' retires the accepted cast',()=>{
 const f=fixture(),hp=f.u.hp,p=begin(f);f.h.run(.1);
 if(event==='death')f.b.kill(f.e,null);
 else if(event==='removed'){f.e.deployed=false;f.b.emit('removed',{unit:f.e});}
 else if(event==='reuse')f.e.deploySeq++;
 else if(event==='portReplacement')f.e.profile.sourceAttack={};
 else f.b.emit('battleEnd',{});
 f.h.run(2);assert.equal(f.a.pending,null);assert.equal(f.e.findBuff(p.hold.key),null);assert.equal(f.u.hp,hp);
 assert.equal(f.a.begin([f.u]),false);assert.deepEqual(f.b.errors,[]);
});
for(const event of ['death','removed','reuse','hidden'])test('miner target '+event+' cannot receive a stale hit',()=>{
 const f=fixture();begin(f);f.h.run(.1);
 if(event==='death')f.b.kill(f.u,null);else if(event==='removed')f.u.deployed=false;
 else if(event==='reuse')f.u.deploySeq++;else f.u.hidden=true;
 const hp=f.u.hp;f.h.run(2);assert.equal(f.u.hp,hp);assert.deepEqual(f.b.errors,[]);
});
test('miner uses current same-life ATK at marker and cannot begin overlapping clips',()=>{
 const f=fixture(),hp=f.u.hp;begin(f);assert.equal(f.a.begin([f.u]),false);
 f.b.addBuff(f.e,{key:'atk',persist:true,mods:{atkFlat:123}});f.h.run(.65);
 assert.equal(hp-f.u.hp,f.e.s.atk);assert.equal(f.e.stats.attacks,1);
});
for(const event of ['death','reuse','battleEnd','reject'])test('miner movement hold admission handles reentrant '+event,()=>{
 const f=fixture(),hp=f.u.hp;
 f.b.on('beforeBuff',c=>{
  if(c.unit!==f.e||!c.buff.key.startsWith('ch16:miner-cast:'))return;
  if(event==='death')f.b.kill(f.e,null);else if(event==='reuse')f.e.deploySeq++;
  else if(event==='battleEnd')f.b.emit('battleEnd',{});else c.cancel=true;
 });
 assert.equal(f.a.begin([f.u]),false);f.h.run(2);
 assert.equal(f.a.pending,null);assert.equal(f.u.hp,hp);
 assert.equal(f.e.buffs.some(b=>b.key.startsWith('ch16:miner-cast:')),false);assert.deepEqual(f.b.errors,[]);
});
test('new miner source evidence grants no local enemy or 16-9 admission',()=>{
 const support=read('data/candidates/arkpedia-ch16-enemy-support.json'),stages=read('data/arkpedia-stages.json');
 assert.equal(support.enemies.enemy_3010_mcreep_a,undefined);
 assert.equal(stages.stages.some(s=>s.code==='16-9'),false);
});
test('ordinary miner AI selects a hostile enemy and releases through the native clock',()=>{
 const f=fixture(),hostile=f.h.spawn(keys[1],{pos:[10,6.8]});
 hostile.base.moveSpeed=0;hostile.base.def=0;hostile.markDirty();hostile.profile.noAttack=true;
 const hp=hostile.hp;f.e.atkCd=0;
 f.h.runUntil(()=>!!f.a.pending,1);const p=f.a.pending;
 assert.ok(p);assert.equal(p.targets[0].unit,hostile);assert.equal(hostile.hp,hp);
 f.h.run(.5);assert.equal(hostile.hp,hp);f.h.run(.15);
 assert.equal(hp-hostile.hp,f.e.s.atk);assert.equal(f.u.hp,f.u.s.maxHp);assert.deepEqual(f.b.errors,[]);
});
