// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport} from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const id='enemy_1257_lydrty';
function fixture(){
 const guard=chessRec({id:'dorothy_target',stats:{maxHp:1e9,atk:0,def:0,res:0,blockCnt:3},skill:null});
 const record=structuredClone(ENEMY_RECORDS.enemies[id].levels[0]);record.stats.moveSpeed=0;
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:2000,defs:{enemies:{[id]:record},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:10,col:8}],setup:installEnemyFeatures});
 h.b.start();const target=h.b.allyUnits[0];h.b.addBuff(target,{key:'hold',flags:{noMove:true,disarm:true}});
 const e=h.b.spawnEnemy(id,{pos:[10,5]}),hits=[];
 h.b.on('damaged',c=>{if(c.source===e)hits.push({time:h.b.time,loss:c.hpLoss,trap:c.dmg.tags.includes('enemyTileTrap')})});
 const traps=()=>h.b.projectiles.list.filter(p=>!p.removed&&p.data?.enemyTileTrigger);
 return{...h,e,target,hits,traps};
}
test('source animation releases a tile trap, then one grounded ally takes Arts damage and stun after arming',()=>{
 const h=fixture(),{b,e,target,hits,traps}=h;h.run(.5);assert.equal(traps().length,0);
 h.run(.3);assert.equal(traps().length,1);assert.equal(traps()[0].data.enemyTileTrigger.armed,false);
 assert.equal(b.relocate(target,10,5),true);h.run(.2);assert.equal(hits.filter(h=>h.trap).length,0);
 h.run(.3);const damage=hits.filter(h=>h.trap);assert.equal(damage.length,1);assert.equal(damage[0].loss,975);
 assert.equal(traps().length,0);assert.equal(target.s.flags.stun,true);assert.equal(e.mem.dorothyTrapStacks,1);assert.ok(Math.abs(e.s.atk-715)<1e-8);
 assert.equal(e.blockedBy,null);h.run(1);assert.equal(hits.filter(h=>h.trap).length,1);assert.deepEqual(b.errors,[]);
});
test('tile placement rejects occupied, non-buildable and off-centre tiles, and cannot stack persistent traps',()=>{
 for(const mode of ['occupied','blocked','off-centre','existing']){
  const h=fixture(),{b,e,target,traps}=h;
  if(mode==='occupied')b.relocate(target,10,5);
  if(mode==='blocked')b.grid.setTile(10,5,{...b.grid.tile(10,5),build:'NONE'});
  if(mode==='off-centre')e.x=5.4;
  h.run(15);assert.equal(traps().length,mode==='existing'?1:0,mode);assert.deepEqual(b.errors,[]);
 }
});
test('a released trap survives source death, retains its damage snapshot, and never holds victory',()=>{
 const h=fixture(),{b,e,target,hits,traps}=h;h.run(1.3);assert.equal(traps().length,1);
 b.kill(e);assert.equal(b._hasPendingEnemySchedules(),false);b.relocate(target,10,5);h.run(.3);
 assert.equal(hits.filter(h=>h.trap).length,1);assert.equal(hits.find(h=>h.trap).loss,975);assert.equal(e.mem.dorothyTrapStacks,undefined);
 assert.equal(target.s.flags.stun,true);assert.equal(traps().length,0);assert.deepEqual(b.errors,[]);
 const other=fixture();other.run(1.3);other.b.kill(other.e);other.b.projectiles.update(1000);
 assert.equal(other.traps().length,0);assert.deepEqual(other.b.errors,[]);
});
test('disarm cancels an unreleased cast; Slow Down scales release and end-based cooldown',()=>{
 const h=fixture(),{b,e,traps}=h;h.run(.2);b.addBuff(e,{key:'interrupt',flags:{disarm:true}});h.run(1);
 assert.equal(traps().length,0);assert.equal(e.profile.noAttack,false);b.removeBuff(e,'interrupt');h.run(4);
 assert.equal(traps().length,0);h.run(1);assert.equal(traps().length,1);
 const slow=fixture();slow.b.addBuff(slow.e,{key:'slow',mods:{slowDownMul:.5}});slow.run(1.1);assert.equal(slow.traps().length,0);
 slow.run(.3);assert.equal(slow.traps().length,1);assert.equal(slow.e.mem.regularFormVisual.speed,.5);
 slow.run(2);assert.equal(slow.e.profile.noAttack,true);slow.run(1);assert.equal(slow.e.profile.noAttack,false);
 assert.deepEqual(b.errors,[]);assert.deepEqual(slow.b.errors,[]);
});
test('trap triggers add ten-percent ATK stacks only up to fifty; released damage precedes its new stack',()=>{
 const h=fixture(),{b,e,target,hits,traps}=h;
 for(let i=0;i<52;i++){
  b.relocate(target,10,8);h.run(7.5);assert.equal(traps().length,1,`placement ${i}`);
  b.relocate(target,10,5);h.run(.3);
  const hit=hits.filter(h=>h.trap).at(-1);assert.ok(Math.abs(hit.loss-650*(1+Math.min(i,50)*.1)*1.5)<1e-6);
  assert.equal(e.mem.dorothyTrapStacks,Math.min(i+1,50));
 }
 assert.equal(e.s.atk,3900);assert.deepEqual(b.errors,[]);
});
test('ground-only target selection ignores an airborne ally until it lands',()=>{
 const h=fixture(),{b,target,hits,traps}=h;h.run(1.3);target.motion='FLY';b.relocate(target,10,5);h.run(.4);
 assert.equal(traps().length,1);assert.equal(hits.filter(h=>h.trap).length,0);
 target.motion='WALK';h.run(.3);assert.equal(traps().length,0);assert.equal(hits.filter(h=>h.trap).length,1);assert.deepEqual(b.errors,[]);
});
test('source gate rejects changed targeting, damage growth, and trap clocks',()=>{
 assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy);
 for(const mutate of [
  n=>n.templates['enemy_lydrty[buff_to_source]'].eventToActions.ON_BUFF_START[0]._buffOwner='BUFF_OWNER',
  n=>{const r=n.projectiles.projectile_enemy_lydrty_2.find(r=>JSON.parse(r.originalJson)._delayToStart===.5);const d=JSON.parse(r.originalJson);d._delayToStart=0;r.originalJson=JSON.stringify(d)},
  n=>n.ranges['0-1'].grids.push({row:1,col:0}),
 ]){const n=structuredClone(native);mutate(n);assert.equal(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,n).policy,null);}
});

