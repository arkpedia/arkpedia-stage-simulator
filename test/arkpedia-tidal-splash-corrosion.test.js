// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {applyStageEnemyTalentMultipliers} from '../shared/arkpedia/stage-enemy-talents.js';
import {loadContentContext,planStage} from '../tools/arkpedia/content-inventory.mjs';
const ids=['enemy_1161_tidmag','enemy_1161_tidmag_2','enemy_1162_magmot','enemy_1162_magmot_2'];
function fixture(id,compiled=false,row=records.enemies[id].levels[0]){
 const guard=chessRec({id:'tidal_splash_target',stats:{maxHp:1e6,atk:0,def:0,magicResistance:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(row):row},chess:{[guard.chessId]:guard}},
  units:[[10,6],[9,6],[11,6],[10,5],[10,7],[11,7]].map(([row,col])=>({chessId:guard.chessId,row,col})),setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[9,8]});e.profile.noAttack=true;
 const [target,...others]=h.b.allyUnits,hits=[];h.b.on('damaged',c=>{if(c.source===e&&c.dmg.type==='element')hits.push(c);});
 return{...h,e,target,cardinals:others.slice(0,4),diagonal:others[4],hits,ratio:row.talents.bb['EpDamage.attack@ep_damage_ratio'],
  hit:()=>h.b.dealDamage(e,target,{amount:e.s.atk,type:'arts',isAttack:true})};
}
for(const id of ids)test(`${id}: an accepted ordinary hit gives one Corrosion packet to the primary and each cardinal recipient`,()=>{
 for(const compiled of[false,true]){
  const f=fixture(id,compiled);f.hit();
  assert.deepEqual(f.hits.map(c=>c.target.id).sort(),[f.target,...f.cardinals].map(u=>u.id).sort());
  assert.ok(f.hits.every(c=>c.dmg.element==='erosion'&&c.amount===f.e.s.atk*f.ratio));
  assert.equal(f.diagonal.hp,f.diagonal.s.maxHp);assert.equal(f.diagonal.elem.erosion,0);assert.deepEqual(f.b.errors,[]);
 }
});
test('primary barriers do not remove Corrosion and current ATK determines its amount independently of Arts mitigation',()=>{
 const f=fixture(ids[0],true);f.target.base.res=90;f.target.markDirty();
 f.b.addBuff(f.target,{key:'barrier',shield:10000});f.b.addBuff(f.e,{key:'attackUp',mods:{atkPct:.5}});
 const hp=f.target.hp;f.hit();assert.equal(f.target.hp,hp);
 const primary=f.hits.filter(c=>c.target===f.target);assert.equal(primary.length,1);assert.equal(primary[0].amount,f.e.s.atk*f.ratio);
 assert.deepEqual(f.b.errors,[]);
});
test('missed primary hits and unrelated ability damage cannot synthesize another splash or primary Corrosion packet',()=>{
 const f=fixture(ids[0]);f.b.addBuff(f.target,{key:'dodge',mods:{dodgeArts:1}});f.hit();assert.equal(f.hits.length,0);
 f.b.removeBuff(f.target,'dodge');f.b.dealDamage(f.e,f.target,{amount:100,type:'arts',isSkill:true,isAttack:false});
 assert.equal(f.hits.length,0);assert.deepEqual(f.b.errors,[]);
});
test('the declared stage multiplier changes every recipient through raw and compiled plans, while other parameters remain guarded',()=>{
 const id=ids[3],key='EpDamage.attack@ep_damage_ratio',before=structuredClone(records.enemies[id].levels[0]);
 const scaled=applyStageEnemyTalentMultipliers(before,{[key]:5});assert.equal(scaled.talents.bb[key],4);
 // Keep the packet below the burst threshold to inspect its exact amount.
 scaled.stats.atk=100;
 for(const compiled of[false,true]){
  const f=fixture(id,compiled,scaled);f.hit();assert.equal(f.hits.length,5);assert.ok(f.hits.every(h=>h.amount===400));
  assert.deepEqual(f.b.errors,[]);
 }
 assert.deepEqual(records.enemies[id].levels[0],before);
 for(const value of[0,-1,Infinity,NaN])assert.throws(()=>applyStageEnemyTalentMultipliers(before,{[key]:value}));
 assert.throws(()=>applyStageEnemyTalentMultipliers(before,{'DeathRattle.enemy_key':2}));
});
test('DH-S-3 normal and challenge compile the vehicle and its declared crew with the same original fivefold rule',async()=>{
 const context=await loadContentContext();
 for(const id of['dh-s-3','dh-s-3_challenge_mode']){
  const p=await planStage(context,id,{waves:true});assert.deepEqual(p.blockers,[],id);
  for(const enemy of['enemy_1162_magmot_2','enemy_1161_tidmag_2']){
   assert.ok(p.stage.enemies[enemy],`${id}: ${enemy} belongs to the complete graph`);
   assert.equal(p.stage.enemies[enemy].talents.bb['EpDamage.attack@ep_damage_ratio'],4);
  }
 }
});
test('both DH-S-3 variants resolve their original waves and spawned crew with the scaled behavior retained',async()=>{
 const {StandardBattle}=await import('../server/sim/arkpedia.js'),{defaultBuild}=await import('../shared/arkpedia/loadout.js');
 const context=await loadContentContext();
 for(const id of['dh-s-3','dh-s-3_challenge_mode']){
  const p=await planStage(context,id,{waves:true});assert.deepEqual(p.blockers,[]);
  const b=new StandardBattle({...context.mvp,stage:p.stage,enemies:p.stage.enemies},
   {operators:[defaultBuild(context.mvp.operators.char_123_fang)]});
  let crew=0;b.on('enemySpawn',({enemy})=>{if(enemy.defId==='enemy_1161_tidmag_2'){
   crew++;assert.equal(enemy.def.raw.talents.bb['EpDamage.attack@ep_damage_ratio'],4);
  }});
  b.on('tick',()=>{for(const e of b.enemies)if(e.alive&&!e.s.flags.reborn)b.kill(e);});
  const life=b.life;b.start();b.runToEnd(1200);
  assert.equal(b.reason,'cleared',id);assert.ok(crew>0,id);assert.equal(b.life,life);assert.deepEqual(b.errors,[]);
 }
});
