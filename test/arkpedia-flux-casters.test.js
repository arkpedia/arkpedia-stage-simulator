// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { fluxSplashCaster, fluxViolinist } from '../server/sim/content/arkpedia-enemy-flux-casters.js';
import { StageMagicCircuit } from '../server/sim/content/arkpedia-stage-magic-circuit.js';
import { installStageEnvironments } from '../server/sim/content/arkpedia-stage-environments.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { fluxSplashNative, fluxViolinNative } from '../shared/arkpedia/enemy-flux-caster-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const ids=['enemy_1241_ltmage','enemy_1241_ltmage_2','enemy_1242_ltsmag','enemy_1242_ltsmag_2'];
function fixture(id,positions,connected=false) {
 const record=ENEMY_RECORDS.enemies[id].levels[0];
 const op=chessRec({id:'flux_caster_target',stats:{maxHp:100000,atk:0,def:0,blockCnt:0},skill:{spType:'INCREASE_WHEN_TAKEN_DAMAGE',spCost:100}});
 const d={key:'trap_062_magicstart',name:"'Tuba'",hidden:false,kind:'device',row:10,col:3,instance:{level:1,skillLevel:1,direction:'RIGHT'}};
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record}},
  units:positions.map(([row,col])=>({chessId:op.chessId,row,col,dir:'RIGHT'})),setup:b=>{
   installEnemyFeatures(b);b.stageMagicCircuit=new StageMagicCircuit(b,connected?[d]:[],{rows:19,cols:21});
   installStageEnvironments(b,[{kind:'character_in_magiccircuit_env',sp_recover_ratio:-.5,'character_in_magiccircuit[normal].sp_recover_ratio':.5}]);
  }});
 const b=h.b;b.start();const targets=h.allies();for(const u of targets)u.dir='RIGHT';
 const e=b.spawnEnemy(id,{pos:[11,6]});b.addBuff(e,{key:'hold',flags:{noMove:true}});
 b.stageMagicCircuit.refresh();
 const hits=[];b.on('hit',c=>{if(c.source===e)hits.push({target:c.target,amount:c.dmg.amount,type:c.dmg.type,noSp:c.dmg.noSp,way:c.dmg.applyWay,tags:c.dmg.tags});});
 const manual=(target)=>{
  b.addBuff(e,{key:'manualTest',flags:{disarm:true}});
  const ability=(id.includes('ltmage')?fluxSplashCaster:fluxViolinist)({attackAnim:{dur:2,hit:.5},scale:id.includes('ltmage')?1:.5});
  ability.attack({targets:[target]},b,e);
 };
 return {...h,e,targets,hits,record,manual};
}
test('four caster variants require their original selectors, projectile branches and splash template',()=>{
 for(const id of ids)assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
 const splash=structuredClone(native);splash.templates['apply_damage[magic][ignore_sp]'].eventToActions.ON_BUFF_START[0]._ignoreForSp=false;
 assert.equal(fluxSplashNative(ENEMY_RECORDS.enemies[ids[0]].levels[0],nativeComponents(splash,ids[0])),false);
 const changed=structuredClone(native),rows=changed.projectiles.projectile_enemy_ltsmag_forward;
 const selector=rows.find(c=>JSON.parse(c.originalJson)._isBackward===0);
 assert.ok(selector);selector.originalJson=JSON.stringify({...JSON.parse(selector.originalJson),_isBackward:1});
 assert.equal(fluxViolinNative(ENEMY_RECORDS.enemies[ids[2]].levels[0],nativeComponents(changed,ids[2])),false);
});
test('Spire Casters acquire two separate targets and retain their native animation metadata while silenced',()=>{
 for(const id of ids.slice(0,2)) {
  const h=fixture(id,[[10,6],[12,6]]);h.b.applyStatus(h.e,'silence',{duration:10});
  h.runUntil(()=>h.b.projectiles.list.length,3);assert.equal(h.b.projectiles.list.length,2,id);
  assert.equal(h.e.def.attackAnim.hit,Math.fround(17/30));assert.equal(h.hits.length,0);h.run(.3);assert.equal(h.hits.length,2);assert.equal(new Set(h.hits.map(x=>x.target)).size,2);
  for(const hit of h.hits)assert.equal(hit.amount,h.record.stats.atk);
  assert.deepEqual(h.b.errors,[]);
 }
});
test('unconnected primary splashes neighboring ground and air allies, excluding primary and granting no splash SP',()=>{
 const h=fixture(ids[0],[[10,6],[10,7],[9,6],[12,6]]),[primary,side,air,far]=h.targets;
 air.motion='FLY';h.b.addBuff(side,{key:'camouflage',flags:{camouflage:true}});h.manual(primary);h.run(.5);
 assert.deepEqual(h.hits.map(x=>x.target.id).sort(),[primary,side,air].map(x=>x.id).sort());
 for(const hit of h.hits)assert.equal(hit.amount,h.record.stats.atk);
 assert.equal(primary.skill.sp,1);assert.equal(side.skill.sp,0);assert.equal(air.skill.sp,0);assert.equal(far.skill.sp,0);
 assert.ok(h.hits.filter(x=>x.target!==primary).every(x=>x.noSp&&x.way==='melee'));assert.deepEqual(h.b.errors,[]);
});
test('only the primary connection suppresses splash and connection is checked at impact',()=>{
 const h=fixture(ids[0],[[10,6],[11,6]],true);h.manual(h.targets[0]);h.run(.5);assert.equal(h.hits.length,1);
 const next=fixture(ids[0],[[11,6],[10,6]],true);next.manual(next.targets[0]);next.run(.5);assert.equal(next.hits.length,2);
 const changed=fixture(ids[0],[[10,6],[11,6]],true);changed.manual(changed.targets[0]);
 [...changed.b.stageMagicCircuit.entries.values()][0].unit.dir='UP';changed.run(.5);assert.equal(changed.hits.length,2);
});
test('Violinists prefer connected targets before taunt and branch in both directions with half damage and normal SP',()=>{
 for(const id of ids.slice(2)) {
  const h=fixture(id,[[10,5],[10,6],[10,7],[11,7]],true),[back,center,forward,outside]=h.targets;
  h.b.addBuff(center,{key:'centerTaunt',mods:{taunt:2}});h.b.addBuff(outside,{key:'outsideTaunt',mods:{taunt:100}});
  h.b.applyStatus(h.e,'silence',{duration:10});h.runUntil(()=>h.hits.length===3,3);
  assert.equal(h.hits[0].target,center);assert.equal(h.hits[0].amount,h.record.stats.atk);
  assert.deepEqual(h.hits.slice(1).map(x=>x.target.id).sort(),[back.id,forward.id].sort());
  assert.ok(h.hits.slice(1).every(x=>x.amount===h.record.stats.atk*.5&&x.way==='ranged'&&!x.noSp));
  for(const u of [back,center,forward])assert.equal(u.skill.sp,1);assert.equal(outside.skill.sp,0);assert.deepEqual(h.b.errors,[]);
 }
});
test('Violinist chains follow bends, stop at disconnection and retain released projectiles after source death',()=>{
 const h=fixture(ids[2],[[10,5],[9,5],[9,7]],true);h.targets[0].dir='DOWN';h.targets[1].dir='RIGHT';
 h.manual(h.targets[0]);h.b.kill(h.e);h.run(1);assert.deepEqual(h.hits.map(x=>x.target),h.targets);
 const next=fixture(ids[2],[[10,5],[10,6],[10,7]],true);next.manual(next.targets[1]);
 [...next.b.stageMagicCircuit.entries.values()][0].unit.dir='UP';next.run(1);assert.equal(next.hits.length,1);
 const outside=fixture(ids[2],[[10,5],[10,6]],false);outside.manual(outside.targets[0]);outside.run(1);assert.equal(outside.hits.length,1);
 assert.deepEqual(h.b.errors,[]);assert.deepEqual(next.b.errors,[]);
});
test('Violinist projectiles expire without an invented hit and do not hit retreated targets',()=>{
 const h=fixture(ids[2],[[10,6]],true);h.e.x=-100;h.manual(h.targets[0]);h.run(6);assert.equal(h.hits.length,0);assert.equal(h.b.projectiles.list.length,0);
 const next=fixture(ids[2],[[10,6]],true);next.manual(next.targets[0]);next.b.retreat(next.targets[0],{permanent:true});next.run(1);assert.equal(next.hits.length,0);
});
