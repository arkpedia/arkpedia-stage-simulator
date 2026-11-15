// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {gertrudeNative,gertrudeImageNative} from '../shared/arkpedia/enemy-gertrude-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
import {StageMagicCircuit} from '../server/sim/content/arkpedia-stage-magic-circuit.js';
import {sortEnemyTargets} from '../server/sim/targeting.js';
const parent='enemy_1247_ltgtld',child='enemy_1248_ltholo';
function fixture({id=parent,beam=false,targets=false,autoFinish=false}={}){
 const op=chessRec({id:'gertrude_guard',stats:{maxHp:100000,atk:0,res:0,blockCnt:0},skill:{spType:'INCREASE_WHEN_TAKEN_DAMAGE',spCost:100}});
 const device={key:'trap_062_magicstart',name:"'Tuba'",hidden:false,kind:'device',row:9,col:6,instance:{level:1,skillLevel:1,direction:'UP'}};
 const h=makeBattle({content:'generic',autoFinish,timeLimit:120,defs:{enemies:Object.fromEntries([parent,child].map(id=>[id,ENEMY_RECORDS.enemies[id].levels[0]])),chess:{[op.chessId]:op}},
  units:targets?[{chessId:op.chessId,row:10,col:7},{chessId:op.chessId,row:11,col:6},{chessId:op.chessId,row:10,col:8}]:[],
  setup:b=>{installEnemyFeatures(b);b.stageMagicCircuit=new StageMagicCircuit(b,beam?[device]:[],{rows:19,cols:21});}});
 const b=h.b;b.start();const e=b.spawnEnemy(id,{pos:[10,6],route:{start:[10,6],end:[10,12],steps:[]}});
 if(id===parent)b.addBuff(e,{key:'fixtureHold',flags:{noMove:true}});
 return {...h,e,images:()=>b.enemies.filter(u=>u.defId===child&&u.alive)};
}
test('both original Gertrude levels and the image require their exact native actions and body clocks',()=>{
 for(const id of[parent,child,'enemy_1240_ltgint','enemy_1240_ltgint_2'])assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
 for(const field of ['_ignoreSilence','_unharmful','_onlySummonOneInTheSamePlace','_speed']){
  const d=structuredClone(native);
  if(field==='_speed'){
   const row=d.projectiles.projectile_enemy_ltgtld.find(r=>JSON.parse(r.originalJson)._speed!=null),c=JSON.parse(row.originalJson);c._speed=9;row.originalJson=JSON.stringify(c);
  }else{
   const rows=d.prefabs[`dyn/battle/prefabs/enemies/${parent}.prefab`];
   const row=rows.find(r=>field==='_ignoreSilence'?'_ignoreSilence'in JSON.parse(r.originalJson):'_actions'in JSON.parse(r.originalJson)),c=JSON.parse(row.originalJson);
   if(field==='_ignoreSilence')c._ignoreSilence=0;else{const a=JSON.parse(c._actions.SerializedState);a[0][field]=false;c._actions.SerializedState=JSON.stringify(a);}
   row.originalJson=JSON.stringify(c);
  }
  assert.equal(!!gertrudeNative(ENEMY_RECORDS.enemies[parent].levels[0],nativeComponents(d,parent)),false,field);
 }
 const d=structuredClone(native);d.templates.enemy_ltholo_t.eventToActions.ON_ENTER_MAGICCIRCUIT[0]._buff.triggerInterval=2;
 assert.equal(!!gertrudeImageNative(ENEMY_RECORDS.enemies[child].levels[0],nativeComponents(d,child)),false);
});
test('no-target summon uses its native release event, birth phase and one living image per tile',()=>{
 const h=fixture();h.run(10.7);assert.equal(h.images().length,0);h.run(.2);assert.equal(h.images().length,1);
 const c=h.images()[0];assert.equal(c.counted,false);assert.equal(c.profile.holdsBattle,false);assert.equal(c.s.flags.untargetable,true);
 h.run(.6);assert.ok(!c.s.flags.untargetable);assert.equal(c.s.flags.noMove,true);assert.equal(c.s.taunt,1);
 h.run(11);assert.equal(h.images().length,1,'a stationary source cannot stack duplicates');
 h.b.kill(c);h.run(10);assert.equal(h.images().length,1,'the next cast can replace a destroyed image');assert.deepEqual(h.b.errors,[]);
});
test('Gertrude ignores silence, while stun interrupts an unreleased summon and spends its cooldown',()=>{
 const h=fixture();h.b.applyStatus(h.e,'silence',{duration:30});h.run(11);assert.equal(h.images().length,1);
 const x=fixture();x.run(10.4);x.b.applyStatus(x.e,'stun',{duration:2});x.run(2);assert.equal(x.images().length,0);
 x.run(8.6);assert.equal(x.images().length,1);assert.deepEqual(x.b.errors,[]);
});
test('cast slowdown stretches the source release but not its independent cooldown',()=>{
 const h=fixture();h.b.addBuff(h.e,{key:'slowCast',mods:{slowDownMul:.5}});
 h.run(11.5);assert.equal(h.images().length,0);h.run(.3);assert.equal(h.images().length,1);
 const a=h.e.mem.ab.list.find(a=>a.clocks);assert.ok(a.clocks[0]<9);assert.deepEqual(h.b.errors,[]);
});
test('the image takes immediate then one-second Flux self damage; redirection and silence stop it',()=>{
 const h=fixture({id:child,beam:true}),hits=[];h.b.on('damaged',c=>{if(c.dmg.tags.includes('virtualImageFlux'))hits.push(c)});
 h.run(.4);assert.equal(h.e.hp,5000);h.run(.2);assert.equal(h.e.hp,4500);h.run(1);assert.equal(h.e.hp,4000);
 assert.ok(hits.every(c=>c.source===h.e&&c.target===h.e&&c.dmg.type==='true'&&c.dmg.noSp&&!c.dmg.isEnvironment));
 const source=[...h.b.stageMagicCircuit.entries.values()][0];source.unit.dir='LEFT';h.run(2);assert.equal(h.e.hp,4000);
 source.unit.dir='UP';h.run(.1);assert.equal(h.e.hp,3500);
 h.b.applyStatus(h.e,'silence',{duration:2});const hp=h.e.hp,x=h.e.x;h.run(1);assert.equal(h.e.hp,hp);assert.ok(h.e.x>x);assert.equal(h.e.s.moveSpeed,.1);
 h.b.addBuff(h.e,{key:'floorTest',mods:{moveFlat:1,moveMul:.5}});assert.equal(h.e.s.moveSpeed,.5,'minimum applies after modifiers instead of changing the zero base');
 assert.deepEqual(h.b.errors,[]);
});
test('ordinary attacks send two homing Arts projectiles and released shots survive source death',()=>{
 const h=fixture({targets:true}),hits=[];h.b.on('damaged',c=>{if(c.source===h.e&&c.target.side==='ally')hits.push(c)});
 h.step();assert.equal(h.b.projectiles.list.length,2);h.b.kill(h.e);h.run(.5);
 assert.equal(hits.length,2);assert.ok(hits.every(c=>c.dmg.type==='arts'&&c.dmg.isAttack&&c.hpLoss===700));
 assert.equal(h.allies().reduce((n,u)=>n+(u.skill?.sp??0),0),2);assert.deepEqual(h.b.errors,[]);
});
test('summoned images survive their parent without keeping victory open',()=>{
 const h=fixture({autoFinish:true});h.run(11);const image=h.images()[0];assert.ok(image);
 h.b.kill(h.e);h.step();assert.equal(image.alive,true);assert.equal(h.b.finished,true);assert.equal(h.b.reason,'cleared');
});
test('a summoned image attracts ordinary attacks with its native taunt despite not holding victory open',()=>{
 const h=fixture({targets:true});h.run(11.5);const image=h.images()[0];assert.ok(image);
 assert.equal(image.profile.holdsBattle,false);
 assert.deepEqual(sortEnemyTargets(h.b,h.allies()[0],[h.e,image],null),[image,h.e]);
});
