// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { StageReeds } from '../server/sim/content/arkpedia-stage-reeds.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const cannon = ['enemy_1289_dubmb','enemy_1289_dubmb_2'], flame = ['enemy_1290_duflm','enemy_1290_duflm_2'];
function fixture(id) {
  const guard = chessRec({ id: 'firelight_target', stats: { maxHp: 1e6, atk: 0, def: 0, res: 0, blockCnt: 0 }, skill: null });
  const record = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { enemies: { [id]: record }, chess: { [guard.chessId]: guard } },
    units: [6,7,8].map(col => ({ chessId: guard.chessId, row: 9, col })), setup: installEnemyFeatures });
  const b = h.b; b.start(); const [target, near, far] = b.allyUnits;
  for (const u of b.allyUnits) b.addBuff(u, { key: 'hold', flags: { noMove: true, disarm: true, noBlock: true } });
  const e = b.spawnEnemy(id, { pos: [9, 4] }), hits = [];
  // Pick a stable primary target while retaining normal attack clocks.
  b.addBuff(target, { key: 'primary', mods: { taunt: 100 } });
  b.on('damaged', c => { if (c.source === e) hits.push(c); });
  return { ...h, e, target, near, far, hits };
}
function reeds(b, cols = [4,5,6,8]) {
  b.stageReeds = new StageReeds(b, { kind:'reeds', scanInterval:.1, damageInterval:1, entryStealth:.2,
    tiles: cols.map(col => ({ row:9,col,ignite_duration:15,extinct_duration:20,cooldown_duration:5,damage:40,ep_damage:40 })) });
  return b.stageReeds;
}
for (const id of cannon) test(`${id}: two travelling single hits then a 3×3 splash, including aerial camouflage`, () => {
  const h = fixture(id), { b,e,target,near,far,hits } = h; near.motion = 'FLY'; b.addBuff(near,{key:'camou',flags:{camou:true}});
  assert.ok(h.runUntil(() => b.projectiles.list.length > 0, 3)); assert.equal(hits.length,0);
  assert.ok(h.runUntil(() => hits.length === 1, 1)); assert.equal(hits[0].target,target); assert.equal(hits[0].hpLoss,e.s.atk);
  assert.ok(h.runUntil(() => e.stats.attacks === 2,6)); h.run(.5); assert.equal(hits.length,2);
  assert.ok(h.runUntil(() => e.stats.attacks === 3,6)); assert.equal(hits.length,2); h.run(.5);
  assert.equal(hits.filter(c => c.target === target).length,3); assert.equal(hits.filter(c => c.target === near).length,1);
  assert.equal(hits.filter(c => c.target === far).length,0); assert.deepEqual(b.errors,[]);
});
test('Cannoneer stores three SP under Silence; spending two retains one, and a released shell survives death', () => {
  const h=fixture(cannon[0]),{b,e,near,hits}=h; b.addBuff(e,{key:'silenced',flags:{silence:true}});
  h.runUntil(()=>e.stats.attacks===4,22); h.run(.5); const charge=e.mem.ab.list.find(a=>'charge'in a);
  assert.equal(charge.charge,3); assert.equal(hits.filter(c=>c.target===near).length,0);
  b.removeBuff(e,'silenced'); assert.ok(h.runUntil(()=>e.stats.attacks===5,6)); assert.equal(charge.charge,1);
  b.kill(e); h.run(.5); assert.equal(hits.filter(c=>c.target===near).length,1); assert.deepEqual(b.errors,[]);
});
for (const id of flame) test(`${id}: target tile ignites at impact even when its Arts damage is evaded`,()=>{
  const h=fixture(id),{b,e,target,hits}=h; b.addBuff(target,{key:'dodge',mods:{dodgeArts:1}});
  assert.ok(h.runUntil(()=>b.projectiles.list.length>0,3)); const terrain=reeds(b,[6]);
  assert.equal(terrain.at(9,6).mode,0); assert.equal(hits.length,0);
  assert.ok(h.runUntil(()=>terrain.at(9,6).mode===1,1)); assert.equal(hits.length,0); assert.deepEqual(b.errors,[]);
});
test('Flamecaller released shot still ignites a vacated target tile',()=>{
  const h=fixture(flame[0]),{b,target}=h; assert.ok(h.runUntil(()=>b.projectiles.list.length>0,3));
  const terrain=reeds(b,[6]); b.kill(target); assert.ok(h.runUntil(()=>terrain.at(9,6).mode===1,1)); assert.deepEqual(b.errors,[]);
});
test('Flamecaller death blast is delayed, centered on its root tile, ground-only and separate from terrain selection',()=>{
  const h=fixture(flame[0]),{b,e,target,near,far,hits}=h;
  b.addBuff(e,{key:'stop',flags:{disarm:true}});e.x=4.49;e.y=9;
  target.x=5.89;near.x=4.5;near.motion='FLY';far.x=5.91;
  const terrain=reeds(b); b.kill(e);h.run(.4); assert.equal(hits.length,0);assert.equal(terrain.at(9,4).mode,0);
  h.run(.1); assert.equal(hits.length,1);assert.equal(hits[0].target,target);assert.equal(hits[0].hpLoss,300);
  assert.equal(hits[0].dmg.isSplash,true);assert.equal(hits[0].dmg.isAttack,false);assert.equal(hits[0].dmg.applyWay,'none');
  assert.equal(terrain.at(9,4).mode,1);assert.equal(terrain.at(9,5).mode,1);assert.equal(terrain.at(9,6).mode,0);assert.equal(terrain.at(9,8).mode,0);
  assert.deepEqual(b.errors,[]);
});
test('evading a death blast does not cancel tile ignition, while cooldown Reeds remain extinguished',()=>{
  const h=fixture(flame[0]),{b,e,target,hits}=h;target.x=5;b.addBuff(target,{key:'dodge',mods:{dodgeArts:1}});
  const terrain=reeds(b);terrain.switchMode(terrain.at(9,5),2);b.kill(e);h.run(.6);
  assert.equal(hits.length,0);assert.equal(terrain.at(9,4).mode,1);assert.equal(terrain.at(9,5).mode,2);
});
test('leaking does not emit the Flamecaller killed-only projectile',()=>{
  const h=fixture(flame[0]),{b,e}=h;const terrain=reeds(b);b.leak(e);h.run(.6);
  assert.equal(terrain.at(9,4).mode,0);
});
test('native admission refuses changed SP, impact event, projectile shape, death selector and ignition action',()=>{
  for(const id of [...cannon,...flame])assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
  const entry=structuredClone(ENEMY_RECORDS.enemies[cannon[0]]);entry.levels[0].sp.maxSp=2;assert.equal(enemySupport(entry,clocks.prefabs,native).policy,null);
  for(const change of ['event','shape','selector','action','speed']){
    const n=structuredClone(native),id=change==='shape'?cannon[0]:flame[0];
    const rows=change==='shape'?n.projectiles.projectile_enemy_dubmb_2:change==='selector'?n.projectiles.projectile_enemy_duflm_2:change==='speed'?n.projectiles.projectile_enemy_duflm:n.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];
    for(const row of rows){const d=JSON.parse(row.originalJson);
      if(change==='event'&&'_actionEvent'in d)d._actionEvent=0;
      if(change==='shape'&&d.m_Size)d.m_Size.x=4;
      if(change==='selector'&&d._targetOptions)d._targetOptions.targetMotion=3;
      if(change==='action'&&d._actions){const a=JSON.parse(d._actions.SerializedState);a[0]._modeIndex=2;d._actions.SerializedState=JSON.stringify(a);}
      if(change==='speed'&&'_speed'in d)d._speed=1;row.originalJson=JSON.stringify(d);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,n).policy,null,change);
  }
});
