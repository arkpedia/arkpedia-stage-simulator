// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny,ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { triggerEnemyRopeContact } from '../server/sim/content/arkpedia-enemy-rope-reactions.js';
import { enemySupport,nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { flyingBootsNative } from '../shared/arkpedia/enemy-flying-boots-features.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import index from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const ids=['enemy_1410_mmelee','enemy_1410_mmelee_2'];
function fixture(id=ids[0]){const f=spawnAny(id,{seconds:0,stats:{moveSpeed:0},autoFinish:false});f.b.rng=Object.assign(()=>0,f.b.rng);f.run(.05);const e=f.b.enemies[0],op=f.b.allyUnits[0];op.profile.noAttack=true;e.x=op.x;e.y=op.y;f.run(.1);assert.equal(e.blockedBy,op);return{...f,e};}
test('both mercenaries dodge Physical damage from melee and ranged sources, including while blocked',()=>{
  for(const id of ids){const f=fixture(id),e=f.e,op=f.b.allyUnits[0];assert.equal(e.s.dodgePhys,.4);
    for(const applyWay of['melee','ranged'])assert.equal(f.b.dealDamage(op,e,{amount:1000,type:'phys',applyWay,isAttack:true}),0);
    assert.ok(f.b.dealDamage(op,e,{amount:1000,type:'arts',applyWay:'ranged',isAttack:true})>0);
    assert.ok(f.b.dealDamage(op,e,{amount:1000,type:'phys',canDodge:false,isAttack:false})>0);assert.deepEqual(f.b.errors,[]);
  }
});
test('rope contact removes this passive permanently and repeated contacts preserve unrelated dodge buffs',()=>{
  const f=fixture(),e=f.e,op=f.b.allyUnits[0];f.b.addBuff(e,{key:'other-dodge',mods:{dodgePhys:.2}});
  triggerEnemyRopeContact(f.b,e);assert.equal(e.s.dodgePhys,.2);assert.equal(e.findBuff('enemy_mmelee_physical_evade'),null);
  triggerEnemyRopeContact(f.b,e);assert.equal(e.s.dodgePhys,.2);f.b.removeBuff(e,'other-dodge');
  assert.ok(f.b.dealDamage(op,e,{amount:1000,type:'phys',applyWay:'melee',isAttack:true})>0);
  f.run(3);assert.equal(e.s.dodgePhys,0);assert.deepEqual(f.b.errors,[]);
});
test('silence and control preserve the nonsilenceable passive; fresh spawns own independent rope reactions',()=>{
  const f=fixture(),e=f.e;for(const flag of['silence','stun','frozen']){f.b.addBuff(e,{key:'control',flags:{[flag]:true}});f.run(.2);assert.equal(e.s.dodgePhys,.4);f.b.removeBuff(e,'control');}
  const other=f.b.spawnEnemy(ids[0],{pos:[7,4]});triggerEnemyRopeContact(f.b,e);assert.equal(other.s.dodgePhys,.4);
  f.b.kill(e);triggerEnemyRopeContact(f.b,e);assert.equal(other.s.dodgePhys,.4);assert.deepEqual(f.b.errors,[]);
});
test('native admission rejects a different damage mask, contact target or derived effect lifetime',()=>{
  for(const id of ids)assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],index.prefabs,evidence).policy,id);
  for(const kind of['mask','contact','effect']){const ev=structuredClone(evidence);
    if(kind==='mask')ev.templates.enemy_mmelee_physical_evade.eventToActions.ON_TAKE_DAMAGE[0]._damageMask='MAGICAL';
    if(kind==='contact')ev.templates['enemy_mmelee_touched_rope[continues]'].eventToActions.ON_BUFF_TRIGGER[0]._buffKey='other';
    if(kind==='effect')ev.templates.enemy_mmelee_physical_evade.eventToActions.ON_BUFF_START[0]._finishDerivedBuffIfParentFinish=false;
    assert.equal(flyingBootsNative(ENEMY_RECORDS.enemies[ids[0]].levels[0],nativeComponents(ev,ids[0])),false,kind);
  }
});
test('original BB-1 loads Flying Boots mercenaries and resolves its full wave schedule',async()=>{
  const{loadContentContext,planStage}=await import('../tools/arkpedia/content-inventory.mjs');const{StandardBattle}=await import('../server/sim/arkpedia.js');const{defaultBuild}=await import('../shared/arkpedia/loadout.js');
  const c=await loadContentContext(),p=await planStage(c,'bb-1',{waves:true});assert.deepEqual(p.blockers,[]);
  const b=new StandardBattle({...c.mvp,stage:p.stage,enemies:{...c.mvp.enemies,...p.stage.enemies}},{operators:[defaultBuild(c.mvp.operators.char_123_fang)]});let count=0;
  b.on('enemySpawn',({enemy})=>{if(ids.includes(enemy.defId))count++;b.after(.5,()=>b.kill(enemy));});const life=b.life;b.start();b.runToEnd(600);
  assert.equal(b.reason,'cleared');assert.ok(count>0);assert.equal(b.life,life);assert.deepEqual(b.errors,[]);
});
