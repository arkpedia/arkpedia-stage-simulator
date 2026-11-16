// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {novaKnightNative,glimmeringTouchParams} from '../shared/arkpedia/enemy-nova-knight-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const ids=['enemy_1184_cadkgt','enemy_1184_cadkgt_2','enemy_1184_cadkgt_3'];

/** Knight held at row 10, col 6; operators placed at [row, col]. The first operator is the only one in range. */
function fixture(id=ids[0],positions=[[10,8]]){
 const record=ENEMY_RECORDS.enemies[id].levels[0],p=glimmeringTouchParams(record);
 const op=chessRec({id:'knight_target',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:3+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const targets=h.allies();targets.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[10,6]});b.addBuff(e,{key:'testHold',flags:{noMove:true}});
 const hits=[];b.on('hit',c=>{if(c.source===e&&c.dmg.tags?.includes('chargedBurst'))hits.push({target:c.target,time:b.time,amount:c.dmg.amount,type:c.dmg.type});});
 return {...h,e,targets,hits,p,record};
}

test('all three knights are admitted only with the complete channel, burst and passive',()=>{
 for(const id of ids)for(const level of Object.values(ENEMY_RECORDS.enemies[id].levels))
  assert.equal(novaKnightNative(level,nativeComponents(native,id)),true,`${id}/${level.level}`);
 for(const id of ids)assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
 const r=ENEMY_RECORDS.enemies[ids[0]].levels[0];
 assert.equal(novaKnightNative({...r,skills:[{...r.skills[0],bb:{...r.skills[0].bb,duration:5}}]},nativeComponents(native,ids[0])),false);
 const changed=structuredClone(native);changed.ranges['x-1'].grids.pop();
 assert.equal(novaKnightNative(r,nativeComponents(changed,ids[0])),false);
 // Viviana's kill log is part of her contract only.
 assert.equal(novaKnightNative(ENEMY_RECORDS.enemies[ids[2]].levels[0],nativeComponents(native,ids[0])),false);
});

test('a 7 s channel bursts over the diamond around the target at the End event',()=>{
 for(const id of ids){
  // Target 2 tiles right; the diamond holds tiles at most 2 steps (row + column) from it.
  const h=fixture(id,[[10,8],[10,10],[11,9],[12,8],[12,9],[9,9],[9,10]]),{p}=h;
  assert.equal(p.release,Math.fround(20/30)+7+Math.fround(20/30));
  h.run(p.initial+p.release-.05);assert.equal(h.hits.length,0);assert.equal(h.e.mem.regularFormVisual.clip,'Skill_End');
  h.run(.1);
  const hit=new Set(h.hits.map(x=>x.target));
  assert.deepEqual(h.targets.map(u=>hit.has(u)),[true,true,true,true,false,true,false]);
  assert.ok(h.hits.every(x=>x.type==='arts'&&Math.abs(x.amount-h.record.stats.atk*p.scale)<1e-6));
  assert.deepEqual(h.b.errors,[]);
 }
});

test('only ground allies within range are aimed at, and the knight is visible only while charging',()=>{
 const far=fixture(ids[0],[[10,9]]);far.run(30);assert.equal(far.hits.length,0);
 const air=fixture(ids[0],[[10,8]]);air.targets[0].motion='FLY';air.run(30);assert.equal(air.hits.length,0);
 const h=fixture();h.run(1);assert.equal(h.e.s.flags.reveal??false,false);
 h.run(h.p.initial);assert.equal(h.e.s.flags.reveal,true);
 h.run(h.p.release+3);assert.equal(h.e.s.flags.reveal??false,false);
 assert.deepEqual([far,air,h].flatMap(x=>x.b.errors),[]);
});

test('stun before the burst cancels it and keeps the spent cooldown',()=>{
 const h=fixture();h.run(h.p.initial+2);h.b.applyStatus(h.e,'stun',{duration:1});h.run(9);
 assert.equal(h.hits.length,0);assert.equal(h.e.mem.regularFormVisual??null,null);
 h.run(h.p.cooldown);assert.equal(h.hits.length,1);assert.deepEqual(h.b.errors,[]);
});
