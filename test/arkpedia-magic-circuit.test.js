// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { traceMagicCircuits, magicCircuitNativeReviewed, magicCircuitDefinition } from '../shared/arkpedia/stage-magic-circuit.js';
import { environmentNativeReviewed } from '../shared/arkpedia/stage-environments.js';
import { StageMagicCircuit } from '../server/sim/content/arkpedia-stage-magic-circuit.js';
import { installStageEnvironments } from '../server/sim/content/arkpedia-stage-environments.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import native from '../data/arkpedia-device-native-source.json' with {type:'json'};
import summonEvidence from '../data/arkpedia-summon-prefabs.json' with { type: 'json' };
import { SUMMON_SPECIFIES_DIRECTION } from '../shared/arkpedia/summon-build-conditions.js';
test('compact summon facing data matches every original build condition', () => {
 assert.deepEqual(SUMMON_SPECIFIES_DIRECTION, Object.fromEntries(Object.entries(summonEvidence.tokens)
  .map(([id, token]) => [id, token.character.find(c => c._buildCondition)?._buildCondition.needSpecifyDirection === 1])));
});
const a={id:'a',row:1,col:0,direction:'RIGHT'},z={id:'z',row:0,col:4,direction:'UP'};
const trace=(old,sources,redirectors=new Map())=>traceMagicCircuits(old,sources,redirectors,7,7);
const has=(f,r,c,id)=>assert.equal(f.occupied.get(`${r},${c}`),id);
test('native Tuba registration and SP environment require reviewed source contracts',()=>{
 assert.equal(magicCircuitNativeReviewed(),true);assert.equal(environmentNativeReviewed('character_in_magiccircuit_env'),true);
 assert.equal(magicCircuitDefinition({level:1,skillLevel:1,direction:'RIGHT'}).hp,100);
 const e=structuredClone(native);e.prefabs.trap_062_magicstart.components.find(c=>'_withdrawable' in c.data).data._withdrawable=1;
 assert.equal(magicCircuitNativeReviewed(e),false);
 assert.throws(()=>magicCircuitDefinition({level:1,skillLevel:2,direction:'RIGHT'}),/Tuba/);
});
test('beams redirect, stop at existing intersections, preserve order and terminate self loops',()=>{
 let f=trace(null,[a,z]);has(f,1,4,'a');has(f,0,4,'z');has(f,2,4,undefined);
 f=trace(f,[z,a]);has(f,1,4,'a'); // source enumeration cannot change an existing claim
 f=trace(f,[z]);has(f,6,4,'z');assert.equal(f.routes.has('a'),false);
 const dirs=new Map([['1,2','UP'],['3,2','LEFT'],['3,0','DOWN']]);f=trace(null,[a],dirs);
 assert.equal(f.routes.get('a').path.length,8);has(f,2,0,'a');has(f,0,0,undefined);
});
test('a changed early beam cannot overwrite a later beam that already occupies its new crossing',()=>{
 const lower={...a,row:0},vertical={...z,row:1};
 let f=trace(null,[lower,vertical]);has(f,3,4,'z');
 f=trace(f,[lower,vertical],new Map([['0,2','UP'],['3,2','RIGHT']]));
 has(f,3,3,'a');has(f,3,4,'z');has(f,3,5,undefined);
 f=trace(f,[lower],new Map([['0,2','UP'],['3,2','RIGHT']]));has(f,3,6,'a');
});
function fixture(){
 const op=chessRec({id:'flux_target',stats:{atk:0}}),device={key:'trap_062_magicstart',name:"'Tuba'",kind:'device',hidden:false,row:10,col:3,instance:{level:1,skillLevel:1,direction:'RIGHT'}};
 const h=makeBattle({content:'none',autoFinish:false,defs:{chess:{[op.chessId]:op}},units:[{chessId:op.chessId,row:10,col:7,dir:'UP'},{chessId:op.chessId,row:11,col:7,dir:'UP'},{chessId:op.chessId,row:11,col:8}],
  setup:b=>{b.stageMagicCircuit=new StageMagicCircuit(b,[device],{rows:19,cols:21});installStageEnvironments(b,[{kind:'character_in_magiccircuit_env',sp_recover_ratio:-.5,'character_in_magiccircuit[normal].sp_recover_ratio':.5}]);}});
 h.b.start();return h;
}
test('operators redirect flux, tokens receive without redirecting, withdrawal and facing changes update SP',()=>{
 const h=fixture(),b=h.b,[u,v,out]=h.allies().filter(u=>u.kind==='op');h.run(.1);
 assert.equal(b.stageMagicCircuit.contains(u),true);assert.equal(b.stageMagicCircuit.contains(v),true);assert.equal(b.stageMagicCircuit.contains(out),false);
 assert.equal(u.s.spRecovery,1);assert.equal(v.s.spRecovery,1);assert.equal(out.s.spRecovery,.5);
 u.kind='token';h.run(.1);assert.equal(b.stageMagicCircuit.contains(u),true);assert.equal(v.s.spRecovery,.5);
 u.kind='op';u.dir='UP';h.run(.1);assert.equal(v.s.spRecovery,1);
 u.dir='RIGHT';h.run(.1);assert.equal(v.s.spRecovery,.5);
 u.dir='UP';h.run(.1);b.retreat(u,{permanent:true});assert.equal(v.s.spRecovery,.5);
 assert.deepEqual(b.errors,[]);
});
test('Tuba consumes no deployment slot, cannot take damage, and untargetable allies do not redirect',()=>{
 const h=fixture(),b=h.b,[u,v]=h.allies().filter(u=>u.kind==='op'),device=[...b.stageMagicCircuit.entries.values()][0].unit;
 assert.equal(device.deploymentSlotCost,0);b.dealDamage(null,device,{amount:1000,type:'true'});assert.equal(device.hp,100);
 b.addBuff(u,{key:'hidden',flags:{untargetable:true}});h.run(.1);assert.equal(b.stageMagicCircuit.contains(u),false);assert.equal(v.s.spRecovery,.5);
 assert.deepEqual(b.errors,[]);
});
