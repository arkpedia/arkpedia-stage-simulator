// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {animatedMeleeAttack} from '../server/sim/content/arkpedia-enemy-melee-sequence.js';
import {installFeatureDispatch,attach} from '../server/sim/content/arkpedia-enemy-ability-runtime.js';
import {makeBattle,chessRec,enemyRec} from './helpers/battleHarness.js';
const animation={clip:'Attack',duration:1,releases:[.4]};
function fixture(maxScale,type='arts',bat=2){
 const g=chessRec({id:'scale_guard',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:5},skill:null}),r=enemyRec({key:'scale_enemy',atk:100,bat});
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{scale_enemy:r},chess:{[g.chessId]:g}},units:[{chessId:g.chessId,row:10,col:6}],kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installFeatureDispatch});h.b.start();const e=h.b.spawnEnemy('scale_enemy',{pos:[10,6]});
 attach(h.b,e,[animatedMeleeAttack({animation:{...animation,...(maxScale===undefined?{}:{maxScale})},type})]);h.b.addBuff(e,{key:'hold',flags:{noMove:true}});const attacks=[],hits=[];
 h.b.on('attack',c=>{if(c.attacker===e)attacks.push({time:h.b.time,speed:e.mem.regularFormVisual.speed});});h.b.on('damaged',c=>{if(c.source===e)hits.push({time:h.b.time,type:c.dmg.type,loss:c.hpLoss});});return{...h,e,attacks,hits};
}
test('uncapped FROM_ATTACK_SPEED stretches both authored release and completion budget',()=>{
 const h=fixture(-1);assert.ok(h.runUntil(()=>h.hits.length===1,2));assert.ok(Math.abs(h.hits[0].time-h.attacks[0].time-.8)<h.b.dt*1.2);assert.equal(h.attacks[0].speed,.5);assert.equal(h.hits[0].type,'arts');assert.equal(h.hits[0].loss,100);assert.ok(h.e.mem.regularFormVisual);h.run(.5);assert.ok(h.e.mem.regularFormVisual);h.run(.8);assert.deepEqual(h.b.errors,[]);
});
test('existing plans retain their authored clock; a finite cap permits only the configured stretch',()=>{
 for(const maxScale of[undefined,1,1.1]){const h=fixture(maxScale,'phys');assert.ok(h.runUntil(()=>h.hits.length===1,1));const stretch=maxScale===1.1?1.1:1;assert.ok(Math.abs(h.hits[0].time-h.attacks[0].time-.4*stretch)<h.b.dt*1.2);assert.equal(h.hits[0].type,'phys');assert.deepEqual(h.b.errors,[]);}
});
test('faster attack intervals compress authored events; the cached running clip does not stretch again after ASPD changes',()=>{
 const fast=fixture(-1,'true',.5);assert.ok(fast.runUntil(()=>fast.hits.length===1,1));assert.ok(Math.abs(fast.hits[0].time-fast.attacks[0].time-.2)<fast.b.dt*1.2);assert.equal(fast.attacks[0].speed,2);assert.equal(fast.hits[0].type,'true');
 const h=fixture(-1);assert.ok(h.runUntil(()=>h.attacks.length===1,.2));h.run(.2);h.b.addBuff(h.e,{key:'faster',mods:{aspd:100}});assert.ok(h.runUntil(()=>h.hits.length===1,1));assert.ok(Math.abs(h.hits[0].time-h.attacks[0].time-.8)<h.b.dt*1.2);assert.deepEqual(h.b.errors,[]);
});
test('invalid scale caps and melee packet types fail parameter preflight',()=>{
 for(const maxScale of[0,-2,NaN,Infinity,129])assert.throws(()=>animatedMeleeAttack.validate({animation:{...animation,maxScale}}),/Invalid enemy attack animation/);
 assert.throws(()=>animatedMeleeAttack.validate({animation,type:'healing'}),/Invalid animated melee damage type/);
});