test('DV-5 loads Dorothy from its original wave and an ordinary operator deployment triggers her trap',async()=>{
 const {loadContentContext,planStage}=await import('../tools/arkpedia/content-inventory.mjs');
 const {StandardBattle}=await import('../server/sim/arkpedia.js');
 const {defaultBuild}=await import('../shared/arkpedia/loadout.js');
 const c=await loadContentContext(),p=await planStage(c,'dv-5',{waves:true});assert.deepEqual(p.blockers,[]);
 const b=new StandardBattle({...c.mvp,stage:p.stage,enemies:{...c.mvp.enemies,...p.stage.enemies}},
  {operators:[defaultBuild(c.mvp.operators.char_123_fang)]});b.life=1e6;b.setViewport('fullscreen-workspace');
 let trap;
 for(let i=0;i<Math.ceil(90/b.dt);i++){
  b.step();trap=b.projectiles.list.find(p=>p.data?.enemyTileTrigger?.armed);if(trap)break;
 }
 assert.ok(trap);assert.equal(trap.source.defId,id);assert.ok(b.time>=55);
 const {row,col}=trap.data.enemyTileTrigger,unit=b.deployOperator('char_123_fang',row,col,'RIGHT'),hits=[];
 b.on('damaged',c=>{if(c.target===unit&&c.dmg.tags.includes('enemyTileTrap'))hits.push(c)});
 for(let i=0;i<Math.ceil(.3/b.dt);i++)b.step();
 assert.equal(hits.length,1);assert.equal(hits[0].source,trap.source);assert.equal(hits[0].hpLoss,975);
 assert.equal(unit.s.flags.stun,true);assert.equal(trap.source.mem.dorothyTrapStacks,1);assert.deepEqual(b.errors,[]);
});
