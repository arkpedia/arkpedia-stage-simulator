// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadContentContext,planStage} from '../tools/arkpedia/content-inventory.mjs';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {applyStageEnemyTalentMultipliers} from '../shared/arkpedia/stage-enemy-talents.js';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
const c=await loadContentContext();
const battle=stage=>new StandardBattle({...c.mvp,stage,enemies:{...c.mvp.enemies,...stage.enemies}},
 {operators:[defaultBuild(c.mvp.operators.char_123_fang)]});
const stage=async id=>{const p=await planStage(c,id);assert.deepEqual(p.blockers,[],id);return p.stage};
test('6-5 Challenge disables only the selected possessed enemies’ periodic HP loss',async()=>{
 const normal=await stage('6-5'),challenge=await stage('6-5_challenge_mode');
 for(const id of Object.keys(challenge.enemies).filter(id=>/^enemy_106[23]_/.test(id))){
  const a=battle(normal),b=battle(challenge),ordinary=a.spawnEnemy(id,{pos:[0,0]}),modified=b.spawnEnemy(id,{pos:[0,0]});
  const before=ordinary.hp,unchanged=modified.hp;
  assert.equal(challenge.enemies[id].talents.bb['periodic_damage.damage'],0);
  assert.ok(normal.enemies[id].talents.bb['periodic_damage.damage']>0);
  for(let i=0;i<90;i++){a.step();b.step();}
  assert.ok(ordinary.hp<before,id);assert.equal(modified.hp,unchanged,id);assert.deepEqual(b.errors,[]);
 }
});
test('9-16 Challenge removes Purifying Flame ATK weakening while preserving its impact and retirement',async()=>{
 for(const [id,expectedScale]of [['9-16',.3],['9-16_challenge_mode',1]]){
  const s=await stage(id),b=battle(s),key='enemy_1177_dufrbl';
  assert.ok(s.enemies[key],'unscheduled summoned flame belongs to the closure');
  b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);let tile;
  for(let r=b.rect.r0;r<=b.rect.r1&&!tile;r++)for(let col=b.rect.c0;col<=b.rect.c1;col++)
   if(!b.placementError('char_123_fang',r,col)){tile=[r,col];break;}
  assert.ok(tile);const target=b.deployOperator('char_123_fang',...tile,'RIGHT');
  b.addBuff(target,{key:'test:hp',mods:{hpFlat:100000},flags:{disarm:true}});target.hp=target.s.maxHp;
  const before=target.s.atk,hp=target.hp,e=b.spawnEnemy(key,{pos:[target.tileR,target.tileC]});
  for(let i=0;i<30&&e.alive;i++)b.step();
  assert.equal(e.alive,false);assert.ok(target.hp<hp);assert.ok(target.findBuff('ab:weaken'));
  assert.ok(Math.abs(target.s.atk-before*expectedScale)<1e-8,id);assert.deepEqual(b.errors,[]);
 }
});
test('TG-3 Challenge adds 300 ATK only to the two specified Metal Crab records',async()=>{
 const normal=await stage('tg-3'),s=await stage('tg-3_challenge_mode'),b=battle(s);
 for(const[id,r]of Object.entries(s.enemies)){
  const expected=normal.enemies[id].stats.atk*1.2+(/^enemy_1100_scorpn(?:_2)?$/.test(id)?300:0);
  assert.equal(r.stats.atk,expected,id);assert.equal(b.spawnEnemy(id,{pos:[0,0]}).s.atk,expected,id);
 }
});
test('zero multipliers require a declared parameter and remain distinct from negative scales',()=>{
 const flame=records.enemies.enemy_1177_dufrbl.levels[0],rager=records.enemies.enemy_1062_rager.levels[0];
 assert.equal(applyStageEnemyTalentMultipliers(rager,{'periodic_damage.damage':0}).talents.bb['periodic_damage.damage'],0);
 assert.equal(applyStageEnemyTalentMultipliers(flame,{'Weaken.atk':0}).talents.bb['Weaken.atk'],0);
 assert.equal(flame.talents.bb['Weaken.atk'],-.7);
 for(const values of [{'Weaken.duration':0},{'Weaken.atk':-1},{'Weaken.atk':2},{'Weaken.atk':Infinity}])
  assert.throws(()=>applyStageEnemyTalentMultipliers(flame,values),/Unsupported/);
});
