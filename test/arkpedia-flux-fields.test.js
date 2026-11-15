// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle,chessRec,enemyRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { StageMagicCircuit } from '../server/sim/content/arkpedia-stage-magic-circuit.js';
import { installStageEnvironments } from '../server/sim/content/arkpedia-stage-environments.js';
import { sortEnemyTargets } from '../server/sim/targeting.js';
import { enemySupport,nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { fluxFieldCasterNative,crimsonFormationNative } from '../shared/arkpedia/enemy-flux-field-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const ids=['enemy_1244_ltssch','enemy_1244_ltssch_2','enemy_1245_ltseal'];
function fixture(positions=[[10,6],[11,7]]){
 const op=chessRec({id:'field_target',stats:{maxHp:100000,atk:0,def:0,blockCnt:0},skill:{spType:'INCREASE_WHEN_TAKEN_DAMAGE',spCost:100}});
 const d={key:'trap_062_magicstart',name:"'Tuba'",hidden:false,kind:'device',row:10,col:3,instance:{level:1,skillLevel:1,direction:'RIGHT'}};
 const records=Object.fromEntries(ids.map(id=>[id,ENEMY_RECORDS.enemies[id].levels[0]]));records.ordinary=enemyRec({key:'ordinary',hp:1000,speed:0});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:records},units:positions.map(([row,col])=>({chessId:op.chessId,row,col,dir:'RIGHT'})),
  setup:b=>{installEnemyFeatures(b);b.stageMagicCircuit=new StageMagicCircuit(b,[d],{rows:19,cols:21});
   installStageEnvironments(b,[{kind:'character_in_magiccircuit_env',sp_recover_ratio:-.5,'character_in_magiccircuit[normal].sp_recover_ratio':.5}]);}});
 h.b.start();return {...h,targets:h.allies(),field:h.b.stageMagicCircuit};
}
test('native Field Caster and formation contracts retain the child dependency and reject changed templates',()=>{
 for(const id of ids)assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
 assert.deepEqual(enemySupport(ENEMY_RECORDS.enemies[ids[0]],clocks.prefabs,native).spawns,[ids[2]]);
 const changed=structuredClone(native);changed.templates['apply_damage[magic][on_trigger]'].eventToActions.ON_BUFF_TRIGGER[0]._ignoreForSp=false;
 assert.equal(crimsonFormationNative(ENEMY_RECORDS.enemies[ids[2]].levels[0],nativeComponents(changed,ids[2])),false);
 const r=structuredClone(ENEMY_RECORDS.enemies[ids[0]].levels[0]);r.stats.atk=100;assert.equal(fluxFieldCasterNative(r,nativeComponents(native,ids[0])),false);
});
test('Field Casters prioritize Flux and summon independent, uncounted formations without attacking HP',()=>{
 for(const id of ids.slice(0,2)){
  const h=fixture(),{b,targets,field}=h;const e=b.spawnEnemy(id,{pos:[11,6]});b.addBuff(e,{key:'hold',flags:{noMove:true}});
  b.addBuff(targets[1],{key:'taunt',mods:{taunt:100}});b.applyStatus(e,'silence',{duration:20});
  h.runUntil(()=>b.enemies.some(e=>e.defId===ids[2]),3);const seal=b.enemies.find(e=>e.defId===ids[2]);
  assert.ok(seal);assert.equal(seal.x,6);assert.equal(seal.y,10);assert.equal(seal.counted,false);assert.equal(targets[0].hp,100000);
  assert.equal(e.profile.canTarget(targets[0]),false);assert.equal(e.profile.canTarget(targets[1]),true);assert.equal(field.coversPosition(10,5),false);
  b.kill(e);h.run(1);assert.equal(seal.alive,true);assert.equal(targets[0].hp,99850);assert.equal(targets[0].skill.sp,0);assert.deepEqual(b.errors,[]);
 }
});
test('Crimson Formation holds ground targets, ignores camouflage, and starts Arts DoT after 0.9s without defensive SP',()=>{
 const h=fixture(),{b,targets}=h;const target=targets[0];b.addBuff(target,{key:'camouflage',flags:{camouflage:true}});
 const seal=b.spawnEnemy(ids[2],{pos:[10,6],countInTotal:false});assert.equal(target.s.flags.stun,true);
 h.run(.9);assert.equal(target.hp,100000);h.run(1/30);assert.equal(target.hp,99850);h.run(1);assert.equal(target.hp,99700);
 assert.equal(target.skill.sp,0);assert.equal(targets[1].s.flags.stun,false);
 b.kill(seal);assert.equal(target.s.flags.stun,false);const hp=target.hp;h.run(1);assert.equal(target.hp,hp);assert.deepEqual(b.errors,[]);
});
test('five damage instances remove the stationary formation and restore Flux; its timeout also releases its stun',()=>{
 const h=fixture(),{b,targets,field}=h;const seal=b.spawnEnemy(ids[2],{pos:[10,6],countInTotal:false});
 assert.equal(field.coversPosition(10,8),false);h.run(1);assert.equal(seal.x,6);assert.equal(seal.y,10);
 for(const status of ['stun','silence','cold','freeze','sleep','levitate'])assert.equal(b.applyStatus(seal,status,{duration:3}),false,status);
 for(let i=0;i<4;i++)b.dealDamage(targets[1],seal,{amount:10000,type:'true',isAttack:true});assert.equal(seal.hp,1);
 b.dealDamage(targets[1],seal,{amount:10000,type:'arts',isAttack:true});assert.equal(seal.alive,false);assert.equal(field.coversPosition(10,8),true);
 const second=b.spawnEnemy(ids[2],{pos:[10,6],countInTotal:false});h.run(10+1/30);assert.equal(second.alive,false);assert.equal(targets[0].s.flags.stun,false);assert.equal(field.coversPosition(10,8),true);
 assert.deepEqual(b.errors,[]);
});
test('flying targets are not held; moving or withdrawing an attached unit removes only this formation’s stun',()=>{
 const h=fixture(),{b,targets}=h;targets[0].motion='FLY';const seal=b.spawnEnemy(ids[2],{pos:[10,6],countInTotal:false});h.run(1);assert.equal(targets[0].hp,100000);assert.equal(targets[0].s.flags.stun,false);
 targets[0].motion='GROUND';h.run(1/30);assert.equal(targets[0].s.flags.stun,true);
 b.applyStatus(targets[0],'stun',{key:'independentStun',duration:10});b.relocate(targets[0],11,6);h.run(1/30);
 assert.equal(targets[0].findBuff(`enemy_1245_ltseal:stun:${seal.id}`),null);assert.ok(targets[0].findBuff('independentStun'));assert.equal(seal.alive,true);
 assert.deepEqual(b.errors,[]);
});
test('uncounted formations retain ordinary low-HP targeting and overlapping exclusions have independent ownership',()=>{
 const h=fixture(),{b,field,targets}=h;const a=b.spawnEnemy(ids[2],{pos:[10,6],countInTotal:false}),z=b.spawnEnemy(ids[2],{pos:[10,7],countInTotal:false});
 const ordinary=b.spawnEnemy('ordinary',{pos:[11,6]});assert.deepEqual(sortEnemyTargets(b,targets[0],[ordinary,a],'lowestHp'),[a,ordinary]);
 assert.equal(a.profile.holdsBattle,false,'non-primary is a victory condition, not targeting priority');
 b.kill(a);assert.equal(field.coversPosition(10,6),false);b.kill(z);assert.equal(field.coversPosition(10,8),true);assert.deepEqual(b.errors,[]);
});
