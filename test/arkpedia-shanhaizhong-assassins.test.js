// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {shanhaizhongAssassinNative,INVISIBLE_STRIKE_KEYS} from '../shared/arkpedia/enemy-shanhaizhong-assassin-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const ids=['enemy_1299_ymkilr','enemy_1299_ymkilr_2'];

/** An assassin held beside one zero-DEF operator; blocking is driven by the test. */
function fixture(id=ids[0]){
 const record=ENEMY_RECORDS.enemies[id].levels[0];
 const op=chessRec({id:'assassin_target',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:1}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record}},
  units:[{chessId:op.chessId,row:10,col:9,dir:'LEFT'}],setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const [u]=h.allies();
 const e=b.spawnEnemy(id,{pos:[10,6]});b.addBuff(e,{key:'testHold',flags:{noMove:true}});
 // Attack amounts after the source's own scaling, before the recipient's mitigation.
 const hits=[];b.on('hit',c=>{if(c.source===e&&c.target===u&&c.dmg.isAttack)hits.push(c.dmg.amount);});
 const block=()=>{e.blockedBy=u;u.blocking=[...(u.blocking??[]),e];};
 const unblock=()=>b._unblock(e);
 const take=()=>hits.splice(0);
 return {...h,e,u,record,block,unblock,take};
}

test('both assassins are admitted only with the complete marked attack, toggle and template',()=>{
 for(const id of ids){
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
  assert.equal(shanhaizhongAssassinNative(ENEMY_RECORDS.enemies[id].levels[0],nativeComponents(native,id)),true,id);
 }
 const r=ENEMY_RECORDS.enemies[ids[0]].levels[0];
 assert.equal(shanhaizhongAssassinNative({...r,skills:[{...r.skills[0],bb:{atk_scale:3}}]},nativeComponents(native,ids[0])),false);
 const changed=structuredClone(native);changed.templates.enemy_ymkilr_t_invisible.eventToActions.ON_BUFF_TRIGGER.splice(0,2);
 assert.equal(shanhaizhongAssassinNative(r,nativeComponents(changed,ids[0])),false);
 const toggled=structuredClone(native);for(const row of toggled.prefabs['dyn/battle/prefabs/enemies/enemy_1299_ymkilr.prefab']){
  const d=JSON.parse(row.originalJson);if('_restoreDelay'in d){d._restoreDelay=1;row.originalJson=JSON.stringify(d);}}
 assert.equal(shanhaizhongAssassinNative(r,nativeComponents(toggled,ids[0])),false);
});

test('the first attack after invisibility deals double damage; a new invisibility re-arms it',()=>{
 for(const id of ids){
  const h=fixture(id),{e,record}=h,atk=record.stats.atk;
  h.run(.5);assert.ok(e.findBuff(INVISIBLE_STRIKE_KEYS.markKey),'marked while invisible');
  h.block();h.run(2*record.stats.bat);assert.deepEqual(h.take(),[2*atk,atk]);
  assert.ok(!e.findBuff(INVISIBLE_STRIKE_KEYS.markKey));assert.ok(e.findBuff(INVISIBLE_STRIKE_KEYS.spentKey));
  // Unblocked, invisibility returns after its 3 s restore and leaves a fresh mark.
  h.unblock();h.run(2.5);assert.ok(!e.findBuff(INVISIBLE_STRIKE_KEYS.markKey));
  h.run(1);assert.ok(e.findBuff(INVISIBLE_STRIKE_KEYS.markKey));assert.ok(!e.findBuff(INVISIBLE_STRIKE_KEYS.spentKey));
  h.block();h.run(2*record.stats.bat);assert.deepEqual(h.take(),[2*atk,atk]);
  assert.deepEqual(h.b.errors,[]);
 }
});

test('invisibility (and its mark) returns while an anti-invisibility reveal is active',()=>{
 const h=fixture(),{e,record}=h;
 h.run(.5);h.block();h.run(2);assert.deepEqual(h.take(),[2*record.stats.atk]);
 h.unblock();h.b.addBuff(e,{key:'reveal',flags:{reveal:true}});h.run(4);
 h.b.removeBuff(e,'reveal');h.run(.5);
 assert.ok(e.findBuff(INVISIBLE_STRIKE_KEYS.markKey),'invisibility had returned under the reveal, so the mark was granted');
 assert.deepEqual(h.b.errors,[]);
});
