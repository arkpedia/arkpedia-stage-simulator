// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {straightShot,STRAIGHT_SHOT_MARKS} from '../server/sim/content/arkpedia-enemy-straight-shot.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {RAPID_CROSSBOWMAN_FEATURES,rapidCrossbowmanNative,STRAIGHT_SHOT,FP} from '../shared/arkpedia/enemy-rapid-crossbowman-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const ids=['enemy_1403_gunsho','enemy_1403_gunsho_2'];
const feature=RAPID_CROSSBOWMAN_FEATURES['skill:CrossAttack'];
const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

/** Enemy held at row 10, col 6; operators placed at [row, col]. */
function fixture(id=ids[0],positions=[[10,9]]){
 const record=ENEMY_RECORDS.enemies[id].levels[0],p=feature.ability.params(record);
 const op=chessRec({id:'crossbow_target',stats:{maxHp:100000,atk:0,def:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:3+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const targets=h.allies();targets.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[10,6]});b.addBuff(e,{key:'testHold',flags:{noMove:true}});
 const hits=[];b.on('hit',c=>{if(c.source===e&&c.dmg.tags?.includes('straightShot'))hits.push({target:c.target,time:b.time,amount:c.dmg.amount,way:c.dmg.applyWay});});
 return {...h,e,targets,hits,p,record};
}

test('both crossbowmen are admitted only with the complete native shot, filter and projectile',()=>{
 for(const id of ids){
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
  assert.equal(rapidCrossbowmanNative(ENEMY_RECORDS.enemies[id].levels[0],nativeComponents(native,id)),true,id);
 }
 const r=ENEMY_RECORDS.enemies[ids[0]].levels[0];
 assert.equal(rapidCrossbowmanNative({...r,skills:[{...r.skills[0],cooldown:4}]},nativeComponents(native,ids[0])),false);
 const tamper=(edit,select)=>{const changed=structuredClone(native);for(const row of select(changed)){const d=JSON.parse(row.originalJson);if(edit(d))row.originalJson=JSON.stringify(d);}
  return rapidCrossbowmanNative(r,nativeComponents(changed,ids[0]));};
 const rows=c=>c.prefabs['dyn/battle/prefabs/enemies/enemy_1403_gunsho.prefab'],shot=c=>c.projectiles.projectile_enemy_gunsho;
 assert.equal(tamper(d=>'_additionalTimes'in d&&(d._additionalTimes=3,true),rows),false);
 assert.equal(tamper(d=>'_familyMask'in d&&(d._familyMask=3,true),rows),false);
 assert.equal(tamper(d=>'_checkOnTheSameLine'in d&&(d._offsetMaxX={_serializedValue:2**32},true),rows),false);
 assert.equal(tamper(d=>'_hitPasserby'in d&&(d._hitPasserby=0,true),shot),false);
 assert.equal(tamper(d=>'m_Radius'in d&&(d.m_Radius=.5,true),shot),false);
});

test('the runtime constants are the pinned native values',()=>{
 const n=nativeComponents(native,ids[0]),wrapper=n.CrossAttack.find(v=>'_familyMask'in v);
 const skill=n.$siblings(wrapper).find(c=>'_additionalTimes'in c),filter=n.$ref(skill._selector),parts=n.$projectile(skill._projectileKey);
 assert.equal(STRAIGHT_SHOT.bolts,skill._additionalTimes+1);assert.equal(STRAIGHT_SHOT.interval,skill._triggerDelta);
 assert.equal(STRAIGHT_SHOT.speed,parts.find(c=>'_moveType'in c)._speed);assert.equal(STRAIGHT_SHOT.lifetime,parts.find(c=>'_lifeTime'in c)._lifeTime);
 assert.ok(parts.filter(c=>'m_Radius'in c).every(c=>c.m_Radius===STRAIGHT_SHOT.radius));
 assert.equal(STRAIGHT_SHOT.band,FP(filter._offsetMaxX));assert.equal(-STRAIGHT_SHOT.band,FP(filter._offsetMinX));
 assert.throws(()=>straightShot({...feature.ability.params(ENEMY_RECORDS.enemies[ids[0]].levels[0]),bolts:30}),/Invalid Straight Shot/);
});

test('an aligned unblocked crossbowman fires three bolts on the original clocks',()=>{
 for(const id of ids){
  const h=fixture(id);const {p}=h;
  h.run(p.initial+p.release-.05);assert.equal(h.hits.length,0);assert.equal(h.e.mem.regularFormVisual.clip,'Skill');
  h.run(3);assert.equal(h.hits.length,3);
  assert.ok(h.hits.every(x=>x.target===h.targets[0]&&x.amount===h.record.stats.atk&&x.way==='ranged'));
  // Three tiles at speed 5: each bolt lands 0.6 s after leaving, one interval apart.
  const leave=p.initial+p.release;h.hits.forEach((x,i)=>assert.ok(Math.abs(x.time-(leave+i*p.interval+(3-p.radius)/p.speed))<.1,`${i}: ${x.time}`));
  assert.deepEqual(h.b.errors,[]);
 }
});

test('bolts stop at the first body in their path and ignore camouflage',()=>{
 const h=fixture(ids[0],[[10,11],[10,8]]);h.b.addBuff(h.targets[1],{key:'hide',flags:{camou:true}});
 h.run(h.p.initial+h.p.release+1);
 assert.equal(h.hits.length,3);assert.ok(h.hits.every(x=>x.target===h.targets[1]));assert.deepEqual(h.b.errors,[]);
});

test('only units on the same row or column are selected, and never while blocked',()=>{
 const off=fixture(ids[0],[[12,9]]);off.run(8);assert.equal(off.hits.length,0);assert.equal(off.e.mem.regularFormVisual??null,null);
 const column=fixture(ids[0],[[13,6]]);column.run(4);assert.equal(column.hits.length,3);
 assert.equal(column.e.mem.regularFormVisual,null);
 const blocked=fixture(ids[0],[[10,9]]);blocked.e.blockedBy=blocked.targets[0];blocked.run(8);assert.equal(blocked.hits.length,0);
 assert.deepEqual([off,column,blocked].flatMap(h=>h.b.errors),[]);
});

test('silence or stun before the release cancels the burst and keeps the spent cooldown',()=>{
 for(const status of ['silence','stun']){
  const h=fixture(ids[0]);h.run(h.p.initial+.5);h.b.applyStatus(h.e,status,{duration:1});h.run(2);
  assert.equal(h.hits.length,0);assert.equal(h.e.profile.noAttack,false);
  h.run(h.p.cooldown+1);assert.equal(h.hits.length,3);assert.deepEqual(h.b.errors,[]);
 }
});

test('a sheltered ally is not selected unless it is Exposed',()=>{
 const sheltered=fixture(ids[0]);sheltered.b.addBuff(sheltered.targets[0],{key:STRAIGHT_SHOT_MARKS.shelter});sheltered.run(8);
 assert.equal(sheltered.hits.length,0);
 const exposed=fixture(ids[0]);for(const key of [STRAIGHT_SHOT_MARKS.shelter,STRAIGHT_SHOT_MARKS.exposed])exposed.b.addBuff(exposed.targets[0],{key});
 exposed.run(4);assert.equal(exposed.hits.length,3);
 assert.deepEqual([sheltered,exposed].flatMap(h=>h.b.errors),[]);
});
