// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import source from '../data/candidates/arkpedia-stage-17-14-source.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {regularSummonCards,deployRegularSummon} from '../server/sim/content/arkpedia-summons.js';
import {installClosurPredefined,selectedClosurPredefined,CLOSUR_PREDEFINED_CONTRACT as contract,CLOSUR_PREDEFINED_KEY as KEY} from '../server/sim/content/arkpedia-closur-predefined.js';
import {until,near} from './helpers/mon3tr-fixture.js';
import {ally,enemy} from './helpers/closur-combat-fixture.js';
const ID='char_4228_closur',GUARD='char_122_beagle';
function battle(ids=[GUARD]){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const b=new StandardBattle(d,{operators:ids.map(id=>defaultBuild(d.operators[id]))});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 return b;
}
const install=b=>installClosurPredefined(b,{contract});

test('the retained predefined selects the exact position, facing, module, stats and separate control identity',()=>{
 const e=selectedClosurPredefined(source,{contract});
 assert.equal(e.key,KEY);assert.equal(e.row,3);assert.equal(e.col,3);assert.equal(e.dir,'RIGHT');assert.equal(e.deploymentSlotCost,1);
 assert.deepEqual(e.build,{id:ID,elite:2,level:90,potential:1,trust:100,skillId:'skchr_closur_3',skillRank:10,module:'uniequip_002_closur',moduleLevel:3,stage:'17-14'});
 assert.equal(e.record.stats.maxHp,1942);assert.equal(e.record.stats.atk,570);assert.equal(e.record.stats.def,176);
});

test('unreviewed source builds, placements, overrides, exclusions and predefine activation fail before installing anything',()=>{
 assert.throws(()=>selectedClosurPredefined(source),/Unreviewed/);
 for(const mutate of [s=>s.rawLevel.predefines.characterInsts[0].position.row++,s=>s.rawLevel.predefines.characterInsts[0].hidden=true,
  s=>s.rawLevel.predefines.characterInsts[0].uniEquipIds[0].level=2,s=>s.rawLevel.predefines.characterInsts[0].inst.favorPoint=100,
  s=>s.rawLevel.predefines.characterInsts[0].overrideTalents=[],s=>s.rawLevel.runes=s.rawLevel.runes.filter(r=>r.key!=='char_exclude'),
  s=>s.rawLevel.options.isPredefinedCardsSelectable=true]){
  const b=battle(),s=structuredClone(source);mutate(s);const dp=b.dp;
  assert.throws(()=>installClosurPredefined(b,{source:s,contract}),/Unreviewed/);
  assert.equal(b.predefinedOperators,undefined);assert.equal(b.regularClosurRoster,undefined);assert.equal(b.dp,dp);assert.equal(b.allyUnits.length,0);
 }
});

test('source installation preserves the chosen squad, DP and card discounts while occupying its own field slot',()=>{
 const b=battle(),entry=b.bench[GUARD],dp=b.dp;
 entry.costDelta=-3;b._fangFireSharpenedCard=-1;
 const f=install(b);
 assert.deepEqual(Object.keys(b.bench),[GUARD]);assert.equal(b.bench[GUARD],entry);assert.equal(entry.deployments,0);assert.equal(entry.costDelta,-3);
 assert.equal(b._fangFireSharpenedCard,-1);assert.equal(b.dp,dp);assert.equal(b.deployedSlots(),1);assert.equal(b.unitAt(3,3),f.u);
 assert.equal(f.u.dir,'RIGHT');assert.equal(f.u.mem.regularControlId,KEY);assert.equal(b.predefinedOperators.get(KEY).unit,f.u);
 assert.equal(b.regularClosurRoster.floor,-5);assert.equal(b.regularClosurRoster.atk,.08);near(f.u.s.atk,f.u.base.atk*1.08);
 assert.equal(f.u.mem.regularCostAttribute,undefined);assert.equal(b.withdrawOperator(f.u),false);assert.equal(b.dp,dp);assert.deepEqual(b.errors,[]);
});

