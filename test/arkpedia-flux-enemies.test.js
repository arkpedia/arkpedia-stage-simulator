// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { StageMagicCircuit } from '../server/sim/content/arkpedia-stage-magic-circuit.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { fluxAttackNative } from '../shared/arkpedia/enemy-magic-circuit-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const ids=['enemy_1238_ltmob','enemy_1238_ltmob_2','enemy_1239_ltbow','enemy_1239_ltbow_2'];
function fixture(id, connected=false){
 const r=ENEMY_RECORDS.enemies[id].levels[0],op=chessRec({id:'flux_enemy_target',stats:{maxHp:100000,atk:0,def:0},skill:{spType:'INCREASE_WHEN_TAKEN_DAMAGE',spCost:100}});
 const d={key:'trap_062_magicstart',name:"'Tuba'",hidden:false,kind:'device',row:10,col:3,instance:{level:1,skillLevel:1,direction:'RIGHT'}};
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:r}},units:[{chessId:op.chessId,row:10,col:7}],
  setup:b=>{installEnemyFeatures(b);b.stageMagicCircuit=new StageMagicCircuit(b,connected?[d]:[],{rows:19,cols:21});}});
 const b=h.b;b.start();const target=h.allies().find(u=>u.kind==='op'),e=b.spawnEnemy(id,{pos:[10,id.includes('ltbow')?5.5:7]});
 b.addBuff(e,{key:'hold',flags:{noMove:true}});const hits=[];
 b.on('hit',c=>{if(c.source===e)hits.push({amount:c.dmg.amount,type:c.dmg.type,noSp:c.dmg.noSp,way:c.dmg.applyWay,at:b.time})});
 return {...h,e,target,hits,r};
}
test('four original enemy variants are admitted only with their native Flux conditional attack',()=>{
 for(const id of ids){
  const result=enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native);assert.ok(result.policy,JSON.stringify(result.reasons));
  const r=ENEMY_RECORDS.enemies[id].levels[0];assert.equal(fluxAttackNative(r,nativeComponents(native,id)),true);
 }
 const changed=structuredClone(native);changed.templates.enemy_ltbow_t.eventToActions.ON_BUFF_START[0]._conditionNode._targetType='SOURCE';
 assert.equal(fluxAttackNative(ENEMY_RECORDS.enemies[ids[2]].levels[0],nativeComponents(changed,ids[2])),false);
});
test('outside Flux, melee adds 40% Arts and ranged adds one Physical hit without a second defensive SP gain',()=>{
 for(const id of ids){const h=fixture(id),{b,e,target,hits,r}=h;
  b.applyStatus(e,'silence',{duration:20});h.runUntil(()=>hits.length>=2,5);
  assert.equal(hits.length,2,id);assert.equal(hits[0].amount,r.stats.atk);assert.equal(hits[0].type,'phys');
  assert.equal(hits[1].amount,r.stats.atk*(id.includes('ltbow')?1:.4));assert.equal(hits[1].type,id.includes('ltbow')?'phys':'arts');
  assert.equal(hits[1].way,'melee');assert.equal(hits[1].noSp,true);assert.equal(target.skill.sp,1);assert.deepEqual(b.errors,[]);
 }
});
test('connected targets take only the ordinary hit; target connection is checked when a released projectile arrives',()=>{
 for(const id of ids){const h=fixture(id,true);h.runUntil(()=>h.hits.length,5);assert.equal(h.hits.length,1,id);assert.equal(h.target.skill.sp,1);}
 const h=fixture(ids[2],true);h.runUntil(()=>h.b.projectiles.list.length>0,3);assert.equal(h.hits.length,0);
 const source=[...h.b.stageMagicCircuit.entries.values()][0].unit;h.b._remove(source,'retreat',null,true);
 h.runUntil(()=>h.hits.length>0,2);assert.equal(h.hits.length,2);assert.deepEqual(h.b.errors,[]);
});
test('independently unmissable additive payload is attempted after a cancelled ordinary hit',()=>{
 const h=fixture(ids[0]);let first=true;
 h.b.on('hit',c=>{if(c.source===h.e&&first){c.dmg.cancel=true;first=false;}});
 const hp=h.target.hp;h.runUntil(()=>h.hits.length>=2,5);
 assert.equal(hp-h.target.hp,h.r.stats.atk*.4);assert.equal(h.target.skill.sp,0);assert.deepEqual(h.b.errors,[]);
});
test('released ranged payload survives source death and never hits a replacement target',()=>{
 const h=fixture(ids[2]);h.runUntil(()=>h.b.projectiles.list.length>0,3);h.b.kill(h.e);h.run(.5);assert.equal(h.hits.length,2);
 const next=fixture(ids[2]);next.runUntil(()=>next.b.projectiles.list.length>0,3);next.b.retreat(next.target,{permanent:true});next.run(.5);assert.equal(next.hits.length,0);
 assert.deepEqual(h.b.errors,[]);assert.deepEqual(next.b.errors,[]);
});

test('Colossi occupy two block slots and lose their flat DEF/RES only while inside Flux',()=>{
 for(const id of ['enemy_1240_ltgint','enemy_1240_ltgint_2']){
  const r=ENEMY_RECORDS.enemies[id].levels[0],h=fixture(id,true),{b,e,target}=h;
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
  h.run(.1);assert.equal(e.blockedBy,target);assert.equal(e.blockWeight,2);
  assert.equal(e.s.def,200);assert.equal(e.s.res,0);
  b.applyStatus(e,'silence',{duration:20});h.run(.1);assert.equal(e.s.def,200);
  const source=[...b.stageMagicCircuit.entries.values()][0].unit;source.dir='DOWN';h.run(.1);
  assert.equal(e.s.def,r.stats.def);assert.equal(e.s.res,50);
  source.dir='RIGHT';h.run(.1);assert.equal(e.s.def,200);assert.equal(e.buffs.filter(x=>x.key==='enemy_ltgint_t[weak]').length,1);
  b.addBuff(target,{key:'lessBlock',mods:{blockCnt:-1}});h.run(.1);assert.equal(e.blockedBy,null);
  assert.deepEqual(b.errors,[]);
 }
});
