// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemyStealthed} from '../server/sim/targeting.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {crossbowmanAmbusherNative,ambusherShotParams} from '../shared/arkpedia/enemy-crossbowman-ambusher-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const ids=['enemy_1404_msnip','enemy_1404_msnip_2'];

/** Enemy held at row 10, col 6; operators placed at [row, col]. */
function fixture(id=ids[0],positions=[[10,9]]){
 const record=ENEMY_RECORDS.enemies[id].levels[0],p=ambusherShotParams(record);
 const op=chessRec({id:'ambusher_target',stats:{maxHp:100000,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:3+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const targets=h.allies();targets.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[10,6]});b.addBuff(e,{key:'testHold',flags:{noMove:true}});
 const hits=[];b.on('hit',c=>{if(c.source===e&&c.dmg.tags?.includes('straightShot'))hits.push({target:c.target,time:b.time,amount:c.dmg.amount,type:c.dmg.type});});
 return {...h,e,targets,hits,p,record};
}

test('both Ambushers are admitted only with the complete native shot, channel, stealth and projectile',()=>{
 for(const id of ids){
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
  assert.equal(crossbowmanAmbusherNative(ENEMY_RECORDS.enemies[id].levels[0],nativeComponents(native,id)),true,id);
 }
 const r=ENEMY_RECORDS.enemies[ids[0]].levels[0];
 assert.equal(crossbowmanAmbusherNative({...r,skills:[{...r.skills[0],bb:{...r.skills[0].bb,stun:3}}]},nativeComponents(native,ids[0])),false);
 const tamper=edit=>{const changed=structuredClone(native);for(const row of changed.prefabs['dyn/battle/prefabs/enemies/enemy_1404_msnip.prefab']){
  const d=JSON.parse(row.originalJson);if(edit(d))row.originalJson=JSON.stringify(d);}return crossbowmanAmbusherNative(r,nativeComponents(changed,ids[0]));};
 assert.equal(tamper(d=>'_restoreDelay'in d&&(d._restoreDelay=1,true)),false);
 assert.equal(tamper(d=>'_disableWhenInAttackState'in d&&(d._disableWhenInAttackState=0,true)),false);
 assert.equal(tamper(d=>d._projectileKey==='projectile_enemy_msnip'&&(d._cooldownKey='other',true)),false);
});

test('Begin, a two-second Loop and End deliver one stunning Arts bolt at the End event',()=>{
 for(const id of ids){
  const h=fixture(id),{p}=h;
  assert.equal(p.release,p.phases[0].duration+2+Math.fround(2/30));
  h.run(p.initial+.1);assert.equal(h.e.mem.regularFormVisual.clip,'Skill_Begin');
  h.run(1);assert.equal(h.e.mem.regularFormVisual.clip,'Skill_Loop');assert.equal(h.e.mem.regularFormVisual.loop,true);
  h.run(p.release-1.1-.05);assert.equal(h.hits.length,0);assert.equal(h.e.mem.regularFormVisual.clip,'Skill_End');
  h.run(1);assert.equal(h.hits.length,1);
  assert.equal(h.hits[0].type,'arts');assert.equal(h.hits[0].amount,h.record.stats.atk);
  assert.ok(h.targets[0].s.flags.stun);h.run(4.5);assert.ok(h.targets[0].s.flags.stun);h.run(1);assert.ok(!h.targets[0].s.flags.stun);
  assert.deepEqual(h.b.errors,[]);
 }
});

test('Invisible lifts while the shot is cast and returns three seconds after it ends',()=>{
 const h=fixture(),{p}=h;h.run(.5);assert.equal(enemyStealthed(h.e),true);
 h.run(p.initial);assert.equal(enemyStealthed(h.e),false);
 const end=p.phases.reduce((t,v)=>t+v.duration,0);h.run(end);assert.equal(enemyStealthed(h.e),false);
 h.run(2.3);assert.equal(enemyStealthed(h.e),false);h.run(.5);assert.equal(enemyStealthed(h.e),true);
 assert.deepEqual(h.b.errors,[]);
});

test('no shot while blocked or off the line, and silence cancels an unreleased shot',()=>{
 const blocked=fixture();blocked.e.blockedBy=blocked.targets[0];blocked.run(10);assert.equal(blocked.hits.length,0);
 const off=fixture(ids[0],[[12,9]]);off.run(10);assert.equal(off.hits.length,0);
 const silenced=fixture();silenced.run(silenced.p.initial+1);silenced.b.applyStatus(silenced.e,'silence',{duration:1});silenced.run(4);
 assert.equal(silenced.hits.length,0);assert.equal(silenced.e.profile.noAttack,false);
 assert.deepEqual([blocked,off,silenced].flatMap(h=>h.b.errors),[]);
});
