// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {saintStatueNative} from '../shared/arkpedia/enemy-saint-statue-features.js';
import {compileEnemyRuntimePlan,withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {makeBattle,chessRec,enemyRec} from './helpers/battleHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
const ids=['enemy_10091_hlsttu','enemy_10091_hlsttu_2'],key='hlsttu_t[shield]';
function fixture(id=ids[0],compiled=true){
 const row=records.enemies[id].levels[0],guard=chessRec({id:'statue_guard',stats:{maxHp:1e6,atk:0,def:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:120,
  defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(row):row,recipient:enemyRec({key:'recipient',hp:1000,speed:0})},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:9,col:4}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[9,6]}),u=h.b.spawnEnemy('recipient',{pos:[9,8]});u.profile.noAttack=true;
 h.b.addBuff(u,{key:'hold',flags:{noMove:true}});return{...h,e,u,g:h.b.allyUnits[0],charge:u=>u.findBuff(key)?.shield??0};
}
test('each statue is composed from three shared data-plan components without a dedicated runtime adapter',()=>{
 for(const id of ids){const plan=compileEnemyRuntimePlan(records.enemies[id].levels[0]);
  assert.deepEqual(plan.entries.filter(e=>e.ability).map(e=>e.ability.kind),['rechargingBarrierAura','passiveEnemyBody','projectileSingleAttack']);
  assert.ok(plan.entries.some(e=>e.id==='native:saintBody'&&e.trait.flags.noMove));
 }
});
for(const id of ids)test(`${id}: immobile non-counting body recharges neighbors, excludes source markers and survives silence/freeze`,()=>{
 for(const compiled of[false,true]){
  const f=fixture(id,compiled),start=[f.e.x,f.e.y],marked=f.b.spawnEnemy('recipient',{pos:[10,7]});
  f.b.addBuff(marked,{key:'enemy_hlslp_self_mark'});f.b.addBuff(marked,{key:'hold',flags:{noMove:true}});
  assert.equal(f.e.counted,false);assert.ok(f.e.findBuff('enemy_hlsttu_self_mark'));
  for(const status of['stun','fear','levitate','disarm','sleep'])assert.equal(f.b.applyStatus(f.e,status,{duration:2}),false);
  assert.equal(f.b.applyStatus(f.e,'silence',{duration:2}),true);assert.equal(f.b.applyStatus(f.e,'freeze',{duration:2}),true);
  f.run(2);assert.equal(f.charge(f.u),40);assert.equal(f.charge(f.e),0);assert.equal(f.charge(marked),0);
  assert.deepEqual([f.e.x,f.e.y],start);f.b.kill(f.e);f.run(2);assert.equal(f.charge(f.u),40);assert.deepEqual(f.b.errors,[]);
 }
});
test('independent statues contribute to one shared capped barrier and cannot recharge each other',()=>{
 const f=fixture(),second=f.b.spawnEnemy(ids[0],{pos:[9,7]});f.run(13);
 assert.equal(f.charge(f.u),500);assert.equal(f.u.buffs.filter(b=>b.key===key).length,1);
 assert.equal(f.charge(f.e),0);assert.equal(f.charge(second),0);assert.deepEqual(f.b.errors,[]);
});
test('statue Arts shots travel to their locked target and retain their released damage after the source dies',()=>{
 const f=fixture(),hits=[];f.b.on('damaged',c=>{if(c.source===f.e&&c.target===f.g)hits.push(c);});
 assert.ok(f.runUntil(()=>f.b.projectiles.list.length===1,1));assert.equal(hits.length,0);f.b.kill(f.e);
 assert.ok(f.runUntil(()=>hits.length===1,1));assert.equal(hits[0].dmg.type,'arts');assert.equal(hits[0].hpLoss,180);assert.deepEqual(f.b.errors,[]);
});
test('native admission rejects selector, cap math, cosmetic gameplay mutations and changed projectile transport',()=>{
 for(const id of ids)assert.equal(saintStatueNative(records.enemies[id].levels[0],nativeComponents(native,id)),true);
 const mutations=[
  n=>n.$template('hlsttu_t[trigger_shield]').eventToActions.ON_BUFF_TRIGGER[0]._targetOptions.ignoreAllyTargetFree=false,
  n=>n.$template('hlsttu_t[to_enemy]').eventToActions.ON_BUFF_START[0]._buffKeys=[],
  n=>n.$template('hlsttu_t[to_enemy]').eventToActions.ON_BUFF_START[9]._maxValueKey=null,
  n=>n.$template('hlsttu_t[shield]').eventToActions.ON_TAKE_DAMAGE[0]._damageMask='ALL',
  n=>n.$template('hlsttu_t[shield]').eventToActions.ON_BUFF_TRIGGER[2]._succeedNodes.push({$type:'Torappu.Battle.Action.Nodes+InstantKill, Assembly-CSharp'}),
  n=>{const root=n[ids[0]][0],mode=n.$ref(root._modes[0]);n.$ref(mode._generalAbilities[0])._buffs[0].attributes.abnormalFlags.push(5);},
 ];
 for(const edit of mutations){const n=nativeComponents(structuredClone(native),ids[0]);edit(n);assert.equal(saintStatueNative(records.enemies[ids[0]].levels[0],n),false);}
 const transport=structuredClone(native),row=transport.projectiles.projectile_enemy_hlsttu.find(row=>'_speed'in JSON.parse(row.originalJson));
 const moved=JSON.parse(row.originalJson);moved._speed=11;row.originalJson=JSON.stringify(moved);
 assert.equal(saintStatueNative(records.enemies[ids[0]].levels[0],nativeComponents(transport,ids[0])),false);
 const changed=structuredClone(records.enemies[ids[0]].levels[0]);changed.talents.bb['CircleShield.shield_max_rate']=1;
 assert.equal(saintStatueNative(changed,nativeComponents(native,ids[0])),false);
});
