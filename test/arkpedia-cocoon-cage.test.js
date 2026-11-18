// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {summonCocoon,cocoonCount,hasCocoon} from '../server/sim/content/arkpedia-enemy-cocoon-cage.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {cocoonCageNative} from '../shared/arkpedia/enemy-cocoon-cage-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_1432_lrccon',entry=ENEMY_RECORDS.enemies[id],record=entry.levels[0];
const PREFAB='dyn/battle/prefabs/enemies/enemy_1432_lrccon.prefab';
const LOCK='enemy_lrccon[lock_core]';

/** Operators (block 0) at [row, col]; the field has no other enemy. */
function fixture(positions){
 const op=chessRec({id:'cage_target',stats:{maxHp:1e7,atk:100,def:0,res:0,blockCnt:1}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:11,col:1+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();ops.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];u.tileR=positions[i][0];u.tileC=positions[i][1];});
 return {...h,ops,run:s=>{h.run(s);assert.equal(b.finished,false,'the fixture battle must still run');}};
}
const locked=u=>u.buffs.some(x=>x.key===LOCK);

test('the Cocoon Cage is admitted only with its complete native tree',()=>{
 assert.ok(enemySupport(entry,clocks.prefabs,native).policy);
 const n=nativeComponents(native,id);
 assert.equal(cocoonCageNative(record,n),true);
 assert.equal(cocoonCageNative({...record,stats:{...record.stats,maxHp:4000}},n),false);
 assert.equal(cocoonCageNative({...record,notCountInTotal:false},n),false);
 const edited=structuredClone(native);
 for(const row of edited.prefabs[PREFAB]){const d=JSON.parse(row.originalJson);for(const x of d._buffs??[])if(x.buffKey==='enemy_lrccon[lock]')x.triggerLifeType=0;row.originalJson=JSON.stringify(d);}
 assert.equal(cocoonCageNative(record,nativeComponents(edited,id)),false,'lock poll');
});

test('a cage locks the operator on its tile and is invincible only while it holds nobody',()=>{
 const h=fixture([[10,5],[10,6]]),{b,ops}=h,[held,free]=ops;
 const cage=summonCocoon(b,10,5);assert.ok(cage);
 assert.equal(summonCocoon(b,10,5),null,'one cage per tile');assert.equal(cocoonCount(b),1);
 h.run(.05);
 assert.ok(locked(held));assert.ok(!locked(free));
 for(const f of ['stun','disarm','skillNotActivatable','noRetreat','noBlock','invulnerable'])assert.ok(held.s.flags[f],f);
 assert.ok(!cage.s.flags.invulnerable,'holding an operator, it can be attacked');assert.equal(cage.hp,cage.s.maxHp-1,'and loses 1 HP at full');
 assert.equal(cage.profile.noAttack,true);assert.ok(cage.s.flags.noMove);
 const empty=summonCocoon(b,11,8);h.run(.4);assert.ok(empty.s.flags.invulnerable,'an empty cage is invincible');
 b.dealDamage(null,cage,{amount:999,type:'true',sourceless:true});assert.equal(cage.hp,cage.s.maxHp-1,'sourceless damage is cancelled');
 b.dealDamage(free,cage,{amount:999,type:'true'});assert.equal(cage.hp,cage.s.maxHp-1000);
 assert.deepEqual(b.errors,[]);
});

test('a defeated cage moves to the defeating unit\'s tile, or stays when its source is gone; the lock ends',()=>{
 const h=fixture([[10,5],[10,6],[12,3]]),{b,ops}=h,[held,killer,other]=ops;
 const cage=summonCocoon(b,10,5);h.run(.05);assert.ok(locked(held));
 b.kill(cage,killer);
 assert.ok(!locked(held),'the lock ends with the cage');assert.ok(!held.s.flags.noRetreat);
 assert.ok(hasCocoon(b,10,6),'the cage moved under its defeater');assert.ok(!hasCocoon(b,10,5));assert.equal(cocoonCount(b),1);
 h.run(.4);assert.ok(locked(killer));
 // A sourceless knock-out leaves it where it was.
 const moved=b.enemies.find(e=>e.alive&&e.defId===id);b.kill(moved);
 assert.ok(hasCocoon(b,10,6));assert.equal(cocoonCount(b),1);
 // The defeater's tile already caged: no new cage there.
 const second=summonCocoon(b,12,3);h.run(.4);assert.ok(locked(other));
 const third=summonCocoon(b,9,4);b.kill(third,other);
 assert.equal(cocoonCount(b),2,'the defeater already sits in a cage');assert.ok(second.alive);
 assert.deepEqual(b.errors,[]);
});
