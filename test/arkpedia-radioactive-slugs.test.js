// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {radioactiveNative} from '../shared/arkpedia/enemy-radioactive-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemyEnergy,changeEnemyEnergy} from '../server/sim/content/arkpedia-enemy-energy.js';
import {createEnemyRuntime} from '../server/sim/content/arkpedia-enemy-runtime.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1352_eslime','enemy_1352_eslime_2'],donorId='enemy_1353_esabr';
function fixture(id=ids[0],compiled=true){
 const g=chessRec({id:'radioactive_guard',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:5},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:Object.fromEntries([...ids,donorId].map(k=>[k,compiled?withCompiledEnemyRuntime(records.enemies[k].levels[0]):records.enemies[k].levels[0]])),chess:{[g.chessId]:g}},units:[[10,6],[10,7],[9,6],[11,6],[11,7],[10,8]].map(([row,col])=>({chessId:g.chessId,row,col})),kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();
 const e=h.b.spawnEnemy(id,{pos:[10,6]});h.b.addBuff(e,{key:'hold',flags:{noMove:true}});const donor=(initial=4)=>{const u=h.b.spawnEnemy(donorId,{pos:[10,10]});h.b.addBuff(u,{key:'hold',flags:{noMove:true}});changeEnemyEnergy(h.b,u,initial);return u;};return{...h,e,donor,g:h.b.allyUnits[0]};
}
for(const id of ids){
 test(`${id}: exact native Arts body and delayed death energy projectile compile as shared components`,()=>{
  assert.equal(radioactiveNative(records.enemies[id].levels[0],nativeComponents(evidence,id)),true);
  assert.deepEqual(withCompiledEnemyRuntime(records.enemies[id].levels[0]).runtimeFeatures.entries.map(e=>e.ability.kind),['deathEnergyPulse','animatedMeleeAttack']);
 });
 test(`${id}: ordinary melee deals Arts on the stretched native event marker`,()=>{
  const h=fixture(id),hits=[],attacks=[];h.b.on('attack',c=>{if(c.attacker===h.e)attacks.push(h.b.time);});h.b.on('damaged',c=>{if(c.source===h.e)hits.push({time:h.b.time,type:c.dmg.type,loss:c.hpLoss});});
  assert.ok(h.runUntil(()=>hits.length===1,2));assert.equal(hits[0].type,'arts');assert.equal(hits[0].loss,h.e.base.atk);assert.ok(Math.abs(hits[0].time-attacks[0]-.4*h.e.s.interval/Math.fround(38/30))<h.b.dt*1.2);assert.deepEqual(h.b.errors,[]);
 });
 test(`${id}: stationary death projectile waits half a second, rewards the entire field, then deals four-ATK Arts`,()=>{
  for(const compiled of[false,true]){const h=fixture(id,compiled),donor=h.donor(),packets=[];h.b.on('hit',c=>{if(c.source===h.e)packets.push({time:h.b.time,amount:c.dmg.amount,type:c.dmg.type,energy:enemyEnergy(h.b,donor).count});});
   const at=h.b.time,amount=h.e.s.atk*4;h.b.kill(h.e);h.run(.4);assert.equal(enemyEnergy(h.b,donor).count,4);assert.equal(packets.length,0);h.run(.2);
   assert.equal(enemyEnergy(h.b,donor).count,5);assert.ok(packets.length>0);assert.ok(packets.every(p=>p.amount===amount&&p.type==='arts'&&p.energy===5&&p.time-at>=.5-h.b.dt));assert.deepEqual(h.b.errors,[]);}
 });
}
test('death blast selects ground bodies at arrival, ignores camouflage, and excludes hidden, flying and distant bodies',()=>{
 const h=fixture(),[center,near,air,camo,hidden,far]=h.b.allyUnits;air.motion='FLY';h.b.addBuff(camo,{key:'camo',flags:{camouflage:true}});h.b.addBuff(hidden,{key:'stealth',flags:{stealth:true}});const amount=h.e.s.atk*4;
 h.b.kill(h.e);h.run(.6);for(const u of[center,near,camo])assert.equal(u.s.maxHp-u.hp,amount);for(const u of[air,hidden,far])assert.equal(u.hp,u.s.maxHp);assert.deepEqual(h.b.errors,[]);
});
test('global reward honors eligibility and overload at arrival, including newly spawned recipients',()=>{
 const h=fixture(),unmarked=h.donor(),over=h.donor(10);h.b.removeBuff(unmarked,'blacksteel_energy[mark]');h.b.kill(h.e);h.run(.2);const late=h.donor(9);h.run(.4);
 assert.equal(enemyEnergy(h.b,unmarked).count,4);assert.equal(enemyEnergy(h.b,over).count,10);assert.equal(enemyEnergy(h.b,late).overloaded,true);assert.deepEqual(h.b.errors,[]);
});
test('source silence and non-kill removal suppress both consequences; released pulses retain their packet and location',()=>{
 for(const reason of['silence','leak']){const h=fixture(),d=h.donor();if(reason==='silence'){h.b.applyStatus(h.e,'silence',{duration:1});h.b.kill(h.e);}else h.b.leak(h.e);h.run(.6);assert.equal(enemyEnergy(h.b,d).count,4);assert.equal(h.g.hp,h.g.s.maxHp);assert.deepEqual(h.b.errors,[]);}
 const h=fixture(),d=h.donor(),amount=h.e.s.atk*4;h.b.kill(h.e);h.e.x=1;h.e.y=1;h.b.addBuff(h.e,{key:'late-attack',mods:{atkPct:10}});h.run(.6);assert.equal(h.g.s.maxHp-h.g.hp,amount);assert.equal(enemyEnergy(h.b,d).count,5);h.run(1);assert.equal(enemyEnergy(h.b,d).count,5);assert.deepEqual(h.b.errors,[]);
});
test('independent deaths each reward once; battles do not share pending pulses',()=>{
 const h=fixture(),d=h.donor(),other=h.b.spawnEnemy(ids[1],{pos:[10,6]}),separate=fixture(),s=separate.donor();h.b.kill(h.e);h.b.kill(other);h.run(.6);assert.equal(enemyEnergy(h.b,d).count,6);separate.run(.6);assert.equal(enemyEnergy(separate.b,s).count,4);assert.deepEqual(h.b.errors,[]);
});
test('source gates refuse changed reward guards, emission event, damage type, geometry and lifetime',()=>{
 for(const edit of[
  n=>n.$template('enemy_esabr_add_energy').eventToActions.ON_BUFF_START[0]._buffKeys=['wrong'],
  n=>n.$template('enemy_eslime_add_energy_global').eventToActions.ON_OWNER_KILLED[1]._ev='ON_HIT_TARGET',
  n=>n.Boom.find(v=>v._projectileActions)._projectileActions.SerializedState='[]',
 ]){const n=nativeComponents(structuredClone(evidence),ids[0]);edit(n);assert.equal(radioactiveNative(records.enemies[ids[0]].levels[0],n),false);}
 for(const field of ['_lifeTime','m_Radius']){const changed=structuredClone(evidence),rows=changed.projectiles.projectile_enemy_eslime,row=rows.find(r=>field in JSON.parse(r.originalJson)),d=JSON.parse(row.originalJson);d[field]=99;row.originalJson=JSON.stringify(d);assert.equal(radioactiveNative(records.enemies[ids[0]].levels[0],nativeComponents(changed,ids[0])),false);}
});
test('selected preparation loads death energy and melee without the full enemy catalogue',async()=>{
 const r=withCompiledEnemyRuntime(records.enemies[ids[0]].levels[0]),runtime=createEnemyRuntime();await runtime.prepare({[ids[0]]:r});assert.deepEqual(runtime.stats().loaded.sort(),['arkpedia-enemy-death-energy','arkpedia-enemy-melee-sequence']);r.runtimeFeatures.entries[0].ability.params.delay=-1;await assert.rejects(runtime.prepare({[ids[0]]:r}),/Invalid death energy pulse/);
});
test('the death hit default category excludes ordinary device bodies',()=>{
 const h=fixture(),d=h.b.spawnDevice('radioactive-device',9,7,{hp:10000});d.profile.enemyTargetableDevice=true;h.b.kill(h.e);h.run(.6);assert.equal(d.hp,d.s.maxHp);assert.deepEqual(h.b.errors,[]);
});
test('removing the owned native parent disables the death program without consuming foreign attachments',()=>{
 const h=fixture(),d=h.donor(),foreign=h.b.addBuff(h.e,{key:'enemy_eslime_add_energy_global',refresh:'independent'}),own=h.e.buffs.find(x=>x.key==='enemy_eslime_add_energy_global'&&x!==foreign);
 h.b.removeBuff(h.e,own);h.b.kill(h.e);h.run(.6);assert.equal(enemyEnergy(h.b,d).count,4);assert.equal(h.g.hp,h.g.s.maxHp);assert.ok(h.e.buffs.includes(foreign));assert.deepEqual(h.b.errors,[]);
});
test('previously published scalar death-energy parameters retain their behavior',async()=>{
 const {deathEnergyPulse}=await import('../server/sim/content/arkpedia-enemy-death-energy.js'),{attach}=await import('../server/sim/content/arkpedia-enemy-ability-runtime.js');
 const h=fixture(),d=h.donor();h.b.removeBuff(h.e,'enemy_eslime_add_energy_global');
 attach(h.b,h.e,[deathEnergyPulse({delay:.5,radius:1.25,scale:4,type:'arts',energy:1,markerKey:'blacksteel_energy[mark]',parentKey:'enemy_eslime_add_energy_global',silenceable:true})]);h.b.kill(h.e);h.run(.6);assert.equal(enemyEnergy(h.b,d).count,5);assert.equal(h.g.s.maxHp-h.g.hp,h.e.base.atk*4);assert.deepEqual(h.b.errors,[]);
});
