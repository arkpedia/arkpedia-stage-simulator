// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {energyNative} from '../shared/arkpedia/enemy-energy-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemyEnergy,changeEnemyEnergy} from '../server/sim/content/arkpedia-enemy-energy.js';
import {nativeBattleInfo} from '../server/sim/content/arkpedia-native-battle-info.js';
import {createEnemyRuntime} from '../server/sim/content/arkpedia-enemy-runtime.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1356_egun','enemy_1356_egun_2'],donorId='enemy_1353_esabr';
function fixture(id=ids[0],compiled=true,guard=false){
 const g=chessRec({id:'energy_gunner_guard',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:Object.fromEntries([...ids,donorId].map(k=>[k,compiled?withCompiledEnemyRuntime(records.enemies[k].levels[0]):records.enemies[k].levels[0]])),chess:{[g.chessId]:g}},units:guard?[{chessId:g.chessId,row:10,col:7}]:[],kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();
 const spawn=(key,pos)=>{const e=h.b.spawnEnemy(key,{pos});h.b.addBuff(e,{key:'fixture:hold',flags:{noMove:true}});return e;};const e=spawn(id,[10,6]);
 const donor=(pos=[10,7],count=4)=>{const u=spawn(donorId,pos);changeEnemyEnergy(h.b,u,count);return u;};return{...h,e,spawn,donor,g:h.b.allyUnits[0]};
}
for(const id of ids){
 test(`${id}: native meter, overload log and coupled ranged/emitter body compile from exact source`,()=>{
  assert.equal(energyNative(records.enemies[id].levels[0],nativeComponents(evidence,id)),true);const p=withCompiledEnemyRuntime(records.enemies[id].levels[0]).runtimeFeatures;
  assert.deepEqual(p.entries.map(e=>e.ability.kind),['nativeEnergyMeter','energyRangedEmitter']);assert.deepEqual(p.entries[0].ability.params.overload.log,{key:'egun_over_energy',addition:1});
 });
 test(`${id}: Skill releases a five-second grant buff after its own marker, with five one-second pulses including self`,()=>{
  for(const compiled of[false,true]){const h=fixture(id,compiled),d=h.donor();h.run(4.9);assert.equal(h.e.findBuff('enemy_egun_s_1'),null);assert.ok(h.runUntil(()=>h.e.findBuff('enemy_egun_s_1'),1));
   const release=h.b.time;assert.equal(enemyEnergy(h.b,h.e).count,0);assert.equal(enemyEnergy(h.b,d).count,4);h.run(.9);assert.equal(enemyEnergy(h.b,h.e).count,0);h.run(.2);assert.equal(enemyEnergy(h.b,h.e).count,1);assert.equal(enemyEnergy(h.b,d).count,5);
   h.run(4.1);assert.equal(enemyEnergy(h.b,h.e).count,5);assert.equal(enemyEnergy(h.b,d).count,9);assert.equal(h.e.findBuff('enemy_egun_s_1'),null);assert.ok(release>5&&release<5.4);assert.deepEqual(h.b.errors,[]);}
 });
 test(`${id}: ordinary attacks use native physical projectile markers and continue while the released grant buff runs`,()=>{
  const h=fixture(id,true,true),hits=[],attacks=[];h.b.on('hit',c=>{if(c.source===h.e)hits.push({time:h.b.time,type:c.dmg.type,amount:c.dmg.amount});});h.b.on('attack',c=>{if(c.attacker===h.e)attacks.push(h.b.time);});
  assert.ok(h.runUntil(()=>hits.length===1,2));assert.equal(hits[0].type,'phys');assert.equal(hits[0].amount,h.e.base.atk);assert.ok(Math.abs(hits[0].time-attacks[0]-13/30-.1)<h.b.dt*2);
  h.run(8);assert.ok(hits.some(x=>x.time>6&&x.time<10));assert.ok(enemyEnergy(h.b,h.e).count>0);assert.deepEqual(h.b.errors,[]);
 });
}
test('grant range and recipient eligibility are evaluated live, using the literal all-motion selector',()=>{
 const h=fixture(),near=h.donor([10,8.19]),far=h.donor([10,8.21]),air=h.donor([11,6]),unmarked=h.donor([9,6]),over=h.donor([10,5],10);air.motion='FLY';h.b.removeBuff(unmarked,'blacksteel_energy[mark]');h.run(6.5);
 assert.equal(enemyEnergy(h.b,near).count,5);assert.equal(enemyEnergy(h.b,far).count,4);assert.equal(enemyEnergy(h.b,air).count,5);assert.equal(enemyEnergy(h.b,unmarked).count,4);assert.equal(enemyEnergy(h.b,over).count,10);
 far.x=7;near.x=9;h.run(1);assert.equal(enemyEnergy(h.b,near).count,5);assert.equal(enemyEnergy(h.b,far).count,5);assert.deepEqual(h.b.errors,[]);
});
test('a released non-stunnable grant survives control; death and leakage remove its owned buff and future pulses',()=>{
 for(const reason of['kill','leak']){const h=fixture(),d=h.donor();assert.ok(h.runUntil(()=>h.e.findBuff('enemy_egun_s_1'),6));h.b.applyStatus(h.e,'stun',{duration:10});h.run(1.1);assert.equal(enemyEnergy(h.b,d).count,5);
  h.b[reason](h.e);assert.equal(h.e.findBuff('enemy_egun_s_1'),null);h.run(2);assert.equal(enemyEnergy(h.b,d).count,5);assert.deepEqual(h.b.errors,[]);}
});
test('source overload skips its own reward but does not stop grants to other eligible recipients; native log records each accepted overload',()=>{
 const h=fixture(),d=h.donor();changeEnemyEnergy(h.b,h.e,20);assert.equal(nativeBattleInfo(h.b,'egun_over_energy'),1);assert.equal(nativeBattleInfo(h.b,'egun_over_energy',h.e),1);h.run(6.5);
 assert.equal(enemyEnergy(h.b,h.e).count,20);assert.equal(enemyEnergy(h.b,d).count,5);assert.equal(nativeBattleInfo(h.b,'egun_over_energy'),1);h.run(14);assert.equal(enemyEnergy(h.b,h.e).count,0);changeEnemyEnergy(h.b,h.e,20);assert.equal(nativeBattleInfo(h.b,'egun_over_energy'),2);assert.deepEqual(h.b.errors,[]);
});
test('the timed skill preempts an ordinary windup without leaving the shared attack channel locked',()=>{
 const h=fixture(ids[0],true,true),hits=[];h.b.on('hit',c=>{if(c.source===h.e)hits.push(h.b.time);});h.run(4.9);h.e.atkCd=0;h.run(.1);assert.ok(h.e.mem.regularFormVisual);h.run(5);
 assert.ok(hits.some(t=>t>6));assert.equal(h.e.profile.noAttack,false);assert.deepEqual(h.b.errors,[]);
});
test('an airborne-only input does not trigger ordinary shots; a skill can start without attack targets',()=>{
 const h=fixture(ids[0],true,true);h.g.motion='FLY';const attacks=[];h.b.on('attack',c=>{if(c.attacker===h.e)attacks.push(c);});h.run(6.5);assert.equal(attacks.length,0);assert.equal(enemyEnergy(h.b,h.e).count,1);assert.deepEqual(h.b.errors,[]);
});
test('native admission rejects changed skill clocks, grant selectors, immobility and counter bindings',()=>{
 for(const edit of[
  n=>n.AddEnergy.find(v=>v._activeBuffs)._timeMode=0,
  n=>n.AddEnergy.find(v=>v._activeBuffs)._activeBuffs[0].attributes.abnormalFlags=[],
  n=>n.$template('enemy_egun_s_1').eventToActions.ON_BUFF_TRIGGER[0]._excludeTarget=true,
  n=>n.$template('enemy_egun_over_energy_buff[log]').eventToActions.ON_BUFF_START[0]._key='wrong',
 ]){const n=nativeComponents(structuredClone(evidence),ids[0]);edit(n);assert.equal(energyNative(records.enemies[ids[0]].levels[0],n),false);}
});
test('selected loading and ordered resource-service preflight cover the entire coupled component before spawn',async()=>{
 const r=withCompiledEnemyRuntime(records.enemies[ids[0]].levels[0]),runtime=createEnemyRuntime();await runtime.prepare({[ids[0]]:r});assert.deepEqual(runtime.stats().loaded.sort(),['arkpedia-enemy-energy','arkpedia-enemy-energy-emitter']);
 r.runtimeFeatures.entries.reverse();await assert.rejects(createEnemyRuntime().prepare({[ids[0]]:r}),/Missing earlier enemy runtime service/);
 const bad=withCompiledEnemyRuntime(records.enemies[ids[0]].levels[0]);bad.runtimeFeatures.entries[1].ability.params.blackboard={};await assert.rejects(createEnemyRuntime().prepare({[ids[0]]:bad}),/missing blackboard/);
});
test('death during release attachment cannot leave a live grant or affect later donors',()=>{
 const h=fixture(),d=h.donor();h.b.on('beforeBuff',c=>{if(c.buff.key==='enemy_egun_s_1')h.b.kill(c.unit);});h.run(7);assert.equal(h.e.alive,false);assert.equal(h.e.findBuff('enemy_egun_s_1'),null);assert.equal(enemyEnergy(h.b,d).count,4);assert.deepEqual(h.b.errors,[]);
});
test('ground-only acquisition does not reject a released projectile when its captured target becomes airborne',()=>{
 const h=fixture(ids[0],true,true),hits=[];h.b.on('hit',c=>{if(c.source===h.e)hits.push(c);});assert.ok(h.runUntil(()=>h.b.projectiles.list.length>0,1));h.g.motion='FLY';h.run(.3);assert.equal(hits.length,1);assert.equal(hits[0].dmg.type,'phys');assert.deepEqual(h.b.errors,[]);
});
