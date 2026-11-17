// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {dylnppNative,dylnppBurstParams} from '../shared/arkpedia/enemy-dylnpp-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_2125_dylnpp';

/** dylnpp held at row 10, col 6; operators placed at [row, col]. */
function fixture(positions=[[10,8]],level=0){
 const record=ENEMY_RECORDS.enemies[id].levels[level];
 const op=chessRec({id:'dylnpp_target',stats:{maxHp:1e6,atk:100,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:3+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const targets=h.allies();targets.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[10,6]});b.addBuff(e,{key:'testHold',flags:{noMove:true}});
 const bursts=[];b.on('hit',c=>{if(c.source===e&&c.dmg.tags?.includes('damageCountBurst'))bursts.push({target:c.target,amount:c.dmg.amount,type:c.dmg.type});});
 const hit=(times,dmg={})=>{for(let i=0;i<times;i++)b.dealDamage(targets[0],e,{amount:10,type:'true',...dmg});};
 return {...h,e,targets,bursts,hit,record,p:dylnppBurstParams(record)};
}

test('all three levels are admitted from the pinned CN fallback templates only',()=>{
 for(const level of Object.values(ENEMY_RECORDS.enemies[id].levels))assert.equal(dylnppNative(level,nativeComponents(native,id)),true,`level ${level.level}`);
 assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy);
 for(const key of ['enemy_dylnpp_fly','enemy_dylnpp_t','enemy_dylnpp_t[damage]'])assert.ok(native.cnTemplateKeys.includes(key),key);
 assert.equal(native.source.cnTemplates.commit,native.source.ranges.commit);
 const r=ENEMY_RECORDS.enemies[id].levels[0];
 assert.equal(dylnppNative({...r,talents:{...r.talents,bb:{...r.talents.bb,'CircleDamage.take_damage_cnt':10}}},nativeComponents(native,id)),false);
 const changed=structuredClone(native);changed.templates['enemy_dylnpp_t[damage]'].eventToActions.ON_BUFF_START[0]._damageType='PHYSICAL';
 assert.equal(dylnppNative(r,nativeComponents(changed,id)),false);
});

test('it hovers until a disabling control grounds it with a half-second stun',()=>{
 const h=fixture();h.run(.5);assert.equal(h.e.isFlying,true);
 h.b.applyStatus(h.e,'stun',{duration:.2});h.run(.1);
 assert.equal(h.e.isFlying,false);assert.equal(h.e.mem.regularFormVisual?.move,'Move_2');
 h.run(1);assert.equal(h.e.isFlying,false);assert.deepEqual(h.b.errors,[]);
});

test('every 15th counted hit bursts on allies within 3.5 that are not already stunned',()=>{
 const h=fixture([[10,8],[10,9.5],[13,6],[10,11]]),{p}=h;
 assert.deepEqual([p.count,p.radius,p.scale,p.stun],[15,3.5,3,15]);
 h.b.applyStatus(h.targets[2],'stun',{duration:30});
 h.hit(14);assert.equal(h.bursts.length,0);
 h.hit(1);
 // In range: 2 and 3.5 away; already stunned: 3 away; out of range: 5 away.
 assert.deepEqual(h.targets.map(u=>h.bursts.some(x=>x.target===u)),[true,true,false,false]);
 assert.ok(h.bursts.every(x=>x.type==='arts'&&Math.abs(x.amount-3*h.record.stats.atk)<1e-6));
 assert.ok(h.targets[0].s.flags.stun);h.run(14.5);assert.ok(h.targets[0].s.flags.stun);h.run(1);assert.ok(!h.targets[0].s.flags.stun);
 h.hit(14);assert.equal(h.bursts.length,2);h.hit(1);assert.equal(h.bursts.length,4);
 assert.deepEqual(h.b.errors,[]);
});

test('hits that give no SP do not count',()=>{
 const h=fixture();h.hit(20,{noSp:true});assert.equal(h.bursts.length,0);
 h.hit(15);assert.equal(h.bursts.length,1);assert.deepEqual(h.b.errors,[]);
});
