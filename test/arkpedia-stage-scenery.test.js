// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { sceneryNativeReviewed } from '../shared/arkpedia/stage-scenery.js';
import { canTargetAlly } from '../server/sim/targeting.js';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
const c = await loadContentContext(), plans = new Map();
for (const id of ['ri-2', 'af-7', '1-6', 'h5-1']) {
  const p = await planStage(c, id); assert.deepEqual(p.blockers, []); plans.set(id, p);
}
function setup(id, mutate = () => {}) {
  const stage = structuredClone(plans.get(id).stage); stage.waves = []; mutate(stage);
  const b = new StandardBattle({ ...c.mvp, stage, enemies: { ...c.mvp.enemies, ...stage.enemies } },
    { operators: ['char_123_fang', 'char_122_beagle'].map(id => defaultBuild(c.mvp.operators[id])) });
  b.setViewport('fullscreen-workspace'); b.autoFinish = false; b.life = 1e6; b.getPlayer('arkpedia').dp = 99;
  return { b, advance: t => { for (let i = 0; i < Math.ceil(t / b.dt); i++) b.step(); } };
}
const tile = (b, r, col, pass = 'ALL', build = 'MELEE') => b.grid.setTile(r, col, { ...b.grid.tile(r, col), pass, build });

test('scenery source review rejects changed aura stacking and obstacle routing contracts', () => {
  assert.equal(sceneryNativeReviewed('trap_015_tree'), true); assert.equal(sceneryNativeReviewed('trap_001_crate'), true);
  const n = structuredClone(native);
  n.prefabs.sktok_tree.components.find(c => '_removeBuffWhenTargetLeave' in c.data).data._buffs[0].independentCharacterSource = 1;
  assert.equal(sceneryNativeReviewed('trap_015_tree', n), false);
  n.prefabs.trap_001_crate.components.find(c => '_tileOptions' in c.data).data._tileOptions.overrideObstacleLikeMoveCost = 0;
  assert.equal(sceneryNativeReviewed('trap_001_crate', n), false);
});

test('preplaced Roadblocks have real allied bodies, block routes and refund on retreat', () => {
  const { b } = setup('af-7');
  const crates = b.allyUnits.filter(u => u.mem.stageSupplyDefinition?.unitId === 'trap_001_crate');
  assert.equal(crates.length, 10); const u = crates[0];
  assert.equal(u.hp, 100); assert.equal(u.s.blockCnt, 3); assert.equal(u.deploymentSlotCost, 0);
  assert.equal(b.grid.isCrate(u.tileR, u.tileC), true); assert.equal(canTargetAlly(null, u), false);
  b.getPlayer('arkpedia').dp = 20; b.retreatStageToken(u.mem.stageSupplyId);
  assert.equal(b.getPlayer('arkpedia').dp, 22); assert.equal(b.grid.isObstacle(u.tileR, u.tileC), false);
  assert.deepEqual(b.errors, []);
});

test('Roadblock placement rejects a newly sealed route without spending stock or changing the grid', () => {
  const { b, advance } = setup('1-6');
  for (let r = 3; r <= 6; r++) for (let col = 0; col <= 6; col++) tile(b, r, col, 'NONE', 'NONE');
  for (let col = 1; col <= 5; col++) tile(b, 5, col);
  b.stageGroundRoutes = [{ motion: 'walk', start: { row: 5, col: 1 }, end: { row: 5, col: 5 } }];
  const version = b.grid.version, stock = b.mvpStageTokens.get('trap_001_crate');
  assert.throws(() => b.deployToken('trap_001_crate', 5, 3), /seal/);
  assert.equal(b.grid.version, version); assert.equal(b.getPlayer('arkpedia').dp, 99); assert.equal(b.mvpStageTokens.get('trap_001_crate'), stock);
  for (let col = 1; col <= 5; col++) tile(b, 4, col);
  const first = b.deployToken('trap_001_crate', 5, 3); assert.equal(first.hp, 100);
  assert.match(b.tokenPlacementError('trap_001_crate', 5, 2), /recharging/);
  advance(5.1); const second = b.deployToken('trap_001_crate', 5, 2);
  assert.equal(first.alive && second.alive, true); assert.equal(b.mvpStageTokens.get('trap_001_crate'), stock - 2);
  assert.deepEqual(b.errors, []);
});

test('Mushroom cover ignores isolation, does not stack, and falls back when one owner dies', () => {
  const { b, advance } = setup('ri-2', s => { s.devices[1].col = 6; });
  tile(b, 3, 5); tile(b, 2, 5);
  const target = b.deployOperator('char_123_fang', 3, 5, 'UP'), diagonal = b.deployOperator('char_122_beagle', 2, 5, 'UP');
  const base = target.s.def, outside = diagonal.s.def;
  b.addBuff(target, { key: 'isolated', flags: { isolated: true } }); advance(.1);
  const trees = [...b.stageScenery.entries.values()].map(x => x.unit);
  assert.equal(trees.length, 2); assert.equal(target.s.def, base + 150); assert.equal(diagonal.s.def, outside);
  b.kill(trees[0], trees[0]); assert.equal(target.s.def, base + 150);
  b.addBuff(target, { key: 'excluded', flags: { untargetable: true } }); advance(.1); assert.equal(target.s.def, base);
  b.removeBuff(target, 'excluded'); advance(.1); assert.equal(target.s.def, base + 150);
  b.kill(trees[1], trees[1]); assert.equal(target.s.def, base); assert.deepEqual(b.errors, []);
});

test('multiple supplied Jammers overlap without compounding slow and remove only their own coverage', () => {
  const { b, advance } = setup('h5-1');
  tile(b, 2, 3, 'ALL', 'RANGED'); tile(b, 2, 4, 'ALL', 'RANGED');
  const first = b.deployToken('trap_006_antidr', 2, 3); advance(5.1); b.getPlayer('arkpedia').dp = 99;
  const second = b.deployToken('trap_006_antidr', 2, 4);
  const drone = b.spawnEnemy('test-drone', { pos: [2, 3], def: { key: 'test-drone', name: 'Drone', tags: ['drone'], applyWay: 'NONE', dmgType: 'none',
    stats: { maxHp: 1000, hp: 1000, atk: 0, def: 0, res: 0, moveSpeed: 1, bat: 1, blockCnt: 0, lpr: 0 } } });
  b.addBuff(drone, { key: 'hold', flags: { noMove: true } }); const speed = drone.s.moveSpeed;
  advance(.1); assert.equal(drone.s.moveSpeed, speed * .5);
  b.retreatStageToken(first.mem.stageSupplyId); assert.equal(drone.s.moveSpeed, speed * .5); assert.ok(drone.s.flags.silence);
  b.retreatStageToken(second.mem.stageSupplyId); assert.equal(drone.s.moveSpeed, speed); assert.ok(!drone.s.flags.silence);
  assert.deepEqual(b.errors, []);
});
