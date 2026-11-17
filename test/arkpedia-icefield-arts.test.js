// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {RegularDisplacement} from '../server/sim/regular-displacement.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {icefieldArtsNative,icefieldBlastParams} from '../shared/arkpedia/enemy-icefield-arts-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const ids=['enemy_1191_krgrg','enemy_1191_krgrg_2'];

/** The blaster at row 9, col 5; operators at [row, col]; one more enemy (a plain slime) at `other`. */
function fixture(id=ids[0],{positions=[[9,6]],other=[9,4]}={}){
 const record=ENEMY_RECORDS.enemies[id].levels[0];
 const op=chessRec({id:'icefield_target',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record,enemy_1007_slime:ENEMY_RECORDS.enemies.enemy_1007_slime.levels[0]}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:3+i,dir:'RIGHT'})),setup:b=>{b.regularDisplacement=new RegularDisplacement(b);installEnemyFeatures(b);}});
 const b=h.b;b.start();const targets=h.allies();targets.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[9,5],route:0}),slime=b.spawnEnemy('enemy_1007_slime',{pos:other,route:0});
 for(const u of [e,slime])b.addBuff(u,{key:'hold',flags:{disarm:true,noMove:true}});
 // A sturdy neighbour, so the blast's Cold is visible on a survivor.
 slime.base.maxHp=slime.s.maxHp=slime.hp=1e6;
 const blasts=[];b.on('hit',c=>{if(c.source===e&&c.dmg.tags?.includes('deathBlast'))blasts.push({target:c.target,amount:c.dmg.amount,type:c.dmg.type});});
 return {...h,e,slime,targets,blasts,record,p:icefieldBlastParams(record)};
}

test('both Icefield Arts records are admitted only with the complete blast, bleed and templates',()=>{
 for(const id of ids){
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
  assert.equal(icefieldArtsNative(ENEMY_RECORDS.enemies[id].levels[0],nativeComponents(native,id)),true,id);
 }
 const r=ENEMY_RECORDS.enemies[ids[0]].levels[0];
 assert.equal(icefieldArtsNative({...r,talents:{...r.talents,bb:{...r.talents.bb,'boom.cold':3}}},nativeComponents(native,ids[0])),false);
 const changed=structuredClone(native);changed.templates.enemy_krgrg_boom.eventToActions.ON_BUFF_START[0]._succeedNodes[0]._buffKey='e2c_frozen';
 assert.equal(icefieldArtsNative(r,nativeComponents(changed,ids[0])),false);
 const radius=structuredClone(native);for(const row of radius.projectiles.projectile_enemy_krgrg){const d=JSON.parse(row.originalJson);if('m_Radius'in d){d.m_Radius=2;row.originalJson=JSON.stringify(d);}}
 assert.equal(icefieldArtsNative(r,nativeComponents(radius,ids[0])),false);
});

test('when killed, the blast hits ground units of both sides within 1.65 with Arts damage and Cold',()=>{
 for(const id of ids){
  const h=fixture(id,{positions:[[9,6],[9,7.5]]}),{p}=h;
  assert.equal(p.cold,5);
  h.b.kill(h.e,h.targets[0]);
  const hit=new Set(h.blasts.map(x=>x.target));
  assert.deepEqual([hit.has(h.targets[0]),hit.has(h.targets[1]),hit.has(h.slime)],[true,false,true]);
  assert.ok(h.blasts.every(x=>x.type==='arts'&&Math.abs(x.amount-h.record.stats.atk*p.scale)<1e-6));
  assert.equal(h.targets[0].s.flags.cold,true);assert.equal(h.slime.s.flags.cold,true);assert.ok(!h.targets[1].s.flags.cold);
  assert.deepEqual(h.b.errors,[]);
 }
});

test('no blast while silenced, nor when it leaves instead of dying',()=>{
 const silenced=fixture();silenced.b.applyStatus(silenced.e,'silence',{duration:10});silenced.b.kill(silenced.e,silenced.targets[0]);
 assert.equal(silenced.blasts.length,0);
 const left=fixture();left.b.leak(left.e);assert.equal(left.blasts.length,0);
 assert.deepEqual([silenced,left].flatMap(h=>h.b.errors),[]);
});

test('shifting it costs fixed periodic HP on the shared bleed clock',()=>{
 for(const id of ids){
  const h=fixture(id),{e,record}=h,hp=e.hp,each=record.talents.bb['unbalanced_bleed.damage'];
  h.b.push(e,1,{dir:{x:1,y:0},effect:true});h.run(1.2);
  assert.ok(e.hp<hp,'took bleed damage while unbalanced');assert.equal((hp-e.hp)%each,0);
  assert.deepEqual(h.b.errors,[]);
 }
});