test('the separate control activates real S3 and the actual command-center deck without a player Closure card',()=>{
 const b=battle(),f=install(b),cards=regularSummonCards(b);
 assert.equal(cards.length,1);assert.equal(cards[0].key,`summon:${ID}`);
 const t=deployRegularSummon(b,`summon:${ID}`,3,5,'RIGHT');
 until({b},()=>f.point.active(),2);assert.equal(f.point.point.unit,t);assert.equal(b.deployedSlots(),1);
 until({b},()=>f.controller.phase?.kind!=='born',5);
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(b.activateOperator(ID),false);b.setViewport('preview');assert.equal(b.activateOperator(KEY),false);
 b.setViewport('fullscreen-workspace');assert.equal(b.activateOperator(KEY),true);assert.ok(f.u.skill.active);
 const before=b.dp;until({b},()=>f.command.state.pulses>0,3);assert.ok(b.dp>before);assert.equal(f.controller.module.stopped,false);
 assert.deepEqual(b.errors,[]);
});

test('a second instance, player copy, occupied source tile, full field or late install cannot partially install the source role',()=>{
 const b=battle();install(b);assert.throws(()=>install(b),/fresh separate/);assert.equal(b.predefinedOperators.size,1);
 const copy=battle([ID]);assert.throws(()=>install(copy),/fresh separate/);assert.equal(copy.regularClosurRoster.atk,.04);
 for(const prepare of [b=>{b.unitLimit=0;},b=>{b.getPlayer('arkpedia').dp=99;b.deployOperator(GUARD,3,3,'RIGHT');},b=>b.step()]){
  const other=battle();prepare(other);const count=other.allyUnits.length,dp=other.dp;
  assert.throws(()=>install(other),/unavailable|fresh separate/);assert.equal(other.allyUnits.length,count);assert.equal(other.dp,dp);assert.equal(other.predefinedOperators,undefined);
 }
});

test('the actual source instance delivers its module reduction to a marked ally through its command center',()=>{
 const b=battle(),f={b,...install(b)};deployRegularSummon(b,`summon:${ID}`,3,5,'RIGHT');until(f,()=>f.point.active(),2);
 const target=ally(f,{row:3,col:6}),attacker=enemy(f,{row:3,col:6,blockedBy:target});
 f.controller.module.refresh();assert.ok(f.controller.module.marks.has(target));
 near(b.dealDamage(attacker,target,{amount:1000,type:'true',canDodge:false}),850);
 assert.deepEqual(b.errors,[]);
});

test('retirement cleans controllers and deck, rejects stale control lives and gives no player-card refund',()=>{
 for(const removal of ['killed','retreat']){
  const b=battle(),f=install(b),entry=b.bench[GUARD],dp=b.dp;entry.readyAt=123;
  const seq=f.u.deploySeq;f.u.deploySeq++;assert.equal(b.activateOperator(KEY),false);f.u.deploySeq=seq;
  if(removal==='killed')b.kill(f.u,null);else b.retreat(f.u,{permanent:true});
  assert.equal(f.u.alive,false);assert.ok(f.controller.stopped);assert.ok(f.point.stopped);assert.ok(f.controller.module.stopped);
  assert.equal(regularSummonCards(b).length,0);assert.equal(b.activateOperator(KEY),false);assert.equal(b.withdrawOperator(f.u),false);
  assert.equal(b.dp,dp);assert.equal(entry.readyAt,123);assert.throws(()=>install(b),/fresh separate/);assert.deepEqual(b.errors,[]);
 }
});

test('predefined delivery preserves the existing S3 enemy-clock admission guard',()=>{
 const b=battle();b.data.raw.enemies.enemy_1007_slime.skills=[{key:'unreviewed-stage-clock'}];
 assert.throws(()=>install(b),/native clock review/);assert.equal(b.allyUnits.length,0);assert.equal(b.predefinedOperators,undefined);
 assert.equal(b.regularClosurRoster,undefined);
});
