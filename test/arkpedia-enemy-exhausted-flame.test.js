// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle,chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const ids=['enemy_1294_duchns','enemy_1294_duchns_2'];
function fixture(id=ids[0],skill={}){
 const op=chessRec({id:'flame_host',stats:{maxHp:100000,atk:0,res:0},skill:{spCost:10,...skill}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{enemies:{[id]:ENEMY_RECORDS.enemies[id].levels[0]},chess:{[op.chessId]:op}},
  units:[[9,6],[9,7],[10,7]].map(([row,col])=>({chessId:op.chessId,row,col})),setup:installEnemyFeatures});
 h.b.start();const [u,adjacent,diagonal]=h.b.allyUnits;for(const a of h.b.allyUnits)h.b.addBuff(a,{key:'hold',flags:{noMove:true}});
 const e=h.b.spawnEnemy(id,{pos:[9,6],countInTotal:false});return{...h,e,u,adjacent,diagonal};
}
for(const id of ids)test(`${id}: binds its tile, disables attacks/new skills, decays and explodes in a five-tile cross`,()=>{
 const h=fixture(id),{b,e,u,adjacent,diagonal}=h;u.skill.setSpTotal(10);h.step();
 assert.equal(u.s.flags.disarm,true);assert.equal(u.s.flags.skillNotActivatable,true);assert.equal(u.skill.ready,true);assert.equal(u.skill.activate('manual'),false);assert.equal(u.skill.spTotal,10);assert.equal(skillHud(u.skill).canActivate,false);
 assert.equal(e.s.flags.noDisplace,true);assert.equal(e.s.flags.noMove,true);assert.equal(e.profile.noAttack,true);
 b.addBuff(e,{key:'testModifier',mods:{dmgTakenMul:2,trueTakenMul:.1}});h.run(.8);assert.equal(e.hp,10000);h.run(.3);assert.equal(e.hp,9500);
 const hits=[];b.on('damaged',c=>{if(c.source===e&&c.dmg.type==='arts'&&c.dmg.tags.includes('exhaustedFlameExplosion'))hits.push(c)});h.run(19);
 assert.equal(e.alive,false);assert.equal(b.killed,0);assert.equal(hits.length,2);assert.ok(hits.every(c=>[u,adjacent].includes(c.target)));
 assert.ok(hits.every(c=>c.hpLoss===e.s.atk&&c.dmg.isSplash));assert.equal(diagonal.hp,100000);assert.equal(!!u.burstPending?.burn,false);
 // 800 * 1.25 fills the normal variant's gauge; the elite also bursts.
 assert.equal(!!u.s.flags.skillNotActivatable,false);assert.equal(!!u.s.flags.disarm,false);assert.equal(u.skill.activate('manual'),true);
 assert.deepEqual(b.errors,[]);
});
test('host withdrawal kills the source and cleans only its own suppression',()=>{
 const h=fixture(),{b,e,u,adjacent}=h;h.step();b.addBuff(adjacent,{key:'other',flags:{skillNotActivatable:true}});
 const hp=adjacent.hp;b.retreat(u,{permanent:true});h.step();assert.equal(e.alive,false);assert.equal(adjacent.hp,hp-2000);assert.equal(adjacent.s.flags.skillNotActivatable,true);
 assert.deepEqual(b.errors,[]);
});
test('two flames have independent binding ownership; killing one does not release the other',()=>{
 const h=fixture(),{b,e,u}=h;const other=b.spawnEnemy(ids[0],{pos:[9,6],countInTotal:false});h.step();
 b.kill(e);assert.equal(other.alive,true);assert.equal(u.s.flags.skillNotActivatable,true);b.kill(other);assert.equal(!!u.s.flags.skillNotActivatable,false);assert.deepEqual(b.errors,[]);
});
test('target-free hosts can be bound; an empty tile immediately finishes its flame',()=>{
 const h=fixture(),{b,e,u}=h;b.addBuff(u,{key:'untargetable',flags:{untargetable:true}});h.step();assert.equal(u.s.flags.skillNotActivatable,true);
 const blank=b.spawnEnemy(ids[0],{pos:[12,4],countInTotal:false});h.step();assert.equal(blank.alive,false);assert.equal(e.alive,true);assert.deepEqual(b.errors,[]);
});
test('the activation lock leaves an already active skill and its SP accounting intact',()=>{
 const h=fixture(),{b,e,u}=h;u.skill.setSpTotal(10);assert.equal(u.skill.activate('manual'),true);h.step();
 assert.equal(u.skill.active,true);assert.equal(u.skill.castEligible,false);assert.equal(u.skill.activations,1);b.kill(e);assert.equal(u.skill.active,true);assert.equal(u.skill.castEligible,true);
});
test('source gate refuses changed self-drain, aura range, suppression flags and death range',()=>{
 for(const id of ids)assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy);
 for(const change of ['drain','range','flags','cross']){
  const n=structuredClone(native);
  if(change==='drain')n.templates.enemy_duchns_pericdic_damage.eventToActions.ON_BUFF_TRIGGER[0]._skipModifierEvent=false;
  if(change==='cross')n.ranges['x-5'].grids.push({row:1,col:1});
  for(const row of n.prefabs['dyn/battle/prefabs/enemies/enemy_1294_duchns.prefab']){const d=JSON.parse(row.originalJson);
   if(change==='range'&&d._rangeId==='0-1')d._rangeId='x-5';
   if(change==='flags'&&d._buffs?.[0]?.templateKey==='enemy_duchns_kill_source')d._buffs[0].attributes.abnormalFlags=[11];
   row.originalJson=JSON.stringify(d);
  }
  assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]],clocks.prefabs,n).policy,null,change);
 }
});

test('automatic skills retain full SP while locked and activate after the source is removed',()=>{
 const h=fixture(ids[0],{skillType:'AUTO',duration:0,trigger:{rule:'SP_FULL'}}),{b,e,u}=h;h.step();u.skill.setSpTotal(10);h.run(.3);
 assert.equal(u.skill.activations,0);assert.equal(u.skill.spTotal,10);b.kill(e);h.run(.1);assert.equal(u.skill.activations,1);assert.deepEqual(b.errors,[]);
});
