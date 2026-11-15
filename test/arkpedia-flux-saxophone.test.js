// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {fireFluxSaxophone} from '../server/sim/content/arkpedia-enemy-flux-saxophone.js';
import {StageMagicCircuit} from '../server/sim/content/arkpedia-stage-magic-circuit.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {FLUX_SAXOPHONE_FEATURES,fluxSaxophoneNative} from '../shared/arkpedia/enemy-flux-saxophone-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
import {segmentRectangleEntry} from '../server/sim/projectile-collision.js';
const ids=['enemy_1243_ltswar','enemy_1243_ltswar_2'];
function fixture(id=ids[0],positions=[[10,9],[10,11],[10,3],[12,6],[8,6],[11,7]],beam=false) {
 const record=ENEMY_RECORDS.enemies[id].levels[0],p=FLUX_SAXOPHONE_FEATURES['skill:FourDirAttack'].ability.params(record);
 const op=chessRec({id:'saxophone_target',stats:{maxHp:100000,atk:0,def:0,blockCnt:0},skill:{spType:'INCREASE_WHEN_TAKEN_DAMAGE',spCost:100}});
 const device={key:'trap_062_magicstart',name:"'Tuba'",hidden:false,kind:'device',row:9,col:8,instance:{level:1,skillLevel:1,direction:'UP'}};
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:3+i,dir:'RIGHT'})),setup:b=>{
   installEnemyFeatures(b);b.stageMagicCircuit=new StageMagicCircuit(b,beam?[device]:[],{rows:19,cols:21});
  }});
 const b=h.b;b.start();const targets=h.allies();targets.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[10,6]});b.addBuff(e,{key:'testHold',flags:{noMove:true}});
 const hits=[];b.on('hit',c=>{if(c.source===e&&c.dmg.tags.includes('fluxSaxophone'))hits.push({target:c.target,time:b.time,amount:c.dmg.amount,way:c.dmg.applyWay});});
 return {...h,e,targets,hits,p,record,fire:()=>fireFluxSaxophone(b,e,p)};
}

test('Saxophonists require their native cast, projectile and exact original event clocks',()=>{
 for(const id of ids)assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
 const r=ENEMY_RECORDS.enemies[ids[0]].levels[0];
 assert.equal(fluxSaxophoneNative({...r,skills:[{...r.skills[0],bb:{atk_scale:2}}]},nativeComponents(native,ids[0])),false);
 const changed=structuredClone(native),row=changed.projectiles.projectile_enemy_ltswar.find(c=>'_delayStop'in JSON.parse(c.originalJson));
 row.originalJson=JSON.stringify({...JSON.parse(row.originalJson),_delayStop:0});
 assert.equal(fluxSaxophoneNative(r,nativeComponents(changed,ids[0])),false);
});
test('four cardinal shots hit only the first eligible body in each lane, giving normal defensive SP',()=>{
 for(const id of ids){const h=fixture(id);h.fire();assert.equal(h.b.projectiles.list.length,4);h.run(1);
  assert.deepEqual(h.hits.map(x=>x.target.id).sort(),[0,2,3,4].map(i=>h.targets[i].id).sort());
  assert.ok(h.hits.every(x=>x.amount===h.record.stats.atk*1.5&&x.way==='ranged'));
  for(const i of [0,2,3,4])assert.equal(h.targets[i].skill.sp,1);
  assert.equal(h.targets[1].skill.sp,0);assert.equal(h.targets[5].skill.sp,0);assert.deepEqual(h.b.errors,[]);
 }
});
test('camouflage is respected and already released shots survive source death',()=>{
 const h=fixture(ids[0],[[10,9],[10,11]]);h.b.addBuff(h.targets[0],{key:'hide',flags:{camou:true}});
 h.fire();h.b.kill(h.e);h.run(1);assert.deepEqual(h.hits.map(x=>x.target),[h.targets[1]]);assert.equal(h.hits[0].amount,h.record.stats.atk*1.5);
 assert.deepEqual(h.b.errors,[]);
});
test('a crossed Flux tile schedules delayed removal and protects units beyond it',()=>{
 const h=fixture(ids[0],[[10,10]],true);h.fire();h.run(.2);
 const shot=h.b.projectiles.list.find(p=>p.data?.fluxSaxophone&&p.tx>p.fromX);
 assert.ok(shot);assert.ok(shot.data.fluxStopAt>shot.age,JSON.stringify({age:shot.age,stop:shot.data.fluxStopAt,x:shot.x,y:shot.y,field:[...h.b.stageMagicCircuit.field.occupied.keys()]}));assert.ok(Math.abs(shot.data.fluxStopAt-(1.5/9+h.p.stopDelay))<1e-6);
 h.run(.1);assert.equal(h.b.projectiles.list.some(p=>p===shot),false);h.run(1);assert.equal(h.hits.length,0);
 const changed=fixture(ids[0],[[10,10]],true);changed.fire();
 [...changed.b.stageMagicCircuit.entries.values()][0].unit.dir='DOWN';changed.run(1);assert.equal(changed.hits.length,1);
 assert.deepEqual(h.b.errors,[]);assert.deepEqual(changed.b.errors,[]);
});
test('charge uses the original Begin/Loop/End sequence and independent cooldown without requiring targets',()=>{
 const h=fixture(ids[0],[]);h.run(10.15);assert.equal(h.e.mem.regularFormVisual.clip,'Skill_Begin');
 h.run(.5);assert.equal(h.e.mem.regularFormVisual.clip,'Skill_Loop');h.run(2.5);assert.equal(h.e.mem.regularFormVisual.clip,'Skill_End');
 assert.equal(h.b.projectiles.list.length,0);h.run(.5);assert.ok(h.b.projectiles.list.length>0);
 h.run(2);assert.equal(h.e.profile.noAttack,false);assert.equal(h.e.mem.regularFormVisual,null);assert.deepEqual(h.b.errors,[]);
});
test('silence or stun interrupts an unreleased charge and retains its spent cooldown',()=>{
 for(const status of ['stun','silence']){const h=fixture(ids[0],[[10,9]]);h.run(11);h.b.applyStatus(h.e,status,{duration:1});h.run(3);
  assert.equal(h.hits.length,0);assert.equal(h.e.profile.noAttack,false);h.run(20);assert.equal(h.hits.length,1);assert.deepEqual(h.b.errors,[]);
 }
});
test('tile intersection handles reverse travel, parallel misses and starting inside',()=>{
 const box={minX:3.5,maxX:4.5,minY:2.5,maxY:3.5};
 assert.equal(segmentRectangleEntry({x:2,y:3},{x:5,y:3},box),.5);
 assert.equal(segmentRectangleEntry({x:6,y:3},{x:3,y:3},box),.5);
 assert.equal(segmentRectangleEntry({x:4,y:3},{x:4,y:4},box),0);
 assert.equal(segmentRectangleEntry({x:2,y:2},{x:5,y:2},box),null);
});
