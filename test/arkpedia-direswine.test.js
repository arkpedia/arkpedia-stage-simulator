// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {direswineNative,direswineParams} from '../shared/arkpedia/enemy-direswine-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const ids=['enemy_1309_mhboar','enemy_1309_mhboar_2'];
const near=(a,b,eps=1e-3)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
// A long loop keeps the boar walking under its own power for the whole test.
const LOOP={start:[10,1],end:[10,1],checkpoints:[[1,1],[1,10],[10,10],[1,1],[1,10],[10,10],[1,1],[1,10],[10,10]]};

function fixture(id=ids[0],{positions=[[1,10]],route=LOOP}={}){
 const record=ENEMY_RECORDS.enemies[id].levels[0],p=direswineParams(record);
 const op=chessRec({id:'direswine_target',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:3+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const targets=h.allies();targets.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:route.start,route});
 const hits=[];b.on('hit',c=>{if(c.source===e)hits.push({target:c.target,amount:c.dmg.amount,tags:c.dmg.tags??[],speed:e.s.moveSpeed,time:b.time});});
 return {...h,e,targets,hits,p,record};
}

test('both Direswines are admitted only with the complete rush, first attack, crash and templates',()=>{
 for(const id of ids){
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
  assert.equal(direswineNative(ENEMY_RECORDS.enemies[id].levels[0],nativeComponents(native,id)),true,id);
 }
 const r=ENEMY_RECORDS.enemies[ids[0]].levels[0];
 const changed=structuredClone(native);changed.templates['enemy_mhboar_t_listener[e]'].eventToActions.ON_BUFF_TRIGGER.splice(2,1);
 assert.equal(direswineNative(r,nativeComponents(changed,ids[0])),false);
 const collider=structuredClone(native);for(const row of collider.prefabs['dyn/battle/prefabs/enemies/enemy_1309_mhboar.prefab']){
  const d=JSON.parse(row.originalJson);if('m_Radius'in d){d.m_Radius=1;row.originalJson=JSON.stringify(d);}}
 assert.equal(direswineNative(r,nativeComponents(collider,ids[0])),false);
});

test('after the predelay, each rush trigger adds a stack until the trigger budget is spent',()=>{
 for(const id of ids){
  const h=fixture(id,{positions:[[5,20]]}),{p,e}=h,base=h.record.stats.moveSpeed;
  h.run(p.predelay-.2);near(e.s.moveSpeed,base);
  // Triggers come every interval from the rush's start; those inside the predelay use up the budget.
  const stacks=Array.from({length:p.limit},(_,i)=>(i+1)*p.interval).filter(t=>t>p.predelay+.1+1e-6).length;
  h.run(p.limit*p.interval+1);near(e.s.moveSpeed,base*(1+p.increase*stacks),.02);
  assert.deepEqual(h.b.errors,[]);
 }
});

test('stun ends the rush; a fresh rush starts with a new predelay',()=>{
 const h=fixture(ids[0],{positions:[[5,20]]}),{p,e}=h,base=h.record.stats.moveSpeed;
 h.run(p.predelay+2);assert.ok(e.s.moveSpeed>base);
 h.b.applyStatus(e,'stun',{duration:.5});h.run(.2);near(e.s.moveSpeed,base);
 h.run(.5+p.predelay-.5);near(e.s.moveSpeed,base);
 h.run(1.5);assert.ok(e.s.moveSpeed>base);assert.deepEqual(h.b.errors,[]);
});

test('the first blocked attack adds a Movement Speed packet and spends the rush',()=>{
 const h=fixture(ids[0],{positions:[[5,20]]}),{p,e}=h,base=h.record.stats.moveSpeed;
 h.run(p.predelay+2);const fast=e.s.moveSpeed;assert.ok(fast>base);
 e.blockedBy=h.targets[0];h.targets[0].blocking=[e];h.run(1.5);
 const first=h.hits.find(x=>x.tags.includes('direswineFirst'));
 // The hit is recorded after the rush ended, so compare with the speed held before the block.
 assert.ok(first,'first-attack packet');assert.ok(first.amount>base*p.firstScale);near(first.amount,fast*p.firstScale,fast*p.firstScale*.35);
 near(e.s.moveSpeed,base);assert.equal(h.hits.filter(x=>x.tags.includes('direswineFirst')).length,1);
 assert.deepEqual(h.b.errors,[]);
});

test('touching an ally while moving deals Movement Speed x crash damage once per contact',()=>{
 // The route turns along row 9; this operator stands on it.
 const h=fixture(ids[0],{positions:[[9,3]]}),{p}=h;
 h.run(12);
 const crash=h.hits.filter(x=>x.tags.includes('direswineCrash'));
 assert.equal(crash.length,1);near(crash[0].amount,crash[0].speed*p.crashScale,1e-6);
 assert.deepEqual(h.b.errors,[]);
});
