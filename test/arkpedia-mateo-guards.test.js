// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {mateoGuardNative,guardShotParams} from '../shared/arkpedia/enemy-mateo-guard-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const ids=['enemy_1409_bdguad','enemy_1409_bdguad_2'];

/** Enemy held at row 10, col 6; operators placed at [row, col]. */
function fixture(id=ids[0],positions=[[10,9]]){
 const record=ENEMY_RECORDS.enemies[id].levels[0],p=guardShotParams(record);
 const op=chessRec({id:'guard_target',stats:{maxHp:100000,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:3+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const targets=h.allies();targets.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[10,6]});b.addBuff(e,{key:'testHold',flags:{noMove:true}});
 const hits=[];b.on('hit',c=>{if(c.source===e&&c.dmg.tags?.includes('straightShot'))hits.push({target:c.target,time:b.time,amount:c.dmg.amount});});
 return {...h,e,targets,hits,p,record};
}

test('both guards are admitted only with the complete native shot, grenade and resistance toggle',()=>{
 for(const id of ids){
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
  assert.equal(mateoGuardNative(ENEMY_RECORDS.enemies[id].levels[0],nativeComponents(native,id)),true,id);
 }
 assert.equal(enemySupport(ENEMY_RECORDS.enemies.enemy_1409_bdguad_3,clocks.prefabs,native).policy,null);
 const r=ENEMY_RECORDS.enemies[ids[0]].levels[0];
 assert.equal(mateoGuardNative({...r,skills:[{...r.skills[0],bb:{...r.skills[0].bb,times:3}}]},nativeComponents(native,ids[0])),false);
 const tamper=(edit,select)=>{const changed=structuredClone(native);for(const row of select(changed)){const d=JSON.parse(row.originalJson);if(edit(d))row.originalJson=JSON.stringify(d);}
  return mateoGuardNative(r,nativeComponents(changed,ids[0]));};
 const rows=c=>c.prefabs['dyn/battle/prefabs/enemies/enemy_1409_bdguad.prefab'],shot=c=>c.projectiles.projectile_enemy_bdguad;
 assert.equal(tamper(d=>'_waitAttackEventForAllAttacks'in d&&(d._waitAttackEventForAllAttacks=0,true),rows),false);
 assert.equal(tamper(d=>'_blockMaxCnt'in d&&(d._blockMaxCnt=1,true),rows),false);
 assert.equal(tamper(d=>'_onlyCheckHitWhenReachTarget'in d&&'_rangeToLoad'in d&&(d._onlyCheckHitWhenReachTarget=0,true),shot),false);
});

test('two grenades leave at the first two attack events and explode on the first body',()=>{
 for(const id of ids){
  const h=fixture(id,[[10,9],[10,10],[11,9],[9,8],[10,12]]),{p}=h;
  assert.deepEqual(p.releases,[56,61].map(f=>Math.fround(f/30)));
  h.run(p.initial+p.releases[0]-.05);assert.equal(h.hits.length,0);assert.equal(h.e.mem.regularFormVisual.clip,'Skill_1');
  h.run(2);
  // Contact is 0.55 short of the first operator; each blast reaches 1.1 plus the 0.25 collider from there:
  // 0.55, 1.14 and 1.10 away are caught, 1.55 and 3.55 away are not.
  const by=u=>h.hits.filter(x=>x.target===u).length;
  assert.deepEqual(h.targets.map(by),[2,0,2,2,0]);
  assert.ok(h.hits.every(x=>Math.abs(x.amount-h.record.stats.atk*.7)<1e-6));
  assert.deepEqual(h.b.errors,[]);
 }
});

test('Physical and Arts damage taken is reduced by 40% only while unblocked',()=>{
 const h=fixture(ids[0],[[3,3]]),src=h.targets[0];
 const taken=(type,blocked)=>{h.e.hp=h.e.s.maxHp;h.e.blockedBy=blocked?src:null;h.b.emit(blocked?'blocked':'unblocked',{enemy:h.e,blocker:src});h.run(.05);
  const before=h.e.hp;h.b.dealDamage(src,h.e,{amount:1000,type});return before-h.e.hp;};
 const arts=[taken('arts',false),taken('arts',true)];
 assert.ok(Math.abs(arts[0]/arts[1]-.6)<1e-6,JSON.stringify(arts));
 const pure=[taken('true',false),taken('true',true)];assert.equal(pure[0],pure[1]);
 assert.deepEqual(h.b.errors,[]);
});
