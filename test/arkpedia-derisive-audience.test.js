// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {derisiveAudienceNative} from '../shared/arkpedia/enemy-ordinary-element-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
const id='enemy_2009_csaudc',row=records.enemies[id].levels[0];
function battle(compiled=false){
  const guard=chessRec({id:'audience_guard',stats:{maxHp:1e6,atk:0,def:1000},skill:null});
  const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(row):row},chess:{[guard.chessId]:guard}},
    units:[{chessId:guard.chessId,row:9,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
  h.b.start();const e=h.b.spawnEnemy(id,{pos:[9,6]});h.b.addBuff(e,{key:'test:hold',flags:{noMove:true}});
  return {h,e,g:h.b.allyUnits[0]};
}
test('ordinary attacks add 20% current ATK as neural damage independently of physical DEF mitigation',()=>{
  for(const compiled of[false,true]){
    const {h,e,g}=battle(compiled),hits=[];h.b.on('damaged',c=>{if(c.source===e&&c.dmg.type==='element')hits.push(c);});
    h.runUntil(()=>hits.length===1,4);assert.equal(hits.length,1);assert.equal(hits[0].dmg.element,'neural');assert.equal(hits[0].dmg.amount,150);
    assert.ok(g.hp<g.s.maxHp);h.b.addBuff(e,{key:'test:atk',mods:{atkPct:1}});
    h.runUntil(()=>hits.length===2,4);assert.equal(hits[1].dmg.amount,300);assert.deepEqual(h.b.errors,[]);
  }
});
test('an ordinary missed attack does not apply neural damage',()=>{
  const {h,e,g}=battle(),hits=[];h.b.addBuff(g,{key:'test:dodge',mods:{dodgePhys:1}});
  h.b.on('damaged',c=>{if(c.source===e&&c.dmg.type==='element')hits.push(c);});h.run(7);
  assert.equal(hits.length,0);assert.equal(g.hp,g.s.maxHp);assert.deepEqual(h.b.errors,[]);
});
test('source contract rejects changed element type, active buffs, binding flags and extra attached skills',()=>{
  const n=nativeComponents(native,id);assert.equal(derisiveAudienceNative(row,n),true);
  for(const edit of[
    n=>n.$ref(n.Default[0]._combat)._elementDamageType=3,
    n=>n.$ref(n.Default[0]._combat)._activeBuffs.push({}),
    n=>n.Combat.flatMap(c=>n.$siblings(c)).find(c=>'_applyBlackboardBySkill'in c)._applyBlackboardBySkill=1,
    n=>n.Default[0]._attackTrigger={m_FileID:0,m_PathID:'123'},
  ]){const copy=nativeComponents(structuredClone(native),id);edit(copy);assert.equal(derisiveAudienceNative(row,copy),false);}
  const changed=structuredClone(row);changed.talents.bb['combat.attack@ep_damage_ratio']=.3;assert.equal(derisiveAudienceNative(changed,n),false);
});
test('the newly unblocked individual IS stage loads its complete enemy graph and resolves all waves',async()=>{
  const {loadContentContext,planStage}=await import('../tools/arkpedia/content-inventory.mjs');
  const {StandardBattle}=await import('../server/sim/arkpedia.js');const {defaultBuild}=await import('../shared/arkpedia/loadout.js');
  const context=await loadContentContext(),p=await planStage(context,'isw-sp_level_obt_roguelike_ro1_level_rogue1_ev-3',{waves:true});
  assert.deepEqual(p.blockers,[]);const b=new StandardBattle({...context.mvp,stage:p.stage,enemies:p.stage.enemies},
    {operators:[defaultBuild(context.mvp.operators.char_123_fang)]});let count=0;
  b.on('enemySpawn',({enemy})=>{if(enemy.defId===id)count++;});
  b.on('tick',()=>{for(const e of b.enemies)if(e.alive&&!e.s.flags.reborn)b.kill(e);});
  const life=b.life;b.start();b.runToEnd(600);assert.equal(b.reason,'cleared');assert.ok(count>0);assert.equal(b.life,life);assert.deepEqual(b.errors,[]);
});
