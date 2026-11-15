// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { StageMagicCircuit } from '../server/sim/content/arkpedia-stage-magic-circuit.js';
import { magicCircuitDefinition, resonatorNativeReviewed } from '../shared/arkpedia/stage-magic-circuit.js';
import native from '../data/arkpedia-device-native-source.json' with {type:'json'};
const device=(key,name,col)=>({key,name,hidden:false,kind:'device',row:10,col,instance:{level:1,skillLevel:1,direction:'RIGHT'}});
function fixture(two=false){
 const op=chessRec({id:'resonator_target',stats:{atk:0}});
 const devices=[device('trap_062_magicstart',"'Tuba'",3),device('trap_064_magiccircle',"'Resonator'",6)];
 if(two)devices.push(device('trap_064_magiccircle',"'Resonator'",8));
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:100,defs:{chess:{[op.chessId]:op}},units:[{chessId:op.chessId,row:11,col:6}],
  setup:b=>{b.stageMagicCircuit=new StageMagicCircuit(b,devices,{rows:19,cols:21});}});
 h.b.start();const field=h.b.stageMagicCircuit,entries=[...field.entries.values()];
 return {...h,field,source:entries[0],resonator:entries[1],second:entries[2],op:h.allies()[0]};
}
test('Resonators require the original source, charge contract, skill and instance',()=>{
 assert.equal(resonatorNativeReviewed(),true);assert.equal(magicCircuitDefinition({level:30,skillLevel:1},'trap_064_magiccircle').spCost,20);
 assert.throws(()=>magicCircuitDefinition({level:1,skillLevel:2},'trap_064_magiccircle'),/Resonator/);
 const changed=structuredClone(native);changed.templates.trap_magiccircle_t.eventToActions.ON_BUFF_START[0]._isLikeObstacle=false;
 assert.equal(resonatorNativeReviewed(changed),false);
});
test('uncharged Resonator blocks its tile and Flux, retains partial charge off-beam, then frees the tile exactly once',()=>{
 const h=fixture(),{b,field,source,resonator}=h;
 assert.equal(b._occ[10*21+6],resonator.unit);assert.equal(field.coversPosition(10,6),true);assert.equal(field.coversPosition(10,7),false);
 h.run(10);assert.ok(Math.abs(resonator.sp-10)<1e-8);
 source.unit.dir='UP';h.run(5);assert.ok(Math.abs(resonator.sp-10)<1e-8);assert.equal(resonator.state,'uncharged');
 source.unit.dir='RIGHT';h.run(10);assert.equal(resonator.sp,20);assert.equal(resonator.activated,true);assert.equal(resonator.unit.alive,false);
 assert.ok(!b._occ[10*21+6]?.alive);assert.equal(field.coversPosition(10,7),true);h.run(1);assert.equal(resonator.sp,20);
 assert.deepEqual(b.errors,[]);
});
test('newly uncovered Resonators start on the following tick, independently of enumeration order',()=>{
 const h=fixture(true);h.run(20);assert.equal(h.resonator.activated,true);assert.equal(h.second.sp,0);
 h.run(20);assert.equal(h.second.activated,true);assert.deepEqual(h.b.errors,[]);
});
test('activated tiles emit in the deployed operator direction, cease on retreat and survive loss of incoming Flux',()=>{
 const h=fixture(),{b,field,source,op}=h;h.run(20);b._remove(source.unit,'retreat',null,true);
 assert.equal(field.coversPosition(10,6),false);b.retreat(op);op.dir='UP';assert.equal(b.redeploy(op,{tile:[10,6],free:true}),true);
 assert.equal(field.coversPosition(12,6),true);assert.equal(field.coversPosition(10,7),false);
 b.retreat(op);assert.equal(field.coversPosition(12,6),false);assert.deepEqual(b.errors,[]);
});
test('targetable summons with no facing choice emit left; untargetable summons do not emit',()=>{
 const h=fixture(),{b,field,source,op}=h;h.run(20);b._remove(source.unit,'retreat',null,true);
 b.retreat(op);op.kind='token';op.dir='UP';assert.equal(b.redeploy(op,{tile:[10,6],free:true}),true);
 assert.equal(field.coversPosition(10,5),true);assert.equal(field.coversPosition(11,6),false);
 b.addBuff(op,{key:'unselectable',flags:{untargetable:true}});field.refresh();assert.equal(field.coversPosition(10,5),false);
 assert.deepEqual(b.errors,[]);
});
